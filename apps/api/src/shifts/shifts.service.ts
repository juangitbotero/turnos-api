import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Shift, ShiftStatus } from './entities/shift.entity';
import { ShiftApplication, ApplicationStatus } from './entities/shift-application.entity';
import { Employer } from '../users/entities/employer.entity';
import { Worker } from '../users/entities/worker.entity';
import { ShiftsGateway } from '../gateway/shifts.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { ReNotificationJobData } from '../notifications/processors/re-notification.processor';
import { ComplianceService } from '../compliance/compliance.service';

// 5 hours in milliseconds — delay before re-notification job fires
const RE_NOTIFY_DELAY_MS = 5 * 60 * 60 * 1000;

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private shiftRepo: Repository<Shift>,
    @InjectRepository(ShiftApplication)
    private applicationRepo: Repository<ShiftApplication>,
    @InjectRepository(Employer)
    private employerRepo: Repository<Employer>,
    @InjectRepository(Worker)
    private workerRepo: Repository<Worker>,
    @InjectQueue('shift-notifications')
    private notificationQueue: Queue,
    private readonly gateway: ShiftsGateway,
    private readonly notifications: NotificationsService,
    private readonly compliance: ComplianceService,
  ) {}

  // ── Internal helpers ──────────────────────────────────────────────────────

  private async resolveEmployer(userId: string): Promise<Employer> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: userId } } });
    if (!employer) throw new UnauthorizedException('Employer profile not found');
    return employer;
  }

  /** Resolve Worker entity from JWT userId. Throws if not found. */
  private async resolveWorker(userId: string): Promise<Worker> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: userId } } });
    if (!worker) throw new UnauthorizedException('Worker profile not found');
    return worker;
  }

  private makeLocation(lat: number, lng: number) {
    return { type: 'Point', coordinates: [lng, lat] }; // GeoJSON: [lon, lat]
  }

  // ── Employer actions ──────────────────────────────────────────────────────

  async create(userId: string, data: {
    title: string;
    description: string;
    category: string;
    subcategory: string;
    role?: string;
    date: string;
    startTime: string;
    endTime: string;
    grossHourlyRate: number;
    address: string;
    lat: number;
    lng: number;
    skillsRequired?: string[];
  }): Promise<Shift> {
    const employer = await this.resolveEmployer(userId);
    const { lat, lng, ...rest } = data;
    const shift = this.shiftRepo.create({
      ...rest,
      status: ShiftStatus.OPEN,
      employer: { id: employer.id } as any,
      location: this.makeLocation(lat, lng),
      lat,
      lng,
    });
    const saved = await this.shiftRepo.save(shift);

    // Fire-and-forget: send push notifications to matching workers
    const skills = data.skillsRequired ?? [];
    this.notifications
      .notifyMatchingWorkers(saved.id, skills, saved.title)
      .catch(() => {}); // non-blocking

    // Schedule re-notification job for 5 hours later
    await this.notificationQueue.add(
      're-notify',
      {
        shiftId: saved.id,
        shiftTitle: saved.title,
        requiredSkills: skills,
      } satisfies ReNotificationJobData,
      { delay: RE_NOTIFY_DELAY_MS },
    );

    return saved;
  }

  async findByEmployer(userId: string): Promise<Shift[]> {
    const employer = await this.resolveEmployer(userId);
    return this.shiftRepo.find({
      where: { employer: { id: employer.id } },
      order: { createdAt: 'DESC' },
    });
  }

  async update(userId: string, shiftId: string, data: Partial<Shift> & { lat?: number; lng?: number }): Promise<Shift> {
    const employer = await this.resolveEmployer(userId);
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId }, relations: ['employer'] });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if (![ShiftStatus.DRAFT, ShiftStatus.OPEN].includes(shift.status)) {
      throw new BadRequestException('Only DRAFT or OPEN shifts can be edited');
    }
    const { lat, lng, ...rest } = data;
    Object.assign(shift, rest);
    if (lat !== undefined && lng !== undefined) {
      shift.location = this.makeLocation(lat, lng);
      shift.lat = lat;
      shift.lng = lng;
    }
    return this.shiftRepo.save(shift);
  }

  async cancel(userId: string, shiftId: string): Promise<Shift> {
    const employer = await this.resolveEmployer(userId);
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId }, relations: ['employer'] });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if ([ShiftStatus.ACTIVE, ShiftStatus.COMPLETED].includes(shift.status)) {
      throw new BadRequestException('Cannot cancel an active or completed shift');
    }

    // Collect applicants to notify via WebSocket
    const applications = await this.applicationRepo.find({
      where: { shift: { id: shiftId } },
      relations: ['worker'],
    });

    shift.status = ShiftStatus.CANCELLED;
    const saved = await this.shiftRepo.save(shift);

    // Notify all applicants that the shift was cancelled
    const workerIds = applications.map(a => a.worker?.id).filter((id): id is string => !!id);
    if (workerIds.length > 0) {
      this.gateway.notifyShiftCancelled(workerIds, {
        shiftId: saved.id,
        shiftTitle: saved.title,
      });
    }

    return saved;
  }

  async getApplications(userId: string, shiftId: string): Promise<ShiftApplication[]> {
    const employer = await this.resolveEmployer(userId);
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId }, relations: ['employer'] });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    return this.applicationRepo.find({
      where: { shift: { id: shiftId } },
      relations: ['worker'],
      order: { appliedAt: 'DESC' },
    });
  }

  async approveApplication(userId: string, shiftId: string, applicationId: string): Promise<Shift> {
    const employer = await this.resolveEmployer(userId);
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId }, relations: ['employer'] });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if (shift.status !== ShiftStatus.OPEN) throw new BadRequestException('Shift is no longer open');

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['worker'],
    });
    if (!application) throw new NotFoundException('Application not found');

    application.status = ApplicationStatus.APPROVED;
    await this.applicationRepo.save(application);

    shift.assignedWorker = application.worker;
    shift.status = ShiftStatus.FILLED;
    await this.shiftRepo.save(shift);

    // Reject all other pending applications
    const rejectedApps = await this.applicationRepo.find({
      where: { shift: { id: shiftId }, status: ApplicationStatus.PENDING },
      relations: ['worker'],
    });
    await this.applicationRepo
      .createQueryBuilder()
      .update(ShiftApplication)
      .set({ status: ApplicationStatus.REJECTED })
      .where('shiftId = :shiftId AND id != :applicationId AND status = :status', {
        shiftId,
        applicationId,
        status: ApplicationStatus.PENDING,
      })
      .execute();

    // WebSocket: notify approved worker
    if (application.worker?.id) {
      this.gateway.notifyApplicationStatus(application.worker.id, {
        shiftId: shift.id,
        shiftTitle: shift.title,
        applicationId: application.id,
        status: 'APPROVED',
      });
    }

    // WebSocket: notify rejected workers
    for (const rejectedApp of rejectedApps) {
      if (rejectedApp.worker?.id) {
        this.gateway.notifyApplicationStatus(rejectedApp.worker.id, {
          shiftId: shift.id,
          shiftTitle: shift.title,
          applicationId: rejectedApp.id,
          status: 'REJECTED',
        });
      }
    }

    // ── Compliance: create MCD contract + schedule SS Direta notification ──
    if (application.worker) {
      this.compliance.onShiftApproved(shift, application.worker, employer).catch(err =>
        console.error('[Compliance] onShiftApproved error:', err),
      );
    }

    return this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    }) as Promise<Shift>;
  }

  // ── Worker actions ────────────────────────────────────────────────────────

  async search(filters: {
    lat?: number;
    lng?: number;
    radiusMeters?: number;
    category?: string;
  }): Promise<Shift[]> {
    const query = this.shiftRepo
      .createQueryBuilder('shift')
      .leftJoinAndSelect('shift.employer', 'employer')
      .where('shift.status = :status', { status: ShiftStatus.OPEN });

    if (filters.lat !== undefined && filters.lng !== undefined) {
      const radius = filters.radiusMeters ?? 20000;
      query
        .andWhere(
          `ST_DWithin(
            shift.location::geography,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            :radius
          )`,
        )
        .addOrderBy(
          `ST_Distance(shift.location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)`,
          'ASC',
        )
        .setParameters({ lng: filters.lng, lat: filters.lat, radius });
    }

    if (filters.category) {
      query.andWhere('shift.category = :category', { category: filters.category });
    }

    return query.getMany();
  }

  async apply(userId: string, shiftId: string): Promise<ShiftApplication & { warning?: string }> {
    // Resolve the Worker entity from the JWT userId
    const worker = await this.resolveWorker(userId);

    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status !== ShiftStatus.OPEN) throw new BadRequestException('Shift is not open for applications');

    const existing = await this.applicationRepo.findOne({
      where: { shift: { id: shiftId }, worker: { id: worker.id } },
    });
    if (existing) throw new BadRequestException('Already applied to this shift');

    // ── Compliance checks (hard blocks throw; soft warning is returned) ──
    const { warning } = await this.compliance.checkApplicationEligibility(worker, shift);

    const application = this.applicationRepo.create({
      shift:  { id: shiftId } as any,
      worker: { id: worker.id } as any,
      status: ApplicationStatus.PENDING,
    });
    const saved = await this.applicationRepo.save(application);

    // WebSocket: notify employer in real time
    if (shift.employer?.id) {
      this.gateway.notifyNewApplication(shift.employer.id, {
        shiftId:       shift.id,
        shiftTitle:    shift.title,
        applicationId: saved.id,
        workerName:    worker.fullName ?? null,
        workerScore:   worker.profileQualityScore,
      });
    }

    return warning ? { ...saved, warning } : saved;
  }

  async findWorkerApplications(userId: string): Promise<ShiftApplication[]> {
    // Resolve Worker entity from JWT userId
    const worker = await this.resolveWorker(userId);
    return this.applicationRepo.find({
      where: { worker: { id: worker.id } },
      relations: ['shift', 'shift.employer'],
      order: { appliedAt: 'DESC' },
    });
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Shift> {
    const shift = await this.shiftRepo.findOne({
      where: { id },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }
}

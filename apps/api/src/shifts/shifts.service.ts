import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift, ShiftStatus } from './entities/shift.entity';
import { ShiftApplication, ApplicationStatus } from './entities/shift-application.entity';
import { Employer } from '../users/entities/employer.entity';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private shiftRepo: Repository<Shift>,
    @InjectRepository(ShiftApplication)
    private applicationRepo: Repository<ShiftApplication>,
    @InjectRepository(Employer)
    private employerRepo: Repository<Employer>,
  ) {}

  // ── Internal helpers ──────────────────────────────────────────────────────

  private async resolveEmployer(userId: string): Promise<Employer> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: userId } } });
    if (!employer) throw new UnauthorizedException('Employer profile not found');
    return employer;
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
    });
    return this.shiftRepo.save(shift);
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
    shift.status = ShiftStatus.CANCELLED;
    return this.shiftRepo.save(shift);
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

    // Reject all other pending applications for this shift
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

    return this.shiftRepo.findOne({ where: { id: shiftId }, relations: ['employer', 'assignedWorker'] }) as Promise<Shift>;
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

  async apply(workerId: string, shiftId: string): Promise<ShiftApplication> {
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status !== ShiftStatus.OPEN) throw new BadRequestException('Shift is not open for applications');

    const existing = await this.applicationRepo.findOne({
      where: { shift: { id: shiftId }, worker: { id: workerId } },
    });
    if (existing) throw new BadRequestException('Already applied to this shift');

    const application = this.applicationRepo.create({
      shift: { id: shiftId } as any,
      worker: { id: workerId } as any,
      status: ApplicationStatus.PENDING,
    });
    return this.applicationRepo.save(application);
  }

  async findWorkerApplications(workerId: string): Promise<ShiftApplication[]> {
    return this.applicationRepo.find({
      where: { worker: { id: workerId } },
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

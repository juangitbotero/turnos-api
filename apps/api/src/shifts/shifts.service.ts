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
import { PaymentsService } from '../payments/payments.service';

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
    private readonly payments: PaymentsService,
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
    // Guard: minimum 2-hour shift duration
    const [sh, sm] = data.startTime.split(':').map(Number);
    const [eh, em] = data.endTime.split(':').map(Number);
    let shiftMins = ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0));
    if (shiftMins < 0) shiftMins += 24 * 60; // overnight shift
    if (shiftMins < 120) {
      throw new BadRequestException('A duração mínima de um turno é 2 horas.');
    }

    // Guard: active subscription + concurrent shift limit
    await this.payments.assertCanPostShift(userId);

    const employer = await this.resolveEmployer(userId);
    const { lat, lng, ...rest } = data;
    const shift = this.shiftRepo.create({
      ...rest,
      status: ShiftStatus.OPEN,
      employer: { id: employer.id } as any,
      lat,
      lng,
    });
    const saved = await this.shiftRepo.save(shift);

    // Fire-and-forget: send push notifications to matching workers
    const skills = data.skillsRequired ?? [];
    this.notifications
      .notifyMatchingWorkers(saved.id, employer.id, skills, saved.title)
      .catch(() => {}); // non-blocking

    // Schedule re-notification job for 5 hours later
    await this.notificationQueue.add(
      're-notify',
      {
        shiftId: saved.id,
        shiftTitle: saved.title,
        requiredSkills: skills,
        employerId: employer.id,
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
      shift.lat = lat;
      shift.lng = lng;
    }
    return this.shiftRepo.save(shift);
  }

  async cancel(
    userId: string,
    shiftId: string,
  ): Promise<Shift & { cancellationFee?: { feeEur: number; workerCompensationEur: number } }> {
    const employer = await this.resolveEmployer(userId);
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if ([ShiftStatus.ACTIVE, ShiftStatus.COMPLETED].includes(shift.status)) {
      throw new BadRequestException('Cannot cancel an active or completed shift');
    }

    // ── Cancellation fee: 15% if ≤12h before shift start on a FILLED shift ──
    let cancellationFee: { feeEur: number; workerCompensationEur: number } | undefined;
    if (shift.status === ShiftStatus.FILLED) {
      try {
        const fee = await this.payments.checkCancellationFee(shiftId);
        if (fee.isLate) {
          cancellationFee = {
            feeEur:               fee.feeCents / 100,
            workerCompensationEur: fee.workerShareCents / 100,
          };
          // Fire-and-forget — cancellation proceeds regardless of charge outcome
          this.payments
            .chargeCancellationFee(
              shiftId,
              employer.id,
              shift.assignedWorker?.id ?? null,
              fee.grossAmount,
              fee.feeCents,
              fee.workerShareCents,
              shift.date,
              shift.title,
            )
            .catch(err => console.error('[Payments] chargeCancellationFee error:', err));
        }
      } catch (err) {
        console.error('[Payments] checkCancellationFee error:', err);
      }
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

    return cancellationFee ? { ...saved, cancellationFee } : saved;
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

    // Move shift to PENDING_ACCEPTANCE — worker must confirm within 2 hours
    shift.assignedWorker = application.worker;
    shift.status = ShiftStatus.PENDING_ACCEPTANCE;
    await this.shiftRepo.save(shift);

    // Application stays PENDING until worker confirms; update to a pre-approved marker
    application.status = ApplicationStatus.APPROVED;
    await this.applicationRepo.save(application);

    // Push notification to worker: pre-selected, must accept/decline in 2h
    if (application.worker?.expoPushToken) {
      this.notifications.sendDirectPush(
        [application.worker.expoPushToken],
        '🎉 Foste pré-selecionado!',
        `Tens 2 horas para aceitar o turno: ${shift.title}. Abre a app para confirmar.`,
        { type: 'pre_selected', shiftId: shift.id },
      ).catch(() => {});
    }

    // WebSocket: notify worker immediately
    if (application.worker?.id) {
      this.gateway.notifyApplicationStatus(application.worker.id, {
        shiftId: shift.id,
        shiftTitle: shift.title,
        applicationId: application.id,
        status: 'PRE_SELECTED',
      });
    }

    // BullMQ: 2h timeout — if worker hasn't confirmed, revert to OPEN
    await this.notificationQueue.add(
      'acceptance-timeout',
      { shiftId: shift.id, applicationId: application.id },
      { delay: 2 * 60 * 60 * 1000 },
    );

    return this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    }) as Promise<Shift>;
  }

  // ── Worker confirms or declines pre-selection ─────────────────────────────

  async workerConfirmShift(workerUserId: string, shiftId: string): Promise<Shift> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } } });
    if (!worker) throw new UnauthorizedException('Worker not found');

    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'employer.user', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.assignedWorker?.id !== worker.id) throw new UnauthorizedException('Not your shift');
    if (shift.status !== ShiftStatus.PENDING_ACCEPTANCE) throw new BadRequestException('Shift is not awaiting your confirmation');

    shift.status = ShiftStatus.FILLED;
    await this.shiftRepo.save(shift);

    const application = await this.applicationRepo.findOne({
      where: { shift: { id: shiftId }, worker: { id: worker.id } },
    });

    // Reject all other pending applications now that worker confirmed
    await this.applicationRepo
      .createQueryBuilder()
      .update(ShiftApplication)
      .set({ status: ApplicationStatus.REJECTED })
      .where('"shiftId" = :shiftId AND id != :appId AND status = :status', {
        shiftId,
        appId: application?.id ?? '',
        status: ApplicationStatus.PENDING,
      })
      .execute();

    // Notify employer via WebSocket
    this.gateway.notifyShiftFilled(shift.employer.id, { shiftId: shift.id, shiftTitle: shift.title });

    // Compliance
    this.compliance.onShiftApproved(shift, worker, shift.employer).catch(err =>
      console.error('[Compliance] onShiftApproved error:', err),
    );

    return shift;
  }

  async workerDeclineShift(workerUserId: string, shiftId: string): Promise<{ message: string }> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } } });
    if (!worker) throw new UnauthorizedException('Worker not found');

    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'employer.user', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.assignedWorker?.id !== worker.id) throw new UnauthorizedException('Not your shift');
    if (shift.status !== ShiftStatus.PENDING_ACCEPTANCE) throw new BadRequestException('Shift is not awaiting your confirmation');

    // Revert shift to OPEN, clear assigned worker
    shift.status = ShiftStatus.OPEN;
    shift.assignedWorker = undefined as any;
    await this.shiftRepo.save(shift);

    // Revert the application to PENDING so employer can pick again
    const application = await this.applicationRepo.findOne({
      where: { shift: { id: shiftId }, worker: { id: worker.id } },
    });
    if (application) {
      application.status = ApplicationStatus.WITHDRAWN;
      await this.applicationRepo.save(application);
    }

    // Notify employer: worker declined
    this.gateway.notifyApplicationStatus(shift.employer.user.id, {
      shiftId: shift.id,
      shiftTitle: shift.title,
      applicationId: application?.id ?? '',
      status: 'DECLINED_BY_WORKER',
    });

    return { message: 'Turno recusado. O turno voltou ao estado aberto.' };
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
      const radius = filters.radiusMeters ?? 20000; // metres
      // Haversine distance using plain lat/lng — no PostGIS required
      const haversine = `(6371000 * 2 * ASIN(SQRT(
        POWER(SIN((RADIANS(shift.lat) - RADIANS(:lat)) / 2), 2) +
        COS(RADIANS(:lat)) * COS(RADIANS(shift.lat)) *
        POWER(SIN((RADIANS(shift.lng) - RADIANS(:lng)) / 2), 2)
      )))`;
      query
        .andWhere(`shift.lat IS NOT NULL AND shift.lng IS NOT NULL`)
        .andWhere(`${haversine} <= :radius`, { lat: filters.lat, lng: filters.lng, radius })
        .addOrderBy(haversine, 'ASC');
    }

    if (filters.category) {
      query.andWhere('shift.category = :category', { category: filters.category });
    }

    return query.getMany();
  }

  async apply(userId: string, shiftId: string, coverNote?: string): Promise<ShiftApplication & { warning?: string }> {
    // Resolve the Worker entity from the JWT userId
    const worker = await this.resolveWorker(userId);

    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status !== ShiftStatus.OPEN) throw new BadRequestException('Shift is not open for applications');

    // Profile gate — worker must have 80%+ profile to apply
    if (worker.profileQualityScore < 80) {
      throw new BadRequestException(
        `O teu perfil está ${worker.profileQualityScore}% completo. Precisas de pelo menos 80% para te candidatares.`,
      );
    }

    const existing = await this.applicationRepo.findOne({
      where: { shift: { id: shiftId }, worker: { id: worker.id } },
    });
    if (existing) throw new BadRequestException('Already applied to this shift');

    // ── Compliance checks (hard blocks throw; soft warning is returned) ──
    const { warning } = await this.compliance.checkApplicationEligibility(worker, shift);

    const application = this.applicationRepo.create({
      shift:     { id: shiftId } as any,
      worker:    { id: worker.id } as any,
      status:    ApplicationStatus.PENDING,
      coverNote: coverNote?.slice(0, 200),  // Enforce 200-char limit server-side
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

  /** Returns distinct workers who have an APPROVED application on any of this employer's shifts. */
  async findEmployerWorkers(userId: string): Promise<Array<{
    id: string; fullName: string | null; photoUrl: string | null;
    skills: string[] | null; availableDays: string[] | null;
    profileQualityScore: number; status: string; shiftsWorked: number;
    lastShiftDate: string | null;
    avgRating: number | null; totalRatings: number;
    noShowCount: number; badges: string[];
  }>> {
    const employer = await this.resolveEmployer(userId);
    const apps = await this.applicationRepo.find({
      where: {
        shift: { employer: { id: employer.id } },
        status: ApplicationStatus.APPROVED,
      },
      relations: ['worker', 'shift'],
      order: { appliedAt: 'DESC' },
    });

    const workerMap = new Map<string, {
      id: string; fullName: string | null; photoUrl: string | null;
      skills: string[] | null; availableDays: string[] | null;
      profileQualityScore: number; status: string; shiftsWorked: number;
      lastShiftDate: string | null;
      avgRating: number | null; totalRatings: number;
      noShowCount: number; badges: string[];
    }>();

    for (const app of apps) {
      if (!app.worker) continue;
      const w = app.worker;
      if (!workerMap.has(w.id)) {
        workerMap.set(w.id, {
          id:                  w.id,
          fullName:            w.fullName            ?? null,
          photoUrl:            w.photoUrl            ?? null,
          skills:              w.skills              ?? null,
          availableDays:       w.availableDays       ?? null,
          profileQualityScore: w.profileQualityScore,
          status:              w.status,
          shiftsWorked:        0,
          lastShiftDate:       app.shift?.date       ?? null,
          avgRating:           w.avgRating           ?? null,
          totalRatings:        w.totalRatings        ?? 0,
          noShowCount:         w.noShowCount         ?? 0,
          badges:              w.badges              ?? [],
        });
      }
      workerMap.get(w.id)!.shiftsWorked += 1;
    }
    return [...workerMap.values()];
  }

  // ── Employer directly invites a worker ────────────────────────────────────

  async inviteWorker(employerUserId: string, shiftId: string, workerId: string): Promise<Shift> {
    const employer = await this.resolveEmployer(employerUserId);
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if (shift.status !== ShiftStatus.OPEN) {
      throw new BadRequestException('Can only invite a worker to an OPEN shift');
    }

    const worker = await this.workerRepo.findOne({
      where: { id: workerId },
      relations: ['user'],
    });
    if (!worker) throw new NotFoundException('Worker not found');

    // Create or reuse an application for this worker on this shift
    let application = await this.applicationRepo.findOne({
      where: { shift: { id: shiftId }, worker: { id: workerId } },
    });

    if (!application) {
      application = this.applicationRepo.create({
        shift: { id: shiftId } as any,
        worker: { id: workerId } as any,
        status: ApplicationStatus.APPROVED,
      });
    } else {
      application.status = ApplicationStatus.APPROVED;
    }
    await this.applicationRepo.save(application);

    // Move shift to PENDING_ACCEPTANCE
    shift.assignedWorker = worker;
    shift.status = ShiftStatus.PENDING_ACCEPTANCE;
    await this.shiftRepo.save(shift);

    // Push notification to worker
    if (worker.expoPushToken) {
      this.notifications.sendDirectPush(
        [worker.expoPushToken],
        '🎉 Tens um convite de turno!',
        `A empresa ${employer.companyName ?? 'Empresa'} convidou-te para "${shift.title || shift.subcategory}". Tens 2h para aceitar.`,
        { type: 'pre_selected', shiftId: shift.id },
      ).catch(() => {});
    }

    // WebSocket notify worker
    if (worker.user?.id) {
      this.gateway.notifyApplicationStatus(worker.user.id, {
        shiftId: shift.id,
        shiftTitle: shift.title || shift.subcategory,
        applicationId: application.id,
        status: 'PRE_SELECTED',
      });
    }

    // 2h timeout
    await this.notificationQueue.add(
      'acceptance-timeout',
      { shiftId: shift.id, applicationId: application.id },
      { delay: 2 * 60 * 60 * 1000 },
    );

    return this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    }) as Promise<Shift>;
  }

  // ── Public worker search (for employers browsing talent) ──────────────────

  async searchWorkersPublic(filters: {
    skills?: string[];
    languages?: string[];
    available?: string[];
    minRating?: number;
  }) {
    const qb = this.workerRepo
      .createQueryBuilder('w')
      .where('w.status = :status', { status: 'ACTIVE' })
      .andWhere('w."profileQualityScore" >= 80')
      .select([
        'w.id', 'w.fullName', 'w.photoUrl', 'w.bio',
        'w.skills', 'w.languages', 'w.availableDays',
        'w.avgRating', 'w.totalRatings', 'w.noShowCount',
        'w.badges', 'w.profileQualityScore',
      ]);

    if (filters.skills?.length) {
      // Worker has at least one of the requested skills
      const skillConditions = filters.skills.map((_, i) => `w.skills LIKE :skill${i}`).join(' OR ');
      const skillParams: Record<string, string> = {};
      filters.skills.forEach((sk, i) => { skillParams[`skill${i}`] = `%${sk}%`; });
      qb.andWhere(`(${skillConditions})`, skillParams);
    }

    if (filters.languages?.length) {
      const langConditions = filters.languages.map((_, i) => `w.languages LIKE :lang${i}`).join(' OR ');
      const langParams: Record<string, string> = {};
      filters.languages.forEach((l, i) => { langParams[`lang${i}`] = `%${l}%`; });
      qb.andWhere(`(${langConditions})`, langParams);
    }

    if (filters.available?.length) {
      const dayConditions = filters.available.map((_, i) => `w."availableDays" LIKE :day${i}`).join(' OR ');
      const dayParams: Record<string, string> = {};
      filters.available.forEach((d, i) => { dayParams[`day${i}`] = `%${d}%`; });
      qb.andWhere(`(${dayConditions})`, dayParams);
    }

    if (filters.minRating) {
      qb.andWhere('CAST(w."avgRating" AS DECIMAL) >= :minRating', { minRating: filters.minRating });
    }

    qb.orderBy('w."avgRating"', 'DESC', 'NULLS LAST')
      .addOrderBy('w."profileQualityScore"', 'DESC');

    return qb.getMany();
  }

  // ── Repost an expired shift (duplicate with same data, date reset) ─────────

  async deleteExpiredShift(employerUserId: string, shiftId: string): Promise<{ message: string }> {
    const employer = await this.resolveEmployer(employerUserId);
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId }, relations: ['employer'] });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if (shift.status !== ShiftStatus.EXPIRED) throw new BadRequestException('Only EXPIRED shifts can be deleted this way');
    shift.status = ShiftStatus.CANCELLED;
    await this.shiftRepo.save(shift);
    return { message: 'Turno eliminado.' };
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

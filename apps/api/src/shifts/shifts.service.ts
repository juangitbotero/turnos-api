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
import { PAYMENT_METHOD_LABELS, COMPANY_CANCEL_REASONS, WORKER_CANCEL_REASONS } from '@turnos/shared';
import { Shift, ShiftStatus } from './entities/shift.entity';
import { ShiftApplication, ApplicationStatus } from './entities/shift-application.entity';
import { Employer } from '../users/entities/employer.entity';
import { Worker } from '../users/entities/worker.entity';
import { ShiftsGateway } from '../gateway/shifts.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { ReNotificationJobData } from '../notifications/processors/re-notification.processor';
import { ComplianceService } from '../compliance/compliance.service';
import { PaymentsService } from '../payments/payments.service';
import { WagePaymentsService } from '../payments/wage-payments.service';
import { MailService } from '../mail/mail.service';

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
    private readonly wagePayments: WagePaymentsService,
    private readonly mail: MailService,
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
    paymentMethod?: string;
  }): Promise<Shift> {
    // Guard: minimum 2-hour shift duration
    const [sh, sm] = data.startTime.split(':').map(Number);
    const [eh, em] = data.endTime.split(':').map(Number);
    let shiftMins = ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0));
    if (shiftMins < 0) shiftMins += 24 * 60; // overnight shift
    if (shiftMins < 120) {
      throw new BadRequestException('A duração mínima de um turno é 2 horas.');
    }

    // Guard: payment method is required — workers must know how they'll be
    // paid (directly by the company) before applying.
    const validMethods = Object.keys(PAYMENT_METHOD_LABELS);
    if (!data.paymentMethod || !validMethods.includes(data.paymentMethod)) {
      throw new BadRequestException(
        'Indica como vais pagar ao trabalhador (Turnos Pay Link, transferência, MB WAY ou numerário).',
      );
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
    reason?: { category?: string; note?: string },
  ): Promise<Shift & { cancellationConsequence?: string }> {
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

    // ── Company cancellation policy v1.1 (FILLED shifts only) ────────────────
    //   >24h: free · 24h–3h: free but reliability metric · <3h: reason required —
    //   ERRO_EMPRESA → 2h-minimum Pay Link + €3 fee; justified → ops review.
    let cancellationConsequence: string | undefined;
    if (shift.status === ShiftStatus.FILLED && shift.assignedWorker) {
      const shiftStart = new Date(`${shift.date}T${shift.startTime.slice(0, 5)}:00`);
      const hoursUntil = (shiftStart.getTime() - Date.now()) / (1000 * 60 * 60);
      const worker = shift.assignedWorker;

      if (hoursUntil <= 3 && hoursUntil > -1) {
        const validReasons = Object.keys(COMPANY_CANCEL_REASONS);
        const category = reason?.category;
        if (!category || !validReasons.includes(category)) {
          throw new BadRequestException(
            'Cancelamentos a menos de 3 horas do início exigem um motivo (erro da empresa ou uma das exceções justificadas).',
          );
        }

        if (category === 'ERRO_EMPRESA') {
          const minimumEur = 2 * Number(shift.grossHourlyRate);
          // 2h-minimum owed to the worker (Pay Link when possible) — fire-and-forget
          this.wagePayments.createForCancellationMinimum({
            shiftId:       shift.id,
            employerId:    employer.id,
            workerId:      worker.id,
            amountEur:     minimumEur,
            paymentMethod: shift.paymentMethod ?? 'TRANSFERENCIA',
            shiftTitle:    shift.title,
            shiftDate:     shift.date,
            reason:        category,
            note:          reason?.note,
          }).catch(() => {});

          // Normal €3 platform fee, as for a completed shift (2h informative basis)
          this.payments.recordShiftFeeOnCheckout(
            shift.id, employer.id, worker.id,
            2, Number(shift.grossHourlyRate),
            shift.date, `Cancelamento tardio — ${shift.title}`,
          ).catch(() => {});

          cancellationConsequence =
            `Cancelamento a menos de 3h do início: deves pagar o mínimo de 2 horas (€${minimumEur.toFixed(2)}) ao trabalhador + taxa de 3€.`;
        } else {
          // Justified exemption — ops reviews within 48h; no payment generated now
          this.mail.sendMail({
            to: 'ops@turnos.pt',
            subject: `⚖️ Cancelamento <3h justificado — revisão necessária: ${shift.title}`,
            html: `<p>A empresa <strong>${employer.companyName}</strong> cancelou o turno
                   <strong>${shift.title}</strong> (${shift.date}) a menos de 3h do início.</p>
                   <p>Motivo declarado: <strong>${COMPANY_CANCEL_REASONS[category as keyof typeof COMPANY_CANCEL_REASONS]}</strong></p>
                   ${reason?.note ? `<p>Nota: ${reason.note}</p>` : ''}
                   <p>Trabalhador afetado: ${worker.fullName ?? worker.id}</p>
                   <p>Se a justificação for recusada, gerar o mínimo de 2h (€${(2 * Number(shift.grossHourlyRate)).toFixed(2)}) — shift ${shift.id}.</p>`,
          }).catch(() => {});
          cancellationConsequence = 'Motivo justificado registado — será avaliado pela equipa Turnos em até 48h.';
        }

        employer.lateCancellationCount = (employer.lateCancellationCount ?? 0) + 1;
        await this.employerRepo.save(employer);
      } else if (hoursUntil <= 24 && hoursUntil > -1) {
        // 24h–3h: free of payment but recorded on the reliability metric
        employer.lateCancellationCount = (employer.lateCancellationCount ?? 0) + 1;
        await this.employerRepo.save(employer);
        cancellationConsequence = 'Cancelamento entre 24h e 3h: sem custos, registado na fiabilidade da empresa.';
      }

      // Apology push to the affected worker (all tiers)
      if (worker.expoPushToken) {
        this.notifications.sendDirectPush(
          [worker.expoPushToken],
          'Turno cancelado pela empresa 😔',
          `O turno "${shift.title}" (${shift.date}) foi cancelado. Pedimos desculpa — vais ter prioridade em turnos semelhantes na tua zona.`,
          { type: 'shift_cancelled_by_employer', shiftId: shift.id },
        ).catch(() => {});
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

    return cancellationConsequence ? { ...saved, cancellationConsequence } : saved;
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

  /**
   * Worker cancels a CONFIRMED (FILLED) shift before it starts.
   *
   * Reliability rules:
   *   - >24h before start: free — no consequence.
   *   - ≤24h before start: "cancelamento tardio" strike. Two strikes within
   *     30 days suspend the worker from applying for 7 days.
   * Either way the shift reopens immediately and the matching-worker
   * notification wave fires so the employer can refill the slot.
   */
  async workerCancelAssignment(
    workerUserId: string,
    shiftId: string,
    justification?: { category?: string; note?: string },
  ): Promise<{
    message: string;
    lateStrike: boolean;
  }> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } } });
    if (!worker) throw new UnauthorizedException('Worker not found');

    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'employer.user', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.assignedWorker?.id !== worker.id) throw new UnauthorizedException('Not your shift');
    if (shift.status !== ShiftStatus.FILLED) {
      throw new BadRequestException('Só podes cancelar turnos confirmados que ainda não começaram.');
    }

    const shiftStart = new Date(`${shift.date}T${shift.startTime.slice(0, 5)}:00`);
    const hoursUntil = (shiftStart.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil <= 0) {
      throw new BadRequestException('O turno já começou — cancela junto do empregador.');
    }
    const lateStrike = hoursUntil <= 24;

    if (lateStrike) {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      // Keep only strikes from the last 30 days, then add this one
      const strikes = (worker.lateCancellations ?? [])
        .filter(iso => new Date(iso) > cutoff);
      strikes.push(now.toISOString());
      worker.lateCancellations = strikes;

      if (strikes.length >= 2) {
        worker.suspendedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      await this.workerRepo.save(worker);

      // Justification (doença/lesão/emergência) → ops review; if accepted,
      // the strike is removed manually (48h SLA per policy v1.1)
      const category = justification?.category;
      if (category && Object.keys(WORKER_CANCEL_REASONS).includes(category)) {
        this.mail.sendMail({
          to: 'ops@turnos.pt',
          subject: `⚖️ Justificação de cancelamento tardio — ${worker.fullName ?? worker.id}`,
          html: `<p>O trabalhador <strong>${worker.fullName ?? worker.id}</strong> cancelou o turno
                 <strong>${shift.title}</strong> (${shift.date}) a menos de 24h do início.</p>
                 <p>Motivo: <strong>${WORKER_CANCEL_REASONS[category as keyof typeof WORKER_CANCEL_REASONS]}</strong></p>
                 ${justification?.note ? `<p>Descrição: ${justification.note}</p>` : ''}
                 <p>Se aceite, remover o strike (worker ${worker.id}, registado ${now.toISOString()}).</p>`,
        }).catch(() => {});
      }
    }

    // Reopen the shift
    shift.status = ShiftStatus.OPEN;
    shift.assignedWorker = undefined as any;
    await this.shiftRepo.save(shift);

    const application = await this.applicationRepo.findOne({
      where: { shift: { id: shiftId }, worker: { id: worker.id } },
    });
    if (application) {
      application.status = ApplicationStatus.WITHDRAWN;
      await this.applicationRepo.save(application);
    }

    // Notify employer in real time
    this.gateway.notifyApplicationStatus(shift.employer.user.id, {
      shiftId: shift.id,
      shiftTitle: shift.title,
      applicationId: application?.id ?? '',
      status: 'CANCELLED_BY_WORKER',
    });

    // Immediately re-notify matching workers — refilling the slot fast is the
    // real remedy for the employer.
    this.notifications
      .notifyMatchingWorkers(shift.id, shift.employer.id, shift.skillsRequired ?? [], shift.title)
      .catch(() => {});

    const suspended = worker.suspendedUntil && worker.suspendedUntil > new Date();
    return {
      lateStrike,
      message: lateStrike
        ? suspended
          ? 'Turno cancelado. Por teres 2 cancelamentos tardios em 30 dias, não podes candidatar-te a turnos durante 7 dias.'
          : 'Turno cancelado. Atenção: cancelar a menos de 24h do início afeta a tua fiabilidade na plataforma.'
        : 'Turno cancelado sem penalização. O turno voltou ao estado aberto.',
    };
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

    // Reliability enforcement — permanent block (2 no-shows) or active suspension
    if (worker.isBlocked) {
      throw new BadRequestException(
        'A tua conta foi bloqueada por faltas repetidas a turnos confirmados. Contacta o suporte Turnos.',
      );
    }
    if (worker.suspendedUntil && new Date(worker.suspendedUntil) > new Date()) {
      const until = new Date(worker.suspendedUntil).toLocaleDateString('pt-PT');
      throw new BadRequestException(
        `A tua conta está suspensa até ${until} devido a cancelamentos tardios ou faltas.`,
      );
    }

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

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository, In } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  PAYMENT_METHOD_LABELS, COMPANY_CANCEL_REASONS, WORKER_CANCEL_REASONS,
  MAX_SERIES_DAYS,
} from '@turnos/shared';
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
    /**
     * Extra dates for a multi-day job. Combined with `date`, deduplicated and
     * sorted; more than one resulting date creates a series (see Shift.seriesId).
     */
    dates?: string[];
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

    // Resolve the day set — one date is an ordinary shift, several a series
    const allDates = [...new Set([data.date, ...(data.dates ?? [])].filter(Boolean))].sort();
    if (allDates.length === 0) {
      throw new BadRequestException('Indica pelo menos uma data para o turno.');
    }
    if (allDates.length > MAX_SERIES_DAYS) {
      throw new BadRequestException(
        `Um turno de vários dias pode ter no máximo ${MAX_SERIES_DAYS} dias (limite do contrato MCD).`,
      );
    }

    // Guard: payment method is required — workers must know how they'll be
    // paid (directly by the company) before applying.
    // Cash is deliberately absent — an MCD wage must leave a traceable record.
    const validMethods = Object.keys(PAYMENT_METHOD_LABELS);
    if (!data.paymentMethod || !validMethods.includes(data.paymentMethod)) {
      throw new BadRequestException(
        'Indica como vais pagar ao trabalhador (Turnos Pay Link, transferência bancária ou MB WAY).',
      );
    }

    // Guard: active subscription + concurrent shift limit
    await this.payments.assertCanPostShift(userId);

    const employer = await this.resolveEmployer(userId);
    const { lat, lng, dates: _dates, date: _date, ...rest } = data;

    const isSeries = allDates.length > 1;
    const seriesId = isSeries ? randomUUID() : null;

    // One row per day. Every downstream system (check-in, attendance, MCD day
    // counting, auto-completion) is per-day and needs no changes; the series
    // columns are what let us bill and pay once for the whole job.
    const created = await this.shiftRepo.save(
      allDates.map((day, i) => this.shiftRepo.create({
        ...rest,
        date: day,
        status: ShiftStatus.OPEN,
        employer: { id: employer.id } as any,
        lat,
        lng,
        seriesId,
        seriesDayIndex:  isSeries ? i + 1 : null,
        seriesTotalDays: isSeries ? allDates.length : null,
      })),
    );

    // The first day represents the whole job in feeds and notifications —
    // workers see one card, not N.
    const primary = created[0]!;

    // Fire-and-forget: send push notifications to matching workers
    const skills = data.skillsRequired ?? [];
    this.notifications
      .notifyMatchingWorkers(primary.id, employer.id, skills, primary.title)
      .catch(() => {}); // non-blocking

    // Schedule re-notification job for 5 hours later (once per job, not per day)
    await this.notificationQueue.add(
      're-notify',
      {
        shiftId: primary.id,
        shiftTitle: primary.title,
        requiredSkills: skills,
        employerId: employer.id,
      } satisfies ReNotificationJobData,
      { delay: RE_NOTIFY_DELAY_MS },
    );

    return primary;
  }

  // ── Series helpers ────────────────────────────────────────────────────────

  /** All shifts of a series, ascending by date. Single-day shifts return [shift]. */
  private async seriesShifts(shift: Shift): Promise<Shift[]> {
    if (!shift.seriesId) return [shift];
    return this.shiftRepo.find({
      where: { seriesId: shift.seriesId },
      relations: ['employer', 'assignedWorker'],
      order: { date: 'ASC' },
    });
  }

  /** Attach series dates to a shift payload so clients can render the schedule. */
  private async withSeriesInfo(shift: Shift): Promise<Shift & { seriesDates?: string[] }> {
    if (!shift.seriesId) return shift;
    const rows = await this.shiftRepo.find({
      where: { seriesId: shift.seriesId },
      select: ['date'],
      order: { date: 'ASC' },
    });
    return { ...shift, seriesDates: rows.map(r => r.date) };
  }

  async findByEmployer(userId: string): Promise<Array<Shift & { seriesDates?: string[] }>> {
    const employer = await this.resolveEmployer(userId);
    const rows = await this.shiftRepo.find({
      where: { employer: { id: employer.id } },
      order: { createdAt: 'DESC' },
    });

    // One row per job: a multi-day series shows as a single entry carrying all
    // its dates, matching how it is applied to, billed and paid.
    const bySeries = new Map<string, Shift[]>();
    for (const row of rows) {
      if (!row.seriesId) continue;
      bySeries.set(row.seriesId, [...(bySeries.get(row.seriesId) ?? []), row]);
    }

    const seen = new Set<string>();
    const collapsed: Array<Shift & { seriesDates?: string[] }> = [];
    for (const row of rows) {
      if (!row.seriesId) { collapsed.push(row); continue; }
      if (seen.has(row.seriesId)) continue;
      seen.add(row.seriesId);
      const days = [...(bySeries.get(row.seriesId) ?? [])].sort((a, b) => a.date.localeCompare(b.date));
      // Show the day that is live now (or the first still to run), so the
      // dashboard status reflects where the job actually is.
      const live = days.find(d => d.status !== ShiftStatus.COMPLETED && d.status !== ShiftStatus.CANCELLED) ?? days[0]!;
      collapsed.push({ ...live, seriesDates: days.map(d => d.date) });
    }
    return collapsed;
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

    // Cancelling a multi-day job cancels every day that hasn't run yet;
    // already-worked days keep their status so their wage still settles.
    const cancellable = (await this.seriesShifts(shift)).filter(
      d => d.status !== ShiftStatus.ACTIVE && d.status !== ShiftStatus.COMPLETED,
    );
    for (const day of cancellable) day.status = ShiftStatus.CANCELLED;
    await this.shiftRepo.save(cancellable);
    const saved = cancellable.find(d => d.id === shift.id) ?? shift;

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

    // Move shift to PENDING_ACCEPTANCE — worker must confirm within 2 hours.
    // For a multi-day job every day moves together: the worker is selected for
    // the job, not for one of its days.
    const days = (await this.seriesShifts(shift)).filter(d => d.status === ShiftStatus.OPEN);
    for (const day of days) {
      day.assignedWorker = application.worker;
      day.status = ShiftStatus.PENDING_ACCEPTANCE;
    }
    await this.shiftRepo.save(days);

    // Applications stay PENDING until the worker confirms; mark pre-approved
    await this.applicationRepo
      .createQueryBuilder()
      .update(ShiftApplication)
      .set({ status: ApplicationStatus.APPROVED })
      .where('"shiftId" IN (:...shiftIds) AND "workerId" = :workerId', {
        shiftIds: days.map(d => d.id),
        workerId: application.worker.id,
      })
      .execute();

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

    // Confirming accepts the whole job — every day of the series at once
    const days = (await this.seriesShifts(shift))
      .filter(d => d.status === ShiftStatus.PENDING_ACCEPTANCE && d.assignedWorker?.id === worker.id);
    for (const day of days) day.status = ShiftStatus.FILLED;
    await this.shiftRepo.save(days);

    const dayIds = days.map(d => d.id);

    // Reject the other candidates' pending applications across all days
    await this.applicationRepo
      .createQueryBuilder()
      .update(ShiftApplication)
      .set({ status: ApplicationStatus.REJECTED })
      .where('"shiftId" IN (:...dayIds) AND "workerId" != :workerId AND status = :status', {
        dayIds,
        workerId: worker.id,
        status: ApplicationStatus.PENDING,
      })
      .execute();

    // Notify employer via WebSocket
    this.gateway.notifyShiftFilled(shift.employer.id, { shiftId: shift.id, shiftTitle: shift.title });

    // Compliance — an MCD contract per day, as each day is its own work period
    for (const day of days) {
      this.compliance.onShiftApproved(day, worker, shift.employer).catch(err =>
        console.error('[Compliance] onShiftApproved error:', err),
      );
    }

    return days.find(d => d.id === shiftId) ?? shift;
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

    // Revert every day of the job to OPEN, clear assigned worker
    const days = (await this.seriesShifts(shift))
      .filter(d => d.status === ShiftStatus.PENDING_ACCEPTANCE && d.assignedWorker?.id === worker.id);
    for (const day of days) {
      day.status = ShiftStatus.OPEN;
      day.assignedWorker = undefined as any;
    }
    await this.shiftRepo.save(days);

    // Withdraw this worker's applications so the employer can pick again
    const application = await this.applicationRepo.findOne({
      where: { shift: { id: shiftId }, worker: { id: worker.id } },
    });
    await this.applicationRepo
      .createQueryBuilder()
      .update(ShiftApplication)
      .set({ status: ApplicationStatus.WITHDRAWN })
      .where('"shiftId" IN (:...dayIds) AND "workerId" = :workerId', {
        dayIds: days.map(d => d.id),
        workerId: worker.id,
      })
      .execute();

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
   *
   * Multi-day jobs cancel as a whole — one strike, every remaining day
   * reopened. Once a series has STARTED (first check-in) it can no longer be
   * cancelled here at all: the worker committed to the full schedule, so the
   * only route out is support, who can act with the context. Abandoning it
   * silently falls through to the standard no-show flow.
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

    // A started multi-day job cannot be dropped from the app — see the doc
    // comment above. The check is server-side so hiding the button is not the
    // only thing standing between a worker and a half-abandoned series.
    const seriesDays = await this.seriesShifts(shift);
    const seriesStarted = shift.seriesId != null && seriesDays.some(
      d => d.status === ShiftStatus.ACTIVE || d.status === ShiftStatus.COMPLETED,
    );
    if (seriesStarted) {
      throw new BadRequestException(
        'Este é um trabalho de vários dias que já começou. Ao aceitares, comprometeste-te com todos os dias — contacta o suporte (suporte@turnos.pt) se tiveres um imprevisto.',
      );
    }

    // For a series the notice period runs to the FIRST day — that's the
    // commitment the company is counting on.
    const filledDays = seriesDays.filter(
      d => d.status === ShiftStatus.FILLED && d.assignedWorker?.id === worker.id,
    );
    const firstDay = filledDays[0] ?? shift;
    const shiftStart = new Date(`${firstDay.date}T${firstDay.startTime.slice(0, 5)}:00`);
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

    // Reopen every day of the job — a series is cancelled whole or not at all
    for (const day of filledDays) {
      day.status = ShiftStatus.OPEN;
      day.assignedWorker = undefined as any;
    }
    await this.shiftRepo.save(filledDays);

    const application = await this.applicationRepo.findOne({
      where: { shift: { id: shiftId }, worker: { id: worker.id } },
    });
    await this.applicationRepo
      .createQueryBuilder()
      .update(ShiftApplication)
      .set({ status: ApplicationStatus.WITHDRAWN })
      .where('"shiftId" IN (:...dayIds) AND "workerId" = :workerId', {
        dayIds: filledDays.map(d => d.id),
        workerId: worker.id,
      })
      .execute();

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

    const rows = await query.getMany();

    // Collapse each series to a single card — the worker applies to the whole
    // job, so one row per day would be N duplicate listings. The earliest
    // still-open day represents the series and carries all its dates.
    const bySeries = new Map<string, Shift[]>();
    for (const row of rows) {
      if (!row.seriesId) continue;
      bySeries.set(row.seriesId, [...(bySeries.get(row.seriesId) ?? []), row]);
    }

    const seen = new Set<string>();
    const collapsed: Array<Shift & { seriesDates?: string[] }> = [];
    for (const row of rows) {
      if (!row.seriesId) { collapsed.push(row); continue; }
      if (seen.has(row.seriesId)) continue;
      seen.add(row.seriesId);
      // Keep the surrounding distance ordering, but let the first day speak
      const days = [...(bySeries.get(row.seriesId) ?? [])].sort((a, b) => a.date.localeCompare(b.date));
      collapsed.push({ ...days[0]!, seriesDates: days.map(d => d.date) });
    }
    return collapsed;
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

    // Multi-day: applying commits the worker to EVERY day of the series.
    // Compliance is checked per day and any hard block rejects the whole
    // application — a worker must never end up holding a partial series.
    const days = (await this.seriesShifts(shift)).filter(d => d.status === ShiftStatus.OPEN);
    const warnings: string[] = [];
    for (const day of days) {
      // days.length is passed so the MCD 70-day cap is measured against the
      // whole series, not one day at a time.
      const { warning: dayWarning } = await this.compliance.checkApplicationEligibility(
        worker, day, days.length,
      );
      if (dayWarning) warnings.push(dayWarning);
    }
    const warning = warnings[0];

    const saved = (await this.applicationRepo.save(
      days.map(day => this.applicationRepo.create({
        shift:     { id: day.id } as any,
        worker:    { id: worker.id } as any,
        status:    ApplicationStatus.PENDING,
        coverNote: coverNote?.slice(0, 200),  // Enforce 200-char limit server-side
      })),
    ))[0]!;

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
    const apps = await this.applicationRepo.find({
      where: { worker: { id: worker.id } },
      relations: ['shift', 'shift.employer'],
      order: { appliedAt: 'DESC' },
    });

    // Collapse a series into one entry — the worker applied to one job, and
    // "Os Meus Turnos" must not show the same job N times. The soonest day
    // that hasn't finished represents it, so the card tracks the live day.
    const bySeries = new Map<string, ShiftApplication[]>();
    const singles: ShiftApplication[] = [];
    for (const app of apps) {
      const seriesId = app.shift?.seriesId;
      if (!seriesId) { singles.push(app); continue; }
      bySeries.set(seriesId, [...(bySeries.get(seriesId) ?? []), app]);
    }

    const collapsed: ShiftApplication[] = [];
    for (const group of bySeries.values()) {
      const days = [...group].sort((a, b) => a.shift.date.localeCompare(b.shift.date));
      const live = days.find(d => d.shift.status !== ShiftStatus.COMPLETED) ?? days[days.length - 1]!;
      // Has any day been worked yet? Once so, the commitment is locked — the
      // app hides the cancel action and workerCancelAssignment refuses it.
      const seriesStarted = days.some(
        d => d.shift.status === ShiftStatus.ACTIVE || d.shift.status === ShiftStatus.COMPLETED,
      );
      collapsed.push({
        ...live,
        shift: {
          ...live.shift,
          seriesDates: days.map(d => d.shift.date),
          seriesStarted,
        },
      } as ShiftApplication);
    }

    return [...singles, ...collapsed].sort(
      (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
    );
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
    availableNow?: boolean;
    minRating?: number;
  }) {
    const qb = this.workerRepo
      .createQueryBuilder('w')
      .where('w.status = :status', { status: 'ACTIVE' })
      .andWhere('w."profileQualityScore" >= 80')
      .select([
        'w.id', 'w.fullName', 'w.photoUrl', 'w.bio',
        'w.cvUrl', 'w.cvFileName',
        'w.skills', 'w.languages', 'w.availableDays',
        'w.isAvailableForWork', 'w.experiences',
        'w.avgRating', 'w.totalRatings', 'w.noShowCount',
        'w.badges', 'w.profileQualityScore',
      ]);

    // Master availability switch — the worker says they're open to work at all
    if (filters.availableNow) {
      qb.andWhere('w."isAvailableForWork" = true');
    }

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

  async findById(id: string): Promise<Shift & { seriesDates?: string[] }> {
    const shift = await this.shiftRepo.findOne({
      where: { id },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return this.withSeriesInfo(shift);
  }
}

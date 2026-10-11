import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository, In, IsNull } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  PAYMENT_METHOD_LABELS, COMPANY_CANCEL_REASONS, WORKER_CANCEL_REASONS,
  MAX_SERIES_DAYS, MIN_WORKER_AGE, ageOn, PROFILE_MIN_SCORE_TO_APPLY,
  OFFER_ACCEPTANCE_HOURS, paymentMethodLabel,
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
import { opsRef, eur, lisbonStamp, ptDate, deadlineIn, joinParts } from '../mail/ops-email';
import { t, tNumericDate } from '../i18n/request-language';
import { restrictionNotice, statementToHtml } from '../users/restriction-notice';
import { lisbonDate, lisbonDateTime } from '../common/lisbon-time';
import { notificationPrefsOf } from '../users/notification-prefs';
import { releasePendingOffer, ACCEPTANCE_WINDOW_MS } from './offer-release';
import { closeApplications } from './application-closing';

// 5 hours in milliseconds — delay before re-notification job fires
const RE_NOTIFY_DELAY_MS = 5 * 60 * 60 * 1000;

// ── Public shape ─────────────────────────────────────────────────────────────
// `GET /shifts/search` and `GET /shifts/:id` are public by design — workers
// browse before signing in (Stint 2). Both used to return the whole `employer`
// relation, which meant an unauthenticated request exposed every company's
// stripeCustomerId, stripeSubscriptionId, subscriptionStatus, accountantEmail,
// nipc, nif and lateCancellationCount. `findById` also returned the full
// `assignedWorker`, so a FILLED shift's id was enough to read that worker's
// NIF and IBAN.
//
// The fields below are mapped ONE BY ONE on purpose. A `select([...])` would
// have worked today and silently re-widened the moment someone added a column
// to Employer; an explicit mapping cannot.

/** Everything a worker is allowed to know about the company running a shift. */
export interface PublicEmployer {
  id: string;
  companyName: string;
  sector: string | null;
  /** For the company avatar on shift cards — mobile work, not wired yet. */
  logoUrl: string | null;
}

export type PublicShift = Omit<Shift, 'employer' | 'assignedWorker' | 'applications'> & {
  employer: PublicEmployer | null;
  seriesDates?: string[];
};

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

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

  /**
   * Ops alert: a company cancelled a confirmed shift <3h before start with a
   * reason that, if accepted, waives the worker's 2-hour minimum.
   */
  private async alertCompanyLateCancel(
    shift: Shift,
    employer: Employer,
    workerId: string,
    category: string,
    note: string | undefined,
    hoursUntil: number,
  ): Promise<void> {
    const [company, worker] = await Promise.all([
      this.employerRepo.findOne({ where: { id: employer.id }, relations: ['user'] }),
      this.workerRepo.findOne({ where: { id: workerId }, relations: ['user'] }),
    ]);
    const minimum = eur(2 * Number(shift.grossHourlyRate));
    await this.mail.sendOpsAlert({
      ref: opsRef('CAN', shift.id),
      kind: 'Cancelamento <3 h justificado',
      subjectParts: [employer.companyName, shift.title],
      summary: `${employer.companyName} cancelou "${shift.title}" a ${Math.max(0, hoursUntil).toFixed(1)} h do início e pede isenção do mínimo de 2 h (${minimum}).`,
      facts: [
        ['Empresa', joinParts(employer.companyName, `NIPC ${employer.nipc}`)],
        ['Email da empresa', company?.user?.email],
        ['Cancelamentos tardios da empresa', String(employer.lateCancellationCount ?? 0)],
        ['Trabalhador afetado', worker?.fullName],
        ['Contacto do trabalhador', joinParts(worker?.user?.phone, worker?.user?.email)],
        ['Turno', joinParts(shift.title, ptDate(shift.date), `${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}`)],
        ['Valor/hora', eur(shift.grossHourlyRate)],
        ['Método de pagamento', shift.paymentMethod ? paymentMethodLabel(shift.paymentMethod) : null],
        ['Motivo declarado', COMPANY_CANCEL_REASONS[category as keyof typeof COMPANY_CANCEL_REASONS]],
        ['Nota da empresa', note],
        ['Cancelado em', lisbonStamp(new Date())],
      ],
      steps: [
        'Pedir à empresa prova do motivo, se necessário.',
        'Decidir se a justificação é aceite.',
        `Se for recusada: gerar o mínimo de 2 h (${minimum}) a pagar ao trabalhador (shift ${shift.id}).`,
        'Informar a empresa e o trabalhador da decisão, citando a referência.',
      ],
      deadline: deadlineIn(48),
      contacts: [
        { label: 'Escrever à empresa', email: company?.user?.email },
        { label: 'Escrever ao trabalhador', email: worker?.user?.email },
      ],
    });
  }

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
    hasDressCode?: boolean;
    dressCode?: string | null;
  }): Promise<Shift> {
    // Guard: minimum 2-hour shift duration
    const [sh, sm] = data.startTime.split(':').map(Number);
    const [eh, em] = data.endTime.split(':').map(Number);
    let shiftMins = ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0));
    if (shiftMins < 0) shiftMins += 24 * 60; // overnight shift
    if (shiftMins < 120) {
      throw new BadRequestException(t('api.shifts.minDuration'));
    }

    // Resolve the day set — one date is an ordinary shift, several a series
    const allDates = [...new Set([data.date, ...(data.dates ?? [])].filter(Boolean))].sort();
    if (allDates.length === 0) {
      throw new BadRequestException(t('api.shifts.noDates'));
    }
    if (allDates.length > MAX_SERIES_DAYS) {
      throw new BadRequestException(
        t('api.shifts.maxSeriesDays', { max: MAX_SERIES_DAYS }),
      );
    }

    // Guard: payment method is required — workers must know how they'll be
    // paid (directly by the company) before applying.
    // Cash is deliberately absent — an MCD wage must leave a traceable record.
    const validMethods = Object.keys(PAYMENT_METHOD_LABELS);
    if (!data.paymentMethod || !validMethods.includes(data.paymentMethod)) {
      throw new BadRequestException(
        t('api.shifts.paymentMethodRequired'),
      );
    }

    // Guard: a dress code that is switched on must actually say something —
    // "there is a dress code, figure it out" is worse than no dress code, and
    // it is what the company would later cancel the shift over.
    const dressCode = (data.dressCode ?? '').trim().slice(0, 300);
    const hasDressCode = data.hasDressCode === true && dressCode.length > 0;
    if (data.hasDressCode === true && dressCode.length === 0) {
      throw new BadRequestException(t('api.shifts.dressCodeRequired'));
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
        // Normalised above — a toggle switched back off must not leave stale
        // instructions on the card.
        hasDressCode,
        dressCode: hasDressCode ? dressCode : null,
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
      // Archived = expired shifts the company removed from its dashboard
      where: { employer: { id: employer.id }, archivedAt: IsNull() },
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
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if (![ShiftStatus.DRAFT, ShiftStatus.OPEN].includes(shift.status)) {
      throw new BadRequestException('Only DRAFT or OPEN shifts can be edited');
    }
    const { lat, lng, ...rest } = data;
    Object.assign(shift, rest);
    // Same normalisation as create() — switching the toggle off has to clear
    // the text, or the shift card keeps showing a code nobody is held to.
    if (rest.hasDressCode !== undefined || rest.dressCode !== undefined) {
      const code = (shift.dressCode ?? '').trim().slice(0, 300);
      shift.hasDressCode = shift.hasDressCode === true && code.length > 0;
      shift.dressCode = shift.hasDressCode ? code : null;
    }
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
  ) {
    const employer = await this.resolveEmployer(userId);
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if ([ShiftStatus.ACTIVE, ShiftStatus.COMPLETED].includes(shift.status)) {
      throw new BadRequestException('Cannot cancel an active or completed shift');
    }

    // ── Company cancellation policy v1.1 (FILLED shifts only) ────────────────
    //   >24h: free · 24h–3h: free but reliability metric · <3h: reason required —
    //   ERRO_EMPRESA → 2h-minimum Pay Link + €3 fee; justified → ops review.
    let cancellationConsequence: string | undefined;
    if (shift.status === ShiftStatus.FILLED && shift.assignedWorker) {
      const shiftStart = lisbonDateTime(shift.date, shift.startTime);
      const hoursUntil = (shiftStart.getTime() - Date.now()) / (1000 * 60 * 60);
      const worker = shift.assignedWorker;

      if (hoursUntil <= 3 && hoursUntil > -1) {
        const validReasons = Object.keys(COMPANY_CANCEL_REASONS);
        const category = reason?.category;
        if (!category || !validReasons.includes(category)) {
          throw new BadRequestException(
            t('api.shifts.cancelReasonRequired'),
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
            t('api.shifts.cancelConsequence', { amount: minimumEur.toFixed(2) });
        } else {
          // Justified exemption — ops reviews within 48h; no payment generated now
          void this.alertCompanyLateCancel(shift, employer, worker.id, category, reason?.note, hoursUntil);
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
      this.notifications.notifyWorker(worker, {
        key: 'shiftCancelled',
        params: { shift: shift.title || shift.subcategory, date: shift.date.split('-').reverse().join('/') },
      }, { type: 'shift_cancelled_by_employer', shiftId: shift.id }).catch(() => {});
    }

    // An offer still waiting for an answer: the selected worker is told the
    // job no longer exists, so they don't accept something that is gone.
    if (shift.status === ShiftStatus.PENDING_ACCEPTANCE) {
      this.notifications.notifyWorker(shift.assignedWorker,
        { key: 'offerCancelled', params: { shift: shift.title || shift.subcategory } },
        { type: 'shift_cancelled_by_employer', shiftId: shift.id }).catch(() => {});
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
    // Applicants and the confirmed worker see "Cancelado", not a stale "Pendente"
    await closeApplications(this.applicationRepo, cancellable.map(d => d.id), ApplicationStatus.CANCELLED);
    const saved = cancellable.find(d => d.id === shift.id) ?? shift;

    // Notify all applicants that the shift was cancelled
    const workerIds = applications.map(a => a.worker?.id).filter((id): id is string => !!id);
    if (workerIds.length > 0) {
      this.gateway.notifyShiftCancelled(workerIds, {
        shiftId: saved.id,
        shiftTitle: saved.title,
      });
    }

    const view = { ...saved, assignedWorker: this.toApplicantWorker(saved.assignedWorker) };
    return cancellationConsequence ? { ...view, cancellationConsequence } : view;
  }

  async getApplications(userId: string, shiftId: string) {
    const employer = await this.resolveEmployer(userId);
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId }, relations: ['employer'] });
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    const applications = await this.applicationRepo.find({
      where: { shift: { id: shiftId } },
      relations: ['worker'],
      order: { appliedAt: 'DESC' },
    });
    // Opening the applicants list is seeing them — clears the "new" state for
    // the whole job (every day of a series carries its own application rows).
    const days = await this.seriesShifts(shift);
    await this.markSeen(days.map(d => d.id));
    return applications.map(app => ({ ...app, worker: this.toApplicantWorker(app.worker) }));
  }

  /**
   * Candidates page: every job still open to applications that has someone
   * waiting for an answer, with those applicants.
   *
   * A series is one job — its applications exist once per day, so only the
   * rows on the job's first open day are returned (the same day the dashboard
   * shows for the series, and the day approve expects). Jobs whose date has
   * passed are left out: they are in "Expired" on the shifts page.
   */
  async getCandidates(userId: string) {
    const employer = await this.resolveEmployer(userId);
    const apps = await this.pendingApplications(employer.id);

    const firstDay = new Map<string, string>();   // job key → earliest open date
    for (const a of apps) {
      const key = a.shift.seriesId ?? a.shift.id;
      const d = firstDay.get(key);
      if (!d || a.shift.date < d) firstDay.set(key, a.shift.date);
    }

    const jobs = new Map<string, { shift: Shift; applications: ShiftApplication[] }>();
    for (const a of apps) {
      const key = a.shift.seriesId ?? a.shift.id;
      if (a.shift.date !== firstDay.get(key)) continue;
      const job = jobs.get(key) ?? { shift: a.shift, applications: [] };
      job.applications.push(a);
      jobs.set(key, job);
    }

    const result = [];
    for (const { shift, applications } of jobs.values()) {
      const { applications: _apps, ...plain } = await this.withSeriesInfo(shift);
      result.push({
        shift: plain,
        applications: applications
          .sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime())
          .map(a => ({
            id:         a.id,
            status:     a.status,
            coverNote:  a.coverNote ?? null,
            appliedAt:  a.appliedAt,
            isNew:      !a.employerSeenAt,
            worker:     this.toApplicantWorker(a.worker),
          })),
      });
    }
    // Soonest job first — that is the one whose answer is most urgent.
    return result.sort((a, b) =>
      `${a.shift.date}${a.shift.startTime}`.localeCompare(`${b.shift.date}${b.shift.startTime}`));
  }

  /** Sidebar badge: candidates waiting for an answer, and how many are unseen. One per worker per job. */
  async getCandidateCounts(userId: string): Promise<{ pending: number; unseen: number }> {
    const employer = await this.resolveEmployer(userId);
    const apps = await this.pendingApplications(employer.id);
    const pending = new Set<string>();
    const unseen = new Set<string>();
    for (const a of apps) {
      const key = `${a.shift.seriesId ?? a.shift.id}:${a.worker.id}`;
      pending.add(key);
      if (!a.employerSeenAt) unseen.add(key);
    }
    return { pending: pending.size, unseen: unseen.size };
  }

  /** The Candidates page marks what it has shown as seen (it keeps showing "new" until reopened). */
  async markCandidatesSeen(userId: string): Promise<{ ok: true }> {
    const employer = await this.resolveEmployer(userId);
    const apps = await this.pendingApplications(employer.id);
    await this.markSeen([...new Set(apps.map(a => a.shift.id))]);
    return { ok: true };
  }

  private pendingApplications(employerId: string): Promise<ShiftApplication[]> {
    return this.applicationRepo.createQueryBuilder('a')
      .innerJoinAndSelect('a.shift', 's')
      .innerJoinAndSelect('a.worker', 'w')
      .where('s."employerId" = :employerId', { employerId })
      .andWhere('a.status = :pending', { pending: ApplicationStatus.PENDING })
      .andWhere('s.status = :open', { open: ShiftStatus.OPEN })
      .andWhere('s.date >= :today', { today: lisbonDate() })
      .getMany();
  }

  private async markSeen(shiftIds: string[]): Promise<void> {
    if (shiftIds.length === 0) return;
    await this.applicationRepo.createQueryBuilder()
      .update(ShiftApplication)
      .set({ employerSeenAt: () => 'NOW()' })
      .where('"shiftId" IN (:...shiftIds)', { shiftIds })
      .andWhere('"employerSeenAt" IS NULL')
      .execute();
  }

  /**
   * One email when a job gets its first candidate — the company is often not
   * on the dashboard, where the badge and toast would tell it. Later
   * candidates do not email (the Track 5 "waiting more than 6h" reminder is the
   * follow-up). First name, rating and shift count only: no contact details.
   */
  private async emailFirstCandidate(shift: Shift, worker: Worker): Promise<void> {
    const employer = await this.employerRepo.findOne({ where: { id: shift.employer.id }, relations: ['user'] });
    const to = employer?.user?.email;
    if (!to || !notificationPrefsOf(employer).newCandidates) return;

    const webUrl = process.env.WEB_ADMIN_URL ?? 'http://localhost:3000';
    const link = `${webUrl}/dashboard/candidates`;
    const firstName = (worker.fullName ?? '').trim().split(/\s+/)[0] || '—';
    const rating = Number(worker.avgRating ?? 0) > 0 ? `★ ${Number(worker.avgRating).toFixed(1)}` : '';
    const done = worker.completedShifts ?? 0;
    const role = shift.title || shift.subcategory;
    const [y, m, d] = shift.date.split('-');
    const date = `${d}/${m}/${y}`;
    const time = shift.startTime.slice(0, 5);
    const button = (label: string) =>
      `<p><a href="${link}" style="display:inline-block;background:#6a79ff;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:bold;">${label}</a></p>`;

    await this.mail.sendBilingual(to, {
      pt: {
        subject: `Primeiro candidato: ${role}`,
        html: `<p>O seu turno <strong>${role}</strong> (${date}, ${time}) tem o primeiro candidato:</p>
          <p><strong>${firstName}</strong> ${rating} · ${done} turno(s) concluído(s)</p>
          ${button('Ver candidatos')}
          <p style="color:#6b7280;font-size:13px">Só enviamos este email para o primeiro candidato de cada turno. Pode desligá-lo em Definições → Notificações.</p>`,
      },
      en: {
        subject: `First candidate: ${role}`,
        html: `<p>Your shift <strong>${role}</strong> (${date}, ${time}) has its first candidate:</p>
          <p><strong>${firstName}</strong> ${rating} · ${done} completed shift(s)</p>
          ${button('See candidates')}
          <p style="color:#6b7280;font-size:13px">We only send this for the first candidate of each shift. You can turn it off in Settings → Notifications.</p>`,
      },
    });
  }

  /**
   * What a company may see about someone who applied to its shift — the same
   * fields as worker search, field by field. Returning the entity instead sent
   * NIF, IBAN (ignoring the worker's sharing consent), Stripe account id, date
   * of birth, declared income and the reliability internals to every company
   * a worker applied to. The IBAN reaches a company only through
   * WagePaymentsService.getEmployerPending, and only with recorded consent.
   */
  private toApplicantWorker(worker: Worker | null | undefined) {
    if (!worker) return null;
    return {
      id:                  worker.id,
      fullName:            worker.fullName ?? null,
      photoUrl:            worker.photoUrl ?? null,
      bio:                 worker.bio ?? null,
      cvUrl:               worker.cvUrl ?? null,
      cvFileName:          worker.cvFileName ?? null,
      skills:              worker.skills ?? null,
      languages:           worker.languages ?? null,
      isAvailableForWork:  worker.isAvailableForWork,
      availableDays:       worker.availableDays ?? null,
      experiences:         worker.experiences ?? null,
      status:              worker.status,
      profileQualityScore: worker.profileQualityScore,
      avgRating:           worker.avgRating,
      totalRatings:        worker.totalRatings,
      noShowCount:         worker.noShowCount,
      completedShifts:     worker.completedShifts ?? 0,
      badges:              worker.badges ?? [],
    };
  }

  /** The shift as returned to its company — the assigned worker trimmed to what a company may see. */
  private async employerShiftView(shiftId: string) {
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
    return { ...shift, assignedWorker: this.toApplicantWorker(shift.assignedWorker) };
  }

  async approveApplication(userId: string, shiftId: string, applicationId: string) {
    const employer = await this.resolveEmployer(userId);
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId }, relations: ['employer'] });
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
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
    const offeredAt = new Date();
    for (const day of days) {
      day.assignedWorker = application.worker;
      day.status = ShiftStatus.PENDING_ACCEPTANCE;
      day.offeredAt = offeredAt;
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
    this.notifications.notifyWorker(application.worker,
      { key: 'preSelected', params: { shift: shift.title || shift.subcategory, hours: OFFER_ACCEPTANCE_HOURS } },
      { type: 'pre_selected', shiftId: shift.id }).catch(() => {});

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
      { shiftId: shift.id, applicationId: application.id, workerId: application.worker.id },
      { delay: ACCEPTANCE_WINDOW_MS },
    );

    return this.employerShiftView(shiftId);
  }

  /**
   * The company takes back an offer the worker has not answered yet
   * ("Retirar oferta"). The job goes back to OPEN — candidates who applied are
   * candidates again — and the worker is told. Before 2026-10-11 a shift in
   * PENDING_ACCEPTANCE had no action at all on the dashboard.
   */
  async withdrawOffer(userId: string, shiftId: string) {
    const employer = await this.resolveEmployer(userId);
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId }, relations: ['employer'] });
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if (shift.status !== ShiftStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException(t('api.shifts.noPendingOffer'));
    }

    const released = await releasePendingOffer(
      { shiftRepo: this.shiftRepo, applicationRepo: this.applicationRepo }, shiftId,
    );
    this.notifications.notifyWorker(released?.worker,
      { key: 'offerWithdrawn', params: { shift: shift.title || shift.subcategory } },
      { type: 'offer_withdrawn', shiftId: shift.id }).catch(() => {});
    return this.employerShiftView(shiftId);
  }

  // ── Worker confirms or declines pre-selection ─────────────────────────────

  async workerConfirmShift(workerUserId: string, shiftId: string): Promise<Shift> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } } });
    if (!worker) throw new UnauthorizedException('Worker not found');

    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'employer.user', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
    if (shift.assignedWorker?.id !== worker.id) throw new UnauthorizedException('Not your shift');
    if (shift.status !== ShiftStatus.PENDING_ACCEPTANCE) throw new BadRequestException('Shift is not awaiting your confirmation');
    // A direct invite skips apply(), so this is the first age check it meets
    this.assertWorkerIsAdult(worker, shift.date, 'worker');

    // Confirming accepts the whole job — every day of the series at once
    const days = (await this.seriesShifts(shift))
      .filter(d => d.status === ShiftStatus.PENDING_ACCEPTANCE && d.assignedWorker?.id === worker.id);
    // Rest period again at acceptance: the offer may be hours old, and the
    // worker may have taken another shift since they applied.
    for (const day of days) await this.compliance.assertRestPeriod(worker, day);
    for (const day of days) { day.status = ShiftStatus.FILLED; day.offeredAt = null; }
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
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
    if (shift.assignedWorker?.id !== worker.id) throw new UnauthorizedException('Not your shift');
    if (shift.status !== ShiftStatus.PENDING_ACCEPTANCE) throw new BadRequestException('Shift is not awaiting your confirmation');

    // Revert every day of the job to OPEN, clear assigned worker
    const days = (await this.seriesShifts(shift))
      .filter(d => d.status === ShiftStatus.PENDING_ACCEPTANCE && d.assignedWorker?.id === worker.id);
    for (const day of days) {
      day.status = ShiftStatus.OPEN;
      day.assignedWorker = undefined as any;
      day.offeredAt = null;
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

    return { message: t('api.shifts.declined') };
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
    // `user` for the email address a suspension notice goes to
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } }, relations: ['user'] });
    if (!worker) throw new UnauthorizedException('Worker not found');

    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'employer.user', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
    if (shift.assignedWorker?.id !== worker.id) throw new UnauthorizedException('Not your shift');
    if (shift.status !== ShiftStatus.FILLED) {
      throw new BadRequestException(t('api.shifts.cancelOnlyConfirmed'));
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
        t('api.shifts.seriesStarted'),
      );
    }

    // For a series the notice period runs to the FIRST day — that's the
    // commitment the company is counting on.
    const filledDays = seriesDays.filter(
      d => d.status === ShiftStatus.FILLED && d.assignedWorker?.id === worker.id,
    );
    const firstDay = filledDays[0] ?? shift;
    const shiftStart = lisbonDateTime(firstDay.date, firstDay.startTime);
    const hoursUntil = (shiftStart.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil <= 0) {
      throw new BadRequestException(t('api.shifts.alreadyStarted'));
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

      let notice: ReturnType<typeof restrictionNotice> | null = null;
      if (strikes.length >= 2) {
        worker.suspendedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        notice = restrictionNotice('LATE_CANCEL_SUSPENSION', {
          shiftTitle:      shift.title,
          shiftDate:       firstDay.date,
          companyName:     shift.employer?.companyName,
          until:           worker.suspendedUntil,
          lateCancelDates: strikes,
        }, worker.preferredLanguage);
        worker.restrictionReason = notice.statement;
        worker.restrictedAt      = now;
      }
      await this.workerRepo.save(worker);
      if (notice) this.sendRestrictionNotice(worker, notice);

      // Justification (doença/lesão/emergência) → ops review; if accepted,
      // the strike is removed manually (48h SLA per policy v1.1)
      const category = justification?.category;
      if (category && Object.keys(WORKER_CANCEL_REASONS).includes(category)) {
        void this.mail.sendOpsAlert({
          ref: opsRef('JUS', firstDay.id),
          kind: 'Justificação de cancelamento',
          subjectParts: [worker.fullName, shift.employer?.companyName],
          summary: `${worker.fullName ?? 'Um trabalhador'} cancelou a menos de 24 h e justificou: ${WORKER_CANCEL_REASONS[category as keyof typeof WORKER_CANCEL_REASONS]}.`,
          facts: [
            ['Trabalhador', worker.fullName],
            ['Contacto do trabalhador', joinParts(worker.user?.phone, worker.user?.email)],
            ['Empresa', shift.employer?.companyName],
            ['Email da empresa', shift.employer?.user?.email],
            ['Turno', joinParts(shift.title, ptDate(firstDay.date), `${firstDay.startTime.slice(0, 5)}–${firstDay.endTime.slice(0, 5)}`)],
            ['Dias do trabalho', filledDays.length > 1 ? `${filledDays.length} dias` : null],
            ['Cancelado em', lisbonStamp(now)],
            ['Horas antes do início', `${hoursUntil.toFixed(1)} h`],
            ['Motivo', WORKER_CANCEL_REASONS[category as keyof typeof WORKER_CANCEL_REASONS]],
            ['Descrição do trabalhador', justification?.note],
            ['Cancelamentos tardios em 30 dias', `${strikes.length}${notice ? ' — conta suspensa 7 dias' : ''}`],
          ],
          steps: [
            'Pedir ao trabalhador um comprovativo, se fizer sentido (atestado, documento) — é opcional.',
            'Decidir se a justificação é aceite.',
            `Se for aceite: retirar o cancelamento tardio do registo (worker ${worker.id}, registo ${now.toISOString()})${notice ? ' e levantar a suspensão de 7 dias' : ''}.`,
            'Responder ao trabalhador com a decisão, citando a referência.',
          ],
          deadline: deadlineIn(48, now),
          contacts: [
            { label: 'Escrever ao trabalhador', email: worker.user?.email },
            { label: 'Escrever à empresa', email: shift.employer?.user?.email },
          ],
          sensitive: 'Pode conter dados de saúde. Apagar este email, e qualquer comprovativo recebido, 6 meses após a decisão (Política de Privacidade, secção 8).',
        });
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
          ? t('api.shifts.cancelledSuspended')
          : t('api.shifts.cancelledLate')
        : t('api.shifts.cancelledFree'),
    };
  }

  // ── Worker actions ────────────────────────────────────────────────────────

  async search(filters: {
    lat?: number;
    lng?: number;
    radiusMeters?: number;
    category?: string;
  }): Promise<PublicShift[]> {
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
    return collapsed.map(shift => this.toPublicShift(shift));
  }

  async apply(userId: string, shiftId: string, coverNote?: string): Promise<ShiftApplication & { warning?: string }> {
    // Resolve the Worker entity from the JWT userId
    const worker = await this.resolveWorker(userId);

    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer'],
    });
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
    if (shift.status !== ShiftStatus.OPEN) throw new BadRequestException(t('api.shifts.notOpen'));

    // Reliability enforcement — permanent block (2 no-shows) or active suspension
    if (worker.isBlocked) {
      throw new BadRequestException(
        t('api.shifts.accountBlocked'),
      );
    }
    if (worker.suspendedUntil && new Date(worker.suspendedUntil) > new Date()) {
      throw new BadRequestException(
        t('api.shifts.accountSuspended', { date: tNumericDate(worker.suspendedUntil) }),
      );
    }

    this.assertWorkerIsAdult(worker, shift.date, 'worker');

    // Profile gate — worker must have 80%+ profile to apply
    if (worker.profileQualityScore < PROFILE_MIN_SCORE_TO_APPLY) {
      throw new BadRequestException(
        t('api.shifts.profileIncomplete', { score: worker.profileQualityScore }),
      );
    }

    const existing = await this.applicationRepo.findOne({
      where: { shift: { id: shiftId }, worker: { id: worker.id } },
    });
    if (existing) throw new BadRequestException(t('api.shifts.alreadyApplied'));

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

    // Counted before saving: any earlier row (even withdrawn) means the
    // first-candidate email already went out for this job.
    const isFirstCandidate = (await this.applicationRepo.count({
      where: { shift: { id: In(days.map(d => d.id)) } },
    })) === 0;

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

    if (isFirstCandidate) {
      this.emailFirstCandidate(shift, worker).catch((err: Error) =>
        this.logger.warn(`[Candidates] First-candidate email failed for shift ${shift.id}: ${err.message}`));
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

  /**
   * Tells the worker why they were restricted: push always, email when they
   * gave one. Fire-and-forget — the restriction is already saved, and the
   * statement stays readable in the app even if both deliveries fail.
   */
  private sendRestrictionNotice(worker: Worker, notice: ReturnType<typeof restrictionNotice>): void {
    // Already written in the worker's language by restrictionNotice()
    this.notifications.notifyWorker(worker, { title: notice.pushTitle, body: notice.pushBody }, { type: 'account_restricted' }).catch(() => {});
    const email = worker.user?.email;
    if (email) {
      this.mail.sendMail({ to: email, subject: notice.emailSubject, html: statementToHtml(notice.statement) })
        .catch(() => {});
    }
  }

  /**
   * Turnos is 18+ (privacy policy §11, terms). Measured on the shift date, so
   * someone turning 18 next month can sign up now but not work until then.
   * `audience` picks the wording: the worker is told to add their date of
   * birth; a company inviting them is told the worker isn't eligible yet.
   */
  private assertWorkerIsAdult(worker: Worker, shiftDate: string, audience: 'worker' | 'employer'): void {
    if (!worker.dateOfBirth) {
      throw new BadRequestException(
        t(audience === 'worker' ? 'api.shifts.birthDateRequired' : 'api.shifts.workerBirthDateMissing'),
      );
    }
    if (ageOn(worker.dateOfBirth, shiftDate) < MIN_WORKER_AGE) {
      throw new BadRequestException(
        t(audience === 'worker' ? 'api.shifts.underAge' : 'api.shifts.workerUnderAge', { age: MIN_WORKER_AGE }),
      );
    }
  }

  // ── Employer directly invites a worker ────────────────────────────────────

  async inviteWorker(employerUserId: string, shiftId: string, workerId: string) {
    const employer = await this.resolveEmployer(employerUserId);
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if (shift.status !== ShiftStatus.OPEN) {
      throw new BadRequestException('Can only invite a worker to an OPEN shift');
    }

    const worker = await this.workerRepo.findOne({
      where: { id: workerId },
      relations: ['user'],
    });
    if (!worker) throw new NotFoundException('Worker not found');
    this.assertWorkerIsAdult(worker, shift.date, 'employer');
    // A direct invite skips apply(), so it gets the rest-period check here
    await this.compliance.assertRestPeriod(worker, shift, 'employer');

    // Create or reuse an application for this worker on this shift
    let application = await this.applicationRepo.findOne({
      where: { shift: { id: shiftId }, worker: { id: workerId } },
    });

    if (!application) {
      application = this.applicationRepo.create({
        shift: { id: shiftId } as any,
        worker: { id: workerId } as any,
        status: ApplicationStatus.APPROVED,
        invited: true,
      });
    } else {
      application.status = ApplicationStatus.APPROVED;
    }
    await this.applicationRepo.save(application);

    // Move shift to PENDING_ACCEPTANCE
    shift.assignedWorker = worker;
    shift.status = ShiftStatus.PENDING_ACCEPTANCE;
    shift.offeredAt = new Date();
    await this.shiftRepo.save(shift);

    // Push notification to worker
    this.notifications.notifyWorker(worker, {
      key: 'invited',
      params: { company: employer.companyName ?? '—', shift: shift.title || shift.subcategory, hours: OFFER_ACCEPTANCE_HOURS },
    }, { type: 'pre_selected', shiftId: shift.id }).catch(() => {});

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
      { shiftId: shift.id, applicationId: application.id, workerId: worker.id },
      { delay: ACCEPTANCE_WINDOW_MS },
    );

    return this.employerShiftView(shiftId);
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
      .andWhere('w."profileQualityScore" >= :minScore', { minScore: PROFILE_MIN_SCORE_TO_APPLY })
      .select([
        'w.id', 'w.fullName', 'w.photoUrl', 'w.bio',
        'w.cvUrl', 'w.cvFileName',
        'w.skills', 'w.languages', 'w.availableDays',
        'w.isAvailableForWork', 'w.experiences',
        'w.avgRating', 'w.totalRatings', 'w.noShowCount', 'w.completedShifts',
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

  /** "Eliminar" on one expired shift — see deleteExpiredShifts. */
  async deleteExpiredShift(employerUserId: string, shiftId: string): Promise<{ message: string }> {
    const { deleted } = await this.deleteExpiredShifts(employerUserId, [shiftId]);
    if (deleted === 0) throw new BadRequestException('Only EXPIRED shifts can be deleted this way');
    return { message: t('api.shifts.deleted') };
  }

  /**
   * Remove expired shifts from the company's dashboard — the given ones, or
   * all of them when `ids` is empty ("Eliminar todos"). Without this the
   * "Turnos caducados" count only ever grew.
   *
   * A shift counts as expired once its end has passed unfilled, even before
   * the expiry job has marked it (the dashboard shows it as expired already).
   * Selecting one day of a multi-day job removes the whole job, as the
   * dashboard shows the job as one row. Rows are archived (status EXPIRED +
   * archivedAt), never deleted: the audit trail keeps them.
   */
  async deleteExpiredShifts(employerUserId: string, ids?: string[]): Promise<{ deleted: number }> {
    const employer = await this.resolveEmployer(employerUserId);
    const now = new Date();
    const candidates = await this.shiftRepo.find({
      where: {
        employer: { id: employer.id },
        archivedAt: IsNull(),
        status: In([ShiftStatus.EXPIRED, ShiftStatus.OPEN, ShiftStatus.PENDING_ACCEPTANCE]),
      },
    });
    const ended = candidates.filter(sh =>
      sh.status === ShiftStatus.EXPIRED || lisbonDateTime(sh.date, sh.endTime) < now);

    let target = ended;
    if (ids?.length) {
      const picked = new Set(ids);
      const series = new Set(ended.filter(sh => picked.has(sh.id) && sh.seriesId).map(sh => sh.seriesId!));
      target = ended.filter(sh => picked.has(sh.id) || (sh.seriesId && series.has(sh.seriesId)));
    }
    if (target.length === 0) return { deleted: 0 };

    const targetIds = target.map(sh => sh.id);
    await this.shiftRepo.update(
      { id: In(targetIds) },
      { status: ShiftStatus.EXPIRED, archivedAt: now, assignedWorker: null as any, offeredAt: null },
    );
    // Ended unfilled — to applicants it expired, whatever the company does with it now
    await closeApplications(this.applicationRepo, targetIds, ApplicationStatus.EXPIRED);
    // Count jobs, not days, so the number matches the rows the company selected
    return { deleted: new Set(target.map(sh => sh.seriesId ?? sh.id)).size };
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  /**
   * Strip a shift down to what an unauthenticated caller may see.
   *
   * `assignedWorker` and `applications` are destructured off and discarded —
   * they carry the worker's NIF, IBAN and contact details and nothing public
   * needs them. The remaining Shift columns are all worker-facing by nature
   * (title, hours, rate, address, dress code, payment method); if a sensitive
   * column is ever added to Shift itself, exclude it here too.
   */
  private toPublicShift(shift: Shift & { seriesDates?: string[] }): PublicShift {
    const {
      employer,
      assignedWorker: _assignedWorker,
      applications: _applications,
      ...rest
    } = shift;

    return {
      ...rest,
      employer: employer
        ? {
            id: employer.id,
            companyName: employer.companyName,
            sector: employer.sector ?? null,
            logoUrl: employer.logoUrl ?? null,
          }
        : null,
    };
  }

  async findById(id: string): Promise<PublicShift> {
    const shift = await this.shiftRepo.findOne({
      where: { id },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
    return this.toPublicShift(await this.withSeriesInfo(shift));
  }
}

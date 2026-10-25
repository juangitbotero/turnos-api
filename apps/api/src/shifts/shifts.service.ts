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
  normalizeSkill, roleCategory, roleMaxLevel, roleTaskIds,
  meetsRoleLevel, resolveWorkerRoles, translateSkill,
  normalizeSkills as normalizeSkillList, ROLE_CONFIRMED_MIN_SHIFTS,
  CERTIFIED_ROLES, roleNeedsCertificate, isRoleUsable,
} from '@turnos/shared';
import { Shift, ShiftStatus } from './entities/shift.entity';
import { ShiftApplication, ApplicationStatus } from './entities/shift-application.entity';
import { ShiftRequest } from './entities/shift-request.entity';
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
import { t, tNumericDate, currentLanguage } from '../i18n/request-language';
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

/** A shift as the "who worked with us" cards need it. */
export interface WorkerJobRef {
  shiftId: string; title: string; date: string;
  /** Pending reviews only: the shift's role, and the worker's declared level in it (null = not declared). */
  role?: string | null;
  declaredLevel?: number | null;
}

export type PublicShift = Omit<Shift, 'employer' | 'assignedWorker' | 'applications'> & {
  employer: PublicEmployer | null;
  seriesDates?: string[];
  /** Multi-role request line: workers still needed on this card ("2 vagas"). */
  openSlots?: number;
};

/** Limits of one multi-role request ("Publicar vários turnos"). */
export const REQUEST_MAX_LINES = 10;
export const REQUEST_MAX_QUANTITY = 10;

/** One row of a multi-role request: N workers in one role. */
export interface RequestLineInput {
  subcategory: string;
  requiredLevel?: number;
  tasksRequired?: string[];
  quantity: number;
  startTime: string;
  endTime: string;
  grossHourlyRate: number;
  languagesRequired?: string[];
  title?: string;
}

/** Order used to pick one application per worker when a line has several. */
const APP_STATUS_RANK: Record<string, number> = {
  APPROVED: 0, PENDING: 1, REJECTED: 2, WITHDRAWN: 3, EXPIRED: 4, CANCELLED: 5,
};

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    @InjectRepository(Shift)
    private shiftRepo: Repository<Shift>,
    @InjectRepository(ShiftApplication)
    private applicationRepo: Repository<ShiftApplication>,
    @InjectRepository(ShiftRequest)
    private requestRepo: Repository<ShiftRequest>,
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
    requiredLevel?: number;
    tasksRequired?: string[];
    paymentMethod?: string;
    hasDressCode?: boolean;
    dressCode?: string | null;
  }): Promise<Shift> {
    this.assertMinDuration(data.startTime, data.endTime);
    const allDates = this.resolveDates([data.date, ...(data.dates ?? [])]);
    this.assertPaymentMethod(data.paymentMethod);
    const { hasDressCode, dressCode } = this.resolveDressCode(data.hasDressCode, data.dressCode);

    // Role, level and tasks — all from the catalogue, so they can be matched
    const roleFields = this.resolveRoleFields(data.subcategory, data.requiredLevel, data.tasksRequired);

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
        ...roleFields,
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
    this.notifications
      .notifyMatchingWorkers(
        primary.id, employer.id,
        { role: primary.subcategory, requiredLevel: primary.requiredLevel },
        primary.title,
      )
      .catch(() => {}); // non-blocking

    // Schedule re-notification job for 5 hours later (once per job, not per day)
    await this.notificationQueue.add(
      're-notify',
      {
        shiftId: primary.id,
        shiftTitle: primary.title,
        employerId: employer.id,
      } satisfies ReNotificationJobData,
      { delay: RE_NOTIFY_DELAY_MS },
    );

    return primary;
  }

  // ── Guards shared by single shifts and multi-role requests ─────────────────

  /** Minimum 2-hour shift duration (overnight shifts wrap past midnight). */
  private assertMinDuration(startTime: string, endTime: string): void {
    const [sh, sm] = (startTime ?? '').split(':').map(Number);
    const [eh, em] = (endTime ?? '').split(':').map(Number);
    let shiftMins = ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0));
    if (shiftMins < 0) shiftMins += 24 * 60; // overnight shift
    if (shiftMins < 120) {
      throw new BadRequestException(t('api.shifts.minDuration'));
    }
  }

  /** The day set — one date is an ordinary shift, several a series. */
  private resolveDates(dates: Array<string | undefined>): string[] {
    const allDates = [...new Set(dates.filter((d): d is string => !!d))].sort();
    if (allDates.length === 0) {
      throw new BadRequestException(t('api.shifts.noDates'));
    }
    if (allDates.length > MAX_SERIES_DAYS) {
      throw new BadRequestException(t('api.shifts.maxSeriesDays', { max: MAX_SERIES_DAYS }));
    }
    return allDates;
  }

  /**
   * Payment method is required — workers must know how they'll be paid
   * (directly by the company) before applying. Cash is deliberately absent —
   * an MCD wage must leave a traceable record.
   */
  private assertPaymentMethod(paymentMethod: string | undefined): void {
    if (!paymentMethod || !Object.keys(PAYMENT_METHOD_LABELS).includes(paymentMethod)) {
      throw new BadRequestException(t('api.shifts.paymentMethodRequired'));
    }
  }

  /**
   * A dress code that is switched on must actually say something — "there is
   * a dress code, figure it out" is worse than none, and it is what the company
   * would later cancel the shift over.
   */
  private resolveDressCode(on: boolean | undefined, text: string | null | undefined) {
    const dressCode = (text ?? '').trim().slice(0, 300);
    if (on === true && dressCode.length === 0) {
      throw new BadRequestException(t('api.shifts.dressCodeRequired'));
    }
    const hasDressCode = on === true && dressCode.length > 0;
    return { hasDressCode, dressCode: hasDressCode ? dressCode : null };
  }

  // ── Multi-role request ("Publicar vários turnos") ─────────────────────────

  /**
   * Post several roles at once — e.g. a hotel's Saturday: 2 waiters, 1 barman,
   * 1 dishwasher. Every worker needed is a normal shift (or a series, for
   * several days) carrying `requestId` + `lineId`, so check-in, compliance,
   * fees and payment are untouched. Workers see one card per line ("2 vagas")
   * and apply once; see apply() and approveApplication().
   *
   * All or nothing: the plan quota counts every slot (decision 2026-10-25) and
   * the rows are written in one transaction — a request is never half posted.
   */
  async createRequest(userId: string, data: {
    name: string;
    description?: string;
    dates: string[];
    address: string;
    lat: number;
    lng: number;
    paymentMethod?: string;
    hasDressCode?: boolean;
    dressCode?: string | null;
    lines: RequestLineInput[];
  }): Promise<{ id: string; name: string; lines: number; shifts: number }> {
    const name = (data.name ?? '').trim().slice(0, 120);
    if (!name) throw new BadRequestException(t('api.shifts.requestNameRequired'));
    const lines = Array.isArray(data.lines) ? data.lines : [];
    if (lines.length < 1 || lines.length > REQUEST_MAX_LINES) {
      throw new BadRequestException(t('api.shifts.requestLines', { max: REQUEST_MAX_LINES }));
    }
    const allDates = this.resolveDates(data.dates ?? []);
    this.assertPaymentMethod(data.paymentMethod);
    const { hasDressCode, dressCode } = this.resolveDressCode(data.hasDressCode, data.dressCode);
    if (!data.address?.trim() || data.lat == null || data.lng == null) {
      throw new BadRequestException(t('api.shifts.requestAddress'));
    }

    // Validate every line before anything is written
    const resolved = lines.map(line => {
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > REQUEST_MAX_QUANTITY) {
        throw new BadRequestException(t('api.shifts.requestQuantity', { max: REQUEST_MAX_QUANTITY }));
      }
      this.assertMinDuration(line.startTime, line.endTime);
      const rate = Number(line.grossHourlyRate);
      if (!Number.isFinite(rate) || rate <= 0) throw new BadRequestException(t('api.shifts.requestRate'));
      const roleFields = this.resolveRoleFields(line.subcategory, line.requiredLevel, line.tasksRequired);
      const languages = [...new Set((line.languagesRequired ?? []).map(String))];
      return { line, quantity, rate, roleFields, languages };
    });
    const slots = resolved.reduce((n, r) => n + r.quantity, 0);

    // Subscription, unpaid wages, and the whole request against the plan limit
    await this.payments.assertCanPostShift(userId, slots);
    const employer = await this.resolveEmployer(userId);
    const isSeries = allDates.length > 1;

    const { request, firstOfLine } = await this.shiftRepo.manager.transaction(async m => {
      const request = await m.save(m.create(ShiftRequest, { name, employer: { id: employer.id } as Employer }));
      const firstOfLine: Shift[] = [];
      for (const r of resolved) {
        const lineId = randomUUID();
        let first: Shift | undefined;
        for (let n = 0; n < r.quantity; n++) {
          const seriesId = isSeries ? randomUUID() : null;
          const rows = await m.save(allDates.map((day, i) => m.create(Shift, {
            ...r.roleFields,
            title: (r.line.title ?? '').trim().slice(0, 255) || r.roleFields.subcategory,
            description: (data.description ?? '').trim(),
            languagesRequired: r.languages.length ? r.languages : undefined,
            date: day,
            startTime: r.line.startTime,
            endTime: r.line.endTime,
            grossHourlyRate: r.rate,
            address: data.address.trim(),
            lat: data.lat,
            lng: data.lng,
            paymentMethod: data.paymentMethod,
            hasDressCode,
            dressCode,
            status: ShiftStatus.OPEN,
            employer: { id: employer.id } as Employer,
            requestId: request.id,
            lineId,
            seriesId,
            seriesDayIndex:  isSeries ? i + 1 : null,
            seriesTotalDays: isSeries ? allDates.length : null,
          } as Partial<Shift>)));
          first ??= rows[0];
        }
        firstOfLine.push(first!);
      }
      return { request, firstOfLine };
    });

    // One notification wave per line — never the same push once per slot
    for (const primary of firstOfLine) {
      this.notifications
        .notifyMatchingWorkers(
          primary.id, employer.id,
          { role: primary.subcategory, requiredLevel: primary.requiredLevel },
          primary.title,
        )
        .catch(() => {});
      await this.notificationQueue.add(
        're-notify',
        { shiftId: primary.id, shiftTitle: primary.title, employerId: employer.id } satisfies ReNotificationJobData,
        { delay: RE_NOTIFY_DELAY_MS },
      );
    }

    this.logger.log(`[Requests] ${employer.id} posted "${name}": ${resolved.length} line(s), ${slots} shift(s)`);
    return { id: request.id, name: request.name, lines: resolved.length, shifts: slots };
  }

  /**
   * Cancel every shift of a request that has not started — one call per slot
   * through cancel(), so each keeps its own policy (fees, reasons, notices).
   * A slot that needs a reason (<3h) and gets none stops the loop with that
   * error; the slots before it stay cancelled and are reported.
   */
  async cancelRequest(userId: string, requestId: string, reason?: { category?: string; note?: string }) {
    const employer = await this.resolveEmployer(userId);
    const request = await this.requestRepo.findOne({ where: { id: requestId }, relations: ['employer'] });
    if (!request) throw new NotFoundException(t('api.common.shiftNotFound'));
    if (request.employer.id !== employer.id) throw new UnauthorizedException('Not your request');

    const rows = await this.shiftRepo.find({ where: { requestId }, order: { date: 'ASC' } });
    const firstDayOfSlot = new Map<string, Shift>();
    for (const row of rows) {
      if (![ShiftStatus.OPEN, ShiftStatus.PENDING_ACCEPTANCE, ShiftStatus.FILLED].includes(row.status)) continue;
      const key = row.seriesId ?? row.id;
      if (!firstDayOfSlot.has(key)) firstDayOfSlot.set(key, row);
    }
    let cancelled = 0;
    for (const day of firstDayOfSlot.values()) {
      await this.cancel(userId, day.id, reason);
      cancelled++;
    }
    return { cancelled };
  }

  /**
   * The slots of a request line as groups of day rows — one group per worker
   * needed (a series is one group). Ascending by date.
   */
  private async lineSlots(lineId: string): Promise<Shift[][]> {
    const rows = await this.shiftRepo.find({
      where: { lineId },
      relations: ['employer', 'assignedWorker'],
      order: { date: 'ASC' },
    });
    const groups = new Map<string, Shift[]>();
    for (const row of rows) {
      const key = row.seriesId ?? row.id;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups.values()];
  }

  /** Do two shifts overlap in time? (Lisbon wall clock, overnight-aware.) */
  private static overlaps(a: Shift, b: Shift): boolean {
    const span = (x: Shift) => {
      const start = lisbonDateTime(x.date, x.startTime).getTime();
      let end = lisbonDateTime(x.date, x.endTime).getTime();
      if (end <= start) end += 24 * 60 * 60 * 1000;
      return [start, end] as const;
    };
    const [as, ae] = span(a);
    const [bs, be] = span(b);
    return as < be && bs < ae;
  }

  /** One application per worker for a line: the most advanced status wins. */
  private static onePerWorker(apps: ShiftApplication[]): ShiftApplication[] {
    const best = new Map<string, ShiftApplication>();
    for (const a of apps) {
      const key = a.worker?.id;
      if (!key) continue;
      const cur = best.get(key);
      const rank = (x: ShiftApplication) => APP_STATUS_RANK[x.status] ?? 9;
      if (!cur || rank(a) < rank(cur) || (rank(a) === rank(cur) && a.shift?.date < cur.shift?.date)) best.set(key, a);
    }
    return [...best.values()];
  }

  /**
   * The role fields of a shift, validated against ROLE_CATALOGUE: the current
   * role name, its family as the category, a level that exists for that role
   * and only that role's task ids. `skillsRequired` is written as just the role
   * for clients that still read it.
   */
  private resolveRoleFields(subcategory: string, requiredLevel?: number, tasksRequired?: string[]) {
    const role = normalizeSkill(subcategory ?? '');
    const category = roleCategory(role);
    if (!category) throw new BadRequestException(t('api.shifts.roleUnknown'));
    const level = requiredLevel === undefined || requiredLevel === null ? 1 : Number(requiredLevel);
    if (!Number.isInteger(level) || level < 1 || level > roleMaxLevel(role)) {
      throw new BadRequestException(t('api.shifts.levelInvalid'));
    }
    const valid = new Set(roleTaskIds(role));
    const tasks = [...new Set((tasksRequired ?? []).map(String))].filter(id => valid.has(id));
    return {
      subcategory: role,
      category,
      requiredLevel: level,
      tasksRequired: tasks.length ? tasks : null,
      skillsRequired: [role],
    };
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

    // Shifts posted together carry their request, so the dashboard can group them
    const requestIds = [...new Set(collapsed.map(r => r.requestId).filter((x): x is string => !!x))];
    if (requestIds.length === 0) return collapsed;
    const requests = await this.requestRepo.find({ where: { id: In(requestIds) } });
    const names = new Map(requests.map(r => [r.id, r.name]));
    return collapsed.map(r => r.requestId
      ? { ...r, request: { id: r.requestId, name: names.get(r.requestId) ?? '' } }
      : r);
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
    // Role edits go through the same catalogue validation as create()
    if (rest.subcategory !== undefined || rest.requiredLevel !== undefined
        || rest.tasksRequired !== undefined || rest.skillsRequired !== undefined) {
      Object.assign(shift, this.resolveRoleFields(shift.subcategory, shift.requiredLevel, shift.tasksRequired ?? []));
    }
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
    // A request line is one candidate list for all its slots: the worker
    // applied once, to every open slot, so show each worker once.
    if (shift.lineId) {
      const lineRows = await this.shiftRepo.find({ where: { lineId: shift.lineId }, select: ['id'] });
      const ids = lineRows.map(r => r.id);
      const all = await this.applicationRepo.find({
        where: { shift: { id: In(ids) } },
        relations: ['worker', 'shift'],
        order: { appliedAt: 'DESC' },
      });
      await this.markSeen(ids);
      return ShiftsService.onePerWorker(all)
        .sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime())
        .map(({ shift: _s, ...app }) => ({ ...app, worker: this.toApplicantWorker(app.worker) }));
    }

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

    // Job key: a request line (all its slots), else a series, else the shift
    const jobKey = (sh: Shift) => sh.lineId ?? sh.seriesId ?? sh.id;
    const firstDay = new Map<string, string>();   // job key → earliest open date
    for (const a of apps) {
      const key = jobKey(a.shift);
      const d = firstDay.get(key);
      if (!d || a.shift.date < d) firstDay.set(key, a.shift.date);
    }

    const jobs = new Map<string, { shift: Shift; applications: ShiftApplication[] }>();
    for (const a of apps) {
      const key = jobKey(a.shift);
      if (a.shift.date !== firstDay.get(key)) continue;
      const job = jobs.get(key) ?? { shift: a.shift, applications: [] };
      job.applications.push(a);
      jobs.set(key, job);
    }

    const result = [];
    for (const { shift, applications: rawApps } of jobs.values()) {
      const { applications: _apps, ...plain } = await this.withSeriesInfo(shift);
      // A line's slots each hold the same applicants — one row per worker,
      // plus how many workers the line still needs
      const applications = shift.lineId ? ShiftsService.onePerWorker(rawApps) : rawApps;
      const slots = shift.lineId ? await this.lineSlots(shift.lineId) : null;
      result.push({
        shift: slots
          ? { ...plain, openSlots: slots.filter(g => g.some(d => d.status === ShiftStatus.OPEN)).length, totalSlots: slots.length }
          : plain,
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
      const key = `${a.shift.lineId ?? a.shift.seriesId ?? a.shift.id}:${a.worker.id}`;
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
      roles:               this.publicRoles(worker, { withDocuments: true }),
      status:              worker.status,
      profileQualityScore: worker.profileQualityScore,
      avgRating:           worker.avgRating,
      totalRatings:        worker.totalRatings,
      noShowCount:         worker.noShowCount,
      completedShifts:     worker.completedShifts ?? 0,
      badges:              worker.badges ?? [],
    };
  }

  /**
   * A worker's roles as companies see them: role, level, tasks, years and how
   * many shifts confirmed it. `belowLevelCount` is internal (it only opens an
   * ops review) and never leaves the server.
   */
  private publicRoles(worker: Worker, opts: { withDocuments?: boolean } = {}) {
    // A licensed role without its document is hidden from companies entirely
    return resolveWorkerRoles(worker).filter(isRoleUsable).map(r => ({
      role: r.role, level: r.level, tasks: r.tasks, years: r.years ?? null,
      confirmedShifts: r.confirmedShifts ?? 0,
      hasCertificate: !!r.certificate?.url,
      // The file itself only to a company the worker applied to — checking it
      // is that company's legal duty. Worker search gets the badge, not the file.
      ...(opts.withDocuments && r.certificate?.url
        ? { certificate: { url: r.certificate.url, fileName: r.certificate.fileName } }
        : {}),
    }));
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
    const requested = await this.shiftRepo.findOne({ where: { id: shiftId }, relations: ['employer'] });
    if (!requested) throw new NotFoundException(t('api.common.shiftNotFound'));
    if (requested.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['worker'],
    });
    if (!application) throw new NotFoundException('Application not found');

    // A request line: the company picks a worker, not a slot. Fill the first
    // open slot this worker applied to; refuse a second slot of the same line.
    let shift = requested;
    if (requested.lineId) {
      const already = await this.shiftRepo.count({
        where: {
          lineId: requested.lineId,
          assignedWorker: { id: application.worker.id },
          status: In([ShiftStatus.PENDING_ACCEPTANCE, ShiftStatus.FILLED, ShiftStatus.ACTIVE, ShiftStatus.COMPLETED]),
        },
      });
      if (already) throw new BadRequestException(t('api.shifts.alreadySelectedInLine'));
      const mine = await this.applicationRepo.find({
        where: { worker: { id: application.worker.id }, status: ApplicationStatus.PENDING, shift: { lineId: requested.lineId } },
        relations: ['shift'],
      });
      const open = mine
        .filter(a => a.shift.status === ShiftStatus.OPEN)
        .sort((a, b) => a.shift.date.localeCompare(b.shift.date))[0];
      if (!open) throw new BadRequestException('Shift is no longer open');
      shift = (await this.shiftRepo.findOne({ where: { id: open.shift.id }, relations: ['employer'] }))!;
    } else if (requested.status !== ShiftStatus.OPEN) {
      throw new BadRequestException('Shift is no longer open');
    }

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

    return this.employerShiftView(shift.id);
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

    // Same request: the worker now holds one slot. Their applications to the
    // other slots of this line, and to other lines at an overlapping time, go.
    if (shift.requestId) {
      const others = await this.applicationRepo.find({
        where: { worker: { id: worker.id }, status: ApplicationStatus.PENDING, shift: { requestId: shift.requestId } },
        relations: ['shift'],
      });
      const clash = others.filter(a => !dayIds.includes(a.shift.id)
        && (a.shift.lineId === shift.lineId || days.some(d => ShiftsService.overlaps(d, a.shift))));
      if (clash.length) {
        await this.applicationRepo.update({ id: In(clash.map(a => a.id)) }, { status: ApplicationStatus.WITHDRAWN });
      }
    }

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
      .notifyMatchingWorkers(
        shift.id, shift.employer.id,
        { role: shift.subcategory, requiredLevel: shift.requiredLevel },
        shift.title,
      )
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

    // A request line asking for N workers is one card: "N vagas", applied to once
    const lineCount = new Map<string, number>();
    for (const c of collapsed) if (c.lineId) lineCount.set(c.lineId, (lineCount.get(c.lineId) ?? 0) + 1);
    const seenLines = new Set<string>();
    const cards: Array<Shift & { seriesDates?: string[]; openSlots?: number }> = [];
    for (const c of collapsed) {
      if (!c.lineId) { cards.push(c); continue; }
      if (seenLines.has(c.lineId)) continue;
      seenLines.add(c.lineId);
      cards.push({ ...c, openSlots: lineCount.get(c.lineId) });
    }
    return cards.map(shift => this.toPublicShift(shift));
  }

  async apply(userId: string, shiftId: string, coverNote?: string): Promise<ShiftApplication & { warning?: string }> {
    // Resolve the Worker entity from the JWT userId
    const worker = await this.resolveWorker(userId);

    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer'],
    });
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
    // A line card stays applicable while ANY of its slots is open (checked below)
    if (!shift.lineId && shift.status !== ShiftStatus.OPEN) throw new BadRequestException(t('api.shifts.notOpen'));

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

    // Level gate — above level 1 the worker must have declared the role at the
    // shift's level. It is the worker's own statement being checked, not a
    // judgement about them (decision D2). Level 1 is open to all (D3).
    if (!meetsRoleLevel(resolveWorkerRoles(worker), shift.subcategory, shift.requiredLevel)) {
      const roleName = normalizeSkill(shift.subcategory);
      const roleLabel = translateSkill(roleName, currentLanguage());
      const mine = resolveWorkerRoles(worker).find(r => r.role === roleName);
      // Licensed role declared at the right level but no document yet
      if (roleNeedsCertificate(roleName) && mine && mine.level >= shift.requiredLevel) {
        throw new BadRequestException(t('api.shifts.certificateMissing', { role: roleLabel }));
      }
      throw new BadRequestException(t('api.shifts.levelTooLow', {
        level: shift.requiredLevel,
        role: roleLabel,
      }));
    }

    // What the application covers: one job (a shift, or every day of a series),
    // or — for a request line — every open slot, so the company can pick this
    // worker for whichever slot is still free.
    let jobs: Shift[][];
    if (shift.lineId) {
      const appliedInLine = await this.applicationRepo.count({
        where: { worker: { id: worker.id }, shift: { lineId: shift.lineId } },
      });
      if (appliedInLine) throw new BadRequestException(t('api.shifts.alreadyApplied'));
      jobs = (await this.lineSlots(shift.lineId))
        .map(slot => slot.filter(d => d.status === ShiftStatus.OPEN))
        .filter(slot => slot.length > 0);
      if (jobs.length === 0) throw new BadRequestException(t('api.shifts.notOpen'));
    } else {
      const existing = await this.applicationRepo.findOne({
        where: { shift: { id: shiftId }, worker: { id: worker.id } },
      });
      if (existing) throw new BadRequestException(t('api.shifts.alreadyApplied'));
      jobs = [(await this.seriesShifts(shift)).filter(d => d.status === ShiftStatus.OPEN)];
    }

    // Multi-day: applying commits the worker to EVERY day of the series.
    // Compliance is checked per day and any hard block rejects the whole
    // application — a worker must never end up holding a partial series.
    // The slots of a line share their dates and times, so one is enough.
    const days = jobs[0]!;
    const allDays = jobs.flat();
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
      where: { shift: { id: In(allDays.map(d => d.id)) } },
    })) === 0;

    const saved = (await this.applicationRepo.save(
      allDays.map(day => this.applicationRepo.create({
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

    // A request line: the worker applied once to every slot — show one entry,
    // the slot they actually hold if any, otherwise their open application.
    const entries = [...singles, ...collapsed];
    const byLine = new Map<string, ShiftApplication[]>();
    const result: ShiftApplication[] = [];
    for (const e of entries) {
      const lineId = e.shift?.lineId;
      if (!lineId) { result.push(e); continue; }
      byLine.set(lineId, [...(byLine.get(lineId) ?? []), e]);
    }
    const rank = (x: ShiftApplication) => APP_STATUS_RANK[x.status] ?? 9;
    for (const group of byLine.values()) {
      // Most advanced status first (APPROVED = the slot they hold), then soonest
      result.push([...group].sort((a, b) => rank(a) - rank(b) || a.shift.date.localeCompare(b.shift.date))[0]!);
    }

    return result.sort(
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
    pendingReviews: WorkerJobRef[]; noShowShifts: WorkerJobRef[];
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
      pendingReviews: WorkerJobRef[]; noShowShifts: WorkerJobRef[];
    }>();

    const workerEntities = new Map<string, Worker>();
    for (const app of apps) {
      if (!app.worker) continue;
      const w = app.worker;
      workerEntities.set(w.id, w);
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
          pendingReviews:      [],
          noShowShifts:        [],
        });
      }
      workerMap.get(w.id)!.shiftsWorked += 1;
    }

    // Per worker, only THEIR shifts. Until 2026-10-11 the dashboard offered
    // every completed shift of the company under every worker's "Rate", and
    // every filled/open shift under "Report no-show" — while the server acts
    // on whoever actually worked the chosen shift, so reporting from one
    // worker's card could sanction another.
    //
    // Reviews: one per JOB (a multi-day series counts once, rated on its last
    // completed day — the day the review prompt fires), and only jobs this
    // company hasn't reviewed yet. Working again for the same company = a new
    // job = a new review.
    const toReview: Array<{ id: string; title: string; date: string; seriesId: string | null; workerId: string; subcategory: string | null }> =
      await this.shiftRepo.createQueryBuilder('s')
        .select(['s.id AS id', 's.title AS title', `to_char(s.date, 'YYYY-MM-DD') AS date`, 's."seriesId" AS "seriesId"', 's."assignedWorkerId" AS "workerId"', 's.subcategory AS subcategory'])
        .where('s."employerId" = :eid', { eid: employer.id })
        .andWhere('s.status = :completed', { completed: ShiftStatus.COMPLETED })
        .andWhere('s."assignedWorkerId" IS NOT NULL')
        .andWhere(`NOT EXISTS (
          SELECT 1 FROM ratings r JOIN shifts rs ON rs.id = r."shiftId"
          WHERE r.direction = 'EMPLOYER_TO_WORKER'
            AND (rs.id = s.id OR (s."seriesId" IS NOT NULL AND rs."seriesId" = s."seriesId"))
        )`)
        .orderBy('s.date', 'DESC')
        .getRawMany();
    const seenSeries = new Set<string>();
    for (const row of toReview) {
      if (row.seriesId) {
        if (seenSeries.has(row.seriesId)) continue; // DESC → first row is the last day
        seenSeries.add(row.seriesId);
      }
      // Role + declared level drive the "did the level match?" question
      const role = row.subcategory ? normalizeSkill(row.subcategory) : null;
      const entity = workerEntities.get(row.workerId);
      const declared = role && entity ? resolveWorkerRoles(entity).find(r => r.role === role) : undefined;
      workerMap.get(row.workerId)?.pendingReviews.push({
        shiftId: row.id, title: row.title, date: row.date,
        role, declaredLevel: declared?.level ?? null,
      });
    }

    // No-show: a confirmed shift of this worker that has already started and
    // was never checked in (it would be ACTIVE otherwise, then COMPLETED).
    const started: Array<{ id: string; title: string; date: string; startTime: string; workerId: string }> =
      await this.shiftRepo.createQueryBuilder('s')
        .select(['s.id AS id', 's.title AS title', `to_char(s.date, 'YYYY-MM-DD') AS date`, 's."startTime" AS "startTime"', 's."assignedWorkerId" AS "workerId"'])
        .where('s."employerId" = :eid', { eid: employer.id })
        .andWhere('s.status = :filled', { filled: ShiftStatus.FILLED })
        .andWhere('s."assignedWorkerId" IS NOT NULL')
        .andWhere('s.date <= :today', { today: lisbonDate() })
        .orderBy('s.date', 'DESC')
        .getRawMany();
    const now = Date.now();
    for (const row of started) {
      // date comes back as 'YYYY-MM-DD' (to_char) — raw rows would give a JS Date
      if (lisbonDateTime(row.date, row.startTime).getTime() > now) continue;
      workerMap.get(row.workerId)?.noShowShifts.push({ shiftId: row.id, title: row.title, date: row.date });
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
    /** Role names — a worker matches if they declared any of them (at `minLevel`+). */
    skills?: string[];
    minLevel?: number;
    /** Only workers whose role was confirmed by companies that hired them. */
    confirmedOnly?: boolean;
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
        'w.isAvailableForWork', 'w.experiences', 'w.roles',
        'w.avgRating', 'w.totalRatings', 'w.noShowCount', 'w.completedShifts',
        'w.badges', 'w.profileQualityScore',
      ]);

    // Master availability switch — the worker says they're open to work at all
    if (filters.availableNow) {
      qb.andWhere('w."isAvailableForWork" = true');
    }

    const roles = normalizeSkillList(filters.skills);
    if (roles.length || filters.confirmedOnly) {
      // Exact role (any of the requested), at the minimum level, optionally confirmed
      // A licensed role without its document doesn't count (it isn't shown either)
      const conditions = [`(NOT (r->>'role' = ANY(:certRoles)) OR (r->'certificate'->>'url') IS NOT NULL)`];
      const params: Record<string, unknown> = {
        minLevel: Math.max(1, Number(filters.minLevel) || 1),
        confirmedMin: ROLE_CONFIRMED_MIN_SHIFTS,
        certRoles: CERTIFIED_ROLES,
      };
      if (roles.length) { conditions.push(`r->>'role' IN (:...roles)`); params.roles = roles; }
      conditions.push(`(r->>'level')::int >= :minLevel`);
      if (filters.confirmedOnly) conditions.push(`COALESCE((r->>'confirmedShifts')::int, 0) >= :confirmedMin`);
      qb.andWhere(
        `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(w.roles, '[]'::jsonb)) r WHERE ${conditions.join(' AND ')})`,
        params,
      );
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

    const workers = await qb.getMany();
    return workers.map(w => ({ ...w, roles: this.publicRoles(w) }));
  }

  /**
   * How many active workers could take a shift of this role at this level —
   * shown live while the company fills in the form, so a level or language
   * requirement that leaves nobody is visible before publishing.
   * Level 1 is open to everyone, but the count is of workers who declared the
   * role: they are the ones notified.
   */
  async countMatchingWorkers(filters: { role: string; level?: number; languages?: string[] }): Promise<{ count: number }> {
    const role = normalizeSkill(filters.role ?? '');
    if (!roleCategory(role)) return { count: 0 };
    const qb = this.workerRepo
      .createQueryBuilder('w')
      .where('w.status = :status', { status: 'ACTIVE' })
      .andWhere('w."profileQualityScore" >= :minScore', { minScore: PROFILE_MIN_SCORE_TO_APPLY })
      .andWhere(
        `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(w.roles, '[]'::jsonb)) r
                 WHERE r->>'role' = :role AND (r->>'level')::int >= :level
                   AND (NOT (r->>'role' = ANY(:certRoles)) OR (r->'certificate'->>'url') IS NOT NULL))`,
        { role, level: Math.max(1, Number(filters.level) || 1), certRoles: CERTIFIED_ROLES },
      );
    (filters.languages ?? []).forEach((l, i) => {
      qb.andWhere(`w.languages LIKE :lang${i}`, { [`lang${i}`]: `%${l}%` });
    });
    return { count: await qb.getCount() };
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
    const withSeries = await this.withSeriesInfo(shift);
    if (!shift.lineId) return this.toPublicShift(withSeries);
    // One card per line: say how many workers it still needs
    const slots = await this.lineSlots(shift.lineId);
    const openSlots = slots.filter(g => g.some(d => d.status === ShiftStatus.OPEN)).length;
    return { ...this.toPublicShift(withSeries), openSlots };
  }
}

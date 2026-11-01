/**
 * AttendanceService — static-QR model (v2, Stint 5 revision)
 *
 * ARCHITECTURE CHANGE (from rotating-QR):
 *   Each employer has TWO permanent printed QR codes — one for check-in,
 *   one for check-out — fixed at their venue (Urban Sports model).
 *
 *   Token format:  base64url({ employerId, action, v }) . base64url(HMAC-SHA256)
 *   No expiry — the HMAC signature prevents forgery.
 *
 * Validation at scan time:
 *   1. Verify HMAC signature
 *   2. Confirm token action matches endpoint called (in → checkIn, out → checkOut)
 *   3. Find worker's confirmed shift at this employer for today within time window
 *   4. Haversine geofence (200 m) — skips gracefully if no PostGIS coords
 *   5. Check-in window: 30 min before → 60 min after shift start
 *   6. Check-out window: 30 min before → 2 h after shift end (same as before)
 *
 * PAYMENT RULE (unchanged):
 *   Payment is ALWAYS calculated from scheduledHours (shift.startTime → shift.endTime).
 *   QR scans prove attendance only — scan timestamps are never used for payment.
 */
import {
  Injectable, BadRequestException,
  NotFoundException, UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isLookupKey } from '../common/lookup-key';
import { Repository, In, Not, IsNull, LessThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { lisbonDateTime, lisbonDate, nextDay } from '../common/lisbon-time';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import {
  formatSeriesRange, UNCONFIRMED_AUTO_COMPLETE_HOURS, UNCONFIRMED_BACKFILL_DAYS, CHECKIN_REMINDER_MINUTES,
} from '@turnos/shared';
import { MailService } from '../mail/mail.service';
import { escapeHtml, lisbonStamp, ptDate } from '../mail/ops-email';
import { ShiftAttendance, AttendanceStatus } from './entities/shift-attendance.entity';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';
import { Worker } from '../users/entities/worker.entity';
import { Employer } from '../users/entities/employer.entity';
import { ShiftsGateway } from '../gateway/shifts.gateway';
import { ComplianceService } from '../compliance/compliance.service';
import { ComplianceEvent } from '../compliance/entities/compliance-audit-log.entity';
import { PaymentsService } from '../payments/payments.service';
import { WagePaymentsService } from '../payments/wage-payments.service';
import { RatingsService } from '../ratings/ratings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { t, tTime } from '../i18n/request-language';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// Check-in window: 30 min before → 60 min after scheduled start
const CHECKIN_WINDOW_BEFORE_MS = 30 * 60 * 1000;
const CHECKIN_WINDOW_AFTER_MS  = 60 * 60 * 1000;
// Geofence radius (metres)
const GEOFENCE_RADIUS_M = 200;
const MINUTE_MS = 60 * 1000;
const HOUR_MS   = 60 * MINUTE_MS;
const DAY_MS    = 24 * HOUR_MS;

interface StaticQrPayload {
  employerId: string;
  action: 'in' | 'out'; // 'out' kept for legacy printed QRs — rejected at scan
  v: 1; // token version — allows future migration
}

export interface EmployerQrResult {
  checkInQrDataUrl:  string;
  checkInToken:      string;
  employerName:      string;
}

export interface AutoCompleteJobData {
  shiftId: string;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);
  private readonly hmacSecret: string;

  constructor(
    @InjectRepository(ShiftAttendance)
    private readonly attendanceRepo: Repository<ShiftAttendance>,

    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,

    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,

    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,

    @InjectQueue('shift-autocomplete')
    private readonly autoCompleteQueue: Queue,

    private readonly gateway: ShiftsGateway,
    private readonly compliance: ComplianceService,
    private readonly payments: PaymentsService,
    private readonly wagePayments: WagePaymentsService,
    private readonly ratings: RatingsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {
    this.hmacSecret = this.config.get<string>('QR_HMAC_SECRET', 'turnos-dev-qr-secret-change-in-prod');
  }

  // ── Static QR generation (employer) ───────────────────────────────────────

  /**
   * Generate the employer's single permanent static check-in QR code.
   * Deterministic — same inputs always produce the same QR. The employer
   * prints it once and posts it at the venue. There is no check-out QR:
   * shifts auto-complete at their scheduled end time (v2.1).
   */
  async getEmployerStaticQr(employerUserId: string): Promise<EmployerQrResult> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: employerUserId } } });
    if (!employer) throw new UnauthorizedException('Employer not found');

    const checkInToken = this.signStaticToken({ employerId: employer.id, action: 'in', v: 1 });

    const qrOpts: QRCode.QRCodeToDataURLOptions = {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400,
      color: { dark: '#111827', light: '#ffffff' },
    };

    const checkInQrDataUrl = await QRCode.toDataURL(checkInToken, qrOpts);

    this.logger.log(`[Attendance] Static QR requested for employer ${employer.id}`);
    return { checkInQrDataUrl, checkInToken, employerName: employer.companyName };
  }

  // ── Check-in (worker scans printed check-in QR) ───────────────────────────

  async checkIn(
    workerUserId: string,
    token: string,
    lat: number,
    lng: number,
  ): Promise<ShiftAttendance> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } } });
    if (!worker) throw new UnauthorizedException('Worker not found');

    const payload = this.verifyStaticToken(token);
    if (payload.action !== 'in') {
      // Legacy check-out QR (pre-v2.1 print) — no longer valid
      throw new BadRequestException(
        t('api.attendance.checkOutQrRetired'),
      );
    }

    // Signed by us, but an empty employerId would match any company's shift.
    if (!isLookupKey(payload.employerId)) throw new BadRequestException(t('api.attendance.qrInvalid'));
    const shift = await this.findWorkerShiftForEmployerToday(worker.id, payload.employerId);
    if (shift.status !== ShiftStatus.FILLED) {
      throw new BadRequestException(
        shift.status === ShiftStatus.ACTIVE
          ? t('api.attendance.alreadyCheckedIn')
          : t('api.attendance.notOpenForCheckIn'),
      );
    }

    this.assertCheckInWindow(shift);
    this.assertGeofence(lat, lng, shift);

    // Idempotency guard
    const existing = await this.attendanceRepo.findOne({ where: { shift: { id: shift.id } } });
    if (existing?.checkInAt) throw new BadRequestException(t('api.attendance.alreadyCheckedIn'));

    const scheduledHours = this.calcScheduledHours(shift.startTime, shift.endTime);

    const attendance = existing ?? this.attendanceRepo.create({
      shift:  { id: shift.id } as Shift,
      worker: { id: worker.id } as Worker,
    });
    attendance.checkInAt      = new Date();
    attendance.checkInLat     = lat;
    attendance.checkInLng     = lng;
    attendance.scheduledHours = scheduledHours;
    attendance.status         = AttendanceStatus.CHECKED_IN;

    const saved = await this.attendanceRepo.save(attendance);
    await this.shiftRepo.update(shift.id, { status: ShiftStatus.ACTIVE });

    this.gateway.notifyAttendance(shift.employer.id, {
      event:      'checked_in',
      shiftId:    shift.id,
      shiftTitle: shift.title,
      workerName: worker.fullName ?? 'Trabalhador',
      checkInAt:  saved.checkInAt!.toISOString(),
    });

    await this.compliance.log({
      event:      ComplianceEvent.CONTRACT_CREATED,
      shiftId:    shift.id,
      workerId:   worker.id,
      employerId: shift.employer.id,
      details:    { action: 'CHECK_IN', lat, lng, scheduledHours },
    });

    // Schedule auto-completion for the scheduled end time — there is no
    // check-out scan. The 15-min sweep job is the safety net if this job
    // is ever lost.
    const delayMs = Math.max(0, this.scheduledEnd(shift).getTime() - Date.now());
    await this.autoCompleteQueue.add(
      'auto-complete',
      { shiftId: shift.id } satisfies AutoCompleteJobData,
      { delay: delayMs },
    );

    this.logger.log(`[Attendance] Check-in: worker ${worker.id} → shift ${shift.id} (${scheduledHours}h; auto-complete in ${Math.round(delayMs / 60000)}min)`);
    return saved;
  }

  // ── Auto-completion (v2.1 — replaces the check-out scan) ──────────────────

  /**
   * Complete an ACTIVE shift at its scheduled end. Called by the BullMQ
   * auto-complete job (scheduled at check-in) and by the 15-min sweep.
   * Idempotent — safe to call twice.
   *
   * Runs the full completion chain: attendance close, €3 fee, wage payment
   * (Pay Link), review prompts to both parties.
   */
  async completeShift(shiftId: string, trigger: 'AUTO' | 'SWEEP' = 'AUTO'): Promise<void> {
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift || shift.status !== ShiftStatus.ACTIVE) return; // already handled / cancelled
    const worker = shift.assignedWorker;
    if (!worker) return;

    const attendance = await this.attendanceRepo.findOne({ where: { shift: { id: shift.id } } });
    if (!attendance?.checkInAt) return; // never checked in — no-show flow handles it
    if (attendance.checkOutAt) return;  // already closed (manual override)

    attendance.checkOutAt   = this.scheduledEnd(shift); // scheduled end, not wall-clock
    attendance.status       = AttendanceStatus.COMPLETED;
    attendance.autoCompleted = true;

    const saved = await this.attendanceRepo.save(attendance);
    await this.shiftRepo.update(shift.id, { status: ShiftStatus.COMPLETED });

    // Notify employer dashboard + worker app (same events the check-out emitted)
    this.gateway.notifyAttendance(shift.employer.id, {
      event:          'checked_out',
      shiftId:        shift.id,
      shiftTitle:     shift.title,
      workerName:     worker.fullName ?? 'Trabalhador',
      checkOutAt:     saved.checkOutAt!.toISOString(),
      scheduledHours: Number(saved.scheduledHours),
    });
    this.gateway.notifyAttendance(worker.id, {
      event:          'shift_completed',
      shiftId:        shift.id,
      shiftTitle:     shift.title,
      scheduledHours: Number(saved.scheduledHours),
    });

    // ── Series gate ──────────────────────────────────────────────────────────
    // A multi-day job settles ONCE, when its last worked day closes: one €3
    // fee, one wage payment / Pay Link covering every day, one set of review
    // prompts. Days in the middle only close their own attendance record.
    const settlement = await this.resolveSeriesSettlement(
      shift, worker.id, Number(saved.scheduledHours),
    );
    if (!settlement) {
      this.logger.log(
        `[Attendance] Day ${shift.seriesDayIndex}/${shift.seriesTotalDays} of series ${shift.seriesId} complete — settlement deferred to the final day`,
      );
      await this.compliance.log({
        event:      ComplianceEvent.CONTRACT_CREATED,
        shiftId:    shift.id,
        workerId:   worker.id,
        employerId: shift.employer.id,
        details:    { action: 'SERIES_DAY_COMPLETED', trigger, scheduledHours: Number(saved.scheduledHours) },
      });
      return;
    }

    this.settleJob(shift, worker, settlement);

    await this.compliance.log({
      event:      ComplianceEvent.CONTRACT_CREATED,
      shiftId:    shift.id,
      workerId:   worker.id,
      employerId: shift.employer.id,
      details:    { action: 'SHIFT_AUTO_COMPLETED', trigger, scheduledHours: Number(saved.scheduledHours) },
    });

    this.logger.log(`[Attendance] Auto-complete (${trigger}): shift ${shift.id} — ${saved.scheduledHours}h`);
  }

  /**
   * Safety-net sweep (every 15 min): complete any ACTIVE shift whose
   * scheduled end has passed — covers lost/failed auto-complete jobs.
   */
  async sweepOverdueActiveShifts(): Promise<void> {
    const active = await this.shiftRepo.find({
      where: { status: ShiftStatus.ACTIVE },
      relations: ['employer', 'assignedWorker'],
    });
    const now = new Date();
    for (const shift of active) {
      if (this.scheduledEnd(shift) <= now) {
        await this.completeShift(shift.id, 'SWEEP').catch(err => {
          this.logger.error(`[Attendance] Sweep completion failed for shift ${shift.id}: ${(err as Error).message}`);
        });
      }
    }

    await this.settleStrandedSeries().catch(err => {
      this.logger.error(`[Attendance] Stranded-series settlement failed: ${(err as Error).message}`);
    });
  }

  /**
   * Settle multi-day jobs whose remaining days went away without a final
   * completion — the no-show case, where days 4–5 are released back to OPEN
   * after the worker fails to check in on day 3. Days 1–2 were worked and
   * deferred their settlement to a last day that now never arrives, so the
   * wage would otherwise never be generated.
   *
   * Idempotent: skips any series that already has a wage payment.
   */
  private async settleStrandedSeries(): Promise<void> {
    const completedDays = await this.shiftRepo.find({
      where: { status: ShiftStatus.COMPLETED, seriesId: Not(IsNull()) },
      relations: ['employer', 'assignedWorker'],
      order: { date: 'ASC' },
    });

    const bySeries = new Map<string, Shift[]>();
    for (const day of completedDays) {
      bySeries.set(day.seriesId!, [...(bySeries.get(day.seriesId!) ?? []), day]);
    }

    for (const days of bySeries.values()) {
      const last = days[days.length - 1]!;
      const worker = last.assignedWorker;
      if (!worker) continue;

      // Already settled? Then this series is done.
      if (await this.wagePayments.existsForShifts(days.map(d => d.id))) continue;

      const settlement = await this.resolveSeriesSettlement(last, worker.id);
      if (!settlement) continue; // days still pending — the normal path will settle it

      this.logger.log(
        `[Attendance] Settling stranded series ${last.seriesId} — ${days.length} day(s) worked, ${settlement.totalHours}h`,
      );
      this.settleJob(last, worker, settlement);
    }
  }

  /**
   * Everything that happens ONCE per job, when the last day has been worked:
   * the €3 platform fee, the wage payment / Pay Link covering every day, and
   * the two-way review prompts.
   * All steps are fire-and-forget — none may block or fail the completion.
   */
  private settleJob(
    shift: Shift,
    worker: Worker,
    settlement: { totalHours: number; title: string },
  ): void {
    // Fee is per JOB, not per day — a 5-day job is still one €3 fee.
    // The wage is paid directly company → worker, outside Turnos.
    this.payments.recordShiftFeeOnCheckout(
      shift.id,
      shift.employer.id,
      worker.id,
      settlement.totalHours,
      Number(shift.grossHourlyRate),
      shift.date,
      settlement.title,
    ).catch(err => {
      this.logger.warn(`[Attendance] Fee recording failed for shift ${shift.id}: ${(err as Error).message}`);
    });

    // One wage payment for the whole job, generated when the last day closes.
    this.wagePayments.createForShiftCompletion({
      shiftId:       shift.id,
      employerId:    shift.employer.id,
      workerId:      worker.id,
      amountEur:     settlement.totalHours * Number(shift.grossHourlyRate),
      paymentMethod: shift.paymentMethod ?? 'TRANSFERENCIA',
      shiftTitle:    settlement.title,
      shiftDate:     shift.date,
    }).catch(() => {});

    // Two-way review prompts: immediate push to the worker + +8h follow-ups
    // to whichever side hasn't rated yet (handled by RatingsService).
    this.notifications.notifyWorker(worker,
      { key: 'completedRate', params: { shift: shift.title || shift.subcategory } },
      { type: 'rate_employer', shiftId: shift.id }).catch(() => {});
    this.ratings.scheduleReviewFollowUps(shift.id, shift.title, shift.employer.id, worker.id)
      .catch(err => {
        this.logger.warn(`[Attendance] Failed to schedule review follow-ups: ${(err as Error).message}`);
      });
    // Completion rate and badges change with every completed job, not only
    // when a rating arrives.
    this.ratings.recalculateWorkerReputation(worker.id).catch(err => {
      this.logger.warn(`[Attendance] Reputation recalc failed for worker ${worker.id}: ${(err as Error).message}`);
    });
  }

  /**
   * Decide whether this completion settles the job, and with what totals.
   *
   * Single-day shift → settles immediately with its own hours.
   * Multi-day series → settles only once no day is still assigned to the
   * worker and pending (FILLED or ACTIVE). Hours are summed across every day
   * the worker actually worked, so a series cut short by a no-show still pays
   * correctly for the days completed.
   *
   * Returns null when days remain, meaning "not yet — defer settlement".
   */
  private async resolveSeriesSettlement(
    shift: Shift,
    workerId: string,
    ownHours?: number,
  ): Promise<{ totalHours: number; title: string } | null> {
    if (!shift.seriesId) {
      const hours = ownHours ?? Number(
        (await this.attendanceRepo.findOne({ where: { shift: { id: shift.id } } }))?.scheduledHours ?? 0,
      );
      return { totalHours: hours, title: shift.title };
    }

    const days = await this.shiftRepo.find({
      where: { seriesId: shift.seriesId },
      relations: ['assignedWorker'],
      order: { date: 'ASC' },
    });

    // Days still ahead of us for this worker — cancelled/reopened days don't count
    const stillPending = days.some(d =>
      d.assignedWorker?.id === workerId &&
      (d.status === ShiftStatus.FILLED || d.status === ShiftStatus.ACTIVE),
    );
    if (stillPending) return null;

    const worked = await this.attendanceRepo.find({
      where: {
        shift:  { id: In(days.map(d => d.id)) },
        worker: { id: workerId },
        // MANUAL = a day the company closed by hand; it was worked and is paid.
        status: In([AttendanceStatus.COMPLETED, AttendanceStatus.MANUAL]),
      },
    });
    const totalHours = worked.reduce((sum, a) => sum + Number(a.scheduledHours ?? 0), 0);
    const workedDates = days
      .filter(d => d.status === ShiftStatus.COMPLETED)
      .map(d => d.date);

    return {
      totalHours,
      title: `${shift.title} (${workedDates.length} dias · ${formatSeriesRange(workedDates)})`,
    };
  }

  /** Scheduled end datetime — handles overnight shifts (end < start ⇒ +1 day). */
  private scheduledEnd(shift: Shift): Date {
    const overnight = shift.endTime.slice(0, 5) <= shift.startTime.slice(0, 5);
    return lisbonDateTime(overnight ? nextDay(shift.date) : shift.date, shift.endTime);
  }

  // ── Manual override (employer) ────────────────────────────────────────────

  async manualConfirm(
    employerUserId: string,
    shiftId: string,
    note?: string,
  ): Promise<ShiftAttendance> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: employerUserId } } });
    if (!employer) throw new UnauthorizedException('Employer not found');

    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift)                          throw new NotFoundException(t('api.common.shiftNotFound'));
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if (![ShiftStatus.FILLED, ShiftStatus.ACTIVE].includes(shift.status) || shift.noShowReportedAt) {
      throw new BadRequestException(t('api.attendance.shiftClosed'));
    }

    return this.closeWithoutScan(shift, 'MANUAL', note ?? 'Confirmação manual pelo empregador');
  }

  /**
   * Complete a shift that has no automatic completion pending: the company's
   * "Concluído" (MANUAL), the worker's "I worked" on a shift nobody scanned
   * (WORKER), or 48h of silence on one (SILENCE). Runs the same settlement as
   * auto-completion — €3 fee, wage payment / Pay Link, review prompts.
   *
   * Until 2026-10-05 the manual path stopped at COMPLETED, so a shift the
   * company closed by hand produced no wage payment row, no reminders and no
   * fee (completeShift skips it too, because checkOutAt is already set).
   */
  private async closeWithoutScan(
    shift: Shift,
    trigger: 'MANUAL' | 'WORKER' | 'SILENCE',
    note: string,
  ): Promise<ShiftAttendance> {
    const worker = shift.assignedWorker!;
    let attendance = await this.attendanceRepo.findOne({ where: { shift: { id: shift.id } } });
    const scheduledHours = this.calcScheduledHours(shift.startTime, shift.endTime);

    if (!attendance) {
      attendance = this.attendanceRepo.create({
        shift:  { id: shift.id } as Shift,
        worker: { id: worker.id } as Worker,
      });
    }

    if (trigger === 'MANUAL') {
      attendance.checkInAt  = attendance.checkInAt ?? new Date();
      attendance.checkOutAt = new Date();
    } else {
      // Nobody scanned: no check-in time to record; the shift closes at its
      // scheduled end, which is also what the wage is computed from.
      attendance.checkOutAt = this.scheduledEnd(shift);
    }
    attendance.scheduledHours     = scheduledHours;
    // MANUAL = a day closed without a scan; it was worked and is paid.
    attendance.status             = AttendanceStatus.MANUAL;
    attendance.isManualOverride   = trigger === 'MANUAL';
    attendance.autoCompleted      = trigger === 'SILENCE';
    attendance.manualOverrideNote = note;

    const saved = await this.attendanceRepo.save(attendance);
    await this.shiftRepo.update(shift.id, { status: ShiftStatus.COMPLETED, autoConfirmAt: null });

    await this.compliance.log({
      event:      ComplianceEvent.CONTRACT_CREATED,
      shiftId:    shift.id,
      workerId:   worker.id,
      employerId: shift.employer.id,
      details:    { action: trigger === 'MANUAL' ? 'MANUAL_OVERRIDE' : `NO_SCAN_COMPLETED_${trigger}`, note, scheduledHours },
    });

    const settlement = await this.resolveSeriesSettlement(shift, worker.id, scheduledHours);
    if (settlement) this.settleJob(shift, worker, settlement);

    this.gateway.notifyAttendance(worker.id, {
      event:          'shift_completed',
      shiftId:        shift.id,
      shiftTitle:     shift.title,
      scheduledHours,
    });
    this.gateway.notifyAttendance(shift.employer.id, {
      event:          'checked_out',
      shiftId:        shift.id,
      shiftTitle:     shift.title,
      workerName:     worker.fullName ?? 'Trabalhador',
      checkOutAt:     saved.checkOutAt!.toISOString(),
      scheduledHours,
    });

    this.logger.log(`[Attendance] Closed without scan (${trigger}): shift ${shift.id}${settlement ? '' : ' — settlement deferred to the final series day'}`);
    return saved;
  }

  // ── Shifts nobody scanned ("to confirm") ──────────────────────────────────

  /**
   * Run by the 15-min sweep. A FILLED shift whose scheduled end has passed
   * had no check-in (a check-in makes it ACTIVE). First pass: ask both sides —
   * push to the worker ("did you work?"), email to the company — and set the
   * automatic completion UNCONFIRMED_AUTO_COMPLETE_HOURS out. Later passes:
   * complete it when that time comes and nobody has contested it.
   *
   * Never a no-show by default: that sanction stays the company's decision.
   */
  async sweepUnscannedShifts(): Promise<void> {
    const now = new Date();
    const filled = await this.shiftRepo.find({
      where: {
        status:           ShiftStatus.FILLED,
        date:             LessThanOrEqual(lisbonDate()),
        noShowReportedAt: IsNull(),
      },
      relations: ['employer', 'employer.user', 'assignedWorker'],
    });

    for (const shift of filled) {
      if (!shift.assignedWorker || this.scheduledEnd(shift) > now) continue;
      try {
        if (!shift.confirmRequestedAt) {
          await this.requestConfirmation(shift, now);
        } else if (shift.autoConfirmAt && shift.autoConfirmAt <= now) {
          await this.closeWithoutScan(shift, 'SILENCE',
            `Concluído automaticamente — ${UNCONFIRMED_AUTO_COMPLETE_HOURS}h sem objeção da empresa nem do trabalhador`);
        }
      } catch (err) {
        this.logger.error(`[Attendance] Unscanned-shift handling failed for ${shift.id}: ${(err as Error).message}`);
      }
    }
  }

  private async requestConfirmation(shift: Shift, now: Date): Promise<void> {
    const endedAt = this.scheduledEnd(shift);
    // Shifts that ended long before this rule existed: listed as "to confirm",
    // but no fee or payment ladder starts on its own, and nobody is messaged.
    const legacy = now.getTime() - endedAt.getTime() > UNCONFIRMED_BACKFILL_DAYS * DAY_MS;
    const autoConfirmAt = legacy ? null : new Date(now.getTime() + UNCONFIRMED_AUTO_COMPLETE_HOURS * HOUR_MS);
    await this.shiftRepo.update(shift.id, { confirmRequestedAt: now, autoConfirmAt });

    await this.compliance.log({
      event:      ComplianceEvent.CONTRACT_CREATED,
      shiftId:    shift.id,
      workerId:   shift.assignedWorker!.id,
      employerId: shift.employer.id,
      details:    { action: 'NO_SCAN_CONFIRMATION_REQUESTED', legacy, autoConfirmAt: autoConfirmAt?.toISOString() ?? null },
    });
    if (legacy) return;

    const title = shift.title || shift.subcategory;
    this.notifications.notifyWorker(shift.assignedWorker!,
      { key: 'confirmWorked', params: { shift: title } },
      { type: 'confirm_worked', shiftId: shift.id }).catch(() => {});

    const to = shift.employer.user?.email;
    if (to) {
      await this.sendConfirmationEmail(to, shift, autoConfirmAt!).catch(err => {
        this.logger.warn(`[Attendance] Confirmation email for shift ${shift.id} failed: ${(err as Error).message}`);
      });
    }
    this.logger.log(`[Attendance] Shift ${shift.id} ended without check-in — awaiting confirmation until ${autoConfirmAt!.toISOString()}`);
  }

  private async sendConfirmationEmail(to: string, shift: Shift, autoConfirmAt: Date): Promise<void> {
    const webUrl  = this.config.get<string>('WEB_ADMIN_URL', 'http://localhost:3000');
    const title   = escapeHtml(shift.title || shift.subcategory);
    const worker  = escapeHtml(shift.assignedWorker?.fullName ?? 'o trabalhador');
    const company = escapeHtml(shift.employer.companyName);
    const date    = ptDate(shift.date);
    const hours   = `${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}`;
    const until   = lisbonStamp(autoConfirmAt);
    const button  = (label: string) => `
      <p style="text-align:center;margin:24px 0">
        <a href="${webUrl}/dashboard/shifts"
           style="background:#6a79ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
          ${label}
        </a>
      </p>`;

    await this.mail.sendBilingual(to, {
      pt: {
        subject: `Confirme o turno "${shift.title || shift.subcategory}" (${date})`,
        html: `<p>Olá <strong>${company}</strong>,</p>
          <p>O turno <strong>"${title}"</strong> de ${date} (${hours}) com <strong>${worker}</strong> terminou sem check-in por QR code.</p>
          <p><strong>Se correu normalmente, não precisa de fazer nada:</strong> o turno fica concluído automaticamente a ${until} e o pagamento ao trabalhador passa a ser devido.</p>
          <p>Se o trabalhador faltou ou o turno não se realizou, indique-o antes disso na página Turnos.</p>
          ${button('Abrir Turnos')}`,
      },
      en: {
        subject: `Confirm the shift "${shift.title || shift.subcategory}" (${date})`,
        html: `<p>Hello <strong>${company}</strong>,</p>
          <p>The shift <strong>"${title}"</strong> on ${date} (${hours}) with <strong>${worker}</strong> ended without a QR check-in.</p>
          <p><strong>If it went normally, you don't need to do anything:</strong> it completes automatically on ${until} (Lisbon time) and the worker's payment becomes due.</p>
          <p>If the worker didn't turn up or the shift didn't take place, say so before then on the Shifts page.</p>
          ${button('Open Shifts')}`,
      },
    });
  }

  /**
   * The worker's answer to "did you work?". "Worked" completes the shift at
   * once — the company can still report a problem on the payment, which
   * pauses the reminders. "Didn't work" stops the automatic completion and
   * leaves the decision to the company.
   */
  async workerConfirm(workerUserId: string, shiftId: string, worked: boolean): Promise<{ status: string }> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } } });
    if (!worker) throw new UnauthorizedException('Worker not found');
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift || shift.assignedWorker?.id !== worker.id) throw new NotFoundException(t('api.common.shiftNotFound'));
    if (shift.status !== ShiftStatus.FILLED || !shift.confirmRequestedAt || shift.noShowReportedAt || shift.workerConfirmation) {
      throw new BadRequestException(t('api.attendance.notAwaitingConfirmation'));
    }

    if (worked) {
      await this.shiftRepo.update(shift.id, { workerConfirmation: 'WORKED' });
      await this.closeWithoutScan(shift, 'WORKER', 'Confirmado pelo trabalhador (sem check-in por QR)');
      return { status: ShiftStatus.COMPLETED };
    }

    await this.shiftRepo.update(shift.id, { workerConfirmation: 'NOT_WORKED', autoConfirmAt: null });
    await this.compliance.log({
      event:      ComplianceEvent.CONTRACT_CREATED,
      shiftId:    shift.id,
      workerId:   worker.id,
      employerId: shift.employer.id,
      details:    { action: 'NO_SCAN_WORKER_SAID_NOT_WORKED' },
    });
    return { status: ShiftStatus.FILLED };
  }

  /**
   * The company closes a shift nobody scanned as "didn't take place" — no fee,
   * no wage, no sanction. For when both sides agree it didn't happen; a
   * worker who simply didn't turn up is a no-show instead.
   */
  async markNotWorked(employerUserId: string, shiftId: string): Promise<{ status: string }> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: employerUserId } } });
    if (!employer) throw new UnauthorizedException('Employer not found');
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId }, relations: ['employer', 'assignedWorker'] });
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if (shift.status !== ShiftStatus.FILLED || !shift.confirmRequestedAt || shift.noShowReportedAt) {
      throw new BadRequestException(t('api.attendance.shiftClosed'));
    }

    await this.shiftRepo.update(shift.id, { status: ShiftStatus.CANCELLED, autoConfirmAt: null });
    await this.compliance.log({
      event:      ComplianceEvent.CONTRACT_CREATED,
      shiftId:    shift.id,
      workerId:   shift.assignedWorker?.id,
      employerId: employer.id,
      details:    { action: 'NO_SCAN_CLOSED_NOT_WORKED', workerConfirmation: shift.workerConfirmation },
    });
    if (shift.assignedWorker) {
      this.gateway.notifyAttendance(shift.assignedWorker.id, { event: 'shift_cancelled', shiftId: shift.id, shiftTitle: shift.title });
    }
    return { status: ShiftStatus.CANCELLED };
  }

  // ── Check-in reminders ────────────────────────────────────────────────────

  /**
   * Two pushes per confirmed shift, run every 5 min: CHECKIN_REMINDER_MINUTES
   * .before the start ("scan the QR when you arrive") and .after it if there is
   * still no check-in ("have you arrived?"). Counted on the shift so a restart
   * or an overlapping run never sends one twice.
   */
  async sendCheckInReminders(): Promise<void> {
    const now = Date.now();
    const today = lisbonDate();
    const shifts = await this.shiftRepo.find({
      where: { status: ShiftStatus.FILLED, date: today, checkInRemindersSent: LessThanOrEqual(1) },
      relations: ['employer', 'assignedWorker'],
    });

    for (const shift of shifts) {
      const worker = shift.assignedWorker;
      if (!worker) continue;
      const start = lisbonDateTime(shift.date, shift.startTime).getTime();
      const sent = shift.checkInRemindersSent ?? 0;
      const windowClosed = now > start + CHECKIN_WINDOW_AFTER_MS;
      if (windowClosed) continue;

      let key: 'checkInSoon' | 'checkInLate' | null = null;
      let minutes = 0;
      if (sent === 0 && now >= start - CHECKIN_REMINDER_MINUTES.before * MINUTE_MS && now < start) {
        key = 'checkInSoon'; minutes = Math.max(1, Math.round((start - now) / MINUTE_MS));
      } else if (sent <= 1 && now >= start + CHECKIN_REMINDER_MINUTES.after * MINUTE_MS) {
        key = 'checkInLate'; minutes = Math.round((now - start) / MINUTE_MS);
      }
      if (!key) continue;

      // Claim the slot first: only the run whose update matched sends.
      const claimed = await this.shiftRepo.update(
        { id: shift.id, checkInRemindersSent: sent },
        { checkInRemindersSent: key === 'checkInSoon' ? 1 : 2 },
      );
      if (!claimed.affected) continue;

      this.notifications.notifyWorker(worker,
        { key, params: { shift: shift.title || shift.subcategory, company: shift.employer.companyName, minutes } },
        { type: 'check_in', shiftId: shift.id }).catch(() => {});
    }
  }

  // ── Dispute ───────────────────────────────────────────────────────────────

  async raiseDispute(
    userId: string,
    role: 'WORKER' | 'EMPLOYER',
    shiftId: string,
    note: string,
  ): Promise<ShiftAttendance> {
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException(t('api.common.shiftNotFound'));

    const attendance = await this.attendanceRepo.findOne({ where: { shift: { id: shiftId } } });
    if (!attendance) throw new NotFoundException('No attendance record for this shift');
    if (attendance.status === AttendanceStatus.DISPUTED) {
      throw new BadRequestException(t('api.attendance.disputeExists'));
    }

    attendance.status          = AttendanceStatus.DISPUTED;
    attendance.disputeNote     = note;
    attendance.disputeRaisedBy = role;

    const saved = await this.attendanceRepo.save(attendance);
    this.logger.log(`[Attendance] Dispute raised on shift ${shiftId} by ${role}`);
    return saved;
  }

  // ── Get attendance status ─────────────────────────────────────────────────

  async getAttendance(shiftId: string): Promise<ShiftAttendance | null> {
    return this.attendanceRepo.findOne({
      where:     { shift: { id: shiftId } },
      relations: ['shift', 'worker'],
    });
  }

  // ── Private: find worker's shift at employer today ────────────────────────

  /**
   * Finds the worker's approved (FILLED or ACTIVE) shift at the given employer
   * for today's date. Throws a clear user-facing error if not found.
   */
  private async findWorkerShiftForEmployerToday(
    workerId: string,
    employerId: string,
  ): Promise<Shift> {
    const today = lisbonDate(); // Lisbon calendar day, not UTC's

    const shift = await this.shiftRepo.findOne({
      where: {
        date:           today,
        employer:       { id: employerId },
        assignedWorker: { id: workerId },
        status:         In([ShiftStatus.FILLED, ShiftStatus.ACTIVE]),
      },
      relations: ['employer', 'assignedWorker'],
      order:     { startTime: 'ASC' },
    });

    if (!shift) {
      throw new NotFoundException(
        t('api.attendance.noShiftHere'),
      );
    }

    return shift;
  }

  // ── Private: HMAC token (static, no expiry) ───────────────────────────────

  private signStaticToken(payload: StaticQrPayload): string {
    const data      = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(data)
      .digest('base64url');
    return `${data}.${signature}`;
  }

  private verifyStaticToken(token: string): StaticQrPayload {
    const parts = token.split('.');
    if (parts.length !== 2) throw new BadRequestException(t('api.attendance.qrInvalid'));

    const [data, signature] = parts as [string, string];
    const expectedSig = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(data)
      .digest('base64url');

    if (Buffer.from(signature).length !== Buffer.from(expectedSig).length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      throw new BadRequestException(t('api.attendance.qrTampered'));
    }

    try {
      return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as StaticQrPayload;
    } catch {
      throw new BadRequestException(t('api.attendance.qrInvalid'));
    }
  }

  // ── Private: time window enforcement ─────────────────────────────────────

  private assertCheckInWindow(shift: Shift): void {
    const [sh, sm] = shift.startTime.slice(0, 5).split(':').map(Number);
    const scheduledStart = lisbonDateTime(shift.date, shift.startTime);
    const windowStart    = new Date(scheduledStart.getTime() - CHECKIN_WINDOW_BEFORE_MS);
    const windowEnd      = new Date(scheduledStart.getTime() + CHECKIN_WINDOW_AFTER_MS);
    const now            = new Date();

    if (now < windowStart) {
      throw new BadRequestException(
        t('api.attendance.checkInTooEarly', {
          from:  tTime(windowStart),
          start: `${String(sh!).padStart(2,'0')}:${String(sm!).padStart(2,'0')}`,
        }),
      );
    }
    if (now > windowEnd) {
      throw new BadRequestException(
        t('api.attendance.checkInWindowOver'),
      );
    }
  }

  // v2.1: the check-out window assertion was removed along with the
  // check-out scan — shifts auto-complete at their scheduled end time.

  // ── Private: geofence (Haversine) ────────────────────────────────────────

  private assertGeofence(lat: number, lng: number, shift: Shift): void {
    // Use plain lat/lng columns (PostGIS removed — standard Postgres compatible)
    if (shift.lat == null || shift.lng == null) return; // No coords → skip
    const distM = this.haversineMetres(lat, lng, Number(shift.lat), Number(shift.lng));
    if (distM > GEOFENCE_RADIUS_M) {
      throw new BadRequestException(
        t('api.attendance.tooFarAway', {
          distance: Math.round(distM),
          radius:   GEOFENCE_RADIUS_M,
        }),
      );
    }
  }

  private haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R  = 6_371_000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ── Private: hours calculation ────────────────────────────────────────────

  private calcScheduledHours(startTime: string, endTime: string): number {
    const [sh, sm] = startTime.slice(0, 5).split(':').map(Number);
    const [eh, em] = endTime.slice(0, 5).split(':').map(Number);
    let hours = (eh! + em! / 60) - (sh! + sm! / 60);
    if (hours < 0) hours += 24; // overnight shift
    return Math.round(hours * 100) / 100;
  }
}

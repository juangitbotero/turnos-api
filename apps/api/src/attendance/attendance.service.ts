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
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { ShiftAttendance, AttendanceStatus } from './entities/shift-attendance.entity';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';
import { Worker } from '../users/entities/worker.entity';
import { Employer } from '../users/entities/employer.entity';
import { ShiftsGateway } from '../gateway/shifts.gateway';
import { ComplianceService } from '../compliance/compliance.service';
import { ComplianceEvent } from '../compliance/entities/compliance-audit-log.entity';
import { PaymentsService } from '../payments/payments.service';
import { RatingsService } from '../ratings/ratings.service';

// Check-in window: 30 min before → 60 min after scheduled start
const CHECKIN_WINDOW_BEFORE_MS = 30 * 60 * 1000;
const CHECKIN_WINDOW_AFTER_MS  = 60 * 60 * 1000;
// Check-out window: 30 min before → 2 h after scheduled end (unchanged)
const CHECKOUT_WINDOW_BEFORE_MS = 30 * 60 * 1000;
const CHECKOUT_WINDOW_AFTER_MS  =  2 * 60 * 60 * 1000;
// Geofence radius (metres)
const GEOFENCE_RADIUS_M = 200;

interface StaticQrPayload {
  employerId: string;
  action: 'in' | 'out';
  v: 1; // token version — allows future migration
}

export interface EmployerQrResult {
  checkInQrDataUrl:  string;
  checkOutQrDataUrl: string;
  checkInToken:      string;
  checkOutToken:     string;
  employerName:      string;
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

    private readonly gateway: ShiftsGateway,
    private readonly compliance: ComplianceService,
    private readonly payments: PaymentsService,
    private readonly ratings: RatingsService,
    private readonly config: ConfigService,
  ) {
    this.hmacSecret = this.config.get<string>('QR_HMAC_SECRET', 'turnos-dev-qr-secret-change-in-prod');
  }

  // ── Static QR generation (employer) ───────────────────────────────────────

  /**
   * Generate the employer's two permanent static QR codes: check-in and check-out.
   * These are deterministic — same inputs always produce the same QR.
   * The employer prints them once and posts them at their venue.
   */
  async getEmployerStaticQr(employerUserId: string): Promise<EmployerQrResult> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: employerUserId } } });
    if (!employer) throw new UnauthorizedException('Employer not found');

    const checkInToken  = this.signStaticToken({ employerId: employer.id, action: 'in',  v: 1 });
    const checkOutToken = this.signStaticToken({ employerId: employer.id, action: 'out', v: 1 });

    const qrOpts: QRCode.QRCodeToDataURLOptions = {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400,
      color: { dark: '#111827', light: '#ffffff' },
    };

    const [checkInQrDataUrl, checkOutQrDataUrl] = await Promise.all([
      QRCode.toDataURL(checkInToken,  qrOpts),
      QRCode.toDataURL(checkOutToken, qrOpts),
    ]);

    this.logger.log(`[Attendance] Static QR requested for employer ${employer.id}`);
    return { checkInQrDataUrl, checkOutQrDataUrl, checkInToken, checkOutToken, employerName: employer.companyName };
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
      throw new BadRequestException(
        'Digitalizou o QR de check-out. Por favor, use o QR de check-in (seta para cima ↑).',
      );
    }

    const shift = await this.findWorkerShiftForEmployerToday(worker.id, payload.employerId);
    if (shift.status !== ShiftStatus.FILLED) {
      throw new BadRequestException(
        shift.status === ShiftStatus.ACTIVE
          ? 'Já fez check-in neste turno.'
          : 'O turno não está disponível para check-in.',
      );
    }

    this.assertCheckInWindow(shift);
    this.assertGeofence(lat, lng, shift);

    // Idempotency guard
    const existing = await this.attendanceRepo.findOne({ where: { shift: { id: shift.id } } });
    if (existing?.checkInAt) throw new BadRequestException('Já fez check-in neste turno.');

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

    this.logger.log(`[Attendance] Check-in: worker ${worker.id} → shift ${shift.id} (${scheduledHours}h)`);
    return saved;
  }

  // ── Check-out (worker scans printed check-out QR) ─────────────────────────

  async checkOut(
    workerUserId: string,
    token: string,
    lat: number,
    lng: number,
  ): Promise<ShiftAttendance> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } } });
    if (!worker) throw new UnauthorizedException('Worker not found');

    const payload = this.verifyStaticToken(token);
    if (payload.action !== 'out') {
      throw new BadRequestException(
        'Digitalizou o QR de check-in. Por favor, use o QR de check-out (seta para baixo ↓).',
      );
    }

    const shift = await this.findWorkerShiftForEmployerToday(worker.id, payload.employerId);
    if (shift.status !== ShiftStatus.ACTIVE) {
      throw new BadRequestException(
        shift.status === ShiftStatus.FILLED
          ? 'Ainda não fez check-in. Por favor, faça check-in primeiro.'
          : 'O turno não está no estado correto para check-out.',
      );
    }

    const attendance = await this.attendanceRepo.findOne({ where: { shift: { id: shift.id } } });
    if (!attendance?.checkInAt) throw new BadRequestException('Não há check-in registado para este turno.');
    if (attendance.checkOutAt)  throw new BadRequestException('Já fez check-out neste turno.');

    this.assertCheckoutWindow(shift);
    this.assertGeofence(lat, lng, shift);

    attendance.checkOutAt  = new Date();
    attendance.checkOutLat = lat;
    attendance.checkOutLng = lng;
    attendance.status      = AttendanceStatus.COMPLETED;

    const saved = await this.attendanceRepo.save(attendance);
    await this.shiftRepo.update(shift.id, { status: ShiftStatus.COMPLETED });

    // Notify employer dashboard
    this.gateway.notifyAttendance(shift.employer.id, {
      event:          'checked_out',
      shiftId:        shift.id,
      shiftTitle:     shift.title,
      workerName:     worker.fullName ?? 'Trabalhador',
      checkOutAt:     saved.checkOutAt!.toISOString(),
      scheduledHours: Number(saved.scheduledHours),
    });
    // Notify worker app
    this.gateway.notifyAttendance(worker.id, {
      event:          'shift_completed',
      shiftId:        shift.id,
      shiftTitle:     shift.title,
      scheduledHours: Number(saved.scheduledHours),
    });

    // Charge employer + transfer worker payout (non-blocking, best-effort)
    this.payments.chargeShiftOnCheckout(
      shift.id,
      shift.employer.id,
      worker.id,
      Number(saved.scheduledHours),
      Number(shift.grossHourlyRate),
      shift.date,
      shift.title,
    ).catch(err => {
      this.logger.warn(`[Attendance] Payment charge failed for shift ${shift.id}: ${(err as Error).message}`);
    });

    // Schedule Recibo Verde push reminders (non-blocking, best-effort)
    this.compliance.onShiftCompleted(shift, worker).catch(err => {
      this.logger.warn(`[Attendance] Failed to schedule Recibo Verde reminders: ${(err as Error).message}`);
    });

    // Schedule 30-min rating reminder email to employer (non-blocking, best-effort)
    this.ratings.scheduleRatingReminder(shift.id, shift.title, shift.employer.id).catch(err => {
      this.logger.warn(`[Attendance] Failed to schedule rating reminder: ${(err as Error).message}`);
    });

    this.logger.log(`[Attendance] Check-out: worker ${worker.id} → shift ${shift.id} — ${saved.scheduledHours}h`);
    return saved;
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
    if (!shift)                          throw new NotFoundException('Shift not found');
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if (![ShiftStatus.FILLED, ShiftStatus.ACTIVE].includes(shift.status)) {
      throw new BadRequestException('Turno já concluído ou cancelado');
    }

    let attendance = await this.attendanceRepo.findOne({ where: { shift: { id: shiftId } } });
    const scheduledHours = this.calcScheduledHours(shift.startTime, shift.endTime);

    if (!attendance) {
      attendance = this.attendanceRepo.create({
        shift:  { id: shift.id } as Shift,
        worker: { id: shift.assignedWorker!.id } as Worker,
      });
    }

    attendance.checkInAt          = attendance.checkInAt ?? new Date();
    attendance.checkOutAt         = new Date();
    attendance.scheduledHours     = scheduledHours;
    attendance.status             = AttendanceStatus.MANUAL;
    attendance.isManualOverride   = true;
    attendance.manualOverrideNote = note ?? 'Confirmação manual pelo empregador';

    const saved = await this.attendanceRepo.save(attendance);
    await this.shiftRepo.update(shift.id, { status: ShiftStatus.COMPLETED });

    await this.compliance.log({
      event:      ComplianceEvent.CONTRACT_CREATED,
      shiftId:    shift.id,
      employerId: employer.id,
      details:    { action: 'MANUAL_OVERRIDE', note, scheduledHours },
    });

    this.logger.log(`[Attendance] Manual confirm: shift ${shift.id} by employer ${employer.id}`);
    return saved;
  }

  // ── Dispute ───────────────────────────────────────────────────────────────

  async raiseDispute(
    userId: string,
    role: 'WORKER' | 'EMPLOYER',
    shiftId: string,
    note: string,
  ): Promise<ShiftAttendance> {
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Shift not found');

    const attendance = await this.attendanceRepo.findOne({ where: { shift: { id: shiftId } } });
    if (!attendance) throw new NotFoundException('No attendance record for this shift');
    if (attendance.status === AttendanceStatus.DISPUTED) {
      throw new BadRequestException('Já existe uma disputa registada neste turno');
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
    // Use UTC date — acceptable for Lisbon beta; proper TZ handling in v1.1
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

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
        'Não tem nenhum turno confirmado neste local para hoje. ' +
        'Verifique se está no local correto ou contacte o empregador.',
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
    if (parts.length !== 2) throw new BadRequestException('QR code inválido');

    const [data, signature] = parts as [string, string];
    const expectedSig = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(data)
      .digest('base64url');

    if (Buffer.from(signature).length !== Buffer.from(expectedSig).length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      throw new BadRequestException('QR code inválido ou adulterado');
    }

    try {
      return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as StaticQrPayload;
    } catch {
      throw new BadRequestException('QR code inválido');
    }
  }

  // ── Private: time window enforcement ─────────────────────────────────────

  private assertCheckInWindow(shift: Shift): void {
    const [sh, sm] = shift.startTime.slice(0, 5).split(':').map(Number);
    const scheduledStart = new Date(`${shift.date}T${String(sh!).padStart(2,'0')}:${String(sm!).padStart(2,'0')}:00`);
    const windowStart    = new Date(scheduledStart.getTime() - CHECKIN_WINDOW_BEFORE_MS);
    const windowEnd      = new Date(scheduledStart.getTime() + CHECKIN_WINDOW_AFTER_MS);
    const now            = new Date();

    if (now < windowStart) {
      throw new BadRequestException(
        `Check-in disponível a partir das ${windowStart.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}. ` +
        `O turno começa às ${String(sh!).padStart(2,'0')}:${String(sm!).padStart(2,'0')}.`,
      );
    }
    if (now > windowEnd) {
      throw new BadRequestException(
        'A janela de check-in expirou (mais de 1h após o início do turno). ' +
        'Contacte o empregador para confirmação manual.',
      );
    }
  }

  private assertCheckoutWindow(shift: Shift): void {
    const [eh, em] = shift.endTime.slice(0, 5).split(':').map(Number);
    const scheduledEnd = new Date(`${shift.date}T${String(eh!).padStart(2,'0')}:${String(em!).padStart(2,'0')}:00`);
    const windowStart  = new Date(scheduledEnd.getTime() - CHECKOUT_WINDOW_BEFORE_MS);
    const windowEnd    = new Date(scheduledEnd.getTime() + CHECKOUT_WINDOW_AFTER_MS);
    const now          = new Date();

    if (now < windowStart) {
      throw new BadRequestException(
        `Ainda é cedo para fazer check-out. Disponível a partir das ` +
        `${windowStart.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}.`,
      );
    }
    if (now > windowEnd) {
      throw new BadRequestException(
        'A janela de check-out expirou (mais de 2h após o fim do turno). ' +
        'Contacte o empregador para confirmação manual.',
      );
    }
  }

  // ── Private: geofence (Haversine) ────────────────────────────────────────

  private assertGeofence(lat: number, lng: number, shift: Shift): void {
    if (!shift.location?.coordinates) return; // No PostGIS coords → skip gracefully
    const [shiftLng, shiftLat] = shift.location.coordinates as [number, number];
    const distM = this.haversineMetres(lat, lng, shiftLat, shiftLng);
    if (distM > GEOFENCE_RADIUS_M) {
      throw new BadRequestException(
        `Está a ${Math.round(distM)}m do local do turno. ` +
        `Deve estar a menos de ${GEOFENCE_RADIUS_M}m para fazer check-in/out.`,
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

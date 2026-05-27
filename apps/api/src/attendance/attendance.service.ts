import {
  Injectable, BadRequestException,
  NotFoundException, UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

// QR token valid for 30 seconds
const QR_TOKEN_TTL_MS = 30_000;
// Check-out must happen within this window of shift end time
const CHECKOUT_WINDOW_BEFORE_MS  = 30  * 60 * 1000; // 30 min before scheduled end
const CHECKOUT_WINDOW_AFTER_MS   = 2   * 60 * 60 * 1000; // 2 hours after scheduled end
// Geofence radius in metres
const GEOFENCE_RADIUS_M = 200;

interface QrPayload {
  shiftId:  string;
  workerId: string;
  iat:      number; // issued at (ms)
  exp:      number; // expires at (ms)
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
    private readonly config: ConfigService,
  ) {
    this.hmacSecret = this.config.get<string>('QR_HMAC_SECRET', 'turnos-dev-qr-secret-change-in-prod');
  }

  // ── QR generation (employer) ───────────────────────────────────────────────

  /**
   * Generate a fresh QR token valid for 30 seconds.
   * Returns the raw token string + a PNG data-URL for display.
   * Call every 25s on the employer dashboard to keep it fresh.
   */
  async generateQr(
    employerUserId: string,
    shiftId: string,
  ): Promise<{ token: string; qrDataUrl: string; expiresAt: number }> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: employerUserId } } });
    if (!employer) throw new UnauthorizedException('Employer not found');

    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.employer.id !== employer.id) throw new UnauthorizedException('Not your shift');
    if (![ShiftStatus.FILLED, ShiftStatus.ACTIVE].includes(shift.status)) {
      throw new BadRequestException('QR only available for confirmed or active shifts');
    }
    if (!shift.assignedWorker) throw new BadRequestException('No worker assigned to this shift');

    const now = Date.now();
    const payload: QrPayload = {
      shiftId,
      workerId: shift.assignedWorker.id,
      iat: now,
      exp: now + QR_TOKEN_TTL_MS,
    };

    const token     = this.signToken(payload);
    const qrDataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: { dark: '#111827', light: '#ffffff' },
    });

    return { token, qrDataUrl, expiresAt: payload.exp };
  }

  // ── Check-in (worker) ─────────────────────────────────────────────────────

  async checkIn(
    workerUserId: string,
    token: string,
    lat: number,
    lng: number,
  ): Promise<ShiftAttendance> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } } });
    if (!worker) throw new UnauthorizedException('Worker not found');

    const payload = this.verifyToken(token);

    // Must be the assigned worker
    if (payload.workerId !== worker.id) {
      throw new BadRequestException('Este QR code não é para si');
    }

    const shift = await this.shiftRepo.findOne({
      where: { id: payload.shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status !== ShiftStatus.FILLED) {
      throw new BadRequestException('O turno não está no estado correto para check-in');
    }

    // Geofence check
    this.assertGeofence(lat, lng, shift);

    // Idempotency — already checked in?
    const existing = await this.attendanceRepo.findOne({
      where: { shift: { id: shift.id } },
    });
    if (existing?.checkInAt) {
      throw new BadRequestException('Já fez check-in neste turno');
    }

    const scheduledHours = this.calcScheduledHours(shift.startTime, shift.endTime);

    // Create or update attendance record
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

    // Shift → ACTIVE
    await this.shiftRepo.update(shift.id, { status: ShiftStatus.ACTIVE });

    // WebSocket: notify employer dashboard
    this.gateway.notifyAttendance(shift.employer.id, {
      event:     'checked_in',
      shiftId:   shift.id,
      shiftTitle: shift.title,
      workerName: worker.fullName ?? 'Trabalhador',
      checkInAt:  saved.checkInAt!.toISOString(),
    });

    // Audit log
    await this.compliance.log({
      event:     ComplianceEvent.CONTRACT_CREATED, // reuse as attendance marker — will add own event in next stint
      shiftId:   shift.id,
      workerId:  worker.id,
      employerId: shift.employer.id,
      details:   { action: 'CHECK_IN', lat, lng, scheduledHours },
    });

    this.logger.log(`[Attendance] Check-in: worker ${worker.id} shift ${shift.id}`);
    return saved;
  }

  // ── Check-out (worker) ────────────────────────────────────────────────────

  async checkOut(
    workerUserId: string,
    token: string,
    lat: number,
    lng: number,
  ): Promise<ShiftAttendance> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } } });
    if (!worker) throw new UnauthorizedException('Worker not found');

    const payload = this.verifyToken(token);

    if (payload.workerId !== worker.id) {
      throw new BadRequestException('Este QR code não é para si');
    }

    const shift = await this.shiftRepo.findOne({
      where: { id: payload.shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status !== ShiftStatus.ACTIVE) {
      throw new BadRequestException('O turno não está no estado correto para check-out');
    }

    const attendance = await this.attendanceRepo.findOne({
      where: { shift: { id: shift.id } },
    });
    if (!attendance?.checkInAt) {
      throw new BadRequestException('Não há check-in registado para este turno');
    }
    if (attendance.checkOutAt) {
      throw new BadRequestException('Já fez check-out neste turno');
    }

    // Validate checkout window (shift end - 30min to shift end + 2h)
    this.assertCheckoutWindow(shift);

    // Geofence check
    this.assertGeofence(lat, lng, shift);

    attendance.checkOutAt  = new Date();
    attendance.checkOutLat = lat;
    attendance.checkOutLng = lng;
    attendance.status      = AttendanceStatus.COMPLETED;

    const saved = await this.attendanceRepo.save(attendance);

    // Shift → COMPLETED
    await this.shiftRepo.update(shift.id, { status: ShiftStatus.COMPLETED });

    // WebSocket: notify both employer + worker
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

    this.logger.log(`[Attendance] Check-out: worker ${worker.id} shift ${shift.id} — ${saved.scheduledHours}h scheduled`);
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
    if (!shift) throw new NotFoundException('Shift not found');
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
      event:     ComplianceEvent.CONTRACT_CREATED,
      shiftId:   shift.id,
      employerId: employer.id,
      details:   { action: 'MANUAL_OVERRIDE', note, scheduledHours },
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

  // ── Get status ────────────────────────────────────────────────────────────

  async getAttendance(shiftId: string): Promise<ShiftAttendance | null> {
    return this.attendanceRepo.findOne({
      where:     { shift: { id: shiftId } },
      relations: ['shift', 'worker'],
    });
  }

  // ── QR token helpers ──────────────────────────────────────────────────────

  private signToken(payload: QrPayload): string {
    const data      = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(data)
      .digest('base64url');
    return `${data}.${signature}`;
  }

  private verifyToken(token: string): QrPayload {
    const parts = token.split('.');
    if (parts.length !== 2) throw new BadRequestException('QR code inválido');

    const [data, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(data)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      throw new BadRequestException('QR code inválido ou adulterado');
    }

    let payload: QrPayload;
    try {
      payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as QrPayload;
    } catch {
      throw new BadRequestException('QR code inválido');
    }

    if (Date.now() > payload.exp) {
      throw new BadRequestException('QR code expirado. Peça ao empregador para atualizar o ecrã.');
    }

    return payload;
  }

  // ── Geofence (Haversine) ──────────────────────────────────────────────────

  private assertGeofence(lat: number, lng: number, shift: Shift): void {
    // If no PostGIS coords stored on shift, skip geofence (graceful degradation)
    if (!shift.location?.coordinates) return;

    const [shiftLng, shiftLat] = shift.location.coordinates as [number, number];
    const distM = this.haversineMetres(lat, lng, shiftLat, shiftLng);

    if (distM > GEOFENCE_RADIUS_M) {
      throw new BadRequestException(
        `Está a ${Math.round(distM)}m do local do turno. ` +
        `Deve estar a menos de ${GEOFENCE_RADIUS_M}m para fazer check-in.`,
      );
    }
  }

  private haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R  = 6_371_000; // Earth radius metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ── Checkout window validation ────────────────────────────────────────────

  private assertCheckoutWindow(shift: Shift): void {
    const [eh, em] = shift.endTime.slice(0, 5).split(':').map(Number);
    const scheduledEnd = new Date(`${shift.date}T${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}:00`);
    const windowStart  = new Date(scheduledEnd.getTime() - CHECKOUT_WINDOW_BEFORE_MS);
    const windowEnd    = new Date(scheduledEnd.getTime() + CHECKOUT_WINDOW_AFTER_MS);
    const now          = new Date();

    if (now < windowStart) {
      throw new BadRequestException(
        `Ainda é cedo para fazer check-out. Disponível a partir de ${windowStart.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}.`,
      );
    }
    if (now > windowEnd) {
      throw new BadRequestException(
        'A janela de check-out expirou (mais de 2h após o fim do turno). Contacte o empregador para confirmação manual.',
      );
    }
  }

  // ── Hours calculation ─────────────────────────────────────────────────────

  private calcScheduledHours(startTime: string, endTime: string): number {
    const [sh, sm] = startTime.slice(0, 5).split(':').map(Number);
    const [eh, em] = endTime.slice(0, 5).split(':').map(Number);
    let hours = (eh + em / 60) - (sh + sm / 60);
    if (hours < 0) hours += 24;
    return Math.round(hours * 100) / 100;
  }
}

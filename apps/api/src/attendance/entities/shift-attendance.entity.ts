import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToOne, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Shift } from '../../shifts/entities/shift.entity';
import { Worker } from '../../users/entities/worker.entity';

export enum AttendanceStatus {
  PENDING     = 'PENDING',      // Confirmed shift, no check-in yet
  CHECKED_IN  = 'CHECKED_IN',   // Worker scanned QR at start
  COMPLETED   = 'COMPLETED',    // Shift ended (auto-completed at scheduled end since v2.1)
  DISPUTED    = 'DISPUTED',     // Flagged by worker or employer
  MANUAL      = 'MANUAL',       // Employer used manual override
  NO_SHOW     = 'NO_SHOW',      // Worker never checked in (set by scheduled job)
}

/**
 * ShiftAttendance — one record per confirmed (FILLED) shift.
 *
 * v2.1 (check-in only): the worker scans a single QR at the start. The shift
 * auto-completes at its scheduled end time — there is no check-out scan.
 * checkOutAt is set to the scheduled end (autoCompleted = true) or by the
 * employer's manual override. Legacy rows keep their real scan-out data.
 *
 * IMPORTANT: Payment is always calculated from the scheduled shift hours
 * (shift.startTime → shift.endTime), NOT from scan timestamps. The check-in
 * proves the worker showed up; problems at the end of a shift are handled by
 * the employer's "Ajustar horas / Reportar problema" flow before paying.
 */
@Entity('shift_attendance')
export class ShiftAttendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Shift, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  shift: Shift;

  @ManyToOne(() => Worker, { nullable: false })
  @JoinColumn()
  worker: Worker;

  // ── Check-in ──────────────────────────────────────────────────────────────
  @Column({ type: 'timestamp', nullable: true })
  checkInAt: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  checkInLat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  checkInLng: number | null;

  // ── Check-out ─────────────────────────────────────────────────────────────
  @Column({ type: 'timestamp', nullable: true })
  checkOutAt: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  checkOutLat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  checkOutLng: number | null;

  // ── Payment basis (always scheduled hours — never QR delta) ───────────────
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  scheduledHours: number | null;  // populated on check-in from shift start/end times

  // ── Status & overrides ────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: AttendanceStatus, default: AttendanceStatus.PENDING })
  status: AttendanceStatus;

  @Column({ type: 'boolean', default: false })
  autoCompleted: boolean;         // true when completed by the scheduled-end job (no scan)

  @Column({ type: 'boolean', default: false })
  isManualOverride: boolean;      // true when employer used manual confirm

  @Column({ type: 'varchar', length: 512, nullable: true })
  manualOverrideNote: string | null;

  @Column({ type: 'text', nullable: true })
  disputeNote: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  disputeRaisedBy: 'WORKER' | 'EMPLOYER' | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

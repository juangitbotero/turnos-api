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
  COMPLETED   = 'COMPLETED',    // Worker scanned QR at end — triggers payment
  DISPUTED    = 'DISPUTED',     // Flagged by worker or employer
  MANUAL      = 'MANUAL',       // Employer used manual override
  NO_SHOW     = 'NO_SHOW',      // Worker never checked in (set by scheduled job)
}

/**
 * ShiftAttendance — one record per confirmed (FILLED) shift.
 *
 * IMPORTANT: Payment is always calculated from the scheduled shift hours
 * (shift.startTime → shift.endTime), NOT from the delta between checkInAt
 * and checkOutAt. The QR scans are attendance proof only — they confirm the
 * worker showed up and completed the shift. Any extra time worked beyond the
 * agreed hours is handled between employer and worker outside the platform.
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

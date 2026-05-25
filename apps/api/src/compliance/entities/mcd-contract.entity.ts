import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Shift } from '../../shifts/entities/shift.entity';
import { Worker } from '../../users/entities/worker.entity';
import { Employer } from '../../users/entities/employer.entity';

export enum SsStatus {
  PENDING    = 'PENDING',     // Contract created, notification not yet sent
  EMAIL_SENT = 'EMAIL_SENT', // Option C (beta): email sent to employer's accountant
  SUBMITTED  = 'SUBMITTED',  // Future: direct SS Direta API submission
  FAILED     = 'FAILED',     // All retries exhausted
}

/**
 * MCD Contract — created for every confirmed shift (employer selects a worker).
 * Stores an immutable snapshot of the contract data at time of creation so any
 * future edit to the shift does not retroactively change the legal record.
 */
@Entity('mcd_contracts')
export class McdContract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Shift, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  shift: Shift;

  @ManyToOne(() => Worker, { nullable: false })
  @JoinColumn()
  worker: Worker;

  @ManyToOne(() => Employer, { nullable: false })
  @JoinColumn()
  employer: Employer;

  // ── Immutable contract snapshot ───────────────────────────────────────────
  @Column({ type: 'varchar', length: 255 })
  workerName: string;

  @Column({ type: 'varchar', length: 9 })
  workerNif: string;

  @Column({ type: 'varchar', length: 255 })
  employerName: string;

  @Column({ type: 'varchar', length: 9 })
  employerNipc: string;

  @Column({ type: 'varchar', length: 100 })
  shiftDate: string;           // YYYY-MM-DD

  @Column({ type: 'varchar', length: 8 })
  startTime: string;           // HH:mm

  @Column({ type: 'varchar', length: 8 })
  endTime: string;             // HH:mm

  @Column({ type: 'varchar', length: 255, nullable: true })
  role: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  grossHourlyRate: number;

  @Column({ type: 'varchar', length: 512 })
  address: string;

  // ── SS Direta notification status ─────────────────────────────────────────
  @Column({ type: 'enum', enum: SsStatus, default: SsStatus.PENDING })
  ssStatus: SsStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ssAccountantEmail: string | null;  // Email of accountant who receives the notification

  @Column({ type: 'timestamp', nullable: true })
  ssEmailSentAt: Date | null;

  @Column({ type: 'int', default: 0 })
  ssRetryCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

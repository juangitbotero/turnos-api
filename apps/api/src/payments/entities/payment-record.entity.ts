import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum PaymentStatus {
  PENDING     = 'PENDING',
  SUCCEEDED   = 'SUCCEEDED',
  FAILED      = 'FAILED',
  REFUNDED    = 'REFUNDED',
  CANCELLED   = 'CANCELLED',
}

export enum PaymentType {
  SHIFT_CHARGE       = 'SHIFT_CHARGE',        // Employer charged for completed shift
  WORKER_PAYOUT      = 'WORKER_PAYOUT',        // Worker paid via Stripe Connect
  CANCELLATION_FEE   = 'CANCELLATION_FEE',     // 15% fee on late cancellation
  WORKER_COMPENSATION = 'WORKER_COMPENSATION', // 4% portion of cancellation fee to worker
  SUBSCRIPTION       = 'SUBSCRIPTION',         // Monthly platform subscription
}

/**
 * Immutable payment ledger — one record per financial event.
 * Used for the spending dashboard, worker earnings, and accounting exports.
 */
@Entity('payment_records')
export class PaymentRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  shiftId: string | null;

  @Column({ type: 'varchar', nullable: true })
  employerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  workerId: string | null;

  @Column({ type: 'enum', enum: PaymentType })
  type: PaymentType;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  // Financial values — all in EUR cents stored as decimal(10,2)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  grossAmount: number;               // Full shift gross value

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  turnosFee: number;                 // 10% Turnos platform fee

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  workerNet: number;                 // Amount sent to worker (gross - turnosFee)

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  employerTsu: number;               // 23.75% TSU — employer owes to government (informational)

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  workerTsu: number;                 // 11% TSU — worker owes to government (informational)

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  scheduledHours: number;            // Hours the shift was agreed for

  // Stripe references
  @Column({ type: 'varchar', nullable: true })
  stripePaymentIntentId: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripeTransferId: string | null;   // Transfer to worker Connect account

  @Column({ type: 'varchar', nullable: true })
  stripeChargeId: string | null;

  @Column({ type: 'varchar', nullable: true })
  payslipUrl: string | null;         // PDF payslip URL (Cloudflare R2 or local)

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  shiftDate: string | null;          // YYYY-MM-DD — for period grouping in dashboards

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

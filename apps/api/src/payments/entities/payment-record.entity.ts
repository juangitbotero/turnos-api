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
  SHIFT_FEE          = 'SHIFT_FEE',            // Fixed platform fee (company-side) per completed shift
  CANCELLATION_FEE   = 'CANCELLATION_FEE',     // 10% fee on late cancellation (≤24h), company-side
  SUBSCRIPTION       = 'SUBSCRIPTION',         // Monthly platform subscription
  // Legacy types from the pre-2026-07 model (Turnos held wage custody).
  // Kept so historical rows remain readable; no new records are created with these.
  SHIFT_CHARGE       = 'SHIFT_CHARGE',         // (legacy) Employer charged full gross via Turnos
  WORKER_PAYOUT      = 'WORKER_PAYOUT',        // (legacy) Worker paid via Stripe Connect transfer
  WORKER_COMPENSATION = 'WORKER_COMPENSATION', // (legacy) 4% cancellation share to worker
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

  // Financial values — all in EUR stored as decimal(10,2).
  // Since 2026-07 the wage itself never passes through Turnos: grossAmount /
  // workerNet / TSU columns are informative (what the company owes the worker
  // and the State); only turnosFee and subscription amounts are actually billed.
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  grossAmount: number;               // Full shift gross value (informative for SHIFT_FEE rows)

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  turnosFee: number;                 // Fixed platform fee billed to the company (€3 Starter / €2 Pro)

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  workerNet: number;                 // Informative: gross - worker TSU (company pays worker directly)

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

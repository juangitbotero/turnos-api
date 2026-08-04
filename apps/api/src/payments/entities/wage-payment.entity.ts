import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum WagePaymentType {
  SHIFT_COMPLETION     = 'SHIFT_COMPLETION',     // Wage owed for a completed shift
  CANCELLATION_MINIMUM = 'CANCELLATION_MINIMUM', // 2h-minimum owed after <3h unjustified company cancellation
}

export enum WagePaymentStatus {
  PENDING          = 'PENDING',          // Awaiting payment (Pay Link generated or manual method)
  PAID             = 'PAID',             // Confirmed via Stripe webhook (Pay Link)
  MARKED_PAID      = 'MARKED_PAID',      // Employer declared paid (manual method) — awaiting worker confirmation
  CONFIRMED        = 'CONFIRMED',        // Worker confirmed receipt (manual method)
  DISPUTED         = 'DISPUTED',         // Worker flagged "não recebi" after employer marked paid / deadline passed
  UNDER_REVIEW     = 'UNDER_REVIEW',     // Cancellation justification pending ops decision (no payment due yet)
  WAIVED           = 'WAIVED',           // Ops accepted the company's justification — nothing due
}

/**
 * Tracks the wage the company owes the worker for one shift (or the 2h
 * cancellation minimum). The money itself NEVER passes through Turnos:
 * Pay Link settles as a direct charge on the worker's Stripe Connect
 * account; manual methods are confirmed via the mark-paid / "Recebi" loop.
 */
@Entity('wage_payments')
@Index(['employerId', 'status'])
export class WagePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  @Index()
  shiftId: string;

  @Column({ type: 'varchar' })
  employerId: string;

  @Column({ type: 'varchar' })
  workerId: string;

  @Column({ type: 'enum', enum: WagePaymentType, default: WagePaymentType.SHIFT_COMPLETION })
  type: WagePaymentType;

  @Column({ type: 'enum', enum: WagePaymentStatus, default: WagePaymentStatus.PENDING })
  status: WagePaymentStatus;

  // ── Amounts (EUR) ──────────────────────────────────────────────────────────
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;                    // Wage the worker receives (full gross)

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  processingFee: number;             // Estimated Stripe fee grossed-up on top — paid by the company

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  stripeFeeActual: number | null;    // Real fee from the balance transaction (set on webhook)

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  netReceived: number | null;        // What actually landed in the worker's balance (set on webhook)

  // ── Payment channel ────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 20 })
  paymentMethod: string;             // PaymentMethod from @turnos/shared (chosen at publish)

  @Column({ type: 'varchar', length: 1024, nullable: true })
  payLinkUrl: string | null;         // Stripe Checkout URL (TURNOS_PAY_LINK only)

  @Column({ type: 'varchar', nullable: true })
  stripeCheckoutSessionId: string | null;

  /**
   * Proof of payment uploaded by the company for a manual method
   * (transferência / MB WAY) — bank receipt or app screenshot. Null when the
   * company declared the payment without evidence; see paymentProofNote.
   */
  @Column({ type: 'varchar', length: 512, nullable: true })
  paymentProofUrl: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  paymentProofNote: string | null;   // Reason given when marking paid with no proof

  // ── Cancellation context ───────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 40, nullable: true })
  cancellationReason: string | null; // Category selected by the employer at cancel time

  @Column({ type: 'varchar', length: 500, nullable: true })
  cancellationNote: string | null;

  // ── Trust loop timestamps ──────────────────────────────────────────────────
  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;               // Webhook confirmation or employer mark-paid time

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;          // Worker "Recebi" time

  @Column({ type: 'int', default: 0 })
  remindersSent: number;             // 0..3 — reminder ladder position

  // Shift display context (denormalized for emails/dashboards)
  @Column({ type: 'varchar', length: 255 })
  shiftTitle: string;

  @Column({ type: 'varchar', nullable: true })
  shiftDate: string | null;          // YYYY-MM-DD

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

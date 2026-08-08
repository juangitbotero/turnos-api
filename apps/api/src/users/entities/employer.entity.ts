import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionTier } from '@turnos/shared';
import { User } from './user.entity';

@Entity('employers')
export class Employer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.employerProfile, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  // ── Company Identity ──────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 255 })
  companyName: string;

  @Column({ type: 'varchar', length: 9, unique: true })
  nipc: string;                     // Portuguese NIPC (9 digits)

  @Column({ type: 'varchar', length: 9, nullable: true })
  nif?: string;                     // Optional NIF of the company representative

  @Column({ type: 'varchar', length: 100, nullable: true })
  sector?: string;                  // e.g. 'Restauração', 'Hotelaria', 'Eventos'

  @Column({ type: 'varchar', length: 512, nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  postalCode?: string;              // Portuguese postal code: XXXX-XXX

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  logoUrl?: string;

  // ── Compliance ────────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 255, nullable: true })
  accountantEmail?: string;         // Email of employer's accountant for SS Direta notifications

  /**
   * Which optional emails this company wants.
   *
   * Only covers mail a company can reasonably live without. Deliberately NOT
   * here: the email-verification link (transactional), the Segurança Social
   * notification (a legal obligation, and it goes to the accountant anyway),
   * and the FINAL unpaid-wage warning — that one precedes posting being
   * blocked, so silencing it would let a company be locked out with no notice.
   *
   * Absent (legacy rows) means "everything on" — see notificationPrefsOf().
   */
  @Column({ type: 'jsonb', nullable: true })
  notificationPrefs?: { ratingReminders?: boolean; wageReminders?: boolean } | null;

  // ── Billing & Subscription ────────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: ['NONE', 'STARTER', 'PRO', 'GROWTH', 'SCALE'], // GROWTH/SCALE legacy values, no longer assigned
    default: 'NONE',
  })
  subscriptionTier: SubscriptionTier;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;                // Activated after Turnos team review

  // ── Reliability (policy v1.1) ─────────────────────────────────────────────
  @Column({ type: 'int', default: 0 })
  lateCancellationCount: number;    // FILLED shifts cancelled <24h before start — internal metric

  // ── Stripe Connect ────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeCustomerId?: string;        // Stripe Customer ID (cus_...)

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeSubscriptionId?: string;    // Stripe Subscription ID (sub_...)

  @Column({
    type: 'enum',
    enum: ['INACTIVE', 'ACTIVE', 'PAST_DUE', 'CANCELLED'],
    default: 'INACTIVE',
  })
  subscriptionStatus: 'INACTIVE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripePaymentMethodId?: string;   // Default card for shift charges

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

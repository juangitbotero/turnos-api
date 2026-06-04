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

  // ── Billing & Subscription ────────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: ['NONE', 'STARTER', 'GROWTH', 'SCALE'],
    default: 'NONE',
  })
  subscriptionTier: SubscriptionTier;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;                // Activated after Turnos team review

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

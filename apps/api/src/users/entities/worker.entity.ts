import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkerStatus } from '@turnos/shared';
import { User } from './user.entity';

/**
 * Worker profile — linked 1:1 to User.
 * Status machine: INCOMPLETE → PENDING_REVIEW → ACTIVE | REJECTED | SUSPENDED
 */
@Entity('workers')
export class Worker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.workerProfile, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  // ── Identity ──────────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 255, nullable: true })
  fullName?: string;

  @Column({ type: 'varchar', length: 9, nullable: true })
  nif?: string;                     // Portuguese NIF (9 digits, validated)

  @Column({ type: 'varchar', length: 34, nullable: true })
  iban?: string;                    // IBAN for payouts (PT50... format)

  @Column({ type: 'varchar', length: 512, nullable: true })
  photoUrl?: string;                // Profile photo URL (Cloudflare R2)

  // ── Skills & Availability ─────────────────────────────────────────────────
  @Column({ type: 'simple-array', nullable: true })
  skills?: string[];                // e.g. ['Bartender', 'Waiter']

  @Column({ type: 'simple-array', nullable: true })
  availableDays?: string[];         // e.g. ['Mon', 'Tue', 'Fri']

  // ── Status & Trust ────────────────────────────────────────────────────────
  @Column({ type: 'boolean', default: false })
  isVerified: boolean;              // ID document verified by Turnos team

  @Column({
    type: 'enum',
    enum: ['INCOMPLETE', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED'],
    default: 'INCOMPLETE',
  })
  status: WorkerStatus;

  // ── Scoring ───────────────────────────────────────────────────────────────
  @Column({ type: 'int', default: 0 })
  profileQualityScore: number;      // 0–100: rule-based. Replaced by AI scorer in Stint 9.

  @Column({ type: 'int', default: 100 })
  reputationScore: number;          // 0–100: starts at 100, adjusted by ratings (Stint 7)

  // ── Push Notifications ────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 512, nullable: true })
  expoPushToken?: string;           // Expo push token for shift notifications

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  completionRate: number;           // 0.00–1.00

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

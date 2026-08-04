import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkerStatus, WorkerExperience } from '@turnos/shared';
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

  /**
   * When the worker consented to their IBAN being shown to companies they
   * worked a shift for, so those companies can pay the wage by transfer.
   * Null = no consent: the IBAN is never disclosed to an employer.
   * Timestamp rather than boolean — consent needs a date to be evidenced.
   */
  @Column({ type: 'timestamp', nullable: true })
  ibanShareConsentAt?: Date | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  photoUrl?: string;                // Profile photo URL (Cloudflare R2)

  // ── CV ────────────────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 512, nullable: true })
  cvUrl?: string;                   // PDF/DOC CV (R2 in prod, local disk in dev)

  @Column({ type: 'varchar', length: 255, nullable: true })
  cvFileName?: string;              // Original filename, shown in the UI

  @Column({ type: 'timestamp', nullable: true })
  cvUploadedAt?: Date | null;

  // ── Bio ───────────────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 200, nullable: true })
  bio?: string;                     // Short intro shown to employers (max 200 chars)

  // ── Skills & Availability ─────────────────────────────────────────────────
  @Column({ type: 'simple-array', nullable: true })
  skills?: string[];                // Aligned with SHIFT_CATEGORIES subcategories

  @Column({ type: 'simple-array', nullable: true })
  languages?: string[];             // e.g. ['Português', 'Inglês', 'Francês']

  /**
   * Master switch for the availability concept: is this worker currently open
   * to work at all? `availableDays` is the detail of WHEN — the two are one
   * concept, not two. Deliberately does NOT feed the profile score: switching
   * off is a normal state, not an incomplete profile, and must never drop a
   * worker under the 80-point gate needed to apply.
   * Defaults to true so existing workers stay visible in employer search.
   */
  @Column({ type: 'boolean', default: true })
  isAvailableForWork: boolean;

  @Column({ type: 'simple-array', nullable: true })
  availableDays?: string[];         // e.g. ['Seg', 'Ter', 'Sex']

  /**
   * Declared experience per job title — [{ jobTitle, level }]. jsonb rather
   * than a join table: it's only ever read as a whole with the profile, and
   * jobTitle values come from the shared JOB_TITLES list.
   */
  @Column({ type: 'jsonb', nullable: true })
  experiences?: WorkerExperience[];

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
  reputationScore: number;          // 0–100: avgRating × 20, updated by RatingsService

  // ── Ratings (Stint 7) ─────────────────────────────────────────────────────
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, default: null })
  avgRating: number | null;         // 1.00–5.00 rolling average; null until first rating

  @Column({ type: 'int', default: 0 })
  totalRatings: number;             // total number of employer ratings received

  @Column({ type: 'int', default: 0 })
  noShowCount: number;              // total no-show flags reported by employers

  @Column({ type: 'simple-array', nullable: true })
  badges: string[];                 // e.g. ['TOP_RATED', 'RELIABLE', 'VERIFIED']

  // ── Reliability enforcement ───────────────────────────────────────────────
  @Column({ type: 'simple-array', nullable: true })
  lateCancellations?: string[];     // ISO timestamps of confirmed-shift cancellations ≤24h before start

  @Column({ type: 'timestamp', nullable: true })
  suspendedUntil: Date | null;      // cannot apply until this date (strikes: 7d; no-show: 30d)

  @Column({ type: 'boolean', default: false })
  isBlocked: boolean;               // permanent block after 2nd no-show — cannot apply ever again

  // ── Stripe Connect ────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeAccountId?: string;         // Stripe Connect Express account ID (acct_...)

  // ── Push Notifications ────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 512, nullable: true })
  expoPushToken?: string;           // Expo push token for shift notifications

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  completionRate: number;           // 0.00–1.00

  // ── Compliance — Economic Dependency ──────────────────────────────────────
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  declaredExternalMonthlyIncome: number; // Self-declared monthly income outside Turnos (€)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

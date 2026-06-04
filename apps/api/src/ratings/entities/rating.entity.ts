import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Shift } from '../../shifts/entities/shift.entity';
import { User } from '../../users/entities/user.entity';
import { Worker } from '../../users/entities/worker.entity';
import { Employer } from '../../users/entities/employer.entity';

export type RatingDirection = 'EMPLOYER_TO_WORKER' | 'WORKER_TO_EMPLOYER';

/**
 * Rating after a COMPLETED shift.
 * EMPLOYER_TO_WORKER: public — shown to other employers & worker's profile.
 * WORKER_TO_EMPLOYER: internal only — visible to Turnos team, not to workers/employers.
 * One rating per (shift, rater, direction) — enforced by unique index.
 */
@Entity('ratings')
@Index('UQ_rating_shift_rater_dir', ['shift', 'rater', 'direction'], { unique: true })
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Shift, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  shift: Shift;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rater_id' })
  rater: User;                        // Who submitted this rating

  @ManyToOne(() => Worker, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ratee_worker_id' })
  rateeWorker?: Worker;               // Set when direction = EMPLOYER_TO_WORKER

  @ManyToOne(() => Employer, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ratee_employer_id' })
  rateeEmployer?: Employer;           // Set when direction = WORKER_TO_EMPLOYER

  @Column({ type: 'varchar', length: 30, default: 'EMPLOYER_TO_WORKER' })
  direction: RatingDirection;

  @Column({ type: 'int' })
  score: number;                      // 1–5 stars

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];                     // e.g. ['pontual', 'profissional']

  /** Written review from employer — shown to other employers (max 150 chars) */
  @Column({ type: 'varchar', length: 150, nullable: true })
  review?: string;

  @CreateDateColumn()
  createdAt: Date;
}

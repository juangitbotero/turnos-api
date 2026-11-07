import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Shift } from './shift.entity';
import { Worker } from '../../users/entities/worker.entity';

/**
 * A worker reporting a shift a company posted (App Store guideline 1.2 —
 * user-generated content needs a report mechanism; also DSA notice-and-action).
 * Each report opens an ops case (`REP-…`). One per worker per shift: reporting
 * again updates the reason and note instead of adding rows.
 */
@Entity('shift_reports')
@Index(['shift', 'worker'], { unique: true })
export class ShiftReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Shift, { onDelete: 'CASCADE' })
  @JoinColumn()
  shift: Shift;

  @ManyToOne(() => Worker, { onDelete: 'CASCADE' })
  @JoinColumn()
  worker: Worker;

  /** One of SHIFT_REPORT_REASONS in shared. */
  @Column({ type: 'varchar', length: 30 })
  reason: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

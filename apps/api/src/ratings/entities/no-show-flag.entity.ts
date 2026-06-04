import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Shift } from '../../shifts/entities/shift.entity';
import { Worker } from '../../users/entities/worker.entity';
import { Employer } from '../../users/entities/employer.entity';

/**
 * No-show flag — employer reports that the confirmed worker did not appear.
 * Separate from ratings: heavier penalty tracked independently.
 * Three no-shows in 60 days triggers manual admin review.
 */
@Entity('no_show_flags')
export class NoShowFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Shift, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  shift: Shift;

  @ManyToOne(() => Worker, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  worker: Worker;

  @ManyToOne(() => Employer, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  reportedBy: Employer;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt: Date;
}

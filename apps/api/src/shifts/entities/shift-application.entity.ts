import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique
} from 'typeorm';
import { Worker } from '../../users/entities/worker.entity';
import { Shift } from './shift.entity';

export enum ApplicationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

@Entity('shift_applications')
@Unique(['shift', 'worker']) // A worker can only apply once to a shift
export class ShiftApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Shift, (shift) => shift.applications, { onDelete: 'CASCADE' })
  @JoinColumn()
  shift: Shift;

  @ManyToOne(() => Worker, { onDelete: 'CASCADE' })
  @JoinColumn()
  worker: Worker;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.PENDING,
  })
  status: ApplicationStatus;

  /**
   * Created by the company's direct invitation, not by the worker applying.
   * When such an offer lapses or is withdrawn the row is WITHDRAWN rather than
   * put back to PENDING — the worker never applied, so they must not appear
   * as a candidate. See shifts/offer-release.ts.
   */
  @Column({ type: 'boolean', default: false })
  invited: boolean;

  /** Optional short message from worker to employer (max 200 chars) */
  @Column({ type: 'varchar', length: 200, nullable: true })
  coverNote?: string;

  /**
   * When the company first saw this application (Candidates page or the
   * applicants modal). Null = new — drives the "new" label and the sidebar
   * badge colour. Visibility only: it never changes what the company can do.
   */
  @Column({ type: 'timestamp', nullable: true })
  employerSeenAt: Date | null;

  @CreateDateColumn()
  appliedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

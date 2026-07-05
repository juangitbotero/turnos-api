import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index
} from 'typeorm';
import { Employer } from '../../users/entities/employer.entity';
import { Worker } from '../../users/entities/worker.entity';
import { ShiftApplication } from './shift-application.entity';

export enum ShiftStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  PENDING_ACCEPTANCE = 'PENDING_ACCEPTANCE', // Employer selected worker; awaiting worker confirmation
  FILLED = 'FILLED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',   // Start time passed with no confirmed worker — auto-set by nightly cron
}

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subcategory: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  role: string;

  @Column({ type: 'date' })
  date: string; // YYYY-MM-DD

  @Column({ type: 'time' })
  startTime: string; // HH:mm:ss

  @Column({ type: 'time' })
  endTime: string; // HH:mm:ss

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  grossHourlyRate: number;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  // Plain decimal lat/lng — used for proximity display and search
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lng: number | null;

  @Column({
    type: 'enum',
    enum: ShiftStatus,
    default: ShiftStatus.DRAFT,
  })
  status: ShiftStatus;

  @ManyToOne(() => Employer)
  @JoinColumn()
  employer: Employer;

  // The final assigned worker (after employer approval)
  @ManyToOne(() => Worker, { nullable: true })
  @JoinColumn()
  assignedWorker?: Worker;

  @Column({ type: 'simple-array', nullable: true })
  skillsRequired: string[];

  @Column({ type: 'simple-array', nullable: true })
  languagesRequired: string[];      // e.g. ['Inglês', 'Espanhol']

  /**
   * How the company will pay the worker (directly, outside Turnos).
   * Nullable only for pre-pivot rows — required on new shifts.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  paymentMethod: string | null;     // PaymentMethod from @turnos/shared

  @OneToMany(() => ShiftApplication, (application) => application.shift)
  applications: ShiftApplication[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

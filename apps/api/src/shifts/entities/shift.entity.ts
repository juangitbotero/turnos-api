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
  FILLED = 'FILLED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
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

  // PostGIS spatial column for proximity matching
  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: any; // GeoJSON Point

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

  @OneToMany(() => ShiftApplication, (application) => application.shift)
  applications: ShiftApplication[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

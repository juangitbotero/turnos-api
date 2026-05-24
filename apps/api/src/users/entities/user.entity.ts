import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { UserRole } from '@turnos/shared';
import { Worker } from './worker.entity';
import { Employer } from './employer.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email?: string; // Nullable because workers use phone

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  phone?: string; // Nullable because employers use email

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  googleId?: string;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  emailVerificationToken?: string;

  @Column({
    type: 'enum',
    enum: ['WORKER', 'EMPLOYER', 'ADMIN'],
  })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Worker, (worker) => worker.user, { cascade: true })
  workerProfile?: Worker;

  @OneToOne(() => Employer, (employer) => employer.user, { cascade: true })
  employerProfile?: Employer;
}

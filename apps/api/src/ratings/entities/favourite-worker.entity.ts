import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Employer } from '../../users/entities/employer.entity';
import { Worker } from '../../users/entities/worker.entity';

/**
 * Employer's saved/favourite workers.
 * Favourites receive priority placement at the top of the notification batch
 * when the employer posts a new shift.
 */
@Entity('favourite_workers')
@Index('UQ_favourite_employer_worker', ['employer', 'worker'], { unique: true })
export class FavouriteWorker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employer, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  employer: Employer;

  @ManyToOne(() => Worker, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  worker: Worker;

  @CreateDateColumn()
  createdAt: Date;
}

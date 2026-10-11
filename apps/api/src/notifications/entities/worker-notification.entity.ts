import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Worker } from '../../users/entities/worker.entity';

/**
 * One entry in a worker's in-app notifications inbox (2026-10-11).
 *
 * Every personal push to a worker is also written here by
 * NotificationsService.notifyWorker() — including for workers with no push
 * token, who are exactly the ones a push alone never reached. Before this, a
 * worker who missed the "you were selected, 2h to accept" push had no trace of
 * it anywhere but the my-shifts list, and the offer lapsed.
 *
 * Not written for the broadcast "new shift near you" wave: that is a feed
 * suggestion, not something that happened to the worker.
 *
 * Retention: rows older than 180 days are purged nightly (RetentionService);
 * all of a worker's rows are deleted with the account.
 */
@Entity('worker_notifications')
@Index(['worker', 'createdAt'])
export class WorkerNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Worker, { onDelete: 'CASCADE' })
  @JoinColumn()
  worker: Worker;

  /** Same value as the push `data.type` — drives the icon and where a tap goes. */
  @Column({ type: 'varchar', length: 40 })
  type: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  /** The push payload (shiftId, …) — what the app needs to open the right screen. */
  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import Expo from 'expo-server-sdk';
import { Worker } from '../users/entities/worker.entity';
import { FavouriteWorker } from '../ratings/entities/favourite-worker.entity';
import { RedisService } from '../redis/redis.service';
import { WorkerNotification } from './entities/worker-notification.entity';

/** Inbox page size — the app shows the latest; older entries are rarely useful. */
const INBOX_LIMIT = 50;
/** Inbox retention (RetentionService purges nightly). */
export const INBOX_RETENTION_DAYS = 180;

@Injectable()
export class NotificationsService {
  private readonly expo = new Expo();
  private readonly logger = new Logger(NotificationsService.name);
  private readonly BATCH_SIZE = 20;

  constructor(
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(FavouriteWorker)
    private readonly favouriteRepo: Repository<FavouriteWorker>,
    @InjectRepository(WorkerNotification)
    private readonly inboxRepo: Repository<WorkerNotification>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Find top-N ACTIVE workers whose skills overlap with the shift's required skills,
   * sorted by priority: (1) employer's favourites first, (2) TOP_RATED badge workers,
   * (3) everyone else — all ordered by profileQualityScore DESC within each group.
   *
   * Tracks notified worker IDs in Redis so re-notification sends the NEXT batch.
   *
   * @param shiftId        - shift UUID (used as Redis tracking key)
   * @param employerId     - employer UUID (used to look up favourites)
   * @param requiredSkills - shift.skillsRequired (empty = notify all active workers)
   * @param shiftTitle     - shown in the push notification body
   * @param batchOffset    - 0 for first wave, BATCH_SIZE for second wave
   */
  async notifyMatchingWorkers(
    shiftId: string,
    employerId: string,
    requiredSkills: string[],
    shiftTitle: string,
    batchOffset = 0,
  ): Promise<void> {
    const notifiedKey = `notified:${shiftId}`;
    const alreadyRaw = await this.redis.get(notifiedKey);
    const alreadyNotifiedIds: string[] = alreadyRaw ? (JSON.parse(alreadyRaw) as string[]) : [];

    // Load employer's favourite worker IDs for priority sorting
    const favourites = await this.favouriteRepo.find({
      where: { employer: { id: employerId } },
      relations: ['worker'],
    });
    const favouriteIds = favourites.map(f => f.worker.id);

    const query = this.workerRepo
      .createQueryBuilder('worker')
      .where('worker.status = :status', { status: 'ACTIVE' })
      .andWhere('worker.expoPushToken IS NOT NULL')
      // Priority: favourites → TOP_RATED badge holders → everyone else, then by score
      .orderBy(
        favouriteIds.length > 0
          ? `CASE WHEN worker.id IN ('${favouriteIds.join("','")}') THEN 0 WHEN worker.badges LIKE '%TOP_RATED%' THEN 1 ELSE 2 END`
          : `CASE WHEN worker.badges LIKE '%TOP_RATED%' THEN 0 ELSE 1 END`,
        'ASC',
      )
      .addOrderBy('worker.profileQualityScore', 'DESC')
      .skip(batchOffset)
      .take(this.BATCH_SIZE);

    // Skill filter — prefer workers with at least one matching skill
    if (requiredSkills.length > 0) {
      const conditions = requiredSkills.map((_, i) => `worker.skills LIKE :skill${i}`);
      const params: Record<string, string> = {};
      requiredSkills.forEach((skill, i) => { params[`skill${i}`] = `%${skill}%`; });
      query.andWhere(`(${conditions.join(' OR ')})`, params);
    }

    // Exclude already-notified workers
    if (alreadyNotifiedIds.length > 0) {
      query.andWhere('worker.id NOT IN (:...excludeIds)', { excludeIds: alreadyNotifiedIds });
    }

    const workers = await query.getMany();

    if (workers.length === 0) {
      this.logger.log(`No workers to notify for shift ${shiftId} (offset ${batchOffset})`);
      return;
    }

    // Persist notified IDs in Redis for 48 h
    const newNotifiedIds = [...alreadyNotifiedIds, ...workers.map(w => w.id)];
    await this.redis.set(notifiedKey, JSON.stringify(newNotifiedIds), 48 * 60 * 60);

    // Build Expo messages — only include valid tokens
    const messages = workers
      .filter(w => Expo.isExpoPushToken(w.expoPushToken ?? ''))
      .map(w => ({
        to: w.expoPushToken as string,
        sound: 'default' as const,
        title: 'Novo turno disponível! 🎯',
        body: `"${shiftTitle}" — Candidata-te agora`,
        data: { shiftId, type: 'new_shift' },
      }));

    if (messages.length === 0) return;

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        this.logger.error('Expo push send error', err);
      }
    }

    this.logger.log(
      `Push notifications sent to ${messages.length} workers for shift ${shiftId} (offset ${batchOffset})`,
    );
  }

  /**
   * Send a push notification directly to a list of Expo push tokens.
   */
  async sendDirectPush(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const valid = tokens.filter(t => Expo.isExpoPushToken(t));
    if (valid.length === 0) return;
    const messages = valid.map(to => ({
      to, sound: 'default' as const, title, body, data: data ?? {},
    }));
    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try { await this.expo.sendPushNotificationsAsync(chunk); } catch { /* best-effort */ }
    }
  }

  /**
   * Tell one worker something that happened to THEM: write it to their inbox,
   * then push it if they have a token.
   *
   * Use this — not sendDirectPush — for every personal worker notification.
   * The inbox write is what reaches a worker whose notifications are off or
   * who missed the push; the call sites used to skip such workers entirely
   * (`if (worker.expoPushToken) …`). Deleted accounts get nothing.
   */
  async notifyWorker(
    worker: Pick<Worker, 'id' | 'expoPushToken'> & { deletedAt?: Date | null } | null | undefined,
    title: string,
    body: string,
    data: Record<string, unknown> & { type: string },
  ): Promise<void> {
    if (!worker?.id || worker.deletedAt) return;
    try {
      await this.inboxRepo.save(this.inboxRepo.create({
        worker: { id: worker.id } as Worker,
        type: String(data.type).slice(0, 40),
        title: title.slice(0, 160),
        body,
        data,
      }));
    } catch (err) {
      // The push still goes out — a failed inbox write must not swallow it.
      this.logger.warn(`[Inbox] Could not store notification for worker ${worker.id}: ${(err as Error).message}`);
    }
    if (worker.expoPushToken) await this.sendDirectPush([worker.expoPushToken], title, body, data);
  }

  /** The worker's inbox, newest first, with the unread count for the bell. */
  async getInbox(userId: string): Promise<{ items: WorkerNotification[]; unread: number }> {
    const worker = await this.workerForUser(userId);
    if (!worker) return { items: [], unread: 0 };
    const [items, unread] = await Promise.all([
      this.inboxRepo.find({
        where: { worker: { id: worker.id } },
        order: { createdAt: 'DESC' },
        take: INBOX_LIMIT,
      }),
      this.inboxRepo.count({ where: { worker: { id: worker.id }, readAt: IsNull() } }),
    ]);
    return { items, unread };
  }

  async getUnreadCount(userId: string): Promise<{ unread: number }> {
    const worker = await this.workerForUser(userId);
    if (!worker) return { unread: 0 };
    return { unread: await this.inboxRepo.count({ where: { worker: { id: worker.id }, readAt: IsNull() } }) };
  }

  /** Mark the given entries read — or all of them when `ids` is empty. */
  async markRead(userId: string, ids?: string[]): Promise<{ unread: number }> {
    const worker = await this.workerForUser(userId);
    if (!worker) return { unread: 0 };
    const qb = this.inboxRepo.createQueryBuilder()
      .update(WorkerNotification)
      .set({ readAt: () => 'NOW()' })
      .where('"workerId" = :workerId AND "readAt" IS NULL', { workerId: worker.id });
    if (ids?.length) qb.andWhere('id IN (:...ids)', { ids });
    await qb.execute();
    return this.getUnreadCount(userId);
  }

  /** Nightly retention (RetentionService) and account deletion. */
  async purgeInbox(opts: { olderThanDays?: number; workerId?: string }): Promise<number> {
    if (opts.workerId) {
      return (await this.inboxRepo.delete({ worker: { id: opts.workerId } })).affected ?? 0;
    }
    const cutoff = new Date(Date.now() - (opts.olderThanDays ?? INBOX_RETENTION_DAYS) * 86_400_000);
    return (await this.inboxRepo.delete({ createdAt: LessThan(cutoff) })).affected ?? 0;
  }

  /**
   * Resolve the caller's worker row. An undefined userId must never reach
   * findOne — TypeORM drops the condition and returns the first row (the bug
   * that hit every ratings endpoint until 2026-10-05).
   */
  private async workerForUser(userId: string | undefined): Promise<Worker | null> {
    if (!userId) return null;
    return this.workerRepo.findOne({ where: { user: { id: userId } } });
  }

  /**
   * Save or update the Expo push token for a worker (identified by User ID).
   */
  async savePushToken(userId: string, token: string): Promise<void> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: userId } } });
    if (!worker) return;
    worker.expoPushToken = Expo.isExpoPushToken(token) ? token : undefined;
    await this.workerRepo.save(worker);
  }
}

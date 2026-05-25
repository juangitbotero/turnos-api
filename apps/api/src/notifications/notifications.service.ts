import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Expo from 'expo-server-sdk';
import { Worker } from '../users/entities/worker.entity';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class NotificationsService {
  private readonly expo = new Expo();
  private readonly logger = new Logger(NotificationsService.name);
  private readonly BATCH_SIZE = 20;

  constructor(
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Find top-N ACTIVE workers whose skills overlap with the shift's required skills,
   * sorted by profileQualityScore DESC, and send them an Expo push notification.
   *
   * Tracks notified worker IDs in Redis so re-notification sends the NEXT batch.
   *
   * @param shiftId        - shift UUID (used as Redis tracking key)
   * @param requiredSkills - shift.skillsRequired (empty = notify all active workers)
   * @param shiftTitle     - shown in the push notification body
   * @param batchOffset    - 0 for first wave, BATCH_SIZE for second wave
   */
  async notifyMatchingWorkers(
    shiftId: string,
    requiredSkills: string[],
    shiftTitle: string,
    batchOffset = 0,
  ): Promise<void> {
    const notifiedKey = `notified:${shiftId}`;
    const alreadyRaw = await this.redis.get(notifiedKey);
    const alreadyNotifiedIds: string[] = alreadyRaw ? (JSON.parse(alreadyRaw) as string[]) : [];

    const query = this.workerRepo
      .createQueryBuilder('worker')
      .where('worker.status = :status', { status: 'ACTIVE' })
      .andWhere('worker.expoPushToken IS NOT NULL')
      .orderBy('worker.profileQualityScore', 'DESC')
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
   * Save or update the Expo push token for a worker (identified by User ID).
   */
  async savePushToken(userId: string, token: string): Promise<void> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: userId } } });
    if (!worker) return;
    worker.expoPushToken = Expo.isExpoPushToken(token) ? token : undefined;
    await this.workerRepo.save(worker);
  }
}

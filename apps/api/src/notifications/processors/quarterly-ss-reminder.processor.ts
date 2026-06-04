/**
 * Quarterly SS Reminder Processor
 *
 * Fires on the 1st day of March, June, September and December at 09:00 UTC,
 * sending a push notification to every ACTIVE worker with a registered Expo
 * push token. The notification reminds them to submit their SS declaration
 * for the previous quarter before the month end.
 *
 * Workers on MCD contracts (recibo verde) are legally required to declare
 * their income to Segurança Social quarterly. Turnos helps them stay compliant.
 *
 * BullMQ repeatable job key: 'quarterly-ss-reminder'
 * Cron: 0 9 1 3,6,9,12 * (09:00 UTC on 1st of Mar/Jun/Sep/Dec)
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import Expo from 'expo-server-sdk';
import { Worker } from '../../users/entities/worker.entity';

export interface QuarterlySsReminderJobData {
  quarter: number;   // 1–4
  year:    number;
}

const QUARTER_LABEL: Record<number, string> = {
  1: '1.º trimestre (Jan–Mar)',
  2: '2.º trimestre (Abr–Jun)',
  3: '3.º trimestre (Jul–Set)',
  4: '4.º trimestre (Out–Dez)',
};

@Processor('quarterly-ss')
export class QuarterlySsReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(QuarterlySsReminderProcessor.name);
  private readonly expo   = new Expo();
  private readonly BATCH  = 100;

  constructor(
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {
    super();
  }

  async process(job: Job<QuarterlySsReminderJobData>): Promise<void> {
    const { quarter, year } = job.data;
    const label = QUARTER_LABEL[quarter] ?? `Q${quarter} ${year}`;

    this.logger.log(`[SS Reminder] Starting quarterly reminder — ${label} ${year}`);

    // Fetch in batches so we don't blow memory on a large worker pool
    let offset = 0;
    let totalSent = 0;

    while (true) {
      const workers = await this.workerRepo.find({
        where: { status: 'ACTIVE' as any },
        select: ['id', 'expoPushToken', 'fullName'],
        take: this.BATCH,
        skip: offset,
      });

      if (workers.length === 0) break;

      const messages = workers
        .filter(w => Expo.isExpoPushToken(w.expoPushToken ?? ''))
        .map(w => ({
          to:    w.expoPushToken as string,
          sound: 'default' as const,
          title: '🏛️ Declaração SS trimestral',
          body:  `Lembra-te de declarar os teus rendimentos do ${label} na Segurança Social antes do fim do mês.`,
          data:  {
            type:    'quarterly_ss_reminder',
            quarter,
            year,
          },
          priority: 'normal' as const,
        }));

      const chunks = this.expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          const tickets = await this.expo.sendPushNotificationsAsync(chunk);
          totalSent += tickets.filter(t => t.status === 'ok').length;
        } catch (err) {
          this.logger.error(`[SS Reminder] Expo send error (batch offset ${offset})`, err);
        }
      }

      offset += this.BATCH;
      if (workers.length < this.BATCH) break;
    }

    this.logger.log(`[SS Reminder] Sent to ${totalSent} workers — ${label} ${year}`);
  }
}

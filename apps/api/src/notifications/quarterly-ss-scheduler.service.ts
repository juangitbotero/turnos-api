/**
 * QuarterlySsSchedulerService
 *
 * Schedules the repeatable BullMQ job that fires the quarterly SS reminder
 * push notification to all active workers.
 *
 * Called once on application bootstrap — BullMQ deduplicates repeatable jobs
 * by key, so multiple startups don't create duplicate schedules.
 *
 * Cron: 0 9 1 3,6,9,12 * → 09:00 UTC on 1 Mar / 1 Jun / 1 Sep / 1 Dec
 */

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QuarterlySsReminderJobData } from './processors/quarterly-ss-reminder.processor';

// Map month → quarter number
const MONTH_TO_QUARTER: Record<number, number> = {
  3: 1, 6: 2, 9: 3, 12: 4,
};

@Injectable()
export class QuarterlySsSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(QuarterlySsSchedulerService.name);

  constructor(
    @InjectQueue('quarterly-ss')
    private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      // Remove stale repeatable jobs if the cron expression changed
      const existing = await this.queue.getRepeatableJobs();
      for (const job of existing) {
        if (job.name !== 'quarterly-ss-reminder') {
          await this.queue.removeRepeatableByKey(job.key);
        }
      }

      // Add/update the repeatable job — BullMQ is idempotent on the same cron key
      await this.queue.add(
        'quarterly-ss-reminder',
        this.buildJobData(),
        {
          repeat: {
            // 09:00 UTC on 1st of March, June, September, December
            pattern: '0 9 1 3,6,9,12 *',
          },
          removeOnComplete: { count: 10 },
          removeOnFail:     { count: 10 },
        },
      );

      this.logger.log('[SS Scheduler] Quarterly SS reminder cron registered: 0 9 1 3,6,9,12 *');
    } catch (err) {
      this.logger.error('[SS Scheduler] Failed to register quarterly SS reminder', err);
    }
  }

  /** Build job data based on the current calendar quarter. */
  private buildJobData(): QuarterlySsReminderJobData {
    const now     = new Date();
    const month   = now.getMonth() + 1;
    const year    = now.getFullYear();
    // Find which quarter we are notifying about (previous quarter from trigger month)
    const quarter = MONTH_TO_QUARTER[month] ?? 1;
    return { quarter, year };
  }
}

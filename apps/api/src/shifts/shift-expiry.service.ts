/**
 * ShiftExpiryService
 *
 * Registers two repeatable BullMQ jobs, both processed by
 * ReNotificationProcessor:
 *  - nightly (02:00 UTC): OPEN / PENDING_ACCEPTANCE shifts whose end has passed
 *    are marked EXPIRED;
 *  - every 15 min: pending offers past the 2h window are released, in case
 *    their own timeout job was lost (see shifts/offer-release.ts).
 *
 * EXPIRED shifts:
 *  - Do not appear in the mobile feed (search returns OPEN only)
 *  - Appear in the employer web-admin "Caducados" section
 *  - Can be re-posted or deleted by the employer
 */

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ShiftExpiryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ShiftExpiryService.name);

  constructor(
    @InjectQueue('shift-notifications')
    private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap() {
    // Register nightly repeatable job — BullMQ deduplicates by key
    await this.queue.add(
      'expire-stale-shifts',
      {},
      {
        repeat: { pattern: '0 2 * * *' }, // 02:00 UTC nightly
        jobId: 'shift-expiry-daily',
      },
    );
    this.logger.log('[ShiftExpiry] Nightly expiry job registered: 0 2 * * *');

    // Safety net for pending offers whose 2h timeout job was lost
    await this.queue.add(
      'release-stale-offers',
      {},
      { repeat: { pattern: '*/15 * * * *' }, jobId: 'release-stale-offers' },
    );
  }
}

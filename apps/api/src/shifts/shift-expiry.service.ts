/**
 * ShiftExpiryService
 *
 * Registers a nightly BullMQ repeatable job (02:00 UTC) that scans for
 * OPEN / PENDING_ACCEPTANCE shifts whose end datetime has passed and marks
 * them EXPIRED.
 *
 * EXPIRED shifts:
 *  - Do not appear in the mobile feed (search returns OPEN only)
 *  - Appear in the employer web-admin "Caducados" section
 *  - Can be re-posted or deleted by the employer
 */

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository, In } from 'typeorm';
import { Queue } from 'bullmq';
import { Shift, ShiftStatus } from './entities/shift.entity';

@Injectable()
export class ShiftExpiryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ShiftExpiryService.name);

  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,

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
  }

  /** Called by the queue processor when the job fires */
  async runExpiry(): Promise<{ expired: number }> {
    const now = new Date();

    const candidates = await this.shiftRepo.find({
      where: [
        { status: ShiftStatus.OPEN },
        { status: ShiftStatus.PENDING_ACCEPTANCE },
      ],
    });

    const toExpire = candidates.filter(shift => {
      const [h, m] = shift.endTime.split(':').map(Number);
      const [y, mo, d] = shift.date.split('-').map(Number);
      const end = new Date(y!, (mo! - 1), d!, h!, m!, 0);
      return end < now;
    });

    if (toExpire.length === 0) {
      this.logger.log('[ShiftExpiry] No stale shifts to expire.');
      return { expired: 0 };
    }

    await this.shiftRepo.update(
      { id: In(toExpire.map(s => s.id)) },
      { status: ShiftStatus.EXPIRED },
    );

    this.logger.log(`[ShiftExpiry] Marked ${toExpire.length} shift(s) EXPIRED.`);
    return { expired: toExpire.length };
  }
}

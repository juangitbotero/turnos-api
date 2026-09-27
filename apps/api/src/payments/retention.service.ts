import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { WagePayment, WagePaymentStatus } from './entities/wage-payment.entity';
import { StorageService } from '../storage/storage.service';

/** Privacy policy §8 — keep these two in step with the published text. */
export const PAYMENT_PROOF_RETENTION_MONTHS = 24;
export const JUSTIFICATION_RETENTION_MONTHS = 6;

/**
 * Nightly deletion of what the privacy policy promises not to keep forever.
 *
 *   - Payment proofs (bank receipts, MB WAY screenshots uploaded by companies):
 *     file deleted 24 months after payment. The wage row itself stays — it is
 *     the record that the worker was paid.
 *   - Company cancellation justifications (free-text note): cleared 6 months
 *     after the case closed. The category is kept; it carries no personal data
 *     and the cancellation record needs it.
 *
 * Only settled or closed records are touched. A DISPUTED, PENDING or
 * UNDER_REVIEW payment keeps everything, however old — the policy says
 * "or until an open dispute is resolved".
 *
 * Worker late-cancellation justifications are never stored in the database;
 * they reach the ops mailbox by email, and that mailbox has its own 6-month
 * deletion step (docs/go-live-cleanup.md).
 *
 * Runs on the existing `wage-reminders` queue so no new worker is needed.
 */
@Injectable()
export class RetentionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @InjectRepository(WagePayment)
    private readonly wageRepo: Repository<WagePayment>,
    @InjectQueue('wage-reminders')
    private readonly queue: Queue,
    private readonly storage: StorageService,
  ) {}

  async onApplicationBootstrap() {
    await this.queue.add('retention', {}, {
      repeat: { pattern: '30 3 * * *' }, // 03:30 UTC nightly, after shift expiry
      jobId: 'retention-daily',
    });
    this.logger.log('[Retention] Nightly purge registered: 30 3 * * *');
  }

  async run(): Promise<{ proofsPurged: number; notesCleared: number }> {
    const proofsPurged = await this.purgePaymentProofs();
    const notesCleared = await this.clearCancellationNotes();
    this.logger.log(`[Retention] ${proofsPurged} payment proof(s) deleted, ${notesCleared} cancellation note(s) cleared`);
    return { proofsPurged, notesCleared };
  }

  private async purgePaymentProofs(): Promise<number> {
    const cutoff = monthsAgo(PAYMENT_PROOF_RETENTION_MONTHS);
    const due = await this.wageRepo.find({
      where: {
        paymentProofUrl: Not(IsNull()),
        status: In([WagePaymentStatus.PAID, WagePaymentStatus.CONFIRMED]),
        paidAt: LessThan(cutoff),
      },
      take: 500,
    });

    let purged = 0;
    for (const wage of due) {
      // Clear the reference even if the blob is already gone — the goal is
      // that nothing points at a file we promised to have deleted.
      await this.storage.deleteByUrl(wage.paymentProofUrl).catch(() => false);
      wage.paymentProofUrl      = null;
      wage.paymentProofPurgedAt = new Date();
      await this.wageRepo.save(wage);
      purged++;
    }
    return purged;
  }

  private async clearCancellationNotes(): Promise<number> {
    const cutoff = monthsAgo(JUSTIFICATION_RETENTION_MONTHS);
    const result = await this.wageRepo.update(
      {
        cancellationNote: Not(IsNull()),
        status: In([WagePaymentStatus.WAIVED, WagePaymentStatus.PAID, WagePaymentStatus.CONFIRMED]),
        updatedAt: LessThan(cutoff),
      },
      { cancellationNote: null },
    );
    return result.affected ?? 0;
  }
}

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

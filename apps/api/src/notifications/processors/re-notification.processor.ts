import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { NotificationsService } from '../notifications.service';
import { Shift, ShiftStatus } from '../../shifts/entities/shift.entity';
import { ShiftApplication, ApplicationStatus } from '../../shifts/entities/shift-application.entity';

export interface ReNotificationJobData {
  shiftId: string;
  shiftTitle: string;
  requiredSkills: string[];
  employerId: string;
}

/**
 * BullMQ processor: fires ~5 hours after a shift is published.
 * If the shift still has 0 applications, sends a second notification wave
 * to the NEXT batch of matching workers (skipping the first 20 already notified).
 */
@Processor('shift-notifications')
export class ReNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReNotificationProcessor.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(ShiftApplication)
    private readonly applicationRepo: Repository<ShiftApplication>,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    // ── Nightly shift expiry ────────────────────────────────────────────────
    if (job.name === 'expire-stale-shifts') {
      await this.runShiftExpiry();
      return;
    }

    // ── Worker acceptance timeout (2h) ──────────────────────────────────────
    if (job.name === 'acceptance-timeout') {
      const { shiftId: sid, applicationId } = job.data as { shiftId: string; applicationId: string };

      // Atomically revert shift + clear assignedWorker FK via QueryBuilder.
      // The WHERE status guard makes this a no-op if the worker already accepted
      // (status would be FILLED) — safe to retry.
      const result = await this.shiftRepo
        .createQueryBuilder()
        .update(Shift)
        .set({ status: ShiftStatus.OPEN, assignedWorker: null as any })
        .where('id = :id AND status = :status', { id: sid, status: ShiftStatus.PENDING_ACCEPTANCE })
        .execute();

      if (result.affected && result.affected > 0) {
        this.logger.log(`[AcceptanceTimeout] Shift ${sid} reverted to OPEN — worker did not respond in 2h`);

        // Reset application APPROVED → PENDING so the worker's my-shifts screen
        // no longer shows this shift as "confirmed" (the shift was never accepted).
        const application = await this.applicationRepo.findOne({
          where: { id: applicationId },
          relations: ['worker'],
        });
        if (application?.status === ApplicationStatus.APPROVED) {
          application.status = ApplicationStatus.PENDING;
          await this.applicationRepo.save(application);

          // Notify the worker that their window expired
          if (application.worker?.expoPushToken) {
            this.notificationsService.sendDirectPush(
              [application.worker.expoPushToken],
              'Tempo esgotado ⏰',
              'Não respondeste a tempo — o turno voltou à lista de disponíveis.',
              { type: 'acceptance_timeout', shiftId: sid },
            ).catch(() => {});
          }
        }
      }
      return;
    }

    // ── Re-notification wave (default) ──────────────────────────────────────
    const { shiftId, shiftTitle, requiredSkills, employerId } = job.data as ReNotificationJobData;
    this.logger.log(`Re-notification check for shift ${shiftId}`);

    const shift = await this.shiftRepo.findOne({ where: { id: shiftId } });
    if (!shift || shift.status !== ShiftStatus.OPEN) {
      this.logger.log(`Shift ${shiftId} is no longer OPEN — skipping re-notification`);
      return;
    }

    const applicationCount = await this.applicationRepo.count({
      where: { shift: { id: shiftId } },
    });

    if (applicationCount > 0) {
      this.logger.log(
        `Shift ${shiftId} has ${applicationCount} application(s) — skipping re-notification`,
      );
      return;
    }

    this.logger.log(`Shift ${shiftId}: 0 applications after 5 h — sending second wave`);
    await this.notificationsService.notifyMatchingWorkers(
      shiftId,
      employerId,
      requiredSkills,
      shiftTitle,
      20, // skip the first 20 workers notified in wave 1
    );
  }

  private async runShiftExpiry(): Promise<void> {
    const now = new Date();
    const candidates = await this.shiftRepo.find({
      where: [{ status: ShiftStatus.OPEN }, { status: ShiftStatus.PENDING_ACCEPTANCE }],
    });
    const toExpire = candidates.filter(shift => {
      const [h, m] = shift.endTime.split(':').map(Number);
      const [y, mo, d] = shift.date.split('-').map(Number);
      const end = new Date(y!, (mo! - 1), d!, h!, m!, 0);
      return end < now;
    });
    if (toExpire.length === 0) {
      this.logger.log('[ShiftExpiry] No stale shifts.');
      return;
    }
    await this.shiftRepo.update({ id: In(toExpire.map(s => s.id)) }, { status: ShiftStatus.EXPIRED });
    this.logger.log(`[ShiftExpiry] ${toExpire.length} shift(s) marked EXPIRED.`);
  }
}

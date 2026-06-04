import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { NotificationsService } from '../notifications.service';
import { Shift, ShiftStatus } from '../../shifts/entities/shift.entity';
import { ShiftApplication } from '../../shifts/entities/shift-application.entity';

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
      const shift = await this.shiftRepo.findOne({
        where: { id: sid },
        relations: ['employer'],
      });
      if (shift && shift.status === ShiftStatus.PENDING_ACCEPTANCE) {
        shift.status = ShiftStatus.OPEN;
        (shift as any).assignedWorker = null;
        await this.shiftRepo.save(shift);
        this.logger.log(`[AcceptanceTimeout] Shift ${sid} reverted to OPEN — worker did not respond in 2h`);
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

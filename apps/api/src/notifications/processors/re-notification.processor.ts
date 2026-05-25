import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications.service';
import { Shift, ShiftStatus } from '../../shifts/entities/shift.entity';
import { ShiftApplication } from '../../shifts/entities/shift-application.entity';

export interface ReNotificationJobData {
  shiftId: string;
  shiftTitle: string;
  requiredSkills: string[];
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

  async process(job: Job<ReNotificationJobData>): Promise<void> {
    const { shiftId, shiftTitle, requiredSkills } = job.data;
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
      requiredSkills,
      shiftTitle,
      20, // skip the first 20 workers notified in wave 1
    );
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WagePaymentsService, WageReminderJobData } from '../wage-payments.service';

/**
 * Processes the unpaid-wage reminder ladder: +8h, +24h, +48h final warning,
 * +72h posting blocked. Each job re-checks the payment status and schedules
 * the next step only while the wage is still unpaid.
 */
@Processor('wage-reminders')
export class WageReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(WageReminderProcessor.name);

  constructor(private readonly wagePayments: WagePaymentsService) {
    super();
  }

  async process(job: Job<WageReminderJobData>): Promise<void> {
    try {
      await this.wagePayments.processReminder(job.data);
    } catch (err) {
      this.logger.error(`[WageReminder] Job failed for wage ${job.data.wagePaymentId}: ${(err as Error).message}`);
      throw err; // let BullMQ retry
    }
  }
}

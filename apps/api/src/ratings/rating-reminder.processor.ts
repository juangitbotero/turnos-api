import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RatingsService, RatingReminderJobData } from './ratings.service';

/**
 * Processes the 'rating-reminder' queue (v2.1: +8h review follow-ups).
 * Fires 8 hours after a shift auto-completes — nudges only the sides that
 * haven't reviewed yet: email to the employer, push to the worker.
 */
@Processor('rating-reminder')
export class RatingReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(RatingReminderProcessor.name);

  constructor(
    private readonly mail: MailService,
    private readonly ratings: RatingsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<RatingReminderJobData>): Promise<void> {
    const { shiftId, shiftTitle, employerEmail, employerName } = job.data;
    const { remindEmployer, workerPushToken } = await this.ratings.processReviewFollowUp(job.data);

    if (remindEmployer) {
      const webUrl = this.config.get<string>('WEB_ADMIN_URL', 'http://localhost:3000');
      try {
        const button = (label: string) => `
          <p style="text-align:center;margin:24px 0">
            <a href="${webUrl}/dashboard/ratings"
               style="background:#6a79ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
              ${label}
            </a>
          </p>`;
        await this.mail.sendBilingual(employerEmail, {
          pt: {
            subject: `Avalie o trabalhador do turno "${shiftTitle}" 🌟`,
            html: `<p>Olá <strong>${employerName}</strong>,</p>
              <p>O turno <strong>"${shiftTitle}"</strong> foi concluído e ainda não avaliou o trabalhador.</p>
              <p>Uma avaliação rápida ajuda a construir a reputação do trabalhador.</p>
              ${button('Avaliar trabalhador')}`,
          },
          en: {
            subject: `Rate the worker from "${shiftTitle}" 🌟`,
            html: `<p>Hello <strong>${employerName}</strong>,</p>
              <p>The shift <strong>"${shiftTitle}"</strong> is complete and you have not rated the worker yet.</p>
              <p>A quick rating helps build the worker's reputation.</p>
              ${button('Rate the worker')}`,
          },
        });
      } catch (err) {
        this.logger.error(`[RatingReminder] Failed to email ${employerEmail}: ${(err as Error).message}`);
        throw err; // Re-throw so BullMQ retries the job
      }
    }

    if (workerPushToken) {
      await this.notifications.sendDirectPush(
        [workerPushToken],
        'Ainda não avaliaste a empresa ⭐',
        `Como correu o turno "${shiftTitle}"? A tua avaliação demora 10 segundos.`,
        { type: 'rate_employer', shiftId },
      ).catch(() => {});
    }

    this.logger.log(
      `[RatingReminder] Follow-up for shift ${shiftId}: employer=${remindEmployer ? 'nudged' : 'already rated'}, worker=${workerPushToken ? 'nudged' : 'already rated / no token'}`,
    );
  }
}

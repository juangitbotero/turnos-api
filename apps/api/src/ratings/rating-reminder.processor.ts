import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from '../mail/mail.service';
import { RatingReminderJobData } from './ratings.service';

/**
 * Processes the 'rating-reminder' queue.
 * Fires 30 minutes after a shift is completed — sends an email to the employer
 * prompting them to rate the worker on the Turnos Admin dashboard.
 */
@Processor('rating-reminder')
export class RatingReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(RatingReminderProcessor.name);

  constructor(private readonly mail: MailService) {
    super();
  }

  async process(job: Job<RatingReminderJobData>): Promise<void> {
    const { shiftId, shiftTitle, employerEmail, employerName } = job.data;
    this.logger.log(`[RatingReminder] Sending reminder to ${employerEmail} for shift ${shiftId}`);

    try {
      await this.mail.sendMail({
        to: employerEmail,
        subject: `Como correu o turno "${shiftTitle}"? Avalie o trabalhador 🌟`,
        html: `
          <p>Olá <strong>${employerName}</strong>,</p>
          <p>O turno <strong>"${shiftTitle}"</strong> foi concluído.</p>
          <p>Deixe uma avaliação rápida para ajudar a construir a reputação do trabalhador
             e melhorar o mercado de trabalho em Portugal.</p>
          <p style="text-align:center;margin:24px 0">
            <a href="http://localhost:3000/dashboard/ratings"
               style="background:#6a79ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
              Avaliar trabalhador
            </a>
          </p>
          <p style="color:#888;font-size:12px">Este email foi enviado automaticamente pela plataforma Turnos.</p>
        `,
      });
    } catch (err) {
      this.logger.error(`[RatingReminder] Failed to send email to ${employerEmail}: ${(err as Error).message}`);
      throw err; // Re-throw so BullMQ retries the job
    }
  }
}

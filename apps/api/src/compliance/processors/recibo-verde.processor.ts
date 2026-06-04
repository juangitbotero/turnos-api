import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import Expo from 'expo-server-sdk';
import { Worker } from '../../users/entities/worker.entity';
import { ComplianceAuditLog, ComplianceEvent } from '../entities/compliance-audit-log.entity';

export interface ReciboVerdeJobData {
  workerId:     string;
  shiftId:      string;
  shiftTitle:   string;
  shiftDate:    string;    // YYYY-MM-DD
  grossAmount:  number;    // total gross for the shift
  reminderDay:  3 | 5;    // which reminder wave (day 3 or day 5 post-checkout)
}

/**
 * Recibo Verde Reminder Processor — Stint 3 (close-out)
 *
 * Workers on MCD contracts must submit their own "Recibo Verde" (green
 * receipt) via Portal das Finanças (AT) within 5 business days of the
 * shift completion.
 *
 * Two reminder jobs are scheduled after each checkout:
 *   - Day +3 : gentle reminder
 *   - Day +5 : final reminder with urgency
 *
 * Delivery mechanism: Expo Push Notification → worker mobile app.
 * The notification deep-links to /recibo-verde?shiftId=X where workers
 * can see pre-filled values and a direct link to Portal das Finanças.
 */
@Processor('recibo-verde')
export class ReciboVerdeProcessor extends WorkerHost {
  private readonly logger = new Logger(ReciboVerdeProcessor.name);
  private readonly expo = new Expo();

  constructor(
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,

    @InjectRepository(ComplianceAuditLog)
    private readonly auditRepo: Repository<ComplianceAuditLog>,
  ) {
    super();
  }

  async process(job: Job<ReciboVerdeJobData>): Promise<void> {
    const { workerId, shiftId, shiftTitle, shiftDate, grossAmount, reminderDay } = job.data;

    this.logger.log(
      `[ReciboVerde] Day+${reminderDay} reminder for worker ${workerId}, shift ${shiftId}`,
    );

    const worker = await this.workerRepo.findOne({ where: { id: workerId } });
    if (!worker) {
      this.logger.warn(`[ReciboVerde] Worker ${workerId} not found — skipping`);
      return;
    }

    if (!worker.expoPushToken || !Expo.isExpoPushToken(worker.expoPushToken)) {
      this.logger.log(`[ReciboVerde] Worker ${workerId} has no valid push token — skipping`);
      return;
    }

    const { title, body } = this.buildMessage(reminderDay, shiftTitle, grossAmount);

    try {
      const [ticket] = await this.expo.sendPushNotificationsAsync([
        {
          to:    worker.expoPushToken,
          sound: 'default',
          title,
          body,
          data: {
            type:        'recibo_verde',
            shiftId,
            shiftTitle,
            shiftDate,
            grossAmount,
            reminderDay,
          },
          priority: reminderDay === 5 ? 'high' : 'normal',
        },
      ]);

      if (ticket.status === 'error') {
        throw new Error(`Expo ticket error: ${ticket.message}`);
      }

      await this.appendAuditLog({
        event:      ComplianceEvent.RECIBO_VERDE_REMINDER_SENT,
        workerId,
        shiftId,
        details:    { reminderDay, grossAmount, shiftDate },
      });

      this.logger.log(
        `[ReciboVerde] Day+${reminderDay} push sent to worker ${workerId} for shift ${shiftId}`,
      );
    } catch (err) {
      this.logger.error(
        `[ReciboVerde] Failed to send Day+${reminderDay} push for shift ${shiftId}: ${(err as Error).message}`,
      );
      throw err; // Let BullMQ retry
    }
  }

  // ── Message copy ────────────────────────────────────────────────────────────

  private buildMessage(
    reminderDay: 3 | 5,
    shiftTitle: string,
    grossAmount: number,
  ): { title: string; body: string } {
    const amountStr = `€${grossAmount.toFixed(2)}`;

    if (reminderDay === 3) {
      return {
        title: '🟡 Lembra-te do teu Recibo Verde',
        body: `Turno "${shiftTitle}" (${amountStr} bruto) — ainda não submeteste o teu recibo. Abre a app para mais detalhes.`,
      };
    }

    return {
      title: '🔴 Recibo Verde — Prazo a terminar!',
      body: `Turno "${shiftTitle}" (${amountStr} bruto) — submete hoje no Portal das Finanças para evitar multas.`,
    };
  }

  // ── Audit log ───────────────────────────────────────────────────────────────

  private async appendAuditLog(entry: {
    event:       ComplianceEvent;
    workerId:    string;
    shiftId:     string;
    details:     Record<string, unknown>;
  }): Promise<void> {
    await this.auditRepo.save(
      this.auditRepo.create({
        event:      entry.event,
        workerId:   entry.workerId,
        shiftId:    entry.shiftId,
        details:    entry.details,
      }),
    );
  }
}

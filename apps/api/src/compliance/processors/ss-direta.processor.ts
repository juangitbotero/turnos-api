import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { McdContract, SsStatus } from '../entities/mcd-contract.entity';
import { ComplianceAuditLog, ComplianceEvent } from '../entities/compliance-audit-log.entity';
import { MailService } from '../../mail/mail.service';

export interface SsDiretaJobData {
  contractId:      string;
  workerName:      string;
  workerNif:       string;
  employerName:    string;
  employerNipc:    string;
  shiftDate:       string;   // YYYY-MM-DD
  startTime:       string;   // HH:mm
  endTime:         string;   // HH:mm
  role:            string;
  grossHourlyRate: number;
  address:         string;
  accountantEmail: string;
}

/**
 * SS Direta Notification Processor — Stint 4 (Option C / Beta)
 *
 * This processor fires 24h before each confirmed shift and sends the full
 * MCD contract notification data to the employer's accountant by email.
 * The accountant then submits to SS Direta on behalf of the employer.
 *
 * When real SS Direta API credentials are available, only the
 * `submitToSsDireta()` method needs to be replaced — all retry logic,
 * audit logging, and scheduling remain identical.
 */
@Processor('ss-direta')
export class SsDiretaProcessor extends WorkerHost {
  private readonly logger = new Logger(SsDiretaProcessor.name);

  constructor(
    @InjectRepository(McdContract)
    private readonly contractRepo: Repository<McdContract>,

    @InjectRepository(ComplianceAuditLog)
    private readonly auditRepo: Repository<ComplianceAuditLog>,

    private readonly mail: MailService,
  ) {
    super();
  }

  async process(job: Job<SsDiretaJobData>): Promise<void> {
    const data = job.data;
    this.logger.log(`[SS Direta] Processing notification for contract ${data.contractId} (attempt ${job.attemptsMade + 1})`);

    const contract = await this.contractRepo.findOne({
      where: { id: data.contractId },
    });

    if (!contract) {
      this.logger.warn(`[SS Direta] Contract ${data.contractId} not found — skipping`);
      return;
    }

    // Already sent — idempotency guard
    if (contract.ssStatus === SsStatus.EMAIL_SENT || contract.ssStatus === SsStatus.SUBMITTED) {
      this.logger.log(`[SS Direta] Contract ${data.contractId} already notified — skipping`);
      return;
    }

    try {
      await this.sendAccountantEmail(data);

      contract.ssStatus     = SsStatus.EMAIL_SENT;
      contract.ssEmailSentAt = new Date();
      await this.contractRepo.save(contract);

      await this.appendAuditLog({
        event:      ComplianceEvent.SS_EMAIL_SENT,
        contractId: contract.id,
        workerId:   contract.worker?.id ?? null,
        employerId: contract.employer?.id ?? null,
        shiftId:    contract.shift?.id ?? null,
        details: {
          accountantEmail: data.accountantEmail,
          attempt:         job.attemptsMade + 1,
        },
      });

      this.logger.log(`[SS Direta] Notification email sent to ${data.accountantEmail} for contract ${data.contractId}`);
    } catch (err) {
      contract.ssRetryCount += 1;
      await this.contractRepo.save(contract);

      await this.appendAuditLog({
        event:      job.attemptsMade + 1 >= (job.opts.attempts ?? 3)
                      ? ComplianceEvent.SS_FAILED
                      : ComplianceEvent.SS_RETRY,
        contractId: contract.id,
        workerId:   contract.worker?.id ?? null,
        employerId: contract.employer?.id ?? null,
        shiftId:    contract.shift?.id ?? null,
        details: {
          error:   (err as Error).message,
          attempt: job.attemptsMade + 1,
        },
      });

      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 3)) {
        contract.ssStatus = SsStatus.FAILED;
        await this.contractRepo.save(contract);
        this.logger.error(`[SS Direta] All retries exhausted for contract ${data.contractId}`);
      }

      throw err; // Let BullMQ handle retry
    }
  }

  // ── Email template ────────────────────────────────────────────────────────

  private async sendAccountantEmail(data: SsDiretaJobData): Promise<void> {
    const hoursWorked = this.calcHours(data.startTime, data.endTime);
    const totalGross  = (data.grossHourlyRate * hoursWorked).toFixed(2);

    const subject = `[Turnos] Notificação MCD — ${data.workerName} — ${data.shiftDate}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #6a79ff; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #fff; margin: 0;">Notificação de Contrato MCD</h2>
          <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0;">
            Prazo: submeter à Segurança Social Direta até 24h antes do início do turno
          </p>
        </div>

        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb;">
          <h3 style="color: #374151; margin-top: 0;">Dados do Contrato</h3>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 4px; color: #6b7280; width: 45%;">Trabalhador</td>
              <td style="padding: 8px 4px; font-weight: bold; color: #111827;">${data.workerName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 4px; color: #6b7280;">NIF do Trabalhador</td>
              <td style="padding: 8px 4px; font-weight: bold; color: #111827;">${data.workerNif}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 4px; color: #6b7280;">Empregador</td>
              <td style="padding: 8px 4px; font-weight: bold; color: #111827;">${data.employerName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 4px; color: #6b7280;">NIPC do Empregador</td>
              <td style="padding: 8px 4px; font-weight: bold; color: #111827;">${data.employerNipc}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 4px; color: #6b7280;">Função</td>
              <td style="padding: 8px 4px; font-weight: bold; color: #111827;">${data.role}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 4px; color: #6b7280;">Data do Turno</td>
              <td style="padding: 8px 4px; font-weight: bold; color: #111827;">${data.shiftDate}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 4px; color: #6b7280;">Horário</td>
              <td style="padding: 8px 4px; font-weight: bold; color: #111827;">${data.startTime} – ${data.endTime} (${hoursWorked.toFixed(1)}h)</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 4px; color: #6b7280;">Local</td>
              <td style="padding: 8px 4px; font-weight: bold; color: #111827;">${data.address}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 4px; color: #6b7280;">Valor Hora Bruto</td>
              <td style="padding: 8px 4px; font-weight: bold; color: #111827;">€${data.grossHourlyRate.toFixed(2)}/hora</td>
            </tr>
            <tr>
              <td style="padding: 8px 4px; color: #6b7280;">Total Bruto</td>
              <td style="padding: 8px 4px; font-weight: bold; color: #6a79ff; font-size: 16px;">€${totalGross}</td>
            </tr>
          </table>

          <div style="margin-top: 20px; padding: 16px; background: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; font-size: 13px; color: #92400e;">
              <strong>Ação necessária:</strong> Submeta esta notificação de Contrato de Muito Curta Duração (MCD)
              através da <a href="https://www.seg-social.pt/startPage" style="color: #92400e;">Segurança Social Direta</a>
              antes do início do turno em <strong>${data.shiftDate} às ${data.startTime}</strong>.
              A submissão é obrigatória por lei (Lei 93/2019).
            </p>
          </div>
        </div>

        <div style="padding: 16px; text-align: center; font-size: 12px; color: #9ca3af;">
          Gerado automaticamente pela plataforma Turnos · turnos.pt
        </div>
      </div>
    `;

    const to = data.accountantEmail || '';
    if (!to) {
      this.logger.warn(`[SS Direta] No accountant email for contract ${data.contractId} — logging only`);
      return;
    }

    await this.mail.sendMail({ to, subject, html });
  }

  private calcHours(startTime: string, endTime: string): number {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let hours = (eh + em / 60) - (sh + sm / 60);
    if (hours < 0) hours += 24;
    return hours;
  }

  private async appendAuditLog(entry: {
    event:       ComplianceEvent;
    contractId:  string;
    workerId:    string | null;
    employerId:  string | null;
    shiftId:     string | null;
    details:     Record<string, unknown>;
  }): Promise<void> {
    await this.auditRepo.save(
      this.auditRepo.create({
        event:      entry.event,
        contractId: entry.contractId,
        workerId:   entry.workerId,
        employerId: entry.employerId,
        shiftId:    entry.shiftId,
        details:    entry.details,
      }),
    );
  }
}

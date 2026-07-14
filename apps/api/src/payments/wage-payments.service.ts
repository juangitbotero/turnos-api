/**
 * WagePaymentsService — Turnos Pay Link + trust loop (ADR 007 phase 4)
 *
 * Tracks the wage each company owes its worker and facilitates the payment
 * WITHOUT Turnos ever holding the money:
 *   - TURNOS_PAY_LINK: Stripe Checkout Session created as a DIRECT CHARGE on
 *     the worker's own Connect account — the worker is the merchant, funds
 *     settle straight into their Stripe balance and auto-pay-out to their
 *     IBAN. The amount is grossed-up so the company absorbs Stripe's
 *     processing fee and the worker receives the full wage.
 *   - Manual methods (transferência / MB WAY / numerário): tracked via the
 *     mark-paid ("Marcado como pago") + worker confirmation ("Recebi") loop.
 *
 * Unpaid Pay Links follow a reminder ladder: +8h, +24h, +48h final warning,
 * +72h posting blocked (enforced in PaymentsService.assertCanPostShift).
 *
 * Turnos never issues an invoice for the wage — only a receipt. Its own €3
 * fee is billed separately on the monthly subscription invoice.
 */
import { Injectable, Logger, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { WagePayment, WagePaymentStatus, WagePaymentType } from './entities/wage-payment.entity';
import { Employer } from '../users/entities/employer.entity';
import { Worker } from '../users/entities/worker.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

// Stripe EU card pricing — used to gross-up so the worker nets the full wage
const STRIPE_FEE_PCT   = 0.015;
const STRIPE_FEE_FIXED = 0.25;

// Reminder ladder (hours after creation)
export const REMINDER_LADDER_HOURS = [8, 24, 48, 72] as const;
// After this many hours unpaid, the employer cannot post new shifts
export const POSTING_BLOCK_HOURS = 72;

export interface WageReminderJobData {
  wagePaymentId: string;
  step: number; // 0-based index into REMINDER_LADDER_HOURS
}

@Injectable()
export class WagePaymentsService {
  private readonly stripe: InstanceType<typeof Stripe>;
  private readonly logger = new Logger(WagePaymentsService.name);

  constructor(
    @InjectRepository(WagePayment)
    private readonly wageRepo: Repository<WagePayment>,

    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,

    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,

    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,

    @InjectQueue('wage-reminders')
    private readonly reminderQueue: Queue,

    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {
    this.stripe = new Stripe(
      this.config.get<string>('STRIPE_SECRET_KEY', ''),
      { apiVersion: '2026-05-27.dahlia' },
    );
  }

  // ── Creation ───────────────────────────────────────────────────────────────

  /**
   * Create the wage-payment record for a completed shift (all payment methods)
   * and, for TURNOS_PAY_LINK, generate the Stripe Checkout link.
   * Non-blocking from the checkout flow — never throws.
   */
  async createForShiftCompletion(params: {
    shiftId: string;
    employerId: string;
    workerId: string;
    amountEur: number;
    paymentMethod: string;
    shiftTitle: string;
    shiftDate: string;
  }): Promise<WagePayment | null> {
    try {
      const existing = await this.wageRepo.findOne({
        where: { shiftId: params.shiftId, type: WagePaymentType.SHIFT_COMPLETION },
      });
      if (existing) return existing; // idempotent — checkout can only complete once

      return await this.create({ ...params, type: WagePaymentType.SHIFT_COMPLETION });
    } catch (err) {
      this.logger.error(`[Wage] createForShiftCompletion failed for shift ${params.shiftId}: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Create the 2h-minimum wage payment after an unjustified <3h company
   * cancellation (policy v1.1). Always tries the Pay Link rail regardless of
   * the shift's original payment method, falling back to manual tracking.
   */
  async createForCancellationMinimum(params: {
    shiftId: string;
    employerId: string;
    workerId: string;
    amountEur: number;      // 2 × grossHourlyRate
    paymentMethod: string;
    shiftTitle: string;
    shiftDate: string;
    reason: string;
    note?: string;
  }): Promise<WagePayment | null> {
    try {
      const existing = await this.wageRepo.findOne({
        where: { shiftId: params.shiftId, type: WagePaymentType.CANCELLATION_MINIMUM },
      });
      if (existing) return existing;

      return await this.create({
        ...params,
        type: WagePaymentType.CANCELLATION_MINIMUM,
        cancellationReason: params.reason,
        cancellationNote: params.note,
        preferLink: true, // try the Pay Link rail even if the shift's method was manual
      });
    } catch (err) {
      this.logger.error(`[Wage] createForCancellationMinimum failed for shift ${params.shiftId}: ${(err as Error).message}`);
      return null;
    }
  }

  private async create(params: {
    shiftId: string;
    employerId: string;
    workerId: string;
    amountEur: number;
    paymentMethod: string;
    shiftTitle: string;
    shiftDate: string;
    type: WagePaymentType;
    cancellationReason?: string;
    cancellationNote?: string;
    preferLink?: boolean;
  }): Promise<WagePayment> {
    const worker = await this.workerRepo.findOne({
      where: { id: params.workerId },
      relations: ['user'],
    });

    let payLinkUrl: string | null = null;
    let sessionId: string | null = null;
    let processingFee = 0;

    // Pay Link rail — only when the worker completed Stripe Connect onboarding
    const wantsLink = params.paymentMethod === 'TURNOS_PAY_LINK' || params.preferLink === true;
    if (wantsLink && worker?.stripeAccountId) {
      try {
        // Gross-up: charge A so that A - (A×1.5% + €0.25) = wage
        const chargeEur = Math.ceil(((params.amountEur + STRIPE_FEE_FIXED) / (1 - STRIPE_FEE_PCT)) * 100) / 100;
        processingFee = Math.round((chargeEur - params.amountEur) * 100) / 100;

        const webUrl = this.config.get<string>('WEB_ADMIN_URL', 'http://localhost:3000');
        const label = params.type === WagePaymentType.CANCELLATION_MINIMUM
          ? `Mínimo de 2h — cancelamento tardio: ${params.shiftTitle} (${params.shiftDate})`
          : `Salário do turno — ${params.shiftTitle} (${params.shiftDate})`;

        // DIRECT CHARGE on the worker's connected account: the worker is the
        // merchant of record and funds never touch Turnos' balance.
        const session = await this.stripe.checkout.sessions.create(
          {
            mode: 'payment',
            line_items: [{
              quantity: 1,
              price_data: {
                currency: 'eur',
                unit_amount: Math.round(chargeEur * 100),
                product_data: {
                  name: label,
                  description: `Pagamento direto ao trabalhador via Turnos Pay Link. Inclui taxa de processamento (€${processingFee.toFixed(2)}) suportada pela empresa.`,
                },
              },
            }],
            success_url: `${webUrl}/dashboard/shifts?wage_paid=1`,
            cancel_url:  `${webUrl}/dashboard/shifts?wage_paid=0`,
            metadata: {
              type: 'wage_pay_link',
              shiftId: params.shiftId,
              employerId: params.employerId,
              workerId: params.workerId,
            },
          },
          { stripeAccount: worker.stripeAccountId },
        );

        payLinkUrl = session.url ?? null;
        sessionId  = session.id;
      } catch (err) {
        // Fall back to manual tracking — the record is still created
        this.logger.error(`[Wage] Pay Link creation failed for shift ${params.shiftId}: ${(err as Error).message}`);
      }
    }

    const wage = await this.wageRepo.save(this.wageRepo.create({
      shiftId:        params.shiftId,
      employerId:     params.employerId,
      workerId:       params.workerId,
      type:           params.type,
      status:         WagePaymentStatus.PENDING,
      amount:         Math.round(params.amountEur * 100) / 100,
      processingFee,
      paymentMethod:  params.paymentMethod,
      payLinkUrl,
      stripeCheckoutSessionId: sessionId,
      cancellationReason: params.cancellationReason ?? null,
      cancellationNote:   params.cancellationNote ?? null,
      shiftTitle:     params.shiftTitle,
      shiftDate:      params.shiftDate,
    }));

    // Email the employer (Pay Link or payment instructions)
    this.emailEmployerPaymentDue(wage).catch(() => {});

    // Schedule the first reminder (+8h); each reminder schedules the next
    await this.reminderQueue.add(
      'wage-reminder',
      { wagePaymentId: wage.id, step: 0 } satisfies WageReminderJobData,
      { delay: REMINDER_LADDER_HOURS[0] * 60 * 60 * 1000 },
    );

    this.logger.log(`[Wage] ${params.type} €${wage.amount} created for shift ${params.shiftId} (${params.paymentMethod}${payLinkUrl ? ', link generated' : ''})`);
    return wage;
  }

  // ── Webhook confirmation (Pay Link) ────────────────────────────────────────

  /** Called by PaymentsService.handleWebhook on checkout.session.completed. */
  async markPaidFromWebhook(checkoutSessionId: string): Promise<void> {
    const wage = await this.wageRepo.findOne({ where: { stripeCheckoutSessionId: checkoutSessionId } });
    if (!wage) {
      this.logger.warn(`[Wage] Webhook for unknown checkout session ${checkoutSessionId}`);
      return;
    }
    if (wage.status === WagePaymentStatus.PAID) return; // idempotent

    wage.status = WagePaymentStatus.PAID;
    wage.paidAt = new Date();
    await this.wageRepo.save(wage);
    this.logger.log(`[Wage] Pay Link PAID for shift ${wage.shiftId} — €${wage.amount}`);

    // Push to the worker: money is on its way to their IBAN
    const worker = await this.workerRepo.findOne({ where: { id: wage.workerId } });
    if (worker?.expoPushToken) {
      this.notifications.sendDirectPush(
        [worker.expoPushToken],
        'Pagamento recebido ✅',
        `A empresa pagou €${Number(wage.amount).toFixed(2)} pelo turno "${wage.shiftTitle}". O valor chega à tua conta em 1–2 dias úteis.`,
        { type: 'wage_paid', shiftId: wage.shiftId },
      ).catch(() => {});
    }
  }

  // ── Guardrail A: adjust hours / report problem (v2.1, no check-out) ────────

  /**
   * Employer adjusts the hours actually worked before paying — the safety
   * valve for auto-completion (early departure, shift cut short). Floor of
   * 2 hours per policy v1.1. Recomputes the amount and regenerates the Pay
   * Link when one exists.
   */
  async adjustHours(
    employerUserId: string,
    wagePaymentId: string,
    hoursWorked: number,
    note?: string,
  ): Promise<WagePayment> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: employerUserId } } });
    if (!employer) throw new UnauthorizedException('Employer not found');

    const wage = await this.wageRepo.findOne({ where: { id: wagePaymentId } });
    if (!wage) throw new NotFoundException('Pagamento não encontrado');
    if (wage.employerId !== employer.id) throw new UnauthorizedException('Not your payment');
    if (wage.type !== WagePaymentType.SHIFT_COMPLETION) {
      throw new BadRequestException('O mínimo de cancelamento não pode ser ajustado.');
    }
    if (wage.status !== WagePaymentStatus.PENDING) {
      throw new BadRequestException('Só podes ajustar pagamentos ainda pendentes.');
    }

    const shift = await this.shiftRepo.findOne({ where: { id: wage.shiftId } });
    if (!shift) throw new NotFoundException('Turno não encontrado');

    const rate           = Number(shift.grossHourlyRate);
    const originalHours  = Number(wage.amount) / rate;
    const clamped        = Math.min(Math.max(hoursWorked, 2), Math.ceil(originalHours * 100) / 100);
    const newAmount      = Math.round(clamped * rate * 100) / 100;

    if (Math.abs(newAmount - Number(wage.amount)) < 0.01) return wage; // no-op

    // Regenerate the Pay Link with the corrected amount
    if (wage.stripeCheckoutSessionId) {
      const worker = await this.workerRepo.findOne({ where: { id: wage.workerId } });
      try {
        if (worker?.stripeAccountId) {
          await this.stripe.checkout.sessions.expire(
            wage.stripeCheckoutSessionId,
            {},
            { stripeAccount: worker.stripeAccountId },
          ).catch(() => {}); // may already be expired

          const chargeEur = Math.ceil(((newAmount + STRIPE_FEE_FIXED) / (1 - STRIPE_FEE_PCT)) * 100) / 100;
          const webUrl = this.config.get<string>('WEB_ADMIN_URL', 'http://localhost:3000');
          const session = await this.stripe.checkout.sessions.create(
            {
              mode: 'payment',
              line_items: [{
                quantity: 1,
                price_data: {
                  currency: 'eur',
                  unit_amount: Math.round(chargeEur * 100),
                  product_data: {
                    name: `Salário do turno (horas ajustadas: ${clamped}h) — ${wage.shiftTitle} (${wage.shiftDate ?? ''})`,
                  },
                },
              }],
              success_url: `${webUrl}/dashboard/shifts?wage_paid=1`,
              cancel_url:  `${webUrl}/dashboard/shifts?wage_paid=0`,
              metadata: {
                type: 'wage_pay_link',
                shiftId: wage.shiftId,
                employerId: wage.employerId,
                workerId: wage.workerId,
              },
            },
            { stripeAccount: worker.stripeAccountId },
          );
          wage.payLinkUrl              = session.url ?? null;
          wage.stripeCheckoutSessionId = session.id;
          wage.processingFee           = Math.round((chargeEur - newAmount) * 100) / 100;
        }
      } catch (err) {
        this.logger.error(`[Wage] Pay Link regeneration failed for wage ${wage.id}: ${(err as Error).message}`);
      }
    }

    const previousAmount = Number(wage.amount);
    wage.amount           = newAmount;
    wage.cancellationNote = note ?? `Horas ajustadas pela empresa: ${clamped}h (antes: ${originalHours.toFixed(2)}h)`;
    await this.wageRepo.save(wage);

    // The worker must know — and can contest via "Não recebi" / support
    const worker = await this.workerRepo.findOne({ where: { id: wage.workerId } });
    if (worker?.expoPushToken) {
      this.notifications.sendDirectPush(
        [worker.expoPushToken],
        'A empresa ajustou as horas do turno',
        `"${wage.shiftTitle}": €${previousAmount.toFixed(2)} → €${newAmount.toFixed(2)} (${clamped}h). Se não concordas, contesta na app ou contacta suporte@turnos.pt.`,
        { type: 'wage_adjusted', shiftId: wage.shiftId },
      ).catch(() => {});
    }

    this.logger.log(`[Wage] Hours adjusted on ${wage.id}: €${previousAmount} → €${newAmount} (${clamped}h)`);
    return wage;
  }

  /**
   * Employer reports a problem with the completed shift (abandonment,
   * misconduct). Pauses the reminder ladder (UNDER_REVIEW) and alerts ops.
   */
  async reportProblem(
    employerUserId: string,
    wagePaymentId: string,
    category: string,
    note?: string,
  ): Promise<WagePayment> {
    const employer = await this.employerRepo.findOne({
      where: { user: { id: employerUserId } },
      relations: ['user'],
    });
    if (!employer) throw new UnauthorizedException('Employer not found');

    const wage = await this.wageRepo.findOne({ where: { id: wagePaymentId } });
    if (!wage) throw new NotFoundException('Pagamento não encontrado');
    if (wage.employerId !== employer.id) throw new UnauthorizedException('Not your payment');
    if (![WagePaymentStatus.PENDING, WagePaymentStatus.DISPUTED].includes(wage.status)) {
      throw new BadRequestException('Este pagamento já não pode ser reportado.');
    }

    wage.status           = WagePaymentStatus.UNDER_REVIEW;
    wage.cancellationNote = `[PROBLEMA: ${category}] ${note ?? ''}`.trim();
    await this.wageRepo.save(wage);

    await this.mail.sendMail({
      to: 'ops@turnos.pt',
      subject: `⚖️ Problema reportado no turno "${wage.shiftTitle}" — revisão necessária`,
      html: `<p>A empresa <strong>${employer.companyName}</strong> reportou um problema no turno
             <strong>${wage.shiftTitle}</strong> (${wage.shiftDate ?? '—'}).</p>
             <p>Categoria: <strong>${category}</strong></p>
             ${note ? `<p>Descrição: ${note}</p>` : ''}
             <p>Pagamento em causa: €${Number(wage.amount).toFixed(2)} · WagePayment ${wage.id} · Shift ${wage.shiftId}</p>
             <p>O ciclo de lembretes está pausado até decisão (SLA 48h).</p>`,
    }).catch(() => {});

    this.logger.warn(`[Wage] Problem reported on ${wage.id} (${category}) — reminder ladder paused`);
    return wage;
  }

  // ── Trust loop (manual methods) ────────────────────────────────────────────

  /** Employer declares a manual payment done ("Marcado como pago"). */
  async markPaidByEmployer(employerUserId: string, wagePaymentId: string): Promise<WagePayment> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: employerUserId } } });
    if (!employer) throw new UnauthorizedException('Employer not found');

    const wage = await this.wageRepo.findOne({ where: { id: wagePaymentId } });
    if (!wage) throw new NotFoundException('Pagamento não encontrado');
    if (wage.employerId !== employer.id) throw new UnauthorizedException('Not your payment');
    if (wage.status === WagePaymentStatus.PAID || wage.status === WagePaymentStatus.CONFIRMED) {
      return wage; // already settled
    }

    wage.status = WagePaymentStatus.MARKED_PAID;
    wage.paidAt = new Date();
    await this.wageRepo.save(wage);

    // Ask the worker to confirm
    const worker = await this.workerRepo.findOne({ where: { id: wage.workerId } });
    if (worker?.expoPushToken) {
      this.notifications.sendDirectPush(
        [worker.expoPushToken],
        'A empresa marcou o teu pagamento como feito 💶',
        `€${Number(wage.amount).toFixed(2)} pelo turno "${wage.shiftTitle}". Confirma na app se já recebeste.`,
        { type: 'wage_marked_paid', shiftId: wage.shiftId },
      ).catch(() => {});
    }

    return wage;
  }

  /** Worker confirms receipt ("Recebi"). */
  async confirmReceived(workerUserId: string, wagePaymentId: string): Promise<WagePayment> {
    const wage = await this.assertWorkerOwns(workerUserId, wagePaymentId);
    wage.status = WagePaymentStatus.CONFIRMED;
    wage.confirmedAt = new Date();
    return this.wageRepo.save(wage);
  }

  /** Worker flags non-payment ("Não recebi"). */
  async flagNotReceived(workerUserId: string, wagePaymentId: string): Promise<WagePayment> {
    const wage = await this.assertWorkerOwns(workerUserId, wagePaymentId);
    if (wage.status === WagePaymentStatus.PAID) {
      throw new BadRequestException('Este pagamento foi confirmado pelo Stripe — contacta o suporte se não o recebeste.');
    }
    wage.status = WagePaymentStatus.DISPUTED;
    await this.wageRepo.save(wage);

    // Internal flag — ops reviews non-payment disputes
    this.mail.sendMail({
      to: 'ops@turnos.pt',
      subject: `🚩 Não-pagamento reportado — turno "${wage.shiftTitle}"`,
      html: `<p>O trabalhador reportou que <strong>não recebeu €${Number(wage.amount).toFixed(2)}</strong>
             pelo turno <strong>${wage.shiftTitle}</strong> (${wage.shiftDate ?? '—'}).</p>
             <p>Empresa: ${wage.employerId} · Método: ${wage.paymentMethod} · Estado anterior: ${wage.paidAt ? 'marcado como pago' : 'pendente'}.</p>
             <p>WagePayment: ${wage.id} · Shift: ${wage.shiftId}</p>`,
    }).catch(() => {});

    return wage;
  }

  private async assertWorkerOwns(workerUserId: string, wagePaymentId: string): Promise<WagePayment> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } } });
    if (!worker) throw new UnauthorizedException('Worker not found');
    const wage = await this.wageRepo.findOne({ where: { id: wagePaymentId } });
    if (!wage) throw new NotFoundException('Pagamento não encontrado');
    if (wage.workerId !== worker.id) throw new UnauthorizedException('Not your payment');
    return wage;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /** All open (not yet settled) wage payments for the employer dashboard. */
  async getEmployerPending(employerUserId: string): Promise<WagePayment[]> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: employerUserId } } });
    if (!employer) throw new UnauthorizedException('Employer not found');
    return this.wageRepo.find({
      where: {
        employerId: employer.id,
        status: In([WagePaymentStatus.PENDING, WagePaymentStatus.MARKED_PAID, WagePaymentStatus.DISPUTED]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /** Wage payment status for the worker's shift cards. */
  async getWorkerWagePayments(workerUserId: string): Promise<WagePayment[]> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } } });
    if (!worker) throw new UnauthorizedException('Worker not found');
    return this.wageRepo.find({
      where: { workerId: worker.id },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  /** True if the employer has a Pay-Link-or-manual wage unpaid past the block window. */
  async hasOverdueUnpaid(employerId: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - POSTING_BLOCK_HOURS * 60 * 60 * 1000);
    const count = await this.wageRepo.count({
      where: [
        { employerId, status: WagePaymentStatus.PENDING,  createdAt: LessThan(cutoff) },
        { employerId, status: WagePaymentStatus.DISPUTED, createdAt: LessThan(cutoff) },
      ],
    });
    return count > 0;
  }

  // ── Reminder ladder (called by the BullMQ processor) ───────────────────────

  async processReminder(data: WageReminderJobData): Promise<void> {
    const wage = await this.wageRepo.findOne({ where: { id: data.wagePaymentId } });
    if (!wage) return;

    // Settled — stop the ladder
    if ([WagePaymentStatus.PAID, WagePaymentStatus.CONFIRMED, WagePaymentStatus.MARKED_PAID,
         WagePaymentStatus.WAIVED, WagePaymentStatus.UNDER_REVIEW].includes(wage.status)) {
      return;
    }

    wage.remindersSent = data.step + 1;
    await this.wageRepo.save(wage);

    const isFinalWarning = data.step === 2; // +48h
    const isBlockStep    = data.step === 3; // +72h

    if (isBlockStep) {
      await this.emailEmployer(wage,
        '🔒 Publicação de turnos suspensa — pagamento em falta',
        `<p>O pagamento de <strong>€${Number(wage.amount).toFixed(2)}</strong> ao trabalhador pelo turno
         <strong>${wage.shiftTitle}</strong> continua em falta há mais de 72 horas.</p>
         <p><strong>A publicação de novos turnos está suspensa</strong> até este pagamento ser regularizado.</p>
         ${wage.payLinkUrl ? `<p><a href="${wage.payLinkUrl}">Pagar agora →</a></p>` : ''}`,
      );
      this.logger.warn(`[Wage] Employer ${wage.employerId} posting-blocked — wage ${wage.id} unpaid >72h`);
      return; // ladder complete
    }

    await this.emailEmployer(wage,
      isFinalWarning
        ? `⚠️ Último aviso — pagamento pendente do turno "${wage.shiftTitle}"`
        : `Lembrete — pagamento pendente do turno "${wage.shiftTitle}"`,
      `<p>O pagamento de <strong>€${Number(wage.amount).toFixed(2)}</strong> ao trabalhador pelo turno
       <strong>${wage.shiftTitle}</strong> (${wage.shiftDate ?? ''}) ainda está pendente.</p>
       ${wage.payLinkUrl ? `<p><a href="${wage.payLinkUrl}">Pagar agora →</a></p>`
                         : `<p>Método escolhido: ${wage.paymentMethod}. Depois de pagares, marca como pago no dashboard.</p>`}
       ${isFinalWarning ? '<p><strong>Se o pagamento não for regularizado nas próximas 24 horas, a publicação de novos turnos será suspensa.</strong></p>' : ''}`,
    );

    // Schedule the next step
    const nextStep = data.step + 1;
    const delayMs = (REMINDER_LADDER_HOURS[nextStep]! - REMINDER_LADDER_HOURS[data.step]!) * 60 * 60 * 1000;
    await this.reminderQueue.add(
      'wage-reminder',
      { wagePaymentId: wage.id, step: nextStep } satisfies WageReminderJobData,
      { delay: delayMs },
    );
  }

  // ── Emails ─────────────────────────────────────────────────────────────────

  private async emailEmployerPaymentDue(wage: WagePayment): Promise<void> {
    const isCancellation = wage.type === WagePaymentType.CANCELLATION_MINIMUM;
    await this.emailEmployer(wage,
      isCancellation
        ? `Pagamento devido — mínimo de 2h por cancelamento tardio (${wage.shiftTitle})`
        : `Turno concluído — pagar €${Number(wage.amount).toFixed(2)} ao trabalhador (${wage.shiftTitle})`,
      `<p>${isCancellation
          ? `Cancelaste o turno <strong>${wage.shiftTitle}</strong> a menos de 3 horas do início.
             Conforme a política de cancelamento, deves pagar ao trabalhador o mínimo de 2 horas:`
          : `O turno <strong>${wage.shiftTitle}</strong> (${wage.shiftDate ?? ''}) foi concluído.
             Valor a pagar diretamente ao trabalhador:`}</p>
       <p style="font-size:22px"><strong>€${Number(wage.amount).toFixed(2)}</strong>
       ${wage.processingFee > 0 ? ` <small>(+ €${Number(wage.processingFee).toFixed(2)} taxa de processamento)</small>` : ''}</p>
       ${wage.payLinkUrl
          ? `<p><a href="${wage.payLinkUrl}" style="background:#6a79ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">💳 Pagar agora com Turnos Pay Link</a></p>
             <p><small>O pagamento vai diretamente para a conta bancária do trabalhador — a Turnos não recebe nem retém este valor.</small></p>`
          : `<p>Método escolhido: <strong>${wage.paymentMethod}</strong>. Depois de pagares, marca como pago no dashboard Turnos para notificar o trabalhador.</p>`}
       ${!isCancellation
          ? `<p>⭐ Aproveita para <a href="${this.config.get<string>('WEB_ADMIN_URL', 'http://localhost:3000')}/dashboard/ratings">avaliar o trabalhador</a> — demora 10 segundos.</p>
             <p><small>Correu algo mal (saída antecipada, problema no turno)? Ajusta as horas ou reporta o problema no dashboard antes de pagar.</small></p>`
          : ''}`,
    );
  }

  private async emailEmployer(wage: WagePayment, subject: string, html: string): Promise<void> {
    const employer = await this.employerRepo.findOne({
      where: { id: wage.employerId },
      relations: ['user'],
    });
    const to = employer?.user?.email;
    if (!to) return;
    await this.mail.sendMail({ to, subject, html });
  }
}

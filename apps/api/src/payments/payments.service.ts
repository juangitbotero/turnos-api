/**
 * PaymentsService — reworked 2026-07 (business model pivot)
 *
 * Turnos is OUT of the wage money flow: companies pay workers directly.
 * This service only bills Turnos' own revenue:
 *   1. Employer Stripe Customer creation + card setup
 *   2. €45/mo "Turnos Starter" subscription with posting guard
 *   3. Fixed per-shift platform fee (€3 Starter / €2 Pro) recorded at checkout
 *      as a Stripe InvoiceItem → aggregated on the next monthly invoice
 *   4. Cancellation fee: 10% of shift gross when a FILLED shift is cancelled
 *      ≤24h before start (fully to Turnos — no worker share)
 *   5. Worker Stripe Connect onboarding (kept, optional — used by Pay Link)
 *
 * Wage/TSU amounts stored on PaymentRecord are INFORMATIVE only.
 * All amounts in EUR. Stripe API works in cents (×100).
 */
import {
  Injectable, Logger, BadRequestException,
  NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { calculateTSU, TURNOS_FEE_FIXED_EUR, SUBSCRIPTION_TIERS } from '@turnos/shared';
import { PaymentRecord, PaymentStatus, PaymentType } from './entities/payment-record.entity';
import { WagePaymentsService } from './wage-payments.service';
import { Employer } from '../users/entities/employer.entity';
import { Worker } from '../users/entities/worker.entity';
import { Shift } from '../shifts/entities/shift.entity';

const CANCELLATION_FEE_RATE     = 0.10; // 10% of shift gross on late cancellation (fully to Turnos)
const CANCELLATION_WINDOW_HOURS = 24;   // J-1 — hours before shift start that triggers the fee
const SUBSCRIPTION_MONTHLY_EUR  = SUBSCRIPTION_TIERS.STARTER.monthlyEur; // €45/mo Turnos Starter
const MAX_ACTIVE_SHIFTS         = SUBSCRIPTION_TIERS.STARTER.maxActiveShifts; // 15 on Starter (Pro: unlimited)

@Injectable()
export class PaymentsService {
  private readonly stripe: InstanceType<typeof Stripe>;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentRecord)
    private readonly paymentRepo: Repository<PaymentRecord>,

    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,

    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,

    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,

    private readonly config: ConfigService,
    private readonly wagePayments: WagePaymentsService,
  ) {
    this.stripe = new Stripe(
      this.config.get<string>('STRIPE_SECRET_KEY', ''),
      { apiVersion: '2026-05-27.dahlia' },
    );
  }

  // ── Employer: Stripe Customer + subscription ──────────────────────────────

  /**
   * Create or retrieve the Stripe Customer record for this employer.
   * Idempotent — safe to call multiple times.
   */
  async ensureStripeCustomer(employerUserId: string): Promise<Employer> {
    const employer = await this.employerRepo.findOne({
      where: { user: { id: employerUserId } },
      relations: ['user'],
    });
    if (!employer) throw new NotFoundException('Employer not found');

    if (!employer.stripeCustomerId) {
      const customer = await this.stripe.customers.create({
        name:     employer.companyName,
        email:    employer.user?.email,
        metadata: { employerId: employer.id, nipc: employer.nipc },
      });
      employer.stripeCustomerId = customer.id;
      await this.employerRepo.save(employer);
      this.logger.log(`[Payments] Stripe customer created for employer ${employer.id}: ${customer.id}`);
    }

    return employer;
  }

  /**
   * Create a Stripe SetupIntent so the employer can save a card via Stripe Elements.
   * Returns the client_secret for the frontend to confirm.
   */
  async createSetupIntent(employerUserId: string): Promise<{ clientSecret: string; customerId: string }> {
    const employer = await this.ensureStripeCustomer(employerUserId);

    const setupIntent = await this.stripe.setupIntents.create({
      customer:             employer.stripeCustomerId!,
      payment_method_types: ['card'],
      usage:                'off_session',
    });

    return {
      clientSecret: setupIntent.client_secret!,
      customerId:   employer.stripeCustomerId!,
    };
  }

  /**
   * Save the payment method after the employer confirms the card via Stripe Elements.
   * Sets it as the default for future off-session charges.
   */
  async savePaymentMethod(employerUserId: string, paymentMethodId: string): Promise<void> {
    const employer = await this.ensureStripeCustomer(employerUserId);

    // Attach to customer
    await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: employer.stripeCustomerId!,
    });

    // Set as default
    await this.stripe.customers.update(employer.stripeCustomerId!, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    employer.stripePaymentMethodId = paymentMethodId;
    await this.employerRepo.save(employer);
    this.logger.log(`[Payments] Payment method ${paymentMethodId} saved for employer ${employer.id}`);
  }

  /**
   * Create the €45/mo "Turnos Starter" Stripe Subscription for the employer.
   * Requires a payment method already saved (savePaymentMethod called first).
   * Per-shift fees accumulate as pending InvoiceItems and are billed on this
   * subscription's monthly invoice.
   */
  async createSubscription(employerUserId: string): Promise<{ subscriptionId: string; status: string }> {
    const employer = await this.ensureStripeCustomer(employerUserId);

    if (!employer.stripePaymentMethodId) {
      throw new BadRequestException('Adiciona um cartão antes de subscrever o plano.');
    }

    if (employer.stripeSubscriptionId && employer.subscriptionStatus === 'ACTIVE') {
      return { subscriptionId: employer.stripeSubscriptionId, status: 'ACTIVE' };
    }

    const priceId = this.config.get<string>('STRIPE_SUBSCRIPTION_PRICE_ID', '');
    if (!priceId) {
      throw new BadRequestException('Subscription price not configured — contact support.');
    }

    const subscription = await this.stripe.subscriptions.create({
      customer:               employer.stripeCustomerId!,
      items:                  [{ price: priceId }],
      default_payment_method: employer.stripePaymentMethodId,
      expand:                 ['latest_invoice.payment_intent'],
      metadata:               { employerId: employer.id },
    });

    employer.stripeSubscriptionId = subscription.id;
    employer.subscriptionStatus   = subscription.status === 'active' ? 'ACTIVE' : 'INACTIVE';
    employer.subscriptionTier     = 'STARTER';
    await this.employerRepo.save(employer);

    this.logger.log(`[Payments] Subscription ${subscription.id} created for employer ${employer.id}`);
    return { subscriptionId: subscription.id, status: subscription.status };
  }

  /**
   * Cancel the employer's subscription at period end.
   */
  async cancelSubscription(employerUserId: string): Promise<void> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: employerUserId } } });
    if (!employer?.stripeSubscriptionId) return;

    await this.stripe.subscriptions.update(employer.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    this.logger.log(`[Payments] Subscription ${employer.stripeSubscriptionId} set to cancel at period end`);
  }

  /**
   * Guard: check if employer has an active subscription before allowing shift posting.
   * Also enforces the 15-shift concurrent limit.
   */
  async assertCanPostShift(employerUserId: string): Promise<void> {
    // Beta/dev bypass — set BYPASS_SUBSCRIPTION=true in Railway Variables to skip check
    if (process.env['BYPASS_SUBSCRIPTION'] === 'true') return;

    const employer = await this.employerRepo.findOne({ where: { user: { id: employerUserId } } });
    if (!employer) throw new UnauthorizedException('Employer not found');

    if (employer.subscriptionStatus !== 'ACTIVE') {
      throw new BadRequestException(
        'Precisas de uma subscrição ativa para publicar turnos. Ativa o teu plano em Faturação.',
      );
    }

    // Block posting while a wage payment is unpaid past the 72h window
    if (await this.wagePayments.hasOverdueUnpaid(employer.id)) {
      throw new BadRequestException(
        'Tens pagamentos a trabalhadores em falta há mais de 72 horas. Regulariza-os em Turnos → Pagamentos pendentes para voltares a publicar.',
      );
    }

    // Count concurrent open/filled/active shifts (Pro tier: unlimited)
    if (employer.subscriptionTier !== 'PRO' && MAX_ACTIVE_SHIFTS !== null) {
      const activeCount = await this.shiftRepo.count({
        where: {
          employer: { id: employer.id },
          status:   'OPEN' as any,
        },
      });
      if (activeCount >= MAX_ACTIVE_SHIFTS) {
        throw new BadRequestException(
          `O plano atual permite até ${MAX_ACTIVE_SHIFTS} turnos ativos em simultâneo. Cancela ou conclui turnos existentes primeiro.`,
        );
      }
    }
  }

  // ── Worker: Stripe Connect Express onboarding ─────────────────────────────

  /**
   * Create a Stripe Connect Express account for the worker and return the
   * onboarding URL. Worker completes bank setup on Stripe's hosted page.
   */
  async createWorkerConnectAccount(workerUserId: string, returnUrl: string): Promise<{ onboardingUrl: string }> {
    const worker = await this.workerRepo.findOne({
      where: { user: { id: workerUserId } },
      relations: ['user'],
    });
    if (!worker) throw new NotFoundException('Worker not found');

    let accountId = worker.stripeAccountId;

    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type:    'express',
        country: 'PT',
        email:   worker.user?.email,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata:      { workerId: worker.id },
      });
      accountId           = account.id;
      worker.stripeAccountId = account.id;
      await this.workerRepo.save(worker);
      this.logger.log(`[Payments] Stripe Connect account ${account.id} created for worker ${worker.id}`);
    }

    const accountLink = await this.stripe.accountLinks.create({
      account:     accountId,
      refresh_url: returnUrl,
      return_url:  returnUrl,
      type:        'account_onboarding',
    });

    return { onboardingUrl: accountLink.url };
  }

  /**
   * Return the Stripe Express dashboard login link for a worker who has
   * already completed onboarding (to view their payouts).
   */
  async getWorkerDashboardLink(workerUserId: string): Promise<{ url: string }> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } } });
    if (!worker?.stripeAccountId) {
      throw new BadRequestException('Completa o registo bancário primeiro.');
    }

    const loginLink = await this.stripe.accounts.createLoginLink(worker.stripeAccountId);
    return { url: loginLink.url };
  }

  // ── Platform fee on checkout ──────────────────────────────────────────────

  /**
   * Record the fixed platform fee for a completed shift.
   * Called by AttendanceService.checkOut() (non-blocking).
   *
   * The wage is NOT charged here — the company pays the worker directly.
   * The fee (€3 Starter / €2 Pro) is added as a Stripe InvoiceItem, which
   * automatically attaches to the employer's next subscription invoice, so
   * fees accumulate and are billed once a month, itemized per shift.
   * The PaymentRecord also stores the informative wage/TSU breakdown for
   * dashboards and accounting exports.
   */
  async recordShiftFeeOnCheckout(
    shiftId:       string,
    employerId:    string,
    workerId:      string,
    scheduledHours: number,
    grossHourlyRate: number,
    shiftDate:     string,
    shiftTitle:    string,
  ): Promise<void> {
    const employer = await this.employerRepo.findOne({ where: { id: employerId } });

    const tsu         = calculateTSU(grossHourlyRate);
    const grossAmount = tsu.grossAmount * scheduledHours;
    const workerNet   = tsu.workerNetAmount * scheduledHours;      // informative
    const employerTsu = tsu.employerContribution * scheduledHours; // informative
    const workerTsu   = tsu.workerDeduction * scheduledHours;      // informative

    const tier   = employer?.subscriptionTier === 'PRO' ? SUBSCRIPTION_TIERS.PRO : SUBSCRIPTION_TIERS.STARTER;
    const feeEur = tier.shiftFeeEur ?? TURNOS_FEE_FIXED_EUR;

    const record = await this.paymentRepo.save(
      this.paymentRepo.create({
        shiftId,
        employerId,
        workerId,
        type:           PaymentType.SHIFT_FEE,
        status:         PaymentStatus.PENDING,
        grossAmount,
        turnosFee:      feeEur,
        workerNet,
        employerTsu,
        workerTsu,
        scheduledHours,
        shiftDate,
      }),
    );

    if (!employer?.stripeCustomerId) {
      this.logger.warn(`[Payments] Employer ${employerId} has no Stripe customer — fee for shift ${shiftId} recorded but not invoiced`);
      return;
    }

    try {
      // Pending invoice items are swept onto the next subscription invoice
      // automatically — this is what aggregates the fees monthly, one line per shift.
      const invoiceItem = await this.stripe.invoiceItems.create({
        customer:    employer.stripeCustomerId,
        amount:      Math.round(feeEur * 100),
        currency:    'eur',
        description: `Taxa de serviço Turnos — ${shiftTitle} (${shiftDate})`,
        metadata:    { shiftId, employerId, workerId, shiftDate, type: 'shift_fee' },
      });

      record.stripeChargeId = invoiceItem.id; // invoice item ref (billed on next invoice)
      record.status         = PaymentStatus.SUCCEEDED;
      await this.paymentRepo.save(record);

      this.logger.log(`[Payments] Shift fee €${feeEur.toFixed(2)} queued on next invoice for employer ${employerId} (shift ${shiftId})`);
    } catch (err) {
      record.status        = PaymentStatus.FAILED;
      record.failureReason = (err as Error).message;
      await this.paymentRepo.save(record);
      this.logger.error(`[Payments] Shift fee invoicing failed for shift ${shiftId}: ${(err as Error).message}`);
      // Not re-thrown — non-blocking from checkout flow. Admin will see FAILED record.
    }
  }

  // Cancellation policy v1.1: the interim 10%-fee methods were removed —
  // <3h unjustified cancellations now owe the worker a 2h minimum via
  // WagePaymentsService.createForCancellationMinimum() plus the normal €3
  // fee, orchestrated by ShiftsService.cancel().

  // ── Stripe webhook handler ────────────────────────────────────────────────

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET', '');
    // Pay Link checkout sessions live on the WORKERS' connected accounts, so
    // their events arrive via a separate Connect webhook endpoint with its own
    // signing secret. Try the platform secret first, then the Connect one.
    const connectSecret = this.config.get<string>('STRIPE_CONNECT_WEBHOOK_SECRET', '');

    let event: ReturnType<typeof this.stripe.webhooks.constructEvent>;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (platformErr) {
      if (!connectSecret) {
        throw new BadRequestException(`Webhook signature verification failed: ${(platformErr as Error).message}`);
      }
      try {
        event = this.stripe.webhooks.constructEvent(payload, signature, connectSecret);
      } catch (err) {
        throw new BadRequestException(`Webhook signature verification failed: ${(err as Error).message}`);
      }
    }

    this.logger.log(`[Payments] Webhook received: ${event.type}`);

    // event.data.object is typed as Stripe.Event.Data.Object (a union) — cast to access
    // the specific fields we need from each event type.
    const obj = event.data.object as unknown as Record<string, unknown>;

    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handleSubscriptionActive(obj['customer'] as string);
        break;
      case 'invoice.payment_failed':
        await this.handleSubscriptionPastDue(obj['customer'] as string);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancelled(obj['customer'] as string);
        break;
      case 'checkout.session.completed': {
        // Turnos Pay Link — direct charge on the worker's Connect account.
        // Requires a Connect webhook endpoint in the Stripe Dashboard
        // ("Listen to events on connected accounts") pointing at this URL.
        const metadata = obj['metadata'] as Record<string, string> | undefined;
        if (metadata?.['type'] === 'wage_pay_link') {
          await this.wagePayments.markPaidFromWebhook(obj['id'] as string);
        }
        break;
      }
      default:
        this.logger.debug(`[Payments] Unhandled webhook event: ${event.type}`);
    }
  }

  private async handleSubscriptionActive(customerId: string): Promise<void> {
    await this.employerRepo.update(
      { stripeCustomerId: customerId },
      { subscriptionStatus: 'ACTIVE', subscriptionTier: 'STARTER' },
    );
    this.logger.log(`[Payments] Subscription activated for customer ${customerId}`);
  }

  private async handleSubscriptionPastDue(customerId: string): Promise<void> {
    await this.employerRepo.update(
      { stripeCustomerId: customerId },
      { subscriptionStatus: 'PAST_DUE' },
    );
    this.logger.warn(`[Payments] Subscription past due for customer ${customerId}`);
  }

  private async handleSubscriptionCancelled(customerId: string): Promise<void> {
    await this.employerRepo.update(
      { stripeCustomerId: customerId },
      { subscriptionStatus: 'CANCELLED', subscriptionTier: 'NONE' },
    );
    this.logger.warn(`[Payments] Subscription cancelled for customer ${customerId}`);
  }

  // ── Employer spending dashboard ───────────────────────────────────────────

  async getEmployerSpending(employerUserId: string, period: 'month' | 'year', month?: number, year?: number): Promise<{
    totalGross:    number;
    turnosFees:    number;
    employerTsu:   number;
    shiftCount:    number;
    avgCostPerShift: number;
    records:       PaymentRecord[];
    monthlyBreakdown?: { month: string; gross: number; tsu: number }[];
  }> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: employerUserId } } });
    if (!employer) throw new NotFoundException('Employer not found');

    const now         = new Date();
    const targetYear  = year  ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1;

    let fromDate: string;
    let toDate:   string;

    if (period === 'month') {
      fromDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();
      toDate   = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${lastDay}`;
    } else {
      fromDate = `${targetYear}-01-01`;
      toDate   = `${targetYear}-12-31`;
    }

    const records = await this.paymentRepo.find({
      where: {
        employerId: employer.id,
        // SHIFT_FEE = current model (informative gross + fee); SHIFT_CHARGE = legacy rows
        type:       In([PaymentType.SHIFT_FEE, PaymentType.SHIFT_CHARGE]),
        status:     PaymentStatus.SUCCEEDED,
        shiftDate:  Between(fromDate, toDate) as any,
      },
      order: { createdAt: 'DESC' },
    });

    const totalGross     = records.reduce((s, r) => s + Number(r.grossAmount),  0);
    const turnosFees     = records.reduce((s, r) => s + Number(r.turnosFee),    0);
    const employerTsu    = records.reduce((s, r) => s + Number(r.employerTsu),  0);
    const shiftCount     = records.length;
    const avgCostPerShift = shiftCount > 0 ? (totalGross + employerTsu) / shiftCount : 0;

    // Monthly breakdown for year view
    let monthlyBreakdown: { month: string; gross: number; tsu: number }[] | undefined;
    if (period === 'year') {
      const byMonth: Record<string, { gross: number; tsu: number }> = {};
      for (const r of records) {
        const key = r.shiftDate?.slice(0, 7) ?? 'unknown';
        if (!byMonth[key]) byMonth[key] = { gross: 0, tsu: 0 };
        byMonth[key].gross += Number(r.grossAmount);
        byMonth[key].tsu   += Number(r.employerTsu);
      }
      monthlyBreakdown = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, ...v }));
    }

    return { totalGross, turnosFees, employerTsu, shiftCount, avgCostPerShift, records, monthlyBreakdown };
  }

  // ── Worker earnings dashboard ─────────────────────────────────────────────

  async getWorkerEarnings(workerUserId: string, period: 'day' | 'month' | 'year', date?: string, month?: number, year?: number): Promise<{
    totalGross:      number;
    turnosFees:      number;
    workerNet:       number;
    workerTsuOwed:   number;      // 11% of gross — worker must pay to State
    shiftCount:      number;
    records:         PaymentRecord[];
  }> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: workerUserId } } });
    if (!worker) throw new NotFoundException('Worker not found');

    const now         = new Date();
    const targetYear  = year  ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetDate  = date  ?? now.toISOString().slice(0, 10);

    let fromDate: string;
    let toDate:   string;

    if (period === 'day') {
      fromDate = targetDate;
      toDate   = targetDate;
    } else if (period === 'month') {
      fromDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();
      toDate   = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${lastDay}`;
    } else {
      fromDate = `${targetYear}-01-01`;
      toDate   = `${targetYear}-12-31`;
    }

    const records = await this.paymentRepo.find({
      where: {
        workerId: worker.id,
        // SHIFT_FEE rows carry the informative wage breakdown for the new model
        // (company pays worker directly); WORKER_PAYOUT = legacy payout rows.
        type:     In([PaymentType.SHIFT_FEE, PaymentType.WORKER_PAYOUT]),
        status:   PaymentStatus.SUCCEEDED,
        shiftDate: Between(fromDate, toDate) as any,
      },
      order: { createdAt: 'DESC' },
    });

    const totalGross    = records.reduce((s, r) => s + Number(r.grossAmount),  0);
    const workerNet     = records.reduce((s, r) => s + Number(r.workerNet),    0);
    const workerTsuOwed = records.reduce((s, r) => s + Number(r.workerTsu),    0);

    // turnosFees kept for mobile API compatibility — always 0 in the new model
    // (the platform fee is billed to the company, never deducted from the worker).
    return { totalGross, turnosFees: 0, workerNet, workerTsuOwed, shiftCount: records.length, records };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private calcHours(startTime: string, endTime: string): number {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let h = (eh + em / 60) - (sh + sm / 60);
    if (h < 0) h += 24;
    return h;
  }
}

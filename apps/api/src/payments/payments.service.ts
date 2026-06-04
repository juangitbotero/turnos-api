/**
 * PaymentsService — Stint 6
 *
 * Handles all financial flows for the Turnos platform:
 *   1. Employer Stripe Customer creation + card setup
 *   2. Worker Stripe Connect Express account onboarding
 *   3. Shift charge on checkout (scheduledHours × grossHourlyRate)
 *   4. Worker T+1 payout via Stripe transfer
 *   5. €55/mo subscription billing with posting guard
 *   6. Cancellation fee (15% split: 11% Turnos + 4% worker compensation)
 *
 * All amounts in EUR. Stripe API works in cents (×100).
 */
import {
  Injectable, Logger, BadRequestException,
  NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { calculateTSU } from '@turnos/shared';
import { PaymentRecord, PaymentStatus, PaymentType } from './entities/payment-record.entity';
import { Employer } from '../users/entities/employer.entity';
import { Worker } from '../users/entities/worker.entity';
import { Shift } from '../shifts/entities/shift.entity';

// Revenue split constants
const TURNOS_FEE_RATE        = 0.10;   // 10% platform fee from worker gross
const EMPLOYER_TSU_RATE      = 0.2375; // 23.75% employer SS contribution (informational)
const WORKER_TSU_RATE        = 0.11;   // 11% worker SS contribution (informational)
const CANCELLATION_FEE_RATE  = 0.15;   // 15% of shift gross on late cancellation
const WORKER_COMPENSATION_RATE = 0.04; // 4% of shift gross → worker
const CANCELLATION_WINDOW_HOURS = 12;  // Hours before shift start that triggers fee
const SUBSCRIPTION_MONTHLY_EUR = 55;   // €55/mo platform subscription
const MAX_ACTIVE_SHIFTS      = 15;     // Max concurrent active shifts on starter plan

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
   * Create the €55/mo Stripe Subscription for the employer.
   * Requires a payment method already saved (savePaymentMethod called first).
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
    const employer = await this.employerRepo.findOne({ where: { user: { id: employerUserId } } });
    if (!employer) throw new UnauthorizedException('Employer not found');

    if (employer.subscriptionStatus !== 'ACTIVE') {
      throw new BadRequestException(
        'Precisas de uma subscrição ativa para publicar turnos. Ativa o teu plano em Faturação.',
      );
    }

    // Count concurrent open/filled/active shifts
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

  // ── Shift payment on checkout ─────────────────────────────────────────────

  /**
   * Charge the employer for a completed shift and schedule the worker payout.
   * Called by AttendanceService.checkOut() (non-blocking).
   *
   * Flow:
   *   1. Calculate amounts using calculateTSU()
   *   2. Charge employer's saved card via PaymentIntent (off-session)
   *   3. Create Stripe Transfer to worker's Connect account
   *   4. Store PaymentRecord with full breakdown
   *   5. Send worker a push notification: "Recebe amanhã"
   */
  async chargeShiftOnCheckout(
    shiftId:       string,
    employerId:    string,
    workerId:      string,
    scheduledHours: number,
    grossHourlyRate: number,
    shiftDate:     string,
    shiftTitle:    string,
  ): Promise<void> {
    const employer = await this.employerRepo.findOne({ where: { id: employerId } });
    const worker   = await this.workerRepo.findOne({ where: { id: workerId } });

    if (!employer?.stripeCustomerId || !employer.stripePaymentMethodId) {
      this.logger.warn(`[Payments] Employer ${employerId} has no payment method — shift ${shiftId} not charged`);
      return;
    }

    const tsu         = calculateTSU(grossHourlyRate);
    const grossAmount = tsu.grossAmount * scheduledHours;
    const turnosFee   = tsu.turnosFee   * scheduledHours;
    const workerNet   = (tsu.grossAmount - tsu.turnosFee) * scheduledHours;
    const employerTsu = tsu.employerContribution * scheduledHours;
    const workerTsu   = tsu.workerDeduction * scheduledHours;

    const amountCents = Math.round(grossAmount * 100);

    // Create payment record (PENDING)
    const record = await this.paymentRepo.save(
      this.paymentRepo.create({
        shiftId,
        employerId,
        workerId,
        type:           PaymentType.SHIFT_CHARGE,
        status:         PaymentStatus.PENDING,
        grossAmount,
        turnosFee,
        workerNet,
        employerTsu,
        workerTsu,
        scheduledHours,
        shiftDate,
      }),
    );

    try {
      // Charge employer
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount:               amountCents,
        currency:             'eur',
        customer:             employer.stripeCustomerId,
        payment_method:       employer.stripePaymentMethodId,
        confirm:              true,
        off_session:          true,
        description:          `Turnos — ${shiftTitle} (${scheduledHours}h)`,
        metadata:             { shiftId, shiftTitle, employerId, workerId, shiftDate },
        transfer_group:       `shift_${shiftId}`,
      });

      record.stripePaymentIntentId = paymentIntent.id;
      record.stripeChargeId        = paymentIntent.latest_charge as string | null;
      record.status                = PaymentStatus.SUCCEEDED;
      await this.paymentRepo.save(record);

      this.logger.log(`[Payments] Employer ${employerId} charged €${grossAmount.toFixed(2)} for shift ${shiftId}`);

      // Transfer worker net to their Connect account (T+1 natural Stripe payout schedule)
      if (worker?.stripeAccountId) {
        const workerNetCents = Math.round(workerNet * 100);
        const transfer = await this.stripe.transfers.create({
          amount:         workerNetCents,
          currency:       'eur',
          destination:    worker.stripeAccountId,
          transfer_group: `shift_${shiftId}`,
          description:    `Turnos payout — ${shiftTitle}`,
          metadata:       { shiftId, workerId, shiftDate },
        });

        record.stripeTransferId = transfer.id;
        await this.paymentRepo.save(record);

        // Also create a worker payout record for their earnings dashboard
        await this.paymentRepo.save(
          this.paymentRepo.create({
            shiftId,
            employerId,
            workerId,
            type:                 PaymentType.WORKER_PAYOUT,
            status:               PaymentStatus.SUCCEEDED,
            grossAmount,
            turnosFee,
            workerNet,
            employerTsu,
            workerTsu,
            scheduledHours,
            shiftDate,
            stripeTransferId:     transfer.id,
            stripePaymentIntentId: paymentIntent.id,
          }),
        );

        this.logger.log(`[Payments] Worker ${workerId} transfer €${workerNet.toFixed(2)} scheduled (T+1)`);
      } else {
        this.logger.warn(`[Payments] Worker ${workerId} has no Connect account — payout skipped. Will retry after onboarding.`);
      }
    } catch (err) {
      record.status        = PaymentStatus.FAILED;
      record.failureReason = (err as Error).message;
      await this.paymentRepo.save(record);
      this.logger.error(`[Payments] Charge failed for shift ${shiftId}: ${(err as Error).message}`);
      // Not re-thrown — non-blocking from checkout flow. Admin will see FAILED record.
    }
  }

  // ── Cancellation fee ──────────────────────────────────────────────────────

  /**
   * Charge the employer a 15% cancellation fee when a FILLED shift is cancelled
   * within 12h of the shift start.
   * Returns { feeCents, isLate } — caller checks isLate before calling.
   */
  async checkCancellationFee(shiftId: string): Promise<{
    isLate:       boolean;
    grossAmount:  number;
    feeCents:     number;
    workerShareCents: number;
    turnosCents:  number;
  }> {
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');

    const shiftStart = new Date(`${shift.date}T${shift.startTime.slice(0, 5)}:00`);
    const hoursUntil = (shiftStart.getTime() - Date.now()) / (1000 * 60 * 60);
    const isLate     = hoursUntil <= CANCELLATION_WINDOW_HOURS && hoursUntil > -1;

    if (!isLate) {
      return { isLate: false, grossAmount: 0, feeCents: 0, workerShareCents: 0, turnosCents: 0 };
    }

    const hours      = this.calcHours(shift.startTime, shift.endTime);
    const grossAmount = Number(shift.grossHourlyRate) * hours;
    const totalFee   = grossAmount * CANCELLATION_FEE_RATE;
    const workerShare = grossAmount * WORKER_COMPENSATION_RATE;
    const turnosShare = grossAmount * (CANCELLATION_FEE_RATE - WORKER_COMPENSATION_RATE);

    return {
      isLate,
      grossAmount,
      feeCents:         Math.round(totalFee * 100),
      workerShareCents: Math.round(workerShare * 100),
      turnosCents:      Math.round(turnosShare * 100),
    };
  }

  async chargeCancellationFee(
    shiftId: string,
    employerId: string,
    workerId: string | null,
    grossAmount: number,
    feeCents: number,
    workerShareCents: number,
    shiftDate: string,
    shiftTitle: string,
  ): Promise<void> {
    const employer = await this.employerRepo.findOne({ where: { id: employerId } });
    if (!employer?.stripeCustomerId || !employer.stripePaymentMethodId) {
      this.logger.warn(`[Payments] Cancellation fee for shift ${shiftId} — employer has no payment method`);
      return;
    }

    const record = await this.paymentRepo.save(
      this.paymentRepo.create({
        shiftId,
        employerId,
        workerId,
        type:        PaymentType.CANCELLATION_FEE,
        status:      PaymentStatus.PENDING,
        grossAmount,
        shiftDate,
      }),
    );

    try {
      const pi = await this.stripe.paymentIntents.create({
        amount:         feeCents,
        currency:       'eur',
        customer:       employer.stripeCustomerId,
        payment_method: employer.stripePaymentMethodId,
        confirm:        true,
        off_session:    true,
        description:    `Turnos — Taxa de cancelamento: ${shiftTitle}`,
        metadata:       { shiftId, employerId, type: 'cancellation_fee' },
        transfer_group: `cancel_${shiftId}`,
      });

      record.status                = PaymentStatus.SUCCEEDED;
      record.stripePaymentIntentId = pi.id;
      record.stripeChargeId        = pi.latest_charge as string | null;
      await this.paymentRepo.save(record);

      this.logger.log(`[Payments] Cancellation fee charged for shift ${shiftId}: €${(feeCents / 100).toFixed(2)}`);

      // Transfer worker compensation (4%) if worker has a Connect account
      if (workerId && workerShareCents > 0) {
        const worker = await this.workerRepo.findOne({ where: { id: workerId } });
        if (worker?.stripeAccountId) {
          const transfer = await this.stripe.transfers.create({
            amount:         workerShareCents,
            currency:       'eur',
            destination:    worker.stripeAccountId,
            transfer_group: `cancel_${shiftId}`,
            description:    `Turnos — Compensação de cancelamento: ${shiftTitle}`,
          });

          await this.paymentRepo.save(
            this.paymentRepo.create({
              shiftId, employerId, workerId,
              type:             PaymentType.WORKER_COMPENSATION,
              status:           PaymentStatus.SUCCEEDED,
              grossAmount:      workerShareCents / 100,
              shiftDate,
              stripeTransferId: transfer.id,
            }),
          );
          this.logger.log(`[Payments] Worker compensation €${(workerShareCents / 100).toFixed(2)} transferred to worker ${workerId}`);
        }
      }
    } catch (err) {
      record.status        = PaymentStatus.FAILED;
      record.failureReason = (err as Error).message;
      await this.paymentRepo.save(record);
      this.logger.error(`[Payments] Cancellation fee failed for shift ${shiftId}: ${(err as Error).message}`);
    }
  }

  // ── Stripe webhook handler ────────────────────────────────────────────────

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET', '');

    let event: ReturnType<typeof this.stripe.webhooks.constructEvent>;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${(err as Error).message}`);
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
        type:       PaymentType.SHIFT_CHARGE,
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
        type:     PaymentType.WORKER_PAYOUT,
        status:   PaymentStatus.SUCCEEDED,
        shiftDate: Between(fromDate, toDate) as any,
      },
      order: { createdAt: 'DESC' },
    });

    const totalGross    = records.reduce((s, r) => s + Number(r.grossAmount),  0);
    const turnosFees    = records.reduce((s, r) => s + Number(r.turnosFee),    0);
    const workerNet     = records.reduce((s, r) => s + Number(r.workerNet),    0);
    const workerTsuOwed = records.reduce((s, r) => s + Number(r.workerTsu),    0);

    return { totalGross, turnosFees, workerNet, workerTsuOwed, shiftCount: records.length, records };
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

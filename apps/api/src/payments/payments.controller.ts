import {
  Controller, Post, Get, Body, Req, Res, Query, Param,
  UseGuards, RawBodyRequest, Headers, HttpCode,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators';
import { PaymentsService } from './payments.service';
import { WagePaymentsService } from './wage-payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly wagePayments: WagePaymentsService,
  ) {}

  // ── Employer: card + subscription ─────────────────────────────────────────

  /** Create a SetupIntent — frontend uses client_secret with Stripe Elements to save card */
  @Post('employer/setup-intent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  createSetupIntent(@Req() req: Request & { user: { userId: string } }) {
    return this.payments.createSetupIntent(req.user.userId);
  }

  /** Called after Stripe Elements confirms the card — saves paymentMethodId */
  @Post('employer/save-payment-method')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  savePaymentMethod(
    @Req() req: Request & { user: { userId: string } },
    @Body() body: { paymentMethodId: string },
  ) {
    return this.payments.savePaymentMethod(req.user.userId, body.paymentMethodId);
  }

  /** Subscribe to the €55/mo platform plan */
  @Post('employer/subscribe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  subscribe(@Req() req: Request & { user: { userId: string } }) {
    return this.payments.createSubscription(req.user.userId);
  }

  /** Cancel subscription at period end */
  @Post('employer/cancel-subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  cancelSubscription(@Req() req: Request & { user: { userId: string } }) {
    return this.payments.cancelSubscription(req.user.userId);
  }

  /** Spending dashboard — period: 'month' | 'year' */
  @Get('employer/spending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  getSpending(
    @Req() req: Request & { user: { userId: string } },
    @Query('period') period: 'month' | 'year' = 'month',
    @Query('month')  month?: string,
    @Query('year')   year?:  string,
  ) {
    return this.payments.getEmployerSpending(
      req.user.userId,
      period,
      month  ? parseInt(month)  : undefined,
      year   ? parseInt(year)   : undefined,
    );
  }

  // ── Worker: Connect onboarding + earnings ─────────────────────────────────

  /** Start Stripe Express onboarding — returns hosted URL */
  @Post('worker/connect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WORKER')
  createConnectAccount(
    @Req() req: Request & { user: { userId: string } },
    @Body() body: { returnUrl?: string },
  ) {
    // Stripe requires an https return URL — default to our bounce page, which
    // sends the worker back to the app (turnos:// deep link).
    const apiUrl = process.env['API_URL'] ?? 'http://localhost:3001';
    const returnUrl = body.returnUrl ?? `${apiUrl.replace(/\/api\/?$/, '')}/api/payments/connect/return`;
    return this.payments.createWorkerConnectAccount(req.user.userId, returnUrl);
  }

  /** Pay Link activation status for the worker's card */
  @Get('worker/connect/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WORKER')
  getConnectStatus(@Req() req: Request & { user: { userId: string } }) {
    return this.payments.getWorkerConnectStatus(req.user.userId);
  }

  /**
   * Public bounce page — Stripe redirects the worker here after onboarding.
   * Shows a success message and deep-links back into the app.
   */
  @Get('connect/return')
  connectReturn(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html lang="pt"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Turnos — Ativação concluída</title></head>
      <body style="font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:90vh;text-align:center;padding:24px;background:#fafdff">
        <div style="font-size:56px">✅</div>
        <h1 style="color:#1a1a2e;font-size:22px">Registo Stripe concluído</h1>
        <p style="color:#555;max-width:320px;line-height:1.5">Já podes fechar esta janela e voltar à app Turnos. O estado do Pay Link atualiza automaticamente.</p>
        <a href="turnos://earnings" style="margin-top:16px;background:#6a79ff;color:#fff;padding:14px 28px;border-radius:24px;text-decoration:none;font-weight:700">Voltar à app Turnos</a>
      </body></html>`);
  }

  /** Get Stripe Express dashboard login link (for worker to see their payouts) */
  @Get('worker/dashboard-link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WORKER')
  getDashboardLink(@Req() req: Request & { user: { userId: string } }) {
    return this.payments.getWorkerDashboardLink(req.user.userId);
  }

  /** Worker earnings — period: 'day' | 'month' | 'year' */
  @Get('worker/earnings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WORKER')
  getEarnings(
    @Req() req: Request & { user: { userId: string } },
    @Query('period') period: 'day' | 'month' | 'year' = 'month',
    @Query('date')   date?:  string,
    @Query('month')  month?: string,
    @Query('year')   year?:  string,
  ) {
    return this.payments.getWorkerEarnings(
      req.user.userId,
      period,
      date,
      month ? parseInt(month) : undefined,
      year  ? parseInt(year)  : undefined,
    );
  }

  // ── Wage payments (Pay Link + trust loop) ─────────────────────────────────

  /** Employer: open wage payments (pending / marked-paid / disputed) */
  @Get('wages/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  getPendingWages(@Req() req: Request & { user: { userId: string } }) {
    return this.wagePayments.getEmployerPending(req.user.userId);
  }

  /** Employer: declare a manual payment done ("Marcado como pago") */
  @Post('wages/:id/mark-paid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  markWagePaid(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.wagePayments.markPaidByEmployer(req.user.userId, id);
  }

  /** Employer: adjust the hours actually worked before paying (2h floor) */
  @Post('wages/:id/adjust-hours')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  adjustWageHours(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
    @Body() body: { hoursWorked: number; note?: string },
  ) {
    return this.wagePayments.adjustHours(req.user.userId, id, Number(body.hoursWorked), body.note);
  }

  /** Employer: report a problem with the completed shift (pauses reminders, ops review) */
  @Post('wages/:id/report-problem')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  reportWageProblem(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
    @Body() body: { category: string; note?: string },
  ) {
    return this.wagePayments.reportProblem(req.user.userId, id, body.category, body.note);
  }

  /** Worker: wage payment status for their shifts */
  @Get('wages/mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WORKER')
  getMyWages(@Req() req: Request & { user: { userId: string } }) {
    return this.wagePayments.getWorkerWagePayments(req.user.userId);
  }

  /** Worker: confirm receipt ("Recebi") */
  @Post('wages/:id/confirm-received')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WORKER')
  confirmWageReceived(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.wagePayments.confirmReceived(req.user.userId, id);
  }

  /** Worker: flag non-payment ("Não recebi") */
  @Post('wages/:id/not-received')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WORKER')
  flagWageNotReceived(
    @Req() req: Request & { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.wagePayments.flagNotReceived(req.user.userId, id);
  }

  // ── Stripe webhook (no auth — Stripe signs the payload) ───────────────────

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req()     req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new Error('Raw body not available — ensure rawBody: true in NestJS bootstrap');
    }
    await this.payments.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}

import {
  Controller, Post, Get, Body, Req, Query,
  UseGuards, RawBodyRequest, Headers, HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

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
    const returnUrl = body.returnUrl ?? 'exp://localhost:8081/earnings';
    return this.payments.createWorkerConnectAccount(req.user.userId, returnUrl);
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

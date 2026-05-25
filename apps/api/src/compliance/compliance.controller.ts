import {
  Controller, Get, Patch, Body, Query, Request, UseGuards,
} from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators';

@Controller('compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  // ── Employer endpoints ────────────────────────────────────────────────────

  /**
   * GET /compliance/employer/tsu-report?month=5&year=2026
   * Monthly TSU aggregate report for employer accounting.
   * Returns per-shift breakdown + totals (gross, employer TSU 23.75%, worker TSU 11%, net).
   */
  @Get('employer/tsu-report')
  @Roles('EMPLOYER')
  getTsuReport(
    @Request() req: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.complianceService.getTsuReport(
      req.user.userId,
      month ? Number(month) : undefined,
      year  ? Number(year)  : undefined,
    );
  }

  /**
   * GET /compliance/employer/mcd-contracts
   * List all MCD contracts created for this employer with their SS notification status.
   */
  @Get('employer/mcd-contracts')
  @Roles('EMPLOYER')
  getMcdContracts(@Request() req: any) {
    return this.complianceService.getMcdContracts(req.user.userId);
  }

  /**
   * GET /compliance/employer/audit-log
   * Immutable ACT audit trail — all compliance events for this employer.
   * Export this for labour inspections (ACT — Autoridade para as Condições do Trabalho).
   */
  @Get('employer/audit-log')
  @Roles('EMPLOYER')
  getAuditLog(@Request() req: any) {
    return this.complianceService.getAuditLog(req.user.userId);
  }

  // ── Worker endpoints ──────────────────────────────────────────────────────

  /**
   * GET /compliance/worker/dependency
   * Worker's economic dependency breakdown per employer (current year).
   * Includes platform earnings + declared external income in calculation.
   */
  @Get('worker/dependency')
  @Roles('WORKER')
  getWorkerDependency(@Request() req: any) {
    return this.complianceService.getWorkerDependencies(req.user.userId);
  }

  /**
   * PATCH /compliance/worker/external-income
   * Update worker's self-declared monthly income from outside Turnos.
   * Used in economic dependency calculation (Agenda do Trabalho Digno).
   * Body: { amount: number } — monthly amount in EUR
   */
  @Patch('worker/external-income')
  @Roles('WORKER')
  updateExternalIncome(
    @Request() req: any,
    @Body('amount') amount: number,
  ) {
    return this.complianceService.updateWorkerExternalIncome(req.user.userId, amount);
  }
}

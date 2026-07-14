import {
  Controller, Get, Post, Body, Param, Request, UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ── Employer endpoints ────────────────────────────────────────────────────

  /**
   * GET /attendance/employer-qr
   * Returns the employer's single permanent static check-in QR code.
   * Printed once and posted at the venue. There is no check-out QR —
   * shifts auto-complete at their scheduled end time (v2.1).
   *
   * Response: { checkInQrDataUrl, checkInToken, employerName }
   */
  @Get('employer-qr')
  @Roles('EMPLOYER')
  getEmployerStaticQr(@Request() req: any) {
    return this.attendanceService.getEmployerStaticQr(req.user.userId);
  }

  /**
   * POST /attendance/:shiftId/manual-confirm
   * Employer manually confirms shift completion when QR scanning isn't possible.
   * Logged as MANUAL_OVERRIDE in the audit trail.
   * Body: { note?: string }
   */
  @Post(':shiftId/manual-confirm')
  @Roles('EMPLOYER')
  manualConfirm(
    @Request() req: any,
    @Param('shiftId') shiftId: string,
    @Body('note') note?: string,
  ) {
    return this.attendanceService.manualConfirm(req.user.userId, shiftId, note);
  }

  /**
   * POST /attendance/:shiftId/dispute/employer
   * Employer raises a dispute on an attendance record.
   * Body: { note: string }
   */
  @Post(':shiftId/dispute/employer')
  @Roles('EMPLOYER')
  raiseDisputeEmployer(
    @Request() req: any,
    @Param('shiftId') shiftId: string,
    @Body('note') note: string,
  ) {
    return this.attendanceService.raiseDispute(req.user.userId, 'EMPLOYER', shiftId, note);
  }

  // ── Worker endpoints ──────────────────────────────────────────────────────

  /**
   * POST /attendance/check-in
   * Worker scans the employer's printed CHECK-IN QR to register arrival.
   * Body: { token: string, lat: number, lng: number }
   *
   * token = the static employer check-in QR token (encodes employerId + action:"in")
   * Server resolves the worker's confirmed shift at this employer for today.
   */
  @Post('check-in')
  @Roles('WORKER')
  checkIn(
    @Request() req: any,
    @Body('token') token: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
  ) {
    return this.attendanceService.checkIn(req.user.userId, token, lat, lng);
  }

  // v2.1: POST /attendance/check-out removed — shifts auto-complete at their
  // scheduled end. End-of-shift problems are handled by the employer's
  // "Ajustar horas / Reportar problema" flow before paying.

  /**
   * POST /attendance/:shiftId/dispute/worker
   * Worker raises a dispute on an attendance record.
   * Body: { note: string }
   */
  @Post(':shiftId/dispute/worker')
  @Roles('WORKER')
  raiseDisputeWorker(
    @Request() req: any,
    @Param('shiftId') shiftId: string,
    @Body('note') note: string,
  ) {
    return this.attendanceService.raiseDispute(req.user.userId, 'WORKER', shiftId, note);
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  /**
   * GET /attendance/:shiftId
   * Get attendance status for a shift (employer or worker).
   */
  @Get(':shiftId')
  @Roles('EMPLOYER', 'WORKER')
  getAttendance(@Param('shiftId') shiftId: string) {
    return this.attendanceService.getAttendance(shiftId);
  }
}

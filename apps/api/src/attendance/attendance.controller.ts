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
   * GET /attendance/qr/:shiftId
   * Returns a fresh QR token (valid 30s) + PNG data URL for display.
   * Call every 25s on the employer dashboard to keep the QR fresh.
   */
  @Get('qr/:shiftId')
  @Roles('EMPLOYER')
  generateQr(@Request() req: any, @Param('shiftId') shiftId: string) {
    return this.attendanceService.generateQr(req.user.userId, shiftId);
  }

  /**
   * POST /attendance/:shiftId/manual-confirm
   * Employer manually confirms shift completion (no QR available).
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
   * POST /attendance/:shiftId/dispute
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
   * Worker scans employer QR to check in.
   * Body: { token: string, lat: number, lng: number }
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

  /**
   * POST /attendance/check-out
   * Worker scans employer QR to check out.
   * Body: { token: string, lat: number, lng: number }
   */
  @Post('check-out')
  @Roles('WORKER')
  checkOut(
    @Request() req: any,
    @Body('token') token: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
  ) {
    return this.attendanceService.checkOut(req.user.userId, token, lat, lng);
  }

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

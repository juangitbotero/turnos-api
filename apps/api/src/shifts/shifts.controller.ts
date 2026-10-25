import {
  Controller, Post, Get, Patch, Delete, Body, Param, Request,
  UseGuards, Query,
} from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, Public } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  // ── Employer endpoints ────────────────────────────────────────────────────

  @Post()
  @Roles('EMPLOYER')
  create(@Request() req: any, @Body() body: any) {
    return this.shiftsService.create(req.user.userId, body);
  }

  /** "Publicar vários turnos": several roles, N workers each, in one request. */
  @Post('requests')
  @Roles('EMPLOYER')
  createRequest(@Request() req: any, @Body() body: any) {
    return this.shiftsService.createRequest(req.user.userId, body);
  }

  /** Cancel every not-yet-started shift of a request (each with its own policy). */
  @Post('requests/:id/cancel')
  @Roles('EMPLOYER')
  cancelRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body?: { reasonCategory?: string; reasonNote?: string },
  ) {
    return this.shiftsService.cancelRequest(req.user.userId, id, {
      category: body?.reasonCategory,
      note:     body?.reasonNote,
    });
  }

  @Get('employer/mine')
  @Roles('EMPLOYER')
  getMyShifts(@Request() req: any) {
    return this.shiftsService.findByEmployer(req.user.userId);
  }

  @Get('employer/workers')
  @Roles('EMPLOYER')
  getMyWorkers(@Request() req: any) {
    return this.shiftsService.findEmployerWorkers(req.user.userId);
  }

  @Get('employer/candidates')
  @Roles('EMPLOYER')
  getCandidates(@Request() req: any) {
    return this.shiftsService.getCandidates(req.user.userId);
  }

  @Get('employer/candidates/count')
  @Roles('EMPLOYER')
  getCandidateCounts(@Request() req: any) {
    return this.shiftsService.getCandidateCounts(req.user.userId);
  }

  @Post('employer/candidates/seen')
  @Roles('EMPLOYER')
  markCandidatesSeen(@Request() req: any) {
    return this.shiftsService.markCandidatesSeen(req.user.userId);
  }

  @Patch(':id')
  @Roles('EMPLOYER')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.shiftsService.update(req.user.userId, id, body);
  }

  @Post(':id/cancel')
  @Roles('EMPLOYER')
  cancel(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body?: { reasonCategory?: string; reasonNote?: string },
  ) {
    return this.shiftsService.cancel(req.user.userId, id, {
      category: body?.reasonCategory,
      note:     body?.reasonNote,
    });
  }

  @Post(':id/withdraw-offer')
  @Roles('EMPLOYER')
  withdrawOffer(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.withdrawOffer(req.user.userId, id);
  }

  @Get(':id/applications')
  @Roles('EMPLOYER')
  getApplications(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.getApplications(req.user.userId, id);
  }

  @Post(':id/applications/:appId/approve')
  @Roles('EMPLOYER')
  approveApplication(
    @Request() req: any,
    @Param('id') id: string,
    @Param('appId') appId: string,
  ) {
    return this.shiftsService.approveApplication(req.user.userId, id, appId);
  }

  // ── Worker endpoints ──────────────────────────────────────────────────────

  @Get('search')
  @Public()
  search(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
    @Query('category') category?: string,
  ) {
    return this.shiftsService.search({
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      radiusMeters: radius ? Number(radius) : undefined,
      category,
    });
  }

  @Post(':id/apply')
  @Roles('WORKER')
  apply(
    @Request() req: any,
    @Param('id') id: string,
    @Body('coverNote') coverNote?: string,
  ) {
    return this.shiftsService.apply(req.user.userId, id, coverNote);
  }

  /** Worker confirms they accept the pre-selected shift */
  @Post(':id/confirm')
  @Roles('WORKER')
  confirmShift(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.workerConfirmShift(req.user.userId, id);
  }

  /** Worker declines the pre-selected shift → reverts to OPEN */
  @Post(':id/decline')
  @Roles('WORKER')
  declineShift(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.workerDeclineShift(req.user.userId, id);
  }

  /** Worker cancels a confirmed (FILLED) shift → reverts to OPEN; ≤24h = reliability strike */
  @Post(':id/cancel-assignment')
  @Roles('WORKER')
  cancelAssignment(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body?: { reasonCategory?: string; reasonNote?: string },
  ) {
    return this.shiftsService.workerCancelAssignment(req.user.userId, id, {
      category: body?.reasonCategory,
      note:     body?.reasonNote,
    });
  }

  @Get('worker/applied')
  @Roles('WORKER')
  getMyApplications(@Request() req: any) {
    return this.shiftsService.findWorkerApplications(req.user.userId);
  }

  /** Employer invites a specific worker directly → PENDING_ACCEPTANCE */
  @Post(':id/invite/:workerId')
  @Roles('EMPLOYER')
  inviteWorker(
    @Request() req: any,
    @Param('id') id: string,
    @Param('workerId') workerId: string,
  ) {
    return this.shiftsService.inviteWorker(req.user.userId, id, workerId);
  }

  /** Delete an expired shift (marks as CANCELLED) */
  /** Body `{ ids?: string[] }` — no ids removes every expired shift. */
  @Post('employer/expired/delete')
  @Roles('EMPLOYER')
  deleteExpiredBulk(@Request() req: any, @Body() body: { ids?: string[] }) {
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : undefined;
    return this.shiftsService.deleteExpiredShifts(req.user.userId, ids);
  }

  @Delete(':id/expired')
  @Roles('EMPLOYER')
  deleteExpired(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.deleteExpiredShift(req.user.userId, id);
  }

  /** Public worker search — used by employer talent browser */
  @Get('workers/search')
  @Roles('EMPLOYER')
  searchWorkers(
    @Query('skills') skills?: string,
    @Query('languages') languages?: string,
    @Query('available') available?: string,
    @Query('availableNow') availableNow?: string,
    @Query('minRating') minRating?: string,
    @Query('minLevel') minLevel?: string,
    @Query('confirmedOnly') confirmedOnly?: string,
  ) {
    return this.shiftsService.searchWorkersPublic({
      skills:       skills    ? skills.split(',').filter(Boolean)    : undefined,
      languages:    languages ? languages.split(',').filter(Boolean) : undefined,
      available:    available ? available.split(',').filter(Boolean) : undefined,
      availableNow: availableNow === 'true',
      minRating:    minRating ? Number(minRating) : undefined,
      minLevel:     minLevel ? Number(minLevel) : undefined,
      confirmedOnly: confirmedOnly === 'true',
    });
  }

  /** Live count while posting: active workers who declared the role at the level. */
  @Get('workers/match-count')
  @Roles('EMPLOYER')
  matchCount(
    @Query('role') role: string,
    @Query('level') level?: string,
    @Query('languages') languages?: string,
  ) {
    return this.shiftsService.countMatchingWorkers({
      role,
      level:     level ? Number(level) : undefined,
      languages: languages ? languages.split(',').filter(Boolean) : undefined,
    });
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  @Get(':id')
  @Public()
  getOne(@Param('id') id: string) {
    return this.shiftsService.findById(id);
  }
}

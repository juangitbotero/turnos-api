import {
  Controller, Post, Get, Patch, Body, Param, Request,
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

  @Get('employer/mine')
  @Roles('EMPLOYER')
  getMyShifts(@Request() req: any) {
    return this.shiftsService.findByEmployer(req.user.userId);
  }

  @Patch(':id')
  @Roles('EMPLOYER')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.shiftsService.update(req.user.userId, id, body);
  }

  @Post(':id/cancel')
  @Roles('EMPLOYER')
  cancel(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.cancel(req.user.userId, id);
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
  apply(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.apply(req.user.userId, id);
  }

  @Get('worker/applied')
  @Roles('WORKER')
  getMyApplications(@Request() req: any) {
    return this.shiftsService.findWorkerApplications(req.user.userId);
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  @Get(':id')
  @Public()
  getOne(@Param('id') id: string) {
    return this.shiftsService.findById(id);
  }
}

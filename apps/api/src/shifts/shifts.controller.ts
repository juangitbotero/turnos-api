import { Controller, Post, Get, Body, Param, Request, UseGuards, Query } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Roles('EMPLOYER')
  @Post()
  create(@Request() req: any, @Body() createShiftDto: any) {
    return this.shiftsService.create(req.user.userId, createShiftDto);
  }

  @Roles('WORKER')
  @Get('search')
  search(
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
    @Query('radius') radius?: number,
    @Query('category') category?: string,
    @Query('subcategory') subcategory?: string,
    @Query('employerId') employerId?: string,
  ) {
    return this.shiftsService.search({
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      radiusMeters: radius ? Number(radius) : undefined,
      category,
      subcategory,
      employerId,
    });
  }

  @Roles('WORKER')
  @Post(':id/apply')
  apply(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.apply(req.user.userId, id);
  }

  @Roles('EMPLOYER')
  @Post(':id/applications/:appId/approve')
  approveApplication(@Request() req: any, @Param('id') id: string, @Param('appId') appId: string) {
    return this.shiftsService.approveApplication(req.user.userId, id, appId);
  }
}

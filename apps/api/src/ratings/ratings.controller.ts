import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RatingsService, CreateRatingDto, CreateWorkerRatingDto } from './ratings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators';

interface AuthRequest {
  user: { sub: string; role: string };
}

@Controller('ratings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  // ── Submit rating (EMPLOYER only) ─────────────────────────────────────────

  @Post()
  @Roles('EMPLOYER')
  @HttpCode(HttpStatus.CREATED)
  createRating(@Request() req: AuthRequest, @Body() dto: CreateRatingDto) {
    return this.ratings.createRating(req.user.sub, dto);
  }

  // ── Worker rating summary (any authenticated user) ────────────────────────

  @Get('worker/:id')
  getWorkerSummary(@Param('id') workerId: string) {
    return this.ratings.getWorkerRatingSummary(workerId);
  }

  // ── Worker rates employer (WORKER only, internal) ─────────────────────────

  @Post('employer')
  @Roles('WORKER')
  @HttpCode(HttpStatus.CREATED)
  createWorkerRating(@Request() req: AuthRequest, @Body() dto: CreateWorkerRatingDto) {
    return this.ratings.createWorkerRating(req.user.sub, dto);
  }

  // ── Has-rated check ───────────────────────────────────────────────────────

  @Get('shift/:shiftId/mine')
  hasRatedShift(@Request() req: AuthRequest, @Param('shiftId') shiftId: string) {
    const direction = req.user.role === 'WORKER' ? 'WORKER_TO_EMPLOYER' : 'EMPLOYER_TO_WORKER';
    return this.ratings.hasRatedShift(req.user.sub, shiftId, direction as any);
  }

  // ── No-show reporting (EMPLOYER only) ─────────────────────────────────────

  @Post('no-show/:shiftId')
  @Roles('EMPLOYER')
  reportNoShow(
    @Request() req: AuthRequest,
    @Param('shiftId') shiftId: string,
    @Body('note') note?: string,
  ) {
    return this.ratings.reportNoShow(req.user.sub, shiftId, note);
  }

  // ── Favourite Workers (EMPLOYER only) ────────────────────────────────────

  @Get('favourites')
  @Roles('EMPLOYER')
  getFavourites(@Request() req: AuthRequest) {
    return this.ratings.getFavourites(req.user.sub);
  }

  @Post('favourites/:workerId')
  @Roles('EMPLOYER')
  @HttpCode(HttpStatus.OK)
  addFavourite(@Request() req: AuthRequest, @Param('workerId') workerId: string) {
    return this.ratings.addFavourite(req.user.sub, workerId);
  }

  @Delete('favourites/:workerId')
  @Roles('EMPLOYER')
  removeFavourite(@Request() req: AuthRequest, @Param('workerId') workerId: string) {
    return this.ratings.removeFavourite(req.user.sub, workerId);
  }
}

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
  // Matches JwtStrategy.validate(), which returns { userId, role }. This said
  // `sub` until 2026-10-05: every handler here got undefined, and TypeORM drops
  // an undefined condition, so lookups matched the FIRST employer/worker row.
  user: { userId: string; role: string };
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
    return this.ratings.createRating(req.user.userId, dto);
  }

  // ── Worker rating summary (any authenticated user) ────────────────────────

  @Get('worker/:id')
  getWorkerSummary(@Param('id') workerId: string) {
    return this.ratings.getWorkerRatingSummary(workerId);
  }

  /**
   * The signed-in worker's own summary, including the reviews employers wrote.
   *
   * `GET /auth/me` returns `userId`, not the worker id, so the mobile profile
   * screen has no id to pass to the route above — hence this one.
   */
  @Get('me')
  @Roles('WORKER')
  getMySummary(@Request() req: AuthRequest) {
    return this.ratings.getMyRatingSummary(req.user.userId);
  }

  // ── Worker rates employer (WORKER only, internal) ─────────────────────────

  @Post('employer')
  @Roles('WORKER')
  @HttpCode(HttpStatus.CREATED)
  createWorkerRating(@Request() req: AuthRequest, @Body() dto: CreateWorkerRatingDto) {
    return this.ratings.createWorkerRating(req.user.userId, dto);
  }

  // ── Has-rated check ───────────────────────────────────────────────────────

  @Get('shift/:shiftId/mine')
  hasRatedShift(@Request() req: AuthRequest, @Param('shiftId') shiftId: string) {
    const direction = req.user.role === 'WORKER' ? 'WORKER_TO_EMPLOYER' : 'EMPLOYER_TO_WORKER';
    return this.ratings.hasRatedShift(req.user.userId, shiftId, direction as any);
  }

  // ── No-show reporting (EMPLOYER only) ─────────────────────────────────────

  @Post('no-show/:shiftId')
  @Roles('EMPLOYER')
  reportNoShow(
    @Request() req: AuthRequest,
    @Param('shiftId') shiftId: string,
    @Body('note') note?: string,
  ) {
    return this.ratings.reportNoShow(req.user.userId, shiftId, note);
  }

  // ── Favourite Workers (EMPLOYER only) ────────────────────────────────────

  @Get('favourites')
  @Roles('EMPLOYER')
  getFavourites(@Request() req: AuthRequest) {
    return this.ratings.getFavourites(req.user.userId);
  }

  @Post('favourites/:workerId')
  @Roles('EMPLOYER')
  @HttpCode(HttpStatus.OK)
  addFavourite(@Request() req: AuthRequest, @Param('workerId') workerId: string) {
    return this.ratings.addFavourite(req.user.userId, workerId);
  }

  @Delete('favourites/:workerId')
  @Roles('EMPLOYER')
  removeFavourite(@Request() req: AuthRequest, @Param('workerId') workerId: string) {
    return this.ratings.removeFavourite(req.user.userId, workerId);
  }
}

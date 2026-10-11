import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators';
import { NotificationsService } from './notifications.service';

interface AuthRequest {
  // JwtStrategy.validate() returns { userId, role } — never `sub`.
  user: { userId: string; role: string };
}

/** The worker's in-app notifications inbox (mobile bell + /notifications screen). */
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('inbox')
  @Roles('WORKER')
  inbox(@Request() req: AuthRequest) {
    return this.notifications.getInbox(req.user.userId);
  }

  @Get('inbox/unread-count')
  @Roles('WORKER')
  unreadCount(@Request() req: AuthRequest) {
    return this.notifications.getUnreadCount(req.user.userId);
  }

  /** Body `{ ids?: string[] }` — no ids marks everything read. */
  @Post('inbox/read')
  @Roles('WORKER')
  @HttpCode(HttpStatus.OK)
  markRead(@Request() req: AuthRequest, @Body() body: { ids?: string[] }) {
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : undefined;
    return this.notifications.markRead(req.user.userId, ids);
  }
}

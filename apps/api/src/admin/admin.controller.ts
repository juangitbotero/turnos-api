import {
  Controller, Get, Post, Body, Param, HttpCode, HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mail: MailService,
  ) {}

  @Get('workers/pending')
  async getPendingWorkers() {
    const workers = await this.usersService.findPendingWorkers();
    return workers.map(w => ({
      id: w.id,
      fullName: w.fullName,
      nif: w.nif,
      iban: w.iban ? `${w.iban.slice(0, 8)}...${w.iban.slice(-4)}` : null,
      skills: w.skills,
      availableDays: w.availableDays,
      profileQualityScore: w.profileQualityScore,
      photoUrl: w.photoUrl,
      createdAt: w.createdAt,
      userEmail: w.user?.email,
      userPhone: w.user?.phone,
    }));
  }

  @Post('workers/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveWorker(@Param('id') id: string) {
    const result = await this.usersService.updateWorkerStatus(id, 'ACTIVE');
    return { message: 'Trabalhador aprovado com sucesso', ...result };
  }

  @Post('workers/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectWorker(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    const result = await this.usersService.updateWorkerStatus(
      id,
      'REJECTED',
      reason ?? 'Perfil não aprovado',
    );
    return { message: 'Trabalhador rejeitado', ...result };
  }
}

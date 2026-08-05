import {
  Controller, Post, Get, Patch, Delete, Body, HttpCode, HttpStatus,
  UseGuards, Request, Param, Query, NotFoundException,
  UseInterceptors, UploadedFile, BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { WorkerExperience } from '@turnos/shared';
import { AuthService } from './auth.service';
import { Public } from './decorators';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Worker OTP Flow ──────────────────────────────────────────────────────

  @Public()
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async sendOtp(@Body('phone') phone: string) {
    await this.authService.sendOtp(phone);
    return { message: 'Código enviado com sucesso' };
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyOtp(
    @Body('phone') phone: string,
    @Body('code')  code:  string,
  ) {
    const result = await this.authService.verifyOtp(phone, code);
    return { message: 'Verificação bem sucedida', ...result };
  }

  // ─── Employer Auth ────────────────────────────────────────────────────────

  @Public()
  @Post('register/employer')
  @HttpCode(HttpStatus.CREATED)
  async registerEmployer(@Body() body: {
    companyName: string; nipc: string; nif?: string; sector: string;
    address: string; postalCode: string; city: string;
    adminEmail: string; adminPassword: string;
  }) {
    const tokens = await this.authService.registerEmployer(body);
    return { message: 'Empresa registada. Verifique o seu email para ativar a conta.', ...tokens };
  }

  @Public()
  @Post('login/employer')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async employerLogin(
    @Body('email')    email:    string,
    @Body('password') password: string,
  ) {
    const tokens = await this.authService.employerLogin(email, password);
    return { message: 'Login bem sucedido', ...tokens };
  }

  // ─── Email Verification ───────────────────────────────────────────────────

  @Public()
  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string, @Res() res: Response) {
    const ok = await this.authService.verifyEmail(token);
    if (!ok) throw new NotFoundException('Token de verificação inválido ou expirado.');
    // Redirect to web admin with success flag
    const webUrl = process.env.WEB_ADMIN_URL ?? 'http://localhost:3000';
    res.redirect(`${webUrl}/login?verified=1`);
  }

  // ─── Google OAuth (workers + employers) ──────────────────────────────────

  @Public()
  @Post('google/verify-token')
  @HttpCode(HttpStatus.OK)
  async googleVerifyToken(
    @Body('googleAccessToken') googleAccessToken: string,
    @Body('userType') userType: 'WORKER' | 'EMPLOYER' = 'WORKER',
  ) {
    if (!googleAccessToken) throw new BadRequestException('googleAccessToken is required');
    const result = await this.authService.googleLogin(googleAccessToken, userType);
    return { message: 'Login com Google bem sucedido', ...result };
  }

  // ─── Token Management ─────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('userId')       userId:       string,
    @Body('refreshToken') refreshToken: string,
  ) {
    const tokens = await this.authService.refreshTokens(userId, refreshToken);
    return { message: 'Tokens renovados', ...tokens };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: { user: { userId: string } }) {
    await this.authService.logout(req.user.userId);
    return { message: 'Sessão terminada' };
  }

  // ─── Worker Profile ───────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('worker/profile')
  @HttpCode(HttpStatus.OK)
  async updateWorkerProfile(
    @Request() req: { user: { userId: string } },
    @Body() body: {
      fullName: string; nif: string; iban: string;
      skills: string[]; availableDays: string[];
      declaredExternalMonthlyIncome?: number;
      ibanShareConsent?: boolean;
    },
  ) {
    const result = await this.authService.updateWorkerProfile(req.user.userId, body);
    return {
      message: result.status === 'PENDING_REVIEW'
        ? 'Perfil submetido para aprovação. Será notificado em breve.'
        : 'Perfil guardado. Complete os campos em falta para submeter.',
      ...result,
    };
  }

  /** PATCH /auth/worker/profile — partial update (name, bio, skills, languages, availability) */
  @UseGuards(JwtAuthGuard)
  @Patch('worker/profile')
  @HttpCode(HttpStatus.OK)
  async updateWorkerPartial(
    @Request() req: { user: { userId: string } },
    @Body() body: {
      fullName?: string;
      bio?: string;
      skills?: string[];
      languages?: string[];
      availableDays?: string[];
      nif?: string;
      iban?: string;
      contactEmail?: string;
      ibanShareConsent?: boolean;
      isAvailableForWork?: boolean;
      experiences?: WorkerExperience[];
      preferredLanguage?: string;
    },
  ) {
    const result = await this.authService.updateWorkerPartialProfile(req.user.userId, body);
    return { message: 'Perfil atualizado com sucesso', ...result };
  }

  @UseGuards(JwtAuthGuard)
  @Post('worker/photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('photo', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        cb(new BadRequestException('Apenas imagens são permitidas'), false);
      } else {
        cb(null, true);
      }
    },
  }))
  async uploadWorkerPhoto(
    @Request() req: { user: { userId: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhuma imagem fornecida');
    const photoUrl = await this.authService.uploadWorkerPhoto(req.user.userId, file);
    return { message: 'Foto atualizada com sucesso', photoUrl };
  }

  /**
   * Upload the worker's CV (PDF/DOC/DOCX, max 10 MB). Worth 10 points on the
   * profile quality score — see calculateProfileQualityScore in shared.
   */
  @UseGuards(JwtAuthGuard)
  @Post('worker/cv')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('cv', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowed.includes(file.mimetype)) {
        cb(new BadRequestException('O CV tem de ser um ficheiro PDF ou Word (.doc/.docx).'), false);
      } else {
        cb(null, true);
      }
    },
  }))
  async uploadWorkerCv(
    @Request() req: { user: { userId: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum ficheiro fornecido');
    const result = await this.authService.uploadWorkerCv(req.user.userId, file);
    return { message: 'CV carregado com sucesso', ...result };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('worker/cv')
  @HttpCode(HttpStatus.OK)
  async deleteWorkerCv(@Request() req: { user: { userId: string } }) {
    const result = await this.authService.deleteWorkerCv(req.user.userId);
    return { message: 'CV removido', ...result };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: { user: { userId: string; role: string } }) {
    return this.authService.getProfile(req.user.userId, req.user.role);
  }

  // ─── Push Notifications ───────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('worker/push-token')
  @HttpCode(HttpStatus.OK)
  async registerPushToken(
    @Request() req: { user: { userId: string } },
    @Body('token') token: string,
  ) {
    if (!token) throw new BadRequestException('Token inválido');
    await this.authService.savePushToken(req.user.userId, token);
    return { message: 'Token de notificações registado' };
  }
}

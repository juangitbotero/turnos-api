import {
  Controller, Post, Get, Body, HttpCode, HttpStatus,
  UseGuards, Request, Param, Query, NotFoundException,
  UseInterceptors, UploadedFile, BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
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

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: { user: { userId: string; role: string } }) {
    return { userId: req.user.userId, role: req.user.role };
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

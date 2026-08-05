import {
  Injectable, UnauthorizedException, ConflictException,
  BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Twilio } from 'twilio';
import {
  isValidNIF, isValidIBAN, isValidNIPC, isValidPostalCode,
  WorkerExperience, normalizeSkills,
} from '@turnos/shared';

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

@Injectable()
export class AuthService {
  private twilioClient: Twilio | null = null;
  private twilioServiceSid: string;
  private readonly logger = new Logger(AuthService.name);

  /** In-memory mock OTP store for dev */
  private readonly mockOtpStore = new Map<string, string>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly storage: StorageService,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID', '');
    const authToken  = this.configService.get<string>('TWILIO_AUTH_TOKEN', '');
    this.twilioServiceSid = this.configService.get<string>('TWILIO_VERIFY_SERVICE_SID', '');

    const hasRealCredentials =
      accountSid && accountSid !== 'replace_me' &&
      authToken  && authToken  !== 'replace_me';

    if (hasRealCredentials) {
      this.twilioClient = new Twilio(accountSid, authToken);
      this.logger.log('Twilio client initialized (real credentials)');
    } else {
      this.logger.warn('Twilio credentials absent — using Mock OTP (code: 123456)');
    }
  }

  // ─── OTP Flow (Workers) ────────────────────────────────────────────────────

  async sendOtp(phone: string): Promise<boolean> {
    if (!phone || phone.length < 8) {
      throw new BadRequestException('Invalid phone number');
    }

    if (this.twilioClient && this.twilioServiceSid) {
      try {
        await this.twilioClient.verify.v2
          .services(this.twilioServiceSid)
          .verifications.create({ to: phone, channel: 'sms' });
        return true;
      } catch (err: any) {
        this.logger.error(`Twilio OTP send failed: ${err.message}`);
        throw new BadRequestException('Failed to send OTP. Please try again.');
      }
    }

    // Mock OTP for dev
    this.mockOtpStore.set(phone, '123456');
    this.logger.debug(`[MOCK OTP] 123456 → ${phone}`);
    return true;
  }

  async verifyOtp(phone: string, code: string): Promise<{
    accessToken: string; refreshToken: string; isNewUser: boolean;
  }> {
    let isValid = false;

    if (this.twilioClient && this.twilioServiceSid) {
      try {
        const result = await this.twilioClient.verify.v2
          .services(this.twilioServiceSid)
          .verificationChecks.create({ to: phone, code });
        isValid = result.status === 'approved';
      } catch (err: any) {
        this.logger.error(`Twilio OTP verify failed: ${err.message}`);
      }
    } else {
      isValid = this.mockOtpStore.get(phone) === code;
      if (isValid) this.mockOtpStore.delete(phone);
    }

    if (!isValid) throw new UnauthorizedException('Invalid or expired OTP code');

    const isNewUser = !(await this.usersService.findByPhone(phone));
    let user = await this.usersService.findByPhone(phone);
    if (!user) user = await this.usersService.createWorker(phone);

    return { ...await this.generateTokens(user.id, user.role), isNewUser };
  }

  // ─── Employer Registration ─────────────────────────────────────────────────

  async registerEmployer(dto: {
    companyName: string; nipc: string; nif?: string; sector: string;
    address: string; postalCode: string; city: string;
    adminEmail: string; adminPassword: string;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    if (!isValidNIPC(dto.nipc)) {
      throw new BadRequestException('NIPC inválido.');
    }
    if (dto.nif && !isValidNIF(dto.nif)) {
      throw new BadRequestException('NIF inválido.');
    }
    if (!isValidPostalCode(dto.postalCode)) {
      throw new BadRequestException('Código postal inválido. Formato: XXXX-XXX');
    }

    const existing = await this.usersService.findByEmail(dto.adminEmail);
    if (existing) throw new ConflictException('Este email já está registado.');

    const hashedPassword = await bcrypt.hash(dto.adminPassword, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await this.usersService.createEmployer({
      email: dto.adminEmail,
      password: hashedPassword,
      companyName: dto.companyName,
      nipc: dto.nipc,
      nif: dto.nif,
      sector: dto.sector,
      address: dto.address,
      postalCode: dto.postalCode,
      city: dto.city,
      emailVerificationToken: verificationToken,
    });

    // Send verification email (non-blocking)
    this.mail
      .sendEmployerVerification(dto.adminEmail, verificationToken)
      .catch(err => this.logger.error(`Verification email failed: ${err.message}`));

    this.logger.log(`New employer registered: ${dto.companyName} (${dto.nipc})`);
    return this.generateTokens(user.id, user.role);
  }

  // ─── Employer Login ────────────────────────────────────────────────────────

  async employerLogin(email: string, password: string): Promise<{
    accessToken: string; refreshToken: string;
  }> {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.role === 'WORKER' || !user.password) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Credenciais inválidas.');

    return this.generateTokens(user.id, user.role);
  }

  // ─── Email Verification ────────────────────────────────────────────────────

  async verifyEmail(token: string): Promise<boolean> {
    return this.usersService.verifyEmail(token);
  }

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  async googleLogin(googleAccessToken: string, userType: 'WORKER' | 'EMPLOYER'): Promise<{
    accessToken: string; refreshToken: string; isNewUser: boolean;
  }> {
    // Verify Google access token by calling userinfo endpoint
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${googleAccessToken}`,
    );
    if (!res.ok) throw new UnauthorizedException('Invalid Google token');

    const profile = await res.json() as {
      id: string; email: string; name: string; picture: string;
    };

    // Find existing user by Google ID or email
    let user = await this.usersService.findByGoogleId(profile.id);
    let isNewUser = false;

    if (!user) {
      user = await this.usersService.findByEmail(profile.email);
    }

    if (!user) {
      isNewUser = true;
      if (userType === 'WORKER') {
        user = await this.usersService.createGoogleWorker(
          profile.id, profile.email, profile.name, profile.picture,
        );
      } else {
        user = await this.usersService.createGoogleEmployer(profile.id, profile.email);
      }
    } else if (!user.googleId) {
      // Link existing account to Google
      Object.assign(user, { googleId: profile.id, emailVerified: true });
      // We persist through the repo indirectly; UsersService would need updateGoogleId — skip for now
    }

    return { ...await this.generateTokens(user.id, user.role), isNewUser };
  }

  // ─── Token Refresh ─────────────────────────────────────────────────────────

  async refreshTokens(userId: string, oldRefreshToken: string): Promise<{
    accessToken: string; refreshToken: string;
  }> {
    const stored = await this.redis.get(`refresh:${userId}`);
    if (!stored || stored !== oldRefreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found.');

    await this.redis.del(`refresh:${userId}`);
    return this.generateTokens(user.id, user.role);
  }

  async logout(userId: string): Promise<void> {
    await this.redis.del(`refresh:${userId}`);
  }

  // ─── Worker Profile ────────────────────────────────────────────────────────

  async updateWorkerProfile(userId: string, dto: {
    fullName: string; nif: string; iban: string;
    skills: string[]; availableDays: string[];
    declaredExternalMonthlyIncome?: number;
    ibanShareConsent?: boolean;
  }): Promise<{ profileQualityScore: number; status: string; missingItems: string[] }> {
    if (!isValidNIF(dto.nif)) {
      throw new BadRequestException('NIF inválido.');
    }
    if (!isValidIBAN(dto.iban)) {
      throw new BadRequestException('IBAN inválido. Formato: PT50... (25 caracteres).');
    }
    return this.usersService.updateWorkerProfile(userId, dto);
  }

  /** Partial update — only the fields the worker can edit without admin review */
  async updateWorkerPartialProfile(userId: string, dto: {
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
  }): Promise<{ profileQualityScore: number }> {
    return this.usersService.updateWorkerPartialFields(userId, dto);
  }

  async uploadWorkerPhoto(userId: string, file: Express.Multer.File): Promise<string> {
    const photoUrl = await this.storage.uploadPhoto(file.buffer, file.mimetype, 'worker-photos');
    const result = await this.usersService.updateWorkerPhoto(userId, photoUrl);
    this.logger.log(`Worker ${userId} photo updated (score: ${result.profileQualityScore})`);
    return photoUrl;
  }

  async uploadWorkerCv(userId: string, file: Express.Multer.File): Promise<{
    cvUrl: string | null; cvFileName: string | null; profileQualityScore: number;
  }> {
    const cvUrl = await this.storage.upload(file.buffer, file.mimetype, 'worker-cvs');
    const fileName = file.originalname?.slice(0, 255) || 'CV';
    const result = await this.usersService.updateWorkerCv(userId, { url: cvUrl, fileName });
    this.logger.log(`Worker ${userId} CV uploaded (score: ${result.profileQualityScore})`);
    return result;
  }

  async deleteWorkerCv(userId: string): Promise<{
    cvUrl: string | null; cvFileName: string | null; profileQualityScore: number;
  }> {
    return this.usersService.updateWorkerCv(userId, null);
  }

  async savePushToken(userId: string, token: string): Promise<void> {
    await this.usersService.saveWorkerPushToken(userId, token);
  }

  // ─── Profile ───────────────────────────────────────────────────────────────

  async getProfile(userId: string, role: string): Promise<Record<string, unknown>> {
    if (role === 'WORKER') {
      const worker = await this.usersService.findWorkerProfile(userId);
      // Converge scores written under an older rule set (e.g. before the CV
      // criterion existed) without needing a migration.
      if (worker) await this.usersService.refreshWorkerScoreIfStale(worker);
      return {
        userId,
        role,
        fullName:            worker?.fullName            ?? null,
        photoUrl:            worker?.photoUrl            ?? null,
        cvUrl:               worker?.cvUrl               ?? null,
        cvFileName:          worker?.cvFileName          ?? null,
        bio:                 worker?.bio                 ?? null,
        contactEmail:        worker?.user?.email         ?? null,
        // Read through the alias map so a worker still holding a retired title
        // (e.g. 'Rececionista de hotel') sees the current chip selected.
        skills:              normalizeSkills(worker?.skills),
        languages:           worker?.languages           ?? [],
        isAvailableForWork:  worker?.isAvailableForWork  ?? true,
        preferredLanguage:   worker?.preferredLanguage   ?? 'pt',
        availableDays:       worker?.availableDays       ?? [],
        experiences:         worker?.experiences         ?? [],
        profileQualityScore: worker?.profileQualityScore ?? 0,
        status:              worker?.status              ?? 'INCOMPLETE',
        nif:                 worker?.nif                 ?? null,
        iban:                worker?.iban                ?? null,
        ibanShareConsent:    !!worker?.ibanShareConsentAt,
        // ── Reputation (Stint 7) ────────────────────────────────────────────
        avgRating:           worker?.avgRating           ?? null,
        totalRatings:        worker?.totalRatings        ?? 0,
        noShowCount:         worker?.noShowCount         ?? 0,
        badges:              worker?.badges              ?? [],
      };
    }
    if (role === 'EMPLOYER') {
      const employer = await this.usersService.findEmployerProfile(userId);
      return {
        userId,
        role,
        companyName:      employer?.companyName      ?? null,
        sector:           employer?.sector           ?? null,
        city:             employer?.city             ?? null,
        subscriptionTier: employer?.subscriptionTier ?? 'NONE',
      };
    }
    return { userId, role };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private async generateTokens(userId: string, role: string): Promise<{
    accessToken: string; refreshToken: string;
  }> {
    const payload = { sub: userId, role };
    const accessToken  = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.redis.set(`refresh:${userId}`, refreshToken, REFRESH_TTL_SECONDS);
    return { accessToken, refreshToken };
  }
}

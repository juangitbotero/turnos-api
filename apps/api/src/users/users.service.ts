import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './entities/user.entity';
import { Worker } from './entities/worker.entity';
import { Employer } from './entities/employer.entity';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';
import { WagePayment, WagePaymentStatus } from '../payments/entities/wage-payment.entity';
import { StorageService } from '../storage/storage.service';
import { t } from '../i18n/request-language';
import {
  calculateProfileQualityScore,
  normalizeSkills,
  isValidNIF,
  isValidIBAN,
  ProfileQualityResult,
  WorkerExperience,
  JOB_TITLES,
  EXPERIENCE_LEVELS,
  APP_LANGUAGES,
  AppLanguage,
} from '@turnos/shared';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
    // Read-only here — used to decide whether an account may be deleted yet.
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(WagePayment)
    private readonly wageRepo: Repository<WagePayment>,
    private readonly storage: StorageService,
  ) {}

  // ─── Lookups ───────────────────────────────────────────────────────────────

  findByPhone(phone: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { phone } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'role', 'emailVerified'],
    });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { googleId } });
  }

  findByEmailVerificationToken(token: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.emailVerificationToken')
      .where('u.emailVerificationToken = :token', { token })
      .getOne();
  }

  async findWorkerProfile(userId: string): Promise<Worker | null> {
    return this.workerRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
  }

  async findEmployerProfile(userId: string): Promise<Employer | null> {
    return this.employerRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
  }

  /**
   * Update a company's own details.
   *
   * Undefined fields are left alone so a partial form submit cannot blank out
   * something it never showed. `nipc` is absent by design — see the caller.
   */
  async updateEmployerProfile(userId: string, dto: {
    companyName?: string; sector?: string; nif?: string;
    address?: string; postalCode?: string; city?: string;
    accountantEmail?: string;
    notificationPrefs?: { ratingReminders?: boolean; wageReminders?: boolean };
    logoUrl?: string;
  }): Promise<void> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: userId } } });
    if (!employer) throw new NotFoundException('Employer profile not found');

    const patch: Partial<Employer> = {};
    for (const key of ['companyName', 'sector', 'nif', 'address', 'postalCode', 'city', 'accountantEmail', 'logoUrl'] as const) {
      const value = dto[key];
      if (value !== undefined) (patch as Record<string, unknown>)[key] = value.trim() || null;
    }
    // Merged, not replaced: a client sending only one switch must not blank the
    // other back to its default.
    if (dto.notificationPrefs !== undefined) {
      patch.notificationPrefs = { ...(employer.notificationPrefs ?? {}), ...dto.notificationPrefs };
    }
    if (Object.keys(patch).length === 0) return;

    await this.employerRepo.update(employer.id, patch);
  }

  /**
   * The password column is `select: false`, so a normal find never returns it —
   * it has to be asked for explicitly.
   */
  async findByIdWithPassword(userId: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'email', 'password', 'role'],
    });
  }

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.userRepo.update(userId, { password: passwordHash });
  }

  // ─── Worker Creation ───────────────────────────────────────────────────────

  async createWorker(phone: string): Promise<User> {
    const user = this.userRepo.create({ phone, role: 'WORKER' });
    const savedUser = await this.userRepo.save(user);

    const worker = this.workerRepo.create({
      user: savedUser,
      status: 'INCOMPLETE',
      profileQualityScore: 0,
    });
    await this.workerRepo.save(worker);
    return savedUser;
  }

  async createGoogleWorker(googleId: string, email: string, displayName: string, photoUrl: string): Promise<User> {
    const user = this.userRepo.create({ googleId, email, role: 'WORKER', emailVerified: true });
    const savedUser = await this.userRepo.save(user);

    const worker = this.workerRepo.create({
      user: savedUser,
      fullName: displayName,
      photoUrl,
      status: 'INCOMPLETE',
      profileQualityScore: 0,
    });
    await this.workerRepo.save(worker);
    return savedUser;
  }

  async createGoogleEmployer(googleId: string, email: string): Promise<User> {
    const user = this.userRepo.create({ googleId, email, role: 'EMPLOYER', emailVerified: true });
    return this.userRepo.save(user);
  }

  // ─── Worker Profile Update + Quality Score ─────────────────────────────────

  /**
   * Record (or withdraw) the worker's consent to disclose their IBAN to
   * companies they worked for. Stamped once and left alone on re-consent so
   * the original date survives; `false` withdraws it and the IBAN stops being
   * disclosed immediately. `undefined` means the client didn't ask — no change.
   */
  /**
   * Recompute the profile score from the worker's CURRENT persisted fields and
   * apply the status transition. Single source of truth — every write path goes
   * through here so a new scoring criterion can never be missed at one call site.
   */
  private rescoreWorker(worker: Worker): ProfileQualityResult {
    const result = calculateProfileQualityScore({
      hasPhoto:        !!worker.photoUrl,
      hasValidNif:     isValidNIF(worker.nif ?? ''),
      hasValidIban:    isValidIBAN(worker.iban ?? ''),
      skillsCount:     worker.skills?.length ?? 0,
      hasFullName:     !!(worker.fullName?.trim()),
      hasAvailability: (worker.availableDays?.length ?? 0) > 0,
      hasCv:           !!worker.cvUrl,
    });

    worker.profileQualityScore = result.score;
    // DELETED is terminal — an anonymised account must never be re-activated
    // by a re-score, and `refreshWorkerScoreIfStale()` runs on every GET /me.
    if (worker.status === 'DELETED') return result;
    if (result.score >= 80 && worker.status !== 'SUSPENDED' && worker.status !== 'REJECTED') {
      worker.status = 'ACTIVE';
    } else if (result.score < 80 && worker.status === 'ACTIVE') {
      worker.status = 'INCOMPLETE'; // demote if profile degrades
    }
    return result;
  }

  private applyIbanShareConsent(worker: Worker, consent: boolean | undefined): void {
    if (consent === undefined) return;
    if (consent) {
      worker.ibanShareConsentAt ??= new Date();
    } else {
      worker.ibanShareConsentAt = null;
    }
  }

  async updateWorkerProfile(
    userId: string,
    dto: {
      fullName: string;
      nif: string;
      iban: string;
      skills: string[];
      availableDays: string[];
      declaredExternalMonthlyIncome?: number;
      ibanShareConsent?: boolean;
    },
  ): Promise<{ profileQualityScore: number; status: string; missingItems: string[] }> {
    const worker = await this.workerRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!worker) throw new NotFoundException('Worker profile not found');

    worker.fullName      = dto.fullName?.trim();
    worker.nif           = dto.nif?.trim();
    worker.iban          = dto.iban?.trim().replace(/\s/g, '');
    worker.skills        = normalizeSkills(dto.skills);
    worker.availableDays = dto.availableDays;
    this.applyIbanShareConsent(worker, dto.ibanShareConsent);
    if (dto.declaredExternalMonthlyIncome !== undefined) {
      worker.declaredExternalMonthlyIncome = dto.declaredExternalMonthlyIncome;
    }

    const qualityResult = this.rescoreWorker(worker);
    await this.workerRepo.save(worker);

    return {
      profileQualityScore: qualityResult.score,
      status: worker.status,
      missingItems: qualityResult.missingItems,
    };
  }

  /** Partial update — name / skills / availableDays only (no NIF/IBAN re-validation) */
  async updateWorkerPartialFields(
    userId: string,
    dto: {
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
  ): Promise<{ profileQualityScore: number }> {
    const worker = await this.workerRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!worker) throw new NotFoundException('Worker profile not found');

    if (dto.fullName      !== undefined) worker.fullName      = dto.fullName.trim();
    if (dto.bio           !== undefined) worker.bio           = dto.bio.slice(0, 200);
    if (dto.skills        !== undefined) worker.skills        = normalizeSkills(dto.skills);
    if (dto.languages     !== undefined) worker.languages     = dto.languages;
    if (dto.availableDays !== undefined) worker.availableDays = dto.availableDays;
    if (dto.isAvailableForWork !== undefined) worker.isAvailableForWork = dto.isAvailableForWork;
    // Only accept languages the app actually ships, so a bad value can't make
    // push notifications fall back to a catalogue that doesn't exist.
    if (dto.preferredLanguage !== undefined && APP_LANGUAGES.includes(dto.preferredLanguage as AppLanguage)) {
      worker.preferredLanguage = dto.preferredLanguage;
    }

    // Experiences — keep only known job titles with a valid level, one per title
    if (dto.experiences !== undefined) {
      const byTitle = new Map<string, WorkerExperience>();
      for (const entry of dto.experiences ?? []) {
        if (!entry) continue;
        if (!JOB_TITLES.includes(entry.jobTitle)) continue;
        if (!Object.keys(EXPERIENCE_LEVELS).includes(entry.level)) continue;
        byTitle.set(entry.jobTitle, { jobTitle: entry.jobTitle, level: entry.level });
      }
      worker.experiences = [...byTitle.values()];
    }

    // NIF — validate before saving; empty string clears it
    if (dto.nif !== undefined) {
      const nifTrimmed = dto.nif.replace(/\D/g, '').slice(0, 9);
      if (nifTrimmed === '' || isValidNIF(nifTrimmed)) {
        worker.nif = nifTrimmed || undefined;
      }
    }

    // IBAN — validate before saving; empty string clears it
    if (dto.iban !== undefined) {
      const trimmed = dto.iban.replace(/\s/g, '').toUpperCase();
      if (trimmed === '' || isValidIBAN(trimmed)) {
        worker.iban = trimmed || undefined;
      }
      // silently ignore invalid IBAN (client shows live validation anyway)
    }

    this.applyIbanShareConsent(worker, dto.ibanShareConsent);

    // Contact email — update on the linked User row
    if (dto.contactEmail !== undefined && worker.user) {
      const email = dto.contactEmail.trim().toLowerCase();
      worker.user.email = email || undefined;
      await this.userRepo.save(worker.user);
    }

    const qualityResult = this.rescoreWorker(worker);
    await this.workerRepo.save(worker);

    return { profileQualityScore: qualityResult.score };
  }

  async saveWorkerPushToken(userId: string, token: string): Promise<void> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: userId } } });
    if (!worker) return;
    worker.expoPushToken = token;
    await this.workerRepo.save(worker);
  }

  async updateWorkerPhoto(userId: string, photoUrl: string): Promise<{ profileQualityScore: number }> {
    const worker = await this.workerRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!worker) throw new NotFoundException('Worker profile not found');

    worker.photoUrl = photoUrl;

    const qualityResult = this.rescoreWorker(worker);
    await this.workerRepo.save(worker);

    return { profileQualityScore: qualityResult.score };
  }

  /** Store (or clear, with null) the worker's CV and rescore the profile. */
  async updateWorkerCv(
    userId: string,
    cv: { url: string; fileName: string } | null,
  ): Promise<{ profileQualityScore: number; cvUrl: string | null; cvFileName: string | null }> {
    const worker = await this.workerRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!worker) throw new NotFoundException('Worker profile not found');

    worker.cvUrl      = cv?.url      ?? undefined;
    worker.cvFileName = cv?.fileName ?? undefined;
    worker.cvUploadedAt = cv ? new Date() : null;

    const qualityResult = this.rescoreWorker(worker);
    await this.workerRepo.save(worker);

    return {
      profileQualityScore: qualityResult.score,
      cvUrl:      worker.cvUrl      ?? null,
      cvFileName: worker.cvFileName ?? null,
    };
  }

  /**
   * Recompute a stored score against the CURRENT scoring rules and persist it
   * if it moved. Called on profile read so workers scored under an older rule
   * set (e.g. before the CV criterion) converge without a migration.
   */
  async refreshWorkerScoreIfStale(worker: Worker): Promise<Worker> {
    const previous = worker.profileQualityScore;
    const previousStatus = worker.status;
    this.rescoreWorker(worker);
    if (worker.profileQualityScore !== previous || worker.status !== previousStatus) {
      await this.workerRepo.save(worker);
    }
    return worker;
  }

  // ─── Admin: Worker Approval Queue ─────────────────────────────────────────

  async findPendingWorkers(): Promise<Worker[]> {
    return this.workerRepo.find({
      where: { status: 'PENDING_REVIEW' },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateWorkerStatus(
    workerId: string,
    status: 'ACTIVE' | 'REJECTED',
    reason?: string,
  ): Promise<{ id: string; status: string }> {
    const worker = await this.workerRepo.findOne({
      where: { id: workerId },
      relations: ['user'],
    });
    if (!worker) throw new NotFoundException('Worker not found');

    worker.status = status;
    await this.workerRepo.save(worker);
    return { id: worker.id, status };
  }

  // ─── Employer Creation ─────────────────────────────────────────────────────

  async createEmployer(dto: {
    email: string;
    password: string;
    companyName: string;
    nipc: string;
    nif?: string;
    sector: string;
    address: string;
    postalCode: string;
    city: string;
    emailVerificationToken: string;
  }): Promise<User> {
    const user = this.userRepo.create({
      email: dto.email,
      password: dto.password,
      role: 'EMPLOYER',
      emailVerified: false,
      emailVerificationToken: dto.emailVerificationToken,
    });
    const savedUser = await this.userRepo.save(user);

    const employer = this.employerRepo.create({
      user: savedUser,
      companyName: dto.companyName,
      nipc: dto.nipc,
      nif: dto.nif,
      sector: dto.sector,
      address: dto.address,
      postalCode: dto.postalCode,
      city: dto.city,
      subscriptionTier: 'NONE',
      isActive: false,
    });
    await this.employerRepo.save(employer);
    return savedUser;
  }

  async verifyEmail(token: string): Promise<boolean> {
    const user = await this.findByEmailVerificationToken(token);
    if (!user) return false;

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    await this.userRepo.save(user);
    return true;
  }

  // ─── Account deletion ──────────────────────────────────────────────────────

  /**
   * Why a worker can be blocked from deleting right now. `null` means the
   * deletion can proceed. Exposed separately so the app can warn *before* the
   * user types their confirmation, rather than failing them at the last step.
   */
  async workerDeletionBlocker(
    userId: string,
  ): Promise<{ reason: 'UPCOMING_SHIFTS' | 'UNPAID_WAGES'; count: number } | null> {
    const worker = await this.findWorkerProfile(userId);
    if (!worker) throw new NotFoundException('Worker profile not found');

    // A confirmed shift is a commitment to a company that has staffed around
    // it. Deleting mid-commitment would read to the employer as a no-show.
    const upcoming = await this.shiftRepo.count({
      where: {
        assignedWorker: { id: worker.id },
        status: In([
          ShiftStatus.PENDING_ACCEPTANCE,
          ShiftStatus.FILLED,
          ShiftStatus.ACTIVE,
        ]),
      },
    });
    if (upcoming > 0) return { reason: 'UPCOMING_SHIFTS', count: upcoming };

    // Money still owed to this worker. Anonymising now would destroy their own
    // evidence in a dispute — the IBAN and name the company needs to pay them.
    const unpaid = await this.wageRepo.count({
      where: {
        workerId: worker.id,
        status: In([
          WagePaymentStatus.PENDING,
          WagePaymentStatus.MARKED_PAID,
          WagePaymentStatus.DISPUTED,
          WagePaymentStatus.UNDER_REVIEW,
        ]),
      },
    });
    if (unpaid > 0) return { reason: 'UNPAID_WAGES', count: unpaid };

    return null;
  }

  /**
   * Delete a worker's account — Apple guideline 5.1.1(v) requires this to be
   * initiated and completed inside the app.
   *
   * **Anonymise, do not drop.** MCD contracts, the append-only ACT audit
   * trail, ratings and `wage_payments` all reference this worker and are
   * legally retained for inspection (GDPR Art. 17(3)(b) — retention required
   * by law). Dropping the row would either break those foreign keys or
   * cascade away compliance records Turnos is obliged to keep.
   *
   * So every identifying field is cleared and the row survives as an
   * anonymous shell. What remains is a worker id attached to shift history
   * with no name, no contact details, no NIF, no IBAN and no documents.
   *
   * `phone` and `email` are nulled rather than tombstoned because both are
   * UNIQUE — freeing them is also what lets a person sign up again later,
   * which is what someone deleting an account expects.
   */
  async deleteWorkerAccount(userId: string): Promise<{ filesRemoved: boolean }> {
    const blocker = await this.workerDeletionBlocker(userId);
    if (blocker) {
      throw new BadRequestException(
        blocker.reason === 'UPCOMING_SHIFTS'
          ? t('api.account.deleteBlockedShifts', { count: blocker.count })
          : t('api.account.deleteBlockedWages', { count: blocker.count }),
      );
    }

    const worker = await this.findWorkerProfile(userId);
    if (!worker) throw new NotFoundException('Worker profile not found');
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Remove the blobs before clearing the URLs — once the columns are null we
    // no longer know where the files were.
    const removed = await Promise.all([
      this.storage.deleteByUrl(worker.photoUrl),
      this.storage.deleteByUrl(worker.cvUrl),
    ]);

    worker.fullName           = undefined;
    worker.nif                = undefined;
    worker.iban               = undefined;
    worker.ibanShareConsentAt = null;
    worker.photoUrl           = undefined;
    worker.cvUrl              = undefined;
    worker.cvFileName         = undefined;
    worker.cvUploadedAt       = null;
    worker.bio                = undefined;
    worker.skills             = [];
    worker.languages          = [];
    worker.experiences        = [];
    worker.availableDays      = [];
    worker.isAvailableForWork = false;
    worker.expoPushToken      = undefined;   // stops every future push
    worker.profileQualityScore = 0;
    worker.isVerified         = false;
    worker.status             = 'DELETED';
    worker.deletedAt          = new Date();

    // `stripeAccountId` is deliberately KEPT. It is Stripe's record, not
    // personal data we hold, and it is the only way to reconcile a Pay Link
    // charge that already settled against this worker's Connect account.

    user.phone                 = undefined;
    user.email                 = undefined;
    user.googleId              = undefined;
    user.password              = undefined;
    user.emailVerificationToken = undefined;
    user.emailVerified         = false;

    await this.workerRepo.save(worker);
    await this.userRepo.save(user);

    return { filesRemoved: removed.every(Boolean) };
  }
}

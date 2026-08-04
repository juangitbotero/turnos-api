import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Worker } from './entities/worker.entity';
import { Employer } from './entities/employer.entity';
import {
  calculateProfileQualityScore,
  normalizeSkills,
  isValidNIF,
  isValidIBAN,
  ProfileQualityResult,
  WorkerExperience,
  JOB_TITLES,
  EXPERIENCE_LEVELS,
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
}

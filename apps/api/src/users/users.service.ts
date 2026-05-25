import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Worker } from './entities/worker.entity';
import { Employer } from './entities/employer.entity';
import {
  calculateProfileQualityScore,
  isValidNIF,
  isValidIBAN,
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

  async updateWorkerProfile(
    userId: string,
    dto: {
      fullName: string;
      nif: string;
      iban: string;
      skills: string[];
      availableDays: string[];
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
    worker.skills        = dto.skills;
    worker.availableDays = dto.availableDays;

    const qualityResult = calculateProfileQualityScore({
      hasPhoto:        !!worker.photoUrl,
      hasValidNif:     isValidNIF(dto.nif ?? ''),
      hasValidIban:    isValidIBAN(dto.iban ?? ''),
      skillsCount:     dto.skills?.length ?? 0,
      hasFullName:     !!(dto.fullName?.trim()),
      hasAvailability: (dto.availableDays?.length ?? 0) > 0,
    });

    worker.profileQualityScore = qualityResult.score;
    worker.status = qualityResult.status === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : 'INCOMPLETE';
    await this.workerRepo.save(worker);

    return {
      profileQualityScore: qualityResult.score,
      status: worker.status,
      missingItems: qualityResult.missingItems,
    };
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

    const qualityResult = calculateProfileQualityScore({
      hasPhoto:        true,
      hasValidNif:     isValidNIF(worker.nif ?? ''),
      hasValidIban:    isValidIBAN(worker.iban ?? ''),
      skillsCount:     worker.skills?.length ?? 0,
      hasFullName:     !!(worker.fullName?.trim()),
      hasAvailability: (worker.availableDays?.length ?? 0) > 0,
    });

    worker.profileQualityScore = qualityResult.score;
    if (qualityResult.status === 'PENDING_REVIEW') worker.status = 'PENDING_REVIEW';
    await this.workerRepo.save(worker);

    return { profileQualityScore: qualityResult.score };
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

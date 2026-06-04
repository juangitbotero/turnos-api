import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Rating } from './entities/rating.entity';
import { NoShowFlag } from './entities/no-show-flag.entity';
import { FavouriteWorker } from './entities/favourite-worker.entity';
import { Worker } from '../users/entities/worker.entity';
import { Employer } from '../users/entities/employer.entity';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { BADGE_THRESHOLDS } from '@turnos/shared';

export interface CreateRatingDto {
  shiftId: string;
  score: number;          // 1–5
  tags?: string[];
  review?: string;        // Employer written review (max 150 chars), shown to other employers
}

export interface CreateWorkerRatingDto {
  shiftId: string;
  score: number;          // 1–5 — internal only, hidden from public
}

export interface RatingReminderJobData {
  shiftId: string;
  shiftTitle: string;
  employerEmail: string;
  employerName: string;
}

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(
    @InjectRepository(Rating)
    private readonly ratingRepo: Repository<Rating>,

    @InjectRepository(NoShowFlag)
    private readonly noShowRepo: Repository<NoShowFlag>,

    @InjectRepository(FavouriteWorker)
    private readonly favouriteRepo: Repository<FavouriteWorker>,

    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,

    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,

    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectQueue('rating-reminder')
    private readonly reminderQueue: Queue,

    private readonly mail: MailService,
  ) {}

  // ── Submit rating ──────────────────────────────────────────────────────────

  async createRating(employerUserId: string, dto: CreateRatingDto): Promise<Rating> {
    if (dto.score < 1 || dto.score > 5) {
      throw new BadRequestException('Score must be between 1 and 5');
    }

    const employer = await this.employerRepo.findOne({
      where: { user: { id: employerUserId } },
      relations: ['user'],
    });
    if (!employer) throw new UnauthorizedException('Employer profile not found');

    const shift = await this.shiftRepo.findOne({
      where: { id: dto.shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status !== ShiftStatus.COMPLETED) {
      throw new BadRequestException('Can only rate a COMPLETED shift');
    }
    if (shift.employer.id !== employer.id) {
      throw new UnauthorizedException('You can only rate your own shifts');
    }
    if (!shift.assignedWorker) {
      throw new BadRequestException('Shift has no assigned worker to rate');
    }

    // Guard: one rating per employer per shift (direction = EMPLOYER_TO_WORKER)
    const existing = await this.ratingRepo.findOne({
      where: { shift: { id: shift.id }, rater: { id: employerUserId }, direction: 'EMPLOYER_TO_WORKER' },
    });
    if (existing) throw new ConflictException('You have already rated this shift');

    const rater = await this.userRepo.findOneOrFail({ where: { id: employerUserId } });
    const rating = this.ratingRepo.create({
      shift,
      rater,
      rateeWorker: shift.assignedWorker,
      direction: 'EMPLOYER_TO_WORKER',
      score: dto.score,
      tags: dto.tags ?? [],
      review: dto.review,
    });
    const saved = await this.ratingRepo.save(rating);

    // Async reputation recalculation (best-effort)
    this.recalculateWorkerReputation(shift.assignedWorker.id).catch(err => {
      this.logger.warn(`[Ratings] Reputation recalc failed for worker ${shift.assignedWorker!.id}: ${(err as Error).message}`);
    });

    this.logger.log(`[Ratings] Employer ${employer.id} rated worker ${shift.assignedWorker.id} → ${dto.score}★ (shift ${shift.id})`);
    return saved;
  }

  // ── Worker rates employer (internal only) ──────────────────────────────────

  async createWorkerRating(workerUserId: string, dto: CreateWorkerRatingDto): Promise<Rating> {
    if (dto.score < 1 || dto.score > 5) {
      throw new BadRequestException('Score must be between 1 and 5');
    }

    const worker = await this.workerRepo.findOne({
      where: { user: { id: workerUserId } },
      relations: ['user'],
    });
    if (!worker) throw new UnauthorizedException('Worker profile not found');

    const shift = await this.shiftRepo.findOne({
      where: { id: dto.shiftId },
      relations: ['employer', 'employer.user', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status !== ShiftStatus.COMPLETED) {
      throw new BadRequestException('Can only rate a COMPLETED shift');
    }
    if (shift.assignedWorker?.id !== worker.id) {
      throw new UnauthorizedException('You can only rate shifts you worked');
    }

    const existing = await this.ratingRepo.findOne({
      where: { shift: { id: shift.id }, rater: { id: workerUserId }, direction: 'WORKER_TO_EMPLOYER' },
    });
    if (existing) throw new ConflictException('You have already rated this employer');

    const rater = await this.userRepo.findOneOrFail({ where: { id: workerUserId } });
    const rating = this.ratingRepo.create({
      shift,
      rater,
      rateeEmployer: shift.employer,
      direction: 'WORKER_TO_EMPLOYER',
      score: dto.score,
      tags: [],
    });
    const saved = await this.ratingRepo.save(rating);
    this.logger.log(`[Ratings] Worker ${worker.id} rated employer ${shift.employer.id} → ${dto.score}★ (internal, shift ${shift.id})`);
    return saved;
  }

  // ── Reputation recalculation ───────────────────────────────────────────────

  async recalculateWorkerReputation(workerId: string): Promise<void> {
    const worker = await this.workerRepo.findOne({ where: { id: workerId } });
    if (!worker) return;

    // Use QueryBuilder aggregate — avoids TypeORM 0.3.x bug where select:[]
    // combined with a relation-based where clause silently drops the JOIN.
    const agg = await this.ratingRepo
      .createQueryBuilder('r')
      .select('AVG(r.score)', 'avg')
      .addSelect('COUNT(r.id)', 'cnt')
      .where('r.ratee_worker_id = :workerId', { workerId })
      .getRawOne<{ avg: string | null; cnt: string }>();

    const count = parseInt(agg?.cnt ?? '0', 10);

    if (count === 0) {
      // No ratings yet — reset to defaults
      worker.avgRating = null;
      worker.totalRatings = 0;
      worker.reputationScore = 100;
    } else {
      const avg = parseFloat(agg!.avg!);
      worker.avgRating = Math.round(avg * 100) / 100;    // 2 decimal places
      worker.totalRatings = count;
      worker.reputationScore = Math.round(Math.min(100, avg * 20)); // 5★ = 100, 1★ = 20
    }

    await this.recalculateBadges(worker);
    await this.workerRepo.save(worker);

    this.logger.log(`[Ratings] Worker ${workerId} reputation updated: avg=${worker.avgRating ?? '—'}, score=${worker.reputationScore}, badges=${worker.badges?.join(',') ?? '—'}`);
  }

  private async recalculateBadges(worker: Worker): Promise<void> {
    const badges: string[] = [];

    // VERIFIED — admin has approved the worker
    if (worker.status === 'ACTIVE') {
      badges.push('VERIFIED');
    }

    // TOP_RATED — high avg rating over enough shifts
    if (
      worker.avgRating !== null &&
      worker.avgRating >= BADGE_THRESHOLDS.TOP_RATED_MIN_AVG &&
      worker.totalRatings >= BADGE_THRESHOLDS.TOP_RATED_MIN_SHIFTS
    ) {
      badges.push('TOP_RATED');
    }

    // RELIABLE — zero no-shows + high completion rate over enough shifts
    if (
      worker.noShowCount === 0 &&
      Number(worker.completionRate) >= BADGE_THRESHOLDS.RELIABLE_MIN_COMPLETION &&
      worker.totalRatings >= BADGE_THRESHOLDS.RELIABLE_MIN_SHIFTS
    ) {
      badges.push('RELIABLE');
    }

    worker.badges = badges;
  }

  // ── Worker rating summary ──────────────────────────────────────────────────

  async getWorkerRatingSummary(workerId: string) {
    const worker = await this.workerRepo.findOne({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const recent = await this.ratingRepo.find({
      where: { rateeWorker: { id: workerId }, direction: 'EMPLOYER_TO_WORKER' },
      relations: ['rater'],
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return {
      avgRating:      worker.avgRating,
      totalRatings:   worker.totalRatings,
      noShowCount:    worker.noShowCount,
      completionRate: Number(worker.completionRate),
      badges:         worker.badges ?? [],
      recentRatings:  recent.map(r => ({
        score:     r.score,
        tags:      r.tags ?? [],
        review:    r.review,
        raterName: (r.rater as any)?.companyName ?? 'Empresa',
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  // ── Has rated check ────────────────────────────────────────────────────────

  async hasRatedShift(userId: string, shiftId: string, direction: 'EMPLOYER_TO_WORKER' | 'WORKER_TO_EMPLOYER' = 'EMPLOYER_TO_WORKER'): Promise<{ hasRated: boolean }> {
    const exists = await this.ratingRepo.findOne({
      where: { shift: { id: shiftId }, rater: { id: userId }, direction },
    });
    return { hasRated: !!exists };
  }

  // ── No-show reporting ──────────────────────────────────────────────────────

  async reportNoShow(
    employerUserId: string,
    shiftId: string,
    note?: string,
  ): Promise<{ message: string }> {
    const employer = await this.employerRepo.findOne({
      where: { user: { id: employerUserId } },
      relations: ['user'],
    });
    if (!employer) throw new UnauthorizedException('Employer profile not found');

    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['employer', 'assignedWorker'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.employer.id !== employer.id) {
      throw new UnauthorizedException('You can only report no-shows on your own shifts');
    }
    if (!shift.assignedWorker) {
      throw new BadRequestException('Shift has no assigned worker');
    }

    // Check for duplicate no-show flag for this shift
    const existing = await this.noShowRepo.findOne({
      where: { shift: { id: shiftId }, reportedBy: { id: employer.id } },
    });
    if (existing) throw new ConflictException('No-show already reported for this shift');

    const flag = this.noShowRepo.create({ shift, worker: shift.assignedWorker, reportedBy: employer, note });
    await this.noShowRepo.save(flag);

    // Increment noShowCount on worker
    shift.assignedWorker.noShowCount = (shift.assignedWorker.noShowCount ?? 0) + 1;
    await this.workerRepo.save(shift.assignedWorker);

    // Recalculate badges (RELIABLE is affected)
    await this.recalculateWorkerReputation(shift.assignedWorker.id);

    // Check 60-day window — if ≥ 3 flags, trigger admin review
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - BADGE_THRESHOLDS.NO_SHOW_REVIEW_DAYS);
    const recentFlags = await this.noShowRepo.count({
      where: { worker: { id: shift.assignedWorker.id }, createdAt: MoreThan(cutoff) },
    });

    if (recentFlags >= BADGE_THRESHOLDS.NO_SHOW_REVIEW_THRESHOLD) {
      this.logger.warn(`[Ratings] Worker ${shift.assignedWorker.id} reached ${recentFlags} no-shows in 60 days — triggering admin review`);
      await this.mail.sendMail({
        to: 'ops@turnos.pt',
        subject: `⚠️ Worker no-show review: ${shift.assignedWorker.fullName ?? shift.assignedWorker.id}`,
        html: `<p>O trabalhador <strong>${shift.assignedWorker.fullName ?? shift.assignedWorker.id}</strong>
               acumulou <strong>${recentFlags} faltas</strong> nos últimos 60 dias.</p>
               <p>Turno em questão: <strong>${shift.title}</strong> (${shiftId})</p>
               <p>Reveja manualmente na plataforma Turnos Admin.</p>`,
      });
    }

    this.logger.log(`[Ratings] No-show reported for worker ${shift.assignedWorker.id} on shift ${shiftId}`);
    return { message: 'Falta registada com sucesso' };
  }

  // ── Favourite Workers ──────────────────────────────────────────────────────

  async getFavourites(employerUserId: string): Promise<FavouriteWorker[]> {
    const employer = await this.resolveEmployer(employerUserId);
    return this.favouriteRepo.find({
      where: { employer: { id: employer.id } },
      relations: ['worker'],
      order: { createdAt: 'DESC' },
    });
  }

  async addFavourite(employerUserId: string, workerId: string): Promise<{ message: string }> {
    const employer = await this.resolveEmployer(employerUserId);
    const worker = await this.workerRepo.findOne({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const existing = await this.favouriteRepo.findOne({
      where: { employer: { id: employer.id }, worker: { id: workerId } },
    });
    if (existing) return { message: 'Trabalhador já está nos favoritos' };

    await this.favouriteRepo.save(this.favouriteRepo.create({ employer, worker }));
    return { message: 'Trabalhador adicionado aos favoritos' };
  }

  async removeFavourite(employerUserId: string, workerId: string): Promise<{ message: string }> {
    const employer = await this.resolveEmployer(employerUserId);
    await this.favouriteRepo.delete({
      employer: { id: employer.id },
      worker:   { id: workerId },
    });
    return { message: 'Trabalhador removido dos favoritos' };
  }

  /** Returns Worker IDs that are favourites of this employer. Used by NotificationsService. */
  async getFavouriteWorkerIds(employerId: string): Promise<string[]> {
    const favs = await this.favouriteRepo.find({
      where: { employer: { id: employerId } },
      relations: ['worker'],
    });
    return favs.map(f => f.worker.id);
  }

  // ── Rating reminder (email to employer 30 min after shift completes) ───────

  /**
   * Called by AttendanceService after shift completes.
   * Looks up the employer's email from the User entity and enqueues a
   * delayed BullMQ job (30 min) to send the rating-prompt email.
   */
  async scheduleRatingReminder(shiftId: string, shiftTitle: string, employerId: string): Promise<void> {
    const employer = await this.employerRepo.findOne({
      where: { id: employerId },
      relations: ['user'],
    });
    if (!employer?.user?.email) {
      this.logger.warn(`[Ratings] Employer ${employerId} has no email — skipping rating reminder`);
      return;
    }

    const jobData: RatingReminderJobData = {
      shiftId,
      shiftTitle,
      employerEmail: employer.user.email,
      employerName:  employer.companyName,
    };

    await this.reminderQueue.add('rating-reminder', jobData, { delay: 30 * 60 * 1000 });
    this.logger.log(`[Ratings] Rating reminder scheduled for employer ${employer.user.email} (shift ${shiftId})`);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async resolveEmployer(userId: string): Promise<Employer> {
    const employer = await this.employerRepo.findOne({ where: { user: { id: userId } } });
    if (!employer) throw new UnauthorizedException('Employer profile not found');
    return employer;
  }
}

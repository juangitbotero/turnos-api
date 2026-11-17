import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { In, Repository } from 'typeorm';
import { isRoleUsable, normalizeSkill, resolveWorkerRoles, roleNeedsCertificate } from '@turnos/shared';
import { Worker } from '../users/entities/worker.entity';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';
import { ShiftApplication } from '../shifts/entities/shift-application.entity';
import { NotificationsService, WorkerMessage } from './notifications.service';
import { BUSINESS_TIME_ZONE, lisbonDateTime } from '../common/lisbon-time';

/** Days without opening the app before the first reminder. */
export const REENGAGEMENT_INACTIVE_DAYS = 4;
/** Minimum gap between two reminders to the same worker. */
export const REENGAGEMENT_MIN_GAP_DAYS = 10;
/** Reminders per inactivity streak — opening the app resets the count. */
export const REENGAGEMENT_MAX_PER_STREAK = 2;
/** A shift starting sooner than this is not worth waking someone up for. */
const MIN_LEAD_MS = 3 * 3_600_000;

/**
 * "Shifts waiting for you" — the reminder for workers who stopped opening the app.
 *
 * Daily at 10:00 UTC (10–11h in Lisbon). A worker gets it only when ALL hold:
 *   - ACTIVE, not blocked or suspended, availability switch on, has a push token;
 *   - hasn't opened the app for REENGAGEMENT_INACTIVE_DAYS (lastActiveAt, else createdAt);
 *   - fewer than 2 reminders since they last opened it, and none in the last 10 days;
 *   - at least one OPEN shift, starting 3h+ from now, matches a role they declared
 *     at the shift's level (same rule as new-shift push targeting), from a company
 *     they haven't blocked, that they haven't already applied to.
 *
 * No match → no message. It never says "come back" without something real to
 * apply to; an empty reminder teaches people to ignore Turnos pushes.
 */
@Injectable()
export class ReengagementService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReengagementService.name);

  constructor(
    @InjectRepository(Worker) private readonly workerRepo: Repository<Worker>,
    @InjectRepository(Shift) private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(ShiftApplication) private readonly applicationRepo: Repository<ShiftApplication>,
    @InjectQueue('shift-notifications') private readonly queue: Queue,
    private readonly notifications: NotificationsService,
  ) {}

  async onApplicationBootstrap() {
    await this.queue.add('worker-reengagement', {}, {
      repeat: { pattern: '0 10 * * *' },
      jobId: 'worker-reengagement-daily',
    });
    this.logger.log('[Reengagement] Daily reminder registered: 0 10 * * *');
  }

  async run(now = new Date()): Promise<{ sent: number }> {
    const shifts = await this.openShifts(now);
    if (shifts.length === 0) {
      this.logger.log('[Reengagement] No open shifts — nothing to remind about');
      return { sent: 0 };
    }

    const inactiveBefore = new Date(now.getTime() - REENGAGEMENT_INACTIVE_DAYS * 86_400_000);
    const gapBefore = new Date(now.getTime() - REENGAGEMENT_MIN_GAP_DAYS * 86_400_000);
    const workers = await this.workerRepo.createQueryBuilder('worker')
      .where('worker.status = :status', { status: 'ACTIVE' })
      .andWhere('worker.deletedAt IS NULL')
      .andWhere('worker.isBlocked = false')
      .andWhere('worker.isAvailableForWork = true')
      .andWhere('worker.expoPushToken IS NOT NULL')
      .andWhere('(worker.suspendedUntil IS NULL OR worker.suspendedUntil < :now)', { now })
      .andWhere('COALESCE(worker.lastActiveAt, worker.createdAt) < :inactiveBefore', { inactiveBefore })
      .andWhere('worker.reengagementCount < :max', { max: REENGAGEMENT_MAX_PER_STREAK })
      .andWhere('(worker.reengagementSentAt IS NULL OR worker.reengagementSentAt < :gapBefore)', { gapBefore })
      .take(1000)
      .getMany();
    if (workers.length === 0) return { sent: 0 };

    const applied = await this.appliedShiftIds(workers.map(w => w.id), shifts.map(s => s.id));

    let sent = 0;
    for (const worker of workers) {
      const matches = this.matchingJobs(worker, shifts, applied.get(worker.id) ?? new Set());
      if (matches.length === 0) continue;

      const first = matches[0]!;
      const message: WorkerMessage = matches.length === 1
        ? { key: 'shiftsWaitingOne', params: { shift: first.title, rate: formatRate(first.grossHourlyRate) } }
        : { key: 'shiftsWaitingMany', params: { count: matches.length } };
      // One match opens that shift; several open the app on the feed.
      const data = matches.length === 1
        ? { type: 'shifts_waiting', shiftId: first.id }
        : { type: 'shifts_waiting' };

      await this.notifications.notifyWorker(worker, message, data).catch(() => {});
      await this.workerRepo.createQueryBuilder()
        .update(Worker)
        .set({ reengagementSentAt: now, reengagementCount: () => '"reengagementCount" + 1' })
        .where('id = :id', { id: worker.id })
        .execute();
      sent++;
    }
    this.logger.log(`[Reengagement] ${sent} reminder(s) sent (${workers.length} inactive worker(s) checked)`);
    return { sent };
  }

  /** OPEN shifts starting 3h+ from now, one per job (a series or a multi-slot line is one job). */
  private async openShifts(now: Date): Promise<Shift[]> {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE }).format(now);
    const rows = await this.shiftRepo.find({
      where: { status: ShiftStatus.OPEN },
      relations: ['employer'],
      order: { date: 'ASC', startTime: 'ASC' },
      take: 2000,
    });
    const seen = new Set<string>();
    return rows.filter(s => {
      if (s.date < today) return false;
      if (lisbonDateTime(s.date, s.startTime).getTime() - now.getTime() < MIN_LEAD_MS) return false;
      const job = s.lineId ?? s.seriesId ?? s.id;
      if (seen.has(job)) return false;
      seen.add(job);
      return true;
    });
  }

  /** workerId → shift ids they already applied to (any status). */
  private async appliedShiftIds(workerIds: string[], shiftIds: string[]): Promise<Map<string, Set<string>>> {
    const out = new Map<string, Set<string>>();
    if (!workerIds.length || !shiftIds.length) return out;
    const apps = await this.applicationRepo.find({
      where: { worker: { id: In(workerIds) } },
      relations: ['worker', 'shift'],
      select: { id: true, worker: { id: true }, shift: { id: true, seriesId: true, lineId: true } },
    });
    for (const a of apps) {
      if (!a.worker?.id || !a.shift?.id) continue;
      const set = out.get(a.worker.id) ?? new Set<string>();
      // Store the job key too, so applying to any day/slot covers the whole job.
      set.add(a.shift.id);
      set.add(a.shift.lineId ?? a.shift.seriesId ?? a.shift.id);
      out.set(a.worker.id, set);
    }
    return out;
  }

  /**
   * The worker's declared role at the shift's level or above — the exact rule
   * new-shift pushes use (NotificationsService.notifyMatchingWorkers). Level-1
   * shifts are open to anyone to APPLY, but "matches your profile" means the role.
   */
  private matchingJobs(worker: Worker, shifts: Shift[], applied: Set<string>): Shift[] {
    const roles = resolveWorkerRoles(worker);
    if (roles.length === 0) return [];
    const blocked = new Set(worker.blockedEmployerIds ?? []);
    return shifts.filter(s => {
      if (applied.has(s.id) || applied.has(s.lineId ?? s.seriesId ?? s.id)) return false;
      if (s.employer?.id && blocked.has(s.employer.id)) return false;
      const role = normalizeSkill(s.subcategory ?? s.skillsRequired?.[0] ?? '');
      if (!role) return false;
      const level = Math.max(1, s.requiredLevel || 1);
      return roles.some(r =>
        normalizeSkill(r.role) === role && r.level >= level &&
        (!roleNeedsCertificate(role) || isRoleUsable(r)));
    });
  }
}

function formatRate(rate: number | string): string {
  return `${Number(rate).toFixed(2).replace('.', ',')} €`;
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { NotificationsService } from '../notifications.service';
import { Shift, ShiftStatus } from '../../shifts/entities/shift.entity';
import { ShiftApplication, ApplicationStatus } from '../../shifts/entities/shift-application.entity';
import { closeApplications, closeStaleApplications } from '../../shifts/application-closing';
import { releasePendingOffer, ACCEPTANCE_WINDOW_MS } from '../../shifts/offer-release';
import { lisbonDateTime } from '../../common/lisbon-time';

export interface ReNotificationJobData {
  shiftId: string;
  shiftTitle: string;
  requiredSkills: string[];
  employerId: string;
}

/**
 * BullMQ processor: fires ~5 hours after a shift is published.
 * If the shift still has 0 applications, sends a second notification wave
 * to the NEXT batch of matching workers (skipping the first 20 already notified).
 */
@Processor('shift-notifications')
export class ReNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReNotificationProcessor.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(ShiftApplication)
    private readonly applicationRepo: Repository<ShiftApplication>,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    // ── Nightly shift expiry ────────────────────────────────────────────────
    if (job.name === 'expire-stale-shifts') {
      await this.runShiftExpiry();
      return;
    }

    // ── Worker acceptance timeout (2h) ──────────────────────────────────────
    if (job.name === 'acceptance-timeout') {
      const { shiftId: sid, applicationId, workerId } =
        job.data as { shiftId: string; applicationId: string; workerId?: string };
      // Jobs queued before 2026-10-11 carry no workerId — read it from the application.
      const expected = workerId ?? (await this.applicationRepo.findOne({
        where: { id: applicationId }, relations: ['worker'],
      }))?.worker?.id;
      if (!expected) return;
      await this.releaseOffer(sid, expected, 'timeout');
      return;
    }

    // ── Safety net: offers whose timeout job was lost ───────────────────────
    if (job.name === 'release-stale-offers') {
      await this.releaseStaleOffers();
      // Expiry used to run only at 02:00 UTC, so an unfilled shift sat as OPEN
      // (still in the feed, its applications "pending") until the next night.
      await this.runShiftExpiry();
      const closed = await closeStaleApplications(this.applicationRepo);
      if (closed) this.logger.log(`[Applications] ${closed} application(s) on expired/cancelled shifts closed`);
      return;
    }

    // ── Re-notification wave (default) ──────────────────────────────────────
    const { shiftId, shiftTitle, requiredSkills, employerId } = job.data as ReNotificationJobData;
    this.logger.log(`Re-notification check for shift ${shiftId}`);

    const shift = await this.shiftRepo.findOne({ where: { id: shiftId } });
    if (!shift || shift.status !== ShiftStatus.OPEN) {
      this.logger.log(`Shift ${shiftId} is no longer OPEN — skipping re-notification`);
      return;
    }

    const applicationCount = await this.applicationRepo.count({
      where: { shift: { id: shiftId } },
    });

    if (applicationCount > 0) {
      this.logger.log(
        `Shift ${shiftId} has ${applicationCount} application(s) — skipping re-notification`,
      );
      return;
    }

    this.logger.log(`Shift ${shiftId}: 0 applications after 5 h — sending second wave`);
    await this.notificationsService.notifyMatchingWorkers(
      shiftId,
      employerId,
      requiredSkills,
      shiftTitle,
      20, // skip the first 20 workers notified in wave 1
    );
  }

  /** Release one pending offer and tell the worker why. */
  private async releaseOffer(shiftId: string, workerId: string, why: 'timeout' | 'sweep'): Promise<void> {
    const released = await releasePendingOffer(
      { shiftRepo: this.shiftRepo, applicationRepo: this.applicationRepo }, shiftId, workerId,
    );
    if (!released) return;
    this.logger.log(`[AcceptanceTimeout] Shift ${shiftId} back to OPEN — no answer in 2h (${why})`);
    this.notificationsService.notifyWorker(released.worker, { key: 'acceptanceTimeout' },
      { type: 'acceptance_timeout', shiftId }).catch(() => {});
  }

  /**
   * Every 15 minutes: offers older than the acceptance window (plus 5 min of
   * slack for the normal job to run first). `updatedAt` is when the shift
   * entered PENDING_ACCEPTANCE — nothing else writes a shift while it waits.
   */
  private async releaseStaleOffers(): Promise<void> {
    // Compared on the database clock: `updatedAt` is a timestamp WITHOUT time
    // zone written by now(), and Postgres silently drops the offset of a JS
    // Date parameter — on a non-UTC host the cutoff landed hours off and fresh
    // offers were released after minutes (found testing locally, 2026-10-11).
    const minutes = Math.round(ACCEPTANCE_WINDOW_MS / 60000) + 5;
    const stale = await this.shiftRepo.createQueryBuilder('s')
      .leftJoinAndSelect('s.assignedWorker', 'w')
      .where('s.status = :status', { status: ShiftStatus.PENDING_ACCEPTANCE })
      // offeredAt (timestamptz) since 2026-10-11; updatedAt for offers made before it existed
      .andWhere(`COALESCE(s."offeredAt", s."updatedAt" AT TIME ZONE 'UTC') < now() - make_interval(mins => :minutes)`, { minutes })
      .getMany();
    const seen = new Set<string>();
    for (const shift of stale) {
      const key = shift.seriesId ?? shift.id;
      if (seen.has(key) || !shift.assignedWorker) continue;
      seen.add(key);
      await this.releaseOffer(shift.id, shift.assignedWorker.id, 'sweep');
    }
  }

  private async runShiftExpiry(): Promise<void> {
    const now = new Date();
    const candidates = await this.shiftRepo.find({
      where: [{ status: ShiftStatus.OPEN }, { status: ShiftStatus.PENDING_ACCEPTANCE }],
    });
    // Lisbon wall-clock: the API runs in UTC, and `new Date(y, m, d, h)` read
    // shift times as UTC — an hour late in summer (same bug as 2026-10-05).
    const toExpire = candidates.filter(shift => lisbonDateTime(shift.date, shift.endTime) < now);
    if (toExpire.length === 0) return;   // runs every 15 min — stay quiet when idle
    await this.shiftRepo.update({ id: In(toExpire.map(s => s.id)) }, { status: ShiftStatus.EXPIRED });
    await closeApplications(this.applicationRepo, toExpire.map(s => s.id), ApplicationStatus.EXPIRED);
    this.logger.log(`[ShiftExpiry] ${toExpire.length} shift(s) marked EXPIRED.`);
  }
}

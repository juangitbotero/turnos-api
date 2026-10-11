import { Repository } from 'typeorm';
import { ShiftApplication, ApplicationStatus } from './entities/shift-application.entity';

/**
 * Close the applications of shifts that will never happen.
 *
 * Until 2026-10-11 nothing did: a shift expired unfilled or cancelled by the
 * company left every application on it PENDING, so the worker's "Pendentes"
 * kept showing jobs from weeks ago. The outcome says what happened to the
 * SHIFT — EXPIRED or CANCELLED — rather than REJECTED, which would tell the
 * worker the company turned them down.
 *
 * - EXPIRED: the open applications and an unanswered offer (APPROVED on a
 *   shift that expired in PENDING_ACCEPTANCE).
 * - CANCELLED: the open applications and the confirmed worker's (APPROVED).
 */
export async function closeApplications(
  applicationRepo: Repository<ShiftApplication>,
  shiftIds: string[],
  outcome: ApplicationStatus.EXPIRED | ApplicationStatus.CANCELLED,
): Promise<void> {
  if (shiftIds.length === 0) return;
  await applicationRepo.createQueryBuilder()
    .update(ShiftApplication)
    .set({ status: outcome })
    .where('"shiftId" IN (:...shiftIds)', { shiftIds })
    .andWhere('status IN (:...open)', { open: [ApplicationStatus.PENDING, ApplicationStatus.APPROVED] })
    .execute();
}

/**
 * Catch-up for everything closed before closeApplications() existed, or by a
 * path that doesn't call it. Run by the 15-minute sweep; cheap when idle.
 */
export async function closeStaleApplications(applicationRepo: Repository<ShiftApplication>): Promise<number> {
  const run = (shiftStatus: string, outcome: ApplicationStatus) => applicationRepo.query(
    `UPDATE shift_applications a SET status = $1
       FROM shifts s
      WHERE a."shiftId" = s.id AND s.status = $2 AND a.status IN ('PENDING', 'APPROVED')`,
    [outcome, shiftStatus],
  ).then((r: unknown) => (Array.isArray(r) && typeof r[1] === 'number' ? r[1] : 0));
  return (await run('EXPIRED', ApplicationStatus.EXPIRED)) + (await run('CANCELLED', ApplicationStatus.CANCELLED));
}

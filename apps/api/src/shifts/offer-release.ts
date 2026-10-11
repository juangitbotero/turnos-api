import { Repository } from 'typeorm';
import { Shift, ShiftStatus } from './entities/shift.entity';
import { ShiftApplication, ApplicationStatus } from './entities/shift-application.entity';
import { OFFER_ACCEPTANCE_HOURS } from '@turnos/shared';
import { Worker } from '../users/entities/worker.entity';

/** How long a selected worker has to accept before the offer lapses. */
export const ACCEPTANCE_WINDOW_MS = OFFER_ACCEPTANCE_HOURS * 60 * 60 * 1000;

/**
 * Put a job whose offer is pending (PENDING_ACCEPTANCE) back on the market.
 *
 * One routine for the three ways an offer ends without an answer — the 2h
 * timeout job, the company's "Retirar oferta", and the 15-minute sweep that
 * catches offers whose timeout job was lost (a Redis restart drops delayed
 * jobs, which is how a shift could sit on "A aguardar trabalhador" forever
 * with no action available).
 *
 * - Every day of a series moves together, as when the offer was made.
 * - `expectedWorkerId` guards against a stale timeout: if that offer was
 *   already declined and the company offered the job to someone else, the
 *   old timer must not cancel the new offer early.
 * - The worker's applications: back to PENDING if they had applied (they are
 *   a candidate again), WITHDRAWN if the offer came from an invitation they
 *   never applied for — otherwise they would turn up as an "applicant".
 *
 * Returns the worker the offer was for, or null when nothing was released.
 */
export async function releasePendingOffer(
  repos: { shiftRepo: Repository<Shift>; applicationRepo: Repository<ShiftApplication> },
  shiftId: string,
  expectedWorkerId?: string,
): Promise<{ worker: Worker; shift: Shift } | null> {
  const { shiftRepo, applicationRepo } = repos;
  const shift = await shiftRepo.findOne({
    where: { id: shiftId },
    relations: ['employer', 'assignedWorker'],
  });
  const worker = shift?.assignedWorker;
  if (!shift || !worker || shift.status !== ShiftStatus.PENDING_ACCEPTANCE) return null;
  if (expectedWorkerId && worker.id !== expectedWorkerId) return null;

  const days = shift.seriesId
    ? await shiftRepo.find({ where: { seriesId: shift.seriesId }, relations: ['assignedWorker'] })
    : [shift];
  const pending = days.filter(d => d.status === ShiftStatus.PENDING_ACCEPTANCE && d.assignedWorker?.id === worker.id);
  const dayIds = pending.map(d => d.id);

  // Status guard in the UPDATE itself: a worker accepting at the same moment wins.
  await shiftRepo.createQueryBuilder()
    .update(Shift)
    .set({ status: ShiftStatus.OPEN, assignedWorker: null as any, offeredAt: null })
    .where('id IN (:...dayIds) AND status = :status', { dayIds, status: ShiftStatus.PENDING_ACCEPTANCE })
    .execute();

  const apps = await applicationRepo.createQueryBuilder('a')
    .where('a."shiftId" IN (:...dayIds) AND a."workerId" = :workerId', { dayIds, workerId: worker.id })
    .andWhere('a.status = :approved', { approved: ApplicationStatus.APPROVED })
    .getMany();
  for (const app of apps) {
    app.status = app.invited ? ApplicationStatus.WITHDRAWN : ApplicationStatus.PENDING;
  }
  if (apps.length) await applicationRepo.save(apps);

  return { worker, shift };
}

// expo-server-sdk ships ES modules Jest can't load; pushes aren't under test here
jest.mock('expo-server-sdk', () => ({ __esModule: true, default: class { static isExpoPushToken() { return false; } } }));

import { In } from 'typeorm';
import { ReNotificationProcessor } from './re-notification.processor';
import { ShiftStatus } from '../../shifts/entities/shift.entity';

/**
 * A multi-day job expires as a whole (2026-11-11). Before, only the day that
 * had passed expired: the app kept offering the rest of the job while the
 * dashboard showed it as expired.
 */
describe('shift expiry — multi-day jobs expire as a whole', () => {
  const day = (id: string, date: string, status: ShiftStatus, seriesId: string | null = null) =>
    ({ id, date, startTime: '08:00:00', endTime: '14:00:00', status, seriesId });

  function run(open: any[], expiredInSeries: any[] = []) {
    const shiftRepo = {
      find: jest.fn()
        .mockResolvedValueOnce(open)               // OPEN / PENDING_ACCEPTANCE days
        .mockResolvedValueOnce(expiredInSeries),   // already-EXPIRED days of those series
      update: jest.fn().mockResolvedValue({}),
    };
    const applicationRepo = { createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    })), update: jest.fn().mockResolvedValue({}) };
    const p = Object.create(ReNotificationProcessor.prototype) as any;
    Object.assign(p, { shiftRepo, applicationRepo, logger: { log: jest.fn() } });
    return { p, shiftRepo };
  }

  const expiredIds = (shiftRepo: any): string[] => {
    const call = shiftRepo.update.mock.calls[0];
    return call ? (call[0].id as ReturnType<typeof In>).value as string[] : [];
  };

  it('a past day expires the later open days of the same job', async () => {
    const { p, shiftRepo } = run([
      day('d1', '2020-01-01', ShiftStatus.OPEN, 'S'),
      day('d2', '2099-01-02', ShiftStatus.OPEN, 'S'),
      day('d3', '2099-01-03', ShiftStatus.OPEN, 'S'),
      day('other', '2099-01-02', ShiftStatus.OPEN, 'T'),   // another, future job
      day('single', '2099-01-02', ShiftStatus.OPEN),
    ]);
    await p.runShiftExpiry();
    expect(expiredIds(shiftRepo).sort()).toEqual(['d1', 'd2', 'd3']);
  });

  it('a job whose first day expired on an earlier run is finished off', async () => {
    const { p, shiftRepo } = run(
      [day('d2', '2099-01-02', ShiftStatus.OPEN, 'S'), day('d3', '2099-01-03', ShiftStatus.OPEN, 'S')],
      [day('d1', '2020-01-01', ShiftStatus.EXPIRED, 'S')],
    );
    await p.runShiftExpiry();
    expect(expiredIds(shiftRepo).sort()).toEqual(['d2', 'd3']);
  });

  it('nothing in the past, nothing expires', async () => {
    const { p, shiftRepo } = run([day('d2', '2099-01-02', ShiftStatus.OPEN, 'S')]);
    await p.runShiftExpiry();
    expect(shiftRepo.update).not.toHaveBeenCalled();
  });
});

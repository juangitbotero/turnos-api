jest.mock('expo-server-sdk', () => ({ __esModule: true, default: class { static isExpoPushToken() { return false; } } }));

import { ReengagementService } from './reengagement.service';
import { ShiftStatus } from '../shifts/entities/shift.entity';

/**
 * "Shifts waiting for you" (2026-11-17): only real matches, one entry per job,
 * nothing about shifts already applied to or from blocked companies.
 */
describe('reengagement reminder', () => {
  const NOW = new Date('2026-11-17T10:00:00Z');
  const shift = (id: string, over: Record<string, unknown> = {}) => ({
    id, title: `Turno ${id}`, date: '2026-11-20', startTime: '18:00:00', status: ShiftStatus.OPEN,
    subcategory: 'Barista', skillsRequired: ['Barista'], requiredLevel: 1, grossHourlyRate: 9.5,
    seriesId: null, lineId: null, employer: { id: 'emp1' }, ...over,
  });
  const worker = (over: Record<string, unknown> = {}) => ({
    id: 'w1', expoPushToken: 'ExponentPushToken[x]', preferredLanguage: 'pt', blockedEmployerIds: [],
    roles: [{ role: 'Barista', level: 2, tasks: [], years: null, confirmedShifts: 0, belowLevelCount: 0 }],
    ...over,
  });

  function setup(shifts: any[], workers: any[], apps: any[] = []) {
    const qb: any = {
      where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(workers),
      update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({}),
    };
    const notifications = { notifyWorker: jest.fn().mockResolvedValue(undefined) };
    const svc = new ReengagementService(
      { createQueryBuilder: () => qb } as any,
      { find: jest.fn().mockResolvedValue(shifts) } as any,
      { find: jest.fn().mockResolvedValue(apps) } as any,
      {} as any,
      notifications as any,
    );
    return { svc, notifications };
  }

  it('one matching shift → names it and links to it', async () => {
    const { svc, notifications } = setup([shift('s1')], [worker()]);
    expect(await svc.run(NOW)).toEqual({ sent: 1 });
    const [, msg, data] = notifications.notifyWorker.mock.calls[0];
    expect(msg).toEqual({ key: 'shiftsWaitingOne', params: { shift: 'Turno s1', rate: '9,50 €' } });
    expect(data).toEqual({ type: 'shifts_waiting', shiftId: 's1' });
  });

  it('counts a multi-day series once and sends the "many" message for 2+ jobs', async () => {
    const { svc, notifications } = setup([
      shift('a1', { seriesId: 'S' }), shift('a2', { seriesId: 'S', date: '2026-11-21' }), shift('b'),
    ], [worker()]);
    await svc.run(NOW);
    expect(notifications.notifyWorker.mock.calls[0][1]).toEqual({ key: 'shiftsWaitingMany', params: { count: 2 } });
  });

  it('skips other roles, levels above the worker, blocked companies, applied jobs and imminent shifts', async () => {
    const { svc, notifications } = setup([
      shift('role', { subcategory: 'Cozinheiro/a', skillsRequired: ['Cozinheiro/a'] }),
      shift('level', { requiredLevel: 3 }),
      shift('blocked', { employer: { id: 'bad' } }),
      shift('applied', { seriesId: 'AP' }),
      shift('soon', { date: '2026-11-17', startTime: '11:00:00' }),
    ], [worker({ blockedEmployerIds: ['bad'] })], [
      { worker: { id: 'w1' }, shift: { id: 'applied-day-2', seriesId: 'AP', lineId: null } },
    ]);
    expect(await svc.run(NOW)).toEqual({ sent: 0 });
    expect(notifications.notifyWorker).not.toHaveBeenCalled();
  });
});

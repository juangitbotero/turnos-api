import { NotFoundException } from '@nestjs/common';

// expo-server-sdk ships ESM that Jest's CommonJS transform can't load; this
// test never sends a push, so a stub is enough.
jest.mock('expo-server-sdk', () => ({ __esModule: true, default: class {} }));

import { AttendanceService } from './attendance.service';

/**
 * GET /attendance/:shiftId returned the full record — with the Worker entity
 * (NIF, IBAN, date of birth) and the check-in coordinates — to any signed-in
 * user who knew a shift id. Found 2026-11-04. Only the shift's own worker or
 * company may read it now, and only status fields.
 */
describe('attendance is readable only by the shift parties', () => {
  const shift = {
    id: 'shift-1',
    employer: { id: 'emp-1', user: { id: 'company-user' } },
    assignedWorker: { id: 'w-1', user: { id: 'worker-user' } },
  };
  const record = {
    id: 'att-1', status: 'CHECKED_IN', checkInAt: new Date(), checkOutAt: null,
    scheduledHours: '4.00', isManualOverride: false, disputeNote: null, disputeRaisedBy: null,
    checkInLat: 38.7, checkInLng: -9.1,
    worker: { nif: '123456789', iban: 'PT50000201231234567890154' },
  };

  function makeService() {
    const svc = Object.create(AttendanceService.prototype) as AttendanceService;
    Object.assign(svc as any, {
      shiftRepo: { findOne: jest.fn().mockResolvedValue(shift) },
      attendanceRepo: { findOne: jest.fn().mockResolvedValue(record) },
    });
    return svc;
  }

  it('refuses a worker who is not assigned to the shift', async () => {
    await expect(makeService().getAttendance('someone-else', 'WORKER', 'shift-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a company that does not own the shift', async () => {
    await expect(makeService().getAttendance('other-company', 'EMPLOYER', 'shift-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a worker id passed in the company role', async () => {
    await expect(makeService().getAttendance('worker-user', 'EMPLOYER', 'shift-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('gives the assigned worker and the company only status fields', async () => {
    for (const [user, role] of [['worker-user', 'WORKER'], ['company-user', 'EMPLOYER']] as const) {
      const view = await makeService().getAttendance(user, role, 'shift-1');
      expect(view).toMatchObject({ id: 'att-1', status: 'CHECKED_IN', scheduledHours: 4 });
      expect(view).not.toHaveProperty('worker');
      expect(view).not.toHaveProperty('shift');
      expect(view).not.toHaveProperty('checkInLat');
      expect(view).not.toHaveProperty('checkInLng');
    }
  });

  it('refuses disputes from anyone outside the shift', async () => {
    await expect(makeService().raiseDispute('someone-else', 'WORKER', 'shift-1', 'x'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});

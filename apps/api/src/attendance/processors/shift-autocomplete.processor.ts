import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { AttendanceService, AutoCompleteJobData } from '../attendance.service';

/**
 * Auto-completion of shifts at their scheduled end (v2.1 — no check-out scan).
 *
 * Two job types on the 'shift-autocomplete' queue:
 *   - 'auto-complete': scheduled at check-in with delay = scheduled end − now
 *   - 'sweep': repeatable every 15 min — completes any overdue ACTIVE shift
 *     whose job was lost (Redis flush, deploy timing, clock drift)
 */
@Processor('shift-autocomplete')
export class ShiftAutoCompleteProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ShiftAutoCompleteProcessor.name);

  constructor(
    private readonly attendance: AttendanceService,
    @InjectQueue('shift-autocomplete')
    private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Register the safety-net sweep (idempotent — BullMQ dedupes by jobId)
    await this.queue.add(
      'sweep',
      {},
      {
        repeat: { pattern: '*/15 * * * *' },
        jobId: 'attendance-sweep',
      },
    );
    this.logger.log('[AutoComplete] 15-min overdue-shift sweep registered');
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'sweep') {
      await this.attendance.sweepOverdueActiveShifts();
      return;
    }
    const { shiftId } = job.data as AutoCompleteJobData;
    await this.attendance.completeShift(shiftId, 'AUTO');
  }
}

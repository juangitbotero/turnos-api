import {
  Injectable, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { calculateTSU } from '@turnos/shared';
import { McdContract, SsStatus } from './entities/mcd-contract.entity';
import { ComplianceAuditLog, ComplianceEvent } from './entities/compliance-audit-log.entity';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';
import { Worker } from '../users/entities/worker.entity';
import { Employer } from '../users/entities/employer.entity';
import { SsDiretaJobData } from './processors/ss-direta.processor';
import { ReciboVerdeJobData } from './processors/recibo-verde.processor';

// Statutory MCD limits
const MCD_MAX_DAYS_PER_YEAR = 70;
const REST_PERIOD_HOURS     = 11;
const DEPENDENCY_FLAG_PCT   = 40;
const DEPENDENCY_BLOCK_PCT  = 50;

// SS notification fires this many ms before shift start (24h)
const SS_NOTIFY_BEFORE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    @InjectRepository(McdContract)
    private readonly contractRepo: Repository<McdContract>,

    @InjectRepository(ComplianceAuditLog)
    private readonly auditRepo: Repository<ComplianceAuditLog>,

    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,

    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,

    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,

    @InjectQueue('ss-direta')
    private readonly ssDiretaQueue: Queue,

    @InjectQueue('recibo-verde')
    private readonly reciboVerdeQueue: Queue,
  ) {}

  // ── Public helpers called by ShiftsService ────────────────────────────────

  /**
   * Run all pre-application compliance checks.
   * Throws BadRequestException if any hard block applies.
   * Returns { warning } string if a soft flag (40% dependency) applies.
   */
  async checkApplicationEligibility(
    worker: Worker,
    shift: Shift,
  ): Promise<{ warning?: string }> {
    await this.checkRestPeriod(worker, shift);
    await this.checkMcdAnnualLimit(worker, shift);
    const warning = await this.checkEconomicDependency(worker, shift.employer);
    return warning ? { warning } : {};
  }

  /**
   * Called immediately after employer confirms a worker (shift → FILLED).
   * Creates the MCD contract record and schedules SS Direta email notification.
   */
  async onShiftApproved(
    shift: Shift,
    worker: Worker,
    employer: Employer,
  ): Promise<void> {
    // Load full employer record to get accountantEmail
    const fullEmployer = await this.employerRepo.findOne({
      where: { id: employer.id },
      relations: ['user'],
    });
    if (!fullEmployer) return;

    // Determine NIF / NIPC from stored profiles
    const workerNif  = worker.nif  ?? 'N/A';
    const workerName = worker.fullName ?? 'Trabalhador';

    // Create the MCD contract record
    const contract = this.contractRepo.create({
      shift:         { id: shift.id } as Shift,
      worker:        { id: worker.id } as Worker,
      employer:      { id: employer.id } as Employer,
      workerName,
      workerNif,
      employerName:  fullEmployer.companyName,
      employerNipc:  fullEmployer.nipc,
      shiftDate:     shift.date,
      startTime:     shift.startTime.slice(0, 5),
      endTime:       shift.endTime.slice(0, 5),
      role:          shift.role ?? shift.subcategory ?? shift.title,
      grossHourlyRate: Number(shift.grossHourlyRate),
      address:       shift.address,
      ssStatus:      SsStatus.PENDING,
      ssAccountantEmail: fullEmployer.accountantEmail ?? fullEmployer.user?.email ?? null,
    });
    const saved = await this.contractRepo.save(contract);

    await this.log({
      event:      ComplianceEvent.CONTRACT_CREATED,
      workerId:   worker.id,
      employerId: employer.id,
      shiftId:    shift.id,
      contractId: saved.id,
      details: {
        workerNif,
        employerNipc: fullEmployer.nipc,
        shiftDate:    shift.date,
        role:         saved.role,
      },
    });

    // Schedule SS Direta email 24h before shift start
    const shiftStart = new Date(`${shift.date}T${shift.startTime.slice(0, 5)}:00`);
    const delay      = shiftStart.getTime() - Date.now() - SS_NOTIFY_BEFORE_MS;

    const jobData: SsDiretaJobData = {
      contractId:      saved.id,
      workerName:      saved.workerName,
      workerNif:       saved.workerNif,
      employerName:    saved.employerName,
      employerNipc:    saved.employerNipc,
      shiftDate:       saved.shiftDate,
      startTime:       saved.startTime,
      endTime:         saved.endTime,
      role:            saved.role ?? '',
      grossHourlyRate: Number(saved.grossHourlyRate),
      address:         saved.address,
      accountantEmail: saved.ssAccountantEmail ?? '',
    };

    // If shift is already within 24h, fire immediately (delay=0)
    await this.ssDiretaQueue.add('notify', jobData, {
      delay:    Math.max(delay, 0),
      attempts: 3,
      backoff:  { type: 'exponential', delay: 30_000 },
    });

    this.logger.log(`[Compliance] MCD contract ${saved.id} created. SS notification scheduled in ${Math.max(delay, 0) / 3600000}h`);
  }

  /**
   * Called immediately after a worker checks out (shift → COMPLETED).
   * Schedules two Recibo Verde push reminders to the worker:
   *   - Day +3 : gentle first reminder
   *   - Day +5 : final urgent reminder
   *
   * Workers on MCD contracts must submit their own Recibo Verde via
   * Portal das Finanças within 5 business days of shift completion.
   */
  async onShiftCompleted(
    shift: Shift,
    worker: Worker,
  ): Promise<void> {
    const hours      = this.calcHours(shift.startTime, shift.endTime);
    const grossAmount = Number(shift.grossHourlyRate) * hours;

    const baseData: Omit<ReciboVerdeJobData, 'reminderDay'> = {
      workerId:   worker.id,
      shiftId:    shift.id,
      shiftTitle: shift.title,
      shiftDate:  shift.date,
      grossAmount,
    };

    // Day +3 reminder (72h)
    await this.reciboVerdeQueue.add(
      'remind',
      { ...baseData, reminderDay: 3 } satisfies ReciboVerdeJobData,
      {
        delay:    3 * 24 * 60 * 60 * 1000,
        attempts: 3,
        backoff:  { type: 'exponential', delay: 60_000 },
      },
    );

    // Day +5 reminder (120h)
    await this.reciboVerdeQueue.add(
      'remind',
      { ...baseData, reminderDay: 5 } satisfies ReciboVerdeJobData,
      {
        delay:    5 * 24 * 60 * 60 * 1000,
        attempts: 3,
        backoff:  { type: 'exponential', delay: 60_000 },
      },
    );

    this.logger.log(
      `[Compliance] Recibo Verde reminders scheduled for worker ${worker.id} (shift ${shift.id}, €${grossAmount.toFixed(2)})`,
    );
  }

  // ── TSU & reporting endpoints ─────────────────────────────────────────────

  async getTsuReport(userId: string, month?: number, year?: number) {
    const employer = await this.employerRepo.findOne({ where: { user: { id: userId } } });
    if (!employer) throw new BadRequestException('Employer not found');

    const targetYear  = year  ?? new Date().getFullYear();
    const targetMonth = month ?? new Date().getMonth() + 1;
    const monthStr    = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

    const shifts = await this.shiftRepo.find({
      where: {
        employer:  { id: employer.id },
        status:    In([ShiftStatus.FILLED, ShiftStatus.ACTIVE, ShiftStatus.COMPLETED]),
      },
      relations: ['assignedWorker'],
    });

    const monthShifts = shifts.filter(s => s.date.startsWith(monthStr));

    const lineItems = monthShifts.map(s => {
      const hours = this.calcHours(s.startTime, s.endTime);
      const gross = Number(s.grossHourlyRate) * hours;
      const tsu   = calculateTSU(Number(s.grossHourlyRate));
      return {
        shiftId:           s.id,
        shiftDate:         s.date,
        role:              s.role ?? s.subcategory ?? s.title,
        workerName:        s.assignedWorker?.fullName ?? 'N/A',
        grossHourlyRate:   Number(s.grossHourlyRate),
        hoursWorked:       Math.round(hours * 100) / 100,
        grossAmount:       Math.round(gross * 100) / 100,
        employerTsu:       Math.round(tsu.employerContribution * hours * 100) / 100,
        workerTsu:         Math.round(tsu.workerDeduction * hours * 100) / 100,
        netWorkerAmount:   Math.round(tsu.workerNetAmount * hours * 100) / 100,
      };
    });

    const totals = lineItems.reduce(
      (acc, item) => ({
        grossAmount:     acc.grossAmount     + item.grossAmount,
        employerTsu:     acc.employerTsu     + item.employerTsu,
        workerTsu:       acc.workerTsu       + item.workerTsu,
        netWorkerAmount: acc.netWorkerAmount + item.netWorkerAmount,
        hoursWorked:     acc.hoursWorked     + item.hoursWorked,
      }),
      { grossAmount: 0, employerTsu: 0, workerTsu: 0, netWorkerAmount: 0, hoursWorked: 0 },
    );

    // Round totals
    Object.keys(totals).forEach(k => {
      (totals as Record<string, number>)[k] = Math.round((totals as Record<string, number>)[k] * 100) / 100;
    });

    return {
      period:      monthStr,
      currency:    'EUR',
      shifts:      lineItems,
      totals,
      generatedAt: new Date().toISOString(),
    };
  }

  async getMcdContracts(userId: string) {
    const employer = await this.employerRepo.findOne({ where: { user: { id: userId } } });
    if (!employer) throw new BadRequestException('Employer not found');

    return this.contractRepo.find({
      where:   { employer: { id: employer.id } },
      order:   { createdAt: 'DESC' },
      relations: ['worker', 'shift'],
    });
  }

  async getAuditLog(userId: string) {
    const employer = await this.employerRepo.findOne({ where: { user: { id: userId } } });
    if (!employer) throw new BadRequestException('Employer not found');

    return this.auditRepo.find({
      where: { employerId: employer.id },
      order: { createdAt: 'DESC' },
    });
  }

  async getWorkerDependencies(userId: string) {
    const worker = await this.workerRepo.findOne({ where: { user: { id: userId } } });
    if (!worker) throw new BadRequestException('Worker not found');

    const { earningsByEmployer, platformTotal } = await this.calcEarnings(worker);
    const monthsPassed    = new Date().getMonth() + 1;
    const externalProrated = Number(worker.declaredExternalMonthlyIncome ?? 0) * monthsPassed;
    const totalEarnings   = platformTotal + externalProrated;

    const employers = await this.employerRepo.findByIds(Object.keys(earningsByEmployer));
    const breakdown = employers.map(emp => {
      const earned = earningsByEmployer[emp.id] ?? 0;
      const pct    = totalEarnings > 0 ? (earned / totalEarnings) * 100 : 0;
      return {
        employerId:   emp.id,
        employerName: emp.companyName,
        earnedOnPlatform: Math.round(earned * 100) / 100,
        dependencyPct:    Math.round(pct * 10) / 10,
        flag:             pct >= DEPENDENCY_BLOCK_PCT ? 'BLOCKED' : pct >= DEPENDENCY_FLAG_PCT ? 'WARNING' : 'OK',
      };
    });

    return {
      declaredExternalMonthlyIncome: Number(worker.declaredExternalMonthlyIncome ?? 0),
      platformEarningsYTD:  Math.round(platformTotal * 100) / 100,
      externalEarningsYTD:  Math.round(externalProrated * 100) / 100,
      totalEarningsYTD:     Math.round(totalEarnings * 100) / 100,
      breakdown,
    };
  }

  /** Update worker's self-declared external monthly income */
  async updateWorkerExternalIncome(userId: string, amount: number): Promise<void> {
    const worker = await this.workerRepo.findOne({ where: { user: { id: userId } } });
    if (!worker) throw new BadRequestException('Worker not found');
    worker.declaredExternalMonthlyIncome = amount;
    await this.workerRepo.save(worker);
  }

  // ── Private compliance checks ─────────────────────────────────────────────

  private async checkRestPeriod(worker: Worker, newShift: Shift): Promise<void> {
    const lastConfirmed = await this.shiftRepo.findOne({
      where: {
        assignedWorker: { id: worker.id },
        status: In([ShiftStatus.FILLED, ShiftStatus.ACTIVE, ShiftStatus.COMPLETED]),
      },
      order: { date: 'DESC', endTime: 'DESC' },
    });

    if (!lastConfirmed) return;

    const lastEnd  = new Date(`${lastConfirmed.date}T${lastConfirmed.endTime.slice(0, 5)}:00`);
    const newStart = new Date(`${newShift.date}T${newShift.startTime.slice(0, 5)}:00`);
    const gapHours = (newStart.getTime() - lastEnd.getTime()) / 3_600_000;

    if (gapHours < REST_PERIOD_HOURS) {
      const availableAt  = new Date(lastEnd.getTime() + REST_PERIOD_HOURS * 3_600_000);
      const availableStr = availableAt.toLocaleString('pt-PT', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      });

      await this.log({
        event:    ComplianceEvent.REST_PERIOD_VIOLATION_ATTEMPT,
        workerId: worker.id,
        shiftId:  newShift.id,
        details:  { gapHours: Math.round(gapHours * 10) / 10, lastShiftId: lastConfirmed.id },
      });

      throw new BadRequestException(
        `Mínimo ${REST_PERIOD_HOURS}h de descanso obrigatório entre turnos (Diretiva Europeia do Tempo de Trabalho). Disponível a partir de ${availableStr}.`,
      );
    }
  }

  private async checkMcdAnnualLimit(worker: Worker, shift: Shift): Promise<void> {
    const yearStart = `${new Date().getFullYear()}-01-01`;

    const count = await this.shiftRepo.count({
      where: {
        employer:       { id: shift.employer.id },
        assignedWorker: { id: worker.id },
        status:         In([ShiftStatus.FILLED, ShiftStatus.ACTIVE, ShiftStatus.COMPLETED]),
        date:           MoreThanOrEqual(yearStart),
      },
    });

    if (count >= MCD_MAX_DAYS_PER_YEAR) {
      await this.log({
        event:      ComplianceEvent.MCD_LIMIT_ATTEMPT,
        workerId:   worker.id,
        employerId: shift.employer.id,
        shiftId:    shift.id,
        details:    { daysUsed: count, limit: MCD_MAX_DAYS_PER_YEAR },
      });

      throw new BadRequestException(
        `Limite MCD atingido: ${count}/${MCD_MAX_DAYS_PER_YEAR} dias com este empregador em ${new Date().getFullYear()}. ` +
        `Legislação portuguesa (Lei 93/2019) não permite mais de ${MCD_MAX_DAYS_PER_YEAR} dias/ano com o mesmo empregador.`,
      );
    }
  }

  private async checkEconomicDependency(
    worker: Worker,
    employer: Employer,
  ): Promise<string | null> {
    const { earningsByEmployer, platformTotal } = await this.calcEarnings(worker);

    const monthsPassed     = new Date().getMonth() + 1;
    const externalProrated = Number(worker.declaredExternalMonthlyIncome ?? 0) * monthsPassed;
    const totalEarnings    = platformTotal + externalProrated;

    if (totalEarnings === 0) return null;

    const employerEarnings = earningsByEmployer[employer.id] ?? 0;
    const dependencyPct    = (employerEarnings / totalEarnings) * 100;

    if (dependencyPct >= DEPENDENCY_BLOCK_PCT) {
      await this.log({
        event:      ComplianceEvent.DEPENDENCY_BLOCK_50,
        workerId:   worker.id,
        employerId: employer.id,
        details:    { dependencyPct: Math.round(dependencyPct * 10) / 10, totalEarnings, employerEarnings },
      });
      throw new BadRequestException(
        `Limite de dependência económica atingido: ${dependencyPct.toFixed(0)}% dos seus rendimentos anuais declarados provêm deste empregador. ` +
        `A Agenda do Trabalho Digno (Lei 13/2023) impede mais de ${DEPENDENCY_BLOCK_PCT}% de dependência de um único empregador.`,
      );
    }

    if (dependencyPct >= DEPENDENCY_FLAG_PCT) {
      await this.log({
        event:      ComplianceEvent.DEPENDENCY_FLAG_40,
        workerId:   worker.id,
        employerId: employer.id,
        details:    { dependencyPct: Math.round(dependencyPct * 10) / 10 },
      });
      return (
        `Atenção: ${dependencyPct.toFixed(0)}% dos seus rendimentos anuais declarados provêm deste empregador. ` +
        `O limite legal é ${DEPENDENCY_BLOCK_PCT}%. Considere diversificar.`
      );
    }

    return null;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Calculate gross earnings per employer for current calendar year */
  private async calcEarnings(
    worker: Worker,
  ): Promise<{ earningsByEmployer: Record<string, number>; platformTotal: number }> {
    const yearStart = `${new Date().getFullYear()}-01-01`;

    const shifts = await this.shiftRepo.find({
      where: {
        assignedWorker: { id: worker.id },
        status:         In([ShiftStatus.FILLED, ShiftStatus.ACTIVE, ShiftStatus.COMPLETED]),
        date:           MoreThanOrEqual(yearStart),
      },
      relations: ['employer'],
    });

    const earningsByEmployer: Record<string, number> = {};
    let platformTotal = 0;

    for (const s of shifts) {
      const hours  = this.calcHours(s.startTime, s.endTime);
      const gross  = Number(s.grossHourlyRate) * hours;
      const empId  = s.employer?.id;
      if (!empId) continue;
      earningsByEmployer[empId] = (earningsByEmployer[empId] ?? 0) + gross;
      platformTotal += gross;
    }

    return { earningsByEmployer, platformTotal };
  }

  /** Duration in decimal hours between two HH:mm[:ss] strings */
  calcHours(startTime: string, endTime: string): number {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let hours = (eh + em / 60) - (sh + sm / 60);
    if (hours < 0) hours += 24; // handle midnight crossover
    return hours;
  }

  /** Append an entry to the immutable audit log */
  async log(entry: {
    event:       ComplianceEvent;
    workerId?:   string;
    employerId?: string;
    shiftId?:    string;
    contractId?: string;
    details?:    Record<string, unknown>;
  }): Promise<void> {
    await this.auditRepo.save(
      this.auditRepo.create({
        event:      entry.event,
        workerId:   entry.workerId   ?? null,
        employerId: entry.employerId ?? null,
        shiftId:    entry.shiftId   ?? null,
        contractId: entry.contractId ?? null,
        details:    entry.details   ?? {},
      }),
    );
  }
}

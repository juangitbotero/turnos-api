/**
 * Demo data seeding — for recording the mobile walkthrough video.
 *
 * Runs INSIDE the API, so it goes in with a normal Railway deploy and is
 * triggered by one HTTP call. No database credentials leave Railway, and
 * because it uses the TypeORM repositories rather than hand-written SQL, every
 * column and enum value is checked by the compiler.
 *
 * ── Safety ────────────────────────────────────────────────────────────────
 * Every row written uses a DETERMINISTIC uuid beginning `dede`, which means:
 *   1. re-running is idempotent — rows are saved by id, never duplicated;
 *   2. `reset()` deletes exactly those ids and can't touch a real row;
 *   3. anything that leaks into a report is obviously demo data ("Demo · …").
 *
 * The worker is looked up BY PHONE and updated in place — it's a real account
 * someone signs into, so it is never fabricated and never deleted.
 *
 * The whole thing is disabled unless DEMO_SEED_TOKEN is set. See the controller.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, Like } from 'typeorm';
import { calculateTSU, TURNOS_FEE_FIXED_EUR, WorkerExperience } from '@turnos/shared';

import { User } from '../users/entities/user.entity';
import { Worker } from '../users/entities/worker.entity';
import { Employer } from '../users/entities/employer.entity';
import { Shift, ShiftStatus } from '../shifts/entities/shift.entity';
import { ShiftApplication, ApplicationStatus } from '../shifts/entities/shift-application.entity';
import { ShiftAttendance, AttendanceStatus } from '../attendance/entities/shift-attendance.entity';
import { PaymentRecord, PaymentType, PaymentStatus } from '../payments/entities/payment-record.entity';
import { WagePayment, WagePaymentType, WagePaymentStatus } from '../payments/entities/wage-payment.entity';
import { Rating } from '../ratings/entities/rating.entity';

const DEMO_PREFIX = 'dede';
const uuid = (kind: number, n: number) =>
  `${DEMO_PREFIX}${String(kind).padStart(4, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;

const EMP_USER = (n: number) => uuid(1, n);
const EMPLOYER = (n: number) => uuid(2, n);
const SHIFT    = (n: number) => uuid(3, n);
const APPLIC   = (n: number) => uuid(4, n);
const ATTEND   = (n: number) => uuid(5, n);
const PAYMENT  = (n: number) => uuid(6, n);
const WAGE     = (n: number) => uuid(7, n);
const RATING   = (n: number) => uuid(8, n);
const SERIES   = (n: number) => uuid(9, n);

const EMPLOYERS = [
  { n: 1, name: 'Demo · Café Central',        sector: 'Restauração' },
  { n: 2, name: 'Demo · Hotel Miradouro',     sector: 'Hotelaria' },
  { n: 3, name: 'Demo · Eventos Tejo',        sector: 'Eventos' },
  { n: 4, name: 'Demo · Mercado da Ribeira',  sector: 'Vendas' },
  { n: 5, name: 'Demo · Logística Alcântara', sector: 'Logística' },
];

const SPOTS = [
  { address: 'Rua Augusta 100, Lisboa',       lat: 38.7101, lng: -9.1373 },
  { address: 'Av. da Liberdade 200, Lisboa',  lat: 38.7223, lng: -9.1450 },
  { address: 'Praça do Comércio, Lisboa',     lat: 38.7075, lng: -9.1364 },
  { address: 'Cais do Sodré, Lisboa',         lat: 38.7057, lng: -9.1449 },
  { address: 'Parque das Nações, Lisboa',     lat: 38.7633, lng: -9.0950 },
  { address: 'LX Factory, Alcântara, Lisboa', lat: 38.7036, lng: -9.1786 },
  { address: 'Bairro Alto, Lisboa',           lat: 38.7133, lng: -9.1450 },
  { address: 'Belém, Lisboa',                 lat: 38.6968, lng: -9.2065 },
];

const ROLES = [
  { title: 'Bar service — evening shift', category: 'Restauração',        subcategory: 'Barman/Barmaid' },
  { title: 'Waiter — dinner service',     category: 'Restauração',        subcategory: 'Empregado/a de mesa' },
  { title: 'Barista — morning shift',     category: 'Restauração',        subcategory: 'Barista' },
  { title: 'Event host',                  category: 'Eventos',            subcategory: 'Assistente de eventos' },
  { title: 'Hotel receptionist',          category: 'Hotelaria',          subcategory: 'Rececionista' },
  { title: 'Shop assistant',              category: 'Vendas',             subcategory: 'Vendedor/a de loja' },
  { title: 'Warehouse assistant',         category: 'Logística',          subcategory: 'Assistente de armazém' },
  { title: 'Kitchen assistant',           category: 'Restauração',        subcategory: 'Assistente de cozinha' },
];

/** English, because the walkthrough video is in English. */
const REVIEWS = [
  { score: 5, review: 'Arrived early and got straight to work. Great attitude all evening.',      tags: ['pontual', 'boa_atitude'] },
  { score: 5, review: 'Very professional with customers. Would book again without hesitation.',   tags: ['profissional', 'comunicativo'] },
  { score: 4, review: 'Solid work through a very busy shift. Kept the bar clean and stocked.',    tags: ['profissional'] },
  { score: 5, review: 'Excellent communication. Asked the right questions before starting.',      tags: ['comunicativo', 'profissional'] },
  { score: 5, review: 'Handled a full room on his own. Calm and reliable under pressure.',        tags: ['profissional', 'boa_atitude'] },
  { score: 4, review: 'Punctual and tidy. Fitted into the team straight away.',                   tags: ['pontual'] },
  { score: 5, review: 'One of the best we have had this season. Friendly with every guest.',      tags: ['boa_atitude', 'comunicativo'] },
  { score: 5, review: 'Great pair of hands at the event. Stayed until everything was packed up.', tags: ['profissional', 'boa_atitude'] },
  { score: 4, review: 'Good service and quick to learn our till system.',                         tags: ['profissional'] },
  { score: 5, review: 'Reliable, polite and genuinely helpful. Highly recommended.',              tags: ['boa_atitude', 'pontual'] },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const at = (dateStr: string, hhmm: string) => new Date(`${dateStr}T${hhmm}:00`);
const hhmmss = (h: number) => `${String(h % 24).padStart(2, '0')}:00:00`;

export interface SeedSummary {
  worker:        { id: string; name: string | null; phone: string };
  currentMonth:  { grossEur: number; shifts: number };
  ratings:       { count: number; average: number; badges: string[] };
  liveShifts:    number;
  historyShifts: number;
}

type Repos = ReturnType<DemoSeedService['repos']>;

@Injectable()
export class DemoSeedService {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Repositories bound to a specific EntityManager.
   *
   * Injected repositories use the default connection, so calling them inside
   *  runs the writes OUTSIDE the transaction — the
   * rollback guarantee would have been silently fake. Everything here goes
   * through the manager the transaction hands us instead.
   */
  private repos(m: EntityManager) {
    return {
      userRepo:       m.getRepository(User),
      workerRepo:     m.getRepository(Worker),
      employerRepo:   m.getRepository(Employer),
      shiftRepo:      m.getRepository(Shift),
      appRepo:        m.getRepository(ShiftApplication),
      attendanceRepo: m.getRepository(ShiftAttendance),
      paymentRepo:    m.getRepository(PaymentRecord),
      wageRepo:       m.getRepository(WagePayment),
      ratingRepo:     m.getRepository(Rating),
    };
  }

  private async findWorker(R: Repos, phone: string): Promise<Worker> {
    const worker = await R.workerRepo.findOne({
      where: { user: { phone } },
      relations: ['user'],
    });
    if (!worker) {
      throw new NotFoundException(
        `No worker account with phone ${phone}. Sign in on the app once with that ` +
        `number so the account exists, then run this again — it deliberately does ` +
        `not fabricate the account you log into.`,
      );
    }
    return worker;
  }

  /**
   * @param phone         the worker account to fill in
   * @param historyCount  rated shifts in EARLIER months. 20 (with the 2 featured
   *                      ones) gives 22 ratings, which is what lights up all
   *                      three badges — TOP_RATED needs 10, RELIABLE needs 20.
   */
  async seed(phone: string, historyCount = 20): Promise<SeedSummary> {
    const worker = await this.findWorker(this.repos(this.dataSource.manager), phone);
    this.logger.log(`[Demo] Seeding for worker ${worker.id} (${phone})`);

    // One transaction: a partial seed would leave shifts with no payment rows
    // and a rating count that disagrees with the ratings table.
    return this.dataSource.transaction(async (m) => {
      const R = this.repos(m);
      await this.seedEmployers(R);

      let sum = 0;
      let count = 0;
      let currentMonthGross = 0;

      // The two shifts the video is about — both in the CURRENT month, so the
      // earnings screen's default view shows exactly these and nothing else.
      const featured = [
        { n: 1, hours: 5, rate: 9,  empN: 1, role: ROLES[0]!, dayOfMonth: 8,  wage: WagePaymentStatus.CONFIRMED },
        { n: 2, hours: 6, rate: 10, empN: 2, role: ROLES[4]!, dayOfMonth: 12, wage: WagePaymentStatus.MARKED_PAID },
      ];
      for (const [i, f] of featured.entries()) {
        const now = new Date();
        const date = iso(new Date(now.getFullYear(), now.getMonth(), f.dayOfMonth));
        const r = await this.completedShift(R, {
          n: f.n, worker, dateStr: date, hours: f.hours, rate: f.rate,
          empN: f.empN, role: f.role, review: REVIEWS[i]!, wageStatus: f.wage,
        });
        currentMonthGross += r.gross;
        sum += r.score; count++;
      }

      // History in EARLIER months — builds the rating and badges without
      // changing the current-month earnings total above.
      for (let i = 0; i < historyCount; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (1 + Math.floor(i / 5)));
        d.setDate(3 + (i % 5) * 5);
        const r = await this.completedShift(R, {
          n: 100 + i, worker, dateStr: iso(d),
          hours: 4 + (i % 4), rate: 9 + (i % 4),
          empN: (i % EMPLOYERS.length) + 1, role: ROLES[i % ROLES.length]!,
          review: REVIEWS[i % REVIEWS.length]!, wageStatus: WagePaymentStatus.CONFIRMED,
        });
        sum += r.score; count++;
      }

      const liveShifts = await this.seedLiveShifts(R, worker);
      const badges = await this.updateProfile(R, worker, sum, count);

      return {
        worker: { id: worker.id, name: worker.fullName ?? null, phone },
        currentMonth: { grossEur: Number(currentMonthGross.toFixed(2)), shifts: featured.length },
        ratings: { count, average: Number((sum / count).toFixed(2)), badges },
        liveShifts,
        historyShifts: historyCount,
      };
    });
  }

  private async seedEmployers(R: Repos): Promise<void> {
    for (const e of EMPLOYERS) {
      await R.userRepo.save(R.userRepo.create({
        id: EMP_USER(e.n),
        email: `demo${e.n}@turnos-demo.invalid`,
        role: 'EMPLOYER',
        emailVerified: true,
      }));
      await R.employerRepo.save(R.employerRepo.create({
        id: EMPLOYER(e.n),
        user: { id: EMP_USER(e.n) } as User,
        companyName: e.name,
        nipc: `50000000${e.n}`,
        sector: e.sector,
        address: 'Demo address, Lisboa',
        postalCode: '1100-001',
        city: 'Lisboa',
        subscriptionStatus: 'ACTIVE',
        subscriptionTier: 'STARTER',
      }));
    }
  }

  /** A completed shift plus everything that hangs off it. */
  private async completedShift(R: Repos, p: {
    n: number; worker: Worker; dateStr: string; hours: number; rate: number;
    empN: number; role: typeof ROLES[number];
    review: typeof REVIEWS[number]; wageStatus: WagePaymentStatus;
  }): Promise<{ gross: number; score: number }> {
    const gross = Number((p.hours * p.rate).toFixed(2));
    const tsu   = calculateTSU(gross);
    const spot  = SPOTS[p.n % SPOTS.length]!;
    const start = 18;

    await R.shiftRepo.save(R.shiftRepo.create({
      id: SHIFT(p.n),
      title: p.role.title,
      description: `${p.role.title} — demo shift for the walkthrough video.`,
      category: p.role.category,
      subcategory: p.role.subcategory,
      date: p.dateStr,
      startTime: hhmmss(start),
      endTime: hhmmss(start + p.hours),
      grossHourlyRate: p.rate,
      address: spot.address,
      lat: spot.lat,
      lng: spot.lng,
      status: ShiftStatus.COMPLETED,
      employer: { id: EMPLOYER(p.empN) } as Employer,
      assignedWorker: { id: p.worker.id } as Worker,
      skillsRequired: [p.role.subcategory],
      paymentMethod: 'TURNOS_PAY_LINK',
    }));

    await R.appRepo.save(R.appRepo.create({
      id: APPLIC(p.n),
      shift: { id: SHIFT(p.n) } as Shift,
      worker: { id: p.worker.id } as Worker,
      status: ApplicationStatus.APPROVED,
    }));

    await R.attendanceRepo.save(R.attendanceRepo.create({
      id: ATTEND(p.n),
      shift: { id: SHIFT(p.n) } as Shift,
      worker: { id: p.worker.id } as Worker,
      checkInAt: at(p.dateStr, `${String(start).padStart(2, '0')}:02`),
      checkOutAt: at(p.dateStr, `${String((start + p.hours) % 24).padStart(2, '0')}:00`),
      scheduledHours: p.hours,
      status: AttendanceStatus.COMPLETED,
      autoCompleted: true,
    }));

    // Drives GET /payments/worker/earnings
    await R.paymentRepo.save(R.paymentRepo.create({
      id: PAYMENT(p.n),
      shiftId: SHIFT(p.n),
      employerId: EMPLOYER(p.empN),
      workerId: p.worker.id,
      type: PaymentType.SHIFT_FEE,
      status: PaymentStatus.SUCCEEDED,
      grossAmount: gross,
      turnosFee: TURNOS_FEE_FIXED_EUR,
      workerNet: Number(tsu.workerNetAmount.toFixed(2)),
      employerTsu: Number(tsu.employerContribution.toFixed(2)),
      workerTsu: Number(tsu.workerDeduction.toFixed(2)),
      scheduledHours: p.hours,
      shiftDate: p.dateStr,
    }));

    // Drives the wage chips in my-shifts
    await R.wageRepo.save(R.wageRepo.create({
      id: WAGE(p.n),
      shiftId: SHIFT(p.n),
      employerId: EMPLOYER(p.empN),
      workerId: p.worker.id,
      type: WagePaymentType.SHIFT_COMPLETION,
      status: p.wageStatus,
      amount: gross,
      processingFee: 0,
      paymentMethod: 'TURNOS_PAY_LINK',
      shiftTitle: p.role.title,
      shiftDate: p.dateStr,
      paidAt: p.wageStatus === WagePaymentStatus.PENDING ? null : at(p.dateStr, '23:30'),
      confirmedAt: p.wageStatus === WagePaymentStatus.CONFIRMED ? at(p.dateStr, '23:45') : null,
    }));

    await R.ratingRepo.save(R.ratingRepo.create({
      id: RATING(p.n),
      shift: { id: SHIFT(p.n) } as Shift,
      rater: { id: EMP_USER(p.empN) } as User,
      rateeWorker: { id: p.worker.id } as Worker,
      direction: 'EMPLOYER_TO_WORKER',
      score: p.review.score,
      tags: p.review.tags,
      review: p.review.review,
    }));

    return { gross, score: p.review.score };
  }

  /** Shifts the worker has NOT done — fills the feed and every my-shifts section. */
  private async seedLiveShifts(R: Repos, worker: Worker): Promise<number> {
    let n = 900;
    let made = 0;

    // OPEN shifts for the feed and map — production has none, so the feed
    // currently renders its empty state.
    const rates = [9, 10, 11, 12, 9.5, 10.5];
    for (let i = 0; i < 6; i++) {
      const role = ROLES[i % ROLES.length]!;
      const spot = SPOTS[i % SPOTS.length]!;
      await R.shiftRepo.save(R.shiftRepo.create({
        id: SHIFT(n), title: role.title,
        description: `${role.title}. Demo listing for the walkthrough video.`,
        category: role.category, subcategory: role.subcategory,
        date: iso(inDays(2 + i)), startTime: '18:00:00', endTime: '23:00:00',
        grossHourlyRate: rates[i]!, address: spot.address, lat: spot.lat, lng: spot.lng,
        status: ShiftStatus.OPEN,
        employer: { id: EMPLOYER((i % EMPLOYERS.length) + 1) } as Employer,
        skillsRequired: [role.subcategory],
        languagesRequired: ['Português', 'Inglês'],
        paymentMethod: 'TURNOS_PAY_LINK',
      }));
      n++; made++;
    }

    // Upcoming confirmed shift → the "Próximo turno" hero card
    {
      const role = ROLES[0]!, spot = SPOTS[1]!;
      await R.shiftRepo.save(R.shiftRepo.create({
        id: SHIFT(n), title: role.title, description: 'Your next confirmed shift.',
        category: role.category, subcategory: role.subcategory,
        date: iso(inDays(3)), startTime: '19:00:00', endTime: '23:00:00',
        grossHourlyRate: 11, address: spot.address, lat: spot.lat, lng: spot.lng,
        status: ShiftStatus.FILLED,
        employer: { id: EMPLOYER(1) } as Employer,
        assignedWorker: { id: worker.id } as Worker,
        skillsRequired: [role.subcategory], paymentMethod: 'TURNOS_PAY_LINK',
      }));
      await R.appRepo.save(R.appRepo.create({
        id: APPLIC(n), shift: { id: SHIFT(n) } as Shift,
        worker: { id: worker.id } as Worker, status: ApplicationStatus.APPROVED,
      }));
      n++; made++;
    }

    // Awaiting the worker's acceptance → the Aceitar / Recusar buttons
    {
      const role = ROLES[4]!, spot = SPOTS[2]!;
      await R.shiftRepo.save(R.shiftRepo.create({
        id: SHIFT(n), title: role.title,
        description: 'An employer picked you — accept within 2 hours.',
        category: role.category, subcategory: role.subcategory,
        date: iso(inDays(5)), startTime: '09:00:00', endTime: '15:00:00',
        grossHourlyRate: 12, address: spot.address, lat: spot.lat, lng: spot.lng,
        status: ShiftStatus.PENDING_ACCEPTANCE,
        employer: { id: EMPLOYER(2) } as Employer,
        assignedWorker: { id: worker.id } as Worker,
        skillsRequired: [role.subcategory], paymentMethod: 'MBWAY',
      }));
      n++; made++;
    }

    // Pending application → the "awaiting a response" section
    {
      const role = ROLES[3]!, spot = SPOTS[4]!;
      await R.shiftRepo.save(R.shiftRepo.create({
        id: SHIFT(n), title: role.title,
        description: 'You applied — waiting on the employer.',
        category: role.category, subcategory: role.subcategory,
        date: iso(inDays(6)), startTime: '16:00:00', endTime: '22:00:00',
        grossHourlyRate: 10.5, address: spot.address, lat: spot.lat, lng: spot.lng,
        status: ShiftStatus.OPEN,
        employer: { id: EMPLOYER(3) } as Employer,
        skillsRequired: [role.subcategory], paymentMethod: 'TRANSFERENCIA',
      }));
      await R.appRepo.save(R.appRepo.create({
        id: APPLIC(n), shift: { id: SHIFT(n) } as Shift,
        worker: { id: worker.id } as Worker, status: ApplicationStatus.PENDING,
        coverNote: 'Available all evening and happy to start early.',
      }));
      n++; made++;
    }

    // A confirmed 3-day job → the multi-day banner and List/Calendar toggle
    {
      const role = ROLES[6]!, spot = SPOTS[5]!;
      for (let d = 0; d < 3; d++) {
        await R.shiftRepo.save(R.shiftRepo.create({
          id: SHIFT(n), title: role.title,
          description: 'Three-day job — you committed to every day.',
          category: role.category, subcategory: role.subcategory,
          date: iso(inDays(9 + d)), startTime: '08:00:00', endTime: '14:00:00',
          grossHourlyRate: 10, address: spot.address, lat: spot.lat, lng: spot.lng,
          status: ShiftStatus.FILLED,
          employer: { id: EMPLOYER(5) } as Employer,
          assignedWorker: { id: worker.id } as Worker,
          skillsRequired: [role.subcategory], paymentMethod: 'TURNOS_PAY_LINK',
          seriesId: SERIES(1), seriesDayIndex: d + 1, seriesTotalDays: 3,
        }));
        await R.appRepo.save(R.appRepo.create({
          id: APPLIC(n), shift: { id: SHIFT(n) } as Shift,
          worker: { id: worker.id } as Worker, status: ApplicationStatus.APPROVED,
        }));
        n++; made++;
      }
    }

    return made;
  }

  private async updateProfile(R: Repos, worker: Worker, sum: number, count: number): Promise<string[]> {
    const avg = count ? Number((sum / count).toFixed(2)) : null;
    const badges = ['VERIFIED'];
    if (avg !== null && avg >= 4.5 && count >= 10) badges.push('TOP_RATED');
    if (count >= 20) badges.push('RELIABLE');

    const experiences: WorkerExperience[] = [
      { jobTitle: 'Barman/Barmaid',        level: 'FIVE_PLUS' },
      { jobTitle: 'Empregado/a de mesa',   level: 'ONE_FIVE' },
      { jobTitle: 'Barista',               level: 'ONE_FIVE' },
      { jobTitle: 'Assistente de eventos', level: 'ZERO_ONE' },
    ];

    await R.workerRepo.update(worker.id, {
      fullName: worker.fullName || 'Juanes Botero',
      bio: 'Hospitality and events worker based in Lisbon. Five years behind the bar ' +
           'and on the floor, comfortable in Portuguese, English and Spanish.',
      skills: ['Barman/Barmaid', 'Empregado/a de mesa', 'Barista', 'Assistente de eventos', 'Rececionista'],
      languages: ['Português', 'Inglês', 'Espanhol'],
      availableDays: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
      isAvailableForWork: true,
      experiences,
      nif: worker.nif || '123456789',
      iban: worker.iban || 'PT50000201231234567890154',
      ibanShareConsentAt: worker.ibanShareConsentAt ?? new Date(),
      status: 'ACTIVE',
      profileQualityScore: 100,
      avgRating: avg,
      totalRatings: count,
      reputationScore: avg === null ? 0 : Math.round(avg * 20),
      noShowCount: 0,
      completionRate: 1,
      badges,
    });

    return badges;
  }

  // ── Undo ─────────────────────────────────────────────────────────────────

  /** Delete every demo row. Only touches ids starting `dede`. */
  async reset(phone: string): Promise<Record<string, number>> {
    const worker = await this.findWorker(this.repos(this.dataSource.manager), phone);
    const like = Like(`${DEMO_PREFIX}%`);
    const removed: Record<string, number> = {};

    return this.dataSource.transaction(async (m) => {
      const R = this.repos(m);
      // Children before shifts — several of these reference a shift.
      for (const [name, repo] of [
        ['ratings', R.ratingRepo],
        ['wagePayments', R.wageRepo],
        ['paymentRecords', R.paymentRepo],
        ['attendance', R.attendanceRepo],
        ['applications', R.appRepo],
        ['shifts', R.shiftRepo],
        ['employers', R.employerRepo],
      ] as const) {
        const r = await (repo as Repository<any>).delete({ id: like });
        removed[name] = r.affected ?? 0;
      }
      const users = await R.userRepo.delete({ id: like, role: 'EMPLOYER' });
      removed['employerUsers'] = users.affected ?? 0;

      // The account is kept, and its counters are RECOMPUTED from the ratings
      // that survive — not zeroed. Zeroing assumed every rating was demo data,
      // which would erase a real worker's reputation the moment this is called
      // with a phone that has genuine ratings.
      const agg = await R.ratingRepo
        .createQueryBuilder('r')
        .select('AVG(r.score)', 'avg')
        .addSelect('COUNT(r.id)', 'count')
        .where('r."rateeWorkerId" = :id', { id: worker.id })
        .andWhere("r.direction = 'EMPLOYER_TO_WORKER'")
        .getRawOne<{ avg: string | null; count: string }>();

      const count = Number(agg?.count ?? 0);
      const avg   = count > 0 && agg?.avg != null ? Number(Number(agg.avg).toFixed(2)) : null;
      const badges = count > 0 ? ['VERIFIED'] : [];
      if (avg !== null && avg >= 4.5 && count >= 10) badges.push('TOP_RATED');
      if (count >= 20) badges.push('RELIABLE');

      await R.workerRepo.update(worker.id, {
        avgRating: avg,
        totalRatings: count,
        reputationScore: avg === null ? 0 : Math.round(avg * 20),
        badges,
      });
      removed['ratingsRemaining'] = count;

      this.logger.log(`[Demo] Reset complete: ${JSON.stringify(removed)}`);
      return removed;
    });
  }
}

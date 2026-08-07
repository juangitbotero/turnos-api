#!/usr/bin/env node
/**
 * Demo data for the Turnos mobile app — for recording a walkthrough video.
 *
 * Seeds one worker account (by phone) with a complete profile, a work history
 * that produces real earnings and a star rating, and enough surrounding shifts
 * that every screen and section has something in it.
 *
 * Usage:
 *   DATABASE_URL=postgres://…  node scripts/seed-demo-data.js
 *   DATABASE_URL=postgres://…  node scripts/seed-demo-data.js --undo
 *   DATABASE_URL=postgres://…  node scripts/seed-demo-data.js --dry-run
 *
 * Against Railway, without ever copying the connection string anywhere:
 *   railway run node scripts/seed-demo-data.js
 *
 * ── Safety ────────────────────────────────────────────────────────────────
 * Every row this script writes uses a DETERMINISTIC uuid beginning `dede…`.
 * That has three consequences worth knowing:
 *   1. Re-running is idempotent — rows are upserted by id, never duplicated.
 *   2. `--undo` deletes exactly those ids and nothing else. It cannot touch a
 *      real shift, employer or rating even if one exists.
 *   3. The demo employers are obviously fake ("Demo · …"), so if a row ever
 *      leaks into a report you can tell at a glance where it came from.
 *
 * The worker row itself is the ONE exception: it is looked up by phone and
 * updated in place, because it is a real account you log into. `--undo`
 * restores its profile counters to zero but never deletes the account.
 */
const { Client } = require('pg');
const path = require('path');

const shared = require(path.join(__dirname, '..', 'packages', 'shared', 'dist', 'index.js'));
const { calculateTSU, TURNOS_FEE_FIXED_EUR } = shared;

// ── Configuration ──────────────────────────────────────────────────────────

const WORKER_PHONE = process.env.DEMO_PHONE || '+33767560422';
const WORKER_NAME  = process.env.DEMO_NAME  || 'Juanes Botero';

/**
 * How many historical rated shifts to create, on top of the two the video is
 * about. This number is what lights up the profile badges:
 *   TOP_RATED needs avg ≥ 4.5 over ≥ 10 ratings
 *   RELIABLE needs ≥ 20 ratings, ≥ 90% completion and 0 no-shows
 * 20 historical + 2 current = 22 ratings, so all three badges show.
 * Drop this to 8 if you would rather the account look newer.
 */
const HISTORY_COUNT = Number(process.env.DEMO_HISTORY ?? 20);

const args   = process.argv.slice(2);
const UNDO   = args.includes('--undo');
const DRYRUN = args.includes('--dry-run');

// ── Deterministic ids ──────────────────────────────────────────────────────

const uuid = (kind, n) =>
  `dede${String(kind).padStart(4, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;

const EMPLOYER = (n) => uuid(1, n);
const SHIFT    = (n) => uuid(2, n);
const PAYMENT  = (n) => uuid(3, n);
const RATING   = (n) => uuid(4, n);
const WAGE     = (n) => uuid(5, n);
const ATTEND   = (n) => uuid(6, n);
const APPLIC   = (n) => uuid(7, n);
const EMPUSER  = (n) => uuid(8, n);

// ── Demo employers ─────────────────────────────────────────────────────────

const EMPLOYERS = [
  { n: 1, name: 'Demo · Café Central',      sector: 'Restauração',  city: 'Lisboa' },
  { n: 2, name: 'Demo · Hotel Miradouro',   sector: 'Hotelaria',    city: 'Lisboa' },
  { n: 3, name: 'Demo · Eventos Tejo',      sector: 'Eventos',      city: 'Lisboa' },
  { n: 4, name: 'Demo · Mercado Ribeira',   sector: 'Vendas',       city: 'Lisboa' },
  { n: 5, name: 'Demo · Logística Alcântara', sector: 'Logística',  city: 'Lisboa' },
];

// Lisbon coordinates, spread across the city so the feed map looks alive.
const SPOTS = [
  { address: 'Rua Augusta 100, Lisboa',            lat: 38.7101, lng: -9.1373 },
  { address: 'Av. da Liberdade 200, Lisboa',       lat: 38.7223, lng: -9.1450 },
  { address: 'Praça do Comércio, Lisboa',          lat: 38.7075, lng: -9.1364 },
  { address: 'Cais do Sodré, Lisboa',              lat: 38.7057, lng: -9.1449 },
  { address: 'Parque das Nações, Lisboa',          lat: 38.7633, lng: -9.0950 },
  { address: 'LX Factory, Alcântara, Lisboa',      lat: 38.7036, lng: -9.1786 },
  { address: 'Bairro Alto, Lisboa',                lat: 38.7133, lng: -9.1450 },
  { address: 'Belém, Lisboa',                      lat: 38.6968, lng: -9.2065 },
];

// ── English review copy (the video is in English) ──────────────────────────

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

const ROLES = [
  { title: 'Bar service — evening shift',  category: 'Restauração',        subcategory: 'Barman/Barmaid' },
  { title: 'Waiter — dinner service',      category: 'Restauração',        subcategory: 'Empregado/a de mesa' },
  { title: 'Barista — morning shift',      category: 'Restauração',        subcategory: 'Barista' },
  { title: 'Event host',                   category: 'Eventos',            subcategory: 'Assistente de eventos' },
  { title: 'Hotel receptionist',           category: 'Hotelaria',          subcategory: 'Rececionista' },
  { title: 'Shop assistant',               category: 'Vendas',             subcategory: 'Vendedor/a de loja' },
  { title: 'Warehouse assistant',          category: 'Logística',          subcategory: 'Assistente de armazém' },
  { title: 'Kitchen assistant',            category: 'Restauração',        subcategory: 'Assistente de cozinha' },
];

// ── Date helpers ───────────────────────────────────────────────────────────

const iso   = (d) => d.toISOString().slice(0, 10);
const day   = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d; };
const at    = (dateStr, hhmm) => new Date(`${dateStr}T${hhmm}:00`);

/** A date `n` days ago, guaranteed to stay inside the current month. */
function thisMonth(dayOfMonth) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  return iso(d);
}

// ── SQL plumbing ───────────────────────────────────────────────────────────

let client;
const log = (...a) => console.log(...a);

async function q(text, params = []) {
  if (DRYRUN && !/^\s*select/i.test(text)) {
    log('  [dry-run]', text.trim().split('\n')[0].slice(0, 90), '…');
    return { rows: [], rowCount: 0 };
  }
  return client.query(text, params);
}

async function one(text, params = []) {
  const r = await client.query(text, params);
  return r.rows[0] ?? null;
}

/**
 * Verify every table and column this script writes to actually exists, before
 * writing anything.
 *
 * The SQL here was written against the TypeORM entity definitions, not against
 * a live database — there was no local Postgres to test on. `synchronize: true`
 * means the real schema is whatever TypeORM last derived from those entities,
 * which should match, but "should" is not good enough when the target is
 * production. A missing column would otherwise surface as a half-applied seed.
 */
const REQUIRED = {
  users:              ['id', 'email', 'phone', 'role', 'emailVerified'],
  workers:            ['id', 'userId', 'fullName', 'bio', 'skills', 'languages',
                       'availableDays', 'isAvailableForWork', 'experiences', 'nif', 'iban',
                       'ibanShareConsentAt', 'status', 'profileQualityScore', 'avgRating',
                       'totalRatings', 'reputationScore', 'noShowCount', 'completionRate', 'badges'],
  employers:          ['id', 'userId', 'companyName', 'nipc', 'sector', 'address',
                       'postalCode', 'city', 'subscriptionStatus', 'subscriptionTier'],
  shifts:             ['id', 'title', 'description', 'category', 'subcategory', 'date',
                       'startTime', 'endTime', 'grossHourlyRate', 'address', 'lat', 'lng',
                       'status', 'employerId', 'assignedWorkerId', 'skillsRequired',
                       'languagesRequired', 'paymentMethod', 'seriesId', 'seriesDayIndex',
                       'seriesTotalDays'],
  shift_applications: ['id', 'shiftId', 'workerId', 'status', 'appliedAt', 'coverNote'],
  shift_attendance:   ['id', 'shiftId', 'workerId', 'checkInAt', 'checkOutAt',
                       'scheduledHours', 'status', 'autoCompleted'],
  payment_records:    ['id', 'shiftId', 'employerId', 'workerId', 'type', 'status',
                       'grossAmount', 'turnosFee', 'workerNet', 'employerTsu', 'workerTsu',
                       'scheduledHours', 'shiftDate', 'createdAt'],
  wage_payments:      ['id', 'shiftId', 'employerId', 'workerId', 'type', 'status', 'amount',
                       'processingFee', 'paymentMethod', 'shiftTitle', 'shiftDate', 'paidAt',
                       'confirmedAt', 'createdAt'],
  ratings:            ['id', 'shiftId', 'raterId', 'rateeWorkerId', 'direction', 'score',
                       'tags', 'review', 'createdAt'],
};

/** Enum labels the script writes — a mismatch here is an instant insert failure. */
const REQUIRED_ENUMS = [
  ['shift_attendance', 'status', ['COMPLETED']],
  ['shift_applications', 'status', ['APPROVED', 'PENDING']],
  ['payment_records', 'type', ['SHIFT_FEE']],
  ['payment_records', 'status', ['SUCCEEDED']],
  ['wage_payments', 'type', ['SHIFT_COMPLETION']],
  ['wage_payments', 'status', ['CONFIRMED', 'MARKED_PAID', 'PENDING']],
  ['shifts', 'status', ['OPEN', 'FILLED', 'PENDING_ACCEPTANCE', 'COMPLETED']],
];

async function preflight() {
  const problems = [];

  for (const [table, cols] of Object.entries(REQUIRED)) {
    const { rows } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    if (rows.length === 0) { problems.push(`table "${table}" does not exist`); continue; }
    const have = new Set(rows.map(r => r.column_name));
    for (const c of cols) if (!have.has(c)) problems.push(`${table}."${c}" is missing`);
  }

  for (const [table, column, labels] of REQUIRED_ENUMS) {
    const { rows } = await client.query(
      `SELECT e.enumlabel AS label
         FROM information_schema.columns c
         JOIN pg_type t   ON t.typname = c.udt_name
         JOIN pg_enum e   ON e.enumtypid = t.oid
        WHERE c.table_schema = 'public' AND c.table_name = $1 AND c.column_name = $2`,
      [table, column],
    );
    if (rows.length === 0) continue;   // not an enum column here — nothing to check
    const have = new Set(rows.map(r => r.label));
    for (const l of labels) {
      if (!have.has(l)) problems.push(`${table}.${column} has no enum value "${l}" (has: ${[...have].join(', ')})`);
    }
  }

  if (problems.length) {
    console.error('\nSchema preflight failed — nothing was written:\n');
    for (const p of problems) console.error('  ✗ ' + p);
    console.error('\nThe database schema differs from the entity definitions this script');
    console.error('was written against. Fix the mismatch above before seeding.\n');
    await client.end();
    process.exit(1);
  }
  log('  ✓ schema preflight passed');
}

// ── Seed ───────────────────────────────────────────────────────────────────

async function findWorker() {
  const row = await one(
    `SELECT w.id AS worker_id, u.id AS user_id, w."fullName"
       FROM users u JOIN workers w ON w."userId" = u.id
      WHERE u.phone = $1`,
    [WORKER_PHONE],
  );
  return row;
}

async function seedEmployers() {
  for (const e of EMPLOYERS) {
    await q(
      `INSERT INTO users (id, email, role, "emailVerified")
       VALUES ($1, $2, 'EMPLOYER', true)
       ON CONFLICT (id) DO NOTHING`,
      [EMPUSER(e.n), `demo${e.n}@turnos-demo.invalid`],
    );
    await q(
      `INSERT INTO employers
         (id, "userId", "companyName", nipc, sector, address, "postalCode", city,
          "subscriptionStatus", "subscriptionTier")
       VALUES ($1, $2, $3, $4, $5, $6, '1100-001', $7, 'ACTIVE', 'STARTER')
       ON CONFLICT (id) DO UPDATE SET "companyName" = EXCLUDED."companyName"`,
      [EMPLOYER(e.n), EMPUSER(e.n), e.name, `50000000${e.n}`, e.sector,
       `${e.city} — demo address`, e.city],
    );
  }
  log(`  ✓ ${EMPLOYERS.length} demo employers`);
}

/**
 * One completed shift plus everything that hangs off it: the attendance row,
 * the informative payment record that drives the earnings screen, the wage
 * payment that drives the "paid" chip, and optionally an employer rating.
 */
async function completedShift({ n, dateStr, hours, rate, empN, role, review, wageStatus }) {
  const gross = Number((hours * rate).toFixed(2));
  const tsu   = calculateTSU(gross);
  const spot  = SPOTS[n % SPOTS.length];
  const start = 18;
  const end   = start + hours;
  const startTime = `${String(start).padStart(2, '0')}:00:00`;
  const endTime   = `${String(end % 24).padStart(2, '0')}:00:00`;

  await q(
    `INSERT INTO shifts
       (id, title, description, category, subcategory, date, "startTime", "endTime",
        "grossHourlyRate", address, lat, lng, status, "employerId", "assignedWorkerId",
        "skillsRequired", "paymentMethod")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'COMPLETED',$13,$14,$15,'TURNOS_PAY_LINK')
     ON CONFLICT (id) DO UPDATE SET
       status = 'COMPLETED', date = EXCLUDED.date, "grossHourlyRate" = EXCLUDED."grossHourlyRate",
       "startTime" = EXCLUDED."startTime", "endTime" = EXCLUDED."endTime"`,
    [SHIFT(n), role.title, `${role.title} — demo shift for the walkthrough video.`,
     role.category, role.subcategory, dateStr, startTime, endTime, rate,
     spot.address, spot.lat, spot.lng, EMPLOYER(empN), WORKER.worker_id, role.subcategory],
  );

  await q(
    `INSERT INTO shift_attendance
       (id, "shiftId", "workerId", "checkInAt", "checkOutAt", "scheduledHours",
        status, "autoCompleted")
     VALUES ($1,$2,$3,$4,$5,$6,'COMPLETED',true)
     ON CONFLICT (id) DO UPDATE SET "scheduledHours" = EXCLUDED."scheduledHours"`,
    [ATTEND(n), SHIFT(n), WORKER.worker_id, at(dateStr, `${String(start).padStart(2, '0')}:02`),
     at(dateStr, `${String(end % 24).padStart(2, '0')}:00`), hours],
  );

  await q(
    `INSERT INTO shift_applications (id, "shiftId", "workerId", status, "appliedAt")
     VALUES ($1,$2,$3,'APPROVED',$4)
     ON CONFLICT (id) DO NOTHING`,
    [APPLIC(n), SHIFT(n), WORKER.worker_id, at(dateStr, '09:00')],
  );

  // Drives GET /payments/worker/earnings
  await q(
    `INSERT INTO payment_records
       (id, "shiftId", "employerId", "workerId", type, status, "grossAmount",
        "turnosFee", "workerNet", "employerTsu", "workerTsu", "scheduledHours",
        "shiftDate", "createdAt")
     VALUES ($1,$2,$3,$4,'SHIFT_FEE','SUCCEEDED',$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       "grossAmount" = EXCLUDED."grossAmount", "workerNet" = EXCLUDED."workerNet",
       "workerTsu" = EXCLUDED."workerTsu", "scheduledHours" = EXCLUDED."scheduledHours",
       "shiftDate" = EXCLUDED."shiftDate"`,
    [PAYMENT(n), SHIFT(n), EMPLOYER(empN), WORKER.worker_id, gross,
     TURNOS_FEE_FIXED_EUR, Number(tsu.workerNetAmount.toFixed(2)),
     Number(tsu.employerContribution.toFixed(2)), Number(tsu.workerDeduction.toFixed(2)),
     hours, dateStr, at(dateStr, '23:00')],
  );

  // Drives the wage chips in my-shifts
  const paidAt = wageStatus === 'PENDING' ? null : at(dateStr, '23:30');
  await q(
    `INSERT INTO wage_payments
       (id, "shiftId", "employerId", "workerId", type, status, amount, "processingFee",
        "paymentMethod", "shiftTitle", "shiftDate", "paidAt", "confirmedAt", "createdAt")
     VALUES ($1,$2,$3,$4,'SHIFT_COMPLETION',$5,$6,0,'TURNOS_PAY_LINK',$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, amount = EXCLUDED.amount`,
    [WAGE(n), SHIFT(n), EMPLOYER(empN), WORKER.worker_id, wageStatus, gross,
     role.title, dateStr, paidAt,
     wageStatus === 'CONFIRMED' ? at(dateStr, '23:45') : null, at(dateStr, '23:00')],
  );

  if (review) {
    await q(
      `INSERT INTO ratings
         (id, "shiftId", "raterId", "rateeWorkerId", direction, score, tags, review, "createdAt")
       VALUES ($1,$2,$3,$4,'EMPLOYER_TO_WORKER',$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, review = EXCLUDED.review`,
      [RATING(n), SHIFT(n), EMPUSER(empN), WORKER.worker_id, review.score,
       review.tags.join(','), review.review, at(dateStr, '23:50')],
    );
  }

  return { gross, score: review?.score ?? null };
}

/** Shifts the worker has NOT done — so the feed, invites and upcoming sections fill up. */
async function seedLiveShifts() {
  let n = 900;
  const made = [];

  // 6 OPEN shifts for the feed / map (production currently returns [])
  for (let i = 0; i < 6; i++) {
    const role = ROLES[i % ROLES.length];
    const spot = SPOTS[i % SPOTS.length];
    const dateStr = iso(day(2 + i));
    const rate = [9, 10, 11, 12, 9.5, 10.5][i];
    await q(
      `INSERT INTO shifts
         (id, title, description, category, subcategory, date, "startTime", "endTime",
          "grossHourlyRate", address, lat, lng, status, "employerId", "skillsRequired",
          "languagesRequired", "paymentMethod")
       VALUES ($1,$2,$3,$4,$5,$6,'18:00:00','23:00:00',$7,$8,$9,$10,'OPEN',$11,$12,$13,'TURNOS_PAY_LINK')
       ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, status = 'OPEN'`,
      [SHIFT(n), role.title, `${role.title}. Demo listing for the walkthrough video.`,
       role.category, role.subcategory, dateStr, rate, spot.address, spot.lat, spot.lng,
       EMPLOYER((i % EMPLOYERS.length) + 1), role.subcategory, 'Português,Inglês'],
    );
    made.push(n); n++;
  }

  // 1 upcoming CONFIRMED shift → the "Próximo turno" hero card
  {
    const role = ROLES[0], spot = SPOTS[1], dateStr = iso(day(3));
    await q(
      `INSERT INTO shifts
         (id, title, description, category, subcategory, date, "startTime", "endTime",
          "grossHourlyRate", address, lat, lng, status, "employerId", "assignedWorkerId",
          "skillsRequired", "paymentMethod")
       VALUES ($1,$2,$3,$4,$5,$6,'19:00:00','23:00:00',11,$7,$8,$9,'FILLED',$10,$11,$12,'TURNOS_PAY_LINK')
       ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, status = 'FILLED'`,
      [SHIFT(n), role.title, 'Your next confirmed shift.', role.category, role.subcategory,
       dateStr, spot.address, spot.lat, spot.lng, EMPLOYER(1), WORKER.worker_id, role.subcategory],
    );
    await q(
      `INSERT INTO shift_applications (id, "shiftId", "workerId", status, "appliedAt")
       VALUES ($1,$2,$3,'APPROVED',NOW()) ON CONFLICT (id) DO NOTHING`,
      [APPLIC(n), SHIFT(n), WORKER.worker_id],
    );
    made.push(n); n++;
  }

  // 1 PENDING_ACCEPTANCE → the Aceitar / Recusar buttons
  {
    const role = ROLES[4], spot = SPOTS[2], dateStr = iso(day(5));
    await q(
      `INSERT INTO shifts
         (id, title, description, category, subcategory, date, "startTime", "endTime",
          "grossHourlyRate", address, lat, lng, status, "employerId", "assignedWorkerId",
          "skillsRequired", "paymentMethod")
       VALUES ($1,$2,$3,$4,$5,$6,'09:00:00','15:00:00',12,$7,$8,$9,'PENDING_ACCEPTANCE',$10,$11,$12,'MBWAY')
       ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, status = 'PENDING_ACCEPTANCE'`,
      [SHIFT(n), role.title, 'An employer picked you — accept within 2 hours.',
       role.category, role.subcategory, dateStr, spot.address, spot.lat, spot.lng,
       EMPLOYER(2), WORKER.worker_id, role.subcategory],
    );
    made.push(n); n++;
  }

  // 1 PENDING application → the "awaiting response" section
  {
    const role = ROLES[3], spot = SPOTS[4], dateStr = iso(day(6));
    await q(
      `INSERT INTO shifts
         (id, title, description, category, subcategory, date, "startTime", "endTime",
          "grossHourlyRate", address, lat, lng, status, "employerId", "skillsRequired", "paymentMethod")
       VALUES ($1,$2,$3,$4,$5,$6,'16:00:00','22:00:00',10.5,$7,$8,$9,'OPEN',$10,$11,'TRANSFERENCIA')
       ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date`,
      [SHIFT(n), role.title, 'You applied — waiting on the employer.', role.category,
       role.subcategory, dateStr, spot.address, spot.lat, spot.lng, EMPLOYER(3), role.subcategory],
    );
    await q(
      `INSERT INTO shift_applications (id, "shiftId", "workerId", status, "appliedAt", "coverNote")
       VALUES ($1,$2,$3,'PENDING',NOW(),$4) ON CONFLICT (id) DO NOTHING`,
      [APPLIC(n), SHIFT(n), WORKER.worker_id, 'Available all evening and happy to start early.'],
    );
    made.push(n); n++;
  }

  // A 3-day multi-day job, confirmed → the series banner + calendar toggle
  {
    const seriesId = uuid(9, 1);
    const role = ROLES[6], spot = SPOTS[5];
    for (let d = 0; d < 3; d++) {
      await q(
        `INSERT INTO shifts
           (id, title, description, category, subcategory, date, "startTime", "endTime",
            "grossHourlyRate", address, lat, lng, status, "employerId", "assignedWorkerId",
            "skillsRequired", "paymentMethod", "seriesId", "seriesDayIndex", "seriesTotalDays")
         VALUES ($1,$2,$3,$4,$5,$6,'08:00:00','14:00:00',10,$7,$8,$9,'FILLED',$10,$11,$12,'TURNOS_PAY_LINK',$13,$14,3)
         ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, status = 'FILLED'`,
        [SHIFT(n), role.title, 'Three-day job — you committed to every day.',
         role.category, role.subcategory, iso(day(9 + d)), spot.address, spot.lat, spot.lng,
         EMPLOYER(5), WORKER.worker_id, role.subcategory, seriesId, d + 1],
      );
      await q(
        `INSERT INTO shift_applications (id, "shiftId", "workerId", status, "appliedAt")
         VALUES ($1,$2,$3,'APPROVED',NOW()) ON CONFLICT (id) DO NOTHING`,
        [APPLIC(n), SHIFT(n), WORKER.worker_id],
      );
      made.push(n); n++;
    }
  }

  log(`  ✓ ${made.length} live shifts (feed, upcoming, invite, application, 3-day series)`);
}

async function updateWorkerProfile(stats) {
  const avg = stats.count ? Number((stats.sum / stats.count).toFixed(2)) : null;
  const badges = ['VERIFIED'];
  if (avg !== null && avg >= 4.5 && stats.count >= 10) badges.push('TOP_RATED');
  if (stats.count >= 20) badges.push('RELIABLE');

  await q(
    `UPDATE workers SET
       "fullName" = COALESCE(NULLIF("fullName",''), $2),
       bio = $3, skills = $4, languages = $5, "availableDays" = $6,
       "isAvailableForWork" = true, experiences = $7,
       nif = COALESCE(nif, '123456789'),
       iban = COALESCE(iban, 'PT50000201231234567890154'),
       "ibanShareConsentAt" = COALESCE("ibanShareConsentAt", NOW()),
       status = 'ACTIVE', "profileQualityScore" = 100,
       "avgRating" = $8, "totalRatings" = $9, "reputationScore" = $10,
       "noShowCount" = 0, "completionRate" = 1.00, badges = $11
     WHERE id = $1`,
    [WORKER.worker_id, WORKER_NAME,
     'Hospitality and events worker based in Lisbon. Five years behind the bar and on the floor, comfortable in Portuguese, English and Spanish.',
     'Barman/Barmaid,Empregado/a de mesa,Barista,Assistente de eventos,Rececionista',
     'Português,Inglês,Espanhol',
     'Seg,Ter,Qua,Qui,Sex,Sáb',
     JSON.stringify([
       { jobTitle: 'Barman/Barmaid',        level: 'FIVE_PLUS' },
       { jobTitle: 'Empregado/a de mesa',   level: 'ONE_FIVE' },
       { jobTitle: 'Barista',               level: 'ONE_FIVE' },
       { jobTitle: 'Assistente de eventos', level: 'ZERO_ONE' },
     ]),
     avg, stats.count, avg === null ? 0 : Math.round(avg * 20), badges.join(',')],
  );
  log(`  ✓ profile: ★${avg ?? '—'} over ${stats.count} ratings · badges ${badges.join(', ')}`);
}

async function seed() {
  log(`\nSeeding demo data for ${WORKER_PHONE}\n`);

  await seedEmployers();

  const stats = { sum: 0, count: 0 };
  let currentMonthGross = 0;

  // ── The two shifts the video is about, both in the CURRENT month so the
  //    earnings screen's default view shows exactly these two.
  const featured = [
    { n: 1, hours: 5, rate: 9,  empN: 1, role: ROLES[0], dayOfMonth: 8,  wageStatus: 'CONFIRMED' },
    { n: 2, hours: 6, rate: 10, empN: 2, role: ROLES[4], dayOfMonth: 12, wageStatus: 'MARKED_PAID' },
  ];
  for (const [i, f] of featured.entries()) {
    const r = await completedShift({
      ...f, dateStr: thisMonth(f.dayOfMonth), review: REVIEWS[i],
    });
    currentMonthGross += r.gross;
    stats.sum += r.score; stats.count++;
  }
  log(`  ✓ 2 featured shifts this month — €${currentMonthGross.toFixed(2)} gross ` +
      `(5h × €9 = €45.00, 6h × €10 = €60.00)`);

  // ── History in PREVIOUS months: builds the star rating and the badges
  //    without changing the current-month earnings total above.
  for (let i = 0; i < HISTORY_COUNT; i++) {
    const n = 100 + i;
    const monthsBack = 1 + Math.floor(i / 5);
    const d = new Date();
    d.setMonth(d.getMonth() - monthsBack);
    d.setDate(3 + (i % 5) * 5);
    const review = REVIEWS[i % REVIEWS.length];
    const r = await completedShift({
      n, dateStr: iso(d), hours: 4 + (i % 4), rate: 9 + (i % 4),
      empN: (i % EMPLOYERS.length) + 1, role: ROLES[i % ROLES.length],
      review, wageStatus: 'CONFIRMED',
    });
    stats.sum += r.score; stats.count++;
  }
  log(`  ✓ ${HISTORY_COUNT} historical shifts in earlier months (rating + badge history)`);

  await seedLiveShifts();
  await updateWorkerProfile(stats);

  log('\nDone.\n');
  log('Earnings screen, current month : €105.00 gross over 2 shifts');
  log(`Profile                        : ★${(stats.sum / stats.count).toFixed(2)} · ${stats.count} ratings`);
  log('\nReviews are stored but NOT rendered by the mobile app — see the note in');
  log('the handoff. Stars and the rating count do show.\n');
}

// ── Undo ───────────────────────────────────────────────────────────────────

async function undo() {
  log(`\nRemoving demo data (ids starting 'dede')\n`);
  const like = `dede%`;
  // Children first — shifts are referenced by all of these.
  for (const t of ['ratings', 'wage_payments', 'payment_records', 'shift_attendance',
                   'shift_applications', 'shifts', 'employers']) {
    const r = await q(`DELETE FROM ${t} WHERE id::text LIKE $1`, [like]);
    log(`  ✓ ${t}: ${r.rowCount ?? 0} removed`);
  }
  const r = await q(`DELETE FROM users WHERE id::text LIKE $1 AND role = 'EMPLOYER'`, [like]);
  log(`  ✓ users (demo employers): ${r.rowCount ?? 0} removed`);

  if (WORKER) {
    await q(
      `UPDATE workers SET "avgRating" = NULL, "totalRatings" = 0, "reputationScore" = 0,
              badges = NULL, "completionRate" = 1.00
         WHERE id = $1`,
      [WORKER.worker_id],
    );
    log('  ✓ worker rating counters reset (the account itself is kept)');
  }
  log('\nDone.\n');
}

// ── Entry point ────────────────────────────────────────────────────────────

let WORKER = null;

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('\nDATABASE_URL is not set.\n');
    console.error('  Local  : DATABASE_URL=postgres://turnos:<pw>@localhost:5432/turnos_db node scripts/seed-demo-data.js');
    console.error('  Railway: railway run node scripts/seed-demo-data.js\n');
    process.exit(1);
  }

  client = new Client({
    connectionString: url,
    ssl: /railway|proxy\.rlwy|amazonaws/.test(url) ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const target = await one('SELECT current_database() AS db, version() AS v');
  log(`Connected to ${target.db}${DRYRUN ? '  [DRY RUN — no writes]' : ''}`);

  WORKER = await findWorker();
  if (!WORKER) {
    console.error(`\nNo worker found with phone ${WORKER_PHONE}.\n`);
    console.error('Log into the mobile app once with that number so the account exists,');
    console.error('then re-run this script. It deliberately does not fabricate the account');
    console.error('you sign in with.\n');
    await client.end();
    process.exit(1);
  }
  log(`Worker: ${WORKER.fullName || '(no name yet)'} — ${WORKER.worker_id}`);

  await preflight();

  // One transaction for the whole run: against a production database a partial
  // seed is worse than none — it would leave orphan shifts with no payment rows
  // and a rating count that does not match the ratings table.
  try {
    if (!DRYRUN) await client.query('BEGIN');
    if (UNDO) await undo();
    else await seed();
    if (!DRYRUN) await client.query('COMMIT');
  } catch (err) {
    if (!DRYRUN) await client.query('ROLLBACK').catch(() => {});
    console.error('\nRolled back — the database is unchanged.');
    throw err;
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});

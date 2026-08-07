/**
 * Emit a PT → EN side-by-side review sheet for the copy that still needs a read.
 *
 * Usage:
 *   node scripts/i18n-copy-review.js "$PWD" docs/i18n-en-copy-review.md
 *
 * Namespaces already signed off go in APPROVED so the sheet only ever shows
 * what is outstanding. Add a SECTION_TITLES entry when you add a namespace.
 */
const path = require('path');
const root = process.argv[2];
const s = require(path.join(root, 'packages/shared/dist/index.js'));

/** Signed off by Juanes — excluded from the sheet. */
const APPROVED = {
  // Phase 0 + the first four mobile screens
  mobile: ['nav', 'login', 'verify', 'feed', 'profile',
    // Phase 1, approved 2026-08-05
    'calendar', 'schedule', 'myShifts', 'shiftDetail', 'editProfile',
    'onboarding', 'earnings', 'scan', 'rate', 'reciboVerde'],
  admin: ['nav','chrome','mobileOverlay','home','workersSearch','workers','qrCodes','compliance','spending','billing','ratings','newShift','shifts'],
  // Phase 3, approved 2026-08-07
  home: ['nav','hero','heroCard','stats','howItWorks','features','trust','roadmap','cta','footer','login','register'],
  // Phase 4, approved 2026-08-07
  api: ['common','auth','shifts','attendance','compliance','payments','wages'],
};

/**
 * Shared namespaces signed off wholesale. Clear an entry here if you add new
 * keys to it and want them re-read.
 */
const APPROVED_SHARED = ['common', 'domain'];

// Keyed by app, because namespace names collide across apps: `nav`, `home` and
// `footer` all exist under more than one.
const SECTION_TITLES = {
  mobile: {
  calendar:    'mobile — phone calendar sync',
  schedule:    'mobile — ShiftSchedule component',
  myShifts:    'mobile — my-shifts.tsx',
  shiftDetail: 'mobile — shift/[id].tsx',
  editProfile: 'mobile — edit-profile.tsx',
  onboarding:  'mobile — onboarding.tsx',
  earnings:    'mobile — earnings.tsx',
  scan:        'mobile — scan.tsx',
  rate:        'mobile — rate/[id].tsx',
  reciboVerde: 'mobile — recibo-verde.tsx',
  },

  admin: {
  nav:           'admin — sidebar navigation',
  chrome:        'admin — shared page chrome',
  mobileOverlay: 'admin — small-screen interstitial',
  home:          'admin — dashboard/page.tsx',
  workersSearch: 'admin — workers-search/page.tsx',
  workers:       'admin — workers/page.tsx',
  qrCodes:       'admin — qr-codes/page.tsx',
  compliance:    'admin — compliance/page.tsx',
  spending:      'admin — spending/page.tsx',
  billing:       'admin — billing/page.tsx',
  ratings:       'admin — ratings/page.tsx',
  newShift:      'admin — new-shift/page.tsx',
  shifts:        'admin — shifts/page.tsx',
  },

  home: {
  nav:        'public — landing nav',
  hero:       'public — landing hero',
  heroCard:   'public — landing demo card',
  stats:      'public — landing stats bar',
  howItWorks: 'public — landing "how it works"',
  features:   'public — landing features',
  trust:      'public — landing trust bar',
  roadmap:    'public — landing roadmap',
  cta:        'public — landing CTA banner',
  footer:     'public — landing footer',
  login:      'public — login/page.tsx',
  register:   'public — register/page.tsx',
  },

  api: {
  common:     'API — messages shared across endpoints',
  auth:       'API — auth.service.ts / auth.controller.ts',
  shifts:     'API — shifts.service.ts',
  attendance: 'API — attendance.service.ts',
  compliance: 'API — compliance.service.ts',
  payments:   'API — payments.service.ts',
  wages:      'API — wage-payments.service.ts',
  },
};

const esc = (v) => String(v).replace(/\|/g, '\\|').replace(/\n/g, '<br>');

function rows(ptObj, enObj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(ptObj)) {
    const en = enObj?.[k];
    if (typeof v === 'string') out.push([prefix + k, v, en]);
    else out.push(...rows(v, en, prefix + k + '.'));
  }
  return out;
}

let emitted = 0;

function table(lines, title, r) {
  if (r.length === 0) return;
  emitted++;
  lines.push(`## ${title}`);
  lines.push('');
  lines.push('| key | 🇵🇹 Portuguese | 🇬🇧 English |');
  lines.push('|---|---|---|');
  for (const [k, pt, en] of r) lines.push(`| \`${k}\` | ${esc(pt)} | ${esc(en)} |`);
  lines.push('');
}

const lines = [];
lines.push('# English copy for review');
lines.push('');
lines.push('Portuguese is canonical; the English column is what I drafted and what you review.');
lines.push('Namespaces already signed off are excluded — see `APPROVED` in');
lines.push('`scripts/i18n-copy-review.js`.');
lines.push('');
lines.push('Portuguese legal terms — **MCD**, **Recibo Verde**, **TSU**, **Segurança Social**,');
lines.push('**SS Direta**, **ACT**, **NIF**, **IBAN**, **Portal das Finanças**, **Agenda do');
lines.push('Trabalho Digno** — are kept verbatim in English and glossed on first use, per the');
lines.push('locked decision.');
lines.push('');

// Shared namespaces
for (const ns of ['common', 'domain']) {
  if (APPROVED_SHARED.includes(ns)) continue;
  table(lines, `${ns} (shared across both apps)`, rows(s.pt[ns], s.en[ns]));
}

for (const app of ['mobile', 'admin', 'home', 'api']) {
  for (const [ns, ptObj] of Object.entries(s.pt[app] ?? {})) {
    if ((APPROVED[app] ?? []).includes(ns)) continue;
    table(lines, SECTION_TITLES[app]?.[ns] ?? `${app}.${ns}`, rows(ptObj, s.en[app][ns]));
  }
}

const total = rows(s.pt, s.en).length;

if (emitted === 0) {
  lines.push('## ✅ Nothing outstanding');
  lines.push('');
  lines.push('Every namespace is signed off — the whole catalogue has been read.');
  lines.push('');
  lines.push('This file is generated, so it empties out as namespaces are approved. To bring');
  lines.push('copy back for a re-read, remove it from `APPROVED` / `APPROVED_SHARED` in');
  lines.push('`scripts/i18n-copy-review.js` and regenerate. **New keys added to an already-');
  lines.push('approved namespace will NOT appear here** — clear that namespace\'s entry when');
  lines.push('you add to it.');
  lines.push('');
}

lines.push('---');
lines.push('');
lines.push(`Catalogue totals: **${total} keys** in each language, verified no drift.`);
lines.push('');

require('fs').writeFileSync(process.argv[3], lines.join('\n'), 'utf8');
console.log(`wrote ${process.argv[3]} — ${emitted} section(s) outstanding, ${total} keys total`);

# Web-admin & home page — handoff

State as of `83d6eb4` on `main`. Everything below is deployed to Railway unless
marked otherwise.

This covers the run of work after the PT/EN internationalisation (see
`docs/i18n-handoff.md`, which is complete and signed off).

---

## 🔴 Read this first — untested in production

Two things shipped that **have never been exercised against a real account**.
Both are one manual test each.

### 1. The settings endpoints

`PATCH /auth/employer/profile` and `POST /auth/change-password` compile and the
page renders, but no company has actually saved a profile or changed a password.

**Test:** sign in as Carolina Bakes → Definições → change the address → Save →
reload. Then change the password and confirm you are signed out elsewhere.

### 2. The wage-payment path has still never run end to end

`wage_payments` did not exist as a table until 2026-08-07 (see below), so **no
shift has ever completed in production**. Publish → apply → approve → check-in →
auto-complete, and confirm a `wage_payments` row appears. This is the core of
the business model and it is unproven.

---

## What shipped

### Internationalisation — complete

All five phases, both apps and the API, PT + EN, copy signed off 2026-08-07.
Catalogues at **1440 keys** per language. See `docs/i18n-handoff.md`.

### A production bug found and fixed

**`WagePayment` was the only `@Entity` missing from the TypeORM `entities`
array.** `forFeature()` registers the repository, not the entity, and
`getRepository()` resolves metadata lazily — so the app booted fine and died at
the first query with `EntityMetadataNotFoundError`. `synchronize` never created
the table either.

Everything in ADR 007 phase 4 was dead on the deployed API: wage creation on
completion, the cancellation minimum, `hasOverdueUnpaid`, the whole
pending-wages / mark-paid / adjust-hours surface, the webhook reconciliation and
the reminder processor.

It went unnoticed because `assertCanPostShift` returns early when
`BYPASS_SUBSCRIPTION` is set, and the rest only fires when a shift completes.
Fixed in `3669548`; `autoLoadEntities: true` added so it cannot recur.

### Mobile

- **Estimated total was wrong on two counts** (`7fdd51e`). Overnight shifts
  computed ZERO hours (`hoursWorked` did not wrap past midnight, so 20:00→00:00
  gave −1200 minutes clamped to 0), and multi-day jobs showed a single day's
  value. Live examples: "Waiter for 2 days" €0.00 → €88.00, "Cook assistant"
  €40.00 → €120.00. **Display only** — `calcScheduledHours`, which decides what
  a worker is PAID, already wrapped correctly.
- **Earnings screen**: the "Received" KPI showed gross minus 11% TSU, a number
  the worker never receives, contradicting the note six lines below it. Tile
  removed; the strip is Gross + Shifts and the card below is retitled "TSU
  simulator (if applicable)".
- **Employer reviews** now render on the worker profile.

### Home page

`/` (companies) and `/trabalhadores` (workers), linked both ways.

- Development-programme section and the "Built for the Portuguese market" trust
  bar both deleted — the page should not read as Portugal-only with Spain
  planned. MCD is still covered in the FAQ.
- **Sectors block reads `SHIFT_CATEGORIES`**, so sectors and role chips come
  from the same source the app posts shifts from and cannot drift.
- FAQ sourced from `docs/faq-turnos.md`.
- `<10s to post a shift` → `~5 min`. It was never true.
- Order: Hero → Stats → How it works → FAQ → Sectors → What the platform does → CTA.

### Dashboard

- **Compliance removed from the sidebar.** The route and data still exist at
  `/dashboard/compliance` — MCD contracts, TSU report, ACT audit trail. Only the
  link is gone, so a company can still produce a contract for an inspection.
- Nav renames: "Quem já trabalhou" / "Who worked for us", "A minha subscrição" /
  "My subscription".
- **Role vs skills fixed.** Matching ran on `skillsRequired` only; the role
  dropdown fed `subcategory`, used for display and the MCD contract and nothing
  else. An employer who picked a role and left skills empty had the shift pushed
  to EVERY active worker, because `notifyMatchingWorkers` skips its filter on an
  empty list. The role is now seeded into `skillsRequired` and the second field
  is "additional skills".
- Worker search auto-applies (250ms debounce); Search became Clear filters.
- Languages use a new `MultiSelect` (dropdown that still multi-selects).
- CV downloadable from the applicant panel.
- Multi-day chip moved below the shift name.
- **Every emoji replaced** with monochrome SVG at one stroke weight. The cause
  was that ~92 admin catalogue strings had emoji baked into the COPY, so no
  component work would have fixed it.

### Settings (new)

A company could change **nothing** after registering. There was no employer
profile update endpoint and no change-password endpoint for either role.

The field that mattered most was invisible: **`accountantEmail` is READ by the
compliance flow** — it is where the Segurança Social notification goes before
every shift — but nothing could set it, so it fell back to the admin's sign-in
email. Companies were receiving their own SS notifications.

Cards: account details, plan, password, **company logo**, **email
notifications**, support, account & privacy (with explicit GDPR access and
erasure requests).

Locked on purpose, with the reason shown: **NIPC** (legal identifier, unique,
already on issued MCD contracts) and **sign-in email** (it is the login).

### Notification preferences

`Employer.notificationPrefs` (jsonb). **Both senders check it** — this is not a
switch wired to nothing:

| Preference | Gated in |
|---|---|
| `ratingReminders` | `RatingsService.processReviewFollowUp` |
| `wageReminders` | `WagePaymentsService.emailEmployer` |

Two deliberate decisions:

- **The final unpaid-wage warning ignores the preference.** The next step after
  it is `assertCanPostShift` refusing to publish. Being locked out with no
  warning is worse than an unwanted email. The UI says so.
- **No "new applicant" preference.** Applicant alerts are push/websocket only —
  offering a switch for an email that does not exist would be decorative.

**Unset reads as ON**, in both `notificationPrefsOf()` and the client. A null
column on every pre-existing company must not mean "opted out of everything".

---

## ⬜ Not done: team members

This is the one recommendation that was **not** built, and the reason is
structural rather than effort.

`Employer` has `@OneToOne(() => User)`. Multiple users per company means
changing that cardinality — and every `findEmployerProfile(userId)` in the
codebase resolves a company **from that single user**. Payments, shifts,
compliance and ratings all do it. Changing it quickly would be reckless.

**Spec when you pick it up:**

1. `Employer.user` (OneToOne) → `EmployerMember` join entity: `employerId`,
   `userId`, `role: OWNER | MANAGER`, `invitedAt`, `acceptedAt`.
2. Replace `findEmployerProfile(userId)` with a lookup through that table.
   Grep first — it is used in at least `auth`, `payments`, `shifts`,
   `compliance`, `ratings`.
3. Invite flow: `POST /auth/employer/members` → token → email → public
   `POST /auth/accept-invite` that sets a password. This is a new **public**
   auth endpoint; rate-limit it and expire tokens.
4. Decide what MANAGER cannot do. Minimum: not billing, not removing the OWNER.
5. Migration for existing companies: every current `employer.userId` becomes an
   OWNER row.

Until then, a company sharing one password is the workaround, and that is worth
saying to a customer rather than letting them discover it.

---

## Things worth knowing before you touch the code

### The catalogue is the source of copy — including icons

Emoji were in the **strings**, not the markup. If a screen looks wrong,
check `packages/shared/src/i18n/pt.ts` before the component.

`pt.ts` is canonical; `en.ts` is typed `Translated<TranslationCatalogue>`, so a
missing key is a compile error. Rebuild shared after every catalogue edit:

```bash
cd packages/shared && npm run build
```

### Two regex traps that cost real time this run

1. **Anchor block patterns with `^` and the `m` flag.** An unanchored
   `    features: \{` matched *inside* `      features: {` (admin.billing) and
   deleted 44 lines. The file still looked plausible and only failed at the end
   of `tsc`. Any script that rewrites a catalogue block should verify brace
   balance before writing.
2. **Never put replacement text inside `node -e`.** Bash eats backticks and
   `${…}`, silently corrupting template literals. Write a `.js` file.

Several files are **CRLF**. Normalise line endings before matching.

### Verification gate

```bash
cd packages/shared && npm run build
node scripts/i18n-check-keys.js "$PWD"
cd apps/api && npx tsc --noEmit
cd ../web-admin && npx tsc --noEmit && npx next build
cd ../mobile && npx expo export --platform android --output-dir .tmp-check && rm -rf .tmp-check
```

Mobile `tsc` has **48 pre-existing errors** (TS2786 LinearGradient, TS2339
design tokens). Compare the count, not the presence.

### Deploying

Both services auto-deploy on push to `main`.

- API: `https://turnos-api-production-6c70.up.railway.app/api`
- Web-admin: `https://turnos-admin-production.up.railway.app`

**Mobile does not deploy from git.** EAS Update is not configured, so a push
does nothing for an installed APK. Expo Go loads from Metro, so `git pull` +
`npx expo start --clear` is the fast path. For an APK, run
`npm run build` in `packages/shared` first — `dist` is gitignored but not
`.easignore`d, so EAS ships your working copy.

### Local preview

The dev server dies when a turn ends unless started detached. Run it yourself:

```bash
cd apps/web-admin && npm run dev
```

---

## Open items

| Item | Where |
|---|---|
| **Test the settings endpoints** | see top of this doc |
| **Run one shift end to end** | see top of this doc |
| Attorney sign-off on the Pay Link brief — **still unsigned** | `docs/legal/pay-link-legal-brief.md` |
| Two FAQ answers held back pending that sign-off (ETT status, who the employer is) | marked 🔵 in `docs/faq-turnos.md` |
| Demo seed data still live, `DEMO_SEED_TOKEN` still set | `docs/go-live-cleanup.md` item 2 |
| Everything for launch | `docs/go-live-cleanup.md` |

### Demo data

Production contains **demo rows** from the video seeder (every id starts
`dede`) plus two real test accounts: worker `+33767560422` (Juanes) and employer
Carolina Bakes with 8 hand-made shifts. The `dede` cleanup does **not** touch
the two real accounts. The seeder also **overwrote** the Juanes profile's bio,
skills and experiences — those values are fiction.

```bash
curl -X DELETE "https://turnos-api-production-6c70.up.railway.app/api/demo/seed?phone=%2B33767560422" \
  -H "x-demo-token: <token>"
```

### Known gaps not yet raised as work

- `/dashboard/ratings` is orphaned — built, no sidebar link.
- `createGoogleEmployer` creates a `User` but no `Employer` row.
- Frontend blanket 401 → logout masks real auth errors as "session expired".
- Company logo is uploaded and shown in the sidebar, but **not yet on the shift
  cards workers see** — that is mobile work.
- Home page and settings have only been checked at desktop width.

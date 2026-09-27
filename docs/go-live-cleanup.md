# Go-live cleanup checklist

Everything that exists only for beta, demos or local development and must be
removed, rotated or hardened before real workers and paying companies arrive.

Written 2026-08-07, after seeding demo data for the walkthrough video. Verified
against the code at that date — re-check each grep before acting, since some of
these are load-bearing until the day they aren't.

Ordered by **what happens if you forget it**, worst first.

> **Status update 2026-09-27.** Items 2, 3, 5 and 6 are done (see
> `docs/pre-flight.md`, which is the index). Three sections were added at the
> end: **14 — email delivery** (nothing is being sent today), **15 — legal
> gates** (terms acceptance, statements of reasons, retention) and
> **16 — the law-firm pack**. Read those first; they are what is new.

---

## 🔴 Blockers — a real user is harmed or the platform is wide open

### 1. Hardcoded OTP `123456`

`apps/api/src/auth/auth.service.ts:75`

```ts
this.mockOtpStore.set(phone, '123456');
```

Anyone can sign in as **any phone number**. This is the single most dangerous
item on the list.

It activates when Twilio credentials are absent or still `replace_me`
(`hasRealCredentials`, same file, line ~45). So it is not enough to set the
Twilio variables — delete the mock path outright, or gate it on
`NODE_ENV !== 'production'` so it cannot come back if a Twilio variable is ever
unset by accident.

**Check:** `grep -rn "123456" apps/api/src/auth/`

### 2. Demo seeding endpoint — 🟢 DONE 2026-09-23 (`001a99d`)

- **Railway variable:** delete `DEMO_SEED_TOKEN` from the API service. With it
  unset every demo route 404s, so this alone closes the hole.
- **Code:** delete `apps/api/src/demo/` and its two references in
  `apps/api/src/app.module.ts` (the import and `DemoModule` in `imports`).

While the token is set, anyone who knows the path can overwrite **any** worker's
bio, skills, languages, experiences and availability, and set their profile
score to 100 / status to ACTIVE. The token in use during the beta
(`whatever-secret-you-like`) was published in a chat transcript — treat it as
public.

Also note `demo.controller.ts` returns raw database error messages, codes and
table names on failure. That is deliberate for a token-guarded debug endpoint
and unacceptable on a public one — another reason to delete the module rather
than just unset the variable.

### 3. CORS open to every origin — 🟢 FIXED 2026-09-23 (`dbb95f3`)

`apps/api/src/main.ts:22`

```ts
origin: '*',
```

Correct during beta (the mobile app has no browser origin), but before launch
restrict it to the web-admin domain and keep `credentials: false`, or move to an
explicit allowlist that still permits non-browser clients.

### 4. Stripe test keys

`apps/api/.env` — `sk_test_…` / `pk_test_…`, and the same variables in Railway.

Swap for live keys, and re-point:
- `STRIPE_SUBSCRIPTION_PRICE_ID` → the live €45 Starter price
- `STRIPE_WEBHOOK_SECRET` → the live platform endpoint
- `STRIPE_CONNECT_WEBHOOK_SECRET` → the live **Connect** endpoint

The Connect webhook is easy to forget and its absence is silent: Pay Link
payments simply never reconcile.

### 5. Public shift search leaks every company's billing record — 🟢 FIXED 2026-09-23 (`dbb95f3`)

> A second leak of the same kind was found and fixed on 2026-09-27: the
> **applicant list** (`GET /shifts/:id/applications`) returned each worker's
> full record — NIF, IBAN (ignoring their sharing consent), Stripe account id,
> declared income — to every company they applied to. Now `toApplicantWorker()`
> returns a fixed field set; `approveApplication`, `inviteWorker` and `cancel`
> go through the same mapper.

`GET /api/shifts/search` and `GET /api/shifts/:id` are public by design (Stint 2
— workers browse before signing in). Both serialize the **full `employer`
relation**, so an unauthenticated request returns, for every company:

```
stripeCustomerId, stripeSubscriptionId, stripePaymentMethodId,
subscriptionStatus, subscriptionTier, isActive, accountantEmail,
notificationPrefs, nipc, nif, lateCancellationCount, address, postalCode
```

Reproduce with no credentials at all:

```bash
curl -s "https://turnos-api-production-6c70.up.railway.app/api/shifts/search" | head -c 800
```

Confirmed live 2026-08-08 — returns `"stripeCustomerId":"cus_…"` for Carolina
Bakes.

**Accepted for beta, deliberately.** There are no real companies yet, so the
only records exposed are demo rows and one test account. This must not survive
the first paying company.

**The fix:** the worker-facing feed and shift detail need company name, sector
and `logoUrl` — nothing else. The shift's own `address`/`lat`/`lng` are
top-level on `Shift`, not on the employer. Narrow the join with an explicit
public DTO in `apps/api/src/shifts/shifts.service.ts` rather than a
`select([...])`, so that adding a column to the `Employer` entity cannot
silently re-widen the response. Then grep `relations: ['employer']` and
`leftJoinAndSelect('shift.employer'` for the same pattern elsewhere.

Decide separately whether `lateCancellationCount` should be visible to workers.
It is a company-reliability signal and might be wanted on purpose — but that
should be a decision, not a leak.

---

## 🟠 Data — test rows that must not appear to a real user

Delete in this order (children before parents), or use the demo endpoint for the
first item while it still exists.

### 6. Demo rows from the seeder — 🟢 DONE 2026-09-23 (demo worker's profile text still fiction, see item 7)

Every row it wrote has an id starting `dede`. While `DEMO_SEED_TOKEN` is still
set:

```bash
curl -X DELETE "https://turnos-api-production-6c70.up.railway.app/api/demo/seed?phone=%2B33767560422" \
  -H "x-demo-token: <token>"
```

If the module is already deleted, do it in SQL — children first, because several
reference `shifts`:

```sql
DELETE FROM ratings            WHERE id::text LIKE 'dede%';
DELETE FROM wage_payments      WHERE id::text LIKE 'dede%';
DELETE FROM payment_records    WHERE id::text LIKE 'dede%';
DELETE FROM shift_attendance   WHERE id::text LIKE 'dede%';
DELETE FROM shift_applications WHERE id::text LIKE 'dede%';
DELETE FROM shifts             WHERE id::text LIKE 'dede%';
DELETE FROM employers          WHERE id::text LIKE 'dede%';
DELETE FROM users              WHERE id::text LIKE 'dede%' AND role = 'EMPLOYER';
```

Then recompute the demo worker's reputation from the ratings that survive —
**do not zero it**, in case the account has earned real ratings by then.

> The column is `ratee_worker_id`, not `"rateeWorkerId"`. An earlier version of
> this block had the camelCase name and would have failed with 42703; the
> `@JoinColumn({ name: 'ratee_worker_id' })` on the Rating entity overrides
> TypeORM's usual default. Corrected 2026-09-23.

```sql
UPDATE workers w SET
  "avgRating"       = sub.avg,
  "totalRatings"    = sub.cnt,
  "reputationScore" = COALESCE(ROUND(sub.avg * 20), 0)
FROM (
  SELECT AVG(score)::numeric(3,2) AS avg, COUNT(*) AS cnt
    FROM ratings
   WHERE ratee_worker_id = '<worker-id>' AND direction = 'EMPLOYER_TO_WORKER'
) sub
WHERE w.id = '<worker-id>';
```

### 7. Test accounts

- **Worker** `+33767560422` (Juanes) — worker id `8b5811e0-f5b4-4e5b-b2f8-81ff1e829817`
- **Employer** `Carolina Bakes` and its 8 hand-made shifts

Both are real rows created through the app, not demo rows, so **the `dede`
cleanup above will not touch them**. Decide per account: keep as internal test
data, or delete.

⚠️ The seeder **overwrote** the Juanes profile's bio, skills, languages,
experiences and availability, and set `profileQualityScore = 100` /
`status = ACTIVE`. If that account becomes a real profile, rewrite those fields
by hand — the demo values are fiction.

---

## 🟡 Configuration — correct for beta, wrong for launch

### 8. `synchronize: true`

`apps/api/src/app.module.ts:86`

TypeORM alters the production schema from the entity files on every boot. One
careless rename drops a column and its data. Generate migrations and set this to
`false` before the first real payroll runs.

Related: `autoLoadEntities: true` was added alongside it so a feature module's
entity cannot be silently unregistered (that bug killed the whole Pay Link flow
in production — see item 12). Keep it either way; it is harmless with
migrations.

### 9. `BYPASS_SUBSCRIPTION`

`apps/api/src/payments/payments.service.ts:205` — reads the Railway variable and
skips the subscription check entirely, which also skips the overdue-wage block
below it.

Delete the variable in Railway. Keeping the code is fine (useful for staging),
but consider gating it on `NODE_ENV !== 'production'`.

### 10. Local dev artefacts

- `apps/api/.env` — never committed, but confirm it is not baked into any image
- `useStaticAssets('/uploads')` in `main.ts` serves uploads from local disk;
  production should be on Cloudflare R2 (decided, wiring incomplete)

---

## 🟢 Known debt already tracked elsewhere

Not created for the demo, but on the same "before launch" clock. Listed so this
document is the single place to look.

### 11. Unexercised critical path

`wage_payments` did not exist as a table until 2026-08-07, so **no shift has
ever completed end to end in production**. Before real workers arrive, run one
shift through publish → apply → approve → check-in → auto-complete and confirm a
`wage_payments` row appears and the Pay Link resolves. This path has never run.

### 12. From `CLAUDE.md`

- Attorney sign-off on the Pay Link structure (`docs/legal/pay-link-legal-brief.md`) — **still unsigned**; now part of the law-firm pack (section 16)
- €45 Stripe price + `STRIPE_SUBSCRIPTION_PRICE_ID` in Railway
- ~~Pre-shift consequence-reminder push~~ — removed from the policy (v1.2) until it is built
- `createGoogleEmployer` creates a `User` but no `Employer` row
- Frontend blanket 401 → logout masks real auth errors as "session expired"
- Unused deps: `@reduxjs/toolkit`, `react-redux`, `react-query`, `expo-crypto`
  (mobile); `@stripe/react-stripe-js`, `@stripe/stripe-js` (web-admin)
- Orphaned `app/dashboard/ratings/page.tsx` — built, no sidebar link
- Mobile `tsc` has pre-existing `TS2786` / `TS2339` noise (LinearGradient and
  design-token typings)

### 13. Marketing-only bits

If the home-screen shortcut for the demo video is added to the web-admin
(`apple-touch-icon`, web manifest, `apple-mobile-web-app-capable`), it is
harmless to keep — it makes the dashboard installable, which is a real feature.
Remove only if you want the dashboard to stay browser-only.

---

## 🔴 14. Email delivery — nothing is being sent today

Added 2026-09-27. **No outgoing email address has ever been connected.**
`MailService` only sends when `MAIL_HOST` and `MAIL_USER` are set; without them
every email is written to the log and dropped. That silently includes:

- the hire data sent to each company's **accountant** for the Segurança Social
  admission (`ss-direta` queue) — the company's legal duty depends on it;
- the **unpaid-wage reminders** to companies (+8h / +24h / +48h / 72h block);
- **ops alerts**: payment disputes, late-cancellation justifications, company
  cancellation reviews, no-show reviews;
- **suspension notices** to workers who gave an email (section 15);
- company **email verification** at registration and the rating reminders.

Until 2026-09-27 the ops alerts were also hard-coded to `ops@turnos.pt`, and
the app told workers to write to `suporte@turnos.pt` — a domain Turnos does not
have. Both now use **turnos.contact@gmail.com** (`SUPPORT_EMAIL` in
`@turnos/shared`; `OPS_EMAIL` env var for alerts, defaulting to it).

**To turn email on (beta — the Gmail account):**

1. In the Google account turnos.contact@gmail.com: turn on 2-Step
   Verification, then create an **App password** (Security → App passwords).
   A normal Gmail password will not work over SMTP.
2. Railway → API service → Variables:

   | Variable | Value |
   |---|---|
   | `MAIL_HOST` | `smtp.gmail.com` |
   | `MAIL_PORT` | `587` |
   | `MAIL_USER` | `turnos.contact@gmail.com` |
   | `MAIL_PASS` | the 16-character app password |
   | `MAIL_FROM` | `Turnos <turnos.contact@gmail.com>` *(optional — this is the default)* |
   | `OPS_EMAIL` | *(optional)* another inbox for internal alerts |

3. Check `GET /api/health` → `"mail": "smtp"` (it says `"log-only"` until then).
4. Register a test company with an email you can read and confirm the
   verification email arrives.

**Limits to know:** Gmail allows ~500 recipients/day and marks bulk mail from
a personal account as suspicious. Fine for the Lisbon beta. Before launch, move
to a transactional provider (Resend, Postmark, Brevo) on a domain Turnos owns
(e.g. `turnos.pt`), with SPF/DKIM set — then only the Railway variables change.

---

## 🟠 15. Legal gates — built 2026-09-27, need a test pass

Everything the new privacy policy and terms promise now exists in code. None
of it has run against production data yet.

| Promise | Where | Test it by |
|---|---|---|
| **Terms acceptance, with version + date** | `User.termsVersion` / `termsAcceptedAt`; `POST /auth/terms/accept`; `TERMS_VERSIONS` in shared. Companies tick a box at registration (API refuses without it); workers get `app/terms.tsx` after sign-in; existing companies get a blocking modal (`TermsGate`) in the dashboard | Sign in on the new APK → terms screen appears once, never again. Open the dashboard with an existing company → modal once |
| **Statement of reasons on every restriction** | `users/restriction-notice.ts`; written to `Worker.restrictionReason`; push + email; red banner with "Porquê?" / "Pedir revisão" on the mobile profile | Report a no-show on a test shift → worker gets the push, profile shows the reason |
| **Retention: payment proofs 24 months, cancellation notes 6 months** | `payments/retention.service.ts`, nightly 03:30 UTC on the `wage-reminders` queue | Nothing to see until 2028 — check the log line `[Retention] Nightly purge registered` after deploy |
| **Worker justifications deleted after 6 months** | *Not in the database* — they only arrive by email to the ops inbox | **Manual, monthly:** in turnos.contact@gmail.com, search `subject:"Justificação de cancelamento tardio" older_than:6m` and delete, together with any attachments workers sent |
| **18+** | `Worker.dateOfBirth`; checked on apply, accept and invite | Onboard with a birth date 17 years ago → refused |

**Changing the terms later:** edit `apps/web-admin/app/termos*/content.ts` and
the review copies in `docs/legal/`, then bump the date in `TERMS_VERSIONS`.
Every user whose recorded version differs is asked to accept again — that is
the whole mechanism, so never bump it for a typo.

**Still placeholders on the public pages** (`/privacidade`, `/termos`,
`/termos-empresas`): `[[RAZÃO SOCIAL]]`, `[[NIPC]]`, `[[MORADA]]` — fill once
the company is registered — and `[[REGIÃO DE ALOJAMENTO]]` (Railway → project
→ Settings → region). The contact email is filled.

---

## 16. The law-firm pack

`docs/legal/pack-advogados/` — Word versions of everything the firm needs,
brief first (`00 - Nota para os advogados.docx`), then 01–05. The Markdown
files in `docs/legal/` and `docs/policies/`, and the privacy page's
`content.ts`, are the sources — never edit the .docx. Regenerate after any
change:

```bash
cd scripts/legal-pack && npm install && npm run build
```

---

## Quick verification before launch

```bash
grep -rn "123456"              apps/api/src/auth/     # must return nothing
grep -rn "BYPASS_SUBSCRIPTION" apps/api/src/          # decide: gate or delete
grep -n  "origin:"             apps/api/src/main.ts   # must not be '*'
grep -n  "synchronize"         apps/api/src/app.module.ts
ls apps/api/src/demo/                                 # must not exist

# item 5 — must return nothing (no billing fields on the public endpoint)
curl -s "$API/api/shifts/search" | grep -o "stripeCustomerId\|accountantEmail"

# item 14 — must say "smtp"
curl -s "$API/api/health" | grep -o '"mail":"[a-z-]*"'

# item 15 — no placeholder left on the public legal pages
grep -rn "\[\[" apps/web-admin/app/privacidade apps/web-admin/app/termos apps/web-admin/app/termos-empresas
```

Railway variables that must be **set** for email: `MAIL_HOST`, `MAIL_PORT`,
`MAIL_USER`, `MAIL_PASS` (section 14).
Railway variables that must be **gone**: `DEMO_SEED_TOKEN`, `BYPASS_SUBSCRIPTION`.
Railway variables that must be **live-mode**: `STRIPE_SECRET_KEY`,
`STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_SUBSCRIPTION_PRICE_ID`, and the Twilio
credentials (without which the OTP mock reactivates).

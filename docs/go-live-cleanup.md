# Go-live cleanup checklist

Everything that exists only for beta, demos or local development and must be
removed, rotated or hardened before real workers and paying companies arrive.

Written 2026-08-07, after seeding demo data for the walkthrough video. Verified
against the code at that date — re-check each grep before acting, since some of
these are load-bearing until the day they aren't.

Ordered by **what happens if you forget it**, worst first.

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

### 2. Demo seeding endpoint

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

### 3. CORS open to every origin

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

---

## 🟠 Data — test rows that must not appear to a real user

Delete in this order (children before parents), or use the demo endpoint for the
first item while it still exists.

### 5. Demo rows from the seeder

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
**do not zero it**, in case the account has earned real ratings by then:

```sql
UPDATE workers w SET
  "avgRating"       = sub.avg,
  "totalRatings"    = sub.cnt,
  "reputationScore" = COALESCE(ROUND(sub.avg * 20), 0)
FROM (
  SELECT AVG(score)::numeric(3,2) AS avg, COUNT(*) AS cnt
    FROM ratings
   WHERE "rateeWorkerId" = '<worker-id>' AND direction = 'EMPLOYER_TO_WORKER'
) sub
WHERE w.id = '<worker-id>';
```

### 6. Test accounts

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

### 7. `synchronize: true`

`apps/api/src/app.module.ts:86`

TypeORM alters the production schema from the entity files on every boot. One
careless rename drops a column and its data. Generate migrations and set this to
`false` before the first real payroll runs.

Related: `autoLoadEntities: true` was added alongside it so a feature module's
entity cannot be silently unregistered (that bug killed the whole Pay Link flow
in production — see item 11). Keep it either way; it is harmless with
migrations.

### 8. `BYPASS_SUBSCRIPTION`

`apps/api/src/payments/payments.service.ts:205` — reads the Railway variable and
skips the subscription check entirely, which also skips the overdue-wage block
below it.

Delete the variable in Railway. Keeping the code is fine (useful for staging),
but consider gating it on `NODE_ENV !== 'production'`.

### 9. Local dev artefacts

- `apps/api/.env` — never committed, but confirm it is not baked into any image
- `useStaticAssets('/uploads')` in `main.ts` serves uploads from local disk;
  production should be on Cloudflare R2 (decided, wiring incomplete)

---

## 🟢 Known debt already tracked elsewhere

Not created for the demo, but on the same "before launch" clock. Listed so this
document is the single place to look.

### 10. Unexercised critical path

`wage_payments` did not exist as a table until 2026-08-07, so **no shift has
ever completed end to end in production**. Before real workers arrive, run one
shift through publish → apply → approve → check-in → auto-complete and confirm a
`wage_payments` row appears and the Pay Link resolves. This path has never run.

### 11. From `CLAUDE.md`

- Attorney sign-off on the Pay Link structure (`docs/legal/pay-link-legal-brief.md`) — **still unsigned**
- €45 Stripe price + `STRIPE_SUBSCRIPTION_PRICE_ID` in Railway
- Pre-shift consequence-reminder push — policy states it, not scheduled in code
- `createGoogleEmployer` creates a `User` but no `Employer` row
- Frontend blanket 401 → logout masks real auth errors as "session expired"
- Unused deps: `@reduxjs/toolkit`, `react-redux`, `react-query`, `expo-crypto`
  (mobile); `@stripe/react-stripe-js`, `@stripe/stripe-js` (web-admin)
- Orphaned `app/dashboard/ratings/page.tsx` — built, no sidebar link
- Mobile `tsc` has pre-existing `TS2786` / `TS2339` noise (LinearGradient and
  design-token typings)

### 12. Marketing-only bits

If the home-screen shortcut for the demo video is added to the web-admin
(`apple-touch-icon`, web manifest, `apple-mobile-web-app-capable`), it is
harmless to keep — it makes the dashboard installable, which is a real feature.
Remove only if you want the dashboard to stay browser-only.

---

## Quick verification before launch

```bash
grep -rn "123456"              apps/api/src/auth/     # must return nothing
grep -rn "BYPASS_SUBSCRIPTION" apps/api/src/          # decide: gate or delete
grep -n  "origin:"             apps/api/src/main.ts   # must not be '*'
grep -n  "synchronize"         apps/api/src/app.module.ts
ls apps/api/src/demo/                                 # must not exist
```

Railway variables that must be **gone**: `DEMO_SEED_TOKEN`, `BYPASS_SUBSCRIPTION`.
Railway variables that must be **live-mode**: `STRIPE_SECRET_KEY`,
`STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_SUBSCRIPTION_PRICE_ID`, and the Twilio
credentials (without which the OTP mock reactivates).

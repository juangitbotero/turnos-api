# Go-live runbook

**How** to do each launch item — commands, SQL, Railway variables, account
setup. **Whether** an item is done is tracked only in `docs/pre-flight.md`;
this file deliberately carries no status, so the two cannot disagree. Each
section names the pre-flight row it serves.

Reorganised 2026-10-05 from the original cleanup checklist (2026-08-07).
Procedures for items already closed — demo endpoint and rows, CORS, public
endpoint leak — were removed; their history is in `pre-flight.md`.

> Lesson from 2026-09-23: a procedure nobody has executed end to end is not a
> procedure. Both documented routes for the demo cleanup were broken (wrong
> operator on `uuid`, wrong column name) and only running them found it. When
> you run one of these, fix it here in the same commit.

---

## 1. Twilio Verify — closes the mock OTP · *pre-flight Track 1 #1*

The code uses **Twilio Verify**, not plain SMS. Verify cannot be created on a
trial account; the account must be upgraded (payment + tax details).

1. Upgrade the Twilio account — under the company's NIPC, not a personal NIF.
2. Explore Products → **Verify → Services → Create**, name `Turnos`, channel
   SMS. Copy the Service SID (`VA…`).
3. Verify → Settings → **Geo permissions**: enable Portugal (and France while
   the `+33` test number is in use).
4. Railway → API service → Variables:

   | Variable | Value |
   |---|---|
   | `TWILIO_ACCOUNT_SID` | `AC…` from the console dashboard |
   | `TWILIO_AUTH_TOKEN` | from the console dashboard |
   | `TWILIO_VERIFY_SERVICE_SID` | `VA…` from step 2 |

5. Sign in on the APK with a real number — the SMS must arrive.
6. **Only then** merge branch `otp-prod-gate`. It disables the mock in
   production and fails closed (503) if any Twilio variable is missing. Merged
   before step 5, it locks everyone out.

**Check:** `grep -rn "123456" apps/api/src/auth/` still finds the mock (dev
only, by design) — what matters is the `NODE_ENV !== 'production'` gate.

## 2. Stripe live mode · *pre-flight Track 1 #5*

Swap `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` for live keys, and re-point:

- `STRIPE_SUBSCRIPTION_PRICE_ID` → the live €45 Starter price
- `STRIPE_WEBHOOK_SECRET` → the live platform endpoint
- `STRIPE_CONNECT_WEBHOOK_SECRET` → the live **Connect** endpoint

The Connect webhook is the one that gets forgotten and its absence is silent:
Pay Link payments simply never reconcile.

## 3. Email via an HTTPS API · *pre-flight Track 1 #7*

Railway blocks outbound SMTP below the Pro plan, so Gmail SMTP cannot work
from the API (tried 2026-10-05: connection timeout, `"mail":"smtp-error"`).
Email goes through **Brevo**'s HTTP API instead.

1. Create a free account at brevo.com.
2. Senders & IPs → add and verify **turnos.contact@gmail.com** as a sender.
3. SMTP & API → **API Keys** → generate one.
4. Railway → API service → Variables: `BREVO_API_KEY` = the key.
   `MAIL_FROM` (optional) defaults to `Turnos <turnos.contact@gmail.com>`;
   `OPS_EMAIL` (optional) sends internal alerts to another inbox.
5. `GET /api/health` → `"mail"` must read the API mode, not `log-only` or
   `smtp-error`.
6. Register a test company with an inbox you can read; the verification email
   must arrive and its link must open.

Sending *from* a gmail.com address through a third party can land in spam.
Before launch, buy a domain (e.g. `turnos.pt`), authenticate it in Brevo
(SPF/DKIM) and change `MAIL_FROM` — no code change.

The `MAIL_HOST` / `MAIL_USER` / `MAIL_PASS` variables set for Gmail are unused
while SMTP is blocked; delete them or leave them, they do no harm.

## 4. Test accounts · *pre-flight Track 3, "Test accounts"*

- **Worker** `+33767560422` (Juanes) — id `8b5811e0-f5b4-4e5b-b2f8-81ff1e829817`
- **Employer** Carolina Bakes and its hand-made shifts

Real rows created through the app, not demo rows. If the worker account stays,
rewrite its bio, skills, languages and experiences in the app — the seeder's
values are fiction. Its reputation was recomputed correctly (0 ratings).

If ratings ever need recomputing by hand — the column is `ratee_worker_id`,
not `"rateeWorkerId"` (the `@JoinColumn` overrides TypeORM's default):

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

## 5. `synchronize: true` → migrations · *pre-flight Track 3*

`apps/api/src/app.module.ts:85`. TypeORM alters the production schema from the
entity files on every boot; one careless rename drops a column and its data.
Generate a baseline migration from the current production schema, then set
`synchronize: false` before the first real payroll. Keep
`autoLoadEntities: true` — it prevents the silently-unregistered-entity bug
that once killed the whole Pay Link flow.

## 6. `BYPASS_SUBSCRIPTION` · *pre-flight Track 3*

`apps/api/src/payments/payments.service.ts:205` skips the subscription check
and, with it, the overdue-wage block. Delete the Railway variable. The code
can stay for staging, ideally gated on `NODE_ENV !== 'production'`.

## 7. First end-to-end shift in production · *pre-flight Track 3*

Never run once. Publish (web-admin) → apply (APK) → approve → accept →
check-in (QR scan) → auto-complete at the scheduled end → `wage_payments` row
→ Pay Link resolves → reminder ladder → reviews. Use a shift that ends a few
minutes after check-in so auto-completion is observable.

Railway → Postgres → Data → Query accepts `SELECT` only (it appends a
`LIMIT`); wrap DML as `WITH d AS (DELETE … RETURNING id) SELECT count(*) FROM d;`.
Postgres → Console is bash: run `psql $DATABASE_URL` first.

## 8. Legal gates — test pass · *pre-flight Track 3*

| Promise | Where | Test it by |
|---|---|---|
| Terms acceptance with version + date | `User.termsVersion` / `termsAcceptedAt`; `POST /auth/terms/accept`; `TERMS_VERSIONS` in shared | Sign in on the new APK → terms screen once, never again. Open the dashboard with an existing company → modal once |
| Statement of reasons on every restriction | `users/restriction-notice.ts` → `Worker.restrictionReason`; push + email; red banner on the profile | Report a no-show on a test shift → push arrives, profile shows the reason |
| Retention: proofs 24 months, cancellation notes 6 months | `payments/retention.service.ts`, nightly 03:30 UTC on `wage-reminders` | Log line `[Retention] Nightly purge registered` after deploy |
| 18+ | `Worker.dateOfBirth`; checked on apply, accept, invite | Birth date 17 years ago → refused |

**Manual, monthly:** worker late-cancel justifications exist only in the ops
inbox. In turnos.contact@gmail.com search
`subject:"Justificação de cancelamento tardio" older_than:6m` and delete,
attachments included.

**Changing the terms later:** edit `apps/web-admin/app/termos*/content.ts` and
the review copies in `docs/legal/`, then bump the date in `TERMS_VERSIONS`.
Everyone whose recorded version differs is asked to accept again — never bump
it for a typo.

**Stored accountant emails (removed feature, 2026-10-05).** Nothing collects
or reads them any more; delete what is stored (data minimisation). Railway →
Postgres → Data → Query:

```sql
WITH a AS (UPDATE employers SET "accountantEmail" = NULL WHERE "accountantEmail" IS NOT NULL RETURNING id),
     b AS (UPDATE mcd_contracts SET "ssAccountantEmail" = NULL WHERE "ssAccountantEmail" IS NOT NULL RETURNING id)
SELECT (SELECT count(*) FROM a) AS employers, (SELECT count(*) FROM b) AS contracts;
```

Check the table and column names against the database first — this has not
been run yet.

**Placeholders on `/privacidade`, `/termos`, `/termos-empresas`:**
`[[RAZÃO SOCIAL]]`, `[[NIPC]]`, `[[MORADA]]` once the company is registered;
`[[REGIÃO DE ALOJAMENTO]]` from Railway → project → Settings → region.

## 9. The law-firm pack

`docs/legal/pack-advogados/` — Word versions for the firm, brief first
(`00 - Nota para os advogados.docx`). The Markdown in `docs/legal/` and
`docs/policies/` and the privacy page's `content.ts` are the sources — never
edit the .docx. Regenerate after any change:

```bash
cd scripts/legal-pack && npm install && npm run build
```

---

## Quick verification before launch

```bash
API=https://turnos-api-production-6c70.up.railway.app

# which build is serving, and is email really working ("mail" must not be log-only / smtp-error)
curl -s "$API/api/health"

# no billing fields on the public feed — must print nothing
curl -s "$API/api/shifts/search" | grep -o "stripeCustomerId\|accountantEmail"

# rate limiting — a burst of 70 must include 429s
seq 1 70 | xargs -P 20 -I{} curl -s -o /dev/null -w "%{http_code}\n" "$API/api/health" | sort | uniq -c

grep -n  "origin:"             apps/api/src/main.ts        # must not be '*'
grep -n  "synchronize"         apps/api/src/app.module.ts  # must be false
grep -rn "BYPASS_SUBSCRIPTION" apps/api/src/               # gated or deleted
grep -rn "\[\[" apps/web-admin/app/privacidade apps/web-admin/app/termos apps/web-admin/app/termos-empresas  # must print nothing
```

Railway variables that must be **set**: `BREVO_API_KEY`, the three `TWILIO_*`.
Must be **gone**: `DEMO_SEED_TOKEN`, `BYPASS_SUBSCRIPTION`.
Must be **live-mode**: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`,
`STRIPE_SUBSCRIPTION_PRICE_ID`.

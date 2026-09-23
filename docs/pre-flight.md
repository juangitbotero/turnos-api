# Pre-flight — what stands between Turnos and the stores

**Status reference for launch.** Replaces `turnos_roadmap.md`, which was deleted
on 2026-09-09: it was last updated 2026-06-04 and still described the pre-pivot
product (worker paying 10%, T+1 "Recebe amanhã" payouts, a check-out scan,
€55/month) — all four retired by ADR 007 and ADR 008. A stale roadmap that
contradicts the product is worse than no roadmap.

For what has been **built**, read `CLAUDE.md`. For the detail behind Track 1,
including the SQL for demo-row cleanup, read `docs/go-live-cleanup.md`. This
file is the index.

Everything here was re-verified against the code and against the live Railway
API on **2026-09-23**. Re-check before acting — some of these are load-bearing
until the day they aren't.

---

## Track 1 — Launch blockers

Five found on 2026-09-09; **three closed on 2026-09-23**. A sixth was found on
2026-09-13 and is still open. Ordered by what happens if you forget.

> Which build is serving is now answerable directly: `GET /api/health` returns
> the short commit sha. Added after an afternoon where a failed Railway build
> (its builder ran out of disk) left the previous image running, a redeploy
> brought that same old image back, and the only way to tell which code was live
> was which bug reproduced.

| # | Blocker | Where | State |
|---|---|---|---|
| 1 | Mock OTP `123456` accepts any phone number | `apps/api/src/auth/auth.service.ts:76` | 🔴 Live |
| 2 | Public endpoints leaked billing + worker PII | `GET /api/shifts/search`, `/shifts/:id` | 🟢 **Fixed `dbb95f3`** |
| 3 | Demo seeding endpoint deployed | `apps/api/src/demo/` + `DEMO_SEED_TOKEN` | 🟢 **Done `001a99d`** — code deleted, rows cleaned, variable unset |
| 4 | CORS open to every origin | `apps/api/src/main.ts` | 🟢 **Fixed `dbb95f3`** |
| 5 | Stripe still in test mode | Railway variables | 🔴 Live |
| 6 | **Rate limiting does not enforce** | `app.module.ts:45` ThrottlerModule | 🔴 Live — verified 2026-09-23 |

**1 — Mock OTP.** Activates whenever Twilio credentials are absent or still
`replace_me`. Setting the Twilio variables is *not* sufficient — if one is ever
unset by accident the bypass returns.

⚠️ **Do not remove the mock until Twilio is actually signed up.** With no Twilio
credentials it is the *only* way anyone can sign in — deleting it first locks
out you, every tester and any demo in progress. That is why this blocker is
still open on purpose, not by neglect.

Gating it on `NODE_ENV !== 'production'` is now safe. It was not until
2026-09-23: the Railway variable held the literal string `"=production"`, stray
`=` included, so every `NODE_ENV === 'production'` comparison in the codebase
was false and a gate written that way would have looked fixed while leaving the
bypass live. **Fixed and verified** — `GET /api/health` now returns
`"environment":"production"`. Check it again before relying on it.

Note that fixing it turned on Postgres SSL for the first time
(`app.module.ts:72` keys `ssl` off the same comparison). Verified working after
the change.

**2 — Billing leak. FIXED 2026-09-23 (`dbb95f3`).** Both public endpoints now go
through `toPublicShift()` in `shifts.service.ts`, which maps the four employer
fields a worker needs — id, companyName, sector, logoUrl — one by one, so adding
a column to `Employer` cannot silently re-widen the response.

Found while fixing it, and worse than what was recorded: `findById` also joined
`assignedWorker`, whose entity carries the worker's **NIF, IBAN and
stripeAccountId**. The id of a FILLED shift was enough to read them. Earlier
checks missed it because `search()` only returns OPEN shifts, which have no
worker assigned. Both that relation and `applications` are now stripped.

Verified against production after deploy: the employer object is exactly those
four keys, `assignedWorker` and `applications` are absent, and no
`stripeCustomerId` / `accountantEmail` / `nipc` / `nif` / `iban` appears anywhere
in the feed.

**3 — Demo endpoint. DONE 2026-09-23.**

Production rows removed via the endpoint: 34 shifts, 27 applications, 22 each of
ratings / wage_payments / payment_records / attendance, 5 employers and their 5
user rows. Verified by re-running it — second pass removed zero of everything —
and the real data is untouched (Carolina Bakes, 3 open shifts, no `dede` rows).
`apps/api/src/demo/` and its two `app.module.ts` references are deleted, and
`DEMO_SEED_TOKEN` is unset in Railway. Confirmed after deploy: `/demo/seed`
returns 404 **even with a valid token** — the route is gone, not merely gated.

⚠️ **The demo worker's profile is still fiction.** The seeder overwrote
`+33767560422`'s bio, skills, languages and experiences; no cleanup path touches
those. Reputation numbers were recomputed correctly (0 ratings remain). Rewrite
the profile in the app or re-onboard the account.

**Two bugs found doing this, both now fixed.** `reset()` had never once run to
completion: it built its predicate with `Like()` against `uuid` columns
(Postgres has no `uuid ~~ text` operator, 42883), and its reputation recompute
asked for `"rateeWorkerId"` when the column is `ratee_worker_id` (42703). The
SQL fallback in `go-live-cleanup.md` carried the same wrong column name, so
**both documented routes for this cleanup were broken**. Worth remembering: a
cleanup procedure nobody has executed end to end is not a procedure.

**4 — CORS. FIXED 2026-09-23 (`dbb95f3`).** `origin: '*'` replaced with an
allowlist in `apps/api/src/cors.ts`, shared by the HTTP layer and the WebSocket
gateway. Requests with **no Origin header are still allowed** — React Native's
fetch sends none and neither do Stripe's webhooks; CORS protects a browser
session, it is not what authenticates those callers.

The gateway had been reading `NODE_ENV === 'production' ? false : '*'`. With
`NODE_ENV` malformed at the time (see item 1) that resolved to `'*'`, so the
socket layer was open too. It no longer depends on that variable at all, which
is deliberate — the allowlist should not silently widen because an environment
variable is wrong.

Verified against production: the dashboard origin is echoed back, a hostile
origin and a lookalike suffix (`…railway.app.evil.com`) get no
`Access-Control-Allow-Origin` header at all, and an origin-less request still
returns 200.

**5 — Stripe test keys.** Live keys, plus three re-pointed variables:
`STRIPE_SUBSCRIPTION_PRICE_ID` → the live €45 Starter price,
`STRIPE_WEBHOOK_SECRET`, and `STRIPE_CONNECT_WEBHOOK_SECRET`. The **Connect**
webhook is the one that gets forgotten and its absence is silent — Pay Link
payments simply never reconcile.

**6 — Rate limiting does not enforce. Found 2026-09-13, re-verified 2026-09-23.**

`ThrottlerModule` is configured at 60 req/min and `ThrottlerGuard` is registered
globally as an `APP_GUARD`, but it does not limit anything. Measured twice
against production: 195 requests, then 90 more in parallel — **zero 429s**. The
requests reach the app (timestamps differ by ~250ms, nothing is cached).

The stake is not `/health`. `POST /auth/send-otp` carries
`@Throttle({ limit: 5 })` and **every per-route limit rides on the same broken
guard** — so once Twilio is live, OTP sending is unmetered. That is a direct
SMS-cost and abuse channel, and employer login brute-forcing is equally
unlimited. *(The OTP endpoint was deliberately not load-tested — it would send
real SMS and cost money.)*

Leading hypothesis, unconfirmed: Express sits behind Railway's edge proxy with
`trust proxy` never set, so `req.ip` — the throttler's default key — is the same
value for every caller. That should make the limit *stricter*, not absent, so
the hypothesis is incomplete. Reproduce locally before fixing.

**Fix this before Twilio, not after.**

---

## Track 2 — App Store & Play Store

No document in the repo covered this before 2026-09-09. Derived from
`apps/mobile/app.json` and the surrounding code.

### Hard blockers — both built 2026-09-09, both need one more step

| Blocker | State |
|---|---|
| Privacy policy | 🟠 Built at `/privacidade` (PT + EN). **Draft — not lawyer-reviewed, and the controller identity is still `[[PLACEHOLDER]]`** |
| In-app account deletion | 🟢 Built. Profile → Eliminar a minha conta → `/delete-account` |

**Privacy policy** — `apps/web-admin/app/privacidade/`. Text lives in
`content.ts` beside the route, not in the shared catalogue: a legal document is
reviewed whole by a lawyer, and 100+ catalogue keys would obstruct that.

Before this URL goes into a store listing:

1. Fill `[[RAZÃO SOCIAL]]`, `[[NIPC]]`, `[[MORADA]]`, `[[EMAIL DE CONTACTO]]`
   in `content.ts` — they render literally on the page today.
2. Have a lawyer read it. Two statements in it are load-bearing and must not be
   softened by a later edit: **Turnos never holds wage money** (ADR 007), and
   **an IBAN is disclosed only under recorded, withdrawable consent**.

**Account deletion** — Apple 5.1.1(v). It **anonymises rather than dropping the
row**, because MCD contracts, the append-only ACT audit trail, ratings and
`wage_payments` all reference the worker and are legally retained (GDPR Art.
17(3)(b)). `UsersService.deleteWorkerAccount()` clears every identifying field;
what survives is a worker id attached to shift history with no name, contacts,
NIF, IBAN or documents. `WorkerStatus` gained a terminal `DELETED`.

Two guards refuse deletion, both for the worker's benefit: a confirmed shift
cannot be abandoned, and an unpaid wage must land first — anonymising sooner
would destroy the worker's own evidence of what they are owed.

Still to do around it: the deletion path has not been exercised against a real
account, and `Worker.deletedAt` plus the new enum value reach production through
`synchronize: true`.

### Configuration fixes

| Item | Detail |
|---|---|
| `RECORD_AUDIO` permission | Requested in `app.json`; nothing records audio. An `expo-camera` default. Both stores make you justify microphone access |
| Location asks for "Always" | Only needed during the QR scan geofence. Apple scrutinises background location hard |
| Permission strings mixed PT/EN | Photos and calendar PT, location EN. Shown to the user in the system dialog |
| `version: "0.0.1"` | Ship as `1.0.0`; set `ios.buildNumber` or let EAS auto-increment |
| Off-brand colours | Splash/adaptive `#0F172A`, notification `#6366F1`. Brand is `#6a79ff` on `#fafdff` |

### Account lead times — start before any code

- **Apple Developer Program** — $99/year. A company account needs a **D-U-N-S
  number**, which can take weeks to obtain and verify. Nothing on the iOS side
  starts until this is done.
- **Google Play** — $25 once. An **individual** account must run a closed test
  with **12 testers for 14 continuous days** before production. An organisation
  account does not. Decide the account type deliberately — that is a two-week
  floor you cannot compress.

### Not a problem, contrary to the old roadmap

The old roadmap listed "App Store rejection (payment flow)" as a medium risk.
Since the pivot **the worker app takes no payments at all** — workers pay
nothing, subscriptions are company-side on the web, and a wage reaching a worker
is a real-world service Apple exempts from IAP. `ITSAppUsesNonExemptEncryption:
false` is already set, which also clears export compliance.

---

## Track 3 — Product and infrastructure

| Item | Detail |
|---|---|
| **No shift has ever completed in production** | `wage_payments` did not exist as a table until 2026-08-07. Publish → apply → approve → check-in → auto-complete → wage row → Pay Link has never run once. Highest-value thing to do; costs an afternoon |
| `synchronize: true` | `app.module.ts:86` rewrites the production schema from entities on every boot. Generate migrations before the first real payroll. Keep `autoLoadEntities` — it prevents the silently-unregistered-entity bug that killed the Pay Link flow once |
| `BYPASS_SUBSCRIPTION` | `payments.service.ts:205` returns early, which also skips the overdue-wage block. Delete the Railway variable |
| Uploads on local disk | R2 is decided, wiring incomplete. `useStaticAssets('/uploads')` serves photos, CVs and payment proofs from a container filesystem that does not survive a Railway redeploy |
| Dashboard unusable on a phone | 0 media queries, 843 inline style objects across 11 pages, a 240px sidebar duplicated in each, and an overlay telling sub-768px visitors to use a desktop. Cheapest large win: hoist the sidebar into a real `DashboardShell` |
| Smaller defects | `createGoogleEmployer` creates a `User` but no `Employer` row · blanket 401 → logout masks real auth errors · `/dashboard/ratings` built but unlinked · pre-shift consequence reminder is policy but not scheduled in code |

### Capacity — measured 2026-09-13

Registered users cost nothing; concurrent active ones do. For a Lisbon beta the
API is not the constraint. What *is*, and all three are architectural rather
than plan size:

| Constraint | Where | Effect |
|---|---|---|
| Single Node process | `Dockerfile` → `CMD node dist/.../main.js` | No clustering. One CPU core of JavaScript however many vCPU the plan gives |
| In-memory Socket.IO | `main.ts` → `new IoAdapter(app)` | **A second replica cannot be run.** A worker on instance A never receives an event emitted on instance B. Needs a Redis adapter before scaling out |
| DB pool not configured | `app.module.ts` | Defaults to 10 connections — the real ceiling on concurrent query work |

Rough arithmetic, wide error bars: ~150–400 req/s sustained, so order-of-1,000
simultaneously active users. Load-test before trusting that. Web-admin is not a
bottleneck — every route builds as `○ (Static)`, so it is a prerendered bundle
and all real load lands on the API.

**Storage.** Photos and CVs go to the container filesystem, not R2 (see the
uploads row above). Budget ~1 MB per worker — photo is a 1:1 crop at quality
0.8 with no server-side resize, CV is 200 KB–1 MB — so 10,000 workers ≈ 10 GB.
**Payment proofs are the sneaky one**: they scale with transaction volume, not
user count, and nothing deletes them. On R2 that is free-tier or pennies; the
cost is not the problem, the wiring is.

### Railway operational notes

Learned the hard way on 2026-09-23; all cost real time.

- **A failed build leaves the previous image serving**, and *Redeploy* on a
  failed deployment brings that same old image back rather than building HEAD.
  From outside the two are indistinguishable. `GET /api/health` now returns the
  running commit sha — check it before concluding a fix did or did not work.
- **The builder runs out of disk.** A build failed with
  `ResourceExhausted … no space left on device` in buildkit. Retrying on a
  different builder worked. Likelier to recur while the Dockerfile ships the
  full `python3 make g++` toolchain *and* every dev dependency into the final
  image and never prunes — a multi-stage build would cut it substantially.
- **Postgres → Data → Query appends a `LIMIT`**, so it accepts `SELECT` only.
  Wrap DML to use it: `WITH d AS (DELETE … RETURNING id) SELECT count(*) FROM d;`
- **Postgres → Console is a bash shell**, not psql. Run `psql $DATABASE_URL`
  inside it first.

---

## Track 4 — Closed by decision

Not gaps. These should not reappear on a "what's missing" list.

- **Attorney sign-off** on `docs/legal/pay-link-legal-brief.md` — parked
  deliberately. It keeps the two 🔵 answers in `docs/faq-turnos.md` held back,
  which is the intended state.
- **Team members / multi-user companies** — not being built. One login per
  company is the product. `Employer` has a `@OneToOne` to `User` and every
  profile lookup resolves a company from that single user; reopening it is a
  structural change, not a feature.

---

*Store requirements change — re-read Apple's and Google's current published
guidelines before submitting.*

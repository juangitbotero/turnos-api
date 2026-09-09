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
API on **2026-09-09**. Re-check before acting — some of these are load-bearing
until the day they aren't.

---

## Track 1 — Launch blockers

Five, all confirmed live on 2026-09-09. Ordered by what happens if you forget.

| # | Blocker | Where | State |
|---|---|---|---|
| 1 | Mock OTP `123456` accepts any phone number | `apps/api/src/auth/auth.service.ts:76` | 🔴 Live |
| 2 | Public shift search leaks every company's billing record | `GET /api/shifts/search` | 🔴 **Leaking in production** |
| 3 | Demo seeding endpoint deployed | `apps/api/src/demo/` + `DEMO_SEED_TOKEN` | 🔴 Live |
| 4 | CORS open to every origin | `apps/api/src/main.ts:22` | 🔴 Live |
| 5 | Stripe still in test mode | Railway variables | 🔴 Live |

**1 — Mock OTP.** Activates whenever Twilio credentials are absent or still
`replace_me`. Setting the Twilio variables is *not* sufficient — if one is ever
unset by accident the bypass returns. Delete the path or gate it on
`NODE_ENV !== 'production'`.

**2 — Billing leak.** The endpoint is public by design (workers browse before
signing in) but serialises the whole `employer` relation. An unauthenticated
request on 2026-09-09 returned `stripeCustomerId`, `accountantEmail`,
`subscriptionTier` and `nipc`. Accepted for beta because only demo rows and one
test company exist — but ads for workers are already running.

Fix with an explicit public DTO in `shifts.service.ts` returning company name,
sector and `logoUrl` only. Not a `select([...])`: adding a column to `Employer`
must not be able to silently re-widen the response. Then grep
`relations: ['employer']` and `leftJoinAndSelect('shift.employer'` for the same
pattern elsewhere.

**3 — Demo endpoint.** While `DEMO_SEED_TOKEN` is set, anyone who knows the path
can overwrite any worker's profile and set their score to 100 / status ACTIVE.
The beta token was published in a chat transcript — treat it as public. Deleting
the Railway variable alone 404s every demo route.

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
| Smaller defects | `createGoogleEmployer` creates a `User` but no `Employer` row · blanket 401 → logout masks real auth errors · demo rows (ids starting `dede`) still in production · `/dashboard/ratings` built but unlinked · pre-shift consequence reminder is policy but not scheduled in code |

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

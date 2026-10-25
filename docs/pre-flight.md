# Pre-flight — what stands between Turnos and the stores

**Status reference for launch.** Replaces `turnos_roadmap.md`, which was deleted
on 2026-09-09: it was last updated 2026-06-04 and still described the pre-pivot
product (worker paying 10%, T+1 "Recebe amanhã" payouts, a check-out scan,
€55/month) — all four retired by ADR 007 and ADR 008. A stale roadmap that
contradicts the product is worse than no roadmap.

> **This is the only place that tracks launch status.** If an item is open,
> it is here; if it is not here, it is not tracked.
> - `docs/go-live-cleanup.md` is the **runbook** — *how* to do each item (SQL,
>   Railway variables, account setup). It carries no status of its own.
> - `CLAUDE.md` records what has been **built**.
>
> Rule for every session: when work opens or closes a launch item, update its
> row here **in the same commit** as the change.

Last full reconciliation with the runbook and the live API: **2026-10-05**
(this file updated through the 2026-10-11 session).
Re-check before acting — some of these are load-bearing until the day they
aren't.

## Next session — start here

1. **Test on a device with APK `versionCode` 12** (EAS `9af718d1`): "✓ Recebi /
   🚩 Não recebi" buttons on a completed shift; a push to a worker on an
   English phone arrives in English without touching the language switch;
   plus the `versionCode` 11 checks still open (26 Sept application in
   History as Caducado, onboarding without the income question).
2. **Test the dashboard on production:** Shifts page in the neutral style;
   Reviews tab shows "Avaliar (n)" only for unreviewed jobs.
3. Pick from what is left and needs no external account: make
   `DashboardShell` collapse on phones, R2 uploads (needs a Cloudflare key),
   app version `1.0.0`, smaller defects, move the other dashboard pages to
   `lib/ui.ts` (Track 3). Wanted improvements that are not blockers: Track 5.

**Blocked on outside events, not on code:** Twilio (#1), live Stripe (#5),
Apple + Google accounts, an owned email domain and the privacy-page
placeholders all wait for the company's registration (the law firm is on
it); the Pay Link end-to-end run waits for Stripe. The legal pack was
**regenerated 2026-10-11** with Juanes's trims and is ready to send
(`docs/legal/pack-advogados/`).

## Session log — 2026-10-11 (afternoon)

**Legal:** Juanes's edits applied to the pack sources (his copies of three
files were the 27/09 version — re-applied, not copied, so the accountant email
and Annex A stay out); privacy policy covers the notifications inbox; pack
rebuilt. **App (APK 12):** visible Recebi / Não recebi buttons; worker language
synced at sign-in and launch. **API:** ops emails rebuilt on one template with
reference, contacts, proof link and next steps (+ 72h unpaid alert, no-show
alert on every no-show). **Security — undefined-id audit found two live bugs,
fixed and verified on production:** an empty OTP request signed in as the
first user while the mock is live; every socket client joined the first
company's room. **Schema:** `synchronize` off, migrations at boot (baseline
verified locally and deployed). **Dashboard:** neutral UI kit on Shifts +
Reviews; Reviews/no-show modals listed every shift of the company — now only
that worker's, and the server refuses a no-show on a shift that hasn't
started. **Decided (Juanes):** test accounts are kept; Brevo needs no change.
Deferred to another session: app version 1.0.0, smaller defects.

## Session log — 2026-10-11 (morning)

Look & feel list from the 10-05 run, done in five batches, plus what testing
turned up. All deployed to Railway (API + dashboard) and in APK `versionCode` 11.
**Built:** one dashboard shell with a grouped sidebar (Operacional /
Administração), company menu, subscription inside Definições, Reputação as a
tab of Quem já trabalhou, breadcrumbs; **Candidatos** page with live badge,
toast and first-candidate email; equal applicant buttons, sort Best rated /
Best match (`skillMatch`); **Retirar oferta** + Cancel for offers awaiting the
worker; bulk **delete of expired shifts** (archived, not cancelled); worker
**notifications inbox** with bell and offer **countdown**; worker pushes in the
worker's language (PT/EN). Track 5 created from the automations notes.
**Fixed:** offers stuck on "A aguardar trabalhador" (lost 2h timer → 15-min
sweep; Railway Redis set to `noeviction`); a stale timer could cancel a newer
offer; invite-only offers turned workers into "applicants"; "Eliminar" 400'd
until 02:00 UTC; expiry read UTC; Expired section had broken layout; the 11h
rest rule compared with one shift only (refused every earlier shift, missed
rest before an existing one) and now also runs at accept and invite;
applications on expired/cancelled shifts stayed "Pendente" forever; Início
"Candidatos pendentes" counted open shifts; duplicate socket connections; a
push pointing to the non-existent `suporte@turnos.pt`; a payment-timing promise
in a push. **Decided (Juanes):** economic-dependency check and the
outside-income question removed — Turnos does the matching and doesn't ask
about income outside the platform.

## Session log — 2026-10-05

First production end-to-end run, plus the launch-blocker work around it.
**Closed:** rate limiting (#6 — two proxy hops, 429s verified), email (#7 —
Railway blocks SMTP, moved to Brevo's HTTPS API, first real email delivered).
**Decided:** Turnos stops emailing the company's accountant — the company
exports hire data from the new "Contratações" page (terms v0.2 without
Annex A, law-firm pack regenerated); Twilio waits for the NIPC (OTP gate
parked on branch `otp-prod-gate`); docs restructured (this file is the only
tracker, go-live-cleanup is the runbook).
**Bugs the run found, all fixed and deployed:** shift times read as UTC
(every time an hour late), manual "Concluído" skipped the payment/fee/review
chain, every ratings endpoint used the wrong user, completion rate never
computed, contracts list leaked the full worker record, verification link
404'd, no way to resend verification, `MAIL_USER` set an unverified sender.
**Added:** bilingual PT + EN company emails, resend-verification card,
completed-shifts count, RELIABLE badge on 20 completed shifts, "Contratações"
in the menu.

---

## Track 1 — Launch blockers

Six found between 2026-09-09 and 2026-09-13; **four closed** (three on
2026-09-23, rate limiting on 2026-10-05). Email (#7) was added 2026-10-05: it
was in Track 3, but unpaid-wage reminders, ops alerts and company email
verification depend on it, so it blocks launch. Ordered by what happens if
you forget.

> Which build is serving is now answerable directly: `GET /api/health` returns
> the short commit sha. Added after an afternoon where a failed Railway build
> (its builder ran out of disk) left the previous image running, a redeploy
> brought that same old image back, and the only way to tell which code was live
> was which bug reproduced.

| # | Blocker | Where | State |
|---|---|---|---|
| 1 | Mock OTP `123456` accepts any phone number | `apps/api/src/auth/auth.service.ts:76` | 🔴 Live — **waiting on company registration** (fix ready on branch `otp-prod-gate`) |
| 2 | Public endpoints leaked billing + worker PII | `GET /api/shifts/search`, `/shifts/:id` | 🟢 **Fixed `dbb95f3`**; applicant list (`/shifts/:id/applications`) leak fixed 2026-09-27 |
| 3 | Demo seeding endpoint deployed | `apps/api/src/demo/` + `DEMO_SEED_TOKEN` | 🟢 **Done `001a99d`** — code deleted, rows cleaned, variable unset |
| 4 | CORS open to every origin | `apps/api/src/main.ts` | 🟢 **Fixed `dbb95f3`** |
| 5 | Stripe still in test mode | Railway variables | 🔴 Live |
| 6 | Rate limiting did not enforce | `main.ts` `trust proxy` | 🟢 **Fixed `d1501ca`** (2026-10-05) — 429s verified on prod |
| 7 | No email was delivered | `mail.service.ts`; Railway blocks SMTP below Pro | 🟢 **Fixed 2026-10-05** — Brevo HTTPS API; first real email (company verification) delivered to Hotmail and the link verified the account. Gotcha on the way: a leftover `MAIL_USER` set the sender to an unverified address — runbook §3. Still sending from a gmail.com address (Brevo warns: DMARC) — move to an owned domain before launch. Companies registered before 2026-10-05 never got their verification email; the dashboard now shows unverified companies a "Reenviar email de verificação" card (`POST /auth/employer/resend-verification`) |

**1 — Mock OTP.** Activates whenever Twilio credentials are absent or still
`replace_me`. Setting the Twilio variables is *not* sufficient — if one is ever
unset by accident the bypass returns.

**Decision 2026-10-05: waiting on company registration.** Twilio's trial
cannot create a Verify service (the code uses Verify) — it needs an upgrade
with tax details, and Juanes is waiting until Turnos has its own NIPC rather
than putting the account under a personal NIF. Until then: **no real worker
data in production** — with the mock live, anyone can sign in as any number.
The fix is ready on branch **`otp-prod-gate`** (`68f70cf`): mock disabled in
production, fails closed with 503 if any Twilio variable is missing (before,
a missing `TWILIO_VERIFY_SERVICE_SID` alone re-enabled the mock). To close:
upgrade Twilio → create a Verify service → enable PT + FR in Geo permissions →
set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` →
test a real SMS sign-in → merge the branch.

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

**6 — Rate limiting. FIXED 2026-10-05 (`d1501ca`).**

Cause: the throttler keys on `req.ip`, and with `trust proxy` unset that was
the Railway proxy that forwarded the request — a different one almost every
time, so every request got a fresh bucket (`X-RateLimit-Remaining` stuck at
59/58). The chain, read off production with a temporary echo route: client →
Railway edge (appends itself to `X-Forwarded-For`) → internal proxy (the
socket) → app. **Two hops**, so `app.set('trust proxy', 2)`; one hop still
keyed on the rotating edge node. The edge discards client-sent
`X-Forwarded-For` and overwrites `X-Real-IP`, so this is not spoofable.
Override with `TRUST_PROXY_HOPS` if Railway's topology changes.

Verified after deploy: sequential requests share one counter, a spoofed
`X-Forwarded-For` does not escape it, and a 70-request burst returned 51 × 200
+ 19 × 429. The original finding is kept below for the record.

*Found 2026-09-13, re-verified 2026-09-23:*

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

~~**Fix this before Twilio, not after.**~~ Done — Twilio is unblocked.

**7 — Email. Found 2026-09-27, cause found 2026-10-05.** Every email —
unpaid-wage reminders, ops alerts, suspension notices, company email
verification — is dropped. (The accountant email for the SS admission is no
longer one of them: removed by decision on 2026-10-05, see below.)

The Gmail SMTP variables were set on 2026-10-05 and still nothing could be
sent: **Railway blocks outbound SMTP on every plan below Pro**
([docs](https://docs.railway.com/networking/outbound-networking)). The
connection times out after ~2 min — the credentials are never even tested.
Until that day `/health` would have reported `"mail":"smtp"` regardless; it
now logs in at boot and reports `smtp` / `smtp-error` / `smtp-unverified` /
`log-only` (`f15a2b1`). Same commit fixed the company verification link, which
lacked the `/api` prefix and would have 404'd.

Decision 2026-10-05: send through an **HTTPS email API** (Brevo), not SMTP.
Flodesk (already paid for) was considered and rejected — it is a marketing
tool whose API manages subscribers and workflows; it has no transactional
send, and adding workers and accountants as marketing subscribers would be
wrong under GDPR. Setup steps: `docs/go-live-cleanup.md` §3.

**Decision 2026-10-05 — Turnos no longer emails the company's accountant.**
The `ss-direta` queue sent each hire's data (worker name, NIF, role, date,
hours, location, rate) to the company's accountant 24h before the shift. It
predated the 2026-09-27 legal rewrite and contradicted it: Turnos was
performing an employer duty on the company's behalf, which blurred who the
employer is (ADR 001) and made Turnos a processor needing an art. 28 DPA
(Annex A). Now the data is in the dashboard the moment the worker confirms —
**Compliance → Contratações**, copy per hire or export the month to Excel
(`;`-separated, UTF-8 BOM), with a "Dados SS" button on each confirmed shift
and a reminder banner that the communication is the company's, before the
shift. Annex A removed from the company terms (v0.2), terms version bumped to
`2026-10-05` (every company re-accepts), privacy policy, FAQ, marketing copy
and the lawyers' brief updated. Found while doing it: the contracts endpoint
returned the full `Worker` entity (IBAN, Stripe id, declared income) — now an
explicit field set. **Tell the law firm** — they are reviewing the v0.1 pack.

---

## Track 2 — App Store & Play Store

No document in the repo covered this before 2026-09-09. Derived from
`apps/mobile/app.json` and the surrounding code.

### Hard blockers — both built 2026-09-09, both need one more step

| Blocker | State |
|---|---|
| Privacy policy | 🟠 Built at `/privacidade` (PT + EN), revised 2026-09-27 and sent to the law firm with `docs/legal/brief-advogados.md`. **Draft — not lawyer-reviewed; controller identity and hosting region still `[[PLACEHOLDER]]`**. Notifications inbox added 2026-10-11 (what it stores, 180-day retention, erased with the account) |
| Terms of use | 🟠 Provisional versions live at `/termos` (workers) and `/termos-empresas` (companies), linked everywhere and accepted with version + date. **Not lawyer-reviewed** — review copies in `docs/legal/`, Word pack in `docs/legal/pack-advogados/` |
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
| ~~`RECORD_AUDIO` permission~~ | 🟢 Fixed 2026-09-27 — removed, `recordAudioAndroid: false` on `expo-camera` |
| ~~Location asks for "Always"~~ | 🟢 Fixed 2026-09-27 — when-in-use only, background disabled on both platforms |
| ~~Permission strings mixed PT/EN~~ | 🟢 Fixed 2026-09-27 — camera and location strings now PT like the rest |
| EAS preview build | 🟢 **Current: `versionCode` 11** (built 2026-10-11, EAS `6fd6854d`) — completed-shifts count + "Taxa de conclusão", notifications inbox + bell + offer countdown, offer pushes open My shifts, closed applications in History as Caducado/Cancelado, onboarding without the outside-income question. Tested on a device 2026-10-11 by Juanes (inbox, countdown, candidates flow). Earlier `app.json` permission changes and the date-of-birth field were in the 10-05 build. **Built 2026-10-11, in APK `versionCode` 12 (EAS `9af718d1`, queued 2026-10-11 — test on a device):** visible **"✓ Recebi" / "🚩 Não recebi" buttons** on the completed-shift card (was a tappable sentence opening a dialog, missed in the first E2E run) — "Recebi" acts at once, "Não recebi" asks first because it opens a case; the app now writes `preferredLanguage` at sign-in and on every launch when it differs from the language shown (`syncPreferredLanguage()` in `lib/api.ts`), not only on a manual switch. Bump `versionCode` in `app.json` for every build (`appVersionSource: local`) |
| `version: "0.0.1"` | Ship as `1.0.0`; set `ios.buildNumber` or let EAS auto-increment |
| ~~Off-brand colours~~ | 🟢 Already fixed — `app.json` uses `#6a79ff` / `#fafdff` (confirmed 2026-10-05) |

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
| First end-to-end run | 🟢 **Ran 2026-10-05** (Carolina Bakes + worker on the emulator, payment method Transferência): company terms gate → publish → apply (18+ check passed) → approve → worker accepts → "Dados SS" / Contratações → manual "Concluído" → wage payment row + payment-due email → "Marcar como pago" with proof → worker sees proof → ratings both ways → completion count. Found 6 bugs, all fixed (Session log). **Not covered, still to run:** the **QR scan** (emulator has no camera — Android Studio VirtualScene can show the QR image), hence the geofence, the corrected Lisbon check-in window and the **automatic completion at the scheduled end**; and the **Pay Link** path, which needs Stripe (#5) — rerun the whole flow with a Pay Link shift once Stripe is set up |
| ~~Look & feel from the E2E~~ | 🟢 Listed, built, **deployed and tested 2026-10-11** in five batches (mobile part in APK `versionCode` 11): (1) this doc + Track 5 — **done**; (2) **done 2026-10-11** — one shared `DashboardShell`, sidebar grouped Operacional / Administração, "Dashboard" → "Início", subscription moved into Settings + company menu, breadcrumbs instead of the tiny "← Dashboard" link, Reputação folded into "Quem já trabalhou" as a Reviews tab (old `/dashboard/billing` and `/dashboard/ratings` URLs redirect; rate-the-worker emails now link to `/dashboard/workers?tab=reviews`); (3) **done 2026-10-11** — **Candidates** page (`/dashboard/candidates`, jobs with pending applicants, soonest first) + live sidebar badge (red while some are unseen, from the `shift:new_application` socket) + toast on any page + real count on the Início card (it was showing open shifts) + one email per job on its first candidate (switchable in Definições → Notificações, `newCandidates`), equal-size applicant buttons, sort reduced to Best rated / Best match (`skillMatch()` in shared, reasons shown). New column `shift_applications.employerSeenAt` reaches production through `synchronize` like the others. Verified locally end to end with three test workers; (4) **done 2026-10-11** — "Awaiting worker" (PENDING_ACCEPTANCE) shifts get **Retirar oferta** + Cancelar (they had no action at all); one `shifts/offer-release.ts` for the 2h timeout, the withdraw and a new **15-min sweep** that releases offers whose timeout job was lost; a stale timer can no longer cancel a newer offer; an invite-only offer that lapses no longer turns the worker into an "applicant" (`ShiftApplication.invited`); "Eliminar" on an expired shift works before the 02:00 UTC job runs (it 400'd for up to a day); expiry reads Lisbon time; the Expired section had broken layout (styles that never existed) and now sits under Active shifts; re-post leaves date **and** start time empty and keeps payment method + map location; the company-cancel push no longer promises worker "priority" (removed from policy v1.2). Verified locally end to end; (5) **done 2026-10-11** — worker **notifications inbox**: every personal push is also stored (`worker_notifications`, `NotificationsService.notifyWorker()` replaces the 12 `if (token) sendDirectPush` call sites, so workers with notifications off now get a record), bell with unread count on the feed and My shifts, `/notifications` screen, one tap-routing table for push and inbox (`lib/notificationRoute.ts` — offer pushes now open My shifts, where Accept lives), live **countdown** on the offer card from the new `Shift.offeredAt` (timestamptz; the sweep uses it too). Retention 180 days (nightly) and wiped on account deletion. API verified locally; the mobile screens are **not yet seen on a device** — check them on the next EAS build. Also: the hours-adjusted push pointed workers to the non-existent `suporte@turnos.pt` — now `SUPPORT_EMAIL`. **Follow-up 2026-10-11:** worker pushes were hard-coded Portuguese — now catalogue keys (`api.push.*`, PT + EN) sent in `Worker.preferredLanguage`, and the inbox re-renders in the app's current language (entries from before this stay as sent). The "payment received" push dropped its "arrives in 1–2 working days" promise. Server-only, no new APK. Gap closed in code 2026-10-11 (needs APK 12): the app now syncs `preferredLanguage` at sign-in and launch, so a worker who never touched the switch no longer defaults to PT |
| ~~Dashboard colour overload; reviews listed every shift~~ | 🟢 **Done 2026-10-11 (2nd round, from Juanes's review of Shifts + Reviews).** (1) **One neutral UI kit** `apps/web-admin/lib/ui.ts`: outline buttons everywhere, red *text* only for destructive actions, the brand gradient only on the page's main action; statuses are grey pills with a dot coloured only when it needs attention (amber = awaiting the worker, brand = in progress, red = cancelled). Applied to Shifts and the Reviews tab; the yellow border every status pill inherited is gone. Other pages still to move over when touched. (2) **Reviews tab bug:** "Avaliar" and "Reportar falta" listed **every** shift of the company under every worker — and the server acts on whoever worked the chosen shift, so a no-show reported from one worker's card could sanction another. `GET /shifts/employer/workers` now returns per worker `pendingReviews` (their completed jobs not yet reviewed; one per job, a multi-day series once) and `noShowShifts` (their FILLED shifts already started, no check-in). The card shows "Avaliar (n)" only while a review is owed, otherwise "✓ Trabalhos avaliados"; "Reportar falta" only when there is a shift it can apply to. `reportNoShow` now refuses a shift that hasn't started or was checked in. Rule: **one review per job** — working again for the same company is a new job and a new review; reputation is the average. Verified locally with the dev DB |
| ~~11h rest rule compared with one shift only~~ | 🟢 Fixed 2026-10-11 (found from a worker question). `checkRestPeriod` compared the new shift with the worker's **latest-dated** confirmed shift, one direction only: any shift *earlier* than that one got a negative gap and was always refused, and a shift ending <11h before an existing one passed. Now `ComplianceService.assertRestPeriod()` checks every confirmed shift within ±2 days, both directions, and also runs when the worker **accepts** an offer and when a company **invites** directly (company-facing message). Days of the same multi-day job are not checked against each other. Verified locally with 6 cases |
| ~~Applications on dead shifts stayed "Pendente"~~ | 🟢 Fixed 2026-10-11. Nothing closed applications when a shift expired or was cancelled, so the worker's "Pendentes" listed a 26 Sept job on 11 Oct. New `ApplicationStatus.EXPIRED` / `CANCELLED` (`shifts/application-closing.ts`) set on cancel, on "Eliminar" of an expired shift and on expiry; the 15-min sweep now also runs expiry (was 02:00 UTC only) and a catch-up that closed every stuck row. App: closed ones move to History as "Caducado"/"Cancelado" — **needs the next APK**; on the current APK they simply drop out of "Pendentes" (it doesn't know the new statuses) |
| ~~Economic-dependency check blocks repeat work~~ | 🟢 **Removed 2026-10-11 by decision** (Juanes): Turnos does the matching and does not ask about income outside the platform. It refused every further application to a company once a worker with no declared outside income had worked for it. Check, onboarding question, column (dropped by `synchronize`) and endpoints removed; privacy policy, company terms and FAQ no longer mention declared income. **The law-firm pack still describes it** — send the next regenerated pack |
| ~~Expired-shifts count only grew~~ | 🟢 Built 2026-10-11. Expired section has row checkboxes, "Selecionar todos", **Eliminar selecionados (n)** and **Eliminar todos (n)** (`POST /shifts/employer/expired/delete`, no ids = all). Deleting now **archives** (`Shift.archivedAt`, status stays EXPIRED) instead of setting CANCELLED, which had only moved them into Histórico as fake cancellations; archived shifts leave the dashboard and the Início count. Selecting one day of a multi-day job removes the job |
| ~~Ops emails can't be acted on~~ | 🟢 **Built 2026-10-11.** Found when Juanes flagged "Não recebi" on purpose: the team email showed database ids and `TURNOS_PAY_LINK`, no names, contacts or proof link. Now one template for every ops email (`apps/api/src/mail/ops-email.ts`, `MailService.sendOpsAlert()`): subject `[PAG-94C47B] Não-pagamento · Carolina Bakes · €60,00` (reference = prefix + first 6 chars of the record id: `PAG` payment, `CAN` company cancellation, `JUS` worker justification, `FAL` no-show — find the row with `WHERE id::text LIKE '94c47b%'`), one-line summary, facts table (company + NIPC + email, worker + phone + email, shift date and hours, amount, method in words, timeline), links (proof file, Pay Link, the worker's Stripe account), an **"O que fazer"** box with the 48h deadline the policy promises, and reply buttons with the reference in the subject. Text typed by companies and workers is now HTML-escaped (it went in raw). Covers all six alerts plus one that was missing: at **72h unpaid** the ladder only emailed the company — now the team gets the case too. **The no-show alert now fires on every no-show** (it needed 3 in 60 days, unreachable since the 2nd blocks the account). Tagged `ops` in Brevo. Brevo: no setting to change (Juanes checked — no unsubscribe link in the emails). The "Unsubscribe" seen on 10-11 was most likely Gmail's own button next to the sender; **never press it on an ops alert** — it puts the ops address on Brevo's blocklist and alerts stop arriving silently. If that ever happens: Brevo → Transactional → Blocked contacts → unblock. Later: an internal ops page where a case is marked resolved (needs admin auth) |
| ~~Redis eviction policy~~ | 🟢 Set 2026-10-11. Locally BullMQ warned `Eviction policy is allkeys-lru. It should be "noeviction"` — under memory pressure Redis may delete queued jobs (2h acceptance timeouts, wage reminders, auto-completion); likely cause of the shift found stuck on "A aguardar trabalhador". Railway Redis now has the service variable `maxmemory-policy = noeviction`, which Railway applies at start — confirmed with `redis-cli --no-auth-warning -a "$REDIS_PASSWORD" CONFIG GET maxmemory-policy` in the Redis Console (the Console is a shell, not redis-cli). **Keep that variable.** Final check: the warning should be absent from the API's Railway log after the next deploy |
| ~~`synchronize: true`~~ | 🟢 **Done 2026-10-11.** `synchronize: false` + `migrationsRun: true`; `src/migrations/…-Baseline.ts` generated from the entities against an empty DB, and a no-op where the `users` table already exists. Verified locally: empty DB → 15 tables, re-run → nothing pending, schema = entities ("No changes"); the dev DB built by `synchronize` also showed **no drift** against the entities and kept its data; the compiled app booted on an empty DB through the migration. **Deployed 2026-10-11 (`8c5a4df`)**, API up and querying (first push failed to build: `data-source.ts` imported `dotenv`, which is not an API dependency — now Node's `process.loadEnvFile`; the production Dockerfile was then built and booted locally before pushing). From now on every entity change needs a migration — runbook §5 |
| `BYPASS_SUBSCRIPTION` | `payments.service.ts:205` returns early, which also skips the overdue-wage block. Delete the Railway variable after the Pay Link end-to-end run (the test company publishes through it; the transferência run was done 2026-10-05); consider gating the code on `NODE_ENV !== 'production'` |
| ~~Test accounts~~ | 🟢 **Decided 2026-10-11: keep both** — worker `+33767560422` (Juanes) and employer Carolina Bakes stay as internal test data. No cleanup touches them. The worker's bio, skills, languages and experiences are still seeder fiction; rewrite them whenever convenient |
| ~~`apps/api/.env` baked into the image~~ | 🟢 Not possible — `.env` is not in git and Railway builds from git (checked 2026-10-05). An image built locally *would* include it: the Dockerfile copies `apps/api/` and the only `.dockerignore` sits in `apps/api/`, outside the build context root |
| Uploads on local disk | R2 is decided, wiring incomplete. `useStaticAssets('/uploads')` serves photos, CVs and payment proofs from a container filesystem that does not survive a Railway redeploy |
| Dashboard unusable on a phone | 0 media queries, 843 inline style objects across 11 pages, and an overlay telling sub-768px visitors to use a desktop. The sidebar was hoisted into one `components/DashboardShell.tsx` on 2026-10-11 (it had been copied into 3 pages and missing from 8) — the next step is making that shell collapse on narrow screens |
| Smaller defects | `createGoogleEmployer` creates a `User` but no `Employer` row · blanket 401 → logout masks real auth errors · pre-shift consequence reminder no longer in the policy (removed from v1.2 until built) · unused deps: `@reduxjs/toolkit`, `react-redux`, `react-query`, `expo-crypto` (mobile), `@stripe/react-stripe-js`, `@stripe/stripe-js` (web-admin) · mobile `tsc` noise (`TS2786`/`TS2339`, LinearGradient + design-token typings — Metro unaffected) |
| **Skills matching — roles, levels, tasks** | 🟠 **Built locally 2026-10-25, not deployed** (`docs/skills-matching-proposal.md`; what was built: CLAUDE.md). Steps 1–3 done: shared catalogue + migration + API, dashboard (posting form, applicant reason line, worker search), app (roles editor, shift-detail level, feed chip). Verified: migration on the local DB (schema = entities), API end-to-end script (level gate PT/EN, 3-role cap, old-app save, no internal counters leaked), dashboard in the browser PT + EN, Android bundle builds. **Not verified:** the app screens on a device — the app can't run on web (`react-native-maps`). **To ship:** EAS preview build `versionCode` 13 → test onboarding/edit-profile roles, provisional prompt, shift-detail gate → deploy API + dashboard **at the same time as** the APK. **Still to build:** step 4 — "did the level match?" in the company review → `confirmedShifts` / `belowLevelCount`, two "below" answers open an ops case (no auto-downgrade); certificate upload for Vigilante / empilhador / Motorista (today only a warning); step 5 docs — privacy policy (level confirmations), worker terms ("declare truthfully"), FAQ |
| **Legal gates — test pass** | 🟠 Built 2026-09-27. **Tested 2026-10-05:** company terms modal after the version bump (accepted), 18+ check on apply (passed with a date of birth set). **Still untested:** worker terms screen on a fresh sign-in, statements of reasons (needs a reported no-show on a test shift), retention log line `[Retention] Nightly purge registered` in the Railway logs. How: runbook §8 |
| ~~Email is not being sent~~ | Promoted to Track 1, blocker #7 |
| ~~Shift times read as UTC~~ | 🟢 Fixed 2026-10-05, found preparing the first end-to-end run. The API runs in UTC on Railway and built shift instants with `new Date(\`${date}T${time}\`)`, so every Lisbon wall-clock time was an hour late in summer: check-in window, auto-completion, 11h rest check, company/worker cancellation thresholds, check-in "today" after 23:00. Now `common/lisbon-time.ts` (`lisbonDateTime`, `lisbonDate`, DST-tested); API messages format in Lisbon time. Not fixed via `TZ` — that would change how `pg` reads existing `timestamp` columns |
| **Law firm has the v0.1 pack** | 🟠 **Pack regenerated 2026-10-11 — ready to send.** Juanes trimmed it for the firm (no dates, change logs, documents table, "O que pedimos"; question B5 on controller qualification dropped from the note — it stays as the ⚖️ note under clause 11.3 of the company terms). His edits were made on the 27/09 copy, so they were re-applied to the current sources rather than copied over: the accountant email and Annex A stay removed. Since the change box is gone, **say in the cover email** that the accountant email and Annex A were removed (company terms v0.2) and that the outside-income question is gone. Sources, never the .docx: see `scripts/legal-pack/build.js` |
| Stored accountant emails | No longer collected or used; clear what is stored — runbook §8 SQL |
| TSU tab said the worker pays their own 11% | 🟢 Neutralised 2026-10-05 (now "simulação informativa… obrigações da entidade empregadora"), because the page became reachable from the new "Contratações" menu entry. Write the definitive copy once the law firm answers brief question A3 |
| ~~Every ratings endpoint used the wrong user~~ | 🟢 Fixed 2026-10-05, found in the first end-to-end run. `ratings.controller.ts` read `req.user.sub`; the JWT strategy provides `req.user.userId`. Every handler got `undefined`, and TypeORM drops an undefined condition — so lookups matched the **first** employer/worker row: ratings refused with 401 (which also logged the company out of the dashboard), a worker's "my reviews" showed someone else's, favourites and no-show reports acted on an arbitrary company. Production has only test data, so nothing to repair. **Audit done 2026-10-11** — see the row below |
| ~~Undefined-id audit~~ | 🟢 **Done 2026-10-11 — found two live bugs, both fixed.** All 164 `where` clauses reviewed. (1) **Account takeover while the mock OTP is live:** an empty `POST /auth/verify-otp` passed the mock (`store.get(undefined) === undefined`) and `findByPhone(undefined)` returned the **first user in the table** — tokens for that account. The same hole sat behind employer login without an email and Google sign-in without an email scope (any Google access token). (2) **WebSocket rooms:** the gateway read `payload.userId`, tokens carry `sub`, so every client joined the **first company's / worker's** room — other companies got that company's live events and none of their own (unnoticed with one real company). Fixes: `common/lookup-key.ts` `isLookupKey()`; every `UsersService` lookup by phone/email/id/googleId refuses an empty key without querying; OTP, employer login, refresh and Google validate their inputs (Google also needs `verified_email`); `JwtStrategy` rejects a token without `sub`; gateway reads `sub`; guards on QR employer id and favourites. Tests: `auth/auth.lookups.spec.ts`. **Merge note:** branch `otp-prod-gate` also edits `verifyOtp` — keep both changes when merging. Not tried against production. Still open in the same family: Google sign-in accepts an access token from any Google client (no audience check) — only matters once Google login is switched on |
| ~~Completion rate always 0%~~ | 🟢 Fixed 2026-10-05, found in the first end-to-end run: nothing ever wrote `Worker.completionRate`, so every profile showed "0%" and the RELIABLE badge (≥ 90%) was unreachable. Now completed ÷ (completed + no-shows), recomputed on each completed job and each rating, and computed live in the summary. Label renamed to "Taxa de conclusão" and a completed-shifts **count** added (Uber-style) in the app, worker search and applicant list. **RELIABLE badge now needs 20 completed shifts** (was 20 ratings — companies don't always rate), plus 0 no-shows and ≥ 90% |
| ~~Manual "Concluído" skipped settlement~~ | 🟢 Fixed 2026-10-05, found in the first end-to-end run: `manualConfirm` set COMPLETED and stopped — no wage payment row, no reminders, no €3 fee, no review prompts (and `completeShift` skips manually closed shifts). Now runs the same settlement as auto-completion; manually closed series days count towards the series' paid hours |
| Email language | Interim since 2026-10-05: emails to companies (verification, rate-the-worker, payment due, wage reminders, posting block) are **bilingual PT + EN** via `MailService.sendBilingual()`. End state: store each company's language and send only that one — workers already have `Worker.preferredLanguage` (restriction notices use it). Internal ops alerts stay PT |
| Manual monthly step | Delete worker late-cancel justifications older than 6 months from the ops inbox — the privacy policy promises it and nothing automates it. How: runbook §8 |

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

## Track 5 — Future improvements (not launch blockers)

Every wanted improvement, kept in one place so nothing lives in a stray doc.
**None of these block launch.** Promote an item to Track 1–3 only by decision.
Source: Juanes's "Automatizations to do" notes (2026-10-11), re-ordered by
value.

### Fewer no-shows, faster fills

| Item | Detail |
|---|---|
| **Reconfirmation 24h before** | Worker confirms 24h out; no reply by 12h → automatic cancellation and the slot reopens. Biggest single lever against no-shows (Shifty's "<5% no-show"). Carry the consequences reminder the cancellation policy used to promise (removed from v1.2 until built) |
| **Waiting list** | When a confirmed worker cancels, offer the shift to that shift's other applicants first — the company has already seen them. Shifty benchmark gap |
| **No-show detection + urgent refill** | T+15 min without check-in: push the worker ("On your way?" [Arriving] [Can't make it]) and alert the company. T+30: *ask* the company — sanctions (1★ + suspension) still need its confirmation, never a timer (Platform Work Directive, human review). Refill: other applicants first, then an urgent wave to opted-in workers ("Available for urgent shifts" switch) within ~30 min travel, skills match, 11h rest respected. New start = now + 60–90 min, same end; warn if under the 2h minimum. First qualified worker to accept gets it, with the company's consent given in advance; optional "+€X/h urgent" bonus. Multi-day jobs: refill only that day |
| **Reminder 2h before** | Address + maps link, dress code, "scan the QR on arrival" |
| **Weekly "Available this week?"** | One-tap day selection; keeps the availability data that matching and urgent refill depend on fresh |

### Shift rules

| Item | Detail |
|---|---|
| **Shift length 4h–10h** | **Proposed 2026-10-17, not decided** (Merytu benchmark — they use 4h min / 10h max). Today: 2h minimum, no maximum (`shifts.service.ts` `create()` guard + `new-shift/page.tsx` check, errors `api.shifts.minDuration` / `admin.newShift.errDuration`, "Mínimo 2 horas" badge). **Suggestion:** raise the minimum to 4h and allow up to 10h, but since Turnos shifts are employment (MCD) and Merytu's are self-employment, the Labour Code applies above 8h: hours 9–10 are overtime (~+25% first hour, +37.5% after, art. 268.º), work can't run more than ~5h straight without a 1–2h break (art. 213.º), and 22h–7h carries the night premium (art. 266.º). So: a warning on any shift >8h, and the break + overtime included in the all-in cost estimate — **confirm with the law firm before building**. Trade-off: the 2–3h lunch/dinner-rush shift disappears; check the beta companies don't rely on it. Applies per day for multi-day jobs; existing shifts unaffected. **Rules that depend on the 2h figure — decide separately whether they stay at 2h or move to 4h** (they are compensation floors, not shift length): (1) **"Ajustar horas" floor** — `wage-payments.service.ts` clamps to ≥2h; (2) **company cancels <3h by own error** → 2h paid to the worker (`shifts.service.ts`, `minimumEur` in web-admin `shifts/page.tsx`); (3) **shift ended early** → hours worked or 2h, whichever is greater (company terms); (4) the urgent-refill idea below ("warn if under the 2h minimum"). **Documents to update with whatever is decided:** `policies/cancellation-and-noshow-policy.md`, `legal/termos-empresas.md` + `web-admin/app/termos-empresas/content.ts` (a terms change → bump `TERMS_VERSIONS.EMPLOYER`), `legal/termos-trabalhadores.md`, `legal/pay-link-legal-brief.md`, `faq-turnos.md` (Q on "porquê pagar 2 horas" explicitly ties the cancel minimum to "as 2 horas de duração mínima"), i18n PT + EN. **Not related:** the 2h window to accept an offer (`OFFER_ACCEPTANCE_HOURS`) |

### Matching and invitations

| Item | Detail |
|---|---|
| **Top 5 suggested workers after publishing** | Needs a second kind of invitation, "invited to apply" (push → one-tap apply, company still chooses). Today's `inviteWorker` is a *direct offer* that locks the shift to one worker for 2h — keep it as is. Ranking is a transparent score, not AI. Hard filters: available that day, `isAvailableForWork`, not suspended, required languages, no overlapping shift, MCD 70-day + 11h rest pass. Weights: skill/experience for the role, distance, smoothed rating, reliability, worked here before / favourite, recent activity, response rate. Reserve 1 of 5 slots for a promising new worker. Show "why suggested" (1.2 km · ★4.8 · 12 shifts as Barista). Delivery: on screen after publishing with "Invite all 5"; email to companies that left the page — its button opens a confirmation page (mail scanners click links), shows first name, photo, rating, distance only. Coordinate with the existing top-20 wave; per-worker daily invite cap; one "Convite" notification type |
| **"Repeat this shift"** | After completion; suggest a recurring shift when the same one is posted three weeks running |
| **No applicants at 48h / 24h** | Tell the company, with suggestions: raise the rate (what similar shifts pay nearby) or widen skill requirements |

### Notifications

| Item | Detail |
|---|---|
| **Workers** | What's missing to reach 80 profile points; approaching the 70-day MCD limit with one company; "Company X wants to work with you again"; end of a suspension; rejected applications (don't leave people waiting) |
| **Companies** | Candidates waiting more than 6h for an answer; day-before summary of who's coming; a favourite worker became available; monthly summary (spend, hours, informative SS figures); card expiring / payment failed |
| **Operations** | Disputes breaking the 48h response time the policy promises → automatic escalation; fraud and rating anomalies; companies inactive 30 days |
| **Rules** | Preferences screen; quiet hours 22:00–08:00 (except urgent shifts for opted-in workers); deduplication; channel order push → WhatsApp → email; per-day cap per worker. Document how prioritisation works — it is the "algorithmic management" the law now regulates |

### Verification and trust — no AI CV screening

| Item | Detail |
|---|---|
| **Why no AI screening** | EU AI Act Annex III(4) makes candidate-filtering AI high-risk (conformity assessment, logging, human oversight), plus GDPR art. 22 and discrimination risk. And for hospitality shifts a CV says little |
| **Identity** | Award VERIFIED from Stripe Connect KYC (free for Pay Link workers); Stripe Identity (~€1.50/check) for the rest. Rule-based fraud checks: same IBAN, device or photo across accounts |
| **Right to work** | The check that matters legally — much of Lisbon's hospitality workforce is non-EU and the employer is liable. Collect nationality + residence/work document where needed |
| ~~Skills "verified by work"~~ | Moved into the skills-matching work (Track 3 row): role levels confirmed by a "did the level match?" question in the company review — step 4 there |
| **Certificates and video** | Certificates only where the law requires them (e.g. food hygiene for kitchen roles). Optional video intro as a language badge (Shifty benchmark) |
| **Where AI is fine** | Parsing a CV to pre-fill the experience fields, worker confirms — assists, evaluates nobody |

### WhatsApp assistant for companies

| Item | Detail |
|---|---|
| **Order of work** | 1) Notifications + one-tap actions ("New candidate: Ana ★4.8 [See] [Select]", "Wage unpaid 24h [Pay Link]") — read far more than email. 2) Repeat-a-shift with buttons ("Repeat last Saturday's? [Yes] [Change time]"). 3) Free-text posting via AI only once the structured flow works |
| **How** | WhatsApp Flows + interactive buttons; the model's tools are the existing API endpoints; always a summary + explicit confirmation before publishing (it creates the hire record, the fee and the payment-method commitment). Link the number to the company account once, with an OTP. FAQ answers from `faq-turnos.md` are cheap and useful |
| **Costs / constraints** | Meta charges business-initiated templates (replies in the 24h window ~free); needs Meta business verification; Twilio supports WhatsApp; Meta + the AI provider must be named in the privacy policy and DPA; never send IBANs through the bot. Not a substitute for making the dashboard work on a phone (Track 3) |

---

*Store requirements change — re-read Apple's and Google's current published
guidelines before submitting.*

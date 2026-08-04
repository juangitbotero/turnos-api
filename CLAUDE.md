# Turnos App — Claude Code Context

## What This Is

Turnos is a **labour marketplace for Portugal** — employers post short shifts, workers browse and apply, employers select who they want, and the platform handles Portuguese labor compliance automatically (MCD contracts, TSU calculations, SS Direta notifications). The model is adapted from the French platform Student Pop.

**Target market:** Lisbon beta → Porto expansion  
**Workers:** Flexible workers on MCD contracts (Muito Curta Duração) — join and use the app 100% free  
**Revenue:** Company subscription ("Turnos Starter" €45/mo, "Pro" €99/mo planned) + fixed €3 company-side fee per completed shift (invoiced monthly)  
**Worker pay:** Full gross, paid **directly by the company** (Pay Link / transferência / MB WAY — cash retired 2026-07-29) — Turnos never holds wages. See `docs/adr/007-business-model-pivot.md` (2026-07 pivot).

---

## Monorepo Structure (Turborepo)

```
apps/
  api/           NestJS API (TypeScript) — port 3001
  mobile/        React Native + Expo (managed workflow)
  web-admin/     Next.js employer dashboard — port 3000
packages/
  shared/        Types, DTOs, validation utils, design tokens — imported by all apps
docs/
  turnos_roadmap.md     Full product roadmap (Stints 0–10) — source of truth
  adr/                  Architecture Decision Records (all decisions locked)
  brand/                Design system and logo
  legal/                Attorney briefs (Pay Link structure — unsigned)
  competitive/          Competitor benchmarks
  faq-turnos.md         FAQ draft for site + app (59 Q, PT) — unpublished
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | NestJS, TypeScript, TypeORM, PostgreSQL + PostGIS |
| Cache / Queues | Redis, BullMQ |
| Mobile | React Native, Expo managed, React Navigation v6 |
| Web Admin | Next.js, Tailwind CSS |
| Auth | JWT (15m access / 7d refresh), Twilio SMS OTP |
| Payments | Stripe Connect Express |
| File Storage | Cloudflare R2 (decided, not yet wired) |
| Infra | Docker Compose (dev), Railway (MVP target) |
| CI/CD | GitHub Actions |

---

## Running Locally

```bash
# Start DB + Redis
docker-compose up -d

# From monorepo root
npm install
npm run dev          # starts all apps via Turborepo

# Individual apps
cd apps/api && npm run dev
cd apps/mobile && npx expo start
cd apps/web-admin && npm run dev
```

API is at `http://localhost:3001`, web-admin at `http://localhost:3000`.  
Dev OTP code is hardcoded as `123456` (must be removed before production).

---

## EAS Build — Android Beta Testing (as of 2026-06-09)

### Setup Summary
EAS Internal Distribution is configured for sharing the Android APK with test users — no Play Store, no Expo Go required.

| File | Purpose |
|---|---|
| `apps/mobile/eas.json` | EAS build profiles (development / preview / production) |
| `apps/mobile/babel.config.js` | **Critical** — must exist for `expoRouterBabelPlugin` to load correctly |
| `apps/mobile/metro.config.js` | Monorepo-aware Metro config with `nodeModulesPaths` and `disableHierarchicalLookup` |
| `.easignore` | Excludes `.agents`, `.claude`, `apps/api`, `apps/web-admin` from EAS archive (avoids Windows symlink EPERM) |

### How to Submit a New Android Build
Run this from `apps/mobile/`:
```bash
cd apps/mobile
eas build --platform android --profile preview
```
- Profile `preview` → `distribution: internal`, `buildType: apk` → direct APK download link
- Build takes ~10–15 min on Expo's servers
- Share the APK download URL + QR code with Android test users directly (no store)

> ⚠️ **Always specify `--profile preview` explicitly.** Omitting `--profile` defaults to `production`, which produces an `.aab` (Android App Bundle — Play Store only, cannot be installed directly on a device). The EAS build list shows "Android Play Store build" for production and "Android internal distribution build" for preview — check this label to confirm the right profile was used.

### iOS Distribution
Deferred until Apple Developer account ($99/year) is obtained. There is no free alternative for real-device iOS testing.

### EAS Build: Root Cause of `EXPO_ROUTER_APP_ROOT` Error (FIXED)

**Error:** `First argument of require.context should be a string` in `expo-router/_ctx.android.js`

**Root cause (traced through source):**
1. `babel-preset-expo` calls `hasModule('expo-router')` via `require.resolve('expo-router')` **from inside** `node_modules/expo/node_modules/babel-preset-expo/build/`
2. From that nested location, Node.js resolution **cannot traverse into** `apps/mobile/node_modules/expo-router`
3. `hasModule` returns `false` → `expoRouterBabelPlugin` is **never added** to the babel plugin chain
4. `process.env.EXPO_ROUTER_APP_ROOT` is never replaced with a string literal
5. Metro's `collectDependencies` calls `path.evaluate()` on the raw member expression → throws

**Fix:** `apps/mobile/babel.config.js` (created 2026-06-09, final version at commit `4837483`)
```js
module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo is hoisted by npm to the workspace root
  // (node_modules/babel-preset-expo), not apps/mobile/node_modules/.
  // From that location hasModule('expo-router') cannot see
  // apps/mobile/node_modules/expo-router, so the preset's automatic
  // expoRouterBabelPlugin registration is skipped.
  //
  // Fix: require the plugin directly from babel-preset-expo and add it
  // explicitly. This replaces process.env.EXPO_ROUTER_APP_ROOT with the
  // correct relative path before Metro's collectDependencies processes
  // the require.context() call in expo-router/_ctx.android.js.
  const { expoRouterBabelPlugin } = require('babel-preset-expo/build/expo-router-plugin');
  return {
    presets: [require('babel-preset-expo')],
    plugins: [expoRouterBabelPlugin],
  };
};
```
Three iterations were needed to reach this fix (see "Three-iteration fix history" below). The plugin is added **explicitly** to bypass the `hasModule('expo-router')` check entirely — this is the only reliable solution in an npm-hoisted monorepo.

**Three-iteration fix history:**
1. **Attempt 1** — created `babel.config.js` with `presets: ['babel-preset-expo']` (string). Failed: `Cannot find module 'babel-preset-expo'` — npm hoisted it to workspace root, not resolvable by string from `apps/mobile/`.
2. **Attempt 2** — added `babel-preset-expo` as direct devDep, changed to `require('babel-preset-expo')`. Failed: `EXPO_ROUTER_APP_ROOT` error returned — npm hoisted the dep to workspace root `node_modules/`, so `hasModule('expo-router')` in the preset still returned `false`.
3. **Attempt 3 (final)** — explicitly require `expoRouterBabelPlugin` from `babel-preset-expo/build/expo-router-plugin` and add it directly to `plugins`. Bypasses `hasModule` entirely. **Build succeeded.**

### Known expo-doctor Warnings (Expected — Not Real Issues)

| Warning | Why it's safe to ignore |
|---|---|
| `resolver.disableHierarchicalLookup` mismatch | **Intentional.** Without it, Metro traverses up EAS build servers' filesystem and picks up packages from the server's global node_modules. This is the correct setting for this monorepo. |
| Duplicate `react` / `react-dom` | **Expected.** `web-admin` uses React 18, `mobile` uses React 19. These are in separate workspaces and never share a native bundle. Metro resolves correctly via `nodeModulesPaths`. |

---

## Shared Package

`packages/shared/src/index.ts` is the single source of truth for:
- All TypeScript types (`Worker`, `Employer`, `Shift`, `UserRole`, `WorkerBadge`, `Language`, `RatingDirection`, etc.)
- Auth DTOs
- Compliance constants (`TSU_RATES`, `MCD_LIMITS`, `TURNOS_FEE_RATE`)
- Validation utilities (`isValidNIF`, `isValidIBAN`, `isValidNIPC`, `isValidPostalCode`)
- `calculateTSU()` and `calculateProfileQualityScore()`
- `SHIFT_CATEGORIES` — all job categories and subcategories
- `ALL_SKILLS` — flat deduplicated list of all subcategories (used as worker skill pool)
- `LANGUAGES` — 12 supported languages for worker profiles and job requirements
- `WORKER_RATING_TAGS`, `BADGE_THRESHOLDS`
- Design tokens

Always add new shared types here, never duplicate them in individual apps.

---

## Stint Progress

Stints are 2–3 week development phases. Full roadmap in `docs/turnos_roadmap.md`.

| Stint | Name | Status |
|---|---|---|
| 0 | Foundation & Setup | ✅ Complete |
| 1 | Auth & Identity | ✅ Complete |
| 2 | Shift Marketplace Core | ✅ Complete |
| 3 | Notifications & Real-Time Updates | ✅ Complete |
| 4 | Portugal Compliance Engine | ✅ Complete |
| 5 | QR Check-In / Check-Out | ✅ Complete |
| 6 | Payments & Payroll | ✅ Complete |
| 7 | Ratings, Reputation & Trust | ✅ Complete |
| 8 | Product Depth & Operations | 🔄 In Progress |
| 9 | Growth & Marketplace Flywheel | ⬜ Not started |
| 10 | Hardening, Security & Launch | ⬜ Not started |

### Stint 8 — Business Model Pivot Implemented (2026-07-05)

Phases 1–3 of the ADR 007 pivot are in the codebase (see the ADR for the full model):
- **Shared:** `TURNOS_FEE_FIXED_EUR = 3`, `SUBSCRIPTION_TIERS` (Starter €45 / Pro €99), `PaymentMethod` + labels, `calculateTSU()` without worker fee, `SubscriptionTier` now `NONE|STARTER|PRO`
- **API payments:** `recordShiftFeeOnCheckout()` replaces wage charge/payout — €3 (€2 Pro) Stripe InvoiceItem per completed shift, aggregated on the monthly subscription invoice; cancellation fee 10% / ≤24h window, no worker share; `PaymentType.SHIFT_FEE` (old types legacy); worker earnings endpoint informative (turnosFees always 0)
- **Worker reliability:** `POST /shifts/:id/cancel-assignment` (>24h free; ≤24h strike, 2 strikes/30d = 7-day suspension via `Worker.lateCancellations`/`suspendedUntil`); no-show → auto 1★ rating + 30-day suspension, 2nd no-show → `Worker.isBlocked` permanent; both enforced at apply stage
- **paymentMethod on Shift** (required at publish): selector in web-admin new-shift, chips on mobile feed/detail replacing "Recebe amanhã"
- **Copy sweep:** all T+1/"Recebe amanhã"/Stripe-payout claims removed (landing, login, scan, earnings, recibo-verde, mail); billing page €45 Starter + Pro teaser; sidebar reordered worker-search-first; "Cancelar turno" button on confirmed cards in mobile my-shifts
- **Phase 4 implemented (2026-07-06):** `WagePayment` entity + `WagePaymentsService` — Turnos Pay Link (Stripe Checkout **direct charge on the worker's Connect account**, grossed-up so the company absorbs the processing fee; Turnos never holds wages); trust loop (employer `POST /payments/wages/:id/mark-paid`, worker `confirm-received`/`not-received` with "Recebi/Não recebi" chips in mobile my-shifts, DISPUTED → ops email); unpaid reminder ladder via BullMQ `wage-reminders` queue (+8h/+24h/+48h warning/+72h posting blocked in `assertCanPostShift`); 3-tier company cancellation (>24h free · 24h–3h `Employer.lateCancellationCount` · <3h reason modal required — ERRO_EMPRESA → 2h-min WagePayment + €3 fee, justified categories → ops review email); worker late-cancel justification (Doença/Emergência alert → ops email); pending-wages strip + cancel-reason modal in web-admin shifts page; `COMPANY_CANCEL_REASONS`/`WORKER_CANCEL_REASONS` in shared; webhook handles `checkout.session.completed` (needs **Connect webhook endpoint** in Stripe Dashboard + `STRIPE_CONNECT_WEBHOOK_SECRET`, plus `WEB_ADMIN_URL` env)
- **Pay Link activation card (2026-07-06):** worker Stripe Connect onboarding from mobile earnings screen (3 states: ativar / continuar / verificação em curso → ✅ ativo); `GET /payments/worker/connect/status`; public `GET /payments/connect/return` https bounce page (Stripe requires https return URLs) deep-linking back via `turnos://earnings`
- **Check-in-only attendance (ADR 008, 2026-07-14, commit 18c84f3):** check-out scan removed — single check-in QR; shifts auto-complete at exactly the scheduled end (BullMQ `shift-autocomplete` job at check-in + 15-min sweep) running the full fee/wage/review chain; two-way review prompts at T (worker push `rate_employer` + employer email CTA) and +8h follow-up only to unrated sides (30-min email gone); guardrails `POST /payments/wages/:id/adjust-hours` (2h floor, regenerates Pay Link) + `/report-problem` (UNDER_REVIEW pauses reminder ladder) with modal UI in web-admin pending-wages strip; `ShiftAttendance.autoCompleted`; manual confirm kept as fallback
- **Pay Link hardening — tranches A/C/E (2026-07-29):**
  - **A — gross-up correctness:** `STRIPE_FEE_PCT` 1.5% → **2.8%** (EEA premium/commercial card). The old 1.5% under-collected on corporate cards and the *worker* absorbed the gap (€100 wage → worker netted €98.68). Worst-case gross-up means the worker is never short; any surplus goes to the worker, never Turnos. Single `grossUp()` helper replaces the two inline formulas. Webhook now reconciles: `markPaidFromWebhook(sessionId, connectedAccountId)` reads `balance_transaction` via `event.account`, stores `WagePayment.stripeFeeActual` / `netReceived`, and emails ops on any shortfall (residual non-EEA-card case a gross-up can't cover).
  - **C — MB WAY in the Pay Link:** `PAY_LINK_CAPABILITIES` = `transfers` + **`card_payments`** + **`mb_way_payments`**, requested at account creation *and* re-requested on existing accounts (older accounts only had `transfers` — direct charges need `card_payments`). `GET /payments/worker/connect/status` now returns `cardEnabled` / `mbWayEnabled`; mobile earnings card surfaces it. Checkout stays on dynamic payment methods, so MB WAY appears automatically for EUR/PT payers (1.5% + €0.25, ≤€5,000/txn).
  - **E — evidenced manual payments + cash retired:** `PaymentMethod` drops `NUMERARIO` (historical rows render via new `LEGACY_PAYMENT_METHOD_LABELS` / `paymentMethodLabel()`). `POST /payments/wages/:id/mark-paid` is now **multipart** — optional `proof` file (image/PDF, 10 MB) or a required `noProofReason`; stored on `WagePayment.paymentProofUrl` / `paymentProofNote`. `getEmployerPending` returns `workerName` / `workerIban` / `paymentReference` (IBAN withheld on Pay Link rows) so the company can actually make the transfer. `StorageService.upload()` generalizes `uploadPhoto` for PDFs. Web-admin: `MarkPaidModal` replaces the bare `confirm()`; `request()` skips the JSON Content-Type for FormData. Mobile: worker sees "📎 Ver comprovativo" before confirming.
  - **IBAN sharing consent (GDPR, 2026-07-29):** `Worker.ibanShareConsentAt` (timestamp, not boolean — consent needs a date to be evidenced). Unticked checkbox next to the IBAN field in **both** mobile onboarding and edit-profile, only rendered when an IBAN is present; revocable any time in the profile with immediate effect. Accepted via `ibanShareConsent` on `POST`/`PATCH /auth/worker/profile`, returned in `GET /auth/me`. **`getEmployerPending` releases `workerIban` only when consent exists**, otherwise sets `workerIbanWithheld: true` and the dashboard tells the company to use the Pay Link — the gate is server-side, the checkbox is not decorative. Also fixed a stale pre-pivot T+1 claim in onboarding ("depositado no dia seguinte ao turno").
  - **B — legal brief v2** (`docs/legal/pay-link-legal-brief.md`): fixes the stale check-out description (ADR 008), documents the €0 Pay Link cut, the gross-up policy, and — new — a "Poderes contratuais" table disclosing the enforcement ladder. Three new attorney questions: enforcement-as-control risk, Connect platform chargeback liability, IBAN-disclosure legal basis. **Still unsigned.**
  - **Not done (deliberately):** tranche D (Multibanco reference for corporates) — revisit when a real corporate asks; needs a `PROCESSING` status since voucher confirmation lags days.
- **Competitive benchmark — Shifty (ES), 2026-07-29:** `docs/competitive/shifty-benchmark.md`. Direct analogue in Spain, opposite legal bet: Shifty is a **registered placement agency** (RD 1796/2010) + partner-ETT module, which is what lets them charge **20–25% of gross salary**; Turnos deliberately isn't (ADR 007). Cost crossover is **4 shifts/month** — below it Shifty's zero-floor free tier wins, above it Turnos is up to 3× cheaper and the gap compounds. Biggest product gaps: **waiting list** (auto-promote on cancel) and **reconfirmation** (24h out, auto-cancel at 12h) — the machinery behind their "98% filled / <5% no-show" claims. Also missing: recurring shifts, worker blocking, permission roles, multi-location, chat, conversion fee, SEO engine. Turnos ahead on compliance engine, wage-payment enforcement, single-scan attendance, wage-neutral fee. **Actionable:** PT's DL 260/2009 as amended by Lei 5/2014 dropped licensing for placement agencies to a *mera comunicação prévia* to IEFP — cheap optionality, but may contradict ADR 007; added as a question for the attorney. Video+24h verification recommendation: **optional video unlocking a badge**, framed as language verification, not a mandatory gate (discrimination/GDPR exposure).
- **Demo feature batch — multi-day, CV, availability, experiences, calendar (2026-08-04):**
  - **Multi-day jobs (biggest change).** A multi-day job is **N single-day `Shift` rows sharing `Shift.seriesId`** (+ `seriesDayIndex`/`seriesTotalDays`), *not* one shift with many dates — check-in, attendance, MCD day counting and auto-completion are already per-day and needed no changes. What is **series-level**: the **€3 fee (per JOB, not per day)**, the **wage payment / Pay Link (one payment, at the end of the series)**, the **plan quota** (`assertCanPostShift` counts `DISTINCT COALESCE(seriesId, id)`), and the review/Recibo Verde prompts — all resolved on the last worked day via `AttendanceService.resolveSeriesSettlement()` → `settleJob()`. `search()`, `findByEmployer()` and `findWorkerApplications()` collapse a series to one entry carrying `seriesDates[]`. Applying is **all-or-nothing** (applications created for every OPEN day, compliance run per day). Once a series has **started** (first check-in) the worker **cannot cancel** it — server throws in `workerCancelAssignment`, the app replaces the button with "Contactar suporte" (`shift.seriesStarted` flag). A mid-series **no-show** releases the remaining days back to OPEN (`RatingsService.releaseRemainingSeriesDays`); the days already worked are settled by the new `settleStrandedSeries()` pass in the 15-min sweep. **MCD fix:** `checkApplicationEligibility(worker, shift, daysBeingAdded)` — the 70-day cap is now measured against the whole series, since per-day checks would have let a 5-day job cross it in one apply.
  - **CV upload:** `Worker.cvUrl/cvFileName/cvUploadedAt`; `POST`/`DELETE /auth/worker/cv` (PDF/DOC/DOCX, 10 MB); `StorageService.extFor()` maps document MIME types properly. Worth **10 pts**, with **photo 20→15 and skills 20→15** so the total stays 100 — a complete profile without a CV still scores 90, deliberately above the 80-point apply gate. All scoring call sites collapsed into one `UsersService.rescoreWorker()`; `refreshWorkerScoreIfStale()` runs on `GET /auth/me` so pre-existing workers converge without a migration.
  - **Availability — one concept, not two.** `Worker.isAvailableForWork` (default **true**) is the master switch; the existing `availableDays` is the detail of *when*. Deliberately **not** part of the profile score — switching off is a normal state, not an incomplete profile. Mobile shows a switch (saves immediately, optimistic) with the day chips under it; web-admin has a "🟢 Disponíveis" filter (`availableNow=true`) that ANDs with the day chips.
  - **Experiences:** `Worker.experiences` jsonb `[{jobTitle, level}]`, levels `NONE|ZERO_ONE|ONE_FIVE|FIVE_PLUS`. `JOB_TITLES` in shared is **the same list as `ALL_SKILLS`** (derived from `SHIFT_CATEGORIES`), so experience, worker skills and posted shifts always use identical strings. Shown to employers in workers-search *and* the applicant profile panel.
  - **Job titles — additive only, no renames** (renaming would orphan stored `worker.skills`/`shift.subcategory` strings): added `Rececionista` (generic) and `Lavador/a de loiça`, plus a new **`Serviços e Manutenção`** category (`Empregado/a de limpeza`, `Técnico/a de manutenção`, `Segurança/Vigilante`).
  - **Calendar sync:** `expo-calendar` via `apps/mobile/lib/calendar.ts` — **one event per day** (never one block spanning the range), event ids stored in SecureStore per shift so re-tapping updates instead of duplicating; alarms at **1 day** and **2 h** before; notes carry role, hours, rate, payment method and a `turnos://shift/{id}` deep link.
  - **New mobile UI:** "Próximo turno" hero card in my-shifts; multi-day commitment banner + "Período do trabalho" card with **List/Calendar** toggle (`components/ShiftSchedule.tsx`, custom month grid, no new dependency); "X dias" chips in the feed and my-shifts.
  - **New native deps** — `expo-document-picker`, `expo-calendar` (+ `READ/WRITE_CALENDAR` and the calendar permission string in `app.json`): **CV upload and calendar sync need a new EAS preview build**; everything else runs on the current APK.
- **€3 fee decision deferred (2026-07-14):** Juanes may replace the per-shift fee with quota-based tiers (N shifts included per plan) — decide after beta usage data; do NOT remove fee code; beta waiver flag is the likely first step
- **Still pending (ops/config):** €45 Stripe price + `STRIPE_SUBSCRIPTION_PRICE_ID` update in Railway (Connect webhook + `STRIPE_CONNECT_WEBHOOK_SECRET` + `WEB_ADMIN_URL` done 2026-07-06); attorney written sign-off on the Pay Link structure (brief at `docs/legal/pay-link-legal-brief.md`); pre-shift consequence-reminder push (policy states it; not yet scheduled in code); mobile has 104 pre-existing tsc errors (LinearGradient/design-token typings — cosmetic, Metro unaffected)

### Stint 8 — Phase 1 In Progress (as of 2026-06-09)

**Stint 8 Phase 1 — UX & Trust Layer:**
- **Bug fixes:** Profile photo not loading (API_URL env + useStaticAssets in main.ts); `avgRating.toFixed` crash (Number() wrap); notification subscription cleanup
- **Two-way ratings:** `POST /ratings/employer` (WORKER role) — worker rates employer; `direction: WORKER_TO_EMPLOYER`; **internal only** (never shown to workers/employers, Turnos insight only). Employer written `review` field (VARCHAR 150) on Rating entity — shown to other employers, not mandatory. `raterName` in `recentRatings` response.
- **Rating entity refactored:** `direction: RatingDirection` enum; `rateeWorker` + `rateeEmployer` relations (instead of single `ratee`); unique index on `(shift, rater, direction)`
- **Rating reputation fix:** `recalculateWorkerReputation()` switched from broken TypeORM `find({select})` to `QueryBuilder` AVG aggregate — eliminates silent failures
- **Skills aligned:** `ALL_SKILLS` constant in shared (auto-derived from `SHIFT_CATEGORIES` subcategories) — worker skills now match employer job subcategories exactly. `edit-profile.tsx` updated to use `ALL_SKILLS`
- **Languages separated:** `LANGUAGES` constant (12 languages) + `Language` type in shared; `languages: string[]` on Worker entity; separate **Idiomas** chip section in edit-profile; returned in `GET /auth/me`
- **Barista in Restauração:** Added to Restauração category (was only in Hotelaria)
- **Worker bio:** `bio: VARCHAR(200)` on Worker entity; multiline TextInput in edit-profile with char counter; returned in `GET /auth/me`; passed through `PATCH /auth/worker/profile`
- **Cover note on apply:** `coverNote: VARCHAR(200)` on `shift_applications`; optional field in `POST /shifts/:id/apply`; server-side 200-char enforcement
- **Worker acceptance flow:** New `PENDING_ACCEPTANCE` status in `shifts_status_enum`; employer selects → `PENDING_ACCEPTANCE` → push notification to worker (2h window); `POST /shifts/:id/confirm` → `FILLED` + compliance; `POST /shifts/:id/decline` → `OPEN` + employer notified; BullMQ `acceptance-timeout` job (2h)
- **Static file serving:** `useStaticAssets('/uploads')` wired in `main.ts` for dev photo serving

**Code Quality Cleanup (Stint 8, session 2026-06-09):**
- **Rate bug fixed:** `apps/mobile/app/rate/[id].tsx` was calling `POST /ratings` (EMPLOYER-only) — changed to `ratingsApi.rateEmployer()` → `POST /ratings/employer` (WORKER role). Removed `selectedTags`/`comment` state, stale 17-line doc comment, dead StyleSheet entries, and `TextInput`/`WORKER_RATING_TAGS` imports (backend `forbidNonWhitelisted` would have 400'd anyway).
- **Web-admin dedup:** `apps/web-admin/lib/format.ts` — single `formatDate`/`formatEuro` source. `apps/web-admin/lib/nav.ts` — single `SIDEBAR_NAV` source (8 items + "Definições soon"). `workers-search/page.tsx` uses both; local SIDEBAR_NAV and local ALL_SKILLS recomputation removed. `ratings/page.tsx` now imports `WORKER_RATING_TAGS` from shared instead of local copy.
- **Mobile dedup:** `apps/mobile/lib/format.ts` — single `formatDate(dateStr, monthFormat)` source (handles 'short'/'long', 'Hoje'/'Amanhã' smart labels). `index.tsx`, `my-shifts.tsx`, `shift/[id].tsx` all use it.

**Pending in Phase 1:**
- Employer review display in worker detail — `ratings/page.tsx` has the *write* field but `recentRatings` with review text is not displayed anywhere in worker detail/search pages yet

**Confirmed done (verified 2026-06-09):**
- ✅ Accept/Decline UI in `my-shifts.tsx` — `PENDING_ACCEPTANCE` section with Aceitar/Recusar buttons wired to `shiftApi.confirm()` / `shiftApi.decline()`
- ✅ Cover note display in web-admin applicant list — `shifts/page.tsx` shows `💬 "{app.coverNote}"` inline on applicant rows
- ✅ Languages dropdown in shift creation — `new-shift/page.tsx` has full chip selector using `LANGUAGES` from shared, state `selectedLanguages`, sent as `languagesRequired` on submit

**Phase 2 (Planned):** Internal admin dashboard, user management, compliance monitoring, financial dashboard, analytics, dispute flag, payslip PDF, subscription tiers

**Known deferred (Stint 8/9):**
- Unused npm packages: `@reduxjs/toolkit`, `react-redux`, `react-query`, `expo-crypto` in mobile; `@stripe/react-stripe-js`, `@stripe/stripe-js` in web-admin
- Orphaned `app/dashboard/ratings/page.tsx` — built but no sidebar link yet
- `createGoogleEmployer` bug: creates `User` row but not `Employer` entity (needs product decision on company-details onboarding flow for Google OAuth employers)
- Frontend blanket 401 → logout masking (real auth errors shown as "session expired")

### Stint 7 — Complete (as of 2026-05-29)

**Stint 7 — Ratings, Reputation & Trust:**
- `RatingsModule` — `Rating`, `NoShowFlag`, `FavouriteWorker` entities; `RatingsService`, `RatingsController`, `RatingsModule`
- One-way ratings: employer rates worker (worker-rates-employer deferred to Stint 8)
- `recalculateWorkerReputation()` — updates `avgRating`, `totalRatings`, `reputationScore` (= avgRating × 20) after each rating
- Badge auto-award: `TOP_RATED` (avg ≥ 4.5 & ≥10 ratings), `RELIABLE` (0 no-shows & ≥90% completion & ≥20 ratings), `VERIFIED` (ACTIVE status)
- No-show reporting: `POST /ratings/no-show/:shiftId` — increments noShowCount; 3 flags in 60 days triggers admin review email
- BullMQ `rating-reminder` delayed job (30 min post-completion) — email to employer: "Avalie o trabalhador 🌟"
- Notification priority: favourites → TOP_RATED → everyone else (ORDER BY CASE in QueryBuilder, same batch)
- Favourite Workers: `FavouriteWorker` entity + GET/POST/DELETE `/ratings/favourites/:workerId`
- `ReNotificationJobData` updated to include `employerId`; `notifyMatchingWorkers()` now accepts `employerId` for priority sort
- Worker entity: 4 new columns — `avgRating`, `totalRatings`, `noShowCount`, `badges` (simple-array)
- Shared package: `WorkerBadge` type, `WorkerRatingSummary` interface, `WORKER_RATING_TAGS`, `BADGE_THRESHOLDS`
- Mobile: `rate/[id].tsx` — star selector, tag chips, comment, "already rated" banner; `my-shifts.tsx` — "⭐ Avaliar" / "✓ Avaliado" CTAs on completed cards
- Web-admin: `ratings/page.tsx` — worker cards with avg rating, badges, no-show count, inline rating modal, no-show modal; "Reputação" added to sidebar
- Web-admin `workers/page.tsx` — star rating + badges displayed on each worker card
- **Scope decisions:** One-way only (worker-rates-employer = Stint 8); dispute flag deferred to Stint 8; favourites use priority placement (no 30-min private window)

### Stint 6 — Complete (as of 2026-05-29)

**Stint 6 — Payments & Payroll:**
- `PaymentsModule` / `PaymentsService` / `PaymentsController` — full NestJS module
- Stripe Connect Express: worker onboarding (`POST /payments/worker/connect`), Stripe dashboard link
- Employer setup: SetupIntent flow → save card → `stripeCustomerId` on Employer entity
- Subscription billing: `POST /payments/employer/subscribe` → €55/mo via `STRIPE_SUBSCRIPTION_PRICE_ID`; cancel endpoint also wired
- `assertCanPostShift()` guard called in `ShiftsService.create()` — blocks shift creation if no active subscription
- Pay-per-shift: `chargeShiftAndPayout()` fires on `onShiftCompleted()` — charges employer, transfers net to worker's Connect account
- TSU calculation via `calculateTSU()` from shared: `employerContribution` (23.75%) + `turnosFee` (10%) + `workerDeduction` (11%)
- Cancellation fee (≤12h before shift start if FILLED): 15% of gross — 11% Turnos + 4% worker compensation; fire-and-forget non-blocking
- `PaymentRecord` entity: tracks all payments (SHIFT_CHARGE, WORKER_PAYOUT, CANCELLATION_FEE, WORKER_COMPENSATION, SUBSCRIPTION)
- Stripe webhook (`POST /payments/webhook`): `rawBody: true` in NestJS bootstrap; handles `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`
- Local dev webhook: `stripe listen --api-key sk_test_... --forward-to localhost:3001/api/payments/webhook`; production uses Stripe Dashboard `whsec_`
- Employer spending dashboard: `GET /payments/employer/spending?period=month|year` — KPI cards, per-shift table, CSV export, monthly bar chart
- Worker earnings dashboard: `GET /payments/worker/earnings` — mobile `earnings.tsx` screen with period toggle, SS reminder banner in Mar/Jun/Sep/Dec
- Quarterly SS reminder: BullMQ `quarterly-ss` queue, cron `0 9 1 3,6,9,12 *` — push to all ACTIVE workers
- Web-admin sidebar: `/dashboard/billing` and `/dashboard/spending` pages added
- `"Ver Ganhos"` CTA added to mobile `profile.tsx` → navigates to `/earnings`
- Stripe CLI skills installed: `stripe-best-practices`, `stripe-projects`, `upgrade-stripe`
- **Adjusted from plan:** Single subscription tier at €55/mo (not 3 tiers). Payslip PDF generation deferred post-MVP.

### Stints 3, 4, 5 — Complete (as of 2026-05-29)

**Stint 3 — Notifications & Real-Time Updates:**
- Socket.IO gateway with JWT-authenticated rooms (`employer:{id}`, `worker:{id}`)
- Expo push notifications to top-20 skill-matched workers on shift publish
- BullMQ re-notification wave after 5h if 0 applicants
- WebSocket live updates: employer applicant list, worker status change
- Socket connect wired at `verify.tsx` OTP success; disconnect on logout (`profile.tsx`)
- Web-admin `dashboard/layout.tsx` connects socket once for all dashboard routes
- Foreground push handler in `_layout.tsx` — banner, sound, navigation on tap
- Push tap routing: `new_shift` → `/shift/:id`, `recibo_verde` → `/recibo-verde`

**Stint 4 — Portugal Compliance Engine:**
- MCD Contract auto-generated on shift approval (`onShiftApproved()`)
- SS Direta: BullMQ `ss-direta` queue → email to accountant 24h before shift (beta substitute for SS API)
- `calculateTSU()` from shared — employer 23.75% + Turnos 10% fee + worker 11% SS breakdown
- Economic dependency: 40% flag / 50% hard block per worker/employer pair
- MCD 70-day annual limit hard block at application stage
- Rest period 11h enforcement at application stage
- Recibo Verde: BullMQ `recibo-verde` queue → Expo push reminders day+3 and day+5 post-checkout
- Mobile `/recibo-verde` screen with pre-filled values + Portal das Finanças CTA
- `ComplianceAuditLog` immutable event trail (9 event types)
- Web-admin `/dashboard/compliance` — TSU report, MCD contracts, ACT audit log tabs
- **Adjusted from plan:** PDF generation + DocuSign deferred post-MVP; email-to-accountant is beta substitute

**Stint 5 — QR Check-In / Check-Out:**
- Static HMAC-SHA256 QR tokens (permanent per employer — changed from rotating 30s QR)
- Two QR codes per employer: check-in (↑) and check-out (↓)
- `expo-camera` scan flow in mobile `/scan` with geofence (200m Haversine)
- Time windows: check-in ±30–60 min, check-out ±30 min – 2h
- Shift → ACTIVE on check-in; COMPLETED on check-out; WebSocket push to both parties
- Payment always calculated from `scheduledHours` (not scan timestamps)
- Manual employer override (`manualConfirm`) with audit log
- `onShiftCompleted()` wired to Recibo Verde BullMQ scheduler

### Stint 2 — Complete (as of 2026-05-25)

**All delivered:**
- Shift creation (web admin) — category, location (geocoded), date/time, hourly rate, required skills, slots
- Shift management — edit, cancel, list view with status badges
- Employer dashboard KPIs wired to real API (active/open/filled shift counts)
- Worker shift feed (mobile) — list + map view, proximity sort via PostGIS
- Shift detail page (mobile) — gross rate, employer info, ETA, one-tap apply
- Worker applications — apply/withdraw, My Shifts screen (5 sections incl. Em curso / Concluídos)
- Employer applicant review — view applicants per shift, approve one
- Public shift browsing — `GET /shifts/search` and `GET /shifts/:id` are public (no JWT required)
- API prefix fix (`/api` global prefix wired in both clients)
- `.env.example` files added for both web-admin and mobile

### Stint 1 — Complete (as of 2026-05-24)

**All delivered:**
- OTP send/verify flow (Twilio + mock fallback `123456`)
- Employer registration API (NIPC/NIF validation, hashed password) + email verification link
- Employer login API (email + password) — web-admin login wired to real API
- JWT + refresh token rotation backed by **Redis** (7-day TTL, `refresh:{userId}` keys)
- Worker profile submission API (NIF, IBAN, skills, availability) wired in mobile onboarding
- Rule-based Profile Quality Score (photo +20, NIF +20, IBAN +20, ≥3 skills +20, name +10, availability +10)
- Mobile screens: login, verify OTP, 4-step onboarding wizard — all **wired to real API** with SecureStore JWT storage
- Photo upload: expo-image-picker on mobile → `POST /auth/worker/photo` → local disk (dev) / Cloudflare R2 (prod)
- Google OAuth2: client-side flow via expo-auth-session → `POST /auth/google/verify-token` (marked "Em breve" on mobile until `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is set)
- Email verification: nodemailer (mock when `MAIL_HOST` unset) → `GET /auth/verify-email/:token`
- Admin worker approval workflow UI (`/dashboard/workers`) — approve / reject with reason modal, grid layout
- Rate limiting: 60 req/min global, 5/min OTP send, 10/min OTP verify + employer login
- DB entities: `users`, `workers`, `employers`; User entity extended with `googleId`, `emailVerified`, `emailVerificationToken`
- Shared types and Portuguese validation utilities

**Intentionally deferred (requires paid third-party):**
- ID verification (Onfido/Veriff) — admin manual review queue serves as beta substitute
- AI Profile Interview — deferred; Profile Quality Score serves as quality filter

---

## Key Architecture Patterns

**Worker status machine:** `INCOMPLETE → PENDING_REVIEW → ACTIVE → SUSPENDED / REJECTED`  
A worker must score ≥80 on Profile Quality Score to enter `PENDING_REVIEW`.

**Multi-day jobs:** N single-day `Shift` rows sharing `seriesId`. Per-day machinery (check-in, attendance, MCD days, auto-completion) is unchanged; the fee, the wage payment, the plan quota and the review prompts are **per job** and resolve on the last worked day. See the 2026-08-04 entry under Stint 8.

**Auth flow:**
1. Worker: phone → Twilio OTP → JWT tokens
2. Employer: email/password registration → JWT tokens
3. Admin: TBD (no admin auth yet)

**API response shape:** All responses use `ApiResponse<T>` wrapper from shared package.

**Shift status machine:** `DRAFT → OPEN → FILLED → ACTIVE → COMPLETED → CANCELLED`

---

## Portugal Compliance — Critical Requirements

These are non-negotiable and must be correct before launch:

- **MCD limits:** Max 35 days per contract, max 70 days/year with same employer. Hard-block at **application stage** (worker cannot apply if limit reached).
- **SS Direta notification:** Must be submitted ≤24h before shift start. BullMQ retry queue required.
- **TSU rates:** Employer 23.75% / Worker 11% of gross — **informative only** since the 2026-07 pivot: Turnos calculates and displays these values but never withholds or routes them; the company settles wages and SS directly. Always use `calculateTSU()` from shared. Never use language like "processamos/garantimos o pagamento".
- **Turnos fee:** fixed €3 per completed shift, charged to the **company** (Stripe InvoiceItem → monthly invoice). Workers pay nothing. See `TURNOS_FEE_FIXED_EUR` in shared.
- **Rest periods:** Minimum 11h between shifts for same worker (EU Working Time Directive).
- **False Recibos Verdes:** Monitor economic dependency per worker. Flag at 40%, block at 50%.
- **Gross Hourly Value** must be displayed on every shift card (Agenda do Trabalho Digno requirement).

---

## Key Decisions (All Locked — See `docs/adr/`)

1. **MCD contracts only** for v1 (Recibos Verdes deferred to Phase 2)
2. **Lisbon beta** first, Porto after fill rate >70% and NPS >50
3. **Revenue (superseded by ADR 007, 2026-07):** company subscription (€45 Starter / €99 Pro planned) + fixed €3 company-side fee per completed shift. Workers pay nothing.
4. **Payment (superseded by ADR 007; amended 2026-07-29):** company pays the worker **directly** (Pay Link / transferência / MB WAY, chosen at publish — cash retired); Turnos never holds wages, takes **no cut of the Pay Link charge**, and only invoices its own fees monthly.
5. **Worker payout (superseded by ADR 007):** full gross direct from company; Stripe Connect kept optional for the Pay Link rail.
6. **MVP scope:** Stints 0–5 = v1 launch target (Payments in v1.1)
7. **Marketplace model:** Workers browse and apply, employers review and confirm. Push notifications target workers by skill match. No auto-assignment. See `docs/turnos_roadmap.md` for full model.
8. **QR model (amended by ADR 008, 2026-07-14):** Static HMAC-SHA256 token (permanent per employer) — **single check-in QR only**. The worker scans on arrival; the shift **auto-completes at its scheduled end** (BullMQ job at check-in + 15-min sweep). No check-out scan. Auto-completion triggers the fee/wage/review chain; employer can "Ajustar horas" (2h floor, regenerates Pay Link) or "Reportar problema" (pauses reminders, ops review) before paying. Two-way review prompts fire at completion and +8h.

---

## TypeORM Note

`synchronize: true` is set in dev — TypeORM auto-creates/alters tables from entities. Never enable this in production; use migrations instead.

# Turnos App — Technical Roadmap
### Blueprint: Student Pop → Adapted for Portugal's "Work Today. Staff Today." Model

---

## 1. Strategic Architecture Overview

### Student Pop Blueprint → Turnos Adaptation

| Dimension | Student Pop (FR) | Turnos App (PT) |
|---|---|---|
| **Workers** | Students, auto-entrepreneur status | Flexible workers, Recibos Verdes + MCD contracts |
| **Legal framework** | French auto-entrepreneur | Muito Curta Duração + Agenda Trabalho Digno |
| **Speed** | Hours/days to fill a shift | Hours/days to fill a shift *(faster if natural, not forced)* |
| **Matching** | Profile + Availability | Skill-based notifications → workers browse & apply → employer selects *(labour marketplace, not auto-assignment)* |
| **Check-in** | Manual / app confirmation | Static HMAC QR Code + Geofence verified |
| **Payments** | Monthly invoice cycle | Pay-per-shift post-completion → worker paid next business day |
| **Revenue model** | Commission on transactions | Hybrid: Company monthly subscription + % fee per transaction (from worker) |
| **Tax engine** | French TVA / URSSAF | TSU 23.75% (employer) + Recibo Verde reminders |

---

## 2. Technology Stack

### Frontend — React Native (Cross-Platform)
- **Framework:** React Native + Expo (managed workflow for fast iteration)
- **State Management:** React Query (server state) + local useState
- **Navigation:** Expo Router (file-based, replaces React Navigation v6)
- **Maps & Geo:** `react-native-maps` + PostGIS proximity queries via API
- **QR:** `expo-camera` + `expo-barcode-scanner`
- **Real-time:** Socket.IO client
- **UI System:** Custom StyleSheet Design System (`packages/shared` tokens)
- **Push Notifications:** Expo Push Notifications (expo-server-sdk)

### Backend — Node.js / NestJS
- **Framework:** NestJS (TypeScript, modular, enterprise-grade)
- **API Style:** REST + WebSocket (Socket.IO for real-time shifts)
- **Auth:** JWT (15m access / 7d refresh) + Redis-backed rotation, OAuth2 (Google Sign-In — marked "Em breve")
- **Queue:** BullMQ (Redis-backed) for async jobs (SS notifications, payslips, push re-notification, Recibo Verde reminders)
- **Scheduler:** `@nestjs/schedule` for compliance triggers

> **💡 Affordable Backend Hosting Options (by stage)**
>
> | Stage | Platform | Cost | Notes |
> |---|---|---|---|
> | **MVP / Prototyping** | [Railway.app](https://railway.app) | ~$5/mo | Easiest DX, git-push deploy, Postgres included |
> | **Beta (0→100 users)** | [Render.com](https://render.com) | Free → $7/mo | Free tier available, DB expires after 30 days on free |
> | **Scaling (100+)** | [Fly.io](https://fly.io) | ~$10–30/mo | EU regions available, great for NestJS containers |
> | **Production** | AWS ECS Fargate | Pay-as-you-go | Most powerful, steeper learning curve |
>
> **Recommendation for Turnos:** Start on **Railway** (cheapest, fastest setup), migrate to **Fly.io** at beta, and only move to **AWS** when you have real revenue and traffic to justify it.

### Database Layer
- **Primary DB:** PostgreSQL + PostGIS (geospatial queries for proximity matching)
- **Cache / Real-time:** Redis (shift availability, session tokens, BullMQ queues, push notification tracking)
- **Search:** Elasticsearch *(optional at MVP — defer until Stint 9)*
- **File Storage:** Cloudflare R2 (decided, wired for worker photos in prod; `local/` disk in dev)

### Infrastructure
- **Cloud:** Railway (MVP) → Fly.io (Beta) → AWS/GCP (Production)
- **CDN:** Cloudflare (free tier covers most MVP needs)
- **Containerization:** Docker + Docker Compose (dev), ECS/Kubernetes (prod)
- **CI/CD:** GitHub Actions (free for public repos, 2,000 min/mo free for private)
- **Monitoring:** Sentry free tier (errors) + Grafana Cloud free tier (metrics)
- **GDPR / Data Residency:** EU region mandatory (Frankfurt or Dublin)

### Third-Party Integrations
| Service | Purpose | Status |
|---|---|---|
| **Stripe Connect** | Split payments, employer billing, worker payouts | ✅ Stint 6 complete |
| **Segurança Social Direta API** | MCD contract submission (24h window) | ✅ Beta: accountant email via BullMQ |
| **Portal das Finanças** | Recibo Verde — deep-link from worker app | ✅ Stint 4/5 |
| **Twilio / Expo Push** | SMS OTP + Push notifications | ✅ Implemented |
| **Google Maps Platform** | Geolocation, proximity, ETA | ✅ PostGIS + react-native-maps |
| **Onfido / Veriff** | Worker ID verification (KYC) | ⬜ Deferred — admin review queue is beta substitute |
| **DocuSign EU** | Digital contract signing | ⬜ Deferred post-MVP |

---

## 3. Core Modules (Functional Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                        TURNOS PLATFORM                       │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Auth &      │  Shift       │  Matching    │  Compliance    │
│  Identity    │  Marketplace │  Engine      │  Engine        │
├──────────────┼──────────────┼──────────────┼────────────────┤
│  Payroll &   │  QR Check-   │  Rating &    │  Notifications │
│  TSU Engine  │  In/Out      │  Reputation  │  & Comms       │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

---

## 4. Portugal Compliance Engine (Critical Module)

### 4.1 Muito Curta Duração (MCD) Contract Rules
- Max **35 days** per contract per worker/employer
- Max **70 days/year** with the same employer
- No written contract required — but electronic notification to SS mandatory
- Notification window: **24h BEFORE** start (or 24h after in exceptional cases)
- System auto-blocks bookings that would exceed legal limits ✅ implemented

### 4.2 TSU Calculation Logic
```
Worker type: Employee (MCD)
  → Employer contribution: 23.75% of gross wage
  → Worker deduction: 11% of gross wage (worker pays this to state via SS Direta themselves)
  → Turnos fee: 10% of gross (deducted from what Turnos pays to worker)
  → Net displayed to worker = Gross × 0.90 (after Turnos fee)
  → Employer cost = Gross × (1 + 0.2375)
  → calculateTSU() in packages/shared is the single source of truth
```

### 4.3 Agenda do Trabalho Digno Compliance Checklist
- [x] No false Recibos Verdes: monitor economic dependency per worker (40% flag / 50% hard block)
- [x] Display Gross Hourly Value on all shift cards
- [x] Auto-flag workers approaching 50% dependency threshold
- [x] Generate audit trail for ACT (Autoridade para as Condições do Trabalho)
- [x] Enforce rest periods between shifts (minimum 11h per EU Working Time Directive)

### 4.4 Recibo Verde Module ✅ Implemented (Stint 4/5 close-out)
- Worker checks out → `onShiftCompleted()` schedules BullMQ jobs (day+3, day+5)
- Push notifications remind worker to submit Recibo Verde via Portal das Finanças
- Mobile screen `/recibo-verde` with pre-filled values, step-by-step guide, and Portal link
- Audit log entry `RECIBO_VERDE_REMINDER_SENT` on each push sent

---

## 5. Sprint Roadmap (Stints)

> **Stint duration:** 2–3 weeks each. Adjust/delete/add features as we go.

---

### ✅ STINT 0 — Foundation & Setup *(Complete)*
**Goal:** Dev environment, architecture scaffolding, CI/CD pipeline

- [x] Monorepo setup (Turborepo: `apps/mobile`, `apps/web-admin`, `apps/api`, `packages/shared`)
- [x] NestJS API project init (TypeScript, ESLint, Prettier)
- [x] React Native + Expo project init (managed workflow, Expo Router)
- [x] PostgreSQL + PostGIS setup (Docker Compose)
- [x] Redis setup (Docker Compose)
- [x] GitHub Actions CI pipeline (lint, test, build)
- [x] Environment config system (`.env` per environment, `.env.example` for all apps)
- [x] Basic project documentation (README, ADR folder, CLAUDE.md)

---

### ✅ STINT 1 — Auth & Identity *(Complete)*
**Goal:** Both worker and employer can register, verify and log in

**Worker side:**
- [x] Phone number registration + SMS OTP (Twilio + mock fallback `123456`)
- [x] Google Sign-In (OAuth2 — expo-auth-session wired; marked "Em breve" on mobile until `EXPO_PUBLIC_GOOGLE_CLIENT_ID` configured)
- [x] Profile creation (name, NIF, IBAN, photo, skills, available days) — 4-step onboarding wizard
- [x] NIF validation (shared package `isValidNIF`) + IBAN validation (`isValidIBAN`)
- [x] Photo upload: expo-image-picker → `POST /auth/worker/photo` → local disk (dev) / Cloudflare R2 (prod)
- [x] Profile Quality Score rule engine (photo +20, NIF +20, IBAN +20, ≥3 skills +20, name +10, availability +10)
- [ ] AI Profile Interview (video or async) — **Deferred: not implemented. Quality score substitutes as filter.**
- [ ] ID verification (Onfido/Veriff) — **Deferred: admin manual approval queue is the beta substitute**

**Employer side:**
- [x] Company registration (NIPC, NIF, address, sector — `isValidNIPC` validation)
- [x] Admin dashboard login (web — email + password)
- [x] Role-based access control (`EMPLOYER` / `WORKER` / `ADMIN` roles via JWT guards)

**Infrastructure:**
- [x] JWT + Refresh Token auth service (15m access / 7d refresh, Redis-backed rotation)
- [x] User Service + Worker Service + Employer Service (NestJS modules)
- [x] Email verification service (nodemailer; mock when `MAIL_HOST` unset)
- [x] Rate limiting: 60 req/min global, 5/min OTP send, 10/min OTP verify + employer login
- [x] DB entities: `users`, `workers`, `employers` with full TypeORM mappings
- [x] Admin worker approval UI (`/dashboard/workers`) — approve/reject with reason modal

---

### ✅ STINT 2 — Shift Marketplace Core *(Complete)*
**Goal:** Employers can post shifts; workers can see and apply

**Employer (Web Dashboard):**
- [x] Post a shift (date, time, location geocoded, role, hourly rate, required skills, slots)
- [x] Gross Hourly Value displayed + employer total cost visible
- [x] Shift management (edit, cancel, list view with status badges)
- [x] Dashboard KPIs wired to real API (active/open/filled shift counts)
- [x] Applicant review panel (view applicants per shift, approve one worker)
- [ ] Worker shortlist / invite — **Deferred to Stint 9 (Repeat Hire / Favourite Workers)**

**Worker (Mobile App):**
- [x] Shift feed (list + map view with react-native-maps)
- [x] Proximity-based sorting (PostGIS `ST_DWithin` radius query)
- [x] Shift detail page (gross rate, employer info, ETA, one-tap apply)
- [x] Apply / withdraw flow
- [x] My Shifts screen (5 sections: Em curso, Confirmados, Pendentes, Concluídos, Histórico)
- [x] Profile screen (score bar, skills, availability, masked NIF/IBAN, logout)

**Backend:**
- [x] Shift Service (CRUD + status machine: `DRAFT → OPEN → FILLED → ACTIVE → COMPLETED → CANCELLED`)
- [x] PostGIS geo-query for radius search (`GET /shifts/search?lat=&lng=&radius=`)
- [x] Public shift browsing (`GET /shifts/search` + `GET /shifts/:id` require no JWT)
- [x] Application lifecycle (apply, withdraw, approve — one worker per shift)
- [x] API global prefix `/api` correctly wired in all clients

---

### ✅ STINT 3 — Notifications & Real-Time Updates *(Complete — as of 2026-05-29)*
**Goal:** Notify the right workers when a shift is posted. Employer and worker see live status changes without refreshing.

**How the marketplace flow works:**
```
Employer posts shift (OPEN)
  → System identifies top-N workers with matching skills (profileQualityScore DESC)
  → Expo push notification sent: "Novo turno disponível! 🎯"
  → Workers browse feed, read detail, tap Apply
  → Employer reviews applicants list (updates live via Socket.IO)
  → Employer confirms one worker (shift → FILLED)
  → Worker receives real-time Socket.IO event: "Foste selecionado!"
  → If 0 applicants after 5 hours → BullMQ re-notification job sends next batch
```

**Skill-based notification targeting:**
- [x] Query workers whose skills overlap with shift requirements (LIKE filter on `skills` column)
- [x] Rank eligible workers by Profile Quality Score (DESC)
- [x] Send Expo push to top-20 workers via `expo-server-sdk`
- [x] Re-notification BullMQ job: if 0 applications after 5h, notify next batch (offset +20)
- [x] `expoPushToken` stored on Worker entity; `savePushToken` endpoint in auth module

**WebSocket real-time (Socket.IO):**
- [x] WebSocket gateway on NestJS API (`ShiftsGateway`)
- [x] JWT-authenticated rooms: `employer:{id}` and `worker:{id}`
- [x] Events: `shift:new_application`, `shift:status_changed`, `shift:cancelled`, `attendance:update`
- [x] Employer dashboard: applicant list updates live (no page refresh)
- [x] Worker mobile: status update pushed live when selected or rejected
- [x] Socket connect at OTP verify success in mobile (`verify.tsx`) — uses JWT access token
- [x] Socket disconnect on logout (`profile.tsx`)
- [x] Web-admin: `dashboard/layout.tsx` connects socket once for all `/dashboard/*` routes

**Foreground push notification handler:**
- [x] `Notifications.setNotificationHandler` in `_layout.tsx` (banner + sound while app is open)
- [x] `addNotificationReceivedListener` + `addNotificationResponseReceivedListener` in `RootLayout`
- [x] Notification tap: navigates to `/shift/:id` (new_shift) or `/recibo-verde` (recibo_verde)

---

### ✅ STINT 4 — Portugal Compliance Engine *(Complete — with beta adjustments)*
**Goal:** Full legal compliance automated, zero manual steps

> **Trigger point:** All compliance actions fire on **employer confirmation** (shift → FILLED), not on worker application.

- [x] MCD Contract Generator
  - Triggered when employer confirms a worker (shift → FILLED via `onShiftApproved()`)
  - Auto-filled: worker NIF, employer NIPC, shift date/time/location, role, wage
  - Stored as `McdContract` entity in PostgreSQL
  - ⚠️ **Adjusted:** PDF generation (PDFKit) and digital signature (DocuSign EU) deferred post-MVP. Beta substitute: accountant receives full data by email.

- [x] SS Direta notification
  - BullMQ `ss-direta` queue fires 24h before shift start
  - `SsDiretaProcessor`: sends HTML email to employer's accountant with full MCD data
  - Retry queue: 3 attempts with exponential backoff (30s base)
  - Audit log entries: `SS_EMAIL_SENT`, `SS_FAILED`, `SS_RETRY`
  - ⚠️ **Adjusted:** Email-to-accountant instead of direct SS Direta API (API requires paid credentials). Architecture allows future swap — only `submitToSsDireta()` method needs replacing.

- [x] TSU Engine
  - `calculateTSU(grossHourlyRate)` from `packages/shared` — single source of truth
  - Returns: `grossAmount`, `turnosFee` (10%), `workerDeduction` (11%), `workerNetAmount`, `employerTsu` (23.75%)
  - Per-shift TSU display on shift detail page (mobile)
  - Monthly aggregate TSU report for employer (`GET /compliance/employer/tsu-report`)

- [x] Economic dependency tracker
  - Worker earnings per employer tracked via completed shifts
  - 40% threshold → `DEPENDENCY_FLAG_40` audit event + warning returned to worker
  - 50% threshold → `DEPENDENCY_BLOCK_50` → `BadRequestException` (cannot apply)

- [x] MCD annual limit enforcement
  - 70-day limit per worker/employer pair, checked at application stage
  - Hard block with clear Portuguese error message

- [x] Rest period enforcement
  - 11h minimum between shifts (EU Working Time Directive)
  - Checked at application stage; blocked with `BadRequestException`

- [x] Recibo Verde module
  - `onShiftCompleted()` in `ComplianceService` schedules two BullMQ jobs after checkout
  - Day +3: gentle push reminder; Day +5: urgent push reminder
  - `ReciboVerdeProcessor`: Expo push notification to worker's stored token
  - `RECIBO_VERDE_REMINDER_SENT` event in `ComplianceEvent` enum + audit log
  - Mobile screen `/recibo-verde` with pre-filled values, 5-step guide, Portal das Finanças CTA

- [x] ACT Audit Trail
  - `ComplianceAuditLog` entity — immutable, append-only (`CreateDateColumn` only, no `updatedAt`)
  - All events logged: `CONTRACT_CREATED`, `SS_EMAIL_SENT`, `SS_FAILED`, `SS_RETRY`, `DEPENDENCY_FLAG_40`, `DEPENDENCY_BLOCK_50`, `REST_PERIOD_VIOLATION_ATTEMPT`, `MCD_LIMIT_ATTEMPT`, `RECIBO_VERDE_REMINDER_SENT`
  - `GET /compliance/employer/audit-log` endpoint
  - Web-admin compliance dashboard: Audit tab shows full trail for ACT inspections

- [x] Compliance web-admin dashboard (`/dashboard/compliance`)
  - **TSU Report tab:** month/year filter, KPI cards (total gross, employer TSU, Turnos fees), per-shift table
  - **MCD Contracts tab:** all contracts with SS Direta notification status badges
  - **ACT Audit Log tab:** immutable event trail
  - Sidebar entry "Conformidade" activated (was `soon: true`)

---

### ✅ STINT 5 — QR Check-In / Check-Out *(Complete — with architectural change)*
**Goal:** Verified attendance, fraud-proof, hours locked to payroll

> **Architectural decision taken:** Static HMAC QR instead of rotating 30s tokens.
> Two permanent QR codes per employer (one check-in ↑, one check-out ↓) — same Urban Sports model.
> No expiry — HMAC-SHA256 signature prevents forgery. Employer prints once and posts at venue.

- [x] Static HMAC QR token generation (`signStaticToken` / `verifyStaticToken`)
  - Format: `base64url({employerId, action, v}).base64url(HMAC-SHA256)`
  - Deterministic — same inputs always produce same QR
  - ⚠️ **Changed from plan:** Dynamic rotating QR (30s TTL) replaced by static permanent HMAC QR

- [x] Employer QR display (web dashboard `/dashboard/qr-codes`)
  - Two printable QR codes: check-in (↑) and check-out (↓)
  - PNG data URLs generated server-side via `qrcode` library

- [x] Worker QR scan flow (mobile `/scan`)
  - `expo-camera` + `BarcodeScanningResult` handler
  - Debounce guard (`processingRef`) prevents duplicate fires
  - Correct action validation (check-in QR for check-in, check-out QR for check-out)
  - subHint text updated to reflect static QR model (permanent, not rotating)

- [x] Geofence validation at scan time (200m radius via Haversine)

- [x] Check-in time window: 30 min before → 60 min after shift start

- [x] Check-out time window: 30 min before → 2h after shift end

- [x] Check-in confirmation: shift → ACTIVE, WebSocket push to employer dashboard

- [x] Check-out confirmation: shift → COMPLETED, WebSocket push to employer + worker

- [x] Payment rule locked: always calculated from `scheduledHours` (shift.startTime → shift.endTime), never from QR scan timestamps

- [x] Manual employer override (`POST /attendance/:shiftId/manual-confirm`) with audit log entry

- [ ] Dispute flag (worker or employer can flag a discrepancy before checkout locks) — **Deferred to Stint 8**

---

### ✅ STINT 6 — Payments & Payroll *(Complete — with adjustments)*
**Goal:** Employer pays per shift on completion → worker paid next business day automatically

> **✅ Confirmed Revenue Model (Hybrid):**
> - **Stream 1 — Company Subscription:** Monthly recurring fee for platform access (€55/mo MVP tier)
> - **Stream 2 — Worker Transaction Fee:** 10% deducted from worker's gross payout per completed shift. Shown on payslip as "Taxa de Serviço Turnos".

> **✅ Confirmed Payment Flow:** Pay-per-shift post-completion (employer's card charged after QR check-out confirms hours).
> **✅ Confirmed Worker Payout:** T+1 business day ("Recebe amanhã") via Stripe Connect Express.

- [x] Stripe Connect setup — `PaymentsModule` / `PaymentsService` / `PaymentsController`; worker Connect Express onboarding; employer `stripeCustomerId`
- [x] Pay-per-shift: employer charged via saved card on QR check-out / manual confirm (`chargeShiftAndPayout()`)
- [x] Gross → Net wage calculation using `calculateTSU()` from shared (`employerContribution` 23.75% + `turnosFee` 10% + `workerDeduction` 11%)
- [x] Worker payout scheduled T+1 via Stripe automatic transfers to worker's Connect account
- [ ] Payslip PDF generation — **Deferred post-MVP** (PDF in payout email planned for Stint 8)
- [x] **Unfilled shift policy:** if employer never confirms a worker no charge; employer can re-post
- [x] **Pre-shift cancellation policy:** cancelled FILLED shift ≤12h before start → 15% of gross (11% Turnos + 4% worker compensation); fire-and-forget non-blocking
- [x] **Company subscription billing** (Stripe Billing — monthly recurring)
  - MVP: single tier at €55/mo via `STRIPE_SUBSCRIPTION_PRICE_ID`
  - ⚠️ **Adjusted:** 3 subscription tiers (Starter/Growth/Scale) deferred to Stint 8 Admin Panel
- [x] `assertCanPostShift()` guard in `ShiftsService.create()` — blocks shift posting if no active subscription
- [x] Payment failure handling: Stripe webhooks handle `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted` → marks employer `PAST_DUE` / `CANCELLED`
- [x] Employer spending dashboard (`/dashboard/spending`) — cost per shift, total TSU owed, period toggle, CSV export, monthly bar chart
- [x] Worker earnings dashboard (mobile `earnings.tsx`) — gross/net/fee breakdown per shift, period toggle, quarterly SS reminder banner
- [x] Quarterly SS reminder: BullMQ `quarterly-ss` cron `0 9 1 3,6,9,12 *` → Expo push to all ACTIVE workers
- [x] Web-admin billing page (`/dashboard/billing`) — subscription status, save card CTA, cancel flow
- [x] Stripe CLI skills installed: `stripe-best-practices`, `stripe-projects`, `upgrade-stripe`

---

### ✅ STINT 7 — Ratings, Reputation & Trust *(Complete — with scope adjustments)*
**Goal:** One-way trust system (employer rates worker) that makes employer selection easier and rewards reliable workers

> In the marketplace model, a worker's rating is their **public CV** — employers see it when reviewing the applicant list and use it to decide who to confirm. A strong rating directly increases a worker's chances of being selected.

- [x] **Post-shift rating flow (employer → worker only)** — triggered 30 min after QR check-out via BullMQ `rating-reminder` delayed job (email to employer)
  - ⚠️ **Scope decision:** One-way only in Stint 7. Worker-rates-employer deferred to Stint 8.
- [x] 5-star + comment system with category tags: `pontual`, `profissional`, `comunicativo`, `boa_atitude` (defined in `packages/shared` as `WORKER_RATING_TAGS`)
- [x] Reputation Score recalculation after each rating (`recalculateWorkerReputation()` → `avgRating` rolling average, `reputationScore` = avgRating × 20, clamped 0–100)
- [x] Worker columns added: `avgRating` (decimal 3,2), `totalRatings` (int), `noShowCount` (int), `badges` (simple-array)
- [x] **No-show penalty:** `NoShowFlag` entity — confirmed no-show increments `noShowCount`; 3 flags in 60 days triggers admin review email via `MailService`
  - ⚠️ **Scope decision:** Dispute flag (check-in/check-out discrepancy) deferred to Stint 8.
- [x] Unique constraint on `(shift_id, rater_id)` — one rating per employer per shift; duplicate returns 409
- [x] Badges auto-awarded in `recalculateBadges()`:
  - **TOP_RATED** — avg ≥ 4.5 stars & ≥ 10 total ratings
  - **VERIFIED** — worker status === ACTIVE
  - **RELIABLE** — zero no-shows & completion rate ≥ 90% & ≥ 20 ratings
- [x] **Favourite Workers:** `FavouriteWorker` entity + `GET/POST/DELETE /ratings/favourites/:workerId` endpoints
  - ⚠️ **Scope decision:** Private 30-min notification window replaced by priority placement (same batch). ORDER BY CASE: favourites first → TOP_RATED → everyone else → profileQualityScore DESC.
- [x] `notifyMatchingWorkers()` updated to accept `employerId`; loads favourite IDs and applies priority sort in QueryBuilder
- [x] `ReNotificationJobData` updated with `employerId`; both call sites updated (`shifts.service.ts` + `re-notification.processor.ts`)
- [x] `RatingsModule` registered in `AppModule` with entities `Rating`, `NoShowFlag`, `FavouriteWorker`
- [x] `AttendanceModule` imports `RatingsModule`; `checkOut()` schedules rating-reminder job
- [x] `BADGE_THRESHOLDS` and `WorkerRatingSummary` exported from `packages/shared`

**Mobile (worker side):**
- [x] `apps/mobile/app/rate/[id].tsx` — star selector, tag chips, optional comment (140 chars), "already rated" state banner; uses `api.post` (authenticated)
- [x] `apps/mobile/app/my-shifts.tsx` — "⭐ Avaliar" pill on unrated completed shifts, "✓ Avaliado" chip on already-rated shifts; batch `hasRatedShift` check via `Promise.allSettled`

**Web Admin (employer side):**
- [x] `apps/web-admin/app/dashboard/ratings/page.tsx` — worker cards grid: avg rating (stars + numeric), badge chips, stats row (shifts / faltas / score), completion bar; inline **Rating Modal** (shift selector, 5 stars, tag chips, comment); inline **No-Show Modal**
- [x] `apps/web-admin/app/dashboard/workers/page.tsx` — star rating row + badge chips + no-show count added to each worker card
- [x] `apps/web-admin/app/dashboard/page.tsx` — `⭐ Reputação` entry added to `SIDEBAR_NAV`
- [x] `apps/web-admin/lib/api.ts` — `HiredWorker` extended; `WorkerRatingSummary`, `FavouriteWorker` interfaces; `submitRating`, `reportNoShow`, `getFavouriteWorkers`, `addFavouriteWorker`, `removeFavouriteWorker` methods added
- [x] `apps/api/src/shifts/shifts.service.ts` `findEmployerWorkers()` — return type extended with `avgRating`, `totalRatings`, `noShowCount`, `badges`

---

### 🔄 STINT 8 — Product Depth & Operations *(In Progress — started 2026-06-04)*
**Goal:** Trust, transparency and commitment features that make the marketplace work better for everyone

#### ✅ Phase 1 — UX & Trust Layer (Complete 2026-06-04)

**Bug fixes:**
- [x] Profile photo not loading on mobile — fixed `API_URL` env var + `useStaticAssets('/uploads')` in `main.ts`
- [x] `avgRating.toFixed` crash on web-admin workers + ratings pages — `Number()` wrap applied
- [x] Notification subscription cleanup (`removeNotificationSubscription` → `.remove()`)

**Two-way ratings:**
- [x] Worker rates employer — `POST /ratings/employer` (WORKER role); `direction: WORKER_TO_EMPLOYER`; score **internal only** (never shown to workers/employers — Turnos team insight only)
- [x] Employer written review — `review` field (VARCHAR 150) on `Rating` entity; shown to other employers in applicant list; NOT mandatory
- [x] Rating detail drill-down — `raterName` included in `recentRatings` response so workers can see who rated them and employers see which company wrote a review
- [x] `RatingDirection` type added to Rating entity; unique index updated to `(shift, rater, direction)`

**Skills & Languages overhaul:**
- [x] `ALL_SKILLS` constant in shared — auto-derived from `SHIFT_CATEGORIES` subcategories; worker skills now match employer job subcategories exactly
- [x] `LANGUAGES` constant in shared — 12 languages (PT, EN, ES, FR, DE, IT, AR, ZH, RU, UK, RO, HI)
- [x] `Language` type exported from shared
- [x] `languages: string[]` field added to Worker entity + DB column
- [x] Worker edit-profile: separate **Idiomas** section with chip selector (distinct from Competências)
- [x] Barista added to **Restauração** category (was only in Hotelaria)

**Worker bio / intro:**
- [x] `bio: VARCHAR(200)` added to Worker entity + DB column
- [x] Shown in edit-profile with char counter (200 limit)
- [x] Returned in `GET /auth/me` and `PATCH /auth/worker/profile`
- [x] Visible to employers in applicant review (next: wire up in web-admin applicant list UI)

**Cover note on application:**
- [x] `coverNote: VARCHAR(200)` added to `shift_applications` table
- [x] Optional — passed via `POST /shifts/:id/apply` body
- [x] Enforced server-side (sliced to 200 chars)
- [x] Mobile: cover note TextInput in shift apply flow (next: add UI to shift detail screen)
- [x] Web-admin: cover note shown in applicant review card (next: wire up in applicant list UI)

**Worker acceptance flow (no-show prevention):**
- [x] New `PENDING_ACCEPTANCE` status added to `shifts_status_enum`
- [x] Employer selects worker → shift moves to `PENDING_ACCEPTANCE` (not `FILLED` directly)
- [x] Push notification sent to worker: "Tens 2h para aceitar o turno"
- [x] `POST /shifts/:id/confirm` — worker accepts → `FILLED`, compliance triggered, other applicants rejected
- [x] `POST /shifts/:id/decline` — worker declines → shift reverts to `OPEN`, employer notified via WebSocket
- [x] BullMQ `acceptance-timeout` job (2h delay) — auto-reverts to `OPEN` if worker doesn't respond
- [x] Mobile API: `shiftApi.confirm()` + `shiftApi.decline()` added
- [ ] **Pending:** Accept/Decline UI in `my-shifts.tsx` for `PENDING_ACCEPTANCE` cards

#### 📋 Phase 2 — Admin Panel (Planned)
- [ ] Internal Turnos admin web dashboard (separate from employer dashboard)
- [ ] User management (KYC status, suspend, verify, flag)
- [ ] Shift management override (cancel, reassign, manual completion)
- [ ] Compliance monitoring (MCD limits, SS submission status)
- [ ] Financial dashboard (platform revenue, Stripe payouts, fee breakdown)
- [ ] Analytics: fill rate, time-to-first-application, employer confirmation rate, no-show rate
- [ ] Dispute flag (worker or employer flags check-in/check-out discrepancy)
- [ ] Manual ACT report export (PDF / CSV)
- [ ] 3 subscription tiers (Starter/Growth/Scale) — currently single tier at €55/mo
- [ ] Payslip PDF generation in payout email
- [ ] Support ticket system (Intercom or custom)

---

### ⬜ STINT 9 — Growth & Marketplace Flywheel *(Not started)*
**Goal:** Features that drive supply (workers) and demand (employers) and deepen marketplace relationships

**Worker Acquisition:**
- [ ] Referral program (worker refers worker → bonus on first paid shift)
- [ ] "Available Now" toggle (worker signals immediate availability — badge on profile in applicant lists)
- [ ] Skill certifications upload (food hygiene, first aid, etc. — displayed on worker profile)

**Employer Acquisition:**
- [ ] Self-serve onboarding flow (employer signs up → posts first shift in <10 min)
- [ ] "Post Same Shift Again" — one-click duplicate of a past shift (date/time editable)
- [ ] **Repeat Hire** — "Invite Again" button on any past confirmed worker. One tap sends a direct private notification for the new shift.
- [ ] **Instant Offer** — employer posts a shift AND simultaneously sends a direct private offer to a specific worker. Worker has a time window to respond; if no response, shift opens to general pool.
- [ ] **Pre-approved Pool** — employer builds a trusted shortlist. New shifts go to this pool first in a private 30-minute window. Exclusive perk for Tier 2+ subscribers.
- [ ] Agency/enterprise account (multi-location, team management)

**Retention:**
- [ ] Worker streak bonuses (complete 5 shifts → unlock priority placement in notification waves)
- [ ] Employer loyalty tier (volume discount on platform fee for high-volume subscribers)

**Localisation:**
- [ ] PT/EN language toggle on mobile app (`react-i18next` + `i18next`; locale persisted to AsyncStorage)
  - Extract all ~200 UI strings to `apps/mobile/locales/pt.json` + `en.json`
  - Toggle button on Profile screen; `I18nextProvider` wraps `_layout.tsx`
  - English needed for non-Portuguese workers (tourists, expats) ahead of Porto expansion

---

### ⬜ STINT 10 — Hardening, Security & Launch *(Not started)*
**Goal:** Production-ready, GDPR compliant, App Store approved

- [ ] GDPR compliance audit
  - Privacy policy (PT + EN)
  - Cookie consent (web)
  - Data deletion request flow ("right to be forgotten")
  - Data export flow (DSAR)
- [ ] Security penetration testing
- [ ] Load testing (k6 or Artillery) — target: 10k concurrent shift requests
- [ ] App Store submission (iOS + Android)
- [ ] SSL/TLS enforcement, OWASP Top 10 review
- [ ] Rate limiting & DDoS protection (Cloudflare)
- [ ] Incident response runbook
- [ ] Disaster recovery & DB backup policy (daily snapshots, 30-day retention)
- [ ] Soft launch (closed beta, Lisbon-first)

---

## 6. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    CLIENTS                                     │
│  [React Native App]  [Employer Web]  [Admin Dashboard]        │
└────────────────┬─────────────┬───────────────────────────────┘
                 │ HTTPS/WSS   │
┌────────────────▼─────────────▼───────────────────────────────┐
│                  API GATEWAY (NestJS)                          │
│  Auth │ Shifts │ Matching │ Payments │ Compliance │ Notifs    │
└──┬─────┬────────┬──────────┬──────────┬───────────┬──────────┘
   │     │        │          │          │           │
   ▼     ▼        ▼          ▼          ▼           ▼
[PostgreSQL  [Redis     [BullMQ     [Stripe    [SS Direta  [Expo
 +PostGIS]   Cache]     Queues]    Connect]    Email]      Push]
```

---

## 7. Key Technical Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| SS Direta API unavailability | Medium | Retry queue (BullMQ) + fallback email to accountant (beta) |
| GPS spoofing at QR check-in | Medium | Static HMAC QR (unforgeable) + 200m geofence + time window |
| False Recibos Verdes (ACT audit) | High | Economic dependency tracker auto-flagging at 40% / hard block at 50% |
| MCD limit breaches | Medium | Hard block at application stage if 70-day annual limit reached |
| Shift expires with no confirmation | Medium | Unfilled shift policy: no charge, employer notified, re-post encouraged |
| Worker no-show after confirmation | Medium | No-show flag + cancellation policy; three-strike review process (Stint 7) |
| GDPR violation (GPS data) | Medium | Location used only during shift scan window, not stored continuously |
| App Store rejection (payment flow) | Medium | Use Stripe's approved in-app payment UX patterns |

---

## 8. Decisions Log *(All Resolved)*

---

### ✅ Decision 1 — Worker Legal Model: **MCD Contracts First**
**➡️ Decision: MCD contracts only for v1. Recibos Verdes deferred to Phase 2.**

MCD contracts are the legally cleanest option for Turnos. The "Agenda do Trabalho Digno" specifically targets platforms that misuse Recibos Verdes to avoid employer obligations. Since Turnos controls the shift, location, and hours — regulators could argue workers are economically dependent. MCD avoids this entirely.

---

### ✅ Decision 2 — Launch City: **Lisbon Beta Only**
- Closed beta in Lisbon first
- Porto expansion after beta metrics validated (fill rate >70%, NPS >50)

---

### ✅ Decision 3 — Revenue Model: **Hybrid (Subscription + Worker 10% Fee)**

| Stream | Who Pays | Model |
|---|---|---|
| **Stream 1** | Companies (employers) | Monthly subscription — €99 / €199 / €299 (3 tiers) |
| **Stream 2** | Workers | 10% of gross shift value, shown as "Taxa de Serviço Turnos" on payslip |

---

### ✅ Decision 4 — Employer Payment: **Pay-Per-Shift Post-Completion**
- Employer's card charged automatically after QR check-out confirms hours
- No pre-funding wallet at MVP (reduces employer onboarding friction)
- Payment failure → shift locked, worker still paid (Turnos absorbs risk)

---

### ✅ Decision 5 — MVP Scope: **Stints 0–5 = v1 Launch Target (Payments in v1.1)**
The core loop for v1 is delivered:
```
Employer posts shift (OPEN)
  → Push notifications sent to top matching workers
  → Workers browse feed & apply
  → Employer reviews applicants list & confirms one worker (FILLED)
  → QR Check-in → Shift ACTIVE → QR Check-out → COMPLETED → Hours locked
  → Worker paid next business day  ← Payments (Stint 6) complete this loop
```

---

### ✅ Decision 6 — Worker Payout: **Next Business Day (T+1) via Stripe Connect Express**
- Worker receives net pay **maximum next business day** after shift completion
- Trust anchor communicated in onboarding, shift cards, and payslips: *"Recebe amanhã"*

---

### ✅ Decision 7 — QR Model: **Static HMAC Tokens (Permanent per Employer)**
- Changed from: dynamic rotating QR (30s TTL) — would require employer screen always visible
- Changed to: static HMAC-SHA256 signed tokens — employer prints once, posts at venue
- Two permanent QR codes per employer: check-in (↑) and check-out (↓)
- Same model as Urban Sports. Security guaranteed by HMAC signature, not time expiry.

---

*Last updated: 2026-06-04 | Stints 0–7 complete. Stint 8 Phase 1 in progress (two-way ratings, skills overhaul, worker bio, cover note, worker acceptance flow, photo fix). Phase 2 (Admin Panel) pending.*

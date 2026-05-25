# Turnos App — Claude Code Context

## What This Is

Turnos is a **labour marketplace for Portugal** — employers post short shifts, workers browse and apply, employers select who they want, and the platform handles Portuguese labor compliance automatically (MCD contracts, TSU calculations, SS Direta notifications). The model is adapted from the French platform Student Pop.

**Target market:** Lisbon beta → Porto expansion  
**Workers:** Flexible workers on MCD contracts (Muito Curta Duração)  
**Revenue:** Company monthly subscription (€99–€299) + 10% worker transaction fee per shift  
**Worker payout:** Next business day ("Recebe amanhã") via Stripe Connect Express

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
cd apps/api && npm run start:dev
cd apps/mobile && npx expo start
cd apps/web-admin && npm run dev
```

API is at `http://localhost:3001`, web-admin at `http://localhost:3000`.  
Dev OTP code is hardcoded as `123456` (must be removed before production).

---

## Shared Package

`packages/shared/src/index.ts` is the single source of truth for:
- All TypeScript types (`Worker`, `Employer`, `Shift`, `UserRole`, etc.)
- Auth DTOs
- Compliance constants (`TSU_RATES`, `MCD_LIMITS`, `TURNOS_FEE_RATE`)
- Validation utilities (`isValidNIF`, `isValidIBAN`, `isValidNIPC`, `isValidPostalCode`)
- `calculateTSU()` and `calculateProfileQualityScore()`
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
| 3 | Notifications & Real-Time Updates | 🔄 In Progress |
| 4 | Portugal Compliance Engine | ⬜ Not started |
| 5 | QR Check-In / Check-Out | ⬜ Not started |
| 6 | Payments & Payroll | ⬜ Not started |
| 7 | Ratings, Reputation & Trust | ⬜ Not started |
| 8 | Admin Panel & Operations | ⬜ Not started |
| 9 | Growth & Marketplace Flywheel | ⬜ Not started |
| 10 | Hardening, Security & Launch | ⬜ Not started |

### Stint 2 — Complete (as of 2026-05-25)

**All delivered:**
- Shift creation (web admin) — category, location (geocoded), date/time, hourly rate, required skills, slots
- Shift management — edit, cancel, list view with status badges
- Employer dashboard KPIs wired to real API (active/open/filled shift counts)
- Worker shift feed (mobile) — list + map view, proximity sort via PostGIS
- Shift detail page (mobile) — gross rate, employer info, ETA, one-tap apply
- Worker applications — apply/withdraw, My Shifts screen with status badges
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

---

## Key Architecture Patterns

**Worker status machine:** `INCOMPLETE → PENDING_REVIEW → ACTIVE → SUSPENDED / REJECTED`  
A worker must score ≥80 on Profile Quality Score to enter `PENDING_REVIEW`.

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
- **TSU rates:** Employer 23.75% / Worker 11% of gross. Always use `calculateTSU()` from shared.
- **Turnos fee:** 10% of gross, deducted from worker payout. Shown as "Taxa de Serviço Turnos" on payslip.
- **Rest periods:** Minimum 11h between shifts for same worker (EU Working Time Directive).
- **False Recibos Verdes:** Monitor economic dependency per worker. Flag at 40%, block at 50%.
- **Gross Hourly Value** must be displayed on every shift card (Agenda do Trabalho Digno requirement).

---

## Key Decisions (All Locked — See `docs/adr/`)

1. **MCD contracts only** for v1 (Recibos Verdes deferred to Phase 2)
2. **Lisbon beta** first, Porto after fill rate >70% and NPS >50
3. **Revenue:** Hybrid — company subscription + 10% worker fee
4. **Payment:** Pay-per-shift post-completion (no employer pre-funding wallet)
5. **Worker payout:** T+1 business day via Stripe Connect Express
6. **MVP scope:** Stints 0–5 = v1 launch target (Payments in v1.1)
7. **Marketplace model:** Workers browse and apply, employers review and confirm. Push notifications target workers by skill match. No auto-assignment. See `docs/turnos_roadmap.md` for full model.

---

## TypeORM Note

`synchronize: true` is set in dev — TypeORM auto-creates/alters tables from entities. Never enable this in production; use migrations instead.

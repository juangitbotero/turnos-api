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
| **Matching** | Profile + Availability | Profile + Availability + Reputation Score *(proximity as a secondary nice-to-have filter)* |
| **Check-in** | Manual / app confirmation | QR Code + Geofence verified |
| **Payments** | Monthly invoice cycle | Pay-per-shift post-completion → worker paid next business day |
| **Revenue model** | Commission on transactions | Hybrid: Company monthly subscription + % fee per transaction (from worker) |
| **Tax engine** | French TVA / URSSAF | TSU 23.75% (employer) + Recibo Verde generation |

---

## 2. Technology Stack

### Frontend — React Native (Cross-Platform)
- **Framework:** React Native + Expo (managed workflow for fast iteration)
- **State Management:** Redux Toolkit + React Query (server state)
- **Navigation:** React Navigation v6
- **Maps & Geo:** `react-native-maps` + Google Maps SDK
- **QR:** `react-native-camera` + `expo-barcode-scanner`
- **Real-time:** Socket.IO client
- **UI System:** Custom Design System (NativeWind or StyleSheet)
- **Push Notifications:** Firebase Cloud Messaging (FCM)

### Backend — Node.js / NestJS
- **Framework:** NestJS (TypeScript, modular, enterprise-grade)
- **API Style:** REST + WebSocket (Socket.IO for real-time shifts)
- **Auth:** JWT + Refresh Tokens, OAuth2 (Google Sign-In)
- **Queue:** BullMQ (Redis-backed) for async jobs (SS reports, payslips)
- **Scheduler:** `@nestjs/schedule` for TSU calculation triggers

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
- **Cache / Real-time:** Redis (shift availability, session tokens, geo indexes)
- **Search:** Elasticsearch *(optional at MVP — defer until Stint 9)*
- **File Storage:** See note below ↓

> **💡 File Storage — Affordable Options & Google Cloud Clarification**
>
> **Important:** Your Google One VIP subscription (Drive/Photos storage) is a **consumer product** — it is **separate** from Google Cloud Platform (GCP), which is the developer infrastructure. They do not share storage quotas.
>
> | Option | Free Tier | Paid | Best For |
> |---|---|---|---|
> | **Google Cloud Storage (GCP)** | 5 GB free (US regions) | ~$0.02/GB/mo | ✅ Good option — GCP free tier is permanent for small usage |
> | **Cloudflare R2** | 10 GB free | $0.015/GB/mo | ✅ Best value — no egress fees, EU-friendly |
> | **Supabase Storage** | 1 GB free | $0.021/GB/mo | ✅ Great for MVP if using Supabase for DB too |
> | **AWS S3** | 5 GB (12 months only) | $0.023/GB/mo | ⚠️ Free tier expires after 1 year |
>
> **Recommendation for Turnos:** Use **Cloudflare R2** (best free tier, no egress cost, EU data residency). If you want to leverage GCP, you can use **Google Cloud Storage** — but you'll need to create a separate GCP project (free, no credit card needed up to quota).

### Infrastructure
- **Cloud:** Railway (MVP) → Fly.io (Beta) → AWS/GCP (Production)
- **CDN:** Cloudflare (free tier covers most MVP needs)
- **Containerization:** Docker + Docker Compose (dev), ECS/Kubernetes (prod)
- **CI/CD:** GitHub Actions (free for public repos, 2,000 min/mo free for private)
- **Monitoring:** Sentry free tier (errors) + Grafana Cloud free tier (metrics)
- **GDPR / Data Residency:** EU region mandatory (Frankfurt or Dublin)

### Third-Party Integrations
| Service | Purpose |
|---|---|
| **Stripe Connect** | Split payments, employer wallet, worker payouts |
| **Segurança Social Direta API** | MCD contract submission (24h window) |
| **Portal das Finanças** | Recibo Verde validation |
| **Twilio / Firebase** | SMS OTP + Push notifications |
| **Google Maps Platform** | Geolocation, proximity, ETA |
| **Onfido / Veriff** | Worker ID verification (KYC) |
| **DocuSign / Docusign EU** | Digital contract signing |

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
- System must auto-block bookings that would exceed legal limits

### 4.2 TSU Calculation Logic
```
Worker type: Employee (MCD)
  → Employer contribution: 23.75% of gross wage
  → Worker deduction: 11% of gross wage
  → Net displayed to worker = Gross × (1 - 0.11)
  → Employer cost = Gross × (1 + 0.2375)

Worker type: Recibo Verde (Independent)
  → If economic dependency < 50% of their total income:
      Employer pays: 10% TSU only
      Worker handles own SS quarterly declarations
  → If economic dependency ≥ 50%:
      Employer TSU obligation triggered (10%)
  → Gross Hourly Value MUST be displayed (solidarity responsibility)
```

### 4.3 Agenda do Trabalho Digno Compliance Checklist
- [ ] No false Recibos Verdes: monitor economic dependency per worker
- [ ] Display Gross Hourly Value on all shift cards
- [ ] Auto-flag workers approaching 50% dependency threshold
- [ ] Generate audit trail for ACT (Autoridade para as Condições do Trabalho)
- [ ] Enforce rest periods between shifts (minimum 11h per EU Working Time Directive)

### 4.4 Recibo Verde Module
- Worker receives shift completion → system generates pre-filled Recibo Verde template
- Worker reviews and submits via Portal das Finanças (external link + deep link)
- Turnos stores reference number for employer solidarity responsibility records
- 5 business days submission window enforced with reminders

---

## 5. Sprint Roadmap (Stints)

> **Stint duration:** 2–3 weeks each. Adjust/delete/add features as we go.

---

### 🟦 STINT 0 — Foundation & Setup *(Weeks 1–2)*
**Goal:** Dev environment, architecture scaffolding, CI/CD pipeline

- [ ] Monorepo setup (Turborepo: `apps/mobile`, `apps/web-admin`, `packages/api`, `packages/shared`)
- [ ] NestJS API project init (TypeScript, ESLint, Prettier)
- [ ] React Native + Expo project init
- [ ] PostgreSQL + PostGIS setup (Docker Compose)
- [ ] Redis setup (Docker Compose)
- [ ] GitHub Actions CI pipeline (lint, test, build)
- [ ] Environment config system (`.env` per environment)
- [ ] Basic project documentation (README, ADR folder)

---

### 🟦 STINT 1 — Auth & Identity *(Weeks 3–4)*
**Goal:** Both worker and employer can register, verify and log in

**Worker side:**
- [ ] Phone number registration + SMS OTP (Twilio)
- [ ] Google Sign-In (OAuth2)
- [ ] Profile creation (name, NIF, IBAN, photo, skills)
- [ ] ID verification flow (Onfido/Veriff integration)
- [ ] NIF validation against AT (Portal das Finanças format check)
- [ ] **AI Profile Interview (video or async)**
  - After basic profile creation, worker completes a short AI-guided interview
  - Questions: motivation, availability, past experience, soft skills
  - AI evaluates responses → generates a **Profile Quality Score** (0–100)
  - Low-scoring profiles flagged for human review before activation
  - Options: [Tavus](https://tavus.io) or [HeyGen](https://heygen.com) for AI video interviewer, or async text/audio via OpenAI
  - This acts as the primary quality filter, replacing the need for proximity-first matching

**Employer side:**
- [ ] Company registration (NIF, NIPC, address, sector)
- [ ] Admin dashboard login (web)
- [ ] Role-based access control (Admin, Manager, Viewer)

**Infrastructure:**
- [ ] JWT + Refresh Token auth service
- [ ] User Service (NestJS module)
- [ ] Email verification service

---

### 🟦 STINT 2 — Shift Marketplace Core *(Weeks 5–7)*
**Goal:** Employers can post shifts; workers can see and apply

**Employer (Web Dashboard):**
- [ ] Post a shift (date, time, location, role, hourly rate, skills needed)
- [ ] Gross Hourly Value display + Employer Total Cost calculator (TSU auto-applied)
- [ ] Shift management (edit, cancel, duplicate)
- [ ] Worker shortlist / invite

**Worker (Mobile App):**
- [ ] Shift feed (list + map view)
- [ ] Proximity-based sorting (PostGIS query)
- [ ] Shift detail page (gross rate, employer rating, location, ETA)
- [ ] One-tap apply / express accept
- [ ] My Shifts screen (upcoming, completed, cancelled)

**Backend:**
- [ ] Shift Service (CRUD + status machine: `DRAFT → OPEN → FILLED → ACTIVE → COMPLETED`)
- [ ] PostGIS geo-query for radius search
- [ ] Basic notification trigger on new shifts nearby

---

### 🟦 STINT 3 — Real-Time Matching Engine *(Weeks 8–10)*
**Goal:** Smart, proximity + reputation matching that fills shifts in minutes

**Matching Algorithm (v1) — Profile-first, proximity secondary:**
```
Score = (0.40 × ProfileQualityScore)      ← AI interview score + completeness
      + (0.30 × ReputationScore)           ← ratings + completion rate
      + (0.20 × SkillMatchScore)           ← skills vs shift requirements
      + (0.05 × AvailabilityReliabilityScore)
      + (0.05 × ProximityScore)            ← nice-to-have, not primary
```
> Proximity is used as a **tiebreaker** between equally scored profiles, not as a primary driver.

- [ ] Reputation Score engine (avg rating + completion rate + punctuality)
- [ ] Availability Reliability Score (no-show history penalty)
- [ ] Geospatial matching service (worker pool ranked by score)
- [ ] Push shift invitations to top-N ranked workers simultaneously
- [ ] First-accept-wins claim logic with race condition protection (Redis atomic ops)
- [ ] WebSocket channel: live shift status updates (employer dashboard + worker app)
- [ ] Surge mode: auto-expand radius if no match found in 5 min

---

### 🟦 STINT 4 — Portugal Compliance Engine *(Weeks 11–13)*
**Goal:** Full legal compliance automated, zero manual steps

- [ ] MCD Contract Generator
  - Auto-fill: worker NIF, employer NIPC, shift date/time/location, role, wage
  - PDF generation (PDFKit or Puppeteer)
  - Digital signature flow (DocuSign EU)
- [ ] Segurança Social Direta integration
  - Auto-submit MCD notification ≤24h before shift start
  - Retry queue for failed submissions (BullMQ)
  - Receipt/confirmation storage (S3)
- [ ] TSU Engine
  - Per-shift TSU calculation (employer 23.75% / worker 11%)
  - Monthly aggregate report for employer accounting export
  - Economic dependency tracker per worker (flag at 40%, block at 50%)
- [ ] Recibo Verde module
  - Post-shift: generate pre-filled Recibo Verde template
  - Reminder notifications at day 3 and day 5 post-shift
  - Employer solidarity responsibility audit log
- [ ] ACT Audit Trail
  - Immutable log of all contracts, SS submissions, and payments
  - Export as PDF or CSV for ACT inspections
- [ ] Rest period enforcement (11h minimum between shifts, same worker)

---

### 🟦 STINT 5 — QR Check-In / Check-Out *(Weeks 14–15)*
**Goal:** Verified attendance, fraud-proof, hours locked to payroll

- [ ] Dynamic QR Code generation (time-sensitive, refreshes every 30s)
- [ ] Employer QR display (web dashboard + printable PDF)
- [ ] Worker QR scan flow (React Native camera)
- [ ] Geofence validation at scan time (must be within 200m of shift location)
- [ ] Check-in confirmation: WebSocket push to both worker + employer
- [ ] Check-out flow (same QR scan) → hours worked auto-calculated
- [ ] Dispute flag: worker can flag discrepancy before checkout confirmation
- [ ] Edge cases: no QR available → manual manager override with audit log

---

### 🟦 STINT 6 — Payments & Payroll *(Weeks 16–18)*
**Goal:** Employer pays per shift on completion → worker paid next business day automatically

> **✅ Confirmed Revenue Model (Hybrid):**
> - **Stream 1 — Company Subscription:** Monthly recurring fee for platform access (e.g., €99–€299/mo based on tier). Unlocks the worker pool, shift posting, and compliance tools.
> - **Stream 2 — Worker Transaction Fee:** A % deducted from the worker's gross payout per completed shift. Suggested range: **8–12%** (lower than the 15–20% norm to be worker-friendly and competitive in Portugal).
> - *Student Pop does not publicly disclose its exact commission, but similar EU platforms charge 10–15% on the worker side. Starting at 10% is fair and defensible.*

> **✅ Confirmed Payment Flow:** Pay-per-shift post-completion (no employer pre-funding wallet needed at MVP).
> **✅ Confirmed Worker Payout:** Next business day (+1D) after shift completion — communicated clearly in the app as a trust anchor.

- [ ] Stripe Connect setup (platform account + connected worker accounts — use "Express" account type for next-business-day payouts)
- [ ] Pay-per-shift: employer charged via saved card on QR check-out confirmation
- [ ] Gross → Net wage calculation (11% TSU worker deduction + Turnos % fee auto-applied)
- [ ] Worker payout scheduled: T+1 business day via Stripe automatic transfers
- [ ] Payslip PDF generation (gross, TSU deduction, Turnos fee, net amount, shift reference)
- [ ] **Company subscription billing** (Stripe Billing / Subscriptions — monthly recurring)
  - Tier 1 — Starter: up to 10 shifts/mo
  - Tier 2 — Growth: up to 50 shifts/mo
  - Tier 3 — Scale: unlimited shifts
- [ ] Employer invoice: monthly subscription + per-shift cost breakdown
- [ ] Payment failure handling + retry logic (3 attempts, then shift suspended)
- [ ] Employer spending dashboard (cost per shift, total TSU owed, subscription status)
- [ ] Worker earnings dashboard (gross per shift, fee deducted, net received, payout date)

---

### 🟦 STINT 7 — Ratings, Reputation & Trust *(Weeks 19–20)*
**Goal:** Two-way trust system that improves matching quality over time

- [ ] Post-shift rating flow (worker rates employer / employer rates worker)
- [ ] 5-star + comment system with category tags (punctuality, professionalism, etc.)
- [ ] Reputation Score recalculation after each rating
- [ ] Worker public profile (visible to employers): score, completion rate, history
- [ ] Employer profile (visible to workers): avg rating, pay reliability score
- [ ] Report / flag system (inappropriate behaviour, no-show, payment issue)
- [ ] Auto-suspension triggers (score < 2.5 or 3 no-shows in 30 days)
- [ ] Badges system (Top Rated, Verified, Fast Responder)

---

### 🟦 STINT 8 — Admin Panel & Operations *(Weeks 21–22)*
**Goal:** Internal tools for Turnos team to manage the platform

- [ ] Admin web dashboard (Next.js or React)
- [ ] User management (KYC status, suspend, verify, flag)
- [ ] Shift management (override, cancel, reassign)
- [ ] Compliance monitoring (MCD limits, SS submission status)
- [ ] Financial dashboard (platform revenue, Stripe payouts, disputes)
- [ ] Analytics: fill rate, avg time-to-fill, top employers, top workers
- [ ] Manual ACT report export tool
- [ ] Support ticket system (Intercom integration or custom)

---

### 🟦 STINT 9 — Growth & Marketplace Flywheel *(Weeks 23–25)*
**Goal:** Features that drive supply (workers) and demand (employers)

**Worker Acquisition:**
- [ ] Referral program (worker refers worker → bonus on first paid shift)
- [ ] "Available Now" toggle (worker signals immediate availability)
- [ ] Skill certifications upload (food hygiene, first aid, etc.)

**Employer Acquisition:**
- [ ] Self-serve onboarding flow (employer signs up → posts first shift in <10 min)
- [ ] Repeat employer: "Post Same Shift Again" one-click
- [ ] Favourite Workers list (direct invite to trusted workers)
- [ ] Agency/enterprise account (multi-location, team management)

**Retention:**
- [ ] Worker streak bonuses (complete 5 shifts → unlock priority matching)
- [ ] Employer loyalty tier (volume discount on platform fee)

---

### 🟦 STINT 10 — Hardening, Security & Launch *(Weeks 26–28)*
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
[PostgreSQL  [Redis     [BullMQ     [Stripe    [SS Direta  [FCM/
 +PostGIS]   Cache]     Queues]    Connect]    API]        Twilio]
```

---

## 7. Key Technical Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| SS Direta API unavailability | Medium | Retry queue + fallback email notification to employer |
| Race conditions on shift claims | High | Redis atomic SETNX for claim locks |
| GPS spoofing at QR check-in | Medium | Dynamic QR (30s TTL) + geofence + device attestation |
| False Recibos Verdes (ACT audit) | High | Economic dependency tracker auto-flagging |
| MCD limit breaches | Medium | Hard block at booking stage if 70-day limit reached |
| GDPR violation (GPS data) | Medium | Location used only during shift, not stored continuously |
| App Store rejection (payment flow) | Medium | Use Stripe's approved in-app payment UX patterns |

---

## 8. Decisions Log *(All Resolved)*

---

### ✅ Decision 1 — Worker Legal Model: **MCD Contracts First**

> **Your question:** Is MCD-only a wider range than Recibos Verdes? Which is safer?

**The difference explained:**

| | MCD Contract | Recibos Verdes |
|---|---|---|
| **Nature** | Short-term employment contract | Independent contractor invoice |
| **Who pays TSU** | Employer: 23.75% / Worker: 11% | Worker pays own SS (21.4%) — employer only 10% if dependency <50% |
| **Written contract** | Not required | Not required, but invoice mandatory |
| **SS notification** | Mandatory (24h before via SS Direta) | No notification required |
| **Legal risk** | Very low — fully structured by law | Medium — risk of "falsos recibos verdes" under Agenda do Trabalho Digno |
| **Worker protections** | Full (rest periods, min wage, SS) | Limited (independent contractor) |
| **Best for Turnos** | ✅ Recommended | ⚠️ Phase 2 only |

**Recommendation — Start MCD only:**
MCD contracts are the legally cleanest option for Turnos. The "Agenda do Trabalho Digno" specifically targets platforms that misuse Recibos Verdes to avoid employer obligations ("falsos recibos verdes"). Since Turnos controls the shift, location, and hours — regulators could argue workers are economically dependent. MCD avoids this entirely. Recibos Verdes can be introduced in Phase 2 for truly independent contractors (e.g., freelance photographers, translators) where the dependency risk is lower.

**➡️ Decision: MCD contracts only for v1. Recibos Verdes deferred to Phase 2.**

---

### ✅ Decision 2 — Launch City: **Lisbon Beta Only**

- Closed beta in Lisbon first
- Porto expansion after beta metrics validated (fill rate >70%, NPS >50)
- Lisbon focus allows tighter operations control and faster feedback loops

---

### ✅ Decision 3 — Revenue Model: **Hybrid (Subscription + Worker % Fee)**

**Two income streams confirmed:**

| Stream | Who Pays | Model | Suggested Rate |
|---|---|---|---|
| **Stream 1** | Companies (employers) | Monthly subscription for platform access | €99 / €199 / €299 per month (3 tiers) |
| **Stream 2** | Workers | % deducted from each shift payout | **10%** of gross shift value |

**On the 10% worker fee:**
- Student Pop does not publish its exact rate, but comparable EU platforms charge 10–15% on the worker side
- 10% is worker-friendly, transparent, and defensible in Portugal's market
- Must be shown clearly on the payslip as "Taxa de Serviço Turnos" to avoid solidarity responsibility ambiguity
- At scale, even 8% is profitable when combined with subscription MRR

---

### ✅ Decision 4 — Employer Payment: **Pay-Per-Shift Post-Completion**

- Employer's card is charged automatically after QR check-out confirms hours
- No pre-funding wallet needed at MVP (reduces friction for employer onboarding)
- **How Student Pop does it:** Student Pop invoices companies monthly in arrears — our post-completion model is actually better for cash flow and trust
- Payment failure → shift locked, worker still paid (Turnos absorbs risk, adds to employer debt)
- At scale, high-volume employers can request monthly consolidated invoicing (Tier 3 subscription perk)

---

### ✅ Decision 5 — MVP Scope: **Stints 0–5 = v1 Launch Target**

The core loop for v1:
```
Employer posts shift → Matching Engine finds worker → Worker accepts
→ QR Check-in → Shift completed → QR Check-out → Hours locked
```
Payments (Stint 6) and full ratings (Stint 7) follow in v1.1. This keeps the MVP lean and testable.

---

### ✅ Decision 6 — Worker Payout: **Next Business Day (T+1)**

- Worker receives net pay **maximum next business day** after shift completion
- This is a **trust anchor** — communicated in onboarding, on shift cards, and payslips: *"Recebe amanhã"* ("Get paid tomorrow")
- Stripe Connect Express account type supports T+1 payouts to Portuguese bank accounts
- This differentiates Turnos from traditional staffing agencies that pay weekly or monthly

---

*Last updated: May 2026 | Based on Student Pop architectural blueprint adapted for Portugal labor law*
*All foundational decisions locked — ready to begin Stint 0.*

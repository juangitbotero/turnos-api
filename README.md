# Turnos App

> **"Work Today. Staff Today."** — Portugal's shift-work marketplace for flexible workers and employers.

[![CI](https://github.com/your-org/turnos-app/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/turnos-app/actions/workflows/ci.yml)

---

## What is Turnos?

Turnos connects **workers** who want flexible shifts with **employers** who need staff today — handling Portugal's MCD contracts, TSU calculations, and next-day payments automatically.

- 👷 **Workers** — find shifts, apply in one tap, get paid next business day (*"Recebe amanhã"*)
- 🏢 **Employers** — post shifts, fill them in minutes, MCD compliance handled automatically

---

## Monorepo Structure

```
turnos/
├── apps/
│   ├── api/          → NestJS REST + WebSocket API       (port 3001)
│   ├── mobile/       → React Native + Expo worker app
│   └── web-admin/    → Next.js employer dashboard        (port 3000)
├── packages/
│   ├── shared/       → Shared TypeScript types & utilities
│   ├── typescript-config/ → Shared tsconfig variants
│   ├── eslint-config/     → Shared ESLint rules
│   └── ui/                → Shared React components (future)
├── infra/
│   ├── postgres/     → DB init scripts (PostGIS setup)
│   ├── redis/        → Redis configuration
│   └── pgadmin/      → pgAdmin server config
├── docs/
│   └── adr/          → Architecture Decision Records
└── docker-compose.yml → Local dev infrastructure
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 24 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 11 | Included with Node.js |
| Docker Desktop | Latest | [docker.com](https://docker.com) |
| Git | ≥ 2.5 | [git-scm.com](https://git-scm.com) |
| Expo Go | Latest | App Store / Google Play |

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/your-org/turnos-app.git
cd turnos-app
npm install --legacy-peer-deps
```

### 2. Set Up Environment Variables

```bash
# API environment (required)
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your local values
```

### 3. Start the Database

```bash
npm run db:start
# PostgreSQL available at localhost:5432
# Redis available at localhost:6379
# pgAdmin GUI at http://localhost:5050  (admin@turnos.app / turnos_admin)
# Redis UI at http://localhost:8085
```

### 4. Run the API

```bash
npm run dev --workspace=apps/api
# API running at http://localhost:3001/api
# Health check: http://localhost:3001/api/health
```

### 5. Run the Mobile App

```bash
npm run dev --workspace=apps/mobile
# Scan the QR code with Expo Go on your phone
```

---

## Available Scripts (root)

| Command | Description |
|---|---|
| `npm run dev` | Start all apps in dev mode |
| `npm run build` | Build all apps for production |
| `npm run lint` | Lint all packages |
| `npm run check-types` | TypeScript check all packages |
| `npm run test` | Run all tests |
| `npm run db:start` | Start PostgreSQL + Redis (Docker) |
| `npm run db:stop` | Stop all Docker services |
| `npm run db:reset` | Wipe data and restart fresh |
| `npm run db:logs` | Tail Docker service logs |
| `npm run db:psql` | Open PostgreSQL shell |

---

## Infrastructure (Local Dev)

| Service | URL | Credentials |
|---|---|---|
| API | http://localhost:3001/api | — |
| Web Admin | http://localhost:3000 | — |
| PostgreSQL | localhost:5432 | turnos / turnos_dev_password |
| Redis | localhost:6379 | no password |
| pgAdmin | http://localhost:5050 | admin@turnos.app / turnos_admin |
| Redis UI | http://localhost:8085 | — |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native + Expo (SDK 54) |
| Web Dashboard | Next.js 15 |
| API | NestJS 10 + TypeScript |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Cache / Queue | Redis 7 + BullMQ |
| Auth | JWT + Refresh Tokens + Google OAuth2 |
| Payments | Stripe Connect Express |
| Monorepo | Turborepo + npm workspaces |
| CI/CD | GitHub Actions |
| Dev Infrastructure | Docker Compose |

---

## Brand & Design System

> Full guide: [`docs/brand/DESIGN_SYSTEM.md`](./docs/brand/DESIGN_SYSTEM.md)

| Role | Color | Hex |
|---|---|---|
| **Primary** — buttons, links, logo | 🔵 Turnos Blue | `#6a79ff` |
| **Secondary** — all backgrounds | ⚪ Turnos White | `#fafdff` |
| **Neutral** — borders, dividers | 🔘 Turnos Grey | `#d9d9d9` |

**Rules:**
- All screens/cards use **white (`#fafdff`) background**
- `#6a79ff` is the identity color — used on CTAs, active states, and brand moments
- `#d9d9d9` is used only for structural elements (dividers, borders)
- Design tokens are exported from `@turnos/shared` — import `colors`, `spacing`, `radius` in all UI code

---

## Architecture Decisions


See [`docs/adr/`](./docs/adr/) for all Architecture Decision Records.

Key decisions already locked:
- [ADR-001](./docs/adr/001-worker-legal-model.md) — MCD Contracts as primary worker model
- [ADR-002](./docs/adr/002-launch-city.md) — Lisbon beta-first launch
- [ADR-003](./docs/adr/003-revenue-model.md) — Hybrid subscription + worker fee model
- [ADR-004](./docs/adr/004-payment-flow.md) — Pay-per-shift post-completion
- [ADR-005](./docs/adr/005-mvp-scope.md) — Stints 0–5 = v1 launch target
- [ADR-006](./docs/adr/006-worker-payout.md) — Next business day T+1 payout

---

## Sprint Roadmap (Stints)

| Stint | Goal | Status |
|---|---|---|
| **0** | Foundation & Setup | ✅ Complete |
| **1** | Auth & Identity | 🔜 Next |
| **2** | Shift Marketplace Core | ⏳ Planned |
| **3** | Real-Time Matching Engine | ⏳ Planned |
| **4** | Portugal Compliance Engine | ⏳ Planned |
| **5** | QR Check-In / Check-Out | ⏳ Planned |
| **6** | Payments & Payroll | ⏳ Planned |
| **7** | Ratings & Reputation | ⏳ Planned |
| **8** | Admin Panel | ⏳ Planned |
| **9** | Growth & Marketplace Flywheel | ⏳ Planned |
| **10** | Hardening, Security & Launch | ⏳ Planned |

---

## Contributing

1. Branch from `develop`: `git checkout -b feat/stint-1-auth`
2. Make your changes
3. Ensure CI passes locally: `npm run check-types && npm test`
4. Open a PR using the [PR template](.github/PULL_REQUEST_TEMPLATE.md)

---

*Last updated: May 2026 | Lisbon Beta Target: Stint 0–5*

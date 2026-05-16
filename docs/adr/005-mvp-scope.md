# ADR-005 — MVP Scope: Stints 0–5 as v1 Launch Target

**Date:** May 2026
**Status:** ✅ Accepted

---

## Context

The full Turnos roadmap spans 10 stints (11 with Stint 0). Launching everything at once would take 12+ months. We needed to define the minimum viable product that validates the core marketplace loop.

## Decision

**Stints 0–5 = v1 (Lisbon Beta)**

The core loop for v1:
```
Employer posts shift
        ↓
Matching Engine finds best worker
        ↓
Worker accepts
        ↓
QR Check-in (geofence verified)
        ↓
Shift completed
        ↓
QR Check-out → hours locked
```

| Stint | Included in v1 | Notes |
|---|---|---|
| 0 | ✅ | Foundation & setup |
| 1 | ✅ | Auth & Identity |
| 2 | ✅ | Shift Marketplace |
| 3 | ✅ | Matching Engine |
| 4 | ✅ | Compliance Engine |
| 5 | ✅ | QR Check-In/Out |
| 6 | 🔜 v1.1 | Payments (post-launch) |
| 7 | 🔜 v1.1 | Ratings & Reputation |
| 8–10 | 🔜 v2 | Admin, Growth, Launch |

## Consequences

✅ Testable with real users in ~14 weeks  
✅ Validates core loop before investing in payments complexity  
⚠️ Beta workers must be paid manually until Stint 6 is live  
⚠️ No ratings system in v1 — matching relies on profile quality score only

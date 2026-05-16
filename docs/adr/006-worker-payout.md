# ADR-006 — Worker Payout: Next Business Day (T+1)

**Date:** May 2026
**Status:** ✅ Accepted

---

## Context

Worker payout timing is a key trust differentiator. Traditional staffing agencies pay weekly or monthly. We evaluated:
- **Instant payout** — technically complex, costly (Stripe instant fees ~1%)
- **Same day** — requires real-time bank transfers, complex in PT
- **Next business day (T+1)** — achievable via Stripe Connect Express
- **Weekly** — standard agency model, low trust signal

## Decision

**Workers receive net pay maximum next business day (T+1) after shift completion.**

This is communicated as a trust anchor across the entire product:
- Onboarding screen: *"Recebe amanhã"* ("Get paid tomorrow")
- Shift cards: payout date shown
- Payslips: exact payout date confirmed

**Implementation:** Stripe Connect Express accounts support T+1 automatic transfers to Portuguese bank accounts (IBAN).

## Consequences

✅ Strong trust differentiator vs agencies (weekly/monthly)  
✅ Feasible with Stripe Connect Express at MVP  
✅ Workers can plan finances around a predictable payout  
⚠️ Non-business days (weekends, holidays) push payout to next working day — must be clearly communicated  
⚠️ Payment failures on employer side must not delay worker payout (Turnos absorbs short-term risk)

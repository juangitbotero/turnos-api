# ADR-004 — Employer Payment: Pay-Per-Shift Post-Completion

**Date:** May 2026
**Status:** ✅ Accepted

---

## Context

Two payment collection models were evaluated:
1. **Pre-funding wallet** — employer tops up a balance before posting shifts
2. **Post-completion charge** — employer's card is charged after the shift is completed and hours are confirmed via QR check-out

## Decision

**Pay-per-shift, post-completion (no pre-funding wallet at MVP).**

Employer's saved card is automatically charged when QR check-out confirms the shift hours.

## Consequences

✅ Removes friction for employer onboarding — no upfront payment required  
✅ Employers only pay for what they get — builds trust  
✅ Student Pop invoices monthly in arrears — our model is actually better for cash flow  
⚠️ Payment failure risk — mitigated by: 3 retry attempts → shift suspended → worker still paid (Turnos absorbs short-term risk)  
⚠️ Requires Stripe saved payment methods (cards on file) from day 1  

**Future:** High-volume employers (Tier 3 subscription) can request monthly consolidated invoicing.

# ADR 008 — Check-in-Only Attendance (Check-out Removed)

**Status:** Accepted (2026-07-14)
**Amends:** Decision 8 (QR model) from ADR 005/CLAUDE.md

## Context

The check-out QR scan added friction for workers at the worst moment (end of
shift) while providing no payment precision: payment has always been based on
**scheduled hours**, never scan timestamps. Real-world behaviour ("forgot to
scan out") left shifts stuck in ACTIVE and forced employers into manual
confirmation — pure support burden. For companies paying outside the Pay Link
(transferência/MB WAY/numerário), check-out never gated their payment at all.

## Decision

1. **Single check-in QR per venue.** The worker scans once, on arrival
   (geofence + HMAC unchanged). Legacy printed check-out QRs are rejected
   with a friendly message.
2. **Shifts auto-complete at exactly the scheduled end time.** A BullMQ job
   is scheduled at check-in; a 15-minute sweep completes any overdue ACTIVE
   shift as a safety net. Auto-completion runs the full former check-out
   chain: €3 fee, WagePayment/Pay Link, Recibo Verde reminders, audit log
   (`SHIFT_AUTO_COMPLETED`), WebSocket updates.
3. **Two-way review prompts.** At completion: push to the worker ("Avalia a
   empresa") and review CTA in the employer's payment email. At **+8h**: a
   follow-up nudges only the sides that haven't rated yet (replaces the old
   30-min employer email).
4. **Guardrail — auto-completion pays blind, so the employer gets tools:**
   - **Ajustar horas** (while the wage is PENDING): recomputes the amount
     with the policy's 2-hour floor, voids and regenerates the Pay Link,
     notifies the worker (who can contest).
   - **Reportar problema**: flips the wage to UNDER_REVIEW, pauses the
     unpaid-reminder ladder, and alerts ops (48h SLA).
5. Manual employer confirmation is kept as an ops fallback.

## Consequences

- `POST /attendance/check-out` removed; `getEmployerStaticQr` returns one QR.
- Worker abandonment mid-shift is no longer detectable by a missing scan —
  the employer's review, adjust-hours, and report-problem flows are the
  replacement signals.
- `ShiftAttendance.autoCompleted` distinguishes auto-closed rows; legacy
  rows keep real scan-out data.
- Completion timing becomes deterministic (T = scheduled end), which also
  makes the payment/review notification flow predictable.

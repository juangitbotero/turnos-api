# ADR 007 — Business Model Pivot: Turnos Exits the Wage Money Flow

**Status:** Accepted (2026-07-05)
**Supersedes:** ADR 003 (revenue model), ADR 004 (payment flow), ADR 006 (worker payout)

## Context

Following a consultation with an accountant and a labor attorney (July 2026), the
strongest legal risk to Turnos was identified: routing worker wages through the
platform and charging a percentage of the worker's gross makes Turnos look like
an employment intermediary / unlicensed temp-work agency (ETT) under Portuguese
law. To eliminate any hiring link between Turnos and the workers, the money flow
is restructured so that **Turnos never holds or routes wages**.

## Decision

1. **Subscription:** "Turnos Starter" at **€45/month** (was €55). Second tier
   "Turnos Pro" at €99/month planned (unlimited concurrent shifts, 5 seats,
   €2/shift fee, advanced search + direct invite). Third tier "Business" is a
   contact-us anchor only.
2. **Per-shift fee:** fixed **€3 charged to the company** per completed shift
   (check-out done). Recorded as a Stripe InvoiceItem at checkout → aggregates
   automatically on the next monthly subscription invoice, itemized per shift.
   Deliberately a **fixed amount, not a %**: a percentage indexed to the
   worker's pay re-creates intermediary optics.
3. **Workers pay nothing.** The former 10% worker fee is abolished — workers
   receive the full gross. (Future monetization: "Workers Pro", courses,
   profile boost — not now.)
4. **Wages are paid directly company → worker.** The company selects a
   **payment method at shift publish** (required): `TURNOS_PAY_LINK`
   (recommended), `TRANSFERENCIA`, `MBWAY`, `NUMERARIO`. Shown to workers
   before applying.
5. **Turnos Pay Link (phase 4, pending attorney sign-off):** post-checkout,
   Turnos generates a Stripe Checkout link that settles as a **direct charge
   into the worker's own Stripe Connect account**. Turnos never holds funds,
   issues a payment *receipt* (never an invoice for the labor — invoices only
   for Turnos' own fees), and the company absorbs the Stripe processing fee so
   the worker receives the full gross.
6. **Cancellation (company), revised 2026-07-05:** three tiers replacing the
   earlier 10%-to-Turnos fee (Supp-inspired; compensation goes to the worker,
   not the platform): **>24h** free (worker apology + priority boost);
   **24h–3h** free of payment but recorded on the company's internal
   reliability metric; **<3h without justification** the company pays the
   worker a **2-hour minimum** at the shift's hourly rate (via auto-generated
   Pay Link, direct company → worker) and Turnos bills the normal **€3 fee**.
   Justified cancellations (worker late/no-capability/dress-code, health &
   safety, equipment failure, third-party event cancellation) are exempt,
   case-by-case, selected at cancel time and reviewed by ops (48h SLA). A
   shift ended early after starting pays hours worked or the 2h minimum,
   whichever is greater.
   Full text: `docs/policies/cancellation-and-noshow-policy.md`.
7. **Worker cancellation policy:** >24h before start = free, shift reopens +
   re-notification wave. ≤24h = "cancelamento tardio" strike (blocks RELIABLE
   badge; 2 strikes in 30 days = 7-day application suspension). **No-show** =
   automatic 1★ system rating + 30-day suspension; **second no-show = permanent
   block**.
8. **Compliance engine stays but is strictly informative** on the money side:
   TSU calculations, payslip data, and accounting exports are guidance the
   company uses to pay the worker and the State directly. Hard blocks (70-day
   MCD, 11h rest, 50% economic dependency) remain at application stage.
   Language discipline: never "processamos/garantimos o pagamento".

## Consequences

- `chargeShiftOnCheckout()` (wage charge + Connect transfer) replaced by
  `recordShiftFeeOnCheckout()` (fee invoice item + informative ledger row).
- `PaymentType.SHIFT_CHARGE` / `WORKER_PAYOUT` / `WORKER_COMPENSATION` are
  legacy; new rows use `SHIFT_FEE`.
- Worker Stripe Connect onboarding endpoints are kept (optional) for Pay Link.
- Worker earnings and employer spending dashboards reframe wage figures as
  informative; Turnos fees are the only billed amounts shown.
- All "T+1" / "Recebe amanhã" / Stripe payout marketing claims removed.
- Web-admin strategy: worker-search-first — Procurar Workers/Trabalhadores
  promoted to the top of the sidebar; richer filters and worker profiles to
  follow.

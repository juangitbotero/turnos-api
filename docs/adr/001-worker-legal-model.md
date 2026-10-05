# ADR-001 — Worker Legal Model: the Company Employs, Turnos Connects

**Date:** May 2026 · **Rewritten:** 2026-09-27
**Status:** ✅ Accepted (rewritten — see "What changed")

---

## What changed

The May 2026 version opened with *"Turnos controls the shift location, hours,
and working conditions."* That was never how the product worked, and after the
ADR 007 pivot it is the opposite of the model. It also read, to anyone outside
the team, as an admission of the control that would make Turnos the employer.
This rewrite states who actually decides what.

It also dropped "Recibos Verdes deferred to Phase 2" as a live plan. The
Recibo Verde reminders that had been built for workers were removed on
2026-09-27 (see below).

## Context

Turnos is a marketplace. Companies post short shifts; workers browse and apply;
the company chooses who works. The legal question is which contract governs the
work, and who is party to it.

| Decision | Who makes it |
|---|---|
| Whether a shift exists at all | The company |
| Location, date, start and end time | The company, when it posts the shift |
| Role, tasks, dress code, requirements | The company |
| Gross hourly rate | The company (Turnos only enforces that one is shown) |
| Which applicant is hired | The company |
| Whether to apply, and to accept an offer | The worker |
| Supervision of the work on the day | The company |
| Paying the wage | The company, directly to the worker (ADR 007) |
| Social Security admission and contributions | The company, as employer |
| The worker's own tax and SS obligations | The worker |

Turnos provides the software: the listing, the matching, the check-in QR, the
compliance checks, the payment tooling, and the reputation system. It does not
set, negotiate or supervise any term of the work.

## Decision

**The company is the employer, and the working relationship is between the
company and the worker. Turnos is not a party to it.**

The contract type the product is built around is the **MCD (Contrato de Muito
Curta Duração)**, because it is the form Portuguese law provides for very short
engagements. The product supports it by:

- making the data the company needs for the Segurança Social admission
  available in its dashboard as soon as the worker confirms, to copy or export.
  Until 2026-10-05 Turnos emailed it to the company's accountant 24h before
  the shift; removed so that Turnos never performs an employer duty on the
  company's behalf (and stops being a processor for it);
- enforcing the statutory limits at application time — 70 days per year with
  the same company, 11h rest between shifts;
- keeping an append-only audit trail of those checks.

**Open question for the lawyer:** whether the company is free to use another
contract form, and whether Turnos should stay neutral on the form rather than
presuming MCD. Until answered, the product keeps MCD as its default and makes no
statement that it is the only option. See `docs/legal/brief-advogados.md`.

## What Turnos does not do

- It does not issue recibos verdes, ask for them, or remind anyone to issue
  them. A worker on an employment contract is paid a wage, not an invoice.
  The reminders that told MCD workers to issue a recibo verde after each shift,
  and the quarterly "declare to SS" push, were **removed on 2026-09-27**: they
  were wrong for an employee and manufactured evidence of false self-employment.
- It does not calculate, withhold or remit any tax or contribution. TSU figures
  shown in the app are labelled as a simulation.
- It does not hold or route wages (ADR 007).

## Consequences

✅ Clear allocation of employer duties to the party that actually decides the work
✅ Workers get the protections of an employment contract
✅ No Turnos document or screen now tells a worker to act as self-employed
⚠️ The enforcement ladder (strikes, suspensions, blocks) is still a platform
   power over workers. Whether it is compatible with Art. 12-A of the Código do
   Trabalho (Lei 13/2023) and the EU Platform Work Directive is the lawyer's
   first question — see the brief.
⚠️ Whether MCD is available for every kind of short shift a company posts is
   not settled — see the brief.

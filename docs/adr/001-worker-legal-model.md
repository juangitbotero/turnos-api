# ADR-001 — Worker Legal Model: MCD Contracts First

**Date:** May 2026
**Status:** ✅ Accepted

---

## Context

Turnos controls the shift location, hours, and working conditions. This creates a risk under Portugal's **Agenda do Trabalho Digno** law — platforms that misuse *Recibos Verdes* (independent contractor invoices) to avoid employer obligations can be penalised for *"falsos recibos verdes"*.

Two options were evaluated:

| | MCD Contract | Recibos Verdes |
|---|---|---|
| **Nature** | Short-term employment contract | Independent contractor invoice |
| **SS notification** | Mandatory 24h before shift | Not required |
| **Legal risk** | Very low | Medium — false dependency risk |
| **Worker protections** | Full (rest periods, min wage, SS) | Limited |

## Decision

**Use MCD (Muito Curta Duração) contracts only for v1.**

Recibos Verdes are deferred to Phase 2 for truly independent contractors (e.g. freelance photographers) where economic dependency risk is lower.

## Consequences

✅ Cleanest legal position — avoids ACT inspections  
✅ Workers get full employment protections  
✅ Employer obligations are clear and automated  
⚠️ Slightly higher employer cost (23.75% TSU vs 10% for RV)  
⚠️ Mandatory 24h SS Direta notification before each shift (automated via BullMQ)

# Turnos vs. Shifty — Competitive Benchmark

**Date:** 2026-07-29
**Subject:** [shifty.es](https://shifty.es/) — Spain, hospitality shift marketplace
**Status:** Research. No product decisions taken from this yet.

> Same offer on the surface — short hospitality shifts, verified workers, ratings, GPS
> check-in. Underneath, two opposite legal bets and a 5× difference in price.
>
> Shifty's metrics, prices and legal claims below are the ones **they publish themselves**
> and are not independently verified. Turnos comparisons are derived from this repository's
> code and ADRs.

Also published as a formatted page: <https://claude.ai/code/artifact/161903c5-7521-48bf-93e2-a889dab1d502>
(Portuguese version: <https://claude.ai/code/artifact/e6e972f5-bf1a-4941-803f-bce446877f93>)

---

## 1. The difference that explains all the others

Shifty registered as a **placement agency**. By their own description they are a
*"plataforma tecnológica de intermediación laboral, homologada como agencia de colocación"*
under RD 1796/2010 and the Ley de Empleo. They took on the intermediary role and got licensed
to perform it. For companies that want more, they resell an **+ETT module** in which a partner
temp agency becomes the formal employer (Ley 14/1994).

Turnos did precisely the opposite. `ADR 007` exited the wage money flow specifically *so as
not to look like* a labour intermediary — fixed fee rather than a percentage, no custody of
wages, no invoicing of the work itself.

**These are not two executions of one model.** They are opposite answers to the same
regulatory question. Shifty paid the compliance cost and bought commercial freedom: they can
charge 20–25% of gross salary without it raising a problem, because being a paid intermediary
is literally what their registration covers. Turnos gave up that revenue in order not to need
the registration.

---

## 2. Side by side

| | Turnos | Shifty |
|---|---|---|
| **Market** | Portugal — Lisbon beta, Porto next | Spain — Madrid, Barcelona, Málaga |
| **Sector** | Multi-sector (restaurants, hotels, retail, events, logistics…) | Hospitality only — deliberately narrow |
| **Legal status** | Deliberate non-intermediary · no licence · no registration | Registered placement agency · optional partner ETT |
| **Employer of record** | The company (MCD contract) | The company, or the partner ETT under +ETT |
| **Revenue** | €45/mo Starter + €3 fixed per shift | 20–25% of gross salary · €0 or €59/mo · +ETT €99/mo |
| **Worker pays** | Nothing | Nothing |
| **Wage flow** | Company → worker, direct. Turnos never holds funds | Company direct, or via ETT. Paid in <7 days |
| **Verification** | Profile quality score ≥80 + manual admin review | 1-min video + DNI/NIE + SS number + IBAN + references + **interview**, reviewed in 24h |
| **Attendance** | Check-in QR + 200m geofence; auto-completes at scheduled end | GPS slider or QR, on arrival *and* departure |
| **Billing** | Monthly, aggregated onto subscription invoice | Weekly, every Wednesday, auto-charged via Stripe |
| **Claimed scale** | Beta — no public metrics | 10,000+ professionals · filled in <4h · 98% fill rate |

**Pricing caveat.** Shifty's own pages contradict each other: `/precios` headlines 20%, the
blog says 25% free / 10% Pro, and `/ett-hosteleria-madrid` says 25% with an optional €59/mo.
They are most likely mid-repricing — treat any single figure as provisional.

---

## 3. The money

On a 6h shift at €10/h — €60 gross — Shifty takes €12–15. Turnos takes €3. But Turnos charges
a monthly subscription and Shifty does not, which flips the arithmetic at low volume.

| Shifts/month | Turnos (Starter) | Shifty (25%) | Difference |
|---|---|---|---|
| 2 | €51 | €30 | Shifty −€21 |
| 4 | €57 | €60 | break-even |
| 10 | €75 | €150 | Turnos −€75 |
| 20 | €105 | €300 | Turnos −€195 |
| 40 | €165 | €600 | Turnos −€435 |

**Crossover is four shifts a month.** Above it Turnos is always cheaper and the advantage
compounds without limit, because the fee is fixed. At 20 shifts/month Turnos costs one third.
This is the strongest commercial argument available against Shifty, and it is arithmetic
rather than rhetoric.

**Below four shifts Shifty wins, and wins well.** The restaurant needing two extras one
Saturday a month pays €30 to Shifty and €51 to Turnos. Worse, Shifty offers *"si el turno no
se cubre, no pagas nada"* — zero risk to try. The Turnos subscription is an entry barrier in
exactly the segment where a marketplace has to get started.

### The argument Turnos isn't making yet

A 20–25% commission *on gross salary* means **the more the company pays the worker, the more
the platform earns**. Moving from €10 to €13/h costs the company an extra €0.75/h in
commission alone. The model applies downward pressure on posted wages.

The Turnos €3 fixed fee is **wage-neutral**. A company that pays better pays Turnos nothing
extra. That is simultaneously a worker-recruitment argument ("Turnos earns nothing from them
paying you less") and the legal rationale already written into `packages/shared/src/index.ts`.

*Their counter:* Shifty enforces a €10/h floor and advertises €10–13/h, which partly defuses
the criticism. Turnos has no wage floor — worth considering one, since it converts a defensive
argument into a commitment.

---

## 4. Where Shifty is clearly ahead

Years of operational depth, almost all of it built around *making sure the shift actually gets
covered*.

| Capability | Shifty | Turnos |
|---|---|---|
| **Waiting list** | Next candidate auto-promoted when a confirmed worker cancels | Doesn't exist — the shift reopens and starts over |
| **Reconfirmation** | Requested 24h out; no response by 12h before start → slot auto-cancelled | Only the 2h acceptance window at selection |
| **Recurring shifts** | Multi-day, patterns ("every Friday"), date ranges | One shift at a time |
| **Selection methods** | Four: AI matching, manual, invite-only, favourites-only | Manual + favourites priority |
| **Block a worker** | Per-company block list, mutually exclusive with favourites | Favourites only |
| **Teams & permissions** | Four roles: Admin, Manager, Supervisor, Read-only | Seat counts, no permission model |
| **Multi-location** | Multiple venues + cost centres for billing | One employer, one context |
| **Chat** | In-app, open 1h before → 4h after the shift | No direct channel |
| **Promoted shifts** | Paid feed prominence — extra revenue line | Doesn't exist |
| **Conversion fee** | €99+VAT to hire someone met on the platform | Doesn't exist — platform leakage is free |
| **Acquisition / SEO** | City landing pages, collective-agreement calculator, salary calculator, cost reports, blog | A single landing page |

**Strategic read:** the waiting list and reconfirmation are the two that hurt most. They are
precisely the machinery behind the "98% filled" and "<5% no-show" figures Shifty leads its
sales pitch with. Turnos has a penalty policy for *after* a no-show; Shifty has machinery that
*prevents* it. Those are different things.

---

## 5. Where Turnos is ahead

| | Turnos | Shifty |
|---|---|---|
| **Compliance engine** | MCD 35/70-day caps, 11h rest, economic dependency 40/50%, SS Direta, TSU, immutable ACT audit trail — all blocking at application stage | A collective-agreement calculator and delegation to the partner ETT |
| **Wage-payment enforcement** | Reminder ladder at 8/24/48h, posting blocked at 72h, mandatory proof of payment, "não recebi" dispute, 2h minimum on late cancellation | Nothing equivalent documented publicly |
| **Attendance friction** | One scan; shift closes itself at scheduled end | Check-in *and* check-out — the step Turnos removed (ADR 008) because it generated support load |
| **Cost per shift at volume** | €3 fixed, wage-neutral | 20–25%, grows with the wage |
| **Sector breadth** | Multi-sector from day one | Hospitality only |

---

## 6. Registration: 1-minute video + 24h verification

**Their flow, as published:**

1. Download the app, fill in the basics — name, experience, preferred sectors.
2. Record a **1-minute video** about your work history.
3. Validate identity (DNI/NIE), Social Security number and IBAN — all in-app, no paperwork.
4. Team reviews within **24 hours**, with an **interview** before activation.
5. Profile goes live. Advertised to workers as "3 minutes" of effort.

**Turnos today:** 4-step wizard, profile quality score, worker reaches `PENDING_REVIEW` only
at ≥80 points, then manual approval. No video, no interview, no published SLA. Paid ID
verification (Onfido/Veriff) is deferred.

### Pros of adopting

- **It verifies languages — and Turnos needs that.** Shifts carry `languagesRequired` and
  workers self-declare languages as chips. A video is the only cheap way to confirm someone
  claiming English actually speaks it. Strongest argument, because it reinforces an existing
  feature.
- **Closes the ID-verification gap** without paying for Onfido or Veriff.
- **It is their number one sales line.** "We interview everyone" is what Shifty repeats to
  every company. Turnos has no answer to it.
- **Filters out low-intent signups.** Recording a video is real friction.
- **Cheap to build.** `expo-camera` is already in the app for QR scanning; R2 is already the
  decided file store.

### Cons

- **Discrimination risk, and it is serious.** A video reveals race, apparent age, disability,
  pregnancy, accent. Deciding activation on that basis creates documented exposure — and it is
  the one thing Shifty's marketing never mentions.
- **GDPR.** An identification video is sensitive personal data: needs a lawful basis, retention
  period, erasure path, and a written non-discriminatory review rubric.
- **The 24h SLA is an ops promise, not a feature.** Someone must watch every video, every day,
  weekends included. Shifty has a team; Turnos is one person.
- **Funnel drop-off.** Onboarding is already 4 steps plus an 80-point gate. Worker supply is
  the harder side of a marketplace to fill during a beta.
- **Kills the impulse.** Someone who sees a shift today cannot take it for 24 hours.

### Recommendation

Adopt a **modified** version: an optional video that **unlocks a "video-verified" badge and
notification priority**, rather than a mandatory gate. The funnel stays open, the company gets
the same trust signal, and almost all the discrimination risk disappears — a badge a worker
opts into is legally very different from a barrier they must pass.

Frame the stated purpose as **language and experience verification**, not "interview" — a
concrete, job-related, defensible purpose. And show the video to employers; Shifty apparently
doesn't, and it is profile content that decides hires.

---

## 7. FAQ

Shifty's FAQ is enormous and is a **sales asset**, not a support page: every answer rebuts a
purchase objection. Turnos had none. A full draft now sits at [`docs/faq-turnos.md`](../faq-turnos.md)
— 59 questions in Portuguese (37 company-side, 22 worker-side), answers taken from what the
code actually does.

It covers what they cover — legal model, employer of record, price, cancellations, no-shows,
verification, billing — plus three sections they structurally cannot write: MCD compliance,
what happens when a company fails to pay, and why the fee is fixed.

---

## 8. Actionable finding — placement agency registration in Portugal

In Spain, Shifty had to be *approved* as a placement agency. In Portugal the equivalent regime
— **DL 260/2009** — was amended by **Lei 5/2014**, which **removed the licensing requirement
for private placement agencies**: a simple **prior notification** (*mera comunicação prévia*)
to IEFP now suffices, sent to `agencias@iefp.pt`. Heavy licensing was kept only for temporary
work agencies (ETTs).

What is an expensive moat for Shifty may, on the Portuguese side, be an email.

**This is not a recommendation to proceed.** Registering Turnos as a placement agency could
contradict the entire non-intermediary position of `ADR 007`, and that tension is exactly what
the attorney must resolve. But it is cheap optionality worth adding to
[`docs/legal/pay-link-legal-brief.md`](../legal/pay-link-legal-brief.md).

---

## 9. What to do with this

- **Waiting list and reconfirmation.** The two biggest gaps, and the two that produce the
  numbers Shifty brags about. Reconfirmation fits the existing BullMQ infrastructure.
- **Rethink the subscription barrier.** Below 4 shifts/month Turnos loses on price in exactly
  the segment a marketplace must start in. A no-subscription entry plan with a higher
  per-shift fee would fix it without touching the fixed-fee principle.
- **Publish the fixed-fee argument.** "We don't earn more when they pay you less" is a
  sentence Shifty cannot say.
- **Optional video with a badge**, framed as language verification.
- **Publish the FAQ.** Cheapest sales asset there is, and they prove it.
- **Watch for expansion.** Shifty is in three Spanish cities and says it expands on demand.
  Lisbon is the obvious next move, and they would arrive with 10,000 workers and a content
  engine already built.

---

## Sources

- [shifty.es](https://shifty.es/) · [/precios](https://shifty.es/precios) ·
  [/trabajadores](https://shifty.es/trabajadores) · [/empresas](https://shifty.es/empresas/) ·
  [/preguntas-frecuentes](https://shifty.es/preguntas-frecuentes)
- [Blog: legality of hiring via a platform](https://shifty.es/blog/es-legal-contratar-personal-hosteleria-shifty)
- [Blog: cost of covering a shift, 2026](https://shifty.es/blog/informe-coste-cubrir-turnos-hosteleria-espana-2026)
- [ETT hostelería Madrid](https://shifty.es/ett-hosteleria-madrid)
- [IEFP — Agências Privadas de Colocação](https://www.iefp.pt/en/agencias-privadas-colocacao)
- [Decreto-Lei n.º 260/2009](https://diariodarepublica.pt/dr/detalhe/decreto-lei/260-2009-490469)

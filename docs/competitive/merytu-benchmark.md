# Turnos vs. Merytu — Competitive Benchmark

**Date:** 2026-10-17
**Subject:** [merytu.com](https://www.merytu.com/) — Portugal, hospitality gig marketplace (Lisbon, Porto, Algarve, Braga, Coimbra; 165+ localities claimed)
**Status:** Research. No product decisions taken from this yet.

> Same country, same sector, same customer — but Merytu's workers are **self-employed**
> (trabalhadores independentes, recibos verdes) and Turnos's are **employees of the company**
> on MCD contracts. Almost every difference below follows from that one choice.
>
> Merytu's figures are the ones **they or the press publish** and are not independently
> verified. Where this report estimates, it says so. Turnos comparisons come from this
> repository's code and ADRs.

---

## 1. The difference that explains all the others

| | Turnos | Merytu |
|---|---|---|
| **Who the worker is to the company** | An **employee** — MCD contract (art. 142.º CT) | An **independent contractor** — "não existe vínculo contratual connosco ou com a empresa" |
| **Who owes Social Security** | The company (23.75%) + worker (11%, deducted) | The **worker** alone (21.4% on 70% of income, after a 12-month exemption) + company pays 7–10% only if it is >50% of that worker's income (art. 140.º CRC, "entidade contratante") |
| **What the worker must set up** | Nothing — NIF + IBAN | **Open activity** at Finanças (Merytu automates it), give Merytu **sub-user access to their Portal das Finanças** to issue invoices in their name, own accident-insurance policy, own medical fitness certificate, quarterly SS declarations |
| **Legal risk sits on** | The company, as a normal employer | The **platform**, under the employment presumption of **art. 12.º-A CT** (Lei 13/2023) — and soon the **EU Platform Work Directive 2024/2831** (transposition deadline **2 Dec 2026**) |

Merytu's pitch to companies is "no contracts, no paperwork, no Social Security" — the company
buys hours. Turnos's pitch is "a legal contract, done in a click" — the company hires. Merytu is
easier for the company today; Turnos is safer for both sides as the law tightens.

---

## 2. Side by side

| | Turnos | Merytu |
|---|---|---|
| **Founded / stage** | Beta, Lisbon | 2021; ~85,000 registered workers, ~1,500 companies (Nov 2025) |
| **Sector** | Multi-sector (hospitality, retail, events, logistics, cleaning, admin) | Hospitality + events + spa. **Entering logistics/distribution (Q2 2026) and retail** |
| **Funding** | Bootstrapped | €1M pre-seed (Portugal Ventures, 2022) + **€1.5M (2026) from Banco Português de Fomento and Hotusa Ventures** |
| **Expansion** | Lisbon → Porto | Belgium and/or Spain, first move end-2026 / 2027 |
| **Revenue model** | €45/mo subscription + €3 per completed shift | No subscription. Company pays an **all-in hourly price** set by role + worker level; Merytu's margin is inside it (unpublished) |
| **Minimum / maximum** | 2h minimum (enforced at creation), no maximum | 4h minimum, 10h maximum per gig |
| **Who chooses the worker** | Company selects from applicants | Workers **accept the invitation**; reviews describe it as "fica com o Gig quem clicar mais rápido" |
| **Wage flow** | Company → worker directly. Turnos never holds wages | **Merytu collects** "em representação do Meryter" (100% captured at booking), pays the worker **weekly** via Santander; may SEPA-debit the worker for overpayments |
| **Worker invoicing** | Not applicable (salary) | Automatic fatura-recibo in the worker's name (Magnifinance); large clients get an aggregated invoice **in Merytu's name**, with taxes and contributions "included in the price" |
| **Attendance** | Check-in QR + 200m geofence; auto-completes | Check-in **and** check-out in app — both are conditions for the worker to be paid |
| **Company cancellation** | >24h free · 24h–3h counted · <3h reason required, 2h minimum wage if company error | >24h free · **<24h = 100% of the gig** (first day of multi-day). 10-minute grace after posting |
| **Worker cancellation** | ≤24h strike; 2 strikes/30d = 7-day suspension; no-show 30-day suspension, 2nd = blocked | Yellow badge (<48h, visible 1 month), red badge (<8h or no-show, 3 months); visible to companies, slows level progression and **hourly rate** |
| **No-show cover** | None guaranteed | None — "a Merytu não assegura a sua substituição" (cl. 7.2, business terms) |
| **Career mechanic** | Ratings + badges | **Levels**: more gigs + good ratings = higher hourly rate |
| **Insurance** | Company's legal work-accident insurance (employee) | Marketing: "seguro gratuito incluído". Terms: "A Merytu não é titular de uma apólice… A responsabilidade da apólice é inteiramente do Meryter" — see §5 |
| **Role list** | 35 titles across 8 categories | ~20 hospitality roles, finer-grained: empregado de balcão ≠ barman, sushiman, pizzaiolo, houseman, F&B host, bagageiro |
| **App rating** | — | 3.8★ iOS (106 ratings) |

---

## 3. Are they struggling to find workers?

**Short answer: not in headcount. Their problem is the gap between registered and working,
and the self-employed requirement is a large part of that gap.**

### What the numbers say

| Date | Registered workers | Companies | Other |
|---|---|---|---|
| Jul 2022 | 1,200 (+200/month) | 250+ | 1,200 invitations/day, accepted in <10 min |
| mid-2024 | 55,000 | 1,000+ | **~€100,000/month transaction volume**, business +70% YoY |
| Feb 2025 | 60,000 | ~1,000 | |
| Nov 2025 | 85,000 (+300% YoY) | ~1,500 | Revenue +118% YoY, team of 12 |

**Estimate (ours, not theirs):** €100k/month at a likely €11–14/h company price and a 4–8h gig
is roughly **1,500–2,000 gigs a month** across 55,000 registered workers. Even with generous
assumptions about gigs per worker, **only 1–3% of the registered base works in a given month**.
And registrations grow ~3× faster (+300%) than revenue (+118%), so that ratio is getting worse,
not better.

### What the CEO says

- Feb 2025: *"Enquanto os profissionais são mais ativos, as empresas ainda se mostram mais
  recetivas"* — i.e. by their own account the constraint is **demand**, not supply.
- 2021 app review: the gig goes to whoever taps fastest. Dec 2025 review: "Trabalho não falta".
  Both are signs of a **worker surplus** chasing gigs, at least in Lisbon/Porto hospitality.

### Where the self-employed model does hurt their supply

This part is reasoning from the legal mechanics, not something Merytu has published:

1. **Registration ≠ ability to work.** A registered user still has to open activity, link their
   Portal das Finanças, arrange insurance and a fitness certificate. Each step loses people.
   Merytu automating the activity opening is precisely the fix for their biggest leak.
2. **The month-13 cliff.** A first-time independent worker pays no SS for 12 months. In month 13
   they start owing ~21.4% on 70% of their income (≈15% of gross) plus quarterly declarations.
   The cheapest, easiest Merytu worker is one in their first year — which builds churn into
   the pool at exactly the point a worker has become experienced.
3. **The pool self-selects.** It is easiest for people who are *already* independent, or who
   accumulate with an employee job at another employer (SS exemption under 4× IAS), or students
   in year one. It is hardest for the person hotels most want for rotation: the experienced
   professional who wants a few extra shifts but doesn't want to run a one-person business.
4. **Immigrants need the right permit.** Non-EU workers need a residence permit that allows
   *independent* activity (cl. 3, worker terms). Under MCD, an employee-type permit suffices.
5. **No fill guarantee.** Merytu explicitly does not replace no-shows and does not promise a fill
   rate. With a surplus of registered workers that suggests the bottleneck is *reliable* workers
   for *specific* roles, not bodies.

**Conclusion for the pitch:** don't say "Merytu can't find workers" — they will answer with
85,000. Say: **"85,000 registered, a few hundred working. Ours don't have to open a business to
work a Saturday."**

---

## 4. The legal comparison

### 4.1 Merytu's exposure — art. 12.º-A CT

Since 1 May 2023 a contract of employment is **presumed** between a worker and a digital
platform when at least two indicators are present. Mapping them against Merytu's own terms
and site:

| Art. 12.º-A indicator | Merytu, as published |
|---|---|
| (a) Platform sets or limits the pay | Hourly price varies "por função, experiência" and **worker level**, which Merytu's progression system sets. Terms say the client sets the amount — the site says the level does |
| (c) Controls / verifies quality of the work | Check-in **and** check-out required; payment conditional on a quality rating (cl. 4, worker terms) |
| (d) Restricts autonomy through sanctions | Yellow/red badges reduce visibility to companies and **slow the hourly-rate progression** |
| (e) Disciplinary power, incl. deactivation | Suspension/exclusion, 12-month re-registration ban, permanent exclusion (cl. 16) |

**Indicators (b) and (f)** (direction of conduct, platform-owned equipment) look weak.
Merytu's defences are real: the worker chooses whether, when and for whom to work, there is no
exclusivity, and the CEO says there has been **no employment-recognition case since 2023**
and that they "had to restructure some processes" when the law came in. The presumption also
needs ACT or the worker to act. **This is a risk, not a verdict** — but it is a risk Turnos
does not carry at all, because Turnos's workers already *are* employees (of the company).

### 4.2 What changes on 2 December 2026

The **EU Platform Work Directive (2024/2831)** must be transposed by 2 Dec 2026 — six weeks
from this report. It (1) requires a legal presumption of employment where there is "control and
direction", and (2) regulates **algorithmic management** for *everyone* doing platform work:
transparency about automated decisions, human review, and no automated termination without
explanation. Portugal already has 12.º-A, so (1) is mostly in place; (2) is new for both
companies.

- Merytu: levels, badges and exclusion are automated decisions that will need explanations
  and human review. Their model of pricing-by-level is exactly what the Directive scrutinises.
- Turnos: already writes **statements of reasons** on every suspension/block
  (`users/restriction-notice.ts`), returns the **reason behind every match**
  (`skillMatch()` in shared) and offers human review in the privacy policy. That is a lead —
  worth checking against the final PT transposition text.

### 4.3 Three things in Merytu's terms worth knowing

1. **Insurance contradiction.** The site and app store promise "seguro gratuito incluído"; the
   worker terms (cl. 8, updated 19 Jun 2026) say Merytu holds no policy, only *facilitates
   access* to one (Generali), and that "a responsabilidade da apólice é inteiramente do
   Meryter". An accident on a gig is where that gap becomes a headline. Turnos's workers are
   covered by the company's mandatory work-accident insurance as employees.
2. **They hold the money.** Merytu captures 100% at booking and pays out weekly. That is a
   better worker experience than Turnos's direct payment (guaranteed weekly money), but it is
   payment-handling Turnos chose not to do (ADR 007) — and it puts Merytu squarely in the
   money flow of the work.
3. **"Clientes de Grande Volume".** For large clients Merytu invoices **in its own name**, with
   taxes and contributions included in the price. Selling labour hours under your own invoice
   is what a temporary-work agency does, and ETTs need a licence (DL 260/2009). **Question for
   the attorney, not a claim** — but if it holds, it is Merytu's soft spot with large hotel
   groups' compliance departments.

### 4.4 Turnos's own weak side in this comparison

Be honest about it in sales conversations — companies will raise it:

- **Cost.** Under MCD the company pays 23.75% TSU on top of gross; Merytu's company price is
  all-in. Turnos needs a calculator that shows *all-in hourly cost* next to the hourly rate.
- **Paperwork.** The company must admit the worker to Social Security itself before the shift
  (Turnos hands it the data; it doesn't file it). Merytu's company files nothing.
- **Caps.** MCD caps at 35 days/contract and 70 days/year with the same company. Merytu only
  sends a "recommendation" after 30 consecutive days.

---

## 5. Where Merytu is ahead

| | Merytu | Turnos |
|---|---|---|
| **Scale and logos** | 85k workers, 1,500 companies; Marriott, Corinthia, Moxy, Mercure, Vila Galé, WOW | Beta |
| **Distribution** | **Hotusa** as shareholder (hotel group + Keytel network), Zomato partnership, hotel-school partnerships (ISCE), tourism job fairs | One landing page |
| **Worker career** | Levels that raise the hourly rate — a reason to stay | Ratings and badges, no pay progression |
| **Weekly guaranteed payout** | Platform pays every Wednesday | Depends on the company paying (with Turnos's enforcement ladder) |
| **Cancellation deterrent** | 100% of the gig inside 24h | 2h minimum only for company error under 3h |
| **Role granularity** | Balcão vs barman, sushiman, pizzaiolo, houseman | Broader titles (see recommendation on skills) |
| **Company effort** | No contracts, no SS admission | Company admits the worker to SS |
| **No subscription** | Pay per gig | €45/mo entry barrier (same finding as the Shifty report) |

## 6. Where Turnos is ahead

| | Turnos | Merytu |
|---|---|---|
| **Worker status** | Employee: SS covered, no business to run, no month-13 bill | Self-employed: opens activity, pays own SS, buys own insurance |
| **Legal exposure** | No misclassification risk — the contract *is* employment | Art. 12.º-A presumption + Directive from Dec 2026 |
| **Company chooses** | Company reviews applicants and selects | First worker to accept |
| **Wage-neutral fee** | €3 fixed | Margin inside an hourly price — grows with the hour |
| **Sectors** | Retail, logistics, cleaning, admin live today | Entering logistics/retail in 2026 |
| **Algorithmic transparency** | Reasons on every match and restriction | Levels/badges with no published explanation |
| **Payment enforcement** | Reminders, posting block, proof, dispute | Not needed — they hold the money |
| **Attendance** | One scan | Check-in + check-out |

---

## 7. What to do with this

1. **Lead the worker pitch with status, not price.** "Contrato de trabalho, não recibos verdes.
   Sem abrir atividade, sem Segurança Social para pagar ao fim de um ano, sem seguro para
   comprar." The month-13 cliff is the specific moment to recruit Merytu's experienced workers.
2. **Lead the company pitch with December 2026.** The Platform Work Directive is the reason to
   prefer a model where the hire is a contract. Pair it with an **all-in cost calculator** so
   the TSU objection is answered on the same screen.
3. **Steal role granularity.** Split hospitality roles where the skill gap is real
   (empregado de balcão vs barman/bartender). Feeds directly into the skills redesign.
4. **Consider worker levels with a pay signal** — not set by Turnos (that is an 12.º-A
   indicator *and* contradicts ADR 001), but shown to companies as "nível" so they can choose
   to pay more for it.
5. **Revisit late-cancellation pricing.** Merytu's 100%-inside-24h is the market's reference
   now; Turnos's 10% fee / 2h minimum looks soft next to it.
6. **Shift length 4h–10h (decided by Juanes, 2026-10-17, not yet built).** Raise the 2h minimum
   to 4h and add a 10h maximum, matching Merytu. Unlike Merytu's self-employed gigs, Turnos
   shifts are employment, so anything above 8h is overtime and a long shift needs a break —
   see the Labour Code check before building.
7. **Copy the supply channels, not the model.** Hotel schools, tourism job fairs and a
   hotel-group partner are how they got to 85k.
8. **Add two questions to the attorney brief:** (a) Merytu's "Grande Volume" invoicing as
   unlicensed cedência — relevant only as competitive positioning; (b) what the PT transposition
   of 2024/2831 requires from Turnos's own automated decisions (suspensions, ranking).
9. **Watch:** logistics/retail launch (now direct competition on Turnos's non-hospitality
   sectors), Belgium/Spain, and whatever Hotusa brings in distribution.

---

## Sources

- [merytu.com](https://www.merytu.com/) · [/find-work](https://www.merytu.com/find-work) ·
  [/find-talent](https://www.merytu.com/find-talent) · [/press](https://www.merytu.com/press)
- [Termos e Condições para Empresas](https://www.merytu.com/legal/terms-conditions/terms-conditions-for-businesses)
- [Termos e Condições para Profissionais](https://www.merytu.com/legal/terms-conditions/terms-conditions-for-professionals) (updated 19 Jun 2026)
- [App Store — merytu](https://apps.apple.com/pt/app/merytu/id1498964528)
- [ECO, 28 Nov 2025 — interview: logistics, regulation, 85k](https://eco.sapo.pt/entrevista/apos-sucesso-no-turismo-merytu-vai-ligar-trabalhadores-a-empresas-da-distribuicao-e-logistica/)
- [Jornal Económico, 11 Sep 2026 — internationalisation and retail](https://jornaleconomico.sapo.pt/noticias/portuguesa-merytu-prepara-internacionalizacao-e-entrada-no-retalho/)
- [Jornal Económico, 17 Feb 2025 — 60k professionals](https://jornaleconomico.sapo.pt/noticias/merytu-soma-mais-de-60-mil-profissionais-que-querem-flexibilidade-na-hotelaria/)
- [RH Magazine — 55k, €100k/month volume](https://rhmagazine.pt/merytu-ja-conta-com-55-000-profissionais-inscritos/)
- [ECO, 10 Aug 2022](https://eco.sapo.pt/2022/08/10/merytu-faz-o-match-entre-profissionais-independentes-e-empresas-de-hotelaria-e-restauracao/) ·
  [Dinheiro Vivo, 30 Jul 2022](https://dinheirovivo.dn.pt/fazedores/merytu-a-tecnologia-lusa-que-faz-matching-entre-empresas-e-freelancers-15056637.html) ·
  [ECO — Algarve, Jul 2023](https://eco.sapo.pt/2023/07/19/merytu-chega-ao-algarve-para-ligar-talento-a-setor-turistico/)
- [Art. 12.º-A Código do Trabalho](https://informador.pt/legislacao/lexit/codigos/direito-laboral/codigo-do-trabalho/livro-i-parte-geral-2/titulo-ii-contrato-de-trabalho/capitulo-i-disposicoes-gerais-46/seccao-i-contrato-de-trabalho/artigo-12-o-a-presuncao-de-contrato-de-trabalho-no-ambito-de-plataforma-digital/) ·
  [Acórdão RC 13 Jun 2025](https://diariodarepublica.pt/dr/detalhe/acordao/167-2025-930012975)
- [DECO — obrigações dos trabalhadores independentes](https://www.deco.proteste.pt/dinheiro/impostos/noticias/recibos-verdes-obrigacoes-trabalhadores-independentes-seguranca-social) ·
  [CGD — isenção de contribuições](https://www.cgd.pt/Site/Saldo-Positivo/protecao/Pages/isencao-contribuicoes-seguranca-social.aspx)

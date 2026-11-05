# Google Play — store listing text

Paste into Play Console → Grow users → Store presence → **Main store listing**
(default language pt-PT), then **Manage translations → English (United States)**.
Character limits: name 30 · short 80 · full 4,000. Counts checked 2026-11-04.

No city names (Juanes, 2026-11-04): the listing must not need editing as
Turnos expands beyond Lisbon. Every claim here is backed by the code — check `docs/brand/COPY_BANK.md` §B
before adding one. Never promise **when** a worker is paid (the company pays
directly; Turnos does not control timing), and never "garantimos/processamos o
pagamento".

---

## Português (Portugal) — default

**Nome:** Turnos

**Descrição breve:**

```
Turnos curtos perto de ti. Vê o valor por hora e candidata-te num toque.
```

**Descrição completa:**

```
Transforma o teu tempo livre em dinheiro extra.

A Turnos mostra-te turnos curtos em empresas perto de ti: restauração, hotelaria, eventos, retalho, logística e mais. Escolhe os que te dão jeito, trabalha, recebe.

COMO FUNCIONA
• Vê os turnos perto de ti, com o local, o horário e o valor por hora em cada cartão.
• Candidata-te num toque. Num trabalho de vários dias, uma só candidatura serve para todos os dias.
• A empresa escolhe quem contrata e tu confirmas.
• No dia, lês o QR code à entrada e estás de turno. O turno fecha sozinho à hora de fim.
• Recebes diretamente da empresa, pelo método indicado no turno.

PORQUÊ A TURNOS
• Grátis para trabalhadores. Sem comissões, nunca.
• Mandas tu: indica os dias em que estás livre, ou desliga quando estiveres ocupado.
• Mostra o que sabes fazer: funções, nível, tarefas, idiomas e CV.
• Adiciona os turnos ao calendário e recebe lembretes antes de começar.
• Avaliações nos dois sentidos e regras de cancelamento claras para todos.
• A empresa que te contrata é a tua entidade empregadora e trata das obrigações legais dela.

PARA QUEM
• Maiores de 18 anos.

És uma empresa? Publica turnos no painel em turnos.cc.

Dúvidas: contact@turnos.cc
A Turnos é uma marca de NESTS ALLEY, LDA.
```

**Notas da versão (1.0.0):**

```
Primeira versão da Turnos.
```

---

## English (United States) — translation

**Name:** Turnos

**Short description:**

```
Short shifts near you. See the hourly pay upfront and apply in one tap.
```

**Full description:**

```
Turn your free time into extra money.

Turnos shows you short shifts at companies near you: restaurants and cafés, hotels, events, retail, logistics and more. Pick the ones that suit you, work, get paid.

HOW IT WORKS
• Browse shifts near you, with the place, the hours and the hourly pay on every card.
• Apply in one tap. For a multi-day job, one application covers every day.
• The company picks who it hires, and you confirm.
• On the day, scan the QR code at the door and you're on shift. It closes on its own when it ends.
• Get paid directly by the company, by the method shown on the shift.

WHY TURNOS
• Free for workers. No commission, ever.
• You're in charge: set the days you're free, or switch it off when you're busy.
• Show what you can do: roles, level, tasks, languages and CV.
• Add your shifts to your calendar and get reminders before they start.
• Reviews both ways, and clear cancellation rules for everyone.
• The company that hires you is your employer and handles its own legal obligations.

WHO IT'S FOR
• People aged 18 and over.

Are you a company? Post shifts from the dashboard at turnos.cc.

Questions: contact@turnos.cc
Turnos is a brand of NESTS ALLEY, LDA.
```

**Release notes (1.0.0):**

```
First release of Turnos.
```

---

## App Store (Apple) — fields Google doesn't have

Description and release notes: reuse the texts above. Limits: subtitle 30,
keywords 100 (comma-separated, **no spaces after commas**), promotional text 170
(editable any time without a new review). Counts checked 2026-11-05.

Keywords never repeat words already in the name or subtitle (Apple indexes
those), and never use "freelance", "recibos verdes" or "gig": workers are
employees on MCD contracts, not self-employed (ADR 001). No city names.

| Field | Português (Portugal) | English (U.S.) |
|---|---|---|
| Subtitle | `Trabalho flexível perto de ti` (29) | `Flexible shifts near you` (24) |
| Keywords | `emprego,part-time,biscates,dinheiro extra,restauração,hotelaria,eventos,barista,empregado de mesa` (97) | `jobs,part-time,side job,extra money,hospitality,restaurant,waiter,barista,events,hotel,warehouse` (96) |
| Promotional text | `Turnos perto de ti, com o valor à vista. Transforma o teu tempo livre em dinheiro extra. Escolhe um turno, trabalha, recebe. Grátis para trabalhadores, sempre.` (159) | `Shifts near you, with the pay shown upfront. Turn your free time into extra money. Pick a shift, work, get paid. Free for workers, always.` (138) |

Tone (Juanes, 2026-11-05): short and upbeat ("turn your free time into extra
money", "pick a shift, work, get paid"); leave the payment mechanics out of the
promotional text. Write "money", never "cash" — cash payment was retired
2026-07-29 and "cash" reads as a promise of it.

Header image (custom product-page header): `out/app-store-header-<size>-<lang>.png`,
generated by `build.py` in both accepted sizes (5244×2950, 3840×1646).

---

## Graphics

Generated by `build.py` into `out/` (icon 512×512, feature graphic 1024×500,
screenshots 1080×1920). Screenshots need fresh raw captures in `raw/` — see the
docstring in `build.py`. Suggested set, in order:

| # | Screen to capture (Android, app in Portuguese, real-looking data) | Caption |
|---|---|---|
| 01 | Shifts feed — list with several shifts | Turnos perto de ti, com o valor à vista |
| 02 | Shift detail — place, hours, gross rate | Vê o local, o horário e o valor antes de te candidatares |
| 03 | Profile — availability switch and day chips | Tu decides quando trabalhas. Desliga quando estás ocupado |
| 04 | My shifts — completed shifts with "received ✓" | Recebes o valor bruto, pago pela empresa |
| 05 | Earnings | Grátis para trabalhadores. Sem comissões |
| 06 | (optional) QR scan screen | Um scan à entrada e estás de turno |

**First set (2026-11-04)** was captured with the app in English, from test data
(lower-case "warehouse assistant", "Wharehouse" typo, €6/h, "Lisbon" in the
header and bio). Fine for launch; retake in Portuguese with cleaner shifts when
convenient. Screen 05 still shows the old Pay Link text promising "1–2 working
days" — removed from the app on 2026-11-04 (next build); retake 05 after that.

Tablet, Chromebook, Android XR assets: **not required** — leave empty. The app
is phone-only.

---

## Privacy declarations — Google Data safety ↔ Apple App Privacy

Source of truth: the Play Console export `data_safety_export.csv` (beside this
file, 2026-11-05). Both stores must say the same thing — **change both, and
re-export the CSV, whenever the app starts collecting something new.**

Global answers: data collected **yes**; encrypted in transit **yes**; account
creation "username and other authentication" (phone + SMS code); deletion URL
`https://turnos.cc/eliminar-conta`. Apple: **linked to the user's identity = yes**
and **used for tracking = no** for every type below. Apple has no "account
management" or "fraud prevention" purpose — both fall under **App Functionality**,
as do the transactional emails Google lists as "developer communications".

| Google Data safety | Required? | Apple App Privacy | Purpose (Apple) | What it is in Turnos |
|---|---|---|---|---|
| Name | required | Contact Info → Name | App Functionality | worker name |
| Email address | optional | Contact Info → Email Address | App Functionality | contact email |
| Phone number | required | Contact Info → Phone Number | App Functionality | sign-in, companies contact the worker |
| User IDs | required | Identifiers → User ID | App Functionality | account id |
| Device or other IDs | required | Identifiers → Device ID | App Functionality | push token |
| Other info (shared) | required | Other Data → Other Data Types | App Functionality | NIF, date of birth |
| User payment info | required | Financial Info → Payment Info | App Functionality | IBAN |
| Other financial info (shared) | required | Financial Info → Other Financial Info | App Functionality | wages, payment records and proofs |
| Precise location | required | Location → Precise Location | App Functionality | at the QR check-in only (geofence) |
| Other in-app messages (shared) | optional | User Content → Other User Content | App Functionality | cover note, cancellation reasons |
| Photos (shared) | optional | User Content → Photos or Videos | App Functionality | profile photo |
| Health info | optional | Health & Fitness → Health | App Functionality | illness given as a late-cancellation reason |
| Files and docs (shared) | optional | User Content → Other User Content | App Functionality | CV, licence documents |
| Other user-generated content (shared) | optional | User Content → Other User Content | App Functionality | bio, roles, reviews |

Not collected on either store: address, contacts, calendar (events are written
to the phone, never read or uploaded), browsing/search history, crash logs or
diagnostics, analytics, advertising data.

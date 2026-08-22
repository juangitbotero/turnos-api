# Turnos — copy bank

Worker-facing headlines for ads, social and the waiting list. English, matching
the landing page.

Every line here has been checked against what the code actually does. Before
adding one of your own, read §6 of [`CAMPAIGN_SYSTEM.md`](./CAMPAIGN_SYSTEM.md)
— the 2026-07 pivot retired a set of claims that are very easy to reach for and
are now false.

**The test that matters:** *could a competitor run this line unchanged?* If yes,
it is too generic. Rewrite until it is about the reader's actual evening.

| Column | Meaning |
|---|---|
| **Motif** | Suggested icon from `ad-campaign/graphics/` |
| **Dir** | 1 Quiet Signal · 2 Drawn · 3 In Hand |
| **Backed by** | What makes the claim safe to publish |

---

## A. The invisible opportunity

The strongest angle Turnos has: work that already exists, near you, that nobody
told you about. Specific, observational, impossible for a competitor to copy
without sounding like an imitation.

| # | Headline | Supporting line | Motif | Dir |
|---|---|---|---|---|
| 1 | **There are cafés on your street that need someone this week.** | Nobody's told you. | `dot` | 1 |
| 2 | **The café two streets away is short tonight.** | See the place, the hours and the pay before you apply. | `cup` | 2 |
| 3 | **Somewhere on your street, a shift just opened.** | You'd never know. That's the problem we're fixing. | `pin` | 1 |
| 4 | **A free Saturday is a shift you haven't taken yet.** | Only if you want it. That's the whole point. | `calendar` | 2 |

*Backed by:* proximity sort (PostGIS), Lisbon beta. No volume claims made.

## B. Money — what it costs you

Turnos's clearest structural advantage over a percentage-commission competitor.
Say it plainly; it is the one thing they cannot say back.

| # | Headline | Supporting line | Motif | Dir |
|---|---|---|---|---|
| 5 | **We take nothing from your pay.** | No signup fee, no commission, no cut per shift. | `coin` | 2 |
| 6 | **You receive the full gross.** | The company pays you directly. Turnos never holds your wages. | — | 3 |
| 7 | **Know the pay before you say yes.** | Gross hourly rate on every shift card. Always. | `clock` | 2 |
| 8 | **Every shift shows the pay.** | On the card, before you apply. Not after. | — | 3 |
| 9 | **Free for workers. Now and always.** | Not a trial, not an introductory rate. | `coin` | 1 |
| 10 | **Paid by the place you worked for.** | Turnos is not an agency and never touches your wages. | `apron` | 2 |

*Backed by:* `TURNOS_FEE_FIXED_EUR` (company-side only) · ADR 007 · Agenda do
Trabalho Digno gross-rate requirement.

⚠️ Never extend these into **when** you get paid. No "next day", no "within X
days". The company settles directly and Turnos does not control the timing.

## C. Control — your week, your call

| # | Headline | Supporting line | Motif | Dir |
|---|---|---|---|---|
| 11 | **Work Thursday. Skip Friday.** | Take the shifts that fit around your life. Nobody asks why. | `calendar` | 2 |
| 12 | **Switch it off when you're busy.** | Companies only find you on the days you choose. | — | 3 |
| 13 | **Pick the shift, not the whole job.** | Short contracts, properly done. No open-ended commitment. | `cloche` | 2 |
| 14 | **The shift is six hours. Deciding takes thirty seconds.** | Everything you need to know is on the card. | `phone` | 2 |

*Backed by:* `Worker.isAvailableForWork` + `availableDays` · MCD short-duration
contracts.

## D. Simplicity — the friction that isn't there

| # | Headline | Supporting line | Motif | Dir |
|---|---|---|---|---|
| 15 | **One scan and you're on shift.** | No paperwork at the door. The shift closes itself when it ends. | `qr` | 2 |
| 16 | **No interview. No agency. Just the shift.** | You're hired by the company, not placed by a middleman. | `apron` | 2 |
| 17 | **Find it, take it, show up.** | The whole thing lives in your pocket. | `phone` | 3 |
| 18 | **Two-day jobs. One application.** | Apply once and the whole run is yours. | `calendar` | 3 |

*Backed by:* ADR 008 single check-in QR + auto-completion · ADR 007
non-intermediary position · multi-day `seriesId` all-or-nothing apply.

## E. Reputation — why it's worth doing well

| # | Headline | Supporting line | Motif | Dir |
|---|---|---|---|---|
| 19 | **Do it well. Get asked back.** | Ratings and badges follow you to the next company. | `star` | 2 |
| 20 | **Your experience counts from day one.** | Five years behind a bar is a qualification. Put it on the profile. | `tray` | 3 |
| 21 | **Build a reputation you can take anywhere.** | Every completed shift adds to a profile companies can see. | `star` | 1 |

*Backed by:* two-way ratings (`Rating` entity) · badges `TOP_RATED` `RELIABLE`
`VERIFIED` · `Worker.experiences`.

## F. The trade — who this is for

| # | Headline | Supporting line | Motif | Dir |
|---|---|---|---|---|
| 22 | **Bar, kitchen, floor, events.** | Eight sectors of work you already know how to do. | `tray` | 2 |
| 23 | **You already know how to do this.** | No training course, no onboarding programme. Just the shift. | `chefHat` | 2 |
| 24 | **Shifts on your street, not across town.** | Sorted by how far you'd actually have to walk. | `pin` | 3 |

*Backed by:* `SHIFT_CATEGORIES` — eight categories · proximity sort.

---

## Use with care

**#25 — "Rent's due Friday. There's a shift Thursday."**

The sharpest line available and deliberately not filed above. It converts,
because it is true for a lot of the audience. It also trades on financial
pressure, which is a different thing from the confident register the rest of this
system holds.

If it runs, run it *alone* — never in a set beside the lighter lines, where the
tonal jump makes the whole grid read as manipulative. Worth an A/B test against
#4, which reaches for the same moment from the opposite direction.

---

## Lines that were rejected, and why

Recording these so they don't get reinvented.

| Line | Why not |
|---|---|
| "Get paid fast" / "Paid next day" | **False since ADR 007.** Turnos never holds wages and does not control timing |
| "Your Saturday is worth more than you think" | Implies Turnos raises your rate. It doesn't — companies set the pay |
| "98% of shifts filled" / any figure | No beta data. Inventing one is the fastest way to lose a compliance argument |
| "The best shifts go in minutes" | Urgency with nothing behind it. Would need real fill-time data |
| "No CV needed" | CV upload exists and is worth 10 profile points. Reads as contradicting the app |
| "We find you work" | Positions Turnos as an intermediary — the exact claim ADR 007 exists to avoid |
| "Find flexible work near you" | Fails the competitor test. Any of them could run it unchanged |

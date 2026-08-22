# Turnos — campaign system

> The mood, written down tightly enough that a new variant is a **derivation**
> rather than a fresh act of taste.
>
> `DESIGN_SYSTEM.md` governs the product UI. This governs everything that
> speaks *about* Turnos: ads, social, landing pages, decks, one-pagers.

There are two records of this system and they are not interchangeable:

| | Where | What it holds |
|---|---|---|
| **This document** | `docs/brand/CAMPAIGN_SYSTEM.md` | The judgement — why the rules are the rules |
| **The generator** | `scripts/ad-campaign/` | The mechanism — palette, layout maths, motif library, copy specs |

A rule that lives only here will drift. A rule that lives only in code cannot be
argued with. Both, or neither.

---

## 1. The mood, in one paragraph

**Quiet confidence.** Turnos does not shout, crowd, or decorate. One idea per
frame, stated plainly, surrounded by enough space that it cannot be mistaken for
noise. The tone is a competent colleague telling you something useful — never a
brand performing enthusiasm. Where competitors use gradient, exclamation and
stock photography, Turnos uses restraint, and reads more expensive for it.

The register is **specific, never generic**. "There are cafés on your street
that need someone this week" beats "Find flexible work near you", because the
first is an observation about the reader's life and the second is a category
description. Every headline should fail this test if it could appear, unchanged,
in a competitor's ad.

---

## 2. Non-negotiables

Break any of these and it stops being Turnos.

1. **One accent per frame.** `#6A79FF` marks the single thing that matters —
   usually the signal and the CTA. The moment it decorates, it stops signalling.
2. **The wordmark is placed, never typed.** It is ITC Bauhaus, a licensed
   Monotype family we do not hold a file for. Always place
   `apps/web-admin/public/logo.png`, recoloured through its own alpha. **Never
   substitute Bauhaus 93** — it is a different, much heavier face and reads
   visibly wrong.
3. **Negative space is protected, not leftover.** Every composition centres its
   content group in the band between the index label and the footer rule. Slack
   is distributed, never pooled at one end.
4. **No claim the code does not support.** See §6.
5. **No emoji.** Ever, in campaign work. The product's `mobile` namespace keeps
   them deliberately; marketing does not. Use the motif library.

---

## 3. Palette

| Token | Hex | Role |
|---|---|---|
| ink | `#14141F` | Dark ground, body text on light |
| paper | `#FAFDFF` | Light ground — brand Turnos White |
| tint | `#EEF0FF` | Warm ground — brand Primary Light |
| accent | `#6A79FF` | The signal. Rationed. Brand Turnos Blue |
| grey | `#D9D9D9` | Rules and dividers |

⚠️ **`#14141F` is not the product's `#1a1a2e`.** It is deeper and cooler, so the
accent reads brighter in a feed. This is a deliberate campaign-only divergence,
and it is the one open question in this document — either standardise the
product on it or accept the split knowingly. Do not let a third value appear.

Grounds rotate `tint → paper → ink` across a set so a grid of variants has
rhythm without any single one breaking the family.

## 4. Type

| Role | Face | Notes |
|---|---|---|
| Wordmark | ITC Bauhaus | Placed as artwork, never set |
| Headline | Outfit Bold | Geometric monoline; harmonises with Bauhaus without impersonating it |
| Supporting | Outfit Regular | 68% opacity against the ground |
| Index label | Geist Mono | Tracked open, ~55% opacity — the clinical register |

The gap between headline and index label is **dramatic, never moderate**. A
timid size ratio is the most common way this system is executed badly.

## 5. Composition skeleton

Every asset, all three formats, same bones:

```
  INDEX LABEL                     mono, tracked, quiet
        ┌──────────────┐
        │  the mark    │          motif or illustration
        └──────────────┘          } centred as ONE group
  Headline, two or                } in the band between
  three lines.                    } label and rule
  Supporting line, quieter.
  ─────────────────────────       hairline
  [wordmark]        (CTA pill)
```

Type is sized from the **width**; vertical rhythm is distributed across the
**actual band**. Deriving both from the square and stretching is what left a
500px void at the foot of every 9:16 in the first pass.

| Format | Size | Placement |
|---|---|---|
| Square | `1080×1080` | General purpose, works everywhere |
| **Portrait** | `1080×1350` | **Meta feed — occupies more vertical space than 1:1 and usually wins on cost per result** |
| Story | `1080×1920` | Reels, Stories |

Anything sized from the vertical band must be **capped against the width too**.
The in-hand device frame was not, so at 4:5 it grew until it ran 43px off the
right edge — a bug that only appears on the middle format.

**Editable templates** for hand-editing in Canva live in
`docs/brand/ad-campaign/templates/` (`npm run templates` to regenerate). They
are PPTX because the generator outlines every glyph, so a PDF from it would
carry un-editable text.

## 6. Copy rules

The 2026-07 pivot (`docs/adr/007-business-model-pivot.md`) retired claims that
are easy to reach for and are now false.

**Never:**
- Payment-speed promises — no "paid next day", "T+1", "recebe amanhã"
- "We process / guarantee / handle your payment" in any form
- Invented statistics — fill rates, worker counts, response times. There is no
  beta data behind them yet
- Anything implying Turnos is an agency or intermediary — that is the whole
  point of ADR 007

**Safe, because the code does it:**

| Claim | Backed by |
|---|---|
| Gross hourly rate visible before applying | Agenda do Trabalho Digno, on every shift card |
| Free for workers — no fee, commission or cut | `TURNOS_FEE_FIXED_EUR`, company-side only |
| One scan, no check-out | ADR 008 — auto-completes at scheduled end |
| Eight sectors | `SHIFT_CATEGORIES` in `packages/shared` |
| Reputation follows you | two-way ratings, `Rating` entity |
| The company hires and pays you directly | ADR 007 |

**Headline test:** could a competitor run this line unchanged? If yes, it is too
generic. Rewrite until it is about the reader's actual evening.

**24 approved headlines with supporting lines, grouped by angle, live in
[`COPY_BANK.md`](./COPY_BANK.md)** — along with the lines that were rejected and
why, so they do not get reinvented.

## 7. The motif library

`docs/brand/ad-campaign/graphics/` — 17 marks, transparent PNG + SVG.

- **line** — drawn monoline illustration, 100×100 normalised, stroke-based so
  one definition scales from chip to hero: cup, cocktail, cloche, chefHat, tray,
  pin, clock, qr, calendar, coin, apron, phone, star
- **signal** — the abstract marks: dot (the lit point and its field), radar,
  field, noise

Prefer SVG. Add new motifs to `scripts/ad-campaign/icons.js` rather than drawing
one-offs — and **render any new mark in the specimen sheet before shipping it**.
Two of the first batch failed there: `handshake` drew as two meaningless
hexagons, and `bell` was pixel-for-pixel the same dome-and-line as `cloche`. Two
motifs that render alike are one motif.

## 8. The three directions

All three share §3–§5 exactly. They differ only in what occupies the mark slot.

| | Mark | Reads as | Best for |
|---|---|---|---|
| **1 · Quiet Signal** | Abstract — the lit dot, the field | Restrained, technical | Brand, the opening statement |
| **2 · Drawn** | Line illustration | Warm, editorial, human | The trade, the offer, the promise |
| **3 · In Hand** | Real app UI, one detail magnified | Concrete, proof-led | "It exists and here is the screen" |

Direction 3 magnifies a **real crop** of a screenshot and ties it back to its
source on the device with a ring and a connector, so the reader can see exactly
where the detail came from. The device frame is **drawn, not photographed** — a
photoreal mockup drags in gradient, reflection and shadow, which is the register
this system is defined against.

## 9. Adding a variant

```bash
cd scripts/ad-campaign
npm install            # first time only
node build.js          # all three directions, all three formats
node build.js drawn    # one direction
node build.js in-hand P   # one variant
```

- **Directions 1 & 2** — append one object to `SPECS` in
  `directions/drawn.js`: `{ id, ground, icon, kicker, headline, sub }`.
- **Direction 3** — append to `directions/in-hand-specs.js` with a `shot`, a
  `layout` (`callout` · `hero` · `bleed`) and a `crop` in **fractions** of the
  source image. Fractions, never pixels — a screenshot re-exported at another
  device resolution still lands on the right control.

Layout, all three formats, overflow guards and the footer come for free.

**The generator is the source of truth for the assets.** Never hand-edit an
exported PNG; the next rebuild silently discards it.

---

## 10. Traps that already cost time

- **opentype.js corrupts its cached glyph state** across repeated `getPath()`
  calls and starts returning `NaN` coordinates. An SVG parser halts at the first
  invalid token and *still renders everything before it*, so the symptom is a
  silently truncated word — no error, a perfectly valid-looking PNG. Fixed by
  resolving each glyph outline once and positioning with transforms. If type
  ever comes out clipped mid-word, this is why.
- **sharp scales SVG input by `density / 72`.** The default 300 rendered a
  1080px canvas at 4500px and took minutes per file. Author at exact pixel size
  and pass `density: 72`.
- **"NaN" appears legitimately inside base64 image payloads**, so a
  whole-document scan for it false-positives. Scope the check to `d="…"`.
- **`docs/brand/turnos-logo.png` is a 0-byte file** — the embed in
  `DESIGN_SYSTEM.md` is broken. Use `apps/web-admin/public/logo.png`.

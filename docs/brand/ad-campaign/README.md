# Turnos — waiting-list ad campaign

Creative for the worker waiting list at <https://turnos.systeme.io/en/turnos>.
English, because the landing page is English. Every asset is built from code in
one pass, so the whole set can be regenerated with a copy change rather than
re-edited by hand.

```
01-quiet-signal/   Direction 1 — typographic, abstract marks       5 concepts × 2 sizes
02-drawn/          Direction 2 — line illustration, warm grounds  10 variants × 2 sizes
03-in-hand/        Direction 3 — real app UI, detail callouts     12 variants × 2 sizes
graphics/          The motif library, transparent PNG + SVG       17 motifs × colourways
screenshots/       Source screens for Direction 3                 drop new exports here
```

Each direction folder has a `_contact-sheet.png` showing everything at a glance.

## `templates/` — editing in Canva without touching this repo

Two `.pptx` files, 8 slides each: a guide slide plus 7 templates covering all
three directions across their grounds.

**Upload to Canva** → *Create a design* → *Import file*. Canva converts
PowerPoint into a fully editable design: live text boxes, movable shapes,
correct 1080×1080 / 1080×1920 canvas.

PPTX rather than PDF or SVG, for a specific reason. The main generator
**outlines every glyph** — that is what fixed the opentype NaN bug — so a PDF
exported from it would arrive in Canva as un-editable vector shapes. And Canva
takes SVG as an *element*, never as an editable layout. PPTX is the only route
that keeps text as text.

**Fonts.** The templates declare `Outfit` and `Geist Mono` by name. Both are SIL
OFL and copies live in `scripts/ad-campaign/fonts/` — upload them to Canva's
Brand Kit (Pro) and every slide matches exactly with no further work. Without
that, Canva substitutes; the guide slide carries the fallback ladder.

The **wordmark is an embedded image**, not text, so no font substitution can
break it. That is deliberate: it is ITC Bauhaus, which we do not hold a licence
file for.

Regenerate with `npm run templates` after changing the skeleton, so the
templates keep matching what the generator actually produces.

**The generator lives in `scripts/ad-campaign/`.** Rebuild everything with
`node build.js`, or one direction with `node build.js in-hand`. The mood and its
rules are written down in [`../CAMPAIGN_SYSTEM.md`](../CAMPAIGN_SYSTEM.md).

## Direction 3 — two things to check before running these

- **`04-my-shifts.PNG` shows `Demo ·` on every card** — rows from the video
  seeder (`docs/go-live-cleanup.md`). It is used only for tight crops that
  exclude those lines, never as a full-screen device shot. Re-export that screen
  from a clean account to unlock it properly.
- **`01-map.PNG` carries Apple Maps attribution.** Apple restricts Maps imagery
  in paid advertising. Confirm before running `T-on-the-map` or
  `U-lisbon-tonight`.

Callout crops are stored as **fractions** of the source image in
`directions/in-hand-specs.js`, so re-exporting a screenshot at a different
device resolution does not break them — only a layout change to the screen
itself would.

---

## Palette

These are the exact values used. Two of them are **not** the ones in
`DESIGN_SYSTEM.md`, and that is a decision to confirm, not an accident.

| Token | Hex | Where | Note |
|---|---|---|---|
| ink | `#14141F` | dark grounds, body text | **Deeper and cooler than the brand `#1a1a2e`** — makes the blue read brighter in a feed |
| paper | `#FAFDFF` | light grounds | brand Turnos White, unchanged |
| tint | `#EEF0FF` | warm ground in `02-drawn` | brand **Primary Light**, already used for chips and tags |
| accent | `#6A79FF` | the signal, CTA pill, all illustration | brand Turnos Blue, unchanged |
| grey | `#D9D9D9` | rules, dividers | brand Turnos Grey, unchanged |

The accent is deliberately rationed: **one accent element per composition**,
usually the lit mark plus the CTA. It stops being a signal the moment it is
everywhere.

## Type

| Role | Face | Why |
|---|---|---|
| Wordmark | **ITC Bauhaus** | Placed from `apps/web-admin/public/logo.png`, never re-typed |
| Headline | Outfit Bold | Geometric monoline — harmonises with ITC Bauhaus without impersonating it |
| Supporting | Outfit Regular | |
| Index labels | Geist Mono | The clinical register against the display gesture |

**The wordmark is never set as live text.** ITC Bauhaus is a licensed Monotype
family and is not on this machine, so every asset places the real logo bitmap,
recoloured through its own alpha channel. If the licence file ever lands here,
that is the one thing worth revisiting. Do **not** substitute Bauhaus 93 — see
`../DESIGN_SYSTEM.md`.

---

## `graphics/` — the motif library

Every mark is authored in a normalised 100×100 box and drawn with **strokes**,
so one definition scales from a 40px chip to a 900px hero. Both formats ship:

- **`.svg`** — resolution-independent, recolourable. Prefer this everywhere it works.
- **`.png`** — 512×512, **transparent background**, for tools that will not take SVG.

| Family | Motifs | Colourways |
|---|---|---|
| line | cup, cocktail, cloche, chefHat, tray, pin, clock, qr, calendar, coin, apron, phone, star | `blue` `ink` `white` |
| signal | dot, radar, field, noise | `on-dark` `on-light` |

`signal/dot` is the lit mark from concept A — the accent point with its rings
and the pale field around it. `signal/field` and `signal/noise` are the
background textures from concepts A and C, isolated so they can be reused as
full-bleed layers.

---

## Copy rules — read before writing a new headline

The 2026-07 pivot (`docs/adr/007-business-model-pivot.md`) retired a set of
claims that are easy to reach for and are now false. Nothing in this campaign
says any of them:

- **No payment-speed promises.** No "paid next day", no "T+1", no "recebe
  amanhã". Turnos never holds wages; the company pays the worker directly.
- **No "we process / guarantee your payment"** in any form.
- **No invented statistics.** No fill rates, no worker counts, no response
  times — there is no beta data to support them yet.

What the copy *can* say, because the code does it:

| Claim | Backed by |
|---|---|
| Gross hourly rate visible before applying | Agenda do Trabalho Digno requirement, on every shift card |
| Free for workers, no commission, no cut | `TURNOS_FEE_FIXED_EUR` — company-side only |
| One scan, no check-out | ADR 008 — shift auto-completes at its scheduled end |
| Eight sectors | `SHIFT_CATEGORIES` in `packages/shared` |
| Reputation follows you | two-way ratings, `Rating` entity |

---

## Regenerating

The build scripts live in the session scratchpad, not in this repo — these are
outputs. If the set needs rebuilding with new copy, the specs are one array per
direction and the layout code distributes everything from the canvas dimensions,
so 1080×1080 and 1080×1920 both come out balanced without hand-tuning.

One defect is worth knowing about if that code is ever revived: **opentype.js
corrupts its cached glyph state across repeated `getPath()` calls and starts
emitting `NaN` coordinates.** An SVG parser halts at the first invalid token and
still renders everything before it, so the symptom is a *silently truncated
word* — no error, no warning, a perfectly valid-looking PNG. It is fixed by
resolving each glyph outline exactly once and positioning with transforms.

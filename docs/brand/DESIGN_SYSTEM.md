# Turnos — Brand & Design System

> **This document is the single source of truth for all UI decisions across `apps/mobile`, `apps/web-admin`, and any future Turnos surface.**
> Every developer building UI must reference this file before writing any styles.

---

## Logo

![Turnos Logo](./turnos-logo.png)

**Rules:**
- Always use on **white (`#fafdff`) background**
- Never add shadows, outlines or effects to the logo
- Never change the logo color — it is always `#6a79ff`
- Minimum size: 80px wide (mobile) / 120px wide (web)
- File: `docs/brand/turnos-logo.png`

---

## Color Palette

| Role | Name | Hex | Usage |
|---|---|---|---|
| **Primary** | Turnos Blue | `#6a79ff` | Buttons, links, active states, icons, logo, brand moments |
| **Secondary** | Turnos White | `#fafdff` | All backgrounds (screens, cards, modals) |
| **Neutral** | Turnos Grey | `#d9d9d9` | Dividers, borders, disabled states, subtle UI elements |

### Extended Palette (derived from primary)

| Role | Hex | Usage |
|---|---|---|
| Primary Dark | `#5260e0` | Pressed button state, hover on web |
| Primary Light | `#eef0ff` | Chip backgrounds, tag backgrounds, highlight rows |
| Text Primary | `#1a1a2e` | All main body text, headings |
| Text Secondary | `#6b7280` | Subtitles, captions, placeholder text |
| Success | `#22c55e` | Shift confirmed, payment received, check-in success |
| Warning | `#f59e0b` | Approaching MCD limit, low reputation score |
| Error | `#ef4444` | Validation errors, failed payment, auto-suspension |

---

## Typography

| Level | Size | Weight | Usage |
|---|---|---|---|
| H1 | 28px / 32sp | 800 ExtraBold | Screen titles |
| H2 | 22px / 24sp | 700 Bold | Section headings |
| H3 | 18px / 20sp | 600 SemiBold | Card titles, modal headers |
| Body | 15px / 16sp | 400 Regular | All body copy |
| Caption | 12px / 13sp | 400 Regular | Timestamps, labels, tags |
| Button | 15px / 16sp | 600 SemiBold | All button labels |

**Font family:**

| Role | Typeface | Where |
|---|---|---|
| **Brand / display** | **ITC Bauhaus** | Logo, marketing, ad creative, campaign headlines |
| Product UI — web | `Inter` (Google Fonts) | imported in `layout.tsx` |
| Product UI — mobile | System font (SF Pro on iOS, Roboto on Android) | `fontFamily: 'System'` |

**ITC Bauhaus is the brand typeface.** The wordmark is set in it (Medium weight —
monoline geometric, single-storey `u`, circular `o`). It is a **licensed Monotype
family**, not a free font, so it is deliberately *not* used in the product UI:
webfont licensing for `apps/web-admin` would be a separate purchase, and Inter is
the closest widely-licensed substitute for interface text.

Two traps worth knowing before anyone sets brand type:

- **`Bauhaus 93` is not ITC Bauhaus.** It ships with Windows/Office and is the
  font people reach for by mistake. It is a much heavier, quirkier derivative —
  the `r`, `s` and `a` are visibly different shapes. It will read as off-brand.
  Do not substitute it.
- **The licence file lives with Juanes, not in this repo.** Anyone producing
  brand assets needs the actual `.ttf`/`.otf`. Without it, set the wordmark from
  the **logo asset** (`apps/web-admin/public/logo.png`, 1200×360) rather than
  re-typing "Turnos" in a lookalike face.

⚠️ **`docs/brand/turnos-logo.png` is a 0-byte empty file** — the embed at the top
of this document is broken. The real assets are
`apps/web-admin/public/logo.png` and `logo-white.png`, both 1200×360.

---

## Spacing System

Use multiples of **4px** for all spacing:

| Token | Value | Usage |
|---|---|---|
| `xs` | 4px | Icon padding, tight gaps |
| `sm` | 8px | Inner component padding |
| `md` | 16px | Standard padding (cards, screens) |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Screen top padding |
| `2xl` | 48px | Hero sections |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `sm` | 8px | Tags, chips, inputs |
| `md` | 12px | Cards, modals |
| `lg` | 20px | Bottom sheets, large cards |
| `full` | 9999px | Buttons (pill shape), avatars |

---

## Component Guidelines

### Buttons
- **Primary button:** Background `#6a79ff`, text `#fafdff`, border-radius `9999px` (pill), padding `12px 24px`
- **Secondary button:** Border `1.5px solid #6a79ff`, text `#6a79ff`, background transparent
- **Disabled:** Background `#d9d9d9`, text `#6b7280`
- **Pressed/Active:** Background `#5260e0`

### Cards
- Background: `#fafdff`
- Border: `1px solid #d9d9d9`
- Border-radius: `12px`
- Shadow (mobile): `0px 2px 8px rgba(106, 121, 255, 0.08)`

### Inputs
- Background: `#fafdff`
- Border: `1.5px solid #d9d9d9`
- Border focused: `1.5px solid #6a79ff`
- Border-radius: `8px`
- Placeholder text: `#6b7280`

### Bottom Navigation (Mobile)
- Background: `#fafdff`
- Active icon/label: `#6a79ff`
- Inactive icon/label: `#6b7280`
- Border top: `1px solid #d9d9d9`

---

## Design Principles

1. **White-first** — All screens start from `#fafdff`. The primary color `#6a79ff` is used for action and identity, not decoration.
2. **Clarity over decoration** — No heavy shadows, no gradients on backgrounds. Clean and professional.
3. **Primary color = trust signal** — Use `#6a79ff` on CTAs, confirmations, and brand moments (shift confirmed, paid, matched).
4. **Grey for structure** — Use `#d9d9d9` only for dividers and borders — never as a fill color for interactive elements.

---

## Quick Reference (Copy-Paste)

### React Native (StyleSheet)
```typescript
export const colors = {
  primary: '#6a79ff',
  primaryDark: '#5260e0',
  primaryLight: '#eef0ff',
  secondary: '#fafdff',
  neutral: '#d9d9d9',
  textPrimary: '#1a1a2e',
  textSecondary: '#6b7280',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
} as const;
```

### CSS / Next.js
```css
:root {
  --color-primary: #6a79ff;
  --color-primary-dark: #5260e0;
  --color-primary-light: #eef0ff;
  --color-secondary: #fafdff;
  --color-neutral: #d9d9d9;
  --color-text-primary: #1a1a2e;
  --color-text-secondary: #6b7280;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
}
```

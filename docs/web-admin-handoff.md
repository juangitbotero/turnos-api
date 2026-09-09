# Web-admin — lessons from past mistakes

Status, shipped work and open items have been removed. What is left is only the
things that went wrong before and what they taught, so they are not repeated.

---

## Regressions from the 2026-08 run, both fixed 2026-08-17

Both were introduced by `a5de0c2` ("dashboard cleanup"). Read them together —
they are the same mistake twice, and the second one was invisible until the
first was fixed.

### 1. Posting a shift was impossible for nine days

`a5de0c2` replaced the Languages chip row with the new `MultiSelect`. The
replacement block matched from *inside* the Languages section all the way to the
start of Pay & TSU and deleted **270 lines** — three whole sections:

| Section | What went with it |
|---|---|
| How will you pay the worker? | Pay Link / transferência / MB WAY selector |
| Date & hours | date, start time, duration, multi-day picker, end-time display, labour-law alerts |
| Location | **the address field and the Verify geocode button** |

Every piece of *state* survived — `address`, `date`, `startTime`,
`durationHours`, `paymentMethod`, `geo`, `handleGeocode`, `addExtraDate`,
`lawAlert` were all still declared and still read by `handleSubmit` and the TSU
box, and the repost-prefill `useEffect` still called their setters. So `tsc` saw
no unused variable and `next build` produced a page. Only the inputs that write
them were gone.

The result renders, looks complete, and cannot be submitted: `handleSubmit`
stops at its first line, `if (!geo)`, and `geo` is only ever set by the Verify
button that no longer existed.

Restored in `57a02b7` verbatim from `7fdd51e`, with the two emoji in the
recovered markup swapped for `IconCalendar` / `IconCheck`. No styles or
catalogue keys had to come back — the commit removed markup only, so
`s.addrRow`, `s.multiDayBox`, `admin.newShift.locationSection` and the rest were
all still there, orphaned.

### 2. The emoji sweep only ever ran on `pt.ts`

`a5de0c2` reported stripping emoji "from both languages by the same rules so
parity holds by construction". It did not. **`en.ts`'s `admin` namespace was
never touched** — ~50 strings still carried emoji, so an English-speaking
company saw the pre-cleanup dashboard while a Portuguese one saw the clean one.
In at least one place it doubled up: `workers-search` already renders
`<IconSearch>` next to a field whose EN placeholder was `'🔍 Search'`.

Fixed 2026-08-17. `pt.ts` was the reference for what "swept" means, which
settles a question worth knowing: **PT stripped `✓ ✕ ⬇ ⚠` from admin copy too**,
not just the colour emoji, so EN now matches. Four stragglers PT had also missed
(`minBadge ⏱`, `law4h ℹ️`, `legalNote ℹ️`, `under24h ⏳`) are gone from both, as
are `⭐ ✅ 🔄` in `home`.

Deliberately kept:

- **`✓` in `home.demo`** (`match`, `step3`) — a mock checklist on the landing
  page. Punctuation, under the same rule that kept `→ ← ↻`.
- **`🛠` on `devBypass`** — gated behind `NODE_ENV === 'development'` and
  verified absent from the live login page. The glyph is useful there: it marks
  a dev build at a glance.
- **The whole `mobile` namespace.** The app keeps its emoji in both languages,
  which is consistent. `a5de0c2` scoped the sweep to `admin` on purpose.

The catalogue was only half the story, and it is the half that is easy to
mistake for the whole. **~56 emoji were hardcoded in the web-admin components**,
not the copy — so they rendered identically in PT and EN, which is exactly why
the dashboard looked *consistent* while the catalogue was not. `a5de0c2` never
touched them; it converted the sidebar, KPI tiles, quick actions, category rows
and the company avatar, and stopped there. Being hardcoded, they were invisible
to any catalogue grep.

Converted the same day across 11 files. **14 icons added** — `IconInfo`,
`IconBulb`, `IconClock`, `IconMail`, `IconLock`, `IconEye`, `IconEyeOff`,
`IconFile`, `IconChat`, `IconTarget`, `IconDoor`, `IconTrend`, `IconInbox` and
`Spinner` — bringing `components/icons.tsx` to 49.

Three things that are not obvious from the diff:

- **`fontSize` does nothing to an SVG.** Every container that held one of these
  emoji was sized with `fontSize: 48` (empty states) or `fontSize: 20-36`
  (inline badges). Each had to become an `inline-flex`/`flex` box, 14 of them.
  Miss this and the icon renders at its default size in a box built for a 48px
  glyph.
- **The `⏳` loading spinners were invisible to a rendered-HTML scan** — they
  only exist while `isLoading` is true. Four of them (three on compliance, one
  on login) were found only by scanning *source*. They are now a real `Spinner`
  that turns, using the `@keyframes spin` already in `globals.css`. If you sweep
  for glyphs again, scan the source, and widen the range to **U+2300–23FF** —
  the first pass here missed it, which is exactly where `⏳ ⌛ ⏱ ⏰` live.
- **`Stars` existed and nothing used it.** Four screens were building ratings
  with `'★'.repeat(n) + '☆'.repeat(5-n)`. They now use the component.

Kept: `↑` on the QR check-in badge, and `★ ☆ ✓ ✕ → ← ↻ ·` wherever they are
punctuation.

Verified by rendering all 49 icons on a throwaway route and asserting each has a
non-empty `getBBox()` — a build cannot tell you an SVG draws nothing. Then every
route re-scanned in both languages: clean apart from the dev-only `🛠`.

### What this says about the verification gate

`tsc` and `next build` **cannot see a missing input.** Both regressions passed
them cleanly and shipped. A form that renders but cannot be submitted, and a
catalogue that is half-swept, both need someone to open the page — in **both
languages**. There is no script for it.

---

## ⚠️ Retracted: the "missing CSS variables" claim was wrong

Commit `6fe2806`'s message and an earlier version of this document claimed that
`--color-text-muted` and `--color-border` were undefined, and that the login
inputs therefore rendered with no border. **Both claims are false.** The commit
message is pushed history and cannot be corrected; this note is the correction.

Both variables are defined in `app/globals.css`, lines 25 and 30 of `:root`.
A full cross-check of the codebase:

```
defined in globals.css : 40
referenced in source   : 23
UNDEFINED REFERENCES   : none
```

On production the login input computes to `border: 1px solid rgba(217,217,217,0.6)`.

**How the mistake happened, because it will happen again to someone.** The
reading came from `getComputedStyle` run against the **local dev server seconds
after editing files**, while Next was hot-reloading. The stylesheet had not
applied yet, so the lookups returned empty strings — indistinguishable from
undefined variables. A transient loading state was read as a defect.

> Never diagnose computed styles on a dev server you have just written to.
> Reload and re-read, or check production. An empty `getPropertyValue()` means
> "not applied **yet**" at least as often as it means "not defined".

Four lines in `login/page.tsx` were changed from `--color-text-muted` to
`--color-text-secondary` on the strength of that wrong conclusion. They have
been reverted.

The one real finding from the cross-check, **not a bug and not being fixed**:
17 variables are defined and never referenced — the entire `--space-*` scale,
`--transition-base`/`slow`, `--shadow-md`/`lg`/`glow`, `--color-warning*`. The
codebase uses inline style objects with literal numbers instead. Threading the
spacing tokens through hundreds of inline styles is a large diff with no visible
payoff.

---

## The catalogue is the source of copy — including icons

Emoji were in the **strings**, not the markup. If a screen looks wrong,
check `packages/shared/src/i18n/pt.ts` before the component.

The rule as it now stands, both languages, verified 2026-08-17:

| Namespace | Emoji | Typographic `→ ← ↻ ✓ ✕ ★ ·` |
|---|---|---|
| `admin` | none — including `✓ ✕ ⬇ ⚠` | arrows only |
| `home` | none | `✓` kept in the demo checklist |
| `mobile` | **kept, deliberately** | kept |

The same now holds for the **web-admin components** — no emoji in JSX either.

Adding one back to an `admin` or `home` string, or to a component, undoes a
sweep that took three passes to land. Use `apps/web-admin/components/icons.tsx`;
if the icon you need is not there, add it rather than reaching for a glyph.

Every CSS variable referenced in web-admin **is** defined — see the retraction
above if you have read an older copy of this document saying otherwise.

`pt.ts` is canonical; `en.ts` is typed `Translated<TranslationCatalogue>`, so a
missing key is a compile error. Rebuild shared after every catalogue edit:

```bash
cd packages/shared && npm run build
```

---

## Regex traps that cost real time

1. **Anchor block patterns with `^` and the `m` flag.** An unanchored
   `    features: \{` matched *inside* `      features: {` (admin.billing) and
   deleted 44 lines. The file still looked plausible and only failed at the end
   of `tsc`. Any script that rewrites a catalogue block should verify brace
   balance before writing.
2. **Never put replacement text inside `node -e`.** Bash eats backticks and
   `${…}`, silently corrupting template literals. Write a `.js` file.
3. **A JSX block replacement can run past its section.** This is trap 1 in the
   component layer and it cost 270 lines of the post-a-shift form — see
   "Regressions" above. A script that rewrites JSX should assert the line delta
   it expects, not just that the file still parses.

Whatever you write, **do both catalogues in the same pass and assert the same
hit count in each**. The one sweep that did not — the emoji strip — silently ran
on `pt.ts` only, and nothing downstream noticed for nine days because
`Translated<TranslationCatalogue>` checks that keys match, never that *values*
were treated alike.

Several files are **CRLF**. Normalise line endings before matching.

---

## How to check things without reaching a wrong conclusion

Four ways a check went wrong in one afternoon. All four are cheap to avoid.

1. **A green build proves nothing about what renders.** Both regressions passed
   `tsc` and `next build`. Deleted JSX leaves the state declared and still read
   elsewhere, so nothing is "unused" and nothing errors. Open the page.
2. **Never read computed styles off a dev server you just wrote to.** Mid-HMR,
   `getComputedStyle().getPropertyValue()` returns `""` for variables that are
   perfectly well defined. That produced a completely fabricated bug report —
   see the retraction above. Reload first, or check production.
3. **Scan source, not just rendered HTML.** Anything behind a condition —
   `{isLoading && …}`, error banners, empty states — is absent from the initial
   HTML. Four `⏳` spinners hid there. And widen your character ranges:
   the first emoji sweep missed **U+2300–23FF** entirely, which is where
   `⏳ ⌛ ⏱ ⏰` live.
4. **Assert on ink, not on existence.** An `<svg>` with a broken path is a
   perfectly valid element of the right size. The icon pass was verified by
   rendering all 49 on a throwaway route and checking each has a non-empty
   `getBBox()`. Delete the route afterwards — and note that Next ignores
   `_`-prefixed folders, so `app/_probe/` will silently 404.

---

## The dev machine runs Node 24, which Expo SDK 54 does not support

Found 2026-08-17 when `npx expo start` stopped working. Worth reading in full
before anyone "fixes" it by upgrading things.

The machine has **only Node v24.6.0** — one install at `C:\Program Files\nodejs`,
no nvm. Expo SDK 54 / RN 0.81.5 supports **Node 20 and 22 LTS**. Node 24
produces two errors that look unrelated and share this one cause:

| Error | Severity |
|---|---|
| `Error while reading cache … Unable to deserialize cloned data` | Non-fatal — falls back to a full crawl and continues |
| `TypeError: Body is unusable: Body has already been read` | **Fatal** — Metro never starts |

The fatal one names its own cause in the stack:

```
validateDependenciesVersionsAsync
  -> getVersionedDependenciesAsync
    -> getNativeModuleVersionsAsync
      -> Response.json          <- throws
```

On startup `expo start` checks your dependency versions against `api.expo.dev`,
and that code reads the fetch `Response` body twice. Node 22 tolerated it;
Node 24's `undici` throws. Because it is a network call, it fails
**intermittently** — which is why it "worked an hour ago".

### The fix in place

`EXPO_NO_DEPENDENCY_VALIDATION=1` is set in **`apps/mobile/.env`**, with a
comment pointing here. Plain `npx expo start` now works. Verified end to end on
2026-08-17: Metro started, served the manifest, and built the full **8.7 MB**
Android bundle in ~135 s.

Add `--clear` once if the cache error reappears.

**What you lose:** that check is what warns you when a package drifts from the
version SDK 54 expects. It is a warning and never a gate — it has no effect on
what gets built — but the early warning is gone. Run the same checks
deliberately before any store build:

```bash
npx expo-doctor
```

### `.easignore` now excludes `scripts/` (2026-08-22)

It excluded `docs` but not `scripts`, so `scripts/ad-campaign/` — and the
**24 MB of sharp native binaries** in its `node_modules` — would have been
uploaded in every EAS build archive. Nothing under `scripts/` is needed to
build the mobile app.

Worth remembering the general rule: **when `.easignore` exists, EAS uses it
instead of `.gitignore`.** Anything you rely on `.gitignore` to keep out of the
build archive has to be repeated there.

### Does this affect Play Store / App Store builds? No.

Keep three things separate:

| | Runs where | Node involved |
|---|---|---|
| `expo start` / Metro | your machine | yes — this is the only place Node 24 bites |
| `eas build` | **Expo's servers** | their Node, not yours |
| the installed app | the phone | **none** — JS runs on Hermes |

There is no Node runtime inside a React Native app. Metro compiles the bundle;
Hermes executes it on device. Store builds do not use this machine at all —
`eas build` uploads the source and builds in Expo's cloud. `apps/mobile/eas.json`
pins no `node` version, so EAS uses the default for SDK 54, a supported LTS.
Local Node 24 is invisible to the store artefact.

### If you do want to move to Node 22

Not done, deliberately — it was not worth the risk mid-testing when a one-line
env var works. When you do it, do it on a quiet day, not before a demo.

`winget` is available (v1.29.280). Two options:

| | Command | Reversible |
|---|---|---|
| **nvm-windows** (recommended) | `winget install CoreyButler.NVMforWindows`, then `nvm install 22` / `nvm use 22` | yes — `nvm use 24` |
| Node 22 LTS directly | `winget install OpenJS.NodeJS.LTS` | only by reinstalling 24 |

Budget for `npm install` at the repo root afterwards and a re-check of all three
apps. `node_modules` carries compiled binaries — `sharp`, `next-swc`,
`tailwindcss-oxide`, `bcrypt`, `msgpackr-extract` (which ships a `node.abi115`
prebuild). Most are N-API and survive a version switch; not reliably all.

### Stale Metro holds port 8081

Separate trap, same afternoon. A leftover `expo start` keeps 8081, so the next
run silently falls back to **8082** while Expo Go still looks at 8081 — the app
just never loads and nothing says why. Check listeners on 8081 before debugging
anything else:

```bash
netstat -ano | findstr :8081
```

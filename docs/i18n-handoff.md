# PT/EN internationalisation — work in progress

Status as of commit `7efa171`. Full sweep agreed: quality over speed, every
surface bilingual.

## Decisions already locked (do not re-litigate)

| Decision | Answer |
|---|---|
| Scope | **Full sweep** — mobile + web-admin dashboard + public pages + API messages |
| Default language | **Auto-detect**: stored choice → device/browser locale → PT. A detectable but unsupported locale (e.g. `uk-UA`) gets **EN**, not PT, because the worker base is heavily migrant. A manual choice wins forever. |
| API messages | **Translate the ~30 user-facing ones** via `Accept-Language`. Ops/accountant emails stay PT. |
| Portuguese legal terms | **Keep verbatim + gloss in English.** MCD, Recibo Verde, TSU, Segurança Social, NIF are Portuguese legal instruments — never translate them literally. |
| English copy | Claude drafts; Juanes reviews. Copy through the feed screen is **already reviewed and approved**. |
| `Restauração` | → **"Restaurants & Cafes"** (not "Food & Beverage") |
| `Lisboa` | → **"Lisbon"** (approved) |

## Architecture (built, working — don't redesign)

- **`react-i18next`** in both apps. 15 of 16 web-admin files are already
  `'use client'`, so no server-component machinery is needed.
- **Catalogues:** `packages/shared/src/i18n/` — `pt.ts` is canonical, `en.ts` is
  typed `Translated<TranslationCatalogue>` so **a missing key is a compile
  error**. Currently 175 keys each side, verified no drift.
- **Namespaces:** `common` · `domain` · `mobile` · (`admin`, `home` still to be
  created).
- **`useT()` hook** — identical shape in `apps/mobile/lib/i18n.tsx` and
  `apps/web-admin/lib/i18n.tsx`. Returns `t`, `language`, the domain
  translators (`tSkill`, `tSkills`, `tCategory`, `tWorkerLanguage`) and the
  locale-aware formatters (`fShortDate`, `fLongDate`, `fWeekdayDate`,
  `fDateTime`, `fDateRange`, `fSmartDate`, `fMoney`, `fNumericDate`).
- **Persistence:** SecureStore (mobile) · cookie `turnos_lang` (web, so the
  choice made on the public home page survives login into the dashboard).
- **`Worker.preferredLanguage`** column exists and is written when the worker
  switches language, so push/email can follow it later.

### ⚠️ The rule that must never be broken

Job titles, shift categories and worker languages are **database keys that
happen to be Portuguese**. They are stored verbatim in `worker.skills`,
`worker.languages`, `shift.subcategory`, `shift.category`.

**Translate them for DISPLAY ONLY** via `tSkill()` / `tCategory()` /
`tWorkerLanguage()`. The Portuguese value stays canonical in every language.
Writing an English title into those columns orphans the rows — the same failure
mode the `Rececionista de hotel` rename would have caused, but across 34 titles.

`SkillName` is *derived* from `SHIFT_CATEGORIES`, so adding a job title without
an English translation fails the build.

## 🐛 Known bug to fix as each screen is translated

**Hardcoded `pt-PT` date formatting.** Several screens format dates with
`toLocaleDateString('pt-PT', …)` or the old `lib/format.ts` helper. If the
labels are translated but the dates aren't, English mode shows English text
with Portuguese dates ("sáb, 25 jul" instead of "Sat, 25 Jul").

Already fixed in `index.tsx` (feed) — `toFeedItem` now receives the
locale-aware formatters.

**Still to fix, per screen:**

| File | What's wrong |
|---|---|
| `apps/mobile/app/my-shifts.tsx` | `toLocaleDateString('pt-PT')` in the Próximo turno hero card + `formatAppliedAt` |
| `apps/mobile/app/shift/[id].tsx` | `formatDate` import from `lib/format` |
| `apps/mobile/components/ShiftSchedule.tsx` | **hardcoded `MONTH_NAMES` and `WEEKDAY_INITIALS` Portuguese arrays** — replace with `monthName()` / `weekdayInitials()` from shared |
| `apps/mobile/app/earnings.tsx`, `recibo-verde.tsx` | `pt-PT` calls |
| `apps/mobile/lib/format.ts` | the old helper itself — retire once nothing imports it |
| `apps/web-admin/lib/format.ts` + dashboard pages | same pattern |
| `apps/api` (attendance, compliance, shifts services) | `pt-PT` in server-composed strings — Phase 4 |

Shared replacements already exist for all of these in
`packages/shared/src/i18n/format.ts`.

## Progress

**Phase 0 — foundation:** ✅ complete

**Phase 1 — mobile (4 of 14 screens):**
- ✅ `profile.tsx` (includes the PT/EN language switcher)
- ✅ `login.tsx`
- ✅ `verify.tsx`
- ✅ `index.tsx` (feed, dates fixed)
- ⬜ `my-shifts.tsx` (1073 lines — biggest)
- ⬜ `shift/[id].tsx` (859)
- ⬜ `edit-profile.tsx` (970)
- ⬜ `onboarding.tsx` (681)
- ⬜ `earnings.tsx` (578)
- ⬜ `scan.tsx`, `rate/[id].tsx`, `recibo-verde.tsx`, `components/ShiftSchedule.tsx`

**Phase 2 — web-admin dashboard:** ⬜ not started (11 pages, ~300 strings).
`LanguageSwitcher` component exists at `apps/web-admin/components/` but is
**not mounted anywhere yet** — mount it in the dashboard header.

**Phase 3 — public pages:** ⬜ not started. `app/page.tsx` (home, ~128 strings,
content sits in `STATS` / `HOW_IT_WORKS` / `FEATURES` / `PLATFORM_TRUST` /
`ROADMAP` const arrays), `login/page.tsx` (~27), `register/page.tsx` (~58).
The public nav needs a visible PT/EN toggle.

**Phase 4 — API messages:** ⬜ not started (~30 user-facing exceptions via
`Accept-Language`).

## Working method that's proven fast

1. `grep -nE ">[^<>{}]*[A-Za-zÀ-ú]{3,}[^<>{}]*<|placeholder=|Alert\.alert\(" <file>`
   to extract strings without reading the whole file.
2. Add keys to `pt.ts` **and** `en.ts` (build fails if you forget EN).
3. Apply replacements with a small `node -e` script (Python is not installed on
   this machine).
4. Wire `const { t } = useT();` into the component.
5. Verify: rebuild shared, then
   `npx tsc --noEmit` filtered to the touched files. **Ignore `TS2786`** —
   that's the pre-existing React-types mismatch affecting `LinearGradient`
   app-wide, not a real error.

## Verification snippet (catalogue parity)

```bash
node -e "
const s=require('./packages/shared/dist/index.js');
const walk=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='string'?[p+k]:walk(v,p+k+'.'));
const ptK=walk(s.pt).sort(), enK=walk(s.en).sort();
console.log('PT/EN:',ptK.length,'/',enK.length,'missing in EN:',ptK.filter(k=>!enK.includes(k)));
"
```

## Testing

- **Mobile:** `cd apps/mobile && npx expo start --clear` — Expo Go loads JS from
  Metro, so **no deploy is needed** to see mobile changes.
- **Web-admin + API:** deployed on Railway, auto-deploys on push to `main`.

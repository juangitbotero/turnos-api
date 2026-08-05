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
  translators (`tSkill`, `tSkills`, `tCategory`, `tWorkerLanguage`, `tWeekday`)
  and the locale-aware formatters (`fShortDate`, `fLongDate`, `fWeekdayDate`,
  `fDateTime`, `fDateRange`, `fSmartDate`, `fMoney`, `fNumericDate`,
  `fMonthName`, `fWeekdayInitials`).
  `fMonthName`/`fWeekdayInitials` exist for calendar grids (see
  `components/ShiftSchedule.tsx`); `tWeekday` maps a **stored** weekday
  abbreviation to its display label.
- **Persistence:** SecureStore (mobile) · cookie `turnos_lang` (web, so the
  choice made on the public home page survives login into the dashboard).
- **`Worker.preferredLanguage`** column exists and is written when the worker
  switches language, so push/email can follow it later.

### ⚠️ The rule that must never be broken

Job titles, shift categories, worker languages **and weekday abbreviations**
are **database keys that happen to be Portuguese**. They are stored verbatim in
`worker.skills`, `worker.languages`, `worker.availableDays`,
`shift.subcategory`, `shift.category`.

**Translate them for DISPLAY ONLY** via `tSkill()` / `tCategory()` /
`tWorkerLanguage()` / `tWeekday()`. The Portuguese value stays canonical in
every language. Writing an English title into those columns orphans the rows —
the same failure mode the `Rececionista de hotel` rename would have caused, but
across 34 titles.

Weekday buttons must iterate `STORED_WEEKDAYS` (from shared) so `'Seg'` is what
gets submitted, with `tWeekday(d)` supplying only the label.

`SkillName` is *derived* from `SHIFT_CATEGORIES`, so adding a job title without
an English translation fails the build.

## 🐛 Known bug: hardcoded `pt-PT` date formatting

If the labels are translated but the dates aren't, English mode shows English
text with Portuguese dates ("sáb, 25 jul" instead of "Sat, 25 Jul").

**Mobile: ✅ all fixed.** `apps/mobile/lib/format.ts` has been **deleted** —
nothing imports it. `formatSeriesRange()` (which is `pt-PT`-hardcoded) is no
longer used anywhere in mobile; `fDateRange()` replaces it.

**Web-admin: ✅ all fixed.** `apps/web-admin/lib/format.ts` has been **deleted**.

**`formatSeriesRange()` in `packages/shared/src/index.ts` is now unused by both
apps** — `fDateRange()` replaced it everywhere. It is still exported and still
`pt-PT`-hardcoded; safe to delete once you've confirmed nothing external calls
it.

**Still to fix:**

| File | What's wrong |
|---|---|
| `apps/api` (attendance, compliance, shifts services) | `pt-PT` in server-composed strings — Phase 4 |

Shared replacements already exist for all of these in
`packages/shared/src/i18n/format.ts`.

## Progress

**Phase 0 — foundation:** ✅ complete

**Phase 1 — mobile: ✅ complete.** Every screen and component in
`apps/mobile/app` + `apps/mobile/components` is bilingual; `_layout.tsx` has no
user-facing copy. Catalogues are at **532 keys each side, no drift**.

- ✅ `profile.tsx` (language switcher; day-dot initials now use `tWeekday`)
- ✅ `login.tsx` · `verify.tsx` · `index.tsx` (feed)
- ✅ `my-shifts.tsx` · `shift/[id].tsx` · `edit-profile.tsx` · `onboarding.tsx`
- ✅ `earnings.tsx` · `scan.tsx` · `rate/[id].tsx` · `recibo-verde.tsx`
- ✅ `components/ShiftSchedule.tsx` (month names + weekday initials from Intl)

English copy for review: **`docs/i18n-en-copy-review.md`** (PT → EN, by screen).
Regenerate it after adding keys — see "Regenerating the review sheet" below.

### Shared-package changes made during Phase 1

- `STORED_WEEKDAYS`, `weekdayKey()` in `i18n/domain.ts` — weekday abbreviations
  are stored data, so they get the same display-only treatment as job titles.
- `calculateProfileQualityScore()` now also returns **`missingKeys`**
  (`ProfileMissingKey[]`). `missingItems` keeps its Portuguese strings for the
  API response shape and the PT-only ops emails; UI must use `missingKeys` and
  translate via `mobile.onboarding.missing.*`.
- `mobile.calendar.*` and `mobile.schedule.*` are **cross-screen** namespaces —
  both my-shifts and shift detail use the calendar-sync strings.

**Phase 2 — web-admin dashboard: ✅ complete.** All 11 dashboard pages plus the
small-screen `MobileOverlay`. Catalogues now at **1050 keys each side, no
drift**; `admin.*` is 515 of them.

- ✅ `dashboard/page.tsx` · `workers-search` · `workers` · `qr-codes`
- ✅ `compliance` · `spending` · `billing` · `ratings` · `new-shift` · `shifts`
- ✅ `app/MobileOverlay.tsx`
- ✅ `LanguageSwitcher` **mounted** in every dashboard page header (see below)
- ✅ `apps/web-admin/lib/format.ts` **deleted** — nothing imports it

Verified in the browser: switching PT↔EN re-renders in place, the `turnos_lang`
cookie survives navigation and full reloads, and dates follow the locale
("quarta-feira, 05 de agosto" ↔ "Wednesday 05 August"). `npx next build` passes.

### Where the LanguageSwitcher is mounted, and why per-page

There is no shared dashboard header component — `dashboard/layout.tsx` is a
pass-through that only manages the socket, and every page renders its own header
(two of them render a full sidebar shell, the rest a `s.header` block). Rather
than refactor a shared shell, the switcher is mounted **in each page's own
header action group**. One mount per page, no layout redesign.

### Shared-package changes made during Phase 2

- `formatMediumDate()` ("25 jul 2026") — the web-admin table/row date, replacing
  the deleted `lib/format.ts`. Exposed as `fMediumDate`.
- `formatTimestamp()` ("25 jul 2026, 14:30") — the ACT audit-trail column.
  Exposed as `fTimestamp` in **both** apps' `useT()`.
- `lib/nav.ts` entries now carry a `key` instead of a hardcoded `label` — render
  with ``t(`admin.nav.${key}`)``.
- **Colour maps were split from label maps** in three places (`STATUS_STYLE` in
  shifts, `SS_STATUS_STYLE` in compliance, `StatusBadge` in billing). The label
  now comes from `domain.shiftStatus.*` / `admin.compliance.ssStatus.*` /
  `admin.billing.status.*`; the map holds only colours.
- `apps/web-admin/lib/api.ts` isn't a component, so it can't use `useT()`. It
  reads the `turnos_lang` cookie and pulls `common.sessionExpiredBody` straight
  from `catalogue()` — see `currentCatalogue()` there. **Mobile's `lib/api.ts`
  has no hardcoded copy**, so it needed no equivalent.

**Phase 3 — public pages:** ⬜ not started. `app/page.tsx` (home, ~128 strings,
content sits in `STATS` / `HOW_IT_WORKS` / `FEATURES` / `PLATFORM_TRUST` /
`ROADMAP` const arrays), `login/page.tsx` (~27), `register/page.tsx` (~58).
The public nav needs a visible PT/EN toggle.

**Phase 4 — API messages:** ⬜ not started (~30 user-facing exceptions via
`Accept-Language`).

## ⚠️ Stale copy found while translating (fixed in PT and EN — please confirm)

Translating forces every string to be read, which surfaced two claims that
contradict the current model. Both were corrected in **both** languages:

| Where | Was | Now |
|---|---|---|
| `onboarding.tsx` step 3 | "Após aprovação, receberá pagamentos **no dia seguinte** a cada turno concluído." | "…a empresa paga-te o valor bruto **diretamente** após cada turno concluído." |
| `earnings.tsx` empty state | "Os teus ganhos aparecem aqui após o **check-out** e processamento do pagamento." | "…depois de **o turno terminar** e o pagamento ser registado." |
| `compliance` TSU KPI | "Taxas Turnos **(10%)**" | "Taxas Turnos" (no rate) |
| `dashboard` quick action | "Os teus códigos QR fixos para **entrada e saída**." | "O teu código QR fixo de **check-in**." |
| `billing` plan row | "QR Check-**in/out**" | "QR Check-in" |

The first is a leftover pre-pivot **T+1 payout claim** (ADR 007 — Turnos never
holds wages); the survivor of the 2026-07-29 copy sweep. The 10% fee is the
**pre-ADR-007 rate** — it is now a flat €3 per completed shift, so the
percentage was dropped rather than restated (the figure shown still comes from
`tsuReport.totalTurnosFees`, whatever the API returns). The rest refer to a
check-out scan that **ADR 008 removed**. None of these is a translation
decision, so flag if you disagree with the wording.

## Working method that's proven fast

1. `grep -nE ">[^<>{}]*[A-Za-zÀ-ú]{3,}[^<>{}]*<|placeholder=|Alert\.alert\(" <file>`
   to extract strings without reading the whole file.
2. Add keys to `pt.ts` **and** `en.ts` (build fails if you forget EN).
3. Apply replacements with a small Node script reading a JSON list of
   `[from, to]` pairs (Python is not installed on this machine).
   **Do not put the replacement text inside `node -e "…"`** — bash eats
   backticks and `${…}`, which silently corrupts template literals. Write the
   pairs to a `.json` file and read it from a `.js` file instead.
   **Mind line endings:** several files are CRLF, so multi-line `from` strings
   must be normalised to the target file's endings before matching.
4. Wire `const { t } = useT();` into the component. Sub-components in the same
   file each need their own `useT()` call.
5. Verify: rebuild shared, then
   `npx tsc --noEmit` filtered to the touched files. **Ignore `TS2786`** (the
   pre-existing React-types mismatch affecting `LinearGradient` app-wide) and
   **`TS2339` on `fontSize.*` / `colors.*`** (pre-existing design-token
   typings). Confirm a suspicious error is pre-existing by comparing the
   per-file error count against `git stash`.

## Regenerating the English review sheet

`docs/i18n-en-copy-review.md` is generated from the built catalogues, so it can
never drift from the code. After adding keys:

```bash
cd packages/shared && npm run build && cd ../.. && node scripts/i18n-copy-review.js "$PWD" docs/i18n-en-copy-review.md
```

Add newly-approved namespaces to `APPROVED` (per app) or `APPROVED_SHARED` in
`scripts/i18n-copy-review.js` so the sheet only ever shows what still needs a
read, and extend `SECTION_TITLES` when you add a namespace.

**Signed off so far:** all of `common`, `domain`, and every `mobile.*`
namespace (Phase 1, approved 2026-08-05). The current sheet is Phase 2's
`admin.*` only.

## Rich text with inline `<strong>` / `<em>`

Several dashboard blocks emphasise words mid-sentence. Rather than add
`<Trans>` machinery, these are split into numbered segment keys
(`proofLead` / `proofBold` / `proofRest`) and reassembled in the JSX. This keeps
the exact markup **and** lets a translation reorder the parts — e.g. the
qr-codes fallback note ends `…com o botão [✓ Confirmar].` in PT but
`…with the [✓ Confirm] button.` in EN, purely by moving the text between
segments.

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

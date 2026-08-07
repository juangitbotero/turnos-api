# PT/EN internationalisation — ✅ done

**All five phases are implemented and the English copy is fully signed off**
(2026-08-07). Full sweep as agreed: quality over speed, every surface bilingual
— mobile, web-admin dashboard, public pages and the API.

Live on Railway since `7a9f5c1`. The one piece deliberately left for later:
push notifications and worker emails following `Worker.preferredLanguage` (the
column is already written on every language switch).

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
  error**. Currently 1274 keys each side, verified no drift.
- **Namespaces:** `common` · `domain` · `mobile` · `admin` · `home` · `api`.
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

**API: ✅ all fixed.** `grep -rn "pt-PT" apps/api/src` returns nothing.
`attendance` uses `tTime()`, `compliance` uses `tDateTime()`, `shifts` uses
`tNumericDate()` — all three read the request language (see Phase 4).

Shared replacements exist for all of these in
`packages/shared/src/i18n/format.ts`, which gained `formatTime()` in Phase 4.

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

**Phase 3 — public pages: ✅ complete.** Landing, login and register, plus the
PT/EN toggle in all three. Catalogues at **1216 keys** each side, no drift.

- ✅ `app/page.tsx` — the five content arrays now hold ids only; copy is in
  `home.*` and resolves at render
- ✅ `app/login/page.tsx` · `app/register/page.tsx`
- ✅ `LanguageSwitcher` mounted in the landing nav and both form headers

**Employer sectors were a fourth class of database key.** `SECTORS` lived in
`register/page.tsx` and is stored verbatim in `employer.sector`. It moved to
shared as `EMPLOYER_SECTORS` with `translateSector()` / `tSector()`, and the
`<select>` still submits `value="Restauração"` while displaying
"Restaurants & Cafes". **Any new stored enum needs the same treatment** — that
is now five (job titles, categories, worker languages, weekdays, sectors).

**Phase 4 — API messages: ✅ complete.** The NestJS API now throws in the
caller's language. Catalogues at **1274 keys** each side, no drift; `api.*` is
58 of them.

- ✅ `packages/shared` — `translate(lang, key, params)` (framework-free, same
  dotted-key + `{{param}}` contract as `useT()`, PT fallback) and
  `formatTime()`. Both exported from `@turnos/shared`.
- ✅ `apps/api/src/i18n/request-language.ts` — `resolveRequestLanguage()`,
  `runWithLanguage()`, `t()`, `tDateTime()` / `tNumericDate()` / `tTime()`
- ✅ `apps/api/src/i18n/language.middleware.ts`, wired in `AppModule.configure()`
  for `'*'`
- ✅ 79 `t()` call sites across `auth` (service + controller), `shifts`,
  `attendance`, `compliance`, `payments`, `wage-payments`, `ratings`
- ✅ Both clients send `Accept-Language`, plus the one raw `fetch` in
  `register/page.tsx` that bypasses `lib/api.ts`

### Why AsyncLocalStorage and not a request-scoped provider

The messages are thrown deep inside singleton services — a compliance check runs
three calls below the controller. Marking those `Scope.REQUEST` cascades: every
singleton injecting one becomes request-scoped too, re-instantiating much of the
graph per call. ALS keeps them singletons and needs **no constructor changes** —
the middleware opens the context, `t()` reads it wherever it is called.

Verified against a live express server: the language survives three `await`
boundaries, two concurrent PT/EN requests don't leak into each other, and
outside a request (BullMQ processors, the 15-min sweep, cron) `t()` falls back
to Portuguese — which is correct there, since those paths produce ops emails and
push notifications that are deliberately not translated.

### `Accept-Language` resolution

Mirrors `resolveInitialLanguage()`: q-values are honoured, an explicitly PT or
EN tag wins, and a header that is **detectable but unsupported** (`uk-UA,uk;q=0.9`)
gets **English**, not Portuguese. Only a missing/empty header — or a bare `*`,
which expresses no preference — falls back to PT.

### What was deliberately left in English

Internal/defensive throws a correct client cannot reach: `Not your shift`,
`Employer not found`, `Worker not found`, `Not your payment`,
`Only DRAFT or OPEN shifts can be edited`, the Stripe webhook signature errors.
An English string is more useful in a log, and no user sees them. The three
English messages that **are** user-reachable were translated: `Shift not found`
(stale deep link → `api.common.shiftNotFound`), `Shift is not open for
applications`, `Already applied to this shift`.

Success `message` fields (`'Código enviado com sucesso'`, `'CV carregado com
sucesso'`, …) were left in PT **except** the four the clients actually render:
worker cancel (3 variants), employer decline, and shift delete.

### Both Phase-4 landmines handled

1. **`shift/[id].tsx` message sniffing** — the EN rest-period string is *"A
   minimum 11h rest between shifts is mandatory…"*, so it contains both `rest`
   and `11h`. The smoke test asserts this token survives, so a future reword
   that breaks the sniff fails loudly rather than silently dropping the friendly
   "Precisas de descansar 😴" title.
2. **Nominatim in `new-shift/page.tsx`** — left at `'Accept-Language': 'pt'` and
   now carries a comment saying why: it is OpenStreetMap, not our API, and the
   address is shown to workers who will physically go there, where Portuguese
   street names match the signage and their map app.

---

# 📋 Handoff: Phases 3 & 4

Everything a fresh conversation needs. Phases 0–2 are done, committed and
deployed (`ae45d0e` on `main`). Start by reading the sections above, then this.

## Ground rules that carry over (do not re-derive)

1. **`pt.ts` is canonical; every key added there must be added to `en.ts`.** The
   build enforces it — `en.ts` is typed `Translated<TranslationCatalogue>`.
2. **Stored Portuguese values are database keys.** Job titles, categories,
   worker languages and weekday abbreviations are translated for DISPLAY ONLY
   via `tSkill` / `tCategory` / `tWorkerLanguage` / `tWeekday`. A `<select>`
   must keep `value="Vendas"` while rendering "Retail & Sales".
3. **Portuguese legal terms stay verbatim in English** and get glossed on first
   use: MCD, Recibo Verde, TSU, Segurança Social, SS Direta, ACT, NIF, IBAN,
   Portal das Finanças, Agenda do Trabalho Digno.
4. **Juanes reviews the English copy.** Draft it, regenerate the review sheet,
   show him. Everything through Phase 2 is already approved.
5. **`useT()` must stay memoized.** See the warning below — this one bit us.

## 🔥 The bug that will bite you if you undo it

`useT()` returns a `useMemo`'d object keyed on `[t, language]`. **Do not turn it
back into a plain object literal.** Screens put its helpers in `useCallback`
dependency arrays and then run the callback from `useEffect`:

```ts
const loadShifts = useCallback(..., [activeCategory, fDateRange, fSmartDate])
useEffect(() => { loadShifts(); }, [loadShifts])
```

A fresh object each render ⇒ new helper identities ⇒ new callback identity ⇒
effect refires ⇒ `setState` ⇒ render ⇒ **infinite fetch loop**. This shipped
briefly and showed up as the feed's shift counter flickering once a second with
an API call behind each tick. Fixed in `ae45d0e` for both apps.

Same hazard exists in any new screen. If you add `t` to a dependency array,
it is fine *only* because of that memo.

## Phase 3 — public pages

**Files** (all `'use client'`, all in `apps/web-admin/app/`):

| File | Lines | Notes |
|---|---|---|
| `page.tsx` | 480 | Landing page. Most copy sits in **module-level const arrays**: `STATS`, `HOW_IT_WORKS`, `FEATURES`, `PLATFORM_TRUST`, `ROADMAP` |
| `login/page.tsx` | 489 | |
| `register/page.tsx` | 360 | |

**Namespace:** create `home` (a sibling of `common` / `domain` / `mobile` /
`admin`). The catalogue header comment already anticipates it.

**The const-array pattern.** Those five arrays are declared at module scope, so
they cannot call `useT()`. Use the same fix already applied to
`admin.billing.features` and `mobile.reciboVerde.steps`: keep an array of
**stable ids** at module scope and translate at render.

```ts
const HOW_IT_WORKS = ['post', 'match', 'checkIn'] as const;   // ids only
// …in the component:
{HOW_IT_WORKS.map(id => (
  <Step key={id}
        title={t(`home.howItWorks.${id}.title`)}
        body={t(`home.howItWorks.${id}.body`)} />
))}
```

Keep the ids semantic (`post`, not `s1`) where the list is meaningful — the
numbered `f1…f7` style used in billing was a concession to a flat feature list.

**The PT/EN toggle.** `components/LanguageSwitcher.tsx` exists and is **not
mounted on any public page**. Mount it in the public nav on `page.tsx`, and on
`login` / `register` too — a worker who lands on the login screen directly must
be able to switch. It takes `variant="light" | "dark"`; the landing hero is dark,
so `variant="dark"` is likely right there.

The cookie (`turnos_lang`) is shared with the dashboard, so a choice made on the
public home page already carries through login — that was the whole reason for
using a cookie over `localStorage`. Verify that end-to-end once.

**`HtmlLangSync.tsx`** already keeps `<html lang>` in step. Nothing to do.

**Watch for:** the root `layout.tsx` hardcodes `<html lang="pt">` as the SSR
default. That is deliberate (avoids a hydration mismatch) and `HtmlLangSync`
corrects it on the client. Don't "fix" it.

## Phase 4 — API messages

**Done** — see the Phase 4 entry under Progress above for the design, the
`Accept-Language` resolution rules, what was left in English, and how both
landmines were handled. The brief that used to live here is superseded by the
code: `apps/api/src/i18n/`, and the `api.*` namespace in the catalogues.

The original scope estimate (~30 Portuguese messages) landed at **58 keys** —
the extra come from messages that were single strings in Portuguese but needed
splitting for interpolation, plus the handful of user-reachable English ones.

## Repo scripts you should use

| Script | What it does |
|---|---|
| `scripts/i18n-copy-review.js` | Regenerates `docs/i18n-en-copy-review.md`. Add approved namespaces to `APPROVED` / `APPROVED_SHARED` so the sheet only shows outstanding copy. |
| `scripts/i18n-check-keys.js` | Verifies every `t('…')` key in both apps resolves in **both** catalogues. A typo renders the raw key on screen. Currently: 1022 static keys, 0 missing. |
| `scripts/i18n-apply.js` | Applies a JSON list of `[from, to]` exact replacements to a file. Line-ending aware and idempotent. |

```bash
cd packages/shared && npm run build && cd ../..
node scripts/i18n-check-keys.js "$PWD"
node scripts/i18n-copy-review.js "$PWD" docs/i18n-en-copy-review.md
```

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
| `attendance` geofence error (Phase 4) | "Deve estar a menos de 200m para fazer check-**in/out**." | "…para fazer check-**in**." |

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

**Signed off: everything.** `common` + `domain`, every `mobile.*` (Phase 1,
2026-08-05), every `admin.*` (Phase 2), every `home.*` (Phase 3) and every
`api.*` (Phase 4) — the last two approved 2026-08-07. The sheet is empty and
says so.

⚠️ **The sheet hides new keys added to an approved namespace.** If you add copy
to, say, `admin.shifts`, clear that entry from `APPROVED` before regenerating or
the new strings will never surface for a read.

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

## Testing & shipping

**Before every commit:**

```bash
cd packages/shared && npm run build && cd ../..     # 1. catalogues must rebuild
node scripts/i18n-check-keys.js "$PWD"              # 2. every key resolves
cd apps/web-admin && npx tsc --noEmit && npx next build   # 3. web-admin
cd ../api && npx tsc --noEmit                        # 4. API — shared is a dep!
cd ../mobile && npx expo export --platform android --output-dir .tmp-check \
  && rm -rf .tmp-check                               # 5. mobile actually bundles
```

Step 4 matters: `packages/shared/src/index.ts` is imported by the **API**, so a
shared-package change can break the deploy even when both front-ends are fine.

`npx tsc --noEmit` on mobile has **two pre-existing errors** (`_layout.tsx`
notification typing, `my-shifts.tsx:34`) plus app-wide `TS2786` and `TS2339`
noise from LinearGradient/design-token typings. Ignore those; compare per-file
error counts against `git stash` if unsure whether something is yours.

⚠️ **Never run `next build` while `next dev` is running.** They share `.next`,
and the dev server then serves stale output — which looks exactly like the
language cookie being ignored. This wasted time twice during Phase 2 and 3.
Stop the dev server first, or `rm -rf .next` afterwards.

**Deploying:**

- **Web-admin + API:** on Railway, auto-deploys on push to `main`. The API is
  `https://turnos-api-production-6c70.up.railway.app/api` (health-check it with
  `GET /shifts/search`). The web-admin's Railway URL is **not recorded in this
  repo** — get it from the Railway dashboard.
- **Mobile:** `npx expo start --clear` for instant local iteration (Expo Go
  loads JS from Metro). For a shareable APK:

  ```bash
  cd apps/mobile && eas build --platform android --profile preview
  ```

  **Always pass `--profile preview`** — omitting it defaults to `production` and
  produces an `.aab` that cannot be sideloaded.

  ⚠️ **EAS Update is not configured** (`expo-updates` is not installed and
  `app.json` has no `updates`/`runtimeVersion` block). A git push does **nothing**
  for an installed APK — JS is bundled at build time. Any change a tester needs
  to see requires a new EAS build.

  ⚠️ `packages/shared/dist` is **gitignored but not `.easignore`d**, so EAS
  uploads it from your working copy. **Run `npm run build` in `packages/shared`
  before `eas build`** or you will ship a stale catalogue.

**Last build:** 2026-08-06, preview profile, app version 0.0.1 —
`https://expo.dev/artifacts/eas/7mmF_BtR5H4cSaHZ7nJTJkc0Bae_MGL8xsrtFYAqHEE.apk`
(first build since 2026-06-09, so it also picks up `expo-localization`,
`expo-document-picker` and `expo-calendar`).

## Current state at a glance

| | |
|---|---|
| Catalogue | **1274 keys** per language, no drift |
| Static keys verified | 1134 in the two apps + 79 `t()` sites in the API, all resolving in PT **and** EN |
| Phases done | **0, 1, 2, 3, 4 — the sweep is complete** |
| English copy | **Fully signed off** (2026-08-07). `docs/i18n-en-copy-review.md` is empty |
| Not in scope (next piece of work) | Push notifications and worker emails following `Worker.preferredLanguage` — the column is already written on every language switch |
| HEAD when written | `6a4205a` |
| Production data | `GET /shifts/search` returns `[]` — **zero shifts**, so the feed shows its empty state |

/**
 * Per-request language for API messages.
 *
 * The catalogue lives in @turnos/shared and is the same one both front-ends
 * use, so a message thrown here and a label rendered there can never disagree.
 *
 * ## Why AsyncLocalStorage rather than a request-scoped provider
 *
 * The messages are thrown deep inside singleton services (compliance checks run
 * three calls below the controller). Making those services `Scope.REQUEST`
 * would cascade — every singleton that injects one becomes request-scoped too,
 * which means re-instantiating half the graph on every call. AsyncLocalStorage
 * keeps the services singletons and needs no constructor changes: the
 * middleware opens a context, and `t()` reads it wherever it is called.
 *
 * Outside a request — BullMQ processors, the 15-minute sweep, cron jobs —
 * there is no store, so `currentLanguage()` falls back to Portuguese. That is
 * the right default there: those paths produce ops emails and push
 * notifications, which are deliberately NOT translated (push will follow
 * `Worker.preferredLanguage` as a separate piece of work).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  AppLanguage,
  DEFAULT_LANGUAGE,
  matchAppLanguage,
  translate,
  formatDateTime,
  formatNumericDate,
  formatTime,
} from '@turnos/shared';

const storage = new AsyncLocalStorage<AppLanguage>();

/**
 * Pick a language from an `Accept-Language` header.
 *
 * Mirrors `resolveInitialLanguage()` in shared: an explicitly Portuguese or
 * English tag wins by q-value order, and a header that is detectable but
 * unsupported (`uk-UA,uk;q=0.9`) gets ENGLISH, not Portuguese — the worker base
 * is heavily migrant. Only a missing or empty header falls back to Portuguese.
 */
export function resolveRequestLanguage(header: string | string[] | undefined): AppLanguage {
  const raw = Array.isArray(header) ? header.join(',') : header;
  if (!raw?.trim()) return DEFAULT_LANGUAGE;

  const tags = raw
    .split(',')
    .map(part => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map(p => p.trim()).find(p => p.startsWith('q='));
      return { tag: (tag ?? '').trim(), q: q ? Number(q.slice(2)) : 1 };
    })
    // `*` is "any language will do" — it expresses no preference, so it must
    // not count as a detected locale below.
    .filter(entry => entry.tag && entry.tag !== '*' && !Number.isNaN(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of tags) {
    const match = matchAppLanguage(tag);
    if (match) return match;
  }

  // A real locale was sent and it is neither Portuguese nor English → English.
  return tags.length > 0 ? 'en' : DEFAULT_LANGUAGE;
}

/** Run `fn` (and everything it awaits) with `lang` as the active language. */
export function runWithLanguage<T>(lang: AppLanguage, fn: () => T): T {
  return storage.run(lang, fn);
}

/** Active request language, or Portuguese outside a request. */
export function currentLanguage(): AppLanguage {
  return storage.getStore() ?? DEFAULT_LANGUAGE;
}

/**
 * Resolve a catalogue key in the active request language.
 *
 * Same contract as `t()` in the apps: a dotted key plus `{{param}}` values.
 * Keys live under `api.*` in packages/shared/src/i18n/pt.ts.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  return translate(currentLanguage(), key, params);
}

// Locale-aware formatters for values interpolated into those messages — the
// API's counterpart to `fDateTime`/`fNumericDate`/`fTime` in the apps' useT().
export const tDateTime    = (date: string | Date) => formatDateTime(date, currentLanguage());
export const tNumericDate = (date: string | Date) => formatNumericDate(date, currentLanguage());
export const tTime        = (date: string | Date) => formatTime(date, currentLanguage());

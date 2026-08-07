/**
 * i18n for Turnos — one catalogue shared by the mobile app and the web admin.
 *
 * The Portuguese catalogue is canonical; English is typed against its shape so
 * a missing translation fails the build. Domain data (job titles, categories,
 * worker languages) is translated for DISPLAY ONLY — the Portuguese string
 * stays the database key in every language. See ./domain.ts.
 */
export * from './types';
export * from './domain';
export * from './format';
export { pt } from './pt';
export type { TranslationCatalogue } from './pt';
export { en } from './en';

import { pt } from './pt';
import { en } from './en';
import type { AppLanguage } from './types';

/** Catalogues keyed by language — the resource bundle handed to i18next. */
export const CATALOGUES = { pt, en } as const;

/** Direct catalogue access for code outside a React tree (helpers, services). */
export function catalogue(lang: AppLanguage) {
  return CATALOGUES[lang] ?? pt;
}

function lookup(root: unknown, key: string): string | null {
  let node: unknown = root;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return null;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : null;
}

/**
 * Resolve a dotted catalogue key without react-i18next.
 *
 * The NestJS API depends on this package but has no React tree, so it can't use
 * `useT()`. This is the same contract minus the hook: dotted key, `{{param}}`
 * interpolation, Portuguese as the fallback when a key is missing (which the
 * `Translated<TranslationCatalogue>` type should already have made impossible).
 * An unresolvable key returns the key itself, so a typo is visible rather than
 * silently empty.
 */
export function translate(
  lang: AppLanguage,
  key: string,
  params?: Record<string, string | number>,
): string {
  const raw = lookup(catalogue(lang), key) ?? lookup(pt, key) ?? key;
  if (!params) return raw;
  return raw.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

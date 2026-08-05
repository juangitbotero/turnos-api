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

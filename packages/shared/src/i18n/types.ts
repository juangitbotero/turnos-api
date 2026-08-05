/**
 * Same key structure as the Portuguese catalogue, but any string value.
 *
 * `pt` is declared `as const`, so its fields are narrow literal types
 * ('Guardar', not string). A translation must match the SHAPE, not the values,
 * which is what this mapped type expresses. Applying it to `en` means a
 * missing or misspelled key is a compile error — a half-translated catalogue
 * cannot ship silently.
 */
export type Translated<T> = {
  [K in keyof T]: T[K] extends string ? string : Translated<T[K]>;
};

/**
 * App interface languages. Distinct from `LANGUAGES` in the main index, which
 * is the list of languages a WORKER can declare they speak — that's profile
 * data, this is the UI locale.
 */
export const APP_LANGUAGES = ['pt', 'en'] as const;

export type AppLanguage = typeof APP_LANGUAGES[number];

export const DEFAULT_LANGUAGE: AppLanguage = 'pt';

/** Human labels for the language switcher — each shown in its own language. */
export const APP_LANGUAGE_LABELS: Record<AppLanguage, string> = {
  pt: 'Português',
  en: 'English',
};

/** BCP-47 tags used for Intl date/number formatting per app language. */
export const LOCALE_TAGS: Record<AppLanguage, string> = {
  pt: 'pt-PT',
  en: 'en-GB', // en-GB: day/month order and 24h clock, matching Portuguese habits
};

/**
 * Narrow any device/browser locale to a supported app language.
 * Anything that isn't explicitly Portuguese falls back to English, except when
 * nothing is detectable at all — see resolveInitialLanguage.
 */
export function matchAppLanguage(locale: string | null | undefined): AppLanguage | null {
  if (!locale) return null;
  const lower = locale.toLowerCase();
  if (lower.startsWith('pt')) return 'pt';
  if (lower.startsWith('en')) return 'en';
  return null;
}

/**
 * Pick the language to start in.
 *
 * Order: an explicit stored choice always wins (forever — we never "helpfully"
 * revert to device locale), then the device/browser locale, then Portuguese.
 * A non-Portuguese, non-English device gets English: Turnos' worker base is
 * heavily migrant, and English is far likelier to be readable than Portuguese
 * for someone whose phone is in Ukrainian or Hindi.
 */
export function resolveInitialLanguage(
  stored: string | null | undefined,
  deviceLocales: readonly (string | null | undefined)[],
): AppLanguage {
  const storedMatch = matchAppLanguage(stored);
  if (storedMatch) return storedMatch;

  for (const locale of deviceLocales) {
    const match = matchAppLanguage(locale);
    if (match) return match;
  }

  // Detectable but unsupported (e.g. 'uk-UA') → English; nothing at all → PT
  const hasAnyLocale = deviceLocales.some(Boolean);
  return hasAnyLocale ? 'en' : DEFAULT_LANGUAGE;
}

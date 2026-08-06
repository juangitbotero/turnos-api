/**
 * Mobile i18n runtime.
 *
 * Language resolution on first launch: device locale → PT if undetectable,
 * EN for any detectable non-Portuguese locale. Once the worker picks a
 * language manually it is stored and always wins, including across restarts.
 *
 * The catalogues themselves live in @turnos/shared so the web admin uses the
 * exact same strings.
 */
import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import i18n from 'i18next';
import { initReactI18next, useTranslation as useI18nTranslation } from 'react-i18next';
import {
  CATALOGUES, AppLanguage, DEFAULT_LANGUAGE, resolveInitialLanguage,
  translateSkill, translateSkills, translateCategory, translateWorkerLanguage,
  weekdayKey,
  formatShortDate, formatLongDate, formatWeekdayDate, formatDateTime,
  formatSmartDate, formatDateRange, formatMoney, formatNumericDate, formatTimestamp,
  monthName, weekdayInitials,
} from '@turnos/shared';

const LANGUAGE_KEY = 'turnos_language';

/** Read the stored choice — null when the worker has never picked one. */
export async function getStoredLanguage(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

async function storeLanguage(lang: AppLanguage): Promise<void> {
  try {
    await SecureStore.setItemAsync(LANGUAGE_KEY, lang);
  } catch {
    // Non-fatal: the language simply won't persist to the next launch.
  }
}

/** Initialise i18next once, before the tree renders. */
export async function initI18n(): Promise<AppLanguage> {
  const stored = await getStoredLanguage();
  const deviceLocales = Localization.getLocales().map(l => l.languageTag);
  const lang = resolveInitialLanguage(stored, deviceLocales);

  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources: {
        pt: { translation: CATALOGUES.pt },
        en: { translation: CATALOGUES.en },
      },
      lng: lang,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: { escapeValue: false }, // React Native escapes on its own
      returnNull: false,
    });
  } else {
    await i18n.changeLanguage(lang);
  }

  return lang;
}

// ── Context ──────────────────────────────────────────────────────────────────

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: async () => {},
});

export function LanguageProvider({
  initialLanguage, children,
}: {
  initialLanguage: AppLanguage;
  children: ReactNode;
}) {
  const [language, setLanguageState] = useState<AppLanguage>(initialLanguage);

  useEffect(() => { setLanguageState(initialLanguage); }, [initialLanguage]);

  const setLanguage = useCallback(async (lang: AppLanguage) => {
    setLanguageState(lang);           // optimistic — the UI switches instantly
    await i18n.changeLanguage(lang);
    await storeLanguage(lang);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);

/**
 * The hook every screen uses.
 *
 * `t` is i18next's translator for UI copy. The rest are bound to the active
 * language so screens never pass it around by hand:
 *   - tSkill / tCategory / tWorkerLanguage translate DOMAIN DATA for display
 *     (the Portuguese value stays the stored key — see shared/i18n/domain.ts)
 *   - the date/money helpers replace the old hardcoded pt-PT calls
 *
 * ⚠️ The returned object MUST stay referentially stable between renders.
 * Screens put these helpers in `useCallback`/`useEffect` dependency arrays
 * (e.g. the feed's `loadShifts`), so returning a fresh object literal every
 * render makes those callbacks change identity every render, which re-fires
 * the effect, which sets state, which renders again — an infinite fetch loop.
 * Hence useMemo, keyed on the only things the helpers actually close over:
 * react-i18next's `t` (stable per language) and the active language.
 */
export function useT() {
  const { t } = useI18nTranslation();
  const { language } = useLanguage();

  return useMemo(() => ({
    t,
    language,

    // Domain data — display only
    tSkill:          (skill: string)    => translateSkill(skill, language),
    tSkills:         (skills: readonly string[]) => translateSkills(skills, language),
    tCategory:       (category: string) => translateCategory(category, language),
    tWorkerLanguage: (lang: string)     => translateWorkerLanguage(lang, language),
    /** Stored weekday abbreviation ('Seg') → display label ('Seg' / 'Mon'). */
    tWeekday: (storedDay: string) => {
      const key = weekdayKey(storedDay);
      return key ? t(`domain.weekdaysShort.${key}`) : storedDay;
    },

    // Locale-aware formatting
    fShortDate:   (d: string | Date) => formatShortDate(d, language),
    fLongDate:    (d: string | Date) => formatLongDate(d, language),
    fWeekdayDate: (d: string | Date) => formatWeekdayDate(d, language),
    fDateTime:    (d: string | Date) => formatDateTime(d, language),
    fTimestamp:   (d: string | Date) => formatTimestamp(d, language),
    fNumericDate: (d: string | Date) => formatNumericDate(d, language),
    fDateRange:   (dates: readonly string[]) => formatDateRange(dates, language),
    fMoney:       (amount: number)   => formatMoney(amount, language),
    // Calendar-grid building blocks — replace hardcoded month/weekday arrays
    fMonthName:       (monthIndex: number, year?: number) => monthName(monthIndex, language, year),
    fWeekdayInitials: () => weekdayInitials(language),
    fSmartDate:   (d: string | Date, monthFormat: 'short' | 'long' = 'short') =>
      formatSmartDate(d, language, {
        today:    t('common.today'),
        tomorrow: t('common.tomorrow'),
      }, monthFormat),
  }), [t, language]);
}

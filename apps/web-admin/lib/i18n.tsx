'use client';

/**
 * Web-admin i18n runtime.
 *
 * The choice is stored in a COOKIE rather than localStorage on purpose: it has
 * to survive the navigation from the public home page through login and into
 * the dashboard, and a cookie is also readable server-side if we later add
 * localised routes for SEO.
 *
 * 15 of 16 files in this app are already client components, so a client-side
 * i18n runtime covers everything without Next.js server-component machinery.
 */
import {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from 'react';
import i18n from 'i18next';
import { initReactI18next, useTranslation as useI18nTranslation } from 'react-i18next';
import {
  CATALOGUES, AppLanguage, DEFAULT_LANGUAGE, resolveInitialLanguage,
  translateSkill, translateSkills, translateCategory, translateWorkerLanguage,
  formatShortDate, formatLongDate, formatWeekdayDate, formatDateTime,
  formatSmartDate, formatDateRange, formatNumericDate, formatMoney,
} from '@turnos/shared';

const COOKIE = 'turnos_lang';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year

export function readLanguageCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeLanguageCookie(lang: AppLanguage): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE}=${lang}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Browser languages, most-preferred first. */
function browserLocales(): string[] {
  if (typeof navigator === 'undefined') return [];
  return [...(navigator.languages ?? []), navigator.language].filter(Boolean) as string[];
}

let initialised = false;

function ensureI18n(lang: AppLanguage): void {
  if (initialised) return;
  i18n.use(initReactI18next).init({
    resources: {
      pt: { translation: CATALOGUES.pt },
      en: { translation: CATALOGUES.en },
    },
    lng: lang,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false }, // React escapes for us
    returnNull: false,
  });
  initialised = true;
}

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  /** False until the client has read the cookie — see the note in the provider. */
  ready: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  ready: false,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Start on the default so server and first client render agree — reading the
  // cookie during render would cause a hydration mismatch. The real language is
  // applied in the effect below, before paint.
  const [language, setLanguageState] = useState<AppLanguage>(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);

  ensureI18n(DEFAULT_LANGUAGE);

  useEffect(() => {
    const resolved = resolveInitialLanguage(readLanguageCookie(), browserLocales());
    setLanguageState(resolved);
    void i18n.changeLanguage(resolved);
    setReady(true);
  }, []);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    void i18n.changeLanguage(lang);
    writeLanguageCookie(lang);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, ready }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);

/** Same shape as the mobile hook, so screens read identically in both apps. */
export function useT() {
  const { t } = useI18nTranslation();
  const { language } = useLanguage();

  return {
    t,
    language,

    // Domain data — display only; the Portuguese value stays the stored key
    tSkill:          (skill: string) => translateSkill(skill, language),
    tSkills:         (skills: readonly string[]) => translateSkills(skills, language),
    tCategory:       (category: string) => translateCategory(category, language),
    tWorkerLanguage: (l: string) => translateWorkerLanguage(l, language),

    // Locale-aware formatting
    fShortDate:   (d: string | Date) => formatShortDate(d, language),
    fLongDate:    (d: string | Date) => formatLongDate(d, language),
    fWeekdayDate: (d: string | Date) => formatWeekdayDate(d, language),
    fNumericDate: (d: string | Date) => formatNumericDate(d, language),
    fDateTime:    (d: string | Date) => formatDateTime(d, language),
    fDateRange:   (dates: readonly string[]) => formatDateRange(dates, language),
    fMoney:       (amount: number) => formatMoney(amount, language),
    fSmartDate:   (d: string | Date, monthFormat: 'short' | 'long' = 'short') =>
      formatSmartDate(d, language, {
        today:    t('common.today'),
        tomorrow: t('common.tomorrow'),
      }, monthFormat),
  };
}

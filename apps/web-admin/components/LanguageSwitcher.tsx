'use client';

/**
 * PT / EN switch. Used both in the public nav (before sign-in) and in the
 * dashboard header — the choice is stored in a cookie, so picking a language
 * on the home page carries through login into the dashboard.
 */
import { APP_LANGUAGES, APP_LANGUAGE_LABELS, AppLanguage } from '@turnos/shared';
import { useLanguage } from '../lib/i18n';

export function LanguageSwitcher({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { language, setLanguage } = useLanguage();
  const dark = variant === 'dark';

  return (
    <div style={{ ...s.wrap, ...(dark ? s.wrapDark : {}) }} role="group" aria-label="Language">
      {APP_LANGUAGES.map(lang => {
        const active = language === lang;
        return (
          <button
            key={lang}
            onClick={() => setLanguage(lang as AppLanguage)}
            aria-pressed={active}
            title={APP_LANGUAGE_LABELS[lang]}
            style={{
              ...s.btn,
              ...(active ? (dark ? s.btnActiveDark : s.btnActive) : {}),
              ...(!active && dark ? s.btnIdleDark : {}),
            }}
          >
            {lang.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'inline-flex', gap: 2, padding: 3,
    background: '#f1f2f6', borderRadius: 999,
  },
  wrapDark: { background: 'rgba(255,255,255,0.12)' },
  btn: {
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
    color: 'var(--color-text-secondary)',
    padding: '5px 12px', borderRadius: 999, lineHeight: 1,
  },
  btnActive: {
    background: '#fff', color: 'var(--color-primary)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
  },
  btnActiveDark: { background: '#fff', color: 'var(--color-primary)' },
  btnIdleDark:   { color: 'rgba(255,255,255,0.85)' },
};

'use client';

/**
 * The sectors Turnos covers.
 *
 * Reads SHIFT_CATEGORIES — the same source the app posts and filters shifts
 * with — so the sector list and its job titles can never drift from what a
 * company can actually publish. Only the marketing blurb per sector lives in
 * the catalogue; the names and role chips come from the domain translators.
 */
import { useState } from 'react';
import { SHIFT_CATEGORIES } from '@turnos/shared';
import { useT } from '../lib/i18n';

/**
 * Category name → blurb key. Keyed off the stored Portuguese name, which is the
 * database value; a category added to SHIFT_CATEGORIES without an entry here
 * simply renders without a blurb rather than breaking the section.
 */
const BLURB: Record<string, string> = {
  'Restauração':          'restaurants',
  'Hotelaria':            'hospitality',
  'Eventos':              'events',
  'Vendas':               'sales',
  'Logística':            'logistics',
  'Limpeza e Segurança':  'facilities',
  'Apoio ao Cliente':     'support',
  'Administração':        'admin',
};

/** Display order — the sectors that matter most to the Lisbon beta come first. */
const ORDER = [
  'Restauração', 'Hotelaria', 'Eventos', 'Vendas',
  'Logística', 'Limpeza e Segurança', 'Apoio ao Cliente', 'Administração',
];

export function Sectors() {
  const { t, tCategory, tSkill } = useT();
  const [active, setActive] = useState(ORDER[0]!);

  const categories = ORDER.filter(c => c in SHIFT_CATEGORIES);
  const roles = (SHIFT_CATEGORIES as Record<string, readonly string[]>)[active] ?? [];
  const blurbKey = BLURB[active];

  return (
    <section style={s.section}>
      <div style={s.head}>
        <span style={s.eyebrow}>{t('home.sectors.eyebrow')}</span>
        <h2 style={s.title}>{t('home.sectors.title')}</h2>
        <p style={s.sub}>{t('home.sectors.sub')}</p>
      </div>

      <div style={s.tabs}>
        {categories.map(c => (
          <button
            key={c}
            style={{ ...s.tab, ...(c === active ? s.tabActive : {}) }}
            onClick={() => setActive(c)}
          >
            {tCategory(c)}
          </button>
        ))}
      </div>

      <div style={s.panel}>
        <h3 style={s.panelTitle}>{tCategory(active)}</h3>
        {blurbKey && <p style={s.panelBody}>{t(`home.sectors.${blurbKey}`)}</p>}
        <div style={s.chips}>
          {roles.map(r => <span key={r} style={s.chip}>{tSkill(r)}</span>)}
        </div>
      </div>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  section: { padding: '80px 24px', maxWidth: 1080, margin: '0 auto' },
  head: { textAlign: 'center', marginBottom: 32 },
  eyebrow: {
    fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
    color: 'var(--color-primary)',
  },
  title: {
    fontSize: 34, fontWeight: 800, letterSpacing: '-1px', margin: '10px 0 8px',
    color: 'var(--color-text-primary)', lineHeight: 1.15,
  },
  sub: { fontSize: 15.5, color: 'var(--color-text-secondary)', maxWidth: 620, margin: '0 auto' },

  tabs: {
    display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 20,
  },
  tab: {
    padding: '9px 16px', borderRadius: 'var(--radius-full)',
    border: '1.5px solid var(--color-border)', background: '#fff',
    fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    color: 'var(--color-text-secondary)', whiteSpace: 'nowrap',
  },
  tabActive: {
    background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: '#fff',
  },

  panel: {
    background: '#fff', border: '1px solid var(--color-border)', borderRadius: 16,
    padding: '28px 30px', boxShadow: '0 2px 14px rgba(26,26,46,0.05)',
  },
  panelTitle: {
    fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 10,
  },
  panelBody: {
    fontSize: 15, lineHeight: 1.7, color: 'var(--color-text-secondary)', marginBottom: 18,
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    padding: '6px 13px', borderRadius: 'var(--radius-full)',
    background: 'var(--color-primary-light)', color: 'var(--color-primary)',
    fontSize: 13, fontWeight: 600,
  },
};

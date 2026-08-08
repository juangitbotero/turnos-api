'use client';

/**
 * Accordion FAQ, shared by the company and worker landing pages.
 *
 * Takes translation-key ids rather than strings so the copy stays in the
 * catalogue and both languages are guaranteed to exist — the same reason the
 * landing page's other content arrays hold ids only.
 *
 * Content comes from docs/faq-turnos.md. The two answers marked 🔵 there
 * (temp-agency status, who the legal employer is) are deliberately excluded:
 * they are legal positions, and the brief backing them is still unsigned.
 */
import { useState } from 'react';
import { useT } from '../lib/i18n';
import { IconChevron } from './icons';

export function Faq({ ns, ids }: { ns: string; ids: readonly string[] }) {
  const { t } = useT();
  const [open, setOpen] = useState<string | null>(ids[0] ?? null);

  return (
    <div style={s.list}>
      {ids.map(id => {
        const isOpen = open === id;
        return (
          <div key={id} style={{ ...s.item, ...(isOpen ? s.itemOpen : {}) }}>
            <button
              style={s.q}
              onClick={() => setOpen(isOpen ? null : id)}
              aria-expanded={isOpen}
            >
              <span style={s.qText}>{t(`${ns}.q${id}`)}</span>
              <span style={{
                ...s.chev,
                transform: isOpen ? 'rotate(180deg)' : 'none',
                color: isOpen ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}>
                <IconChevron size={16} />
              </span>
            </button>
            {isOpen && <p style={s.a}>{t(`${ns}.a${id}`)}</p>}
          </div>
        );
      })}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  list: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760, margin: '0 auto' },
  item: {
    background: '#fff', border: '1px solid var(--color-border)',
    borderRadius: 12, overflow: 'hidden', transition: 'border-color .15s',
  },
  itemOpen: { borderColor: 'rgba(106,121,255,0.45)' },
  q: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, padding: '16px 20px', background: 'none', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
  },
  qText: {
    fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.4,
  },
  chev: { display: 'inline-flex', transition: 'transform .18s', flexShrink: 0 },
  a: {
    margin: 0, padding: '0 20px 18px', fontSize: 14.5, lineHeight: 1.65,
    color: 'var(--color-text-secondary)',
  },
};

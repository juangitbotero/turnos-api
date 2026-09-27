'use client';

import Link from 'next/link';
import { useT } from '../lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

/**
 * Renders a legal document — privacy policy, worker terms, company terms.
 *
 * The text of each lives in a `content.ts` beside its route rather than the
 * shared i18n catalogue: a legal document is reviewed as a whole by a lawyer,
 * not key by key. Within a section, content renders in a fixed order:
 * paragraphs, then the table, then the bullets.
 */

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface LegalDoc {
  back: string;
  title: string;
  updated: string;
  lede: string;
  /** Shown in a highlighted box under the title — e.g. "provisional version". */
  notice?: string;
  sections: LegalSection[];
}

export function LegalDocPage({ docs }: { docs: { pt: LegalDoc; en?: LegalDoc } }) {
  const { language } = useT();
  const doc = (language === 'en' ? docs.en : undefined) ?? docs.pt;

  return (
    <main style={s.page}>
      <header style={s.header}>
        <Link href="/" style={s.back}>{doc.back}</Link>
        <LanguageSwitcher />
      </header>

      <article style={s.article}>
        <h1 style={s.h1}>{doc.title}</h1>
        <p style={s.updated}>{doc.updated}</p>
        {doc.notice && <p style={s.notice}>{doc.notice}</p>}
        <p style={s.lede}>{doc.lede}</p>

        {doc.sections.map((section, i) => (
          <section key={i} style={s.section}>
            <h2 style={s.h2}>{section.heading}</h2>
            {section.paragraphs?.map((p, j) => (
              <p key={j} style={s.p}>{p}</p>
            ))}
            {section.table && (
              <div style={s.scroller}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {section.table.head.map((h, j) => (
                        <th key={j} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k} style={s.td}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {section.bullets && (
              <ul style={s.ul}>
                {section.bullets.map((b, j) => (
                  <li key={j} style={s.li}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--color-secondary)',
    color: 'var(--color-text-primary)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, padding: '20px 24px', maxWidth: 820, margin: '0 auto',
  },
  back: {
    color: 'var(--color-primary)', fontWeight: 600, fontSize: 14,
    textDecoration: 'none',
  },
  article: { maxWidth: 820, margin: '0 auto', padding: '8px 24px 80px' },
  h1: { fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px', lineHeight: 1.15 },
  updated: { fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 20px' },
  notice: {
    fontSize: 14, lineHeight: 1.6, margin: '0 0 20px', padding: '12px 16px',
    borderRadius: 10, background: '#fffbeb', border: '1px solid #fcd34d', color: '#78350f',
  },
  lede: { fontSize: 17, lineHeight: 1.65, margin: '0 0 8px' },
  section: { marginTop: 34 },
  h2: { fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 10px' },
  p: { fontSize: 15.5, lineHeight: 1.7, margin: '0 0 12px', color: 'var(--color-text-primary)' },
  ul: { margin: '4px 0 12px', paddingLeft: 22 },
  li: { fontSize: 15.5, lineHeight: 1.7, marginBottom: 6 },
  scroller: { overflowX: 'auto', margin: '10px 0 14px' },
  table: { borderCollapse: 'collapse', width: '100%', minWidth: 520 },
  th: {
    textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--color-text-secondary)', padding: '9px 12px',
    borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap',
  },
  td: {
    fontSize: 14.5, lineHeight: 1.6, padding: '10px 12px', verticalAlign: 'top',
    borderBottom: '1px solid var(--color-border)',
  },
};

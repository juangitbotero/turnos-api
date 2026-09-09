'use client';

import Link from 'next/link';
import { useT } from '../../lib/i18n';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { POLICY } from './content';

/**
 * Privacy policy — public, and required before either app store will accept a
 * submission. The URL is stable on purpose: it goes into App Store Connect and
 * Play Console, and changing it later means editing both listings.
 *
 * The text lives in `./content.ts` rather than the shared i18n catalogue. A
 * legal document is reviewed as a whole by a lawyer, not key by key, and 100+
 * catalogue entries would make that review harder, not easier.
 *
 * ⚠️ This is a good-faith draft written from the actual data flows in the
 * codebase. It has NOT been reviewed by a lawyer, and the controller identity
 * block still has placeholders. See docs/pre-flight.md.
 */
export default function PrivacyPolicyPage() {
  const { language } = useT();
  const doc = POLICY[language] ?? POLICY.pt;

  return (
    <main style={s.page}>
      <header style={s.header}>
        <Link href="/" style={s.back}>{doc.back}</Link>
        <LanguageSwitcher />
      </header>

      <article style={s.article}>
        <h1 style={s.h1}>{doc.title}</h1>
        <p style={s.updated}>{doc.updated}</p>
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

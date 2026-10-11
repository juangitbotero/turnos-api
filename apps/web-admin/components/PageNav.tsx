'use client';

/**
 * Navigation inside a page: breadcrumbs for nested pages, tabs for pages that
 * hold more than one view.
 *
 * Breadcrumbs replace the 13px "← Dashboard" text link every page used to
 * carry. Top-level pages need nothing — the sidebar is always there. A nested
 * page (Turnos › Publicar turno) gets a 36px back button plus the trail.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { IconArrowLeft } from './icons';

export function Breadcrumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  const parent = [...trail].reverse().find(c => c.href);
  return (
    <div style={s.crumbRow}>
      {parent?.href && (
        <Link href={parent.href} style={s.backBtn} aria-label={parent.label}>
          <IconArrowLeft size={17} />
        </Link>
      )}
      <nav aria-label="breadcrumb" style={s.crumbs}>
        {trail.map((c, i) => (
          <span key={i} style={s.crumbItem}>
            {i > 0 && <span style={s.sep}>›</span>}
            {c.href
              ? <Link href={c.href} style={s.crumbLink}>{c.label}</Link>
              : <span style={s.crumbCurrent} aria-current="page">{c.label}</span>}
          </span>
        ))}
      </nav>
    </div>
  );
}

/** Fired by openTab() so a page already on screen switches tab without a remount. */
const TAB_EVENT = 'turnos:tab';

/**
 * Tabs whose selection lives in `?tab=` so a link (email, company menu) can
 * open one directly.
 *
 * Read from window, not useSearchParams: that hook needs a Suspense boundary
 * for the static build, and a boundary hydrates after LanguageProvider has
 * switched from the default language — a hydration mismatch on every page.
 */
export function useTabParam<T extends string>(tabs: readonly T[], fallback: T): [T, (t: T) => void] {
  const [tab, setTabState] = useState<T>(fallback);
  useEffect(() => {
    const sync = () => {
      const q = new URLSearchParams(window.location.search).get('tab') as T | null;
      setTabState(q && tabs.includes(q) ? q : fallback);
    };
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener(TAB_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(TAB_EVENT, sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setTab = (t: T) => {
    const url = new URL(window.location.href);
    if (t === fallback) url.searchParams.delete('tab'); else url.searchParams.set('tab', t);
    window.history.replaceState(window.history.state, '', url);
    setTabState(t);
  };
  return [tab, setTab];
}

/**
 * Navigate to `href` (which may carry ?tab=). When it is the page already on
 * screen, only the URL changes and the page is told to re-read its tab.
 */
export function useOpenTab() {
  const router = useRouter();
  const pathname = usePathname();
  return (href: string) => {
    const [path] = href.split('?');
    if (path === pathname) {
      window.history.pushState(window.history.state, '', href);
      window.dispatchEvent(new Event(TAB_EVENT));
    } else {
      router.push(href);
    }
  };
}

export function PageTabs<T extends string>({ tabs, active, onChange }: {
  tabs: { id: T; label: string }[]; active: T; onChange: (t: T) => void;
}) {
  return (
    <div style={s.tabBar} role="tablist">
      {tabs.map(tb => (
        <button
          key={tb.id}
          type="button"
          role="tab"
          aria-selected={active === tb.id}
          style={{ ...s.tab, ...(active === tb.id ? s.tabActive : {}) }}
          onClick={() => onChange(tb.id)}
        >
          {tb.label}
        </button>
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  crumbRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  backBtn: {
    width: 36, height: 36, flexShrink: 0, borderRadius: '50%',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)', textDecoration: 'none',
    boxShadow: 'var(--shadow-sm)',
  },
  crumbs: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', fontSize: 13.5 },
  crumbItem: { display: 'inline-flex', alignItems: 'center' },
  sep: { margin: '0 8px', color: 'var(--color-text-muted)' },
  crumbLink: { color: 'var(--color-text-secondary)', textDecoration: 'none', fontWeight: 600 },
  crumbCurrent: { color: 'var(--color-text-primary)', fontWeight: 700 },

  tabBar: { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--color-border)' },
  tab: {
    padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'inherit',
    borderBottom: '2px solid transparent', marginBottom: -1,
  },
  tabActive: { color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)' },
};

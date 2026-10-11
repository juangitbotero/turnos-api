'use client';

/**
 * The dashboard frame — sidebar + content area, rendered once by
 * app/dashboard/layout.tsx for every /dashboard/* route.
 *
 * Before 2026-10-11 the sidebar was copied into three pages and missing from
 * the other eight, which only had a small "← Dashboard" text link to get
 * anywhere. Pages now render only their content.
 *
 * The company block at the bottom opens a menu (Definições, A minha subscrição,
 * Sair). It reads the profile once; pages that change the name or logo fire
 * PROFILE_CHANGED_EVENT so it refreshes without a reload.
 *
 * Candidates (2026-10-11): before this a company only learnt someone applied by
 * opening each shift's applicants. The shell now keeps the "Candidatos" badge
 * (candidates waiting for an answer; filled when some are unseen) live from the
 * `shift:new_application` socket event, and shows a toast on whatever page the
 * company is on. Pages that change what is pending or seen fire
 * CANDIDATES_CHANGED_EVENT.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminApi, CandidateCounts, EmployerProfile } from '../lib/api';
import { connectSocket, getSocket, NewApplicationPayload } from '../lib/socket';
import { SIDEBAR_GROUPS, isNavActive } from '../lib/nav';
import { useT } from '../lib/i18n';
import { Logo } from './Logo';
import { useOpenTab } from './PageNav';
import { IconBuilding, IconCard, IconChevron, IconClose, IconLogout, IconSettings, IconUserCheck } from './icons';

export const PROFILE_CHANGED_EVENT = 'turnos:profile-changed';
export const CANDIDATES_CHANGED_EVENT = 'turnos:candidates-changed';

const TOAST_MS = 8000;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { t, tSector } = useT();
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const openTab = useOpenTab();
  const [counts, setCounts] = useState<CandidateCounts>({ pending: 0, unseen: 0 });
  const [toasts, setToasts] = useState<Array<NewApplicationPayload & { key: number }>>([]);

  useEffect(() => {
    const load = () => adminApi.getCandidateCounts().then(setCounts).catch(() => {});
    load();
    window.addEventListener(CANDIDATES_CHANGED_EVENT, load);

    const token = localStorage.getItem('accessToken');
    const socket = token ? connectSocket(token) : getSocket();
    const onNew = (payload: NewApplicationPayload) => {
      load();
      const key = Date.now() + Math.random();
      setToasts(prev => [...prev.slice(-2), { ...payload, key }]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.key !== key)), TOAST_MS);
    };
    socket?.on('shift:new_application', onNew);
    return () => {
      window.removeEventListener(CANDIDATES_CHANGED_EVENT, load);
      socket?.off('shift:new_application', onNew);
    };
  }, []);

  // Links to the page already on screen (e.g. Settings → ?tab=subscription)
  // only change the query; Next does not remount the page, so tell it instead.
  const sameRoute = (href: string) => (e: React.MouseEvent) => {
    setMenuOpen(false);
    if (href.split('?')[0] === pathname) { e.preventDefault(); openTab(href); }
  };

  useEffect(() => {
    const load = () => adminApi.getMyProfile().then(setProfile).catch(() => {});
    load();
    window.addEventListener(PROFILE_CHANGED_EVENT, load);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, load);
  }, []);

  // Close the company menu on navigation and on any click outside it.
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  };

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.top}>
          <div style={s.logo}><Logo height={30} href="/dashboard" /></div>
          {SIDEBAR_GROUPS.map(group => (
            <nav key={group.key} style={s.group}>
              <div style={s.groupLabel}>{t(`admin.nav.${group.key}`)}</div>
              {group.items.map(item => {
                const active = isNavActive(item, pathname);
                const { Icon } = item;
                return (
                  <Link key={item.key} href={item.href} onClick={sameRoute(item.href)} style={{ ...s.item, ...(active ? s.itemActive : {}) }}>
                    <span style={s.icon}><Icon size={17} /></span>
                    <span>{t(`admin.nav.${item.key}`)}</span>
                    {item.key === 'candidates' && counts.pending > 0 && (
                      <span
                        style={{ ...s.badge, ...(counts.unseen > 0 ? s.badgeNew : {}) }}
                        aria-label={t('admin.candidates.subCount', { count: counts.pending })}
                      >
                        {counts.pending > 99 ? '99+' : counts.pending}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          ))}
        </div>

        <div style={s.bottom} ref={menuRef}>
          {menuOpen && (
            <div style={s.menu} role="menu">
              <Link href="/dashboard/settings" style={s.menuItem} role="menuitem" onClick={sameRoute('/dashboard/settings')}>
                <IconSettings size={15} /> {t('admin.nav.settings')}
              </Link>
              <Link href="/dashboard/settings?tab=subscription" style={s.menuItem} role="menuitem" onClick={sameRoute('/dashboard/settings?tab=subscription')}>
                <IconCard size={15} /> {t('admin.nav.billing')}
              </Link>
              <div style={s.menuDivider} />
              <button type="button" style={{ ...s.menuItem, ...s.menuButton }} onClick={logout} role="menuitem">
                <IconLogout size={15} /> {t('admin.chrome.signOut')}
              </button>
            </div>
          )}
          <button
            type="button"
            style={s.company}
            onClick={() => setMenuOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span style={s.avatar}>
              {profile?.logoUrl
                ? <img src={profile.logoUrl} alt="" style={s.avatarImg} />
                : <IconBuilding size={18} />}
            </span>
            <span style={s.companyText}>
              <span style={s.companyName}>{profile?.companyName ?? t('admin.chrome.myCompany')}</span>
              <span style={s.companySub}>{profile?.sector ? tSector(profile.sector) : '—'}</span>
            </span>
            <span style={{ ...s.chev, transform: menuOpen ? 'rotate(180deg)' : 'none' }}>
              <IconChevron size={14} />
            </span>
          </button>
        </div>
      </aside>

      <main style={s.main}>{children}</main>

      {toasts.length > 0 && (
        <div style={s.toastStack} role="status" aria-live="polite">
          {toasts.map(toast => (
            <div key={toast.key} style={s.toast}>
              <span style={s.toastIcon}><IconUserCheck size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.toastTitle}>
                  {t('admin.chrome.toastNewCandidate', { name: toast.workerName ?? t('admin.shifts.noName') })}
                </div>
                <div style={s.toastSub}>{t('admin.chrome.toastFor', { shift: toast.shiftTitle })}</div>
              </div>
              <Link
                href="/dashboard/candidates"
                style={s.toastBtn}
                onClick={() => setToasts(prev => prev.filter(x => x.key !== toast.key))}
              >
                {t('admin.chrome.toastSee')}
              </Link>
              <button
                type="button"
                style={s.toastClose}
                aria-label="✕"
                onClick={() => setToasts(prev => prev.filter(x => x.key !== toast.key))}
              >
                <IconClose size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' },

  sidebar: {
    width: 240, flexShrink: 0,
    background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: '20px 14px 16px',
    position: 'sticky', top: 0, height: '100vh',
  },
  top: { display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto' },
  logo: { padding: '6px 12px 4px' },
  group: { display: 'flex', flexDirection: 'column', gap: 2 },
  groupLabel: {
    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase',
    color: 'var(--color-text-muted)', padding: '0 12px 6px',
  },
  item: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 'var(--radius-sm)',
    fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)',
    textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
  },
  itemActive: {
    background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 700,
  },
  icon: { width: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  bottom: { position: 'relative', borderTop: '1px solid var(--color-border)', paddingTop: 12 },
  company: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 10px', background: 'var(--color-bg)', border: 'none',
    borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
  },
  avatar: {
    width: 36, height: 36, flexShrink: 0, overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-primary-light)', color: 'var(--color-primary)',
    borderRadius: 'var(--radius-sm)',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  companyText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  companyName: {
    fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  companySub: {
    fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  chev: { color: 'var(--color-text-muted)', display: 'inline-flex', transition: 'transform 0.15s' },

  menu: {
    position: 'absolute', left: 0, right: 0, bottom: 'calc(100% + 6px)',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', boxShadow: '0 8px 28px rgba(15,15,35,0.14)',
    padding: 6, zIndex: 40,
  },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '9px 10px', borderRadius: 'var(--radius-sm)',
    fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', textDecoration: 'none',
  },
  menuButton: {
    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    textAlign: 'left', color: '#dc2626',
  },
  menuDivider: { height: 1, background: 'var(--color-border)', margin: '4px 2px' },

  badge: {
    marginLeft: 'auto', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 800, background: 'var(--color-border)', color: 'var(--color-text-secondary)',
  },
  badgeNew: { background: '#dc2626', color: '#fff' },

  main: { flex: 1, minWidth: 0 },

  toastStack: {
    // Bottom-left of the content area: the bottom-right corner belongs to the
    // VerifyEmailBanner, and a toast must not cover it.
    position: 'fixed', left: 260, bottom: 20, zIndex: 300,
    display: 'flex', flexDirection: 'column', gap: 10, width: 360, maxWidth: 'calc(100vw - 32px)',
  },
  toast: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 14px',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderLeft: '4px solid var(--color-primary)', borderRadius: 'var(--radius-md)',
    boxShadow: '0 10px 30px rgba(15,15,35,0.16)',
  },
  toastIcon: {
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-primary-light)', color: 'var(--color-primary)',
  },
  toastTitle: { fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)' },
  toastSub: {
    fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  toastBtn: {
    padding: '7px 14px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary)',
    color: '#fff', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', flexShrink: 0,
  },
  toastClose: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
    color: 'var(--color-text-muted)', display: 'inline-flex',
  },
};

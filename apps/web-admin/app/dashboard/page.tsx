'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi, Shift, EmployerProfile } from '../../lib/api';
import { SIDEBAR_NAV } from '../../lib/nav';
import { useT } from '../../lib/i18n';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { Logo } from '../../components/Logo';
import { IconClipboard, IconBolt, IconUsers, IconAlert, IconSearch, IconQr, IconBuilding } from '../../components/icons';

export default function DashboardPage() {
  const router = useRouter();
  const { t, fWeekdayDate } = useT();
  const [shifts, setShifts]   = useState<Shift[]>([]);
  const [profile, setProfile] = useState<EmployerProfile | null>(null);

  useEffect(() => {
    adminApi.getMyShifts().then(setShifts).catch(() => {});
    adminApi.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  // Client-side expiry detection (same logic as backend cron)
  const isExpired = (shift: Shift) => {
    if (!['OPEN', 'PENDING_ACCEPTANCE'].includes(shift.status)) return false;
    const [h, m] = shift.endTime.split(':').map(Number);
    const [y, mo, d] = shift.date.split('-').map(Number);
    const end = new Date(y!, (mo! - 1), d!, h ?? 0, m ?? 0, 0);
    return end < new Date();
  };

  const activeShifts   = shifts.filter(s => ['OPEN', 'FILLED', 'ACTIVE', 'PENDING_ACCEPTANCE'].includes(s.status) && !isExpired(s));
  const openShifts     = shifts.filter(s => s.status === 'OPEN' && !isExpired(s));
  const filledShifts   = shifts.filter(s => ['FILLED', 'ACTIVE', 'PENDING_ACCEPTANCE'].includes(s.status) && !isExpired(s));
  const pendingApproval = shifts.filter(s => s.status === 'PENDING_ACCEPTANCE');
  const expiredShifts  = shifts.filter(s => s.status === 'EXPIRED' || isExpired(s));

  const kpiCards = [
    {
      Icon: IconClipboard, label: t('admin.home.kpiActive'), color: 'var(--color-primary)',
      value: String(activeShifts.length),
      sub: t('admin.home.kpiActiveSub', {
        open: openShifts.length === 1
          ? t('admin.home.kpiActiveOpenOne')
          : t('admin.home.kpiActiveOpenOther', { count: openShifts.length }),
        filled: filledShifts.length === 1
          ? t('admin.home.kpiActiveFilledOne')
          : t('admin.home.kpiActiveFilledOther', { count: filledShifts.length }),
      }),
      href: '/dashboard/shifts',
    },
    {
      Icon: IconBolt, label: t('admin.home.kpiAwaiting'), color: '#d97706',
      value: String(pendingApproval.length),
      sub: pendingApproval.length === 0
        ? t('admin.home.kpiAwaitingNone')
        : t('admin.home.kpiAwaitingSome'),
      href: '/dashboard/shifts',
    },
    {
      Icon: IconUsers, label: t('admin.home.kpiApplicants'), color: 'var(--color-success)',
      value: String(openShifts.length),
      sub: openShifts.length === 0
        ? t('admin.home.kpiApplicantsNone')
        : t('admin.home.kpiApplicantsSome'),
      href: '/dashboard/shifts',
    },
    {
      Icon: IconAlert, label: t('admin.home.kpiExpired'), color: '#ef4444',
      value: String(expiredShifts.length),
      sub: expiredShifts.length === 0
        ? t('admin.home.kpiExpiredNone')
        : t('admin.home.kpiExpiredSome'),
      href: '/dashboard/shifts',
    },
  ];

  return (
    <div style={s.shell}>

      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.sidebarTop}>
          <div style={{ padding: '8px 12px', marginBottom: 8 }}><Logo height={22} href="/dashboard" /></div>
          <div style={s.sidebarDivider} />
          <nav style={s.sidebarNav}>
            {SIDEBAR_NAV.map(({ Icon, key, href, soon }) => {
              const isActive = href === '/dashboard';
              const label = t(`admin.nav.${key}`);
              if (soon || !href) {
                return (
                  <div key={key} style={{ ...s.sidebarItem, ...s.sidebarItemDisabled }}>
                    <span style={s.sidebarIcon}><Icon size={17} /></span>
                    <span>{label}</span>
                    <span style={s.soonPill}>{t('admin.chrome.soon')}</span>
                  </div>
                );
              }
              return (
                <Link key={href} href={href}
                  style={{ ...s.sidebarItem, ...(isActive ? s.sidebarItemActive : {}) }}
                >
                  <span style={s.sidebarIcon}><Icon size={17} /></span>
                  <span>{label}</span>
                  {isActive && <span style={s.activeIndicator} />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={s.sidebarBottom}>
          <div style={s.companyBadge}>
            <div style={s.companyAvatar}><IconBuilding size={18} /></div>
            <div>
              <div style={s.companyName}>{profile?.companyName ?? t('admin.chrome.myCompany')}</div>
              <div style={s.companyPlan}>{profile?.sector ?? '—'}</div>
            </div>
          </div>
          <Link href="/login" style={s.logoutBtn}>{t('admin.chrome.logout')}</Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={s.main}>

        {/* Top bar */}
        <header style={s.topBar}>
          <div>
            <h1 style={s.pageTitle}>
              {profile?.companyName
                ? t('admin.home.greetingNamed', { company: profile.companyName })
                : t('admin.home.greeting')}
            </h1>
            <p style={s.pageDate}>{fWeekdayDate(new Date())}</p>
          </div>
          <div style={s.topBarActions}>
            <LanguageSwitcher />
            <button style={s.postShiftBtn} onClick={() => router.push('/dashboard/new-shift')}>
              {t('admin.chrome.postShift')}
            </button>
          </div>
        </header>

        {/* KPI cards */}
        <section style={s.kpiGrid}>
          {kpiCards.map(({ Icon, label, value, sub, color, href }) => (
            <Link key={label} href={href} style={{ textDecoration: 'none' }}>
              <div style={s.kpiCard}>
                <div style={{ ...s.kpiIcon, background: `${color}18`, color }}><Icon size={19} /></div>
                <div>
                  <div style={s.kpiValue}>{value}</div>
                  <div style={s.kpiLabel}>{label}</div>
                  <div style={s.kpiSub}>{sub}</div>
                </div>
              </div>
            </Link>
          ))}
        </section>

        {/* Quick actions */}
        <section style={s.quickActions}>
          <QuickAction
            Icon={IconClipboard} title={t('admin.home.actionPostTitle')}
            desc={t('admin.home.actionPostDesc')}
            cta={t('admin.home.actionPostCta')} href="/dashboard/new-shift" primary
          />
          <QuickAction
            Icon={IconSearch} title={t('admin.home.actionSearchTitle')}
            desc={t('admin.home.actionSearchDesc')}
            cta={t('admin.home.actionSearchCta')} href="/dashboard/workers-search"
          />
          <QuickAction
            Icon={IconUsers} title={t('admin.home.actionWorkersTitle')}
            desc={t('admin.home.actionWorkersDesc')}
            cta={t('admin.home.actionWorkersCta')} href="/dashboard/workers"
          />
          <QuickAction
            Icon={IconQr} title={t('admin.home.actionQrTitle')}
            desc={t('admin.home.actionQrDesc')}
            cta={t('admin.home.actionQrCta')} href="/dashboard/qr-codes"
          />
        </section>

      </main>
    </div>
  );
}

function QuickAction({ Icon, title, desc, cta, href, primary }: {
  Icon: (p: { size?: number }) => React.ReactElement;
  title: string; desc: string; cta: string; href: string; primary?: boolean;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ ...qa.card, ...(primary ? qa.cardPrimary : {}) }}>
        <span style={qa.icon}><Icon size={20} /></span>
        <div style={qa.body}>
          <div style={qa.title}>{title}</div>
          <div style={qa.desc}>{desc}</div>
        </div>
        <span style={{ ...qa.cta, ...(primary ? qa.ctaPrimary : {}) }}>{cta}</span>
      </div>
    </Link>
  );
}

const qa: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', padding: '16px 18px',
    boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.15s',
    cursor: 'pointer',
  },
  cardPrimary: {
    background: 'linear-gradient(135deg, #6a79ff08, #9b6dff08)',
    borderColor: 'rgba(106,121,255,0.3)',
  },
  icon: { fontSize: 28, flexShrink: 0 },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 2 },
  desc: { fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 },
  cta: {
    fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)',
    flexShrink: 0, whiteSpace: 'nowrap' as const,
  },
  ctaPrimary: { color: 'var(--color-primary)' },
};

/* ─────────────────────────── Styles ─────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' },

  /* Sidebar */
  sidebar: {
    width: 240, flexShrink: 0,
    background: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    display: 'flex', flexDirection: 'column',
    padding: '24px 16px',
    position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
  },
  sidebarTop: { flex: 1, display: 'flex', flexDirection: 'column' },
  sidebarLogoWrap: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '8px 12px', marginBottom: 8,
  },
  sidebarLogoText: {
    fontSize: 20, fontWeight: 800, color: 'var(--color-primary)',
    letterSpacing: '-0.5px',
  },
  sidebarLogoDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--color-primary)', opacity: 0.7,
    marginBottom: 2,
  },
  sidebarDivider: { height: 1, background: 'var(--color-border)', margin: '8px 0 16px' },
  sidebarNav: { display: 'flex', flexDirection: 'column', gap: 4 },
  sidebarItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 'var(--radius-sm)',
    fontSize: 14, fontWeight: 500,
    color: 'var(--color-text-secondary)',
    textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
    position: 'relative',
  },
  sidebarItemActive: {
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary)', fontWeight: 700,
  },
  sidebarItemDisabled: { opacity: 0.45, cursor: 'default' },
  sidebarIcon: { width: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  activeIndicator: {
    marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
    background: 'var(--color-primary)',
  },
  soonPill: {
    marginLeft: 'auto', fontSize: 9, fontWeight: 700,
    letterSpacing: '0.5px', textTransform: 'uppercase' as const,
    background: 'var(--color-neutral)', color: 'var(--color-text-secondary)',
    padding: '2px 6px', borderRadius: 4,
  },
  sidebarBottom: {
    borderTop: '1px solid var(--color-border)', paddingTop: 16,
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  companyBadge: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
  },
  companyAvatar: {
    width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-primary-light)', borderRadius: 'var(--radius-sm)', flexShrink: 0,
  },
  companyName: { fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' },
  companyPlan: { fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 },
  logoutBtn: {
    fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none',
    padding: '8px 12px', display: 'block', textAlign: 'center',
    borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
  },

  /* Main */
  main: {
    flex: 1, padding: '32px 36px', overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: 28,
  },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  topBarActions: { display: 'flex', alignItems: 'center', gap: 14 },
  pageTitle: {
    fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px',
  },
  pageDate: { fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2, textTransform: 'capitalize' },
  postShiftBtn: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    color: '#fff', border: 'none', borderRadius: 'var(--radius-full)',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 16px var(--color-primary-glow)',
    fontFamily: 'inherit',
  },

  /* KPI grid */
  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16,
  },
  kpiCard: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', padding: '20px',
    display: 'flex', alignItems: 'flex-start', gap: 14,
    boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
    transition: 'box-shadow 0.15s',
  },
  kpiIcon: {
    fontSize: 22, width: 44, height: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 'var(--radius-sm)', flexShrink: 0,
  },
  kpiValue: {
    fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)',
    letterSpacing: '-1px', lineHeight: 1.1,
  },
  kpiLabel: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 4 },
  kpiSub: { fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 },

  /* Quick actions */
  quickActions: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12,
  },

};

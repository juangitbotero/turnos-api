'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi, Shift, EmployerProfile, CandidateCounts } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { IconClipboard, IconBolt, IconUsers, IconAlert, IconSearch, IconQr } from '../../components/icons';

export default function DashboardPage() {
  const router = useRouter();
  const { t, fWeekdayDate } = useT();
  const [shifts, setShifts]   = useState<Shift[]>([]);
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [candidates, setCandidates] = useState<CandidateCounts>({ pending: 0, unseen: 0 });

  useEffect(() => {
    adminApi.getMyShifts().then(setShifts).catch(() => {});
    adminApi.getMyProfile().then(setProfile).catch(() => {});
    adminApi.getCandidateCounts().then(setCandidates).catch(() => {});
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
      Icon: IconBolt, label: t('admin.home.kpiAwaiting'), color: 'var(--color-primary)',
      value: String(pendingApproval.length),
      sub: pendingApproval.length === 0
        ? t('admin.home.kpiAwaitingNone')
        : t('admin.home.kpiAwaitingSome'),
      href: '/dashboard/shifts',
    },
    {
      // Real candidates waiting for an answer — this card used to show the
      // number of open shifts under a "pending applicants" label.
      Icon: IconUsers, label: t('admin.home.kpiApplicants'),
      color: candidates.unseen > 0 ? '#dc2626' : 'var(--color-primary)',
      value: String(candidates.pending),
      sub: candidates.unseen > 0
        ? t('admin.home.kpiApplicantsNew', { count: candidates.unseen })
        : candidates.pending > 0
          ? t('admin.home.kpiApplicantsSome')
          : t('admin.home.kpiApplicantsNone'),
      href: '/dashboard/candidates',
    },
    {
      Icon: IconAlert, label: t('admin.home.kpiExpired'), color: 'var(--color-primary)',
      value: String(expiredShifts.length),
      sub: expiredShifts.length === 0
        ? t('admin.home.kpiExpiredNone')
        : t('admin.home.kpiExpiredSome'),
      href: '/dashboard/shifts',
    },
  ];

  return (
      <div style={s.main}>
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
                <div style={{ ...s.kpiIcon, color }}><Icon size={19} /></div>
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
  /* Main */
  main: {
    padding: '32px 36px',
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

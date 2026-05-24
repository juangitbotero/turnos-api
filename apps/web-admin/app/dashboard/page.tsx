'use client';

import Link from 'next/link';

const SIDEBAR_NAV = [
  { icon: '🏠', label: 'Dashboard',     href: '/dashboard',   active: true  },
  { icon: '📋', label: 'Turnos',         href: '/shifts',      active: false },
  { icon: '👷', label: 'Trabalhadores',  href: '/workers',     active: false },
  { icon: '📊', label: 'Conformidade',   href: '/compliance',  active: false },
  { icon: '💳', label: 'Faturação',      href: '/billing',     active: false },
  { icon: '⚙️', label: 'Definições',    href: '/settings',    active: false },
];

const KPI_CARDS = [
  { icon: '📋', label: 'Turnos ativos',      value: '0',  sub: 'Nenhum turno publicado', color: 'var(--color-primary)' },
  { icon: '👷', label: 'Trabalhadores contratados', value: '0', sub: 'Beta a iniciar', color: 'var(--color-success)' },
  { icon: '⏳', label: 'Turnos pendentes',   value: '0',  sub: 'Sem candidatos ainda', color: 'var(--color-warning)' },
  { icon: '💶', label: 'Gasto este mês',     value: '€0', sub: 'Sem turnos concluídos', color: '#9b6dff' },
];

const RECENT_ACTIVITY = [
  { icon: '🎉', text: 'Conta de empresa criada',         time: 'Agora mesmo',  color: 'var(--color-primary-light)' },
  { icon: '🔜', text: 'Stint 1 — Auth & Identity',       time: 'Em progresso', color: 'var(--color-warning-light)' },
  { icon: '📋', text: 'Publicar primeiro turno (Stint 2)', time: 'Planeado',  color: 'var(--color-neutral-light)' },
];

export default function DashboardPage() {
  return (
    <div style={s.shell}>

      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.sidebarTop}>
          <Link href="/" style={s.sidebarLogo}>turnos</Link>
          <div style={s.sidebarDivider} />
          <nav style={s.sidebarNav}>
            {SIDEBAR_NAV.map(({ icon, label, href, active }) => (
              <Link
                key={href}
                href={href}
                style={{
                  ...s.sidebarItem,
                  ...(active ? s.sidebarItemActive : {}),
                }}
              >
                <span style={s.sidebarIcon}>{icon}</span>
                <span>{label}</span>
                {active && <span style={s.activeIndicator} />}
              </Link>
            ))}
          </nav>
        </div>
        <div style={s.sidebarBottom}>
          <div style={s.companyBadge}>
            <div style={s.companyAvatar}>🏢</div>
            <div>
              <div style={s.companyName}>A Minha Empresa</div>
              <div style={s.companyPlan}>Plano Starter</div>
            </div>
          </div>
          <Link href="/login" style={s.logoutBtn}>Sair →</Link>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={s.main}>

        {/* Top bar */}
        <header style={s.topBar}>
          <div>
            <h1 style={s.pageTitle}>Dashboard</h1>
            <p style={s.pageDate}>{new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <button id="post-shift-btn" style={s.postShiftBtn}>
            + Publicar Turno
          </button>
        </header>

        {/* Stint progress banner */}
        <div style={s.stintBanner}>
          <div style={s.stintBannerLeft}>
            <div style={s.stintBannerDot} />
            <div>
              <div style={s.stintBannerTitle}>🔜 Stint 1 — Auth & Identity em progresso</div>
              <div style={s.stintBannerSub}>Sistema de login, registo de empresa e perfis de trabalhadores a ser construído.</div>
            </div>
          </div>
          <div style={s.stintProgress}>
            <div style={s.stintProgressBar}>
              <div style={s.stintProgressFill} />
            </div>
            <span style={s.stintProgressLabel}>10%</span>
          </div>
        </div>

        {/* KPI cards */}
        <section style={s.kpiGrid}>
          {KPI_CARDS.map(({ icon, label, value, sub, color }) => (
            <div key={label} style={s.kpiCard}>
              <div style={{ ...s.kpiIcon, background: `${color}18`, color }}>
                {icon}
              </div>
              <div>
                <div style={s.kpiValue}>{value}</div>
                <div style={s.kpiLabel}>{label}</div>
                <div style={s.kpiSub}>{sub}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Two columns */}
        <div style={s.columns}>

          {/* Quick action */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>Ação rápida</h2>
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>📋</div>
              <div style={s.emptyTitle}>Publique o seu primeiro turno</div>
              <div style={s.emptySub}>
                Disponível no Stint 2 — Shift Marketplace.<br />
                Estamos a construir isso agora!
              </div>
              <button id="post-shift-cta-btn" style={s.emptyBtn} disabled>
                Publicar Turno <span style={s.soonTag}>Em breve</span>
              </button>
            </div>
          </div>

          {/* Activity feed */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>Atividade recente</h2>
            <div style={s.activityList}>
              {RECENT_ACTIVITY.map(({ icon, text, time, color }) => (
                <div key={text} style={s.activityItem}>
                  <div style={{ ...s.activityIcon, background: color }}>{icon}</div>
                  <div style={s.activityBody}>
                    <div style={s.activityText}>{text}</div>
                    <div style={s.activityTime}>{time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}

/* ─────────────────────────── Styles ─────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--color-bg)',
  },

  /* Sidebar */
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflow: 'hidden',
  },
  sidebarTop: { flex: 1, display: 'flex', flexDirection: 'column' },
  sidebarLogo: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--color-primary)',
    textDecoration: 'none',
    letterSpacing: '-0.5px',
    padding: '8px 12px',
    display: 'block',
    marginBottom: 8,
  },
  sidebarDivider: {
    height: 1,
    background: 'var(--color-border)',
    margin: '8px 0 16px',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  sidebarItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    transition: 'background var(--transition-fast), color var(--transition-fast)',
    position: 'relative',
  },
  sidebarItemActive: {
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
    fontWeight: 700,
  },
  sidebarIcon: { fontSize: 16, width: 20, textAlign: 'center' },
  activeIndicator: {
    marginLeft: 'auto',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--color-primary)',
  },
  sidebarBottom: {
    borderTop: '1px solid var(--color-border)',
    paddingTop: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  companyBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    background: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
  },
  companyAvatar: {
    fontSize: 24,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-primary-light)',
    borderRadius: 'var(--radius-sm)',
    flexShrink: 0,
  },
  companyName: { fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' },
  companyPlan: { fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 },
  logoutBtn: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
    textDecoration: 'none',
    padding: '8px 12px',
    display: 'block',
    textAlign: 'center',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    transition: 'color var(--transition-fast)',
  },

  /* Main */
  main: {
    flex: 1,
    padding: '32px 36px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--color-text-primary)',
    letterSpacing: '-0.8px',
  },
  pageDate: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  postShiftBtn: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px var(--color-primary-glow)',
    fontFamily: 'inherit',
    transition: 'transform var(--transition-fast)',
  },

  /* Stint banner */
  stintBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    background: 'linear-gradient(135deg, var(--color-primary-light), #fff)',
    border: '1px solid rgba(106,121,255,0.2)',
    borderRadius: 'var(--radius-md)',
    padding: '16px 20px',
  },
  stintBannerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  stintBannerDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: 'var(--color-primary)',
    boxShadow: '0 0 8px rgba(106,121,255,0.5)',
    flexShrink: 0,
    animation: 'pulse-glow 2s ease-in-out infinite',
  },
  stintBannerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
  },
  stintBannerSub: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginTop: 2,
  },
  stintProgress: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  stintProgressBar: {
    width: 120,
    height: 6,
    background: 'var(--color-neutral-light)',
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden',
  },
  stintProgressFill: {
    width: '10%',
    height: '100%',
    background: 'linear-gradient(90deg, var(--color-primary), #9b6dff)',
    borderRadius: 'var(--radius-full)',
  },
  stintProgressLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--color-primary)',
  },

  /* KPI grid */
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
  },
  kpiCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '20px 20px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    boxShadow: 'var(--shadow-sm)',
  },
  kpiIcon: {
    fontSize: 22,
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    flexShrink: 0,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 800,
    color: 'var(--color-text-primary)',
    letterSpacing: '-1px',
    lineHeight: 1.1,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    marginTop: 2,
  },

  /* Two-column layout */
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 20,
    flex: 1,
  },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 24,
    boxShadow: 'var(--shadow-sm)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    marginBottom: 20,
  },

  /* Empty state */
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 0',
    textAlign: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
  },
  emptySub: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.6,
    maxWidth: 280,
  },
  emptyBtn: {
    marginTop: 12,
    padding: '10px 20px',
    background: 'var(--color-primary-light)',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-primary)',
    cursor: 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'inherit',
    opacity: 0.7,
  },
  soonTag: {
    fontSize: 10,
    fontWeight: 700,
    background: 'var(--color-primary)',
    color: '#fff',
    padding: '2px 7px',
    borderRadius: 'var(--radius-full)',
  },

  /* Activity */
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  activityItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    flexShrink: 0,
  },
  activityBody: { flex: 1 },
  activityText: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  activityTime: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    marginTop: 2,
  },
};

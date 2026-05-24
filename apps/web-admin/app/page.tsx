'use client';

import Link from 'next/link';

const FEATURES = [
  {
    icon: '⚡',
    title: 'Preencha turnos em minutos',
    body: 'Acesso instantâneo a um pool de trabalhadores verificados. Publique um turno e receba candidatos em segundos.',
  },
  {
    icon: '📋',
    title: 'Conformidade MCD automática',
    body: 'Contratos Muito Curta Duração gerados e submetidos à Segurança Social automaticamente, dentro das 24h exigidas.',
  },
  {
    icon: '💳',
    title: 'Pagamento por turno concluído',
    body: 'Só paga quando o turno é confirmado via QR Code. Trabalhador recebe no dia seguinte. Sem pré-financiamento.',
  },
  {
    icon: '⭐',
    title: 'Matching por reputação',
    body: 'O nosso motor de matching prioritiza trabalhadores com melhor pontuação — não os mais próximos.',
  },
  {
    icon: '📊',
    title: 'Dashboard de conformidade',
    body: 'TSU calculado por turno. Alertas de limite MCD. Exportação de relatórios ACT em PDF ou CSV.',
  },
  {
    icon: '🔒',
    title: 'Check-in via QR verificado',
    body: 'QR dinâmico (30s TTL) + geofence de 200m. Horas bloqueadas automaticamente na folha de pagamento.',
  },
];

const STATS = [
  { value: 'T+1', label: 'Pagamento ao trabalhador' },
  { value: '24h', label: 'Notificação SS Direta' },
  { value: '0%', label: 'Pré-financiamento exigido' },
  { value: '10s', label: 'Para publicar um turno' },
];

const ROADMAP = [
  { n: 0, label: 'Foundation & Setup',       done: true },
  { n: 1, label: 'Auth & Identity',           next: true },
  { n: 2, label: 'Shift Marketplace',         done: false },
  { n: 3, label: 'Matching Engine',           done: false },
  { n: 4, label: 'Compliance Engine',         done: false },
  { n: 5, label: 'QR Check-In/Out',           done: false },
];

export default function LandingPage() {
  return (
    <main style={s.page}>

      {/* ── Nav ── */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <span style={s.logo}>turnos</span>
          <div style={s.navActions}>
            <Link href="/login" style={s.navLink}>Entrar</Link>
            <Link href="/register" style={s.navCta}>Começar grátis →</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={s.hero}>
        <div style={s.heroBg} aria-hidden />
        <div style={s.heroContent}>
          <div style={s.stintBadge}>
            <span style={s.stintDot} />
            Lisbon Beta · Stint 0 completo
          </div>
          <h1 style={s.heroTitle}>
            Work Today.<br />
            <span style={s.heroAccent}>Staff Today.</span>
          </h1>
          <p style={s.heroSub}>
            O mercado de turnos para Portugal. Empregadores encontram
            trabalhadores verificados em minutos — com conformidade MCD
            automática e pagamento no dia seguinte.
          </p>
          <div style={s.heroCtas}>
            <Link href="/register" style={s.primaryBtn}>
              Publicar Turno →
            </Link>
            <Link href="/login" style={s.ghostBtn}>
              Já tenho conta
            </Link>
          </div>
        </div>

        {/* Floating card */}
        <div style={s.heroCard} className="animate-float">
          <div style={s.cardRow}>
            <div style={s.cardAvatar}>🧑‍🍳</div>
            <div>
              <div style={s.cardName}>Carlos M.</div>
              <div style={s.cardSub}>Cozinheiro · ⭐ 4.9</div>
            </div>
            <div style={s.cardBadge}>Disponível</div>
          </div>
          <div style={s.cardDivider} />
          <div style={s.cardRow}>
            <div style={s.cardAvatar}>🏢</div>
            <div>
              <div style={s.cardName}>Restaurante A Taberna</div>
              <div style={s.cardSub}>Publicou: Cozinheiro · Hoje 18h–02h</div>
            </div>
          </div>
          <div style={s.cardMatch}>
            Match confirmado ✓ · <strong>Recebe amanhã</strong>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section style={s.stats}>
        {STATS.map(({ value, label }) => (
          <div key={label} style={s.statItem}>
            <div style={s.statValue}>{value}</div>
            <div style={s.statLabel}>{label}</div>
          </div>
        ))}
      </section>

      {/* ── Features ── */}
      <section style={s.features}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>Tudo o que precisa, nada do que não precisa</h2>
          <p style={s.sectionSub}>Construído para a realidade do mercado de trabalho português.</p>
        </div>
        <div style={s.featureGrid}>
          {FEATURES.map(({ icon, title, body }) => (
            <div key={title} style={s.featureCard}>
              <div style={s.featureIcon}>{icon}</div>
              <h3 style={s.featureTitle}>{title}</h3>
              <p style={s.featureBody}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Roadmap ── */}
      <section style={s.roadmapSection}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>Roadmap de desenvolvimento</h2>
          <p style={s.sectionSub}>Transparência total. Veja o que está feito e o que vem a seguir.</p>
        </div>
        <div style={s.roadmapGrid}>
          {ROADMAP.map(({ n, label, done, next }) => (
            <div
              key={n}
              style={{
                ...s.roadmapItem,
                borderColor: done ? 'var(--color-primary)' : next ? 'var(--color-primary)' : 'var(--color-border)',
                background: done
                  ? 'linear-gradient(135deg, var(--color-primary-light), #fff)'
                  : next
                  ? 'linear-gradient(135deg, #f0f1ff, #fff)'
                  : 'var(--color-surface)',
              }}
            >
              <div
                style={{
                  ...s.roadmapNum,
                  background: done || next ? 'var(--color-primary)' : 'var(--color-neutral-light)',
                  color: done || next ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {done ? '✓' : n}
              </div>
              <div>
                <div style={s.roadmapLabel}>{label}</div>
                <div style={{
                  ...s.roadmapStatus,
                  color: done ? 'var(--color-success)' : next ? 'var(--color-primary)' : 'var(--color-text-muted)',
                }}>
                  {done ? '✅ Completo' : next ? '🔜 A seguir' : 'Planeado'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={s.ctaBanner}>
        <div style={s.ctaInner}>
          <h2 style={s.ctaTitle}>Pronto para preencher o seu próximo turno?</h2>
          <p style={s.ctaSub}>Junte-se à beta fechada de Lisboa. Sem custos de setup.</p>
          <Link href="/register" style={s.ctaBtn}>
            Criar conta gratuita →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <span style={s.footerLogo}>turnos</span>
        <span style={s.footerText}>© 2026 Turnos · Lisboa Beta · Built with ❤️ in Portugal</span>
        <div style={s.footerLinks}>
          <a href="#" style={s.footerLink}>Privacidade</a>
          <a href="#" style={s.footerLink}>Termos</a>
          <Link href="/login" style={s.footerLink}>Entrar</Link>
        </div>
      </footer>

    </main>
  );
}

/* ─────────────────────────── Styles ─────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: 'var(--color-bg)',
    display: 'flex',
    flexDirection: 'column',
  },

  /* Nav */
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(250, 253, 255, 0.85)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--color-border)',
  },
  navInner: {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '0 32px',
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--color-primary)',
    letterSpacing: '-1px',
  },
  navActions: { display: 'flex', alignItems: 'center', gap: 12 },
  navLink: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    padding: '8px 16px',
    borderRadius: 'var(--radius-full)',
    transition: 'color var(--transition-fast)',
  },
  navCta: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    textDecoration: 'none',
    padding: '8px 20px',
    borderRadius: 'var(--radius-full)',
    background: 'var(--color-primary)',
    boxShadow: '0 2px 12px var(--color-primary-glow)',
    transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
  },

  /* Hero */
  hero: {
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 48,
    maxWidth: 1120,
    margin: '0 auto',
    padding: '96px 32px 80px',
    width: '100%',
  },
  heroBg: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse 60% 60% at 70% 40%, rgba(106,121,255,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    maxWidth: 560,
  },
  stintBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-primary)',
    background: 'var(--color-primary-light)',
    padding: '6px 14px',
    borderRadius: 'var(--radius-full)',
    marginBottom: 24,
    border: '1px solid rgba(106,121,255,0.2)',
  },
  stintDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--color-success)',
    boxShadow: '0 0 6px rgba(34,197,94,0.6)',
  },
  heroTitle: {
    fontSize: 'clamp(44px, 6vw, 72px)',
    fontWeight: 800,
    lineHeight: 1.05,
    letterSpacing: '-2.5px',
    color: 'var(--color-text-primary)',
    marginBottom: 20,
  },
  heroAccent: {
    background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSub: {
    fontSize: 18,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.7,
    marginBottom: 36,
    maxWidth: 480,
  },
  heroCtas: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    textDecoration: 'none',
    padding: '14px 28px',
    borderRadius: 'var(--radius-full)',
    background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    boxShadow: '0 4px 24px var(--color-primary-glow)',
    transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
  },
  ghostBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--color-primary)',
    textDecoration: 'none',
    padding: '14px 28px',
    borderRadius: 'var(--radius-full)',
    border: '1.5px solid var(--color-primary)',
    background: 'transparent',
    transition: 'background var(--transition-fast)',
  },

  /* Hero card */
  heroCard: {
    position: 'relative',
    zIndex: 1,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 24,
    boxShadow: 'var(--shadow-xl)',
    border: '1px solid var(--color-border)',
    minWidth: 300,
    maxWidth: 340,
    flexShrink: 0,
  },
  cardRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
  cardAvatar: {
    fontSize: 32,
    width: 48,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-primary-light)',
    borderRadius: 'var(--radius-md)',
    flexShrink: 0,
  },
  cardName: { fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' },
  cardSub: { fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 },
  cardBadge: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--color-success)',
    background: 'var(--color-success-light)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    flexShrink: 0,
  },
  cardDivider: { height: 1, background: 'var(--color-border)', margin: '12px 0' },
  cardMatch: {
    marginTop: 12,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    background: 'var(--color-primary-light)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    textAlign: 'center',
  },

  /* Stats */
  stats: {
    display: 'flex',
    justifyContent: 'center',
    gap: 0,
    borderTop: '1px solid var(--color-border)',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    padding: '32px 0',
    flexWrap: 'wrap',
  },
  statItem: {
    flex: '1 1 160px',
    textAlign: 'center',
    padding: '16px 32px',
    borderRight: '1px solid var(--color-border)',
  },
  statValue: {
    fontSize: 36,
    fontWeight: 800,
    color: 'var(--color-primary)',
    letterSpacing: '-1.5px',
    lineHeight: 1,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },

  /* Features */
  features: {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '80px 32px',
    width: '100%',
  },
  sectionHeader: { textAlign: 'center', marginBottom: 56 },
  sectionTitle: {
    fontSize: 'clamp(28px, 4vw, 40px)',
    fontWeight: 800,
    color: 'var(--color-text-primary)',
    letterSpacing: '-1.5px',
    marginBottom: 12,
  },
  sectionSub: {
    fontSize: 16,
    color: 'var(--color-text-secondary)',
    maxWidth: 480,
    margin: '0 auto',
    lineHeight: 1.6,
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 20,
  },
  featureCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 28,
    transition: 'transform var(--transition-base), box-shadow var(--transition-base)',
    cursor: 'default',
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 16,
    display: 'block',
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    marginBottom: 8,
    lineHeight: 1.3,
  },
  featureBody: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.65,
  },

  /* Roadmap */
  roadmapSection: {
    background: 'linear-gradient(135deg, var(--color-primary-light) 0%, #fff 100%)',
    padding: '80px 32px',
  },
  roadmapGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
    maxWidth: 1120,
    margin: '0 auto',
  },
  roadmapItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '20px 20px',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid',
    transition: 'transform var(--transition-base)',
  },
  roadmapNum: {
    width: 40,
    height: 40,
    borderRadius: 'var(--radius-full)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 800,
    flexShrink: 0,
  },
  roadmapLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    marginBottom: 4,
  },
  roadmapStatus: {
    fontSize: 12,
    fontWeight: 600,
  },

  /* CTA Banner */
  ctaBanner: {
    background: 'linear-gradient(135deg, var(--color-primary) 0%, #9b6dff 100%)',
    padding: '80px 32px',
  },
  ctaInner: {
    maxWidth: 640,
    margin: '0 auto',
    textAlign: 'center',
  },
  ctaTitle: {
    fontSize: 'clamp(28px, 4vw, 40px)',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-1.5px',
    marginBottom: 12,
  },
  ctaSub: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 32,
  },
  ctaBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--color-primary)',
    textDecoration: 'none',
    padding: '16px 36px',
    borderRadius: 'var(--radius-full)',
    background: '#fff',
    boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
    transition: 'transform var(--transition-fast)',
  },

  /* Footer */
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    padding: '28px 32px',
    borderTop: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
  },
  footerLogo: {
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--color-primary)',
    letterSpacing: '-0.5px',
  },
  footerText: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
  },
  footerLinks: { display: 'flex', gap: 16 },
  footerLink: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    transition: 'color var(--transition-fast)',
  },
};

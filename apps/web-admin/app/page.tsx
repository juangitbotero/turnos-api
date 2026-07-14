'use client';

import Link from 'next/link';

// ── Content ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '3€',   label: 'Taxa fixa por turno concluído' },
  { value: '<10s', label: 'Para publicar um turno' },
  { value: '0%',   label: 'Comissões sobre salários' },
  { value: '100%', label: 'Dados prontos para a contabilidade' },
];

const HOW_IT_WORKS = [
  { n: '01', icon: '📋', title: 'Publicas o turno',       desc: 'Define função, horário, morada e valor/hora. O custo TSU é calculado automaticamente.' },
  { n: '02', icon: '🔔', title: 'Workers candidatam-se',  desc: 'Notificação push automática aos 20 workers mais compatíveis por competência. Candidaturas chegam em minutos.' },
  { n: '03', icon: '👤', title: 'Selecionas o worker',    desc: 'Revês perfis, ratings e competências. Selecionar um worker envia-lhe um convite direto com 2h para aceitar.' },
  { n: '04', icon: '✅', title: 'Worker confirma',        desc: 'O worker aceita ou recusa. Se não responder em 2h, o turno reabre automaticamente — sem no-shows silenciosos.' },
  { n: '05', icon: '📲', title: 'QR Check-in',            desc: 'O worker escaneia o teu QR fixo à chegada (geofence de 200m). O turno conclui automaticamente à hora de fim — sem passos extra.' },
  { n: '06', icon: '💳', title: 'Pagas diretamente ao worker', desc: 'No fim do turno pagas ao worker pelo método que escolheste — transferência, MB WAY ou numerário. A Turnos dá-te todos os valores prontos, incluindo TSU informativo.' },
];

const FEATURES = [
  { icon: '🔔', title: 'Notificações inteligentes',   body: 'Push notification automático aos 20 workers mais compatíveis em segundos após publicação. Segunda vaga ao fim de 5h se sem candidatos.' },
  { icon: '⭐', title: 'Ratings & Reputação',          body: 'Avalia workers após cada turno. Badges TOP_RATED e FIÁVEL para os melhores. Motor de matching prioriza os mais bem avaliados.' },
  { icon: '⚡', title: 'Confirmação obrigatória',      body: 'Worker selecionado tem 2h para aceitar. Sem confirmação, o turno volta ao estado aberto automaticamente — fim dos no-shows.' },
  { icon: '📲', title: 'QR Check-in verificado',       body: 'QR fixo por empresa + geofence de 200m. Worker escaneia à chegada; o turno conclui sozinho à hora de fim. Podes ajustar horas antes de pagar.' },
  { icon: '📋', title: 'Conformidade MCD automática',  body: 'Contratos MCD gerados e enviados à SS. Cálculo de TSU 23,75% + 11%. Alertas de limite de 70 dias/ano e descanso de 11h.' },
  { icon: '💳', title: 'Pagamento direto, sem comissões', body: 'Pagas o salário diretamente ao worker — a Turnos nunca toca no dinheiro. Só uma taxa fixa de 3€ por turno concluído, faturada uma vez por mês.' },
  { icon: '🔍', title: 'Pesquisa de talent',           body: 'Procura workers por competência, idioma e disponibilidade. Convida diretamente para um turno — ele tem 2h para aceitar.' },
  { icon: '👥', title: 'Candidatos comparáveis',       body: 'Filtra candidatos por rating, perfil completo ou data de candidatura. Vê match de competências em destaque. Nota de apresentação do worker.' },
  { icon: '📊', title: 'Dashboard de conformidade',    body: 'TSU calculado por turno. Log de auditoria ACT imutável. Relatórios exportáveis em CSV. Dependência económica monitorizada.' },
  { icon: '💶', title: 'Controlo de gastos',           body: 'Dashboard de gastos por período. Custo total por turno incluindo TSU. Subscrição mensal com faturação automática.' },
];

const PLATFORM_TRUST = [
  { icon: '🇵🇹', text: 'Construído para o mercado português — MCD, TSU, SS Direta' },
  { icon: '🔒', text: 'Dados seguros · RGPD · Contratos legais automáticos' },
  { icon: '⚡', text: 'Relatórios TSU e contabilidade prontos a exportar' },
  { icon: '📱', text: 'App nativa iOS & Android para os trabalhadores' },
];

const ROADMAP = [
  { n: 0, label: 'Foundation & Setup',          done: true },
  { n: 1, label: 'Auth & Identidade',           done: true },
  { n: 2, label: 'Marketplace de Turnos',       done: true },
  { n: 3, label: 'Notificações & Real-Time',    done: true },
  { n: 4, label: 'Conformidade Portugal',       done: true },
  { n: 5, label: 'QR Check-In automático',      done: true },
  { n: 6, label: 'Pagamentos & Payroll',        done: true },
  { n: 7, label: 'Ratings & Reputação',         done: true },
  { n: 8, label: 'Produto & Operações',         active: true },
  { n: 9, label: 'Crescimento & Flywheel',      done: false },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main style={s.page}>

      {/* ── Nav ── */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          {/* Logo wordmark */}
          <div style={s.logoWrap}>
            <span style={s.logoText}>turnos</span>
            <span style={s.logoDot} />
          </div>
          <div style={s.navActions}>
            <Link href="/login"    style={s.navLink}>Entrar</Link>
            <Link href="/register" style={s.navCta}>Criar conta →</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={s.hero}>
        <div style={s.heroBg} aria-hidden />
        <div style={s.heroContent}>
          <div style={s.liveBadge}>
            <span style={s.liveDot} />
            Lisboa Beta · Plataforma operacional
          </div>
          <h1 style={s.heroTitle}>
            Work Today.<br />
            <span style={s.heroAccent}>Staff Today.</span>
          </h1>
          <p style={s.heroSub}>
            O mercado de turnos para Portugal. Encontra trabalhadores verificados em minutos
            — com conformidade MCD automática, QR check-in e todos os dados prontos para pagares diretamente ao worker.
          </p>
          <div style={s.heroCtas}>
            <Link href="/register" style={s.primaryBtn}>Publicar Turno →</Link>
            <Link href="/login"    style={s.ghostBtn}>Já tenho conta</Link>
          </div>
        </div>

        {/* Floating match card */}
        <div style={s.heroCard}>
          <div style={s.cardRow}>
            <div style={s.cardAvatar}>🧑‍🍳</div>
            <div style={{ flex: 1 }}>
              <div style={s.cardName}>Carlos M.</div>
              <div style={s.cardSub}>Cozinheiro · ⭐ 4.9 · Verificado</div>
            </div>
            <div style={s.cardBadge}>Disponível</div>
          </div>
          <div style={s.cardDivider} />
          <div style={s.cardRow}>
            <div style={{ ...s.cardAvatar, fontSize: 22 }}>🏢</div>
            <div>
              <div style={s.cardName}>Restaurante A Taberna</div>
              <div style={s.cardSub}>Cozinheiro · Hoje 18h–02h · €10/hr</div>
            </div>
          </div>
          <div style={s.cardMatch}>✓ Match confirmado · <strong>Recebe o bruto por inteiro</strong></div>

          <div style={s.cardSteps}>
            <div style={s.cardStep}><span style={s.stepDot} />Turno publicado</div>
            <div style={s.cardStep}><span style={s.stepDot} />Candidatura recebida</div>
            <div style={s.cardStep}><span style={{ ...s.stepDot, background: '#16a34a' }} />Worker confirmado ✓</div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section style={s.statsBar}>
        {STATS.map(({ value, label }) => (
          <div key={label} style={s.statItem}>
            <div style={s.statValue}>{value}</div>
            <div style={s.statLabel}>{label}</div>
          </div>
        ))}
      </section>

      {/* ── How it works ── */}
      <section style={s.section}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>Como funciona</h2>
          <p style={s.sectionSub}>De turno publicado a pagamento processado — tudo automático.</p>
        </div>
        <div style={s.stepsGrid}>
          {HOW_IT_WORKS.map(({ n, icon, title, desc }) => (
            <div key={n} style={s.stepCard}>
              <div style={s.stepTop}>
                <span style={s.stepNum}>{n}</span>
                <span style={s.stepIcon}>{icon}</span>
              </div>
              <h3 style={s.stepTitle}>{title}</h3>
              <p style={s.stepDesc}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── O que a plataforma faz por ti ── */}
      <section style={{ ...s.section, background: 'var(--color-surface)', padding: '80px 32px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={s.sectionHeader}>
            <h2 style={s.sectionTitle}>O que a plataforma faz por ti</h2>
            <p style={s.sectionSub}>
              Construído para a realidade do mercado de trabalho português.
              Tudo o que precisas, nada do que não precisas.
            </p>
          </div>
          <div style={s.featureGrid}>
            {FEATURES.map(({ icon, title, body }) => (
              <div key={title} style={s.featureCard}>
                <span style={s.featureIcon}>{icon}</span>
                <h3 style={s.featureTitle}>{title}</h3>
                <p style={s.featureBody}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section style={s.trustBar}>
        {PLATFORM_TRUST.map(({ icon, text }) => (
          <div key={text} style={s.trustItem}>
            <span style={s.trustIcon}>{icon}</span>
            <span style={s.trustText}>{text}</span>
          </div>
        ))}
      </section>

      {/* ── Roadmap ── */}
      <section style={s.roadmapSection}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>Roadmap de desenvolvimento</h2>
          <p style={s.sectionSub}>Transparência total — stints 0–7 completos. Stint 8 em progresso.</p>
        </div>
        <div style={s.roadmapGrid}>
          {ROADMAP.map(({ n, label, done, active }) => (
            <div key={n} style={{
              ...s.roadmapItem,
              borderWidth: '1.5px', borderStyle: 'solid',
              borderColor: done ? 'var(--color-primary)' : active ? '#d97706' : 'var(--color-border)',
              background: done
                ? 'linear-gradient(135deg, var(--color-primary-light), #fff)'
                : active
                  ? 'linear-gradient(135deg, #fffbeb, #fff)'
                  : 'var(--color-surface)',
            }}>
              <div style={{
                ...s.roadmapNum,
                background: done ? 'var(--color-primary)' : active ? '#d97706' : 'var(--color-neutral-light)',
                color: done || active ? '#fff' : 'var(--color-text-secondary)',
              }}>
                {done ? '✓' : n}
              </div>
              <div>
                <div style={s.roadmapLabel}>{label}</div>
                <div style={{
                  ...s.roadmapStatus,
                  color: done ? 'var(--color-success)' : active ? '#d97706' : 'var(--color-text-muted)',
                }}>
                  {done ? '✅ Completo' : active ? '🔄 Em progresso' : 'Planeado'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={s.ctaBanner}>
        <div style={s.ctaInner}>
          <h2 style={s.ctaTitle}>Pronto para preencher o teu próximo turno?</h2>
          <p style={s.ctaSub}>Junte-se à beta de Lisboa. Sem custos de setup. Primeiro turno grátis.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" style={s.ctaBtn}>Criar conta →</Link>
            <Link href="/login"    style={s.ctaBtnGhost}>Já tenho conta</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <div style={s.footerLogoWrap}>
          <span style={s.footerLogoText}>turnos</span>
          <span style={s.footerLogoDot} />
        </div>
        <span style={s.footerTagline}>Work Today. Staff Today. · Lisboa Beta 2026</span>
        <div style={s.footerLinks}>
          <a href="#" style={s.footerLink}>Privacidade</a>
          <a href="#" style={s.footerLink}>Termos</a>
          <Link href="/login"    style={s.footerLink}>Entrar</Link>
          <Link href="/register" style={s.footerLink}>Registar</Link>
        </div>
      </footer>

    </main>
  );
}

/* ─────────────────────────── Styles ─────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: 'var(--color-bg)', display: 'flex', flexDirection: 'column' },

  /* Nav */
  nav: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'rgba(250,253,255,0.9)', backdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--color-border)',
  },
  navInner: {
    maxWidth: 1120, margin: '0 auto', padding: '0 32px', height: 64,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  logoWrap: { display: 'flex', alignItems: 'center', gap: 4 },
  logoText: { fontSize: 22, fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-1px' },
  logoDot: { width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', opacity: 0.75, marginBottom: 3 },
  navActions: { display: 'flex', alignItems: 'center', gap: 12 },
  navLink: {
    fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)',
    textDecoration: 'none', padding: '8px 16px', borderRadius: 'var(--radius-full)',
  },
  navCta: {
    fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none',
    padding: '8px 20px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary)',
    boxShadow: '0 2px 12px var(--color-primary-glow)',
  },

  /* Hero */
  hero: {
    position: 'relative', overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 48, maxWidth: 1120, margin: '0 auto', padding: '96px 32px 80px', width: '100%',
  },
  heroBg: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 60% 60% at 70% 40%, rgba(106,121,255,0.12) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  heroContent: { position: 'relative', zIndex: 1, flex: 1, maxWidth: 560 },
  liveBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    fontSize: 12, fontWeight: 600, color: 'var(--color-primary)',
    background: 'var(--color-primary-light)', padding: '6px 14px',
    borderRadius: 'var(--radius-full)', marginBottom: 24,
    borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(106,121,255,0.2)',
  },
  liveDot: { width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.7)' },
  heroTitle: {
    fontSize: 'clamp(44px, 6vw, 72px)', fontWeight: 800,
    lineHeight: 1.05, letterSpacing: '-2.5px',
    color: 'var(--color-text-primary)', marginBottom: 20,
  },
  heroAccent: {
    background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  heroSub: { fontSize: 18, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 36, maxWidth: 480 },
  heroCtas: { display: 'flex', gap: 12, flexWrap: 'wrap' as const },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', fontSize: 15, fontWeight: 700,
    color: '#fff', textDecoration: 'none', padding: '14px 28px',
    borderRadius: 'var(--radius-full)',
    background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    boxShadow: '0 4px 24px var(--color-primary-glow)',
  },
  ghostBtn: {
    display: 'inline-flex', alignItems: 'center', fontSize: 15, fontWeight: 600,
    color: 'var(--color-primary)', textDecoration: 'none', padding: '14px 28px',
    borderRadius: 'var(--radius-full)',
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--color-primary)',
    background: 'transparent',
  },

  /* Hero card */
  heroCard: {
    position: 'relative', zIndex: 1,
    background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)',
    padding: 24, boxShadow: 'var(--shadow-xl)',
    borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    minWidth: 300, maxWidth: 340, flexShrink: 0,
  },
  cardRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
  cardAvatar: {
    fontSize: 28, width: 44, height: 44, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', flexShrink: 0,
  },
  cardName: { fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' },
  cardSub:  { fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 },
  cardBadge: {
    marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#16a34a',
    background: '#dcfce7', padding: '4px 10px', borderRadius: 'var(--radius-full)', flexShrink: 0,
  },
  cardDivider: { height: 1, background: 'var(--color-border)', margin: '12px 0' },
  cardMatch: {
    marginTop: 12, fontSize: 12, color: 'var(--color-text-secondary)',
    background: 'var(--color-primary-light)', borderRadius: 'var(--radius-sm)',
    padding: '8px 12px', textAlign: 'center' as const,
  },
  cardSteps: { display: 'flex', flexDirection: 'column' as const, gap: 6, marginTop: 14 },
  cardStep: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-secondary)' },
  stepDot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 },

  /* Stats */
  statsBar: {
    display: 'flex', justifyContent: 'center', gap: 0,
    borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface)', padding: '32px 0', flexWrap: 'wrap' as const,
  },
  statItem: { flex: '1 1 160px', textAlign: 'center' as const, padding: '16px 32px', borderRight: '1px solid var(--color-border)' },
  statValue: { fontSize: 36, fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-1.5px', lineHeight: 1, marginBottom: 6 },
  statLabel: { fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 },

  /* Sections */
  section: { maxWidth: 1120, margin: '0 auto', padding: '80px 32px', width: '100%' },
  sectionHeader: { textAlign: 'center' as const, marginBottom: 56 },
  sectionTitle: {
    fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, color: 'var(--color-text-primary)',
    letterSpacing: '-1.5px', marginBottom: 12,
  },
  sectionSub: { fontSize: 16, color: 'var(--color-text-secondary)', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 },

  /* How it works */
  stepsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 },
  stepCard: {
    background: 'var(--color-surface)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    borderRadius: 'var(--radius-lg)', padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 10,
    boxShadow: 'var(--shadow-sm)',
  },
  stepTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  stepNum: {
    fontSize: 11, fontWeight: 800, color: 'var(--color-primary)',
    background: 'var(--color-primary-light)', padding: '4px 10px', borderRadius: 'var(--radius-full)',
    letterSpacing: '0.5px',
  },
  stepIcon: { fontSize: 26 },
  stepTitle: { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.3 },
  stepDesc:  { fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 },

  /* Features */
  featureGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 },
  featureCard: {
    background: 'var(--color-bg)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: 'var(--shadow-sm)',
    display: 'flex', flexDirection: 'column' as const, gap: 8,
  },
  featureIcon:  { fontSize: 28, display: 'block' },
  featureTitle: { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.3 },
  featureBody:  { fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.65 },

  /* Trust bar */
  trustBar: {
    display: 'flex', justifyContent: 'center', flexWrap: 'wrap' as const, gap: 0,
    borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-primary-light)', padding: '20px 32px',
  },
  trustItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 24px', borderRight: '1px solid rgba(106,121,255,0.15)',
    flex: '1 1 240px',
  },
  trustIcon: { fontSize: 18, flexShrink: 0 },
  trustText: { fontSize: 13, fontWeight: 500, color: 'var(--color-primary)' },

  /* Roadmap */
  roadmapSection: {
    background: 'linear-gradient(135deg, var(--color-primary-light) 0%, #fff 100%)',
    padding: '80px 32px',
  },
  roadmapGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12,
    maxWidth: 1120, margin: '0 auto',
  },
  roadmapItem: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '16px 18px', borderRadius: 'var(--radius-md)',
  },
  roadmapNum: {
    width: 38, height: 38, borderRadius: 'var(--radius-full)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 800, flexShrink: 0,
  },
  roadmapLabel:  { fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 3 },
  roadmapStatus: { fontSize: 11, fontWeight: 600 },

  /* CTA Banner */
  ctaBanner: {
    background: 'linear-gradient(135deg, var(--color-primary) 0%, #9b6dff 100%)', padding: '80px 32px',
  },
  ctaInner: { maxWidth: 640, margin: '0 auto', textAlign: 'center' as const },
  ctaTitle: {
    fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, color: '#fff',
    letterSpacing: '-1.5px', marginBottom: 12,
  },
  ctaSub: { fontSize: 16, color: 'rgba(255,255,255,0.82)', marginBottom: 32 },
  ctaBtn: {
    display: 'inline-flex', alignItems: 'center', fontSize: 15, fontWeight: 700,
    color: 'var(--color-primary)', textDecoration: 'none', padding: '16px 36px',
    borderRadius: 'var(--radius-full)', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
  },
  ctaBtnGhost: {
    display: 'inline-flex', alignItems: 'center', fontSize: 15, fontWeight: 600,
    color: '#fff', textDecoration: 'none', padding: '16px 28px',
    borderRadius: 'var(--radius-full)',
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.6)',
  },

  /* Footer */
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap' as const, gap: 16, padding: '28px 32px',
    borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)',
  },
  footerLogoWrap: { display: 'flex', alignItems: 'center', gap: 3 },
  footerLogoText: { fontSize: 18, fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-0.5px' },
  footerLogoDot:  { width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary)', opacity: 0.7, marginBottom: 2 },
  footerTagline:  { fontSize: 13, color: 'var(--color-text-muted)' },
  footerLinks:    { display: 'flex', gap: 16 },
  footerLink:     { fontSize: 13, color: 'var(--color-text-secondary)', textDecoration: 'none' },
};

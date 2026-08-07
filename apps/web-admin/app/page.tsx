'use client';

import Link from 'next/link';
import { useT } from '../lib/i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Logo } from '../components/Logo';

// ── Content ────────────────────────────────────────────────────────────────────
//
// These arrays hold only ids and presentation (icons, numbering, state) — the
// copy lives in `home.*` in the shared catalogue. They sit at module scope, so
// they cannot call useT(); the ids are resolved at render instead.

const STATS = ['fee', 'speed', 'commission', 'data'] as const;

const HOW_IT_WORKS = [
  { n: '01', icon: '📋', id: 'publish' },
  { n: '02', icon: '🔔', id: 'apply'   },
  { n: '03', icon: '👤', id: 'select'  },
  { n: '04', icon: '✅', id: 'confirm' },
  { n: '05', icon: '📲', id: 'checkIn' },
  { n: '06', icon: '💳', id: 'pay'     },
] as const;

const FEATURES = [
  { icon: '🔔', id: 'notifications' },
  { icon: '⭐', id: 'ratings'       },
  { icon: '⚡', id: 'confirmation'  },
  { icon: '📲', id: 'qrCheckIn'     },
  { icon: '📋', id: 'compliance'    },
  { icon: '💳', id: 'directPay'     },
  { icon: '🔍', id: 'search'        },
  { icon: '👥', id: 'applicants'    },
  { icon: '📊', id: 'dashboard'     },
  { icon: '💶', id: 'spending'      },
] as const;

const PLATFORM_TRUST = [
  { icon: '🇵🇹', id: 'market'   },
  { icon: '🔒', id: 'security' },
  { icon: '⚡', id: 'reports'  },
  { icon: '📱', id: 'app'      },
] as const;

// Explicitly typed rather than `as const`: the entries have different shapes
// (done vs active), and a const-assertion would narrow each one so that neither
// property exists on the union.
const ROADMAP: { n: number; done?: boolean; active?: boolean }[] = [
  { n: 0, done: true },
  { n: 1, done: true },
  { n: 2, done: true },
  { n: 3, done: true },
  { n: 4, done: true },
  { n: 5, done: true },
  { n: 6, done: true },
  { n: 7, done: true },
  { n: 8, active: true },
  { n: 9, done: false },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { t } = useT();
  const demoRole = t('home.heroCard.role');

  return (
    <main style={s.page}>

      {/* ── Nav ── */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <Logo height={26} />
          <div style={s.navActions}>
            <LanguageSwitcher />
            <Link href="/login"    style={s.navLink}>{t('home.nav.login')}</Link>
            <Link href="/register" style={s.navCta}>{t('home.nav.register')}</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={s.hero}>
        <div style={s.heroBg} aria-hidden />
        <div style={s.heroContent}>
          <div style={s.liveBadge}>
            <span style={s.liveDot} />
            {t('home.hero.badge')}
          </div>
          <h1 style={s.heroTitle}>
            {t('home.hero.titleLine1')}<br />
            <span style={s.heroAccent}>{t('home.hero.titleAccent')}</span>
          </h1>
          <p style={s.heroSub}>{t('home.hero.sub')}</p>
          <div style={s.heroCtas}>
            <Link href="/register" style={s.primaryBtn}>{t('home.hero.ctaPrimary')}</Link>
            <Link href="/login"    style={s.ghostBtn}>{t('home.hero.ctaGhost')}</Link>
          </div>
        </div>

        {/* Floating match card */}
        <div style={s.heroCard}>
          <div style={s.cardRow}>
            <div style={s.cardAvatar}>🧑‍🍳</div>
            <div style={{ flex: 1 }}>
              <div style={s.cardName}>{t('home.heroCard.workerName')}</div>
              <div style={s.cardSub}>{t('home.heroCard.workerMeta', { role: demoRole })}</div>
            </div>
            <div style={s.cardBadge}>{t('home.heroCard.available')}</div>
          </div>
          <div style={s.cardDivider} />
          <div style={s.cardRow}>
            <div style={{ ...s.cardAvatar, fontSize: 22 }}>🏢</div>
            <div>
              <div style={s.cardName}>{t('home.heroCard.companyName')}</div>
              <div style={s.cardSub}>{t('home.heroCard.companyMeta', { role: demoRole })}</div>
            </div>
          </div>
          <div style={s.cardMatch}>
            {t('home.heroCard.match')}<strong>{t('home.heroCard.matchBold')}</strong>
          </div>

          <div style={s.cardSteps}>
            <div style={s.cardStep}><span style={s.stepDot} />{t('home.heroCard.step1')}</div>
            <div style={s.cardStep}><span style={s.stepDot} />{t('home.heroCard.step2')}</div>
            <div style={s.cardStep}><span style={{ ...s.stepDot, background: '#16a34a' }} />{t('home.heroCard.step3')}</div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section style={s.statsBar}>
        {STATS.map(id => (
          <div key={id} style={s.statItem}>
            <div style={s.statValue}>{t(`home.stats.${id}Value`)}</div>
            <div style={s.statLabel}>{t(`home.stats.${id}`)}</div>
          </div>
        ))}
      </section>

      {/* ── How it works ── */}
      <section style={s.section}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>{t('home.howItWorks.title')}</h2>
          <p style={s.sectionSub}>{t('home.howItWorks.sub')}</p>
        </div>
        <div style={s.stepsGrid}>
          {HOW_IT_WORKS.map(({ n, icon, id }) => (
            <div key={id} style={s.stepCard}>
              <div style={s.stepTop}>
                <span style={s.stepNum}>{n}</span>
                <span style={s.stepIcon}>{icon}</span>
              </div>
              <h3 style={s.stepTitle}>{t(`home.howItWorks.${id}.title`)}</h3>
              <p style={s.stepDesc}>{t(`home.howItWorks.${id}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── O que a plataforma faz por ti ── */}
      <section style={{ ...s.section, background: 'var(--color-surface)', padding: '80px 32px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={s.sectionHeader}>
            <h2 style={s.sectionTitle}>{t('home.features.title')}</h2>
            <p style={s.sectionSub}>{t('home.features.sub')}</p>
          </div>
          <div style={s.featureGrid}>
            {FEATURES.map(({ icon, id }) => (
              <div key={id} style={s.featureCard}>
                <span style={s.featureIcon}>{icon}</span>
                <h3 style={s.featureTitle}>{t(`home.features.${id}.title`)}</h3>
                <p style={s.featureBody}>{t(`home.features.${id}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section style={s.trustBar}>
        {PLATFORM_TRUST.map(({ icon, id }) => (
          <div key={id} style={s.trustItem}>
            <span style={s.trustIcon}>{icon}</span>
            <span style={s.trustText}>{t(`home.trust.${id}`)}</span>
          </div>
        ))}
      </section>

      {/* ── Roadmap ── */}
      <section style={s.roadmapSection}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>{t('home.roadmap.title')}</h2>
          <p style={s.sectionSub}>{t('home.roadmap.sub')}</p>
        </div>
        <div style={s.roadmapGrid}>
          {ROADMAP.map(({ n, done, active }) => (
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
                <div style={s.roadmapLabel}>{t(`home.roadmap.s${n}`)}</div>
                <div style={{
                  ...s.roadmapStatus,
                  color: done ? 'var(--color-success)' : active ? '#d97706' : 'var(--color-text-muted)',
                }}>
                  {done
                    ? t('home.roadmap.statusDone')
                    : active
                      ? t('home.roadmap.statusActive')
                      : t('home.roadmap.statusPlanned')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={s.ctaBanner}>
        <div style={s.ctaInner}>
          <h2 style={s.ctaTitle}>{t('home.cta.title')}</h2>
          <p style={s.ctaSub}>{t('home.cta.sub')}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" style={s.ctaBtn}>{t('home.cta.primary')}</Link>
            <Link href="/login"    style={s.ctaBtnGhost}>{t('home.cta.ghost')}</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <Logo height={20} />
        <span style={s.footerTagline}>{t('home.footer.tagline')}</span>
        <div style={s.footerLinks}>
          <a href="#" style={s.footerLink}>{t('home.footer.privacy')}</a>
          <a href="#" style={s.footerLink}>{t('home.footer.terms')}</a>
          <Link href="/login"    style={s.footerLink}>{t('home.footer.login')}</Link>
          <Link href="/register" style={s.footerLink}>{t('home.footer.register')}</Link>
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

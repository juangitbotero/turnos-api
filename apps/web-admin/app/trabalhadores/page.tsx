'use client';

/**
 * The worker-facing landing page.
 *
 * The site previously only spoke to companies, so a worker arriving from a
 * search or a shared link landed on pricing and compliance copy meant for an
 * employer. This is the other half: what the work is, what you get paid, and
 * how to start.
 *
 * The app store links do not exist yet, so the download CTAs are deliberately
 * inert and labelled as coming soon rather than pointing at a dead URL.
 */
import Link from 'next/link';
import { useT } from '../../lib/i18n';
import { Logo } from '../../components/Logo';
import { Faq } from '../../components/Faq';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { IconWallet, IconShield, IconStar, IconCalendar, IconPhone } from '../../components/icons';

const FAQ_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
const STEPS = ['1', '2', '3'] as const;
const WHY = [
  { k: '1', Icon: IconWallet },
  { k: '2', Icon: IconShield },
  { k: '3', Icon: IconStar },
  { k: '4', Icon: IconCalendar },
] as const;

/** Illustrative shift cards. Rates and roles come from the copy catalogue. */
const CARDS = [
  { k: '1', rate: '11', rating: '4.9' },
  { k: '2', rate: '10', rating: '4.8' },
  { k: '3', rate: '12', rating: '5.0' },
  { k: '4', rate: '10', rating: '4.7' },
] as const;

export default function WorkersPage() {
  const { t } = useT();

  return (
    <div style={s.page}>
      {/* ── Nav ── */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <Logo height={30} href="/" />
          <div style={s.navActions}>
            <LanguageSwitcher />
            <Link href="/" style={s.navLink}>{t('home.nav.forCompanies')}</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={s.hero}>
        <div style={s.heroLeft}>
          <span style={s.eyebrow}>{t('home.workers.heroEyebrow')}</span>
          <h1 style={s.heroTitle}>
            {t('home.workers.heroTitle1')}<br />
            <span style={s.heroAccent}>{t('home.workers.heroTitle2')}</span>
          </h1>
          <p style={s.heroBody}>{t('home.workers.heroBody')}</p>
          <div style={s.ctaRow}>
            {/* Inert until the store listings exist — a dead link would be worse. */}
            <button style={s.ctaPrimary} disabled title={t('home.workers.heroCtaSoon')}>
              <IconPhone size={17} />
              {t('home.workers.heroCta')}
              <span style={s.soonPill}>{t('home.workers.heroCtaSoon')}</span>
            </button>
          </div>
          <p style={s.heroNote}>{t('home.workers.heroNote')}</p>
        </div>

        <div style={s.heroRight}>
          <div style={s.cardsGrid}>
            {CARDS.map(({ k, rate, rating }) => (
              <div key={k} style={s.shiftCard}>
                <div style={s.cardTop}>
                  <span style={s.cardRating}>★ {rating}</span>
                </div>
                <div style={s.cardRole}>{t(`home.workers.card${k}Role`)}</div>
                <div style={s.cardPlace}>{t(`home.workers.card${k}Place`)}</div>
                <div style={s.cardFoot}>
                  <span style={s.cardWhen}>{t(`home.workers.card${k}When`)}</span>
                  <span style={s.cardRate}>€{rate}/h</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>{t('home.workers.stepsTitle')}</h2>
        <div style={s.stepsGrid}>
          {STEPS.map(n => (
            <div key={n} style={s.stepCard}>
              <div style={s.stepNum}>{n}</div>
              <h3 style={s.stepTitle}>{t(`home.workers.step${n}Title`)}</h3>
              <p style={s.stepBody}>{t(`home.workers.step${n}Body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why Turnos ── */}
      <section style={s.sectionTinted}>
        <h2 style={s.sectionTitle}>{t('home.workers.whyTitle')}</h2>
        <div style={s.whyGrid}>
          {WHY.map(({ k, Icon }) => (
            <div key={k} style={s.whyCard}>
              <span style={s.whyIcon}><Icon size={19} /></span>
              <h3 style={s.whyTitle}>{t(`home.workers.why${k}Title`)}</h3>
              <p style={s.whyBody}>{t(`home.workers.why${k}Body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>{t('home.workers.faqTitle')}</h2>
        <Faq ns="home.workers" ids={FAQ_IDS} />
      </section>

      {/* ── CTA ── */}
      <section style={s.ctaBanner}>
        <h2 style={s.ctaTitle}>{t('home.workers.ctaTitle')}</h2>
        <p style={s.ctaBody}>{t('home.workers.ctaBody')}</p>
        <button style={s.ctaWhite} disabled>{t('home.workers.ctaBtn')}</button>
        <p style={s.ctaSoon}>{t('home.workers.ctaSoon')}</p>
      </section>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <Logo height={20} />
        <span style={s.footerTagline}>{t('home.footer.tagline')}</span>
        <div style={s.footerLinks}>
          <Link href="/" style={s.footerLink}>{t('home.nav.forCompanies')}</Link>
          <a href="#" style={s.footerLink}>{t('home.footer.privacy')}</a>
          <a href="#" style={s.footerLink}>{t('home.footer.terms')}</a>
        </div>
      </footer>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-secondary)', minHeight: '100vh' },

  nav: {
    position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--color-border)',
  },
  navInner: {
    maxWidth: 1180, margin: '0 auto', padding: '14px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  navActions: { display: 'flex', alignItems: 'center', gap: 16 },
  navLink: {
    fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', textDecoration: 'none',
  },

  hero: {
    maxWidth: 1180, margin: '0 auto', padding: '64px 24px 72px',
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 48, alignItems: 'center',
  },
  heroLeft: {},
  eyebrow: {
    fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
    color: 'var(--color-primary)', display: 'block', marginBottom: 14,
  },
  heroTitle: {
    fontSize: 46, fontWeight: 800, letterSpacing: '-1.6px', lineHeight: 1.08,
    color: 'var(--color-text-primary)',
  },
  heroAccent: { color: 'var(--color-primary)' },
  heroBody: {
    fontSize: 16.5, lineHeight: 1.7, color: 'var(--color-text-secondary)',
    margin: '20px 0 28px', maxWidth: 480,
  },
  ctaRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  ctaPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 9,
    padding: '14px 26px', borderRadius: 'var(--radius-full)',
    background: 'var(--color-primary)', color: '#fff', border: 'none',
    fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'default', opacity: 0.92,
  },
  soonPill: {
    fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
    background: 'rgba(255,255,255,0.25)', padding: '3px 8px', borderRadius: 20,
  },
  heroNote: { fontSize: 13, color: 'var(--color-text-muted)', marginTop: 16 },

  heroRight: {},
  cardsGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
  },
  shiftCard: {
    background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14,
    padding: '14px 16px', boxShadow: '0 2px 12px rgba(26,26,46,0.05)',
  },
  cardTop: { display: 'flex', justifyContent: 'flex-end', marginBottom: 6 },
  cardRating: { fontSize: 12, fontWeight: 700, color: '#f59e0b' },
  cardRole: { fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)' },
  cardPlace: { fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 3 },
  cardFoot: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12,
  },
  cardWhen: {
    fontSize: 11.5, fontWeight: 600, color: 'var(--color-primary)',
    background: 'var(--color-primary-light)', padding: '3px 9px', borderRadius: 20,
  },
  cardRate: { fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)' },

  section: { maxWidth: 1080, margin: '0 auto', padding: '70px 24px' },
  sectionTinted: {
    background: '#fff', borderTop: '1px solid var(--color-border)',
    borderBottom: '1px solid var(--color-border)', padding: '70px 24px',
  },
  sectionTitle: {
    fontSize: 32, fontWeight: 800, letterSpacing: '-1px', textAlign: 'center',
    color: 'var(--color-text-primary)', marginBottom: 36,
  },

  stepsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20,
  },
  stepCard: {
    background: '#fff', border: '1px solid var(--color-border)',
    borderRadius: 16, padding: '26px 26px 28px',
  },
  stepNum: {
    width: 34, height: 34, borderRadius: '50%', background: 'var(--color-primary)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, fontWeight: 800, marginBottom: 16,
  },
  stepTitle: { fontSize: 17, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 9 },
  stepBody: { fontSize: 14.5, lineHeight: 1.65, color: 'var(--color-text-secondary)' },

  whyGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18,
    maxWidth: 1080, margin: '0 auto',
  },
  whyCard: { textAlign: 'center' },
  whyIcon: {
    width: 46, height: 46, borderRadius: 14, background: 'var(--color-primary-light)',
    color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', marginBottom: 14,
  },
  whyTitle: { fontSize: 15.5, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 7 },
  whyBody: { fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-secondary)' },

  ctaBanner: {
    background: 'var(--color-primary)', color: '#fff',
    padding: '64px 24px', textAlign: 'center',
  },
  ctaTitle: { fontSize: 30, fontWeight: 800, letterSpacing: '-1px', marginBottom: 10 },
  ctaBody: { fontSize: 16, opacity: 0.9, marginBottom: 26 },
  ctaWhite: {
    padding: '14px 30px', borderRadius: 'var(--radius-full)', border: 'none',
    background: '#fff', color: 'var(--color-primary)',
    fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'default',
  },
  ctaSoon: { fontSize: 13, opacity: 0.75, marginTop: 14 },

  footer: {
    padding: '40px 24px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 12, background: 'var(--color-secondary)',
  },
  footerTagline: { fontSize: 13.5, color: 'var(--color-text-secondary)' },
  footerLinks: { display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' },
  footerLink: { fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none' },
  footerCopy: { fontSize: 12, color: 'var(--color-text-muted)' },
};

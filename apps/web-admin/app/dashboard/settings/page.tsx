'use client';

/**
 * Company settings.
 *
 * Until this page existed a company could change NOTHING after registering —
 * not its address, not its name, and not `accountantEmail`, which is where the
 * Segurança Social notification is sent before every shift. That last one was
 * silently falling back to the sign-in email.
 *
 * Two fields are shown but locked: NIPC (the company's legal identifier, with a
 * unique constraint) and the sign-in email (it is the login). Both are support
 * operations, and the page says so rather than hiding them.
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EMPLOYER_SECTORS } from '@turnos/shared';
import { adminApi, EmployerProfile, ApiError } from '../../../lib/api';
import { SIDEBAR_NAV } from '../../../lib/nav';
import { useT } from '../../../lib/i18n';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { Logo } from '../../../components/Logo';
import {
  IconBuilding, IconShield, IconCheck, IconHeadset, IconCard, IconUser,
} from '../../../components/icons';

const SUPPORT_EMAIL = 'suporte@turnos.pt';
const BENEFITS = ['1', '2', '3', '4', '5'] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { t, tSector } = useT();

  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [form, setForm] = useState({
    companyName: '', sector: '', nif: '', address: '',
    postalCode: '', city: '', accountantEmail: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    adminApi.getMyProfile()
      .then(p => {
        setProfile(p);
        setForm({
          companyName: p.companyName ?? '',
          sector: p.sector ?? '',
          nif: p.nif ?? '',
          address: p.address ?? '',
          postalCode: p.postalCode ?? '',
          city: p.city ?? '',
          accountantEmail: p.accountantEmail ?? '',
        });
      })
      .catch(() => {});
  }, []);

  const set = (k: keyof typeof form, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setSaved(false); setSaveError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaveError(''); setSaved(false);
    try {
      const updated = await adminApi.updateEmployerProfile(form);
      setProfile(updated);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t('admin.settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(''); setPwMsg('');
    if (pw.next !== pw.confirm) { setPwError(t('admin.settings.passwordMismatch')); return; }
    setPwBusy(true);
    try {
      await adminApi.changePassword(pw.current, pw.next);
      setPwMsg(t('admin.settings.passwordChanged'));
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : t('admin.settings.saveError'));
    } finally {
      setPwBusy(false);
    }
  };

  const planActive = profile?.subscriptionStatus === 'ACTIVE';

  return (
    <div style={s.shell}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.sidebarTop}>
          <div style={{ padding: '8px 12px', marginBottom: 8 }}><Logo height={30} href="/dashboard" /></div>
          <div style={s.sidebarDivider} />
          <nav style={s.sidebarNav}>
            {SIDEBAR_NAV.map(({ Icon, key, href, soon }) => {
              const isActive = href === '/dashboard/settings';
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
                <Link key={href} href={href} style={{ ...s.sidebarItem, ...(isActive ? s.sidebarItemActive : {}) }}>
                  <span style={s.sidebarIcon}><Icon size={17} /></span>
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={s.sidebarBottom}>
          <Link href="/dashboard/settings" style={s.companyBadge}>
            <div style={s.companyAvatar}><IconBuilding size={18} /></div>
            <div>
              <div style={s.companyName}>{profile?.companyName ?? t('admin.chrome.myCompany')}</div>
              <div style={s.companyPlan}>{profile?.sector ? tSector(profile.sector) : '—'}</div>
            </div>
          </Link>
          <Link href="/login" style={s.logoutBtn}>{t('admin.chrome.logout')}</Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={s.main}>
        <header style={s.topBar}>
          <div>
            <button style={s.backBtn} onClick={() => router.push('/dashboard')}>
              {t('admin.chrome.backDashboard')}
            </button>
            <h1 style={s.title}>{t('admin.settings.title')}</h1>
            <p style={s.sub}>{t('admin.settings.sub')}</p>
          </div>
          <LanguageSwitcher />
        </header>

        <div style={s.grid}>
          {/* ── Account details ── */}
          <section style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardIcon}><IconBuilding size={18} /></span>
              <div>
                <h2 style={s.cardTitle}>{t('admin.settings.accountTitle')}</h2>
                <p style={s.cardSub}>{t('admin.settings.accountSub')}</p>
              </div>
            </div>

            <form onSubmit={handleSave} style={s.form}>
              <Field label={t('admin.settings.labelCompany')}>
                <input style={s.input} value={form.companyName}
                  onChange={e => set('companyName', e.target.value)} required />
              </Field>

              <Field label={t('admin.settings.labelSector')}>
                {/* value stays the stored PT sector name */}
                <select style={s.input} value={form.sector} onChange={e => set('sector', e.target.value)}>
                  <option value="">—</option>
                  {EMPLOYER_SECTORS.map(sec => (
                    <option key={sec} value={sec}>{tSector(sec)}</option>
                  ))}
                </select>
              </Field>

              <Field label={t('admin.settings.labelNipc')} hint={t('admin.settings.nipcLocked')}>
                <input style={{ ...s.input, ...s.inputLocked }} value={profile?.nipc ?? ''} disabled />
              </Field>

              <Field label={t('admin.settings.labelNif')}>
                <input style={s.input} value={form.nif} maxLength={9}
                  onChange={e => set('nif', e.target.value.replace(/\D/g, '').slice(0, 9))} />
              </Field>

              <Field label={t('admin.settings.labelAddress')} full>
                <input style={s.input} value={form.address}
                  onChange={e => set('address', e.target.value)} />
              </Field>

              <Field label={t('admin.settings.labelPostal')}>
                <input style={s.input} value={form.postalCode} placeholder="1000-001"
                  onChange={e => set('postalCode', e.target.value)} />
              </Field>

              <Field label={t('admin.settings.labelCity')}>
                <input style={s.input} value={form.city}
                  onChange={e => set('city', e.target.value)} />
              </Field>

              <Field label={t('admin.settings.labelAdminEmail')} hint={t('admin.settings.adminEmailLocked')} full>
                <input style={{ ...s.input, ...s.inputLocked }} value={profile?.adminEmail ?? ''} disabled />
              </Field>

              {/* The one field with real operational consequence on this page. */}
              <Field label={t('admin.settings.labelAccountant')} hint={t('admin.settings.accountantHint')} full>
                <input style={s.input} type="email" value={form.accountantEmail}
                  placeholder={profile?.adminEmail ?? ''}
                  onChange={e => set('accountantEmail', e.target.value)} />
              </Field>

              <div style={s.formFoot}>
                <button type="submit" style={s.primaryBtn} disabled={saving}>
                  {saving ? t('admin.settings.saving') : t('admin.settings.save')}
                </button>
                {saved && <span style={s.ok}><IconCheck size={14} /> {t('admin.settings.saved')}</span>}
                {saveError && <span style={s.err}>{saveError}</span>}
              </div>
            </form>
          </section>

          {/* ── Plan ── */}
          <section style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardIcon}><IconCard size={18} /></span>
              <div>
                <h2 style={s.cardTitle}>{t('admin.settings.planTitle')}</h2>
                <p style={s.cardSub}>{t('admin.settings.planPrice')}</p>
              </div>
            </div>
            <div style={s.planRow}>
              <span style={s.planName}>
                {profile?.subscriptionTier && profile.subscriptionTier !== 'NONE'
                  ? t('admin.settings.planStarter')
                  : t('admin.settings.planNone')}
              </span>
              <span style={{ ...s.planPill, ...(planActive ? s.planPillOn : {}) }}>
                {planActive ? t('admin.settings.planActive') : t('admin.settings.planInactive')}
              </span>
            </div>
            <ul style={s.benefits}>
              {BENEFITS.map(n => (
                <li key={n} style={s.benefit}>
                  <span style={s.benefitTick}><IconCheck size={12} /></span>
                  {t(`admin.settings.benefit${n}`)}
                </li>
              ))}
            </ul>
            <Link href="/dashboard/billing" style={s.linkBtn}>{t('admin.settings.planManage')}</Link>
          </section>

          {/* ── Password ── */}
          <section style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardIcon}><IconUser size={18} /></span>
              <div>
                <h2 style={s.cardTitle}>{t('admin.settings.passwordTitle')}</h2>
                <p style={s.cardSub}>{t('admin.settings.passwordSub')}</p>
              </div>
            </div>
            <form onSubmit={handlePassword} style={s.form}>
              <Field label={t('admin.settings.labelCurrent')} full>
                <input style={s.input} type="password" value={pw.current} required
                  onChange={e => { setPw(p => ({ ...p, current: e.target.value })); setPwError(''); setPwMsg(''); }} />
              </Field>
              <Field label={t('admin.settings.labelNew')} hint={t('admin.settings.passwordHint')}>
                <input style={s.input} type="password" value={pw.next} required minLength={8}
                  onChange={e => { setPw(p => ({ ...p, next: e.target.value })); setPwError(''); }} />
              </Field>
              <Field label={t('admin.settings.labelConfirm')}>
                <input style={s.input} type="password" value={pw.confirm} required minLength={8}
                  onChange={e => { setPw(p => ({ ...p, confirm: e.target.value })); setPwError(''); }} />
              </Field>
              <div style={s.formFoot}>
                <button type="submit" style={s.primaryBtn} disabled={pwBusy}>
                  {pwBusy ? t('admin.settings.changing') : t('admin.settings.changePassword')}
                </button>
                {pwMsg && <span style={s.ok}><IconCheck size={14} /> {pwMsg}</span>}
                {pwError && <span style={s.err}>{pwError}</span>}
              </div>
            </form>
          </section>

          {/* ── Support ── */}
          <section style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardIcon}><IconHeadset size={18} /></span>
              <div>
                <h2 style={s.cardTitle}>{t('admin.settings.supportTitle')}</h2>
                <p style={s.cardSub}>{t('admin.settings.supportSub')}</p>
              </div>
            </div>
            <a href={`mailto:${SUPPORT_EMAIL}`} style={s.linkBtn}>{t('admin.settings.supportEmail')}</a>
            <p style={s.note}>{t('admin.settings.supportNote')}</p>
          </section>

          {/* ── Legal & privacy ── */}
          <section style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardIcon}><IconShield size={18} /></span>
              <div>
                <h2 style={s.cardTitle}>{t('admin.settings.legalTitle')}</h2>
              </div>
            </div>
            <div style={s.legalList}>
              <a href="/" style={s.legalLink}>{t('admin.settings.legalTerms')}</a>
              <a href="/" style={s.legalLink}>{t('admin.settings.legalPrivacy')}</a>
              <a href="/" style={s.legalLink}>{t('admin.settings.legalFaq')}</a>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=RGPD`} style={s.legalLink}>{t('admin.settings.legalData')}</a>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=RGPD`} style={s.legalLink}>{t('admin.settings.legalDelete')}</a>
            </div>
            <p style={s.note}>{t('admin.settings.legalNote')}</p>
          </section>
        </div>
      </main>
    </div>
  );
}

function Field({ label, hint, full, children }: {
  label: string; hint?: string; full?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ ...s.field, ...(full ? { gridColumn: '1 / -1' } : {}) }}>
      <label style={s.label}>{label}</label>
      {children}
      {hint && <span style={s.hint}>{hint}</span>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh', background: 'var(--color-secondary)' },

  sidebar: {
    width: 232, background: '#fff', borderRight: '1px solid var(--color-border)',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: '18px 12px', position: 'sticky', top: 0, height: '100vh',
  },
  sidebarTop: {},
  sidebarDivider: { height: 1, background: 'var(--color-border)', margin: '4px 0 12px' },
  sidebarNav: { display: 'flex', flexDirection: 'column', gap: 2 },
  sidebarItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
    borderRadius: 8, fontSize: 13.5, fontWeight: 500, textDecoration: 'none',
    color: 'var(--color-text-secondary)',
  },
  sidebarItemActive: {
    background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 700,
  },
  sidebarItemDisabled: { opacity: 0.45 },
  sidebarIcon: { width: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  soonPill: {
    marginLeft: 'auto', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    background: 'var(--color-neutral-light, #eef0f4)', padding: '2px 6px', borderRadius: 20,
  },
  sidebarBottom: { display: 'flex', flexDirection: 'column', gap: 8 },
  companyBadge: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
    borderRadius: 10, background: 'var(--color-secondary)', textDecoration: 'none',
  },
  companyAvatar: {
    width: 36, height: 36, color: 'var(--color-primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-primary-light)', borderRadius: 8, flexShrink: 0,
  },
  companyName: { fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' },
  companyPlan: { fontSize: 11.5, color: 'var(--color-text-secondary)' },
  logoutBtn: {
    textAlign: 'center', padding: '9px', fontSize: 13, fontWeight: 600,
    color: 'var(--color-text-secondary)', textDecoration: 'none',
    border: '1px solid var(--color-border)', borderRadius: 8,
  },

  main: { flex: 1, padding: '26px 30px 60px', maxWidth: 1100 },
  topBar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 26 },
  backBtn: {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginBottom: 6,
  },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px' },
  sub: { fontSize: 13.5, color: 'var(--color-text-secondary)', marginTop: 4 },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 18, alignItems: 'start' },
  card: {
    background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14,
    padding: '22px 24px',
  },
  cardHead: { display: 'flex', gap: 12, marginBottom: 18 },
  cardIcon: {
    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
    background: 'var(--color-primary-light)', color: 'var(--color-primary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' },
  cardSub: { fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.5 },

  form: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)' },
  hint: { fontSize: 11.5, color: 'var(--color-text-muted)', lineHeight: 1.5 },
  input: {
    height: 40, padding: '0 12px', fontSize: 14, borderRadius: 9,
    border: '1.5px solid var(--color-border)', fontFamily: 'inherit',
    outline: 'none', color: 'var(--color-text-primary)', background: '#fff', width: '100%',
  },
  inputLocked: { background: '#f5f6fa', color: 'var(--color-text-secondary)', cursor: 'not-allowed' },
  formFoot: { gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 4 },
  primaryBtn: {
    padding: '10px 20px', borderRadius: 'var(--radius-full)', border: 'none',
    background: 'var(--color-primary)', color: '#fff',
    fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  },
  ok: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: '#16a34a' },
  err: { fontSize: 12.5, fontWeight: 600, color: '#dc2626' },

  planRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  planName: { fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)' },
  planPill: {
    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
    background: '#f1f2f6', color: 'var(--color-text-secondary)',
  },
  planPillOn: { background: '#dcfce7', color: '#166534' },
  benefits: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 },
  benefit: {
    display: 'flex', gap: 9, alignItems: 'flex-start',
    fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-text-secondary)',
  },
  benefitTick: {
    flexShrink: 0, width: 18, height: 18, borderRadius: '50%', marginTop: 1,
    background: 'var(--color-primary-light)', color: 'var(--color-primary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  linkBtn: {
    display: 'inline-block', padding: '9px 16px', borderRadius: 'var(--radius-full)',
    border: '1.5px solid var(--color-border)', textDecoration: 'none',
    fontSize: 13, fontWeight: 600, color: 'var(--color-primary)',
  },
  note: { fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6, marginTop: 12 },
  legalList: { display: 'flex', flexDirection: 'column', gap: 2 },
  legalLink: {
    padding: '9px 0', fontSize: 13.5, fontWeight: 600,
    color: 'var(--color-text-primary)', textDecoration: 'none',
    borderBottom: '1px solid var(--color-border)',
  },
};

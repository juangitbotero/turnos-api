'use client';

/**
 * Company settings.
 *
 * Until this page existed a company could change NOTHING after registering —
 * not its address, not its name. (It also held the accountant's email, used
 * to send hire data to the Segurança Social; that send was removed on
 * 2026-10-05 and the company now exports the data itself from Compliance.)
 *
 * Two fields are shown but locked: NIPC (the company's legal identifier, with a
 * unique constraint) and the sign-in email (it is the login). Both are support
 * operations, and the page says so rather than hiding them.
 *
 * Two tabs: Conta (everything below) and A minha subscrição (BillingPanel —
 * the old /dashboard/billing page, moved here 2026-10-11 and opened from the
 * company menu with ?tab=subscription).
 */
import { useState, useEffect } from 'react';
import { EMPLOYER_SECTORS, SUPPORT_EMAIL } from '@turnos/shared';
import { adminApi, EmployerProfile, ApiError } from '../../../lib/api';
import { useT } from '../../../lib/i18n';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { BillingPanel } from '../../../components/BillingPanel';
import { PROFILE_CHANGED_EVENT } from '../../../components/DashboardShell';
import { PageTabs, useTabParam } from '../../../components/PageNav';
import {
  IconBuilding, IconShield, IconCheck, IconHeadset, IconUser,
  IconImage, IconBell,
} from '../../../components/icons';

const TABS = ['account', 'subscription'] as const;

export default function SettingsPage() {
  const { t, tSector } = useT();
  const [tab, setTab] = useTabParam(TABS, 'account');

  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [form, setForm] = useState({
    companyName: '', sector: '', nif: '', address: '',
    postalCode: '', city: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState('');

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
      window.dispatchEvent(new Event(PROFILE_CHANGED_EVENT));
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

  const handleLogo = async (file: File) => {
    setLogoBusy(true); setLogoError('');
    try {
      const { logoUrl } = await adminApi.uploadEmployerLogo(file);
      setProfile(p => (p ? { ...p, logoUrl } : p));
      window.dispatchEvent(new Event(PROFILE_CHANGED_EVENT));
    } catch (err) {
      setLogoError(err instanceof ApiError ? err.message : t('admin.settings.logoError'));
    } finally {
      setLogoBusy(false);
    }
  };

  /**
   * Preferences save on toggle — no separate save button for a switch.
   * Optimistic, and reverted from the server response if the call fails.
   */
  const savePrefs = async (patch: { ratingReminders?: boolean; wageReminders?: boolean; newCandidates?: boolean }) => {
    const previous = profile;
    setProfile(p => (p ? { ...p, notificationPrefs: { ...prefs, ...patch } } : p));
    try {
      setProfile(await adminApi.updateEmployerProfile({ notificationPrefs: patch }));
    } catch {
      setProfile(previous);
    }
  };

  // Unset means ON — matches notificationPrefsOf on the server.
  const prefs = {
    ratingReminders: profile?.notificationPrefs?.ratingReminders ?? true,
    wageReminders:   profile?.notificationPrefs?.wageReminders   ?? true,
    newCandidates:   profile?.notificationPrefs?.newCandidates   ?? true,
  };

  return (
      <div style={s.main}>
        <header style={s.topBar}>
          <div>
            <h1 style={s.title}>{t('admin.settings.title')}</h1>
            <p style={s.sub}>{t('admin.settings.sub')}</p>
          </div>
          <LanguageSwitcher />
        </header>

        <PageTabs
          tabs={[
            { id: 'account', label: t('admin.settings.tabAccount') },
            { id: 'subscription', label: t('admin.nav.billing') },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === 'subscription' && <BillingPanel />}

        {tab === 'account' && (
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

              <div style={s.formFoot}>
                <button type="submit" style={s.primaryBtn} disabled={saving}>
                  {saving ? t('admin.settings.saving') : t('admin.settings.save')}
                </button>
                {saved && <span style={s.ok}><IconCheck size={14} /> {t('admin.settings.saved')}</span>}
                {saveError && <span style={s.err}>{saveError}</span>}
              </div>
            </form>
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

          {/* ── Logo ── */}
          <section style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardIcon}><IconImage size={18} /></span>
              <div>
                <h2 style={s.cardTitle}>{t('admin.settings.logoTitle')}</h2>
                <p style={s.cardSub}>{t('admin.settings.logoSub')}</p>
              </div>
            </div>
            <div style={s.logoRow}>
              <div style={s.logoPreview}>
                {profile?.logoUrl
                  ? <img src={profile.logoUrl} alt="" style={s.logoImg} />
                  : <IconBuilding size={26} />}
              </div>
              <div>
                <label style={s.uploadBtn}>
                  {logoBusy ? t('admin.settings.logoUploading')
                    : profile?.logoUrl ? t('admin.settings.logoChange')
                    : t('admin.settings.logoUpload')}
                  <input
                    type="file" accept="image/*" hidden disabled={logoBusy}
                    onChange={e => { const f = e.target.files?.[0]; if (f) void handleLogo(f); }}
                  />
                </label>
                <p style={s.hint}>{t('admin.settings.logoHint')}</p>
                {logoError && <span style={s.err}>{logoError}</span>}
              </div>
            </div>
          </section>

          {/* ── Notifications ── */}
          <section style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardIcon}><IconBell size={18} /></span>
              <div>
                <h2 style={s.cardTitle}>{t('admin.settings.notifTitle')}</h2>
                <p style={s.cardSub}>{t('admin.settings.notifSub')}</p>
              </div>
            </div>
            <Toggle
              on={prefs.newCandidates}
              onChange={v => savePrefs({ newCandidates: v })}
              title={t('admin.settings.notifCandidates')}
              sub={t('admin.settings.notifCandidatesSub')}
            />
            <Toggle
              on={prefs.ratingReminders}
              onChange={v => savePrefs({ ratingReminders: v })}
              title={t('admin.settings.notifRating')}
              sub={t('admin.settings.notifRatingSub')}
            />
            <Toggle
              on={prefs.wageReminders}
              onChange={v => savePrefs({ wageReminders: v })}
              title={t('admin.settings.notifWage')}
              sub={t('admin.settings.notifWageSub')}
            />
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
              <a href="/termos-empresas" target="_blank" rel="noreferrer" style={s.legalLink}>{t('admin.settings.legalTerms')}</a>
              <a href="/privacidade" target="_blank" rel="noreferrer" style={s.legalLink}>{t('admin.settings.legalPrivacy')}</a>
              <a href="/" style={s.legalLink}>{t('admin.settings.legalFaq')}</a>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=RGPD`} style={s.legalLink}>{t('admin.settings.legalData')}</a>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=RGPD`} style={s.legalLink}>{t('admin.settings.legalDelete')}</a>
            </div>
            <p style={s.note}>{t('admin.settings.legalNote')}</p>
          </section>
        </div>
        )}
      </div>
  );
}

/** A labelled on/off row. Saves immediately — a switch with a Save button reads as broken. */
function Toggle({ on, onChange, title, sub }: {
  on: boolean; onChange: (v: boolean) => void; title: string; sub: string;
}) {
  return (
    <div style={s.toggleRow}>
      <div style={{ flex: 1 }}>
        <div style={s.toggleTitle}>{title}</div>
        <div style={s.toggleSub}>{sub}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        style={{ ...s.switch, ...(on ? s.switchOn : {}) }}
      >
        <span style={{ ...s.knob, ...(on ? s.knobOn : {}) }} />
      </button>
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
  main: { padding: '26px 30px 60px', maxWidth: 1100 },
  topBar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 26 },
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

  linkBtn: {
    display: 'inline-block', padding: '9px 16px', borderRadius: 'var(--radius-full)',
    border: '1.5px solid var(--color-border)', textDecoration: 'none',
    fontSize: 13, fontWeight: 600, color: 'var(--color-primary)',
  },
  note: { fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6, marginTop: 12 },
  legalList: { display: 'flex', flexDirection: 'column', gap: 2 },
  logoRow: { display: 'flex', gap: 16, alignItems: 'flex-start' },
  logoPreview: {
    width: 72, height: 72, borderRadius: 12, flexShrink: 0, overflow: 'hidden',
    background: 'var(--color-primary-light)', color: 'var(--color-primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  uploadBtn: {
    display: 'inline-block', padding: '9px 16px', borderRadius: 'var(--radius-full)',
    border: '1.5px solid var(--color-border)', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', marginBottom: 6,
  },
  toggleRow: {
    display: 'flex', alignItems: 'flex-start', gap: 16, padding: '14px 0',
    borderTop: '1px solid var(--color-border)',
  },
  toggleTitle: { fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' },
  toggleSub: { fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.55, marginTop: 3 },
  switch: {
    flexShrink: 0, width: 42, height: 24, borderRadius: 20, border: 'none',
    background: '#d8dbe3', cursor: 'pointer', padding: 3, transition: 'background .15s',
  },
  switchOn: { background: 'var(--color-primary)' },
  knob: {
    display: 'block', width: 18, height: 18, borderRadius: '50%',
    background: '#fff', transition: 'transform .15s',
  },
  knobOn: { transform: 'translateX(18px)' },
  legalLink: {
    padding: '9px 0', fontSize: 13.5, fontWeight: 600,
    color: 'var(--color-text-primary)', textDecoration: 'none',
    borderBottom: '1px solid var(--color-border)',
  },
};

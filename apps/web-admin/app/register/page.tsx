'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EMPLOYER_SECTORS } from '@turnos/shared';
import { useT } from '../../lib/i18n';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { Logo } from '../../components/Logo';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

type Step = 'company' | 'admin' | 'review';

interface FormState {
  companyName: string; nipc: string; nif: string;
  sector: string; address: string; postalCode: string; city: string;
  adminEmail: string; adminPassword: string; adminPasswordConfirm: string;
}

const EMPTY: FormState = {
  companyName: '', nipc: '', nif: '', sector: '', address: '',
  postalCode: '', city: '', adminEmail: '', adminPassword: '', adminPasswordConfirm: '',
};

export default function RegisterPage() {
  const { t, tSector, language } = useT();
  const [step, setStep] = useState<Step>('company');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const router = useRouter();

  const set = (key: keyof FormState, val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const validateCompany = (): boolean => {
    const e: Partial<FormState> = {};
    if (!form.companyName.trim()) e.companyName = t('home.register.errName');
    if (!/^\d{9}$/.test(form.nipc))   e.nipc = t('home.register.errNipc');
    if (!form.sector)                  e.sector = t('home.register.errSector');
    if (!form.address.trim())          e.address = t('home.register.errAddress');
    if (!/^\d{4}-\d{3}$/.test(form.postalCode)) e.postalCode = t('home.register.errPostal');
    if (!form.city.trim())             e.city = t('home.register.errCity');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateAdmin = (): boolean => {
    const e: Partial<FormState> = {};
    if (!form.adminEmail.includes('@'))        e.adminEmail = t('home.register.errEmail');
    if (form.adminPassword.length < 8)         e.adminPassword = t('home.register.errPassword');
    if (form.adminPassword !== form.adminPasswordConfirm)
      e.adminPasswordConfirm = t('home.register.errConfirm');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 'company' && validateCompany()) setStep('admin');
    if (step === 'admin'   && validateAdmin())   setStep('review');
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setApiError('');
    try {
      const res = await fetch(`${API_BASE}/auth/register/employer`, {
        method: 'POST',
        // This one call bypasses lib/api.ts, so it sets the header itself —
        // NIF/NIPC/email-taken validation errors come back from the API and are
        // shown verbatim below.
        headers: { 'Content-Type': 'application/json', 'Accept-Language': language },
        body: JSON.stringify({
          companyName: form.companyName,
          nipc: form.nipc,
          nif: form.nif || undefined,
          sector: form.sector,
          address: form.address,
          postalCode: form.postalCode,
          city: form.city,
          adminEmail: form.adminEmail,
          adminPassword: form.adminPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t('home.register.errUnknown'));
      // Store tokens
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      setApiError(err.message ?? t('home.register.errUnknown'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={s.page}>

      {/* Left panel */}
      <aside style={s.panel}>
        <div style={s.panelInner}>
          <Logo variant="white" height={30} href="/" />
          <div style={s.panelContent}>
            <h2 style={s.panelTitle}>{t('home.register.panelTitle')}</h2>
            <p style={s.panelSub}>{t('home.register.panelSub')}</p>
            {/* Steps indicator */}
            <div style={s.steps}>
              {(['company', 'admin', 'review'] as Step[]).map((s2, i) => {
                const labels = [
                  t('home.register.stepCompany'),
                  t('home.register.stepAccount'),
                  t('home.register.stepReview'),
                ];
                const done  = step === 'admin' ? i < 1 : step === 'review' ? i < 2 : false;
                const active = step === s2;
                return (
                  <div key={s2} style={s.stepRow}>
                    <div style={{
                      ...s.stepDot,
                      background: done ? '#fff' : active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)',
                    }}>
                      <span style={{ color: done ? '#6a79ff' : active ? '#6a79ff' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 800 }}>
                        {done ? '✓' : i + 1}
                      </span>
                    </div>
                    <span style={{ ...s.stepLabel, opacity: active || done ? 1 : 0.5 }}>{labels[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <p style={s.panelFooter}>{t('home.register.panelFooter')}</p>
        </div>
        <div style={s.blob1} /><div style={s.blob2} />
      </aside>

      {/* Right form */}
      <main style={s.formSide}>
        <div style={s.formBox}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Logo height={30} href="/" />
            <LanguageSwitcher />
          </div>

          {/* ── Step 1: Company ── */}
          {step === 'company' && (
            <>
              <div style={s.formHeader}>
                <h1 style={s.formTitle}>{t('home.register.companyTitle')}</h1>
                <p style={s.formSub}>{t('home.register.haveAccount')} <Link href="/login" style={s.link}>{t('home.register.loginLink')}</Link></p>
              </div>
              <div style={s.form}>
                <Field id="reg-company-name" label={t('home.register.labelName')} error={errors.companyName}>
                  <input id="reg-company-name" style={{...s.input, ...(errors.companyName ? s.inputError : {})}}
                    value={form.companyName} onChange={e => set('companyName', e.target.value)}
                    placeholder={t('home.register.placeholderName')} />
                </Field>
                <div style={s.twoCol}>
                  <Field id="reg-nipc" label={t('home.register.labelNipc')} hint={t('home.register.hintNipc')} error={errors.nipc}>
                    <input id="reg-nipc" style={{...s.input, ...(errors.nipc ? s.inputError : {})}}
                      value={form.nipc} onChange={e => set('nipc', e.target.value.replace(/\D/g, '').slice(0, 9))}
                      placeholder="508 123 456" maxLength={9} />
                  </Field>
                  <Field id="reg-nif" label={t('home.register.labelNif')} hint={t('home.register.hintNif')}>
                    <input id="reg-nif" style={s.input}
                      value={form.nif} onChange={e => set('nif', e.target.value.replace(/\D/g, '').slice(0, 9))}
                      placeholder="123 456 789" maxLength={9} />
                  </Field>
                </div>
                <Field id="reg-sector" label={t('home.register.labelSector')} error={errors.sector}>
                  <select id="reg-sector" style={{...s.input, ...(errors.sector ? s.inputError : {})}}
                    value={form.sector} onChange={e => set('sector', e.target.value)}>
                    {/* value stays the stored PT sector name */}
                    <option value="">{t('home.register.pickSector')}</option>
                    {EMPLOYER_SECTORS.map(s2 => <option key={s2} value={s2}>{tSector(s2)}</option>)}
                  </select>
                </Field>
                <Field id="reg-address" label={t('home.register.labelAddress')} error={errors.address}>
                  <input id="reg-address" style={{...s.input, ...(errors.address ? s.inputError : {})}}
                    value={form.address} onChange={e => set('address', e.target.value)}
                    placeholder={t('home.register.placeholderAddress')} />
                </Field>
                <div style={s.twoCol}>
                  <Field id="reg-postal" label={t('home.register.labelPostal')} error={errors.postalCode}>
                    <input id="reg-postal" style={{...s.input, ...(errors.postalCode ? s.inputError : {})}}
                      value={form.postalCode} onChange={e => set('postalCode', e.target.value)}
                      placeholder="1000-001" maxLength={8} />
                  </Field>
                  <Field id="reg-city" label={t('home.register.labelCity')} error={errors.city}>
                    <input id="reg-city" style={{...s.input, ...(errors.city ? s.inputError : {})}}
                      value={form.city} onChange={e => set('city', e.target.value)}
                      placeholder={t('home.register.placeholderCity')} />
                  </Field>
                </div>
                <button id="reg-next-company" onClick={handleNext} style={s.submitBtn}>
                  {t('home.register.continue')}
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Admin account ── */}
          {step === 'admin' && (
            <>
              <div style={s.formHeader}>
                <h1 style={s.formTitle}>{t('home.register.adminTitle')}</h1>
                <p style={s.formSub}>{t('home.register.adminSub')}</p>
              </div>
              <div style={s.form}>
                <Field id="reg-email" label={t('home.register.labelEmail')} error={errors.adminEmail}>
                  <input id="reg-email" type="email" style={{...s.input, ...(errors.adminEmail ? s.inputError : {})}}
                    value={form.adminEmail} onChange={e => set('adminEmail', e.target.value)}
                    placeholder={t('home.register.placeholderEmail')} />
                </Field>
                <Field id="reg-pass" label={t('home.register.labelPassword')} hint={t('home.register.hintPassword')} error={errors.adminPassword}>
                  <input id="reg-pass" type="password" style={{...s.input, ...(errors.adminPassword ? s.inputError : {})}}
                    value={form.adminPassword} onChange={e => set('adminPassword', e.target.value)}
                    placeholder="••••••••" />
                </Field>
                <Field id="reg-pass-confirm" label={t('home.register.labelConfirm')} error={errors.adminPasswordConfirm}>
                  <input id="reg-pass-confirm" type="password" style={{...s.input, ...(errors.adminPasswordConfirm ? s.inputError : {})}}
                    value={form.adminPasswordConfirm} onChange={e => set('adminPasswordConfirm', e.target.value)}
                    placeholder="••••••••" />
                </Field>
                <div style={s.btnRow}>
                  <button id="reg-back-company" onClick={() => setStep('company')} style={s.backBtn}>{t('home.register.back')}</button>
                  <button id="reg-next-admin" onClick={handleNext} style={{...s.submitBtn, flex: 1}}>{t('home.register.continue')}</button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: Review & Submit ── */}
          {step === 'review' && (
            <>
              <div style={s.formHeader}>
                <h1 style={s.formTitle}>{t('home.register.reviewTitle')}</h1>
                <p style={s.formSub}>{t('home.register.reviewSub')}</p>
              </div>
              <div style={s.reviewBox}>
                {[
                  [t('home.register.rowCompany'), form.companyName],
                  [t('home.register.rowNipc'), form.nipc],
                  [t('home.register.rowSector'), tSector(form.sector)],
                  [t('home.register.rowAddress'), `${form.address}, ${form.postalCode} ${form.city}`],
                  [t('home.register.rowEmail'), form.adminEmail],
                ].map(([k, v]) => (
                  <div key={k} style={s.reviewRow}>
                    <span style={s.reviewKey}>{k}</span>
                    <span style={s.reviewVal}>{v}</span>
                  </div>
                ))}
              </div>
              {apiError && (
                <div style={s.errorBanner} role="alert">⚠️ {apiError}</div>
              )}
              <div style={s.btnRow}>
                <button id="reg-back-admin" onClick={() => setStep('admin')} style={s.backBtn}>{t('home.register.back')}</button>
                <button
                  id="reg-submit"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  style={{...s.submitBtn, flex: 1, opacity: isLoading ? 0.7 : 1}}
                >
                  {isLoading ? t('home.register.submitting') : t('home.register.submit')}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* ── Sub-components ── */
function Field({
  id, label, hint, error, children,
}: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label htmlFor={id} style={s.label}>
        {label} {hint && <span style={s.hint}>({hint})</span>}
      </label>
      {children}
      {error && <span style={s.fieldError}>{error}</span>}
    </div>
  );
}

/* ─────────────────────────── Styles ─────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex' },
  panel: {
    position: 'relative', overflow: 'hidden', flex: '0 0 440px',
    background: 'linear-gradient(160deg, var(--color-primary) 0%, #9b6dff 100%)',
    display: 'flex', flexDirection: 'column',
  },
  panelInner: {
    position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column',
    height: '100%', padding: 48,
  },
  panelContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 },
  panelTitle: { fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-1.2px', lineHeight: 1.2 },
  panelSub: { fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65 },
  steps: { display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 },
  stepRow: { display: 'flex', alignItems: 'center', gap: 12 },
  stepDot: {
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1.5px solid rgba(255,255,255,0.4)',
  },
  stepLabel: { fontSize: 14, fontWeight: 600, color: '#fff' },
  panelFooter: { fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 },
  blob1: { position: 'absolute', width: 400, height: 400, background: 'rgba(255,255,255,0.06)', borderRadius: '50%', top: -100, right: -150, zIndex: 1 },
  blob2: { position: 'absolute', width: 280, height: 280, background: 'rgba(255,255,255,0.06)', borderRadius: '50%', bottom: -60, left: -100, zIndex: 1 },
  logo: { fontSize: 22, fontWeight: 800, color: '#fff', textDecoration: 'none', letterSpacing: '-1px' },
  formSide: { flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 32px', background: 'var(--color-bg)', overflowY: 'auto' },
  formBox: { width: '100%', maxWidth: 440 },
  formHeader: { marginBottom: 28 },
  formTitle: { fontSize: 26, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-1px', marginBottom: 6 },
  formSub: { fontSize: 14, color: 'var(--color-text-secondary)' },
  link: { color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' },
  hint: { fontWeight: 400, color: 'var(--color-text-muted)', fontSize: 12 },
  input: {
    width: '100%', height: 46, padding: '0 14px', fontSize: 14,
    color: 'var(--color-text-primary)', background: 'var(--color-surface)',
    border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    outline: 'none', fontFamily: 'inherit',
  },
  inputError: { borderColor: 'var(--color-error)' },
  fieldError: { fontSize: 12, color: 'var(--color-error)', fontWeight: 500 },
  submitBtn: {
    height: 48, padding: '0 24px', background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    color: '#fff', border: 'none', borderRadius: 'var(--radius-full)', fontSize: 14,
    fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 4px 16px var(--color-primary-glow)',
  },
  backBtn: {
    height: 48, padding: '0 20px', background: 'var(--color-surface)',
    color: 'var(--color-text-secondary)', border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-full)', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnRow: { display: 'flex', gap: 12, marginTop: 4 },
  reviewBox: {
    background: 'var(--color-surface)', border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 20,
  },
  reviewRow: {
    display: 'flex', justifyContent: 'space-between', gap: 16,
    padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
  },
  reviewKey: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', flexShrink: 0 },
  reviewVal: { fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500, textAlign: 'right' },
  errorBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--color-error-light)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 'var(--radius-sm)', padding: '10px 14px',
    fontSize: 13, color: 'var(--color-error)', fontWeight: 500, marginBottom: 16,
  },
};

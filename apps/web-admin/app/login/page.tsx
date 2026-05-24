'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi, ApiError } from '../../lib/api';

export default function AdminLogin() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { accessToken, refreshToken } = await adminApi.loginEmployer(email, password);
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      router.push('/dashboard');
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : 'Não foi possível ligar ao servidor. Tente novamente.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={s.page}>

      {/* ── Left brand panel ── */}
      <aside style={s.panel}>
        <div style={s.panelInner}>
          <Link href="/" style={s.logo}>turnos</Link>
          <div style={s.panelContent}>
            <h2 style={s.panelTitle}>
              Gerencie os seus turnos.<br />Sem complicações.
            </h2>
            <p style={s.panelSub}>
              Publique um turno em 10 segundos. Conformidade MCD automática.
              Pagamento por turno concluído.
            </p>
            <div style={s.panelCards}>
              {[
                { icon: '⚡', text: 'Preencha turnos em minutos' },
                { icon: '📋', text: 'Contratos MCD automáticos' },
                { icon: '💳', text: 'Pagamento T+1 ao trabalhador' },
              ].map(({ icon, text }) => (
                <div key={text} style={s.panelCard}>
                  <span style={s.panelCardIcon}>{icon}</span>
                  <span style={s.panelCardText}>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={s.panelFooter}>
            Beta fechada · Lisboa · 2026
          </div>
        </div>
        {/* Decorative blobs */}
        <div style={s.blob1} aria-hidden />
        <div style={s.blob2} aria-hidden />
      </aside>

      {/* ── Right login form ── */}
      <main style={s.formSide}>
        <div style={s.formBox}>

          {/* Mobile logo (hidden on desktop) */}
          <Link href="/" style={{ ...s.logo, marginBottom: 32, display: 'block' }}>turnos</Link>

          <div style={s.formHeader}>
            <h1 style={s.formTitle}>Entrar na conta</h1>
            <p style={s.formSub}>
              Não tem conta?{' '}
              <Link href="/register" style={s.formSubLink}>Registar empresa →</Link>
            </p>
          </div>

          <form onSubmit={handleLogin} style={s.form} noValidate>

            {/* Email */}
            <div style={s.field}>
              <label htmlFor="email" style={s.label}>Email</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon} aria-hidden>✉</span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="empresa@exemplo.pt"
                  style={s.input}
                />
              </div>
            </div>

            {/* Password */}
            <div style={s.field}>
              <label htmlFor="password" style={s.label}>Password</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon} aria-hidden>🔒</span>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={s.input}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={s.showPassBtn}
                  aria-label={showPass ? 'Ocultar password' : 'Mostrar password'}
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={s.errorBanner} role="alert">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Forgot */}
            <div style={s.forgotRow}>
              <a href="#" style={s.forgotLink}>Esqueceu a password?</a>
            </div>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading || !email || !password}
              style={{
                ...s.submitBtn,
                opacity: isLoading || !email || !password ? 0.65 : 1,
                cursor: isLoading || !email || !password ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? (
                <span style={s.spinner} className="animate-spin">⏳</span>
              ) : (
                'Entrar →'
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={s.divider}>
            <div style={s.dividerLine} />
            <span style={s.dividerText}>ou</span>
            <div style={s.dividerLine} />
          </div>

          {/* Google SSO placeholder */}
          <button id="google-login-btn" style={s.googleBtn} disabled>
            <span style={{ fontSize: 18 }}>G</span>
            Continuar com Google
            <span style={s.comingSoon}>Em breve</span>
          </button>

          <p style={s.legal}>
            Ao entrar, aceita os{' '}
            <a href="#" style={s.legalLink}>Termos de Serviço</a>
            {' '}e a{' '}
            <a href="#" style={s.legalLink}>Política de Privacidade</a>.
          </p>

        </div>
      </main>

    </div>
  );
}

/* ─────────────────────────── Styles ─────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
  },

  /* Left panel */
  panel: {
    position: 'relative',
    overflow: 'hidden',
    flex: '0 0 480px',
    background: 'linear-gradient(160deg, var(--color-primary) 0%, #9b6dff 100%)',
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
  },
  panelInner: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: 48,
  },
  panelContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  panelTitle: {
    fontSize: 36,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-1.5px',
    lineHeight: 1.15,
    marginBottom: 16,
  },
  panelSub: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.65,
    marginBottom: 40,
  },
  panelCards: { display: 'flex', flexDirection: 'column', gap: 12 },
  panelCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'rgba(255,255,255,0.12)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.2)',
  },
  panelCardIcon: { fontSize: 20 },
  panelCardText: { fontSize: 14, fontWeight: 600, color: '#fff' },
  panelFooter: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 500,
  },
  blob1: {
    position: 'absolute',
    width: 400,
    height: 400,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '50%',
    top: -100,
    right: -150,
    zIndex: 1,
  },
  blob2: {
    position: 'absolute',
    width: 300,
    height: 300,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '50%',
    bottom: -80,
    left: -100,
    zIndex: 1,
  },

  /* Logo */
  logo: {
    fontSize: 22,
    fontWeight: 800,
    color: '#fff',
    textDecoration: 'none',
    letterSpacing: '-1px',
    display: 'inline-block',
  },

  /* Right form side */
  formSide: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 32px',
    background: 'var(--color-bg)',
    overflowY: 'auto',
  },
  formBox: {
    width: '100%',
    maxWidth: 400,
  },
  formHeader: { marginBottom: 32 },
  formTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: 'var(--color-text-primary)',
    letterSpacing: '-1px',
    marginBottom: 8,
  },
  formSub: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
  },
  formSubLink: {
    color: 'var(--color-primary)',
    fontWeight: 600,
    textDecoration: 'none',
  },

  /* Form fields */
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    fontSize: 14,
    color: 'var(--color-text-muted)',
    pointerEvents: 'none',
    zIndex: 1,
  },
  input: {
    width: '100%',
    height: 48,
    padding: '0 44px 0 40px',
    fontSize: 15,
    color: 'var(--color-text-primary)',
    background: 'var(--color-surface)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
    transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
    fontFamily: 'inherit',
  },
  showPassBtn: {
    position: 'absolute',
    right: 12,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: 4,
    color: 'var(--color-text-muted)',
  },

  /* Error banner */
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--color-error-light)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--color-error)',
    fontWeight: 500,
  },

  /* Forgot */
  forgotRow: { display: 'flex', justifyContent: 'flex-end', marginTop: -8 },
  forgotLink: {
    fontSize: 13,
    color: 'var(--color-primary)',
    textDecoration: 'none',
    fontWeight: 500,
  },

  /* Submit */
  submitBtn: {
    width: '100%',
    height: 50,
    background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 16px var(--color-primary-glow)',
    transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
    fontFamily: 'inherit',
    marginTop: 4,
  },
  spinner: { fontSize: 18 },

  /* Divider */
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '24px 0',
  },
  dividerLine: { flex: 1, height: 1, background: 'var(--color-border)' },
  dividerText: { fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500 },

  /* Google btn */
  googleBtn: {
    width: '100%',
    height: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    background: 'var(--color-surface)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-full)',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    cursor: 'not-allowed',
    fontFamily: 'inherit',
    position: 'relative',
  },
  comingSoon: {
    position: 'absolute',
    right: 16,
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--color-primary)',
    background: 'var(--color-primary-light)',
    padding: '2px 7px',
    borderRadius: 'var(--radius-full)',
  },

  /* Legal */
  legal: {
    marginTop: 24,
    fontSize: 12,
    color: 'var(--color-text-muted)',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  legalLink: {
    color: 'var(--color-text-secondary)',
    textDecoration: 'underline',
    textDecorationColor: 'var(--color-border)',
  },
};

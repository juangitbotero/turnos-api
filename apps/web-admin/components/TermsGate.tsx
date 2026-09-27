'use client';

import { useEffect, useState } from 'react';
import { TERMS_VERSIONS } from '@turnos/shared';
import { adminApi } from '../lib/api';
import { useT } from '../lib/i18n';

/**
 * Blocks the dashboard until the company has accepted the current Terms for
 * Companies. New companies accept at registration, so this only appears for
 * accounts created before acceptance was recorded, and after a version bump.
 *
 * Fails open: if /auth/me cannot be read, the dashboard's own auth handling
 * deals with it — this gate never locks anyone out on a network error.
 */
export function TermsGate() {
  const { t } = useT();
  const [needed, setNeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getMyProfile()
      .then(me => setNeeded(me.termsCurrent === false))
      .catch(() => {});
  }, []);

  if (!needed) return null;

  const accept = async () => {
    setSaving(true);
    setError('');
    try {
      await adminApi.acceptTerms(TERMS_VERSIONS.EMPLOYER);
      setNeeded(false);
    } catch {
      setError(t('admin.termsGate.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.backdrop} role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
      <div style={s.card}>
        <h2 id="terms-gate-title" style={s.title}>{t('admin.termsGate.title')}</h2>
        <p style={s.body}>{t('admin.termsGate.body')}</p>
        <div style={s.links}>
          <a href="/termos-empresas" target="_blank" rel="noreferrer" style={s.link}>{t('admin.termsGate.read')} ↗</a>
          <a href="/privacidade" target="_blank" rel="noreferrer" style={s.link}>{t('admin.termsGate.privacy')} ↗</a>
        </div>
        {error && <p style={s.error}>{error}</p>}
        <button onClick={accept} disabled={saving} style={{ ...s.btn, opacity: saving ? 0.7 : 1 }}>
          {saving ? t('admin.termsGate.saving') : t('admin.termsGate.accept')}
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(15, 23, 42, 0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  card: {
    width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16,
    padding: 28, boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
  },
  title: { fontSize: 20, fontWeight: 800, margin: '0 0 10px', color: 'var(--color-text-primary)' },
  body: { fontSize: 14.5, lineHeight: 1.6, margin: '0 0 16px', color: 'var(--color-text-secondary)' },
  links: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 },
  link: { color: 'var(--color-primary)', fontWeight: 600, fontSize: 14 },
  error: { color: '#dc2626', fontSize: 13, margin: '0 0 12px' },
  btn: {
    width: '100%', height: 46, border: 'none', borderRadius: 999, cursor: 'pointer',
    background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 15,
  },
};

'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '../lib/api';
import { useT } from '../lib/i18n';

/**
 * Small, dismissible card for companies whose sign-in email is not verified,
 * with a "resend" button. Until 2026-10-05 no email was ever delivered, so
 * every company registered before then never received its verification link.
 *
 * Informational only — verification does not gate anything — so it never
 * blocks the page, and it stays hidden if /auth/me cannot be read.
 */
export function VerifyEmailBanner() {
  const { t } = useT();
  const [show, setShow] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  useEffect(() => {
    adminApi.getMyProfile()
      .then(me => setShow(me.emailVerified === false))
      .catch(() => {});
  }, []);

  if (!show) return null;

  const resend = async () => {
    setState('sending');
    try {
      const r = await adminApi.resendVerification();
      if (r.alreadyVerified) { setShow(false); return; }
      setState('sent');
    } catch {
      setState('failed');
    }
  };

  return (
    <div style={s.card} role="status">
      <button style={s.close} onClick={() => setShow(false)} aria-label={t('common.close')}>×</button>
      <p style={s.text}>{t('admin.verifyEmail.text')}</p>
      {state === 'sent' ? (
        <p style={s.ok}>{t('admin.verifyEmail.sent')}</p>
      ) : (
        <button style={{ ...s.btn, opacity: state === 'sending' ? 0.6 : 1 }} disabled={state === 'sending'} onClick={resend}>
          {state === 'sending' ? '...' : t('admin.verifyEmail.resend')}
        </button>
      )}
      {state === 'failed' && <p style={s.err}>{t('admin.verifyEmail.failed')}</p>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    position: 'fixed', right: 16, bottom: 16, zIndex: 50, maxWidth: 320,
    background: '#fffbeb', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 12,
    padding: '14px 16px', boxShadow: '0 6px 20px rgba(0,0,0,0.08)', fontSize: 13, color: '#78350f',
  },
  close: {
    position: 'absolute', top: 6, right: 8, background: 'none', border: 'none',
    fontSize: 18, lineHeight: 1, color: '#92400e', cursor: 'pointer',
  },
  text: { margin: '0 16px 10px 0', lineHeight: 1.45 },
  btn: {
    padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: '#d97706', color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
  },
  ok:  { margin: 0, fontWeight: 600, color: '#166534' },
  err: { margin: '8px 0 0', color: '#b91c1c' },
};

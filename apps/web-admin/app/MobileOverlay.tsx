'use client';

import { useEffect, useState } from 'react';
import { useT } from '../lib/i18n';

const STORAGE_KEY = 'turnos_mobile_overlay_dismissed';

export default function MobileOverlay() {
  const { t } = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY) === '1';
    if (!dismissed && window.innerWidth < 768) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  return (
    <div style={s.backdrop}>
      <div style={s.card}>
        <div style={s.icon}>💻</div>
        <h2 style={s.title}>{t('admin.mobileOverlay.title')}</h2>
        <p style={s.body}>{t('admin.mobileOverlay.body')}</p>
        <button style={s.continueBtn} onClick={dismiss}>
          {t('admin.mobileOverlay.continue')}
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(26, 26, 46, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    backdropFilter: 'blur(4px)',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '32px 24px',
    maxWidth: '360px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: '12px',
  },
  body: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.6',
    marginBottom: '24px',
  },
  continueBtn: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '4px 8px',
  },
};

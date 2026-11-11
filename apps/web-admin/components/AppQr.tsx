'use client';

/**
 * "Scan to download" for people reading turnos.cc on a computer: the QR opens
 * turnos.cc/app on the phone, which sends it to the right store — no typing,
 * no emailing the link to yourself.
 *
 * Shown on computers only (wide screens without touch): on a phone it would
 * be pointless, the badges next to it already open the store.
 *
 * public/qr-app.svg is generated once — the link never changes. To redo it,
 * from apps/api:
 *   node -e "require('qrcode').toString('https://turnos.cc/app',{type:'svg',margin:1,errorCorrectionLevel:'M',color:{dark:'#1a1a2e',light:'#ffffff'}},(e,s)=>require('fs').writeFileSync('../web-admin/public/qr-app.svg',s))"
 */
import { useEffect, useState } from 'react';
import { useT } from '../lib/i18n';

export function AppQr({ size = 120, layout = 'row' }: { size?: number; layout?: 'row' | 'column' }) {
  const { t } = useT();
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const check = () => setDesktop(window.innerWidth >= 900 && !('ontouchstart' in window) && navigator.maxTouchPoints === 0);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!desktop) return null;
  return (
    <div style={{ ...s.box, flexDirection: layout, textAlign: layout === 'column' ? 'center' : 'left' }}>
      <img src="/qr-app.svg" alt="QR — turnos.cc/app" width={size} height={size} style={s.qr} />
      <div>
        <div style={s.title}>{t('home.qr.title')}</div>
        <div style={s.sub}>{t('home.qr.sub')}</div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  box: {
    display: 'inline-flex', alignItems: 'center', gap: 14, padding: 12, marginTop: 18,
    background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14,
  },
  qr: { display: 'block', borderRadius: 6 },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' },
  sub: { fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 3, maxWidth: 200, lineHeight: 1.45 },
};

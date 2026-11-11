'use client';

/**
 * turnos.cc/app — one link for emails, posters, QR codes and Instagram.
 * An iPhone goes to the App Store, an Android phone to Google Play; a
 * computer (or anything unrecognised) sees both badges. Add `?src=…` to a link
 * to tell channels apart in the analytics later (it is ignored here).
 */
import { useEffect, useState } from 'react';
import { APP_STORE_URL, PLAY_STORE_URL } from '@turnos/shared';
import { useT } from '../../lib/i18n';
import { Logo } from '../../components/Logo';
import { StoreBadges } from '../../components/StoreBadges';

function storeFor(userAgent: string): string | null {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return APP_STORE_URL;
  // iPadOS reports itself as a Mac with touch
  if (/Macintosh/i.test(userAgent) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) return APP_STORE_URL;
  if (/Android/i.test(userAgent)) return PLAY_STORE_URL;
  return null;
}

export default function AppLinkPage() {
  const { t } = useT();
  const [showChoice, setShowChoice] = useState(false);

  useEffect(() => {
    const target = storeFor(navigator.userAgent);
    if (target) window.location.replace(target);
    else setShowChoice(true);
  }, []);

  return (
    <main style={s.page}>
      <Logo height={34} href="/" />
      {showChoice && (
        <>
          <h1 style={s.title}>{t('home.workers.ctaTitle')}</h1>
          <p style={s.sub}>{t('home.workers.ctaSoon')}</p>
          <StoreBadges height={52} align="center" />
        </>
      )}
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 18, padding: 24, background: 'var(--color-secondary)', textAlign: 'center',
  },
  title: { fontSize: 28, fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--color-text-primary)', marginTop: 10 },
  sub: { fontSize: 15, color: 'var(--color-text-secondary)', marginBottom: 6 },
};

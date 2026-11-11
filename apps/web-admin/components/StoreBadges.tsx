'use client';

/**
 * Official "Download on the App Store" / "Disponível no Google Play" badges,
 * in the page's language. The artwork is the stores' own (public/badges/,
 * downloaded from Apple's and Google's badge tools 2026-11-11) — both stores
 * require it unaltered, so never redraw or recolour these.
 *
 * Google's PNG carries a transparent margin around the badge; it is drawn
 * taller and pulled in with a negative margin so both look the same size,
 * as Google's own guidelines suggest.
 */
import { APP_STORE_URL, PLAY_STORE_URL } from '@turnos/shared';
import { useT } from '../lib/i18n';

export function StoreBadges({ height = 48, align = 'flex-start' }: {
  height?: number;
  align?: 'flex-start' | 'center';
}) {
  const { language } = useT();
  const lang = language === 'en' ? 'en' : 'pt';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: align }}>
      <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label="App Store">
        <img src={`/badges/app-store-${lang}.svg`} alt="App Store" style={{ height, display: 'block' }} />
      </a>
      <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label="Google Play">
        <img
          src={`/badges/google-play-${lang}.png`}
          alt="Google Play"
          style={{ height: Math.round(height * 1.45), margin: `-${Math.round(height * 0.225)}px`, display: 'block' }}
        />
      </a>
    </div>
  );
}

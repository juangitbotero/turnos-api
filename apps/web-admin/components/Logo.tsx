'use client';

/**
 * The Turnos wordmark.
 *
 * Replaces six hand-rolled copies of `<span>turnos</span>` — lowercase, in a
 * font that was never the brand's, sometimes with a decorative dot — which had
 * already drifted to three different sizes and two letter-spacings.
 *
 * Two variants because the app has both light and dark surfaces:
 *   purple → light backgrounds (nav, dashboard sidebar, footer)
 *   white  → dark backgrounds (the login/register brand panel, the hero)
 *
 * The purple file is generated from the white one by keeping the wordmark's
 * alpha and swapping the colour, so both are the same artwork and neither can
 * drift from the other. `docs/brand/turnos-logo.png` is 0 bytes and unusable —
 * the real source is `apps/mobile/assets/logo-white@3x.png`.
 */
import Link from 'next/link';

const RATIO = 1200 / 360; // the wordmark's intrinsic aspect

export function Logo({
  variant = 'purple',
  height = 26,
  href,
}: {
  variant?: 'purple' | 'white';
  /** Rendered height in px — width follows the wordmark's aspect ratio. */
  height?: number;
  /** Wrap in a link. Omit for a non-clickable mark. */
  href?: string;
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size static
    // asset; next/image adds a loader and layout shift for no benefit here.
    <img
      src={variant === 'white' ? '/logo-white.png' : '/logo.png'}
      alt="Turnos"
      width={Math.round(height * RATIO)}
      height={height}
      style={{ height, width: 'auto', display: 'block' }}
    />
  );

  return href
    ? <Link href={href} style={{ display: 'inline-block', lineHeight: 0 }}>{img}</Link>
    : img;
}

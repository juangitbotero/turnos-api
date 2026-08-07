'use client';

/**
 * Monochrome line icons, matching the mobile app's visual language.
 *
 * Every icon inherits `currentColor` and uses the same 1.6 stroke weight, so a
 * row of them reads as one set. That is the point: the dashboard had a mix of
 * emoji, coloured glyphs and no icons at all, which is what made the filter bar
 * look unlike the app.
 *
 * Deliberately not an icon library — six inline SVGs weigh nothing and avoid a
 * dependency whose default styling we would have to override anyway.
 */

type IconProps = { size?: number; style?: React.CSSProperties };

const base = (size: number): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as React.SVGProps<SVGSVGElement>);

export const IconSearch = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const IconBriefcase = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M3 12h18" />
  </svg>
);

export const IconGlobe = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
  </svg>
);

export const IconStar = ({ size = 16, style, filled }: IconProps & { filled?: boolean }) => (
  <svg {...base(size)} style={style} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z" />
  </svg>
);

export const IconCalendar = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
);

export const IconDownload = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M12 3v12" />
    <path d="M7.5 10.5L12 15l4.5-4.5" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const IconReset = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M3.5 12a8.5 8.5 0 1 1 2.6 6.1" />
    <path d="M3 19v-5h5" />
  </svg>
);

export const IconChevron = ({ size = 14, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/** Read-only 5-star rating, filled to `value`. */
export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  const filled = Math.round(value);
  return (
    <span style={{ display: 'inline-flex', gap: 1, color: '#f59e0b', lineHeight: 0 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <IconStar key={n} size={size} filled={n <= filled}
          style={n <= filled ? undefined : { color: '#d8dbe3' }} />
      ))}
    </span>
  );
}

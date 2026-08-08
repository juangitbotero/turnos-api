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

export const IconClipboard = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v1H9z" />
    <path d="M9 11h6M9 15h4" />
  </svg>
);

export const IconBell = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9z" />
    <path d="M10 18a2 2 0 0 0 4 0" />
  </svg>
);

export const IconUser = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
);

export const IconUsers = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <circle cx="9.5" cy="8" r="3.2" />
    <path d="M3.5 19.5a6 6 0 0 1 12 0" />
    <path d="M16 5.5a3.2 3.2 0 0 1 0 6" />
    <path d="M17.5 14.2a6 6 0 0 1 3 5.3" />
  </svg>
);

export const IconQr = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2" />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2" />
    <path d="M14 14h3v3h-3zM20.5 20.5h-3v-3" />
  </svg>
);

export const IconBolt = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M13 2.5L5.5 13.5H11l-.5 8L18 10.5h-5.5z" />
  </svg>
);

export const IconChart = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <path d="M8 16v-4M12.5 16V8M17 16v-6" />
  </svg>
);

export const IconEuro = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M17.5 6.5a6.5 6.5 0 1 0 0 11" />
    <path d="M4.5 10.5h8M4.5 13.5h8" />
  </svg>
);

export const IconCheck = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M4.5 12.5l5 5 10-11" />
  </svg>
);

export const IconClose = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style} strokeWidth={2.2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconPhone = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <path d="M10.5 5.5h3" />
    <path d="M11 18.5h2" />
  </svg>
);

export const IconShield = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M12 3l7 3v5.5c0 4.3-2.9 7.8-7 9.5-4.1-1.7-7-5.2-7-9.5V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const IconWallet = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18" />
    <circle cx="16.5" cy="14" r="1.2" />
  </svg>
);

export const IconBuilding = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" />
    <path d="M10 21v-3h4v3" />
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

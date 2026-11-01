import type { CSSProperties } from 'react';

/**
 * The dashboard's neutral UI kit (2026-10-11).
 *
 * Before this, every action had its own colour (blue Applicants, green
 * Completed, red Cancel, green QR codes…) and every status its own pill colour,
 * so colour stopped meaning anything. The rule now:
 *
 *   - Actions are neutral outline buttons. Only the page's ONE main action is
 *     filled with the brand gradient (e.g. "+ Publicar turno").
 *   - Destructive actions keep the neutral shape with red text — the only
 *     colour an action gets.
 *   - Statuses are grey pills with a dot. The dot is coloured only when the
 *     status asks for attention (see STATUS_DOT); everything else is grey.
 *
 * Use these instead of new one-off colours.
 */

export const ui = {
  /** Secondary action — the default for every button that isn't the page's main one. */
  btn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '6px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
    color: 'var(--color-text-primary)', fontWeight: 600, fontSize: 12, lineHeight: 1.4,
    cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap',
  } as CSSProperties,

  /** Same button, page-header size. */
  btnLg: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '8px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
    color: 'var(--color-text-primary)', fontWeight: 600, fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap',
  } as CSSProperties,

  /** Destructive: neutral shape, red text. Spread over `btn` or `btnLg`. */
  danger: { color: '#b91c1c' } as CSSProperties,

  /** The page's one main action. */
  primary: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 20px', background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none',
  } as CSSProperties,

  /** Neutral pill: statuses, tags ("3 dias"), badges. */
  pill: {
    display: 'inline-flex', alignItems: 'center', gap: 6, justifySelf: 'start', width: 'fit-content',
    padding: '3px 10px', borderRadius: 20, background: '#f3f4f6', border: '1px solid #e5e7eb',
    color: '#374151', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
  } as CSSProperties,

  dot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 } as CSSProperties,

  /** Neutral information banner. Use the amber one only for something the company must do. */
  banner: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 16,
  } as CSSProperties,
  bannerAction: { background: '#fffbeb', border: '1px solid #fde68a' } as CSSProperties,
};

/**
 * Dot colour per shift status. Coloured = needs a look; grey = nothing to do.
 *   green   filled — a worker is confirmed (2026-11-01: Juanes wanted it
 *           recognisable at a glance, not grey like an open shift)
 *   amber   waiting on someone: the worker to accept, or "to confirm"
 *   brand   happening right now
 *   red     cancelled or no-show (history only)
 */
export const STATUS_DOT: Record<string, string> = {
  FILLED:             '#16a34a',
  PENDING_ACCEPTANCE: '#f59e0b',
  TO_CONFIRM:         '#f59e0b',
  ACTIVE:             'var(--color-primary)',
  CANCELLED:          '#ef4444',
  NO_SHOW:            '#ef4444',
};
export const NEUTRAL_DOT = '#9ca3af';

/**
 * Tinted pill per status — the coloured statuses also tint the pill, so the
 * table reads by colour; grey statuses keep the neutral `ui.pill`.
 * TO_CONFIRM and NO_SHOW are dashboard-only states derived from a FILLED shift.
 */
const STATUS_TINT: Record<string, CSSProperties> = {
  FILLED:             { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' },
  PENDING_ACCEPTANCE: { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' },
  TO_CONFIRM:         { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' },
  ACTIVE:             { background: '#eef0ff', border: '1px solid #c7cdff', color: '#3730a3' },
  CANCELLED:          { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' },
  NO_SHOW:            { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' },
};

export function statusPill(status: string): CSSProperties {
  return { ...ui.pill, ...(STATUS_TINT[status] ?? {}) };
}

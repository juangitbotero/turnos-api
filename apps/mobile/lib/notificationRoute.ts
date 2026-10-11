/**
 * Where a notification opens — one table for a tapped push and a tapped inbox
 * entry, so both always land on the same screen.
 *
 * Offers (selected, withdrawn, lapsed, cancelled before answering) open
 * My shifts, where the Accept/Decline card and its countdown live; the shift
 * detail page has no Accept button, which is where the selection push used to
 * send people. A 'recibo_verde' push from before 2026-09-27 has a shiftId and
 * falls through to the shift detail.
 */
const TO_MY_SHIFTS = new Set([
  'pre_selected', 'offer_withdrawn', 'acceptance_timeout', 'shift_cancelled_by_employer',
  'wage_paid', 'wage_marked_paid', 'wage_adjusted',
]);

export function notificationRoute(data: { type?: unknown; shiftId?: unknown } | null | undefined): string | null {
  const type = typeof data?.type === 'string' ? data.type : undefined;
  const shiftId = typeof data?.shiftId === 'string' ? data.shiftId : undefined;
  if (type === 'account_restricted') return '/profile';            // statement of reasons
  if (type === 'rate_employer' && shiftId) return `/rate/${shiftId}`;
  if (type && TO_MY_SHIFTS.has(type)) return '/my-shifts';
  if (shiftId) return `/shift/${shiftId}`;
  return null;
}

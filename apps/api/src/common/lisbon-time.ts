/**
 * Shift dates and times are Lisbon wall-clock values ("2026-10-05", "14:00")
 * as the company typed them. The API runs on Railway in UTC, so building a
 * Date with `new Date(`${date}T${time}`)` read them as UTC — an hour late
 * during summer time (WEST, UTC+1). Check-in windows, auto-completion and the
 * cancellation thresholds were all shifted by that hour. Found 2026-10-05.
 *
 * Deliberately NOT fixed by setting TZ on the container: that would also
 * change how `pg` reads every existing `timestamp without time zone` column.
 */
export const BUSINESS_TIME_ZONE = 'Europe/Lisbon';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Lisbon's offset from UTC, in ms, at the instant `ts`. */
function lisbonOffsetMs(ts: number): number {
  const parts = partsFormatter.formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asIfUtc - Math.floor(ts / 1000) * 1000;
}

/**
 * The instant at which Lisbon's clock reads `date` `time`.
 * `date` is YYYY-MM-DD; `time` is HH:mm or HH:mm:ss (seconds ignored).
 */
export function lisbonDateTime(date: string, time: string): Date {
  const [y, mo, d] = date.slice(0, 10).split('-').map(Number);
  const [h, mi] = time.slice(0, 5).split(':').map(Number);
  const wall = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  // Guess with the offset at the wall time, then correct once — the offset
  // can differ across a DST change between the guess and the true instant.
  let ts = wall - lisbonOffsetMs(wall);
  const corrected = wall - lisbonOffsetMs(ts);
  if (corrected !== ts) ts = corrected;
  return new Date(ts);
}

/** YYYY-MM-DD for `date` (default now) on Lisbon's calendar. */
export function lisbonDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/** The calendar day after `date` (YYYY-MM-DD → YYYY-MM-DD). */
export function nextDay(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
}

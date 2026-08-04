/**
 * Calendar sync — writes confirmed shifts into the phone's own calendar app.
 *
 * A multi-day job creates ONE EVENT PER DAY (12:00–19:00 each), never a single
 * block spanning the whole range: the worker isn't working through the night
 * between days, and a multi-day block would show as busy in every scheduling
 * tool they use.
 *
 * Created event ids are stored locally per shift so a second tap updates the
 * existing events instead of duplicating them, and cancelling can remove them.
 */
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'calendar_events_';

/** Minutes before the shift start at which the phone should alert the worker. */
const REMINDERS_MINUTES = [24 * 60, 120]; // 1 day before, 2 hours before

export interface CalendarShift {
  id: string;
  title: string;
  subcategory: string;
  address: string;
  startTime: string;          // HH:mm:ss
  endTime: string;            // HH:mm:ss
  grossHourlyRate: number;
  paymentMethod?: string | null;
  companyName?: string | null;
  /** Every date of the job. A single-day shift passes just its own date. */
  dates: string[];
}

async function readStoredIds(shiftId: string): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(`${KEY_PREFIX}${shiftId}`);
    return raw ? JSON.parse(raw) as string[] : [];
  } catch {
    return [];
  }
}

async function writeStoredIds(shiftId: string, ids: string[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(`${KEY_PREFIX}${shiftId}`, JSON.stringify(ids));
  } catch {
    // Non-fatal: worst case a re-sync creates duplicates the worker can delete.
  }
}

/** True if this shift has already been written to the calendar. */
export async function isShiftInCalendar(shiftId: string): Promise<boolean> {
  return (await readStoredIds(shiftId)).length > 0;
}

/** The calendar we should write into — the device's default, or the first writable one. */
async function resolveTargetCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    const def = await Calendar.getDefaultCalendarAsync().catch(() => null);
    if (def?.id) return def.id;
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find(c => c.allowsModifications);
  return writable?.id ?? null;
}

function eventNotes(shift: CalendarShift): string {
  const hours = hoursBetween(shift.startTime, shift.endTime);
  const lines = [
    `Turno via Turnos${shift.companyName ? ` · ${shift.companyName}` : ''}`,
    '',
    `Função: ${shift.subcategory}`,
    `Horário: ${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)} (${hours}h)`,
    `Valor bruto: €${Number(shift.grossHourlyRate).toFixed(2)}/hora · ≈ €${(Number(shift.grossHourlyRate) * hours).toFixed(2)} no dia`,
  ];
  if (shift.paymentMethod) lines.push(`Pagamento: ${shift.paymentMethod}`);
  if (shift.dates.length > 1) {
    lines.push('', `Trabalho de ${shift.dates.length} dias — este é um dos dias.`);
  }
  lines.push('', 'Faz check-in com o QR à chegada.', `turnos://shift/${shift.id}`);
  return lines.join('\n');
}

function hoursBetween(start: string, end: string): number {
  const [sh = 0, sm = 0] = start.split(':').map(Number);
  const [eh = 0, em = 0] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60; // overnight
  return mins / 60;
}

function toDate(day: string, time: string): Date {
  return new Date(`${day}T${time.slice(0, 5)}:00`);
}

export type SyncResult =
  | { ok: true; created: number; replaced: boolean }
  | { ok: false; reason: 'permission' | 'no-calendar' | 'error' };

/**
 * Write (or rewrite) the shift's days into the phone calendar.
 * Idempotent — any previously created events for this shift are removed first.
 */
export async function syncShiftToCalendar(shift: CalendarShift): Promise<SyncResult> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'permission' };

    const calendarId = await resolveTargetCalendarId();
    if (!calendarId) return { ok: false, reason: 'no-calendar' };

    // Remove what we created before, so re-syncing updates rather than duplicates
    const previous = await readStoredIds(shift.id);
    for (const eventId of previous) {
      await Calendar.deleteEventAsync(eventId).catch(() => {});
    }

    const title = `${shift.subcategory}${shift.companyName ? ` · ${shift.companyName}` : ''}`;
    const notes = eventNotes(shift);

    const createdIds: string[] = [];
    for (const day of [...shift.dates].sort()) {
      const startDate = toDate(day, shift.startTime);
      const endDate   = toDate(day, shift.endTime);
      if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1); // overnight

      const eventId = await Calendar.createEventAsync(calendarId, {
        title,
        startDate,
        endDate,
        location: shift.address,
        notes,
        url: `turnos://shift/${shift.id}`,
        alarms: REMINDERS_MINUTES.map(minutes => ({ relativeOffset: -minutes })),
      });
      createdIds.push(eventId);
    }

    await writeStoredIds(shift.id, createdIds);
    return { ok: true, created: createdIds.length, replaced: previous.length > 0 };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Remove every calendar event created for this shift. */
export async function removeShiftFromCalendar(shiftId: string): Promise<void> {
  const ids = await readStoredIds(shiftId);
  for (const eventId of ids) {
    await Calendar.deleteEventAsync(eventId).catch(() => {});
  }
  await writeStoredIds(shiftId, []);
}

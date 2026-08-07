/**
 * Locale-aware date and money formatting.
 *
 * Replaces the hardcoded `toLocaleDateString('pt-PT', …)` calls that were
 * scattered across both apps. Currency is always EUR — only the grouping and
 * symbol placement follow the locale.
 */
import { AppLanguage, LOCALE_TAGS } from './types';

const tag = (lang: AppLanguage) => LOCALE_TAGS[lang];

/** "25 jul" / "25 Jul" */
export function formatShortDate(date: string | Date, lang: AppLanguage): string {
  return new Date(date).toLocaleDateString(tag(lang), { day: '2-digit', month: 'short' });
}

/** "25 de julho" / "25 July" */
export function formatLongDate(date: string | Date, lang: AppLanguage): string {
  return new Date(date).toLocaleDateString(tag(lang), { day: '2-digit', month: 'long' });
}

/** "25 jul 2026" / "25 Jul 2026" — the web-admin table/row date. */
export function formatMediumDate(date: string | Date, lang: AppLanguage): string {
  return new Date(date).toLocaleDateString(tag(lang), {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** "sábado, 25 de julho" / "Saturday, 25 July" */
export function formatWeekdayDate(date: string | Date, lang: AppLanguage): string {
  return new Date(date).toLocaleDateString(tag(lang), {
    weekday: 'long', day: '2-digit', month: 'long',
  });
}

/** "25/07/2026" */
export function formatNumericDate(date: string | Date, lang: AppLanguage): string {
  return new Date(date).toLocaleDateString(tag(lang));
}

/** "25 jul 2026, 14:30" — full audit-trail timestamp. */
export function formatTimestamp(date: string | Date, lang: AppLanguage): string {
  return new Date(date).toLocaleString(tag(lang), {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** "14:30" — clock time only (the API's check-in window messages). */
export function formatTime(date: string | Date, lang: AppLanguage): string {
  return new Date(date).toLocaleTimeString(tag(lang), { hour: '2-digit', minute: '2-digit' });
}

/** "25 jul, 14:30" — used for "applied at" style timestamps. */
export function formatDateTime(date: string | Date, lang: AppLanguage): string {
  return new Date(date).toLocaleDateString(tag(lang), {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Smart short date: "Hoje"/"Today", "Amanhã"/"Tomorrow", else a short date.
 * The relative labels are passed in so this module stays free of the catalogue.
 */
export function formatSmartDate(
  date: string | Date,
  lang: AppLanguage,
  labels: { today: string; tomorrow: string },
  monthFormat: 'short' | 'long' = 'short',
): string {
  const d = new Date(date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString())    return labels.today;
  if (d.toDateString() === tomorrow.toDateString()) return labels.tomorrow;

  return d.toLocaleDateString(tag(lang), { day: '2-digit', month: monthFormat });
}

/** "25 jul – 26 jul" for a set of dates (a multi-day job's range). */
export function formatDateRange(dates: readonly string[], lang: AppLanguage): string {
  if (dates.length === 0) return '';
  const sorted = [...dates].sort();
  const first = formatShortDate(sorted[0]!, lang);
  const last  = formatShortDate(sorted[sorted.length - 1]!, lang);
  return first === last ? first : `${first} – ${last}`;
}

/** Month name for a 0-based month index — replaces hardcoded month arrays. */
export function monthName(monthIndex: number, lang: AppLanguage, year = 2026): string {
  return new Date(year, monthIndex, 1).toLocaleDateString(tag(lang), { month: 'long' });
}

/**
 * Weekday initials for a calendar grid header, Monday first.
 * Derived from Intl rather than hardcoded, so PT gives S/T/Q/Q/S/S/D and EN
 * gives M/T/W/T/F/S/S.
 */
export function weekdayInitials(lang: AppLanguage): string[] {
  // 2024-01-01 was a Monday — any known Monday works as the anchor.
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toLocaleDateString(tag(lang), { weekday: 'narrow' }).toUpperCase();
  });
}

/** Money, always EUR, formatted for the active locale. */
export function formatMoney(amount: number, lang: AppLanguage): string {
  return new Intl.NumberFormat(tag(lang), { style: 'currency', currency: 'EUR' }).format(amount);
}

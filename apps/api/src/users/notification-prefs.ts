import { Employer } from './entities/employer.entity';

/**
 * The company email types a company may switch off.
 *
 * Kept to mail that actually exists and actually reaches the company.
 */
export interface NotificationPrefs {
  /** "Rate the worker" follow-up after a shift completes. */
  ratingReminders: boolean;
  /** The unpaid-wage reminder ladder. The FINAL warning always sends. */
  wageReminders: boolean;
  /** Email when a job gets its FIRST candidate (one per job, never per applicant). */
  newCandidates: boolean;
}

export const NOTIFICATION_PREF_KEYS = ['ratingReminders', 'wageReminders', 'newCandidates'] as const;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  ratingReminders: true,
  wageReminders: true,
  newCandidates: true,
};

/**
 * Read a company's preferences, defaulting anything unset to ON.
 *
 * Existing rows have no `notificationPrefs` column value, and a null there must
 * mean "as before" — never "opted out of everything", which would silently stop
 * mail companies are currently relying on.
 */
export function notificationPrefsOf(employer: Pick<Employer, 'notificationPrefs'> | null | undefined): NotificationPrefs {
  const stored = employer?.notificationPrefs ?? {};
  return {
    ratingReminders: stored.ratingReminders ?? DEFAULT_NOTIFICATION_PREFS.ratingReminders,
    wageReminders:   stored.wageReminders   ?? DEFAULT_NOTIFICATION_PREFS.wageReminders,
    newCandidates:   stored.newCandidates   ?? DEFAULT_NOTIFICATION_PREFS.newCandidates,
  };
}

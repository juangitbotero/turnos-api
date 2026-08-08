import { Employer } from './entities/employer.entity';

/**
 * The company email types a company may switch off.
 *
 * Kept to mail that actually exists and actually reaches the company. There is
 * deliberately no `newApplicant` entry: applicant alerts are push/websocket
 * only, so a preference for them would be a switch wired to nothing.
 */
export interface NotificationPrefs {
  /** "Rate the worker" follow-up after a shift completes. */
  ratingReminders: boolean;
  /** The unpaid-wage reminder ladder. The FINAL warning always sends. */
  wageReminders: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  ratingReminders: true,
  wageReminders: true,
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
  };
}

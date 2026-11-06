/**
 * "Não é a mesma pessoa" (2026-11-06): the company checks the person at the
 * door against the profile photo and their ID document. If they don't match,
 * it reports it — the API cancels the shift, suspends the account and opens
 * an ops case. One flow for the check-in toast and the shifts page.
 *
 * Returns true when the report went through.
 */
import { adminApi, ApiError } from './api';

type T = (key: string, params?: Record<string, unknown>) => string;

export async function reportIdentityMismatch(
  t: T,
  shift: { id: string; title: string },
  workerName: string | null | undefined,
): Promise<boolean> {
  const note = window.prompt(t('admin.shifts.identityPrompt', {
    shift: shift.title,
    name: workerName || t('admin.shifts.noName'),
  }));
  if (note === null) return false; // Cancel
  try {
    const { message } = await adminApi.reportIdentityMismatch(shift.id, note.trim() || undefined);
    window.alert(message);
    return true;
  } catch (err) {
    window.alert(err instanceof ApiError ? err.message : t('admin.shifts.actionError'));
    return false;
  }
}

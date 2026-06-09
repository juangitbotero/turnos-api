/**
 * Shared date/number formatting helpers for the Turnos mobile app.
 * Import from here instead of defining locally in each screen.
 */

export function formatDate(dateStr: string, monthFormat: 'short' | 'long' = 'short'): string {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === tomorrow.toDateString()) return 'Amanhã';
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: monthFormat });
}

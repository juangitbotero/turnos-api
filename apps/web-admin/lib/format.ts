export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatEuro(n: number): string {
  return `€${n.toFixed(2)}`;
}

// Worker-search-first: finding and inviting the right worker is the core value
// of the subscription, so Trabalhadores/Procurar sit right under Dashboard.
export const SIDEBAR_NAV = [
  { icon: '🏠', label: 'Dashboard',        href: '/dashboard',                soon: false },
  { icon: '🔍', label: 'Procurar Workers',  href: '/dashboard/workers-search', soon: false },
  { icon: '👷', label: 'Trabalhadores',     href: '/dashboard/workers',        soon: false },
  { icon: '📋', label: 'Turnos',            href: '/dashboard/shifts',         soon: false },
  { icon: '📲', label: 'QR Check-in',       href: '/dashboard/qr-codes',       soon: false },
  { icon: '📊', label: 'Conformidade',      href: '/dashboard/compliance',     soon: false },
  { icon: '💶', label: 'Gastos',            href: '/dashboard/spending',       soon: false },
  { icon: '💳', label: 'Faturação',         href: '/dashboard/billing',        soon: false },
  { icon: '⚙️', label: 'Definições',       href: null,                        soon: true  },
] as const;

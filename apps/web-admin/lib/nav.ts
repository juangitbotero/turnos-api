// Worker-search-first: finding and inviting the right worker is the core value
// of the subscription, so Trabalhadores/Procurar sit right under Dashboard.
//
// `key` indexes `admin.nav.*` in the shared catalogue — render it with
// t(`admin.nav.${key}`), never a hardcoded label.
export const SIDEBAR_NAV = [
  { icon: '🏠', key: 'dashboard',     href: '/dashboard',                soon: false },
  { icon: '🔍', key: 'workersSearch', href: '/dashboard/workers-search', soon: false },
  { icon: '👷', key: 'workers',       href: '/dashboard/workers',        soon: false },
  { icon: '📋', key: 'shifts',        href: '/dashboard/shifts',         soon: false },
  { icon: '📲', key: 'qrCheckIn',     href: '/dashboard/qr-codes',       soon: false },
  { icon: '📊', key: 'compliance',    href: '/dashboard/compliance',     soon: false },
  { icon: '💶', key: 'spending',      href: '/dashboard/spending',       soon: false },
  { icon: '💳', key: 'billing',       href: '/dashboard/billing',        soon: false },
  { icon: '⚙️', key: 'settings',      href: null,                        soon: true  },
] as const;

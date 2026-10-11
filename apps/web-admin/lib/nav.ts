import {
  IconHome, IconSearch, IconUsers, IconClipboard, IconQr,
  IconEuro, IconSettings, IconFile, IconUserCheck,
} from '../components/icons';

// Two groups, rendered by DashboardShell — the only sidebar in the dashboard.
// Operational is the daily loop (post → candidates → find → rehire); Admin is
// the paperwork around it. "Candidatos" carries a live badge (DashboardShell).
//
// `key` indexes `admin.nav.*` in the shared catalogue — render it with
// t(`admin.nav.${key}`), never a hardcoded label.
//
// `Icon` is a component, not an emoji: the sidebar is the most-seen surface in
// the product and mixed emoji were the loudest thing making it look unlike the
// mobile app. All icons inherit currentColor at one stroke weight.
//
// `also` lists other routes that light up the same entry: pages folded into a
// tab of this one keep their old URL working (emails link to /dashboard/ratings).
//
// "Contratações" opens /dashboard/compliance on its hires tab — the company
// registers the work itself and that page holds the data to do so (Turnos no
// longer emails its accountant since 2026-10-05). Labelled for what it holds,
// not as compliance Turnos performs.
//
// "A minha subscrição" is a tab of Definições, reached from the company menu at
// the bottom of the sidebar — not a top-level entry.
export interface NavItem {
  Icon: (p: { size?: number }) => React.ReactElement;
  key: string;
  href: string;
  also?: readonly string[];
}

export const SIDEBAR_GROUPS: readonly { key: 'groupOperational' | 'groupAdmin'; items: readonly NavItem[] }[] = [
  {
    key: 'groupOperational',
    items: [
      { Icon: IconHome,      key: 'dashboard',     href: '/dashboard' },
      { Icon: IconClipboard, key: 'shifts',        href: '/dashboard/shifts', also: ['/dashboard/new-shift'] },
      { Icon: IconUserCheck, key: 'candidates',    href: '/dashboard/candidates' },
      { Icon: IconSearch,    key: 'workersSearch', href: '/dashboard/workers-search' },
      { Icon: IconUsers,     key: 'workers',       href: '/dashboard/workers', also: ['/dashboard/ratings'] },
    ],
  },
  {
    key: 'groupAdmin',
    items: [
      { Icon: IconFile,      key: 'hires',     href: '/dashboard/compliance?tab=mcd', also: ['/dashboard/compliance'] },
      { Icon: IconQr,        key: 'qrCheckIn', href: '/dashboard/qr-codes' },
      { Icon: IconEuro,      key: 'spending',  href: '/dashboard/spending' },
      { Icon: IconSettings,  key: 'settings',  href: '/dashboard/settings', also: ['/dashboard/billing'] },
    ],
  },
];

/** Whether `pathname` belongs to a nav entry. Home matches only itself. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  const routes = [item.href.split('?')[0]!, ...(item.also ?? [])];
  return routes.some(r =>
    r === '/dashboard' ? pathname === r : pathname === r || pathname.startsWith(`${r}/`),
  );
}

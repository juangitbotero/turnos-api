import {
  IconHome, IconSearch, IconUsers, IconClipboard, IconQr,
  IconEuro, IconCard, IconSettings,
} from '../components/icons';

// Worker-search-first: finding and inviting the right worker is the core value
// of the subscription, so the two worker entries sit right under Dashboard.
//
// `key` indexes `admin.nav.*` in the shared catalogue — render it with
// t(`admin.nav.${key}`), never a hardcoded label.
//
// `Icon` is a component, not an emoji: the sidebar is the most-seen surface in
// the product and mixed emoji were the loudest thing making it look unlike the
// mobile app. All icons inherit currentColor at one stroke weight.
//
// NOTE: the Compliance entry was removed — the company is the legal employer
// and registers the work itself. The route and its data still exist at
// /dashboard/compliance (MCD contracts, TSU report, ACT audit trail); only the
// link is gone. Delete the page too if you decide that data belongs elsewhere.
export const SIDEBAR_NAV = [
  { Icon: IconHome,      key: 'dashboard',     href: '/dashboard',                soon: false },
  { Icon: IconSearch,    key: 'workersSearch', href: '/dashboard/workers-search', soon: false },
  { Icon: IconUsers,     key: 'workers',       href: '/dashboard/workers',        soon: false },
  { Icon: IconClipboard, key: 'shifts',        href: '/dashboard/shifts',         soon: false },
  { Icon: IconQr,        key: 'qrCheckIn',     href: '/dashboard/qr-codes',       soon: false },
  { Icon: IconEuro,      key: 'spending',      href: '/dashboard/spending',       soon: false },
  { Icon: IconCard,      key: 'billing',       href: '/dashboard/billing',        soon: false },
  { Icon: IconSettings,  key: 'settings',      href: '/dashboard/settings',       soon: false },
] as const;

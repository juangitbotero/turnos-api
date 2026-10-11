import { redirect } from 'next/navigation';

// The subscription moved into Definições on 2026-10-11 (tab "A minha
// subscrição"). Kept as a redirect so old links and bookmarks still land.
export default function BillingRedirect() {
  redirect('/dashboard/settings?tab=subscription');
}

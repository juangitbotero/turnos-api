import { redirect } from 'next/navigation';

// Reputação became the Reviews tab of "Quem já trabalhou" on 2026-10-11.
// Kept as a redirect: rate-the-worker emails already sent link here.
export default function RatingsRedirect() {
  redirect('/dashboard/workers?tab=reviews');
}

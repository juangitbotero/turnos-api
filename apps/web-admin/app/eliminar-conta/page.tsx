'use client';

import { LegalDocPage } from '../../components/LegalDocPage';
import { DELETION } from './content';

/**
 * Account deletion — the web link Google Play requires (Data safety). The URL
 * goes into Play Console, so keep it stable.
 */
export default function DeleteAccountPage() {
  return <LegalDocPage docs={DELETION} />;
}

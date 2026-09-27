'use client';

import { LegalDocPage } from '../../components/LegalDocPage';
import { COMPANY_TERMS } from './content';

/** Terms of Use for companies — accepted at registration and in the dashboard. */
export default function CompanyTermsPage() {
  return <LegalDocPage docs={COMPANY_TERMS} />;
}

'use client';

import { LegalDocPage } from '../../components/LegalDocPage';
import { WORKER_TERMS } from './content';

/** Terms of Use for workers — linked from the mobile app's acceptance screen. */
export default function WorkerTermsPage() {
  return <LegalDocPage docs={WORKER_TERMS} />;
}

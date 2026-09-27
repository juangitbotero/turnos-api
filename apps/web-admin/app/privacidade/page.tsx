'use client';

import { LegalDocPage } from '../../components/LegalDocPage';
import { POLICY } from './content';

/**
 * Privacy policy — public, and required before either app store will accept a
 * submission. The URL is stable on purpose: it goes into App Store Connect and
 * Play Console, and changing it later means editing both listings.
 *
 * ⚠️ This is a good-faith draft written from the actual data flows in the
 * codebase. It has NOT been reviewed by a lawyer, and the controller identity
 * block still has placeholders. See docs/pre-flight.md.
 */
export default function PrivacyPolicyPage() {
  return <LegalDocPage docs={POLICY} />;
}

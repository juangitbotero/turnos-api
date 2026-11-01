import * as crypto from 'crypto';

/**
 * App Store / Google Play reviewers must be able to sign in, and they cannot
 * receive our SMS. Both stores ask for a demo account in the submission; for a
 * phone-OTP app that means one known number with a fixed code.
 *
 * This is NOT the dev mock (`123456` for any number). It accepts exactly one
 * number, with a code chosen in Railway, and only while both variables are set:
 *
 *   REVIEW_PHONE     the number exactly as the app sends it (E.164, e.g. +351910000000)
 *   REVIEW_OTP_CODE  6–8 digits, not 123456
 *
 * Unset either variable and it is gone. It is independent of Twilio and of the
 * mock gate on branch `otp-prod-gate`, so it survives that merge. The account
 * it signs into is a normal worker account — keep it free of real data, and
 * unset the variables once the apps are approved if no review is pending.
 */
export interface ReviewLogin {
  phone: string;
  code: string;
}

export function readReviewLogin(get: (key: string) => string | undefined): ReviewLogin | null {
  const phone = (get('REVIEW_PHONE') ?? '').trim();
  const code  = (get('REVIEW_OTP_CODE') ?? '').trim();
  if (!/^\+\d{8,15}$/.test(phone)) return null;
  if (!/^\d{6,8}$/.test(code) || code === '123456') return null;
  return { phone, code };
}

export function isReviewPhone(review: ReviewLogin | null, phone: string): boolean {
  return !!review && phone === review.phone;
}

export function isReviewLogin(review: ReviewLogin | null, phone: string, code: string): boolean {
  if (!isReviewPhone(review, phone)) return false;
  const a = Buffer.from(code);
  const b = Buffer.from(review!.code);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

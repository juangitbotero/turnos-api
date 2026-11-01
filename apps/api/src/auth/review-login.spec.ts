import { readReviewLogin, isReviewPhone, isReviewLogin } from './review-login';

describe('store-reviewer sign-in', () => {
  const env = (vars: Record<string, string>) => (k: string) => vars[k];
  const review = readReviewLogin(env({ REVIEW_PHONE: '+351910000000', REVIEW_OTP_CODE: '482915' }));

  it('is off unless both variables are set and well-formed', () => {
    expect(readReviewLogin(env({}))).toBeNull();
    expect(readReviewLogin(env({ REVIEW_PHONE: '+351910000000' }))).toBeNull();
    expect(readReviewLogin(env({ REVIEW_OTP_CODE: '482915' }))).toBeNull();
    expect(readReviewLogin(env({ REVIEW_PHONE: '910000000', REVIEW_OTP_CODE: '482915' }))).toBeNull();
    expect(readReviewLogin(env({ REVIEW_PHONE: '+351910000000', REVIEW_OTP_CODE: '12ab56' }))).toBeNull();
  });

  it('refuses the dev mock code as the review code', () => {
    expect(readReviewLogin(env({ REVIEW_PHONE: '+351910000000', REVIEW_OTP_CODE: '123456' }))).toBeNull();
  });

  it('accepts only the configured number with the configured code', () => {
    expect(isReviewLogin(review, '+351910000000', '482915')).toBe(true);
    expect(isReviewLogin(review, '+351910000000', '482916')).toBe(false);
    expect(isReviewLogin(review, '+351910000000', '4829150')).toBe(false);
    expect(isReviewLogin(review, '+351910000001', '482915')).toBe(false);
    expect(isReviewPhone(review, '+351910000001')).toBe(false);
    expect(isReviewLogin(null, '+351910000000', '482915')).toBe(false);
  });
});

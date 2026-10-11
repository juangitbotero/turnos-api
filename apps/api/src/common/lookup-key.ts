/**
 * TypeORM silently drops a `where` condition whose value is `undefined` (and
 * `null`): `findOne({ where: { email: undefined } })` becomes
 * `findOne({ where: {} })` and returns the FIRST row of the table.
 *
 * That turned a missing request field into "signed in as whoever is first in
 * `users`" (found 2026-10-11: an empty POST /auth/verify-otp with the mock OTP
 * live), and earlier into every ratings endpoint acting on an arbitrary
 * company (2026-10-05). Lookups keyed on something a client can omit must
 * check it with this first and fail closed.
 */
export function isLookupKey(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Which browser origins may call this API.
 *
 * Replaces `origin: '*'`, which was correct during beta (the mobile app has no
 * browser origin) and wrong the moment real sessions exist.
 *
 * The rule that matters: **a request with no `Origin` header is allowed.**
 * React Native's fetch sends none, and neither do Stripe's webhooks or curl.
 * CORS is a browser mechanism — it protects a user's browser session from a
 * hostile page, and it is not, and never was, the thing authenticating these
 * callers. That is the JWT. Rejecting origin-less requests would break the
 * mobile app and the webhooks while adding no security.
 *
 * Deliberately NOT keyed off NODE_ENV: the Railway variable is currently the
 * literal string "=production" (note the stray `=`), so every
 * `NODE_ENV === 'production'` check in this codebase is false. Anything gated
 * that way is silently running in its development branch.
 */

/** Trailing slashes never appear in a browser's Origin header — strip them. */
function normalise(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * The deployed dashboard, hardcoded on purpose. If `WEB_ADMIN_URL` is ever
 * unset, renamed or given a typo in Railway, an allowlist built only from it
 * would lock the production dashboard out of its own API — a self-inflicted
 * outage caused by the very change meant to harden things. Belt and braces.
 */
const KNOWN_WEB_ADMIN = 'https://turnos-admin-production.up.railway.app';

export function allowedOrigins(): string[] {
  const configured = [
    process.env['WEB_ADMIN_URL'],
    KNOWN_WEB_ADMIN,
    // Local development for the dashboard and the landing pages.
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  // CORS_EXTRA_ORIGINS: comma-separated, for preview deploys or a custom
  // domain, without needing a code change to add one.
  const extra = (process.env['CORS_EXTRA_ORIGINS'] ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return [...new Set([...configured, ...extra].filter(Boolean).map(o => normalise(o!)))];
}

/**
 * `cors` origin callback. Signature matches what both Express's cors
 * middleware and Socket.IO expect.
 */
export function corsOriginCheck(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  // No Origin header — mobile app, server-to-server, curl. See above.
  if (!origin) return callback(null, true);
  if (allowedOrigins().includes(normalise(origin))) return callback(null, true);
  callback(new Error(`Origin not allowed by CORS: ${origin}`));
}

/**
 * Public web pages the app links to. The legal documents live on the
 * web-admin host so there is exactly one copy of each — the app never ships
 * its own text of the terms or the privacy policy.
 * Override the host with EXPO_PUBLIC_WEB_URL when it moves.
 */
export const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL ?? 'https://turnos-admin-production.up.railway.app';

export const TERMS_URL   = `${WEB_URL}/termos`;
export const PRIVACY_URL = `${WEB_URL}/privacidade`;

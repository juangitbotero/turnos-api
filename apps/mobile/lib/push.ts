import * as Notifications from 'expo-notifications';
import { authApi } from './api';

/**
 * Register this device's Expo push token with the API (best-effort).
 *
 * Called at sign-in (`ask: true` — may show the OS permission prompt) and on
 * every launch of a signed-in worker (`ask: false` — never prompts, only
 * refreshes the token if permission was already given). Until 2026-11-01 it
 * ran only at sign-in, so a worker who stayed signed in never re-registered —
 * which matters now: Android builds without Firebase (FCM) config could not
 * get a token at all, and those workers need to pick one up after an update
 * without signing out.
 */
export async function registerPushToken({ ask }: { ask: boolean }): Promise<void> {
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    await authApi.registerPushToken(tokenData.data);
  } catch (err) {
    // Non-fatal, but say why — on Android a missing google-services.json
    // fails here, and a silent catch hid that for months.
    console.warn('[push] Could not register for push notifications:', (err as Error)?.message);
  }
}

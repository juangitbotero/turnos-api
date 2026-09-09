import * as SecureStore from 'expo-secure-store';

const KEY_ACCESS  = 'turnos_access_token';
const KEY_REFRESH = 'turnos_refresh_token';
const KEY_USER_ID = 'turnos_user_id';
const KEY_ROLE    = 'turnos_user_role';
const KEY_INTRO_SEEN = 'turnos_intro_seen';

export const tokenStorage = {
  getAccessToken:  () => SecureStore.getItemAsync(KEY_ACCESS),
  setAccessToken:  (v: string) => SecureStore.setItemAsync(KEY_ACCESS, v),
  getRefreshToken: () => SecureStore.getItemAsync(KEY_REFRESH),
  setRefreshToken: (v: string) => SecureStore.setItemAsync(KEY_REFRESH, v),
  getUserId:       () => SecureStore.getItemAsync(KEY_USER_ID),
  setUserId:       (v: string) => SecureStore.setItemAsync(KEY_USER_ID, v),
  getRole:         () => SecureStore.getItemAsync(KEY_ROLE),
  setRole:         (v: string) => SecureStore.setItemAsync(KEY_ROLE, v),

  saveSession: async (accessToken: string, refreshToken: string) => {
    const payload = JSON.parse(atob(accessToken.split('.')[1]!)) as {
      sub: string; role: string;
    };
    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS,  accessToken),
      SecureStore.setItemAsync(KEY_REFRESH, refreshToken),
      SecureStore.setItemAsync(KEY_USER_ID, payload.sub),
      SecureStore.setItemAsync(KEY_ROLE,    payload.role),
    ]);
  },

  clear: () => Promise.all([
    SecureStore.deleteItemAsync(KEY_ACCESS),
    SecureStore.deleteItemAsync(KEY_REFRESH),
    SecureStore.deleteItemAsync(KEY_USER_ID),
    SecureStore.deleteItemAsync(KEY_ROLE),
  ]),

  /**
   * Deliberately NOT cleared by `clear()`. Signing out is not a reason to
   * replay the introduction — it is a property of this install, not of the
   * session. Reinstalling shows it again, which is correct.
   */
  hasSeenIntro: async (): Promise<boolean> => {
    try {
      return (await SecureStore.getItemAsync(KEY_INTRO_SEEN)) === '1';
    } catch {
      // A read failure must not trap the user on the intro — treat it as seen.
      return true;
    }
  },
  markIntroSeen: async (): Promise<void> => {
    try {
      await SecureStore.setItemAsync(KEY_INTRO_SEEN, '1');
    } catch {
      // Non-fatal: worst case the intro shows once more.
    }
  },

  isTokenExpired: (token: string): boolean => {
    try {
      const { exp } = JSON.parse(atob(token.split('.')[1]!)) as { exp: number };
      return Date.now() / 1000 > exp - 30;
    } catch {
      return true;
    }
  },
};

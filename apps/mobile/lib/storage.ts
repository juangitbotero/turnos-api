import * as SecureStore from 'expo-secure-store';

const KEY_ACCESS  = 'turnos_access_token';
const KEY_REFRESH = 'turnos_refresh_token';
const KEY_USER_ID = 'turnos_user_id';
const KEY_ROLE    = 'turnos_user_role';

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

  isTokenExpired: (token: string): boolean => {
    try {
      const { exp } = JSON.parse(atob(token.split('.')[1]!)) as { exp: number };
      return Date.now() / 1000 > exp - 30;
    } catch {
      return true;
    }
  },
};

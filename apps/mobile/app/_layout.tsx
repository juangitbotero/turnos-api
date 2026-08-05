import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { tokenStorage } from '../lib/storage';
import { initI18n, LanguageProvider } from '../lib/i18n';
import { colors, AppLanguage, DEFAULT_LANGUAGE } from '@turnos/shared';

// Show notification banners while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  // Resolved before the tree renders, so no screen ever flashes the wrong
  // language while the stored choice is read from SecureStore.
  const [language, setLanguage] = useState<AppLanguage | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initI18n().then(setLanguage).catch(() => setLanguage(DEFAULT_LANGUAGE));
  }, []);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  // Register foreground notification listeners once on mount
  useEffect(() => {
    // Foreground: banner is shown by setNotificationHandler above.
    // This listener lets us react programmatically if needed.
    notificationListener.current = Notifications.addNotificationReceivedListener(_notification => {
      // No-op for now — banner + sound handled by setNotificationHandler
    });

    // User tapped a notification — navigate to the relevant screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as {
        shiftId?:    string;
        type?:       string;
        shiftTitle?: string;
        shiftDate?:  string;
        grossAmount?: number;
      };

      if (data?.type === 'recibo_verde' && data?.shiftId) {
        // Deep-link to Recibo Verde screen with pre-filled values
        router.push({
          pathname: '/recibo-verde',
          params: {
            shiftId:     data.shiftId,
            shiftTitle:  data.shiftTitle  ?? '',
            shiftDate:   data.shiftDate   ?? '',
            grossAmount: String(data.grossAmount ?? 0),
          },
        } as any);
      } else if (data?.type === 'rate_employer' && data?.shiftId) {
        // Review prompt (at completion + the +8h follow-up) → rating screen
        router.push(`/rate/${data.shiftId}` as any);
      } else if (data?.type === 'wage_paid' || data?.type === 'wage_marked_paid' || data?.type === 'wage_adjusted') {
        // Payment updates → my-shifts, where the wage status chips live
        router.push('/my-shifts' as any);
      } else if (data?.shiftId) {
        router.push(`/shift/${data.shiftId}` as any);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  const checkAuth = async () => {
    try {
      const token = await tokenStorage.getAccessToken();
      const inAuthGroup = segments[0] === 'login' || segments[0] === 'verify' || segments[0] === 'onboarding';

      if (!token) {
        // No token — send to login (only redirect if not already there)
        if (!inAuthGroup) {
          router.replace('/login');
        }
      } else if (tokenStorage.isTokenExpired(token)) {
        // Expired — try refresh, handled in api.ts on next request
        // Just let the user through; api.ts will refresh silently
      }
    } catch {
      router.replace('/login');
    } finally {
      setIsReady(true);
    }
  };

  if (!isReady || !language) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <LanguageProvider initialLanguage={language}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#fafdff' },
          animation: 'slide_from_right',
        }}
      />
    </LanguageProvider>
  );
}

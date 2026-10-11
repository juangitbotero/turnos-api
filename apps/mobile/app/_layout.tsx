import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { tokenStorage } from '../lib/storage';
import { authApi, syncPreferredLanguage } from '../lib/api';
import { notificationRoute } from '../lib/notificationRoute';
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
        shiftId?: string;
        type?:    string;
      };

      // Same table as the inbox screen — see lib/notificationRoute.ts
      const route = notificationRoute(data);
      if (route) router.push(route as any);
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
      } else {
        // Expired tokens are refreshed silently by api.ts on this request.
        // Signed in but the accepted Terms version is missing or outdated →
        // the acceptance screen, before anything else. Fails open on network
        // errors; verify.tsx and the next launch check again.
        authApi.getMe()
          .then(me => {
            syncPreferredLanguage(me);
            if (me.termsCurrent === false) router.replace('/terms' as any);
          })
          .catch(() => {});
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

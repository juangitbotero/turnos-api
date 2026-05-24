import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { tokenStorage } from '../lib/storage';
import { colors } from '@turnos/shared';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkAuth();
  }, []);

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

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#fafdff' },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}

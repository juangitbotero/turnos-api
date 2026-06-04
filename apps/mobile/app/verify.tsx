import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';
import { authApi, ApiError } from '../lib/api';
import { tokenStorage } from '../lib/storage';
import { connectSocket } from '../lib/socket';

/**
 * Register Expo push token with the backend (best-effort, non-blocking).
 * Silently no-ops on permission denial or any error.
 */
async function registerPushToken(): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    await authApi.registerPushToken(tokenData.data);
  } catch {
    // Non-fatal — push notifications degrade gracefully
  }
}

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [shakeAnim] = useState(new Animated.Value(0));

  const inputRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Auto-submit when all digits filled
  useEffect(() => {
    if (digits.every(d => d !== '') && !isLoading) {
      handleVerify(digits.join(''));
    }
  }, [digits]);

  const handleDigitChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setHasError(false);

    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleVerify = async (code: string) => {
    setIsLoading(true);
    try {
      const { accessToken, refreshToken, isNewUser } = await authApi.verifyOtp(phone!, code);
      await tokenStorage.saveSession(accessToken, refreshToken);

      // Connect WebSocket with JWT so the worker joins their private room
      connectSocket(accessToken);

      // Register Expo push token (non-blocking — runs in background)
      registerPushToken();

      // Always go to home — new workers browse first, profile gate triggers on apply
      router.replace('/');
      void isNewUser; // kept for future analytics
    } catch (err) {
      setHasError(true);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      shake();
      const msg = err instanceof ApiError && err.status === 401
        ? 'Código inválido. Tente novamente.'
        : 'Erro ao verificar o código. Tente novamente.';
      Alert.alert('Erro', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setCountdown(RESEND_SECONDS);
    setDigits(Array(OTP_LENGTH).fill(''));
    setHasError(false);
    inputRefs.current[0]?.focus();
    try {
      await authApi.sendOtp(phone!);
    } catch {
      Alert.alert('Erro', 'Não foi possível reenviar o código.');
    }
  };

  const maskedPhone = phone
    ? phone.slice(0, -4).replace(/./g, '•') + phone.slice(-4)
    : '';

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Gradient header */}
      <LinearGradient
        colors={['#6a79ff', '#9b6dff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerLogo}>turnos</Text>
      </LinearGradient>

      {/* Sheet */}
      <View style={s.sheet}>
        <View style={s.sheetHandle} />

        <Text style={s.title}>Verifique o seu número</Text>
        <Text style={s.sub}>
          Enviámos um código de 6 dígitos para{'\n'}
          <Text style={s.phoneMask}>{maskedPhone}</Text>
        </Text>

        {/* OTP boxes */}
        <Animated.View style={[s.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={ref => { inputRefs.current[i] = ref; }}
              style={[
                s.otpBox,
                digit ? s.otpBoxFilled : {},
                hasError ? s.otpBoxError : {},
                i === digits.findIndex(d => d === '') && !hasError ? s.otpBoxFocused : {},
              ]}
              value={digit}
              onChangeText={val => handleDigitChange(i, val)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              autoFocus={i === 0}
            />
          ))}
        </Animated.View>

        {/* Error hint */}
        {hasError && (
          <Text style={s.errorText}>Código inválido. Tente novamente.</Text>
        )}

        {/* Loading / verify manually */}
        {isLoading ? (
          <View style={s.loadingRow}>
            <Text style={s.loadingText}>A verificar...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.verifyBtn, !digits.every(d => d) && s.verifyBtnDisabled]}
            onPress={() => handleVerify(digits.join(''))}
            disabled={!digits.every(d => d)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={digits.every(d => d) ? ['#6a79ff', '#9b6dff'] : ['#d9d9d9', '#d9d9d9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.verifyBtnGradient}
            >
              <Text style={[s.verifyBtnText, !digits.every(d => d) && s.verifyBtnTextDisabled]}>
                Verificar Código
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Resend */}
        <View style={s.resendRow}>
          <Text style={s.resendLabel}>Não recebeu o código?</Text>
          <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
            <Text style={[s.resendBtn, countdown > 0 && s.resendBtnDisabled]}>
              {countdown > 0 ? `Reenviar em ${countdown}s` : 'Reenviar código'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dev hint — only shown in development */}
        {__DEV__ && (
          <View style={s.devHint}>
            <Text style={s.devHintText}>🧪 Dev: use o código 123456</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#6a79ff',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 28,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 18, color: '#fff', fontWeight: fontWeight.bold },
  headerLogo: {
    fontSize: 18,
    fontWeight: fontWeight.extrabold,
    color: '#fff',
    letterSpacing: -0.5,
  },

  sheet: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: spacing.xl,
    paddingTop: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: fontSize.h1,
    fontWeight: fontWeight.extrabold,
    color: colors.textPrimary,
    letterSpacing: -1,
    marginBottom: 10,
  },
  sub: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 36,
  },
  phoneMask: {
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },

  /* OTP */
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  otpBox: {
    flex: 1,
    height: 60,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.neutral,
    borderRadius: radius.sm,
    textAlign: 'center',
    fontSize: fontSize.h2,
    fontWeight: fontWeight.extrabold,
    color: colors.textPrimary,
  },
  otpBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  otpBoxFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  otpBoxError: {
    borderColor: colors.error,
    backgroundColor: '#fee2e2',
  },
  errorText: {
    fontSize: fontSize.caption,
    color: colors.error,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },

  /* Verify button */
  verifyBtn: {
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  verifyBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyBtnGradient: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: '#fff',
  },
  verifyBtnTextDisabled: {
    color: colors.textSecondary,
  },

  /* Loading */
  loadingRow: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  loadingText: {
    fontSize: fontSize.body,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },

  /* Resend */
  resendRow: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  resendLabel: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
  },
  resendBtn: {
    fontSize: fontSize.body,
    color: colors.primary,
    fontWeight: fontWeight.bold,
    padding: spacing.sm,
  },
  resendBtnDisabled: {
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },

  /* Dev hint */
  devHint: {
    marginTop: spacing.xl,
    padding: spacing.sm,
    backgroundColor: '#fef9c3',
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  devHintText: {
    fontSize: fontSize.caption,
    color: '#92400e',
    fontWeight: fontWeight.semibold,
  },
});

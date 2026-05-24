import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session/providers/google';
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';
import { authApi, ApiError } from '../lib/api';
import { tokenStorage } from '../lib/storage';

WebBrowser.maybeCompleteAuthSession();

const COUNTRY_CODES = [
  { code: '+351', flag: '🇵🇹', label: 'PT' },
  { code: '+34',  flag: '🇪🇸', label: 'ES' },
  { code: '+44',  flag: '🇬🇧', label: 'GB' },
  { code: '+33',  flag: '🇫🇷', label: 'FR' },
] as const;

type CountryCode = { code: string; flag: string; label: string };

export default function LoginScreen() {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const [_request, response, promptAsync] = AuthSession.useAuthRequest({
    clientId: googleClientId ?? '',
    scopes: ['openid', 'profile', 'email'],
  });

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) {
      Alert.alert('Número inválido', 'Por favor introduza um número de telemóvel válido.');
      return;
    }
    setIsLoading(true);
    try {
      const fullPhone = `${selectedCountry.code}${digits}`;
      await authApi.sendOtp(fullPhone);
      router.push({ pathname: '/verify', params: { phone: fullPhone } });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Não foi possível enviar o código.';
      Alert.alert('Erro', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!googleClientId) return;
    setIsLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== 'success') return;
      const googleToken = result.authentication?.accessToken;
      if (!googleToken) throw new Error('No access token from Google');
      const { accessToken, refreshToken, isNewUser } = await authApi.googleVerifyToken(googleToken, 'WORKER');
      await tokenStorage.saveSession(accessToken, refreshToken);
      router.replace(isNewUser ? '/onboarding' : '/');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login com Google falhou.';
      Alert.alert('Erro', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const googleEnabled = !!googleClientId;

  const isValid = phone.replace(/\D/g, '').length >= 7;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Background gradient */}
      <LinearGradient
        colors={['#6a79ff', '#9b6dff', '#c084fc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.gradientBg}
      />

      {/* Top brand area */}
      <View style={s.brandArea}>
        <View style={s.logoWrap}>
          <Text style={s.logoText}>turnos</Text>
          <View style={s.logoDot} />
        </View>
        <Text style={s.tagline}>Work Today. Staff Today.</Text>
      </View>

      {/* Bottom sheet */}
      <View style={s.sheet}>
        <View style={s.sheetHandle} />

        <Text style={s.sheetTitle}>Entrar ou criar conta</Text>
        <Text style={s.sheetSub}>
          Introduza o seu número de telemóvel. Vamos enviar-lhe um código.
        </Text>

        {/* Phone input */}
        <View style={s.phoneRow}>
          {/* Country picker */}
          <TouchableOpacity
            style={s.countryBtn}
            onPress={() => setShowCountryPicker(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={s.countryFlag}>{selectedCountry.flag}</Text>
            <Text style={s.countryCode}>{selectedCountry.code}</Text>
            <Text style={s.countryChevron}>▾</Text>
          </TouchableOpacity>

          <TextInput
            style={s.phoneInput}
            placeholder="912 345 678"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSendOtp}
          />
        </View>

        {/* Country dropdown */}
        {showCountryPicker && (
          <View style={s.dropdown}>
            {COUNTRY_CODES.map(c => (
              <TouchableOpacity
                key={c.code}
                style={[s.dropdownItem, selectedCountry.code === c.code && s.dropdownItemActive]}
                onPress={() => { setSelectedCountry(c); setShowCountryPicker(false); }}
              >
                <Text style={s.countryFlag}>{c.flag}</Text>
                <Text style={s.dropdownLabel}>{c.label}</Text>
                <Text style={s.dropdownCode}>{c.code}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Continue button */}
        <TouchableOpacity
          style={[s.continueBtn, !isValid && s.continueBtnDisabled]}
          onPress={handleSendOtp}
          disabled={!isValid || isLoading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isValid ? ['#6a79ff', '#9b6dff'] : ['#d9d9d9', '#d9d9d9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.continueBtnGradient}
          >
            <Text style={[s.continueBtnText, !isValid && s.continueBtnTextDisabled]}>
              {isLoading ? 'A enviar...' : 'Continuar →'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>ou</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Google SSO */}
        <Pressable
          style={[s.googleBtn, !googleEnabled && { opacity: 0.5 }]}
          onPress={handleGoogleLogin}
          disabled={!googleEnabled || isLoading}
        >
          <Text style={s.googleIcon}>G</Text>
          <Text style={s.googleText}>Continuar com Google</Text>
          {!googleEnabled && (
            <View style={s.soonBadge}>
              <Text style={s.soonText}>Em breve</Text>
            </View>
          )}
        </Pressable>

        {/* Legal */}
        <Text style={s.legal}>
          Ao continuar, aceita os{' '}
          <Text style={s.legalLink}>Termos de Serviço</Text>
          {' '}e a{' '}
          <Text style={s.legalLink}>Política de Privacidade</Text>
          {' '}da Turnos.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#6a79ff',
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
  },

  /* Brand area */
  brandArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoText: {
    fontSize: 42,
    fontWeight: fontWeight.extrabold,
    color: '#fff',
    letterSpacing: -2,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    opacity: 0.8,
    marginBottom: 4,
  },
  tagline: {
    fontSize: fontSize.body,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  },

  /* Bottom sheet */
  sheet: {
    backgroundColor: colors.secondary,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: spacing.xl,
    paddingTop: 16,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  sheetTitle: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.extrabold,
    color: colors.textPrimary,
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  sheetSub: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },

  /* Phone input row */
  phoneRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.neutral,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 54,
    minWidth: 86,
  },
  countryFlag: { fontSize: 20 },
  countryCode: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  countryChevron: {
    fontSize: 10,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  phoneInput: {
    flex: 1,
    height: 54,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.neutral,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.h3,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },

  /* Dropdown */
  dropdown: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral,
    marginBottom: spacing.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral,
  },
  dropdownItemActive: {
    backgroundColor: colors.primaryLight,
  },
  dropdownLabel: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  dropdownCode: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },

  /* Continue button */
  continueBtn: {
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  continueBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnGradient: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    fontSize: fontSize.h3,
    fontWeight: fontWeight.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  continueBtnTextDisabled: {
    color: colors.textSecondary,
  },

  /* Divider */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral,
  },
  dividerText: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },

  /* Google btn */
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.neutral,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
    opacity: 0.6,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: fontWeight.extrabold,
    color: '#4285F4',
  },
  googleText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  soonBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    position: 'absolute',
    right: 16,
  },
  soonText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  /* Legal */
  legal: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
});

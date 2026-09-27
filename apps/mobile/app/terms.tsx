/**
 * /terms — Terms of Use acceptance.
 *
 * Shown after sign-in to every worker whose recorded acceptance is missing or
 * older than TERMS_VERSIONS.WORKER (see verify.tsx and _layout.tsx). The full
 * text lives on the web (/termos, /privacidade) so there is one copy of each;
 * this screen summarises the three points that matter most and records the
 * acceptance, with its version and date, server-side.
 *
 * There is no way past it except accepting or signing out — that is the point.
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, fontSize, fontWeight, TERMS_VERSIONS } from '@turnos/shared';
import { authApi } from '../lib/api';
import { tokenStorage } from '../lib/storage';
import { disconnectSocket } from '../lib/socket';
import { TERMS_URL, PRIVACY_URL } from '../lib/links';
import { useT } from '../lib/i18n';

export default function TermsScreen() {
  const router = useRouter();
  const { t } = useT();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const accept = async () => {
    setSaving(true);
    try {
      await authApi.acceptTerms(TERMS_VERSIONS.WORKER);
      const seenIntro = await tokenStorage.hasSeenIntro();
      router.replace((seenIntro ? '/' : '/intro') as any);
    } catch {
      Alert.alert(t('common.error'), t('mobile.terms.failed'));
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    disconnectSocket();
    await tokenStorage.clear();
    router.replace('/login');
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={['#6a79ff', '#9b6dff']} style={s.header}>
        <Text style={s.headerTitle}>{t('mobile.terms.title')}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.intro}>{t('mobile.terms.intro')}</Text>

        {(['p1', 'p2', 'p3'] as const).map(k => (
          <View key={k} style={s.point}>
            <Text style={s.pointDot}>•</Text>
            <Text style={s.pointText}>{t(`mobile.terms.points.${k}`)}</Text>
          </View>
        ))}

        <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)} activeOpacity={0.7}>
          <Text style={s.link}>{t('mobile.terms.readTerms')} ↗</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} activeOpacity={0.7}>
          <Text style={s.link}>{t('mobile.terms.readPrivacy')} ↗</Text>
        </TouchableOpacity>

        {/* Unticked by default — acceptance has to be an act */}
        <TouchableOpacity style={s.checkRow} onPress={() => setChecked(v => !v)} activeOpacity={0.7}>
          <View style={[s.checkbox, checked && s.checkboxOn]}>
            {checked && <Text style={s.tick}>✓</Text>}
          </View>
          <Text style={s.checkText}>{t('mobile.terms.checkbox')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.btn, (!checked || saving) && s.btnDisabled]}
          onPress={accept}
          disabled={!checked || saving}
          activeOpacity={0.85}
        >
          <Text style={s.btnText}>{saving ? t('mobile.terms.saving') : t('mobile.terms.accept')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={signOut} style={s.logout} activeOpacity={0.7}>
          <Text style={s.logoutText}>{t('mobile.terms.logout')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.secondary },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingBottom: 18, paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  headerTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.extrabold, color: '#fff' },
  scroll: { padding: spacing.xl, gap: spacing.md },
  intro: { fontSize: fontSize.body, color: colors.textPrimary, lineHeight: 23 },
  point: { flexDirection: 'row', gap: 10 },
  pointDot: { fontSize: fontSize.body, color: colors.primary, fontWeight: fontWeight.bold as any },
  pointText: { flex: 1, fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
  link: { fontSize: fontSize.body, color: colors.primary, fontWeight: fontWeight.bold as any, paddingVertical: 4 },
  checkRow: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: spacing.sm,
    padding: 14, borderRadius: radius.sm, backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: '#d7dcff',
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  checkboxOn: { backgroundColor: colors.primary },
  tick: { color: '#fff', fontSize: 14, fontWeight: fontWeight.bold as any, lineHeight: 17 },
  checkText: { flex: 1, fontSize: fontSize.body, color: colors.textPrimary, lineHeight: 21 },
  footer: {
    padding: spacing.md, paddingBottom: Platform.OS === 'ios' ? 36 : spacing.md,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral,
  },
  btn: {
    height: 54, borderRadius: radius.full, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: '#fff' },
  logout: { alignItems: 'center', paddingTop: 12 },
  logoutText: { fontSize: fontSize.caption, color: colors.textSecondary, fontWeight: fontWeight.semibold },
});

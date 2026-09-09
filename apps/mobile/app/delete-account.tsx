import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';
import { authApi, ApiError } from '../lib/api';
import { tokenStorage } from '../lib/storage';
import { disconnectSocket } from '../lib/socket';
import { useT } from '../lib/i18n';

/**
 * Account deletion — Apple guideline 5.1.1(v) requires this to be initiated
 * AND completed inside the app.
 *
 * Deliberately honest about what survives: MCD contracts and the ACT audit
 * trail are legally retained, so this anonymises rather than erases
 * everything. Claiming a clean wipe would be a lie, and a worker who later
 * sees their shift history referenced in an inspection would have been misled.
 *
 * The blocker is fetched on mount so someone with a confirmed shift is told
 * why up front, instead of being refused after typing the confirmation.
 */

const CONFIRM_WORD = 'ELIMINAR';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { t } = useT();

  const [isChecking, setIsChecking] = useState(true);
  const [blocker, setBlocker] = useState<{
    reason: 'UPCOMING_SHIFTS' | 'UNPAID_WAGES'; count: number;
  } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    authApi.getDeletionStatus()
      .then(res => setBlocker(res.blocker))
      .catch(() => setBlocker(null))   // let the server decide on submit
      .finally(() => setIsChecking(false));
  }, []);

  const canSubmit = !blocker && confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const handleDelete = () => {
    Alert.alert(
      t('mobile.deleteAccount.finalTitle'),
      t('mobile.deleteAccount.finalBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('mobile.deleteAccount.finalConfirm'),
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await authApi.deleteAccount();
              disconnectSocket();
              await tokenStorage.clear();
              router.replace('/login');
            } catch (err) {
              setIsDeleting(false);
              Alert.alert(
                t('mobile.deleteAccount.errorTitle'),
                err instanceof ApiError ? err.message : t('mobile.deleteAccount.errorBody'),
              );
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>{t('mobile.deleteAccount.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {isChecking ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : blocker ? (
          <View style={s.blockCard}>
            <Ionicons name="alert-circle-outline" size={26} color="#b45309" />
            <Text style={s.blockTitle}>{t('mobile.deleteAccount.blockedTitle')}</Text>
            <Text style={s.blockBody}>
              {blocker.reason === 'UPCOMING_SHIFTS'
                ? t('mobile.deleteAccount.blockedShifts', { count: blocker.count })
                : t('mobile.deleteAccount.blockedWages', { count: blocker.count })}
            </Text>
          </View>
        ) : (
          <>
            <Text style={s.lede}>{t('mobile.deleteAccount.lede')}</Text>

            <View style={s.card}>
              <Text style={s.cardTitle}>{t('mobile.deleteAccount.erasedTitle')}</Text>
              {['erased1', 'erased2', 'erased3', 'erased4'].map(k => (
                <View key={k} style={s.row}>
                  <Ionicons name="close-circle" size={16} color="#dc2626" />
                  <Text style={s.rowText}>{t(`mobile.deleteAccount.${k}`)}</Text>
                </View>
              ))}
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>{t('mobile.deleteAccount.keptTitle')}</Text>
              <Text style={s.cardHint}>{t('mobile.deleteAccount.keptWhy')}</Text>
              {['kept1', 'kept2'].map(k => (
                <View key={k} style={s.row}>
                  <Ionicons name="lock-closed" size={15} color={colors.textSecondary} />
                  <Text style={s.rowText}>{t(`mobile.deleteAccount.${k}`)}</Text>
                </View>
              ))}
            </View>

            <Text style={s.label}>
              {t('mobile.deleteAccount.confirmLabel', { word: CONFIRM_WORD })}
            </Text>
            <TextInput
              style={s.input}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={CONFIRM_WORD}
              placeholderTextColor={colors.neutral}
              editable={!isDeleting}
            />

            <Pressable
              onPress={handleDelete}
              disabled={!canSubmit || isDeleting}
              style={[s.deleteBtn, (!canSubmit || isDeleting) && s.deleteBtnOff]}
            >
              {isDeleting
                ? <ActivityIndicator color={colors.white} />
                : <Text style={s.deleteText}>{t('mobile.deleteAccount.cta')}</Text>}
            </Pressable>

            <Pressable onPress={() => router.back()} hitSlop={10} style={s.keepBtn}>
              <Text style={s.keepText}>{t('mobile.deleteAccount.keepAccount')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.secondary },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md,
  },
  back: { padding: 2 },
  headerTitle: {
    fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: colors.textPrimary,
  },
  body: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  lede: {
    fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 23,
  },
  card: {
    backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.neutral,
    padding: spacing.md, gap: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary,
  },
  cardHint: {
    fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 19,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowText: {
    flex: 1, fontSize: fontSize.caption, color: colors.textPrimary, lineHeight: 20,
  },
  label: {
    fontSize: fontSize.caption, fontWeight: fontWeight.semibold,
    color: colors.textPrimary, marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1.5, borderColor: colors.neutral, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: fontSize.body, color: colors.textPrimary, backgroundColor: colors.white,
    letterSpacing: 1,
  },
  deleteBtn: {
    backgroundColor: '#dc2626', borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm,
  },
  deleteBtnOff: { backgroundColor: colors.neutral },
  deleteText: {
    color: colors.white, fontSize: fontSize.body, fontWeight: fontWeight.bold,
  },
  keepBtn: { alignSelf: 'center', paddingVertical: spacing.sm },
  keepText: {
    fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.primary,
  },
  blockCard: {
    backgroundColor: '#fef9c3', borderRadius: radius.md,
    padding: spacing.md, gap: spacing.sm, alignItems: 'flex-start',
  },
  blockTitle: {
    fontSize: fontSize.body, fontWeight: fontWeight.bold, color: '#78350f',
  },
  blockBody: { fontSize: fontSize.caption, color: '#78350f', lineHeight: 20 },
});

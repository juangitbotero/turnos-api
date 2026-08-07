import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Alert, Switch, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  colors, spacing, radius, fontSize, fontWeight, STORED_WEEKDAYS,
  WorkerExperience, APP_LANGUAGES, APP_LANGUAGE_LABELS, AppLanguage,
} from '@turnos/shared';
import { authApi, ratingsApi, ApiError, RatingRecord } from '../lib/api';
import { tokenStorage } from '../lib/storage';
import { disconnectSocket } from '../lib/socket';
import { useT, useLanguage } from '../lib/i18n';

type WorkerProfile = {
  userId: string; role: string;
  fullName: string | null; photoUrl: string | null;
  cvUrl: string | null; cvFileName: string | null;
  bio: string | null;
  skills: string[]; languages: string[]; availableDays: string[];
  isAvailableForWork: boolean;
  experiences: WorkerExperience[];
  profileQualityScore: number; status: string;
  nif: string | null; iban: string | null;
  avgRating: number | null; totalRatings: number;
  noShowCount: number; badges: string[];
};

/** Colours only — the labels come from the catalogue via t('domain.workerStatus.*') */
const STATUS_COLOURS: Record<string, { bg: string; text: string }> = {
  INCOMPLETE:     { bg: '#fef9c3', text: '#854d0e' },
  PENDING_REVIEW: { bg: '#dbeafe', text: '#1d4ed8' },
  ACTIVE:         { bg: '#dcfce7', text: '#166534' },
  SUSPENDED:      { bg: '#fee2e2', text: '#991b1b' },
  REJECTED:       { bg: '#fee2e2', text: '#991b1b' },
};

const BADGE_EMOJI: Record<string, string> = {
  TOP_RATED: '🏆',
  RELIABLE:  '✅',
  VERIFIED:  '✔️',
};

function maskIban(iban: string) {
  return iban.length < 8 ? iban : iban.slice(0, 4) + ' •••• •••• ' + iban.slice(-4);
}
function maskNif(nif: string) {
  return nif.length < 4 ? nif : '•••••' + nif.slice(-4);
}

function StarRow({ rating, total, countLabel }: {
  rating: number | null; total: number; countLabel: string;
}) {
  const filled = Math.round(rating ?? 0);
  return (
    <View style={sr.row}>
      {[1, 2, 3, 4, 5].map(n => (
        <Text key={n} style={[sr.star, n <= filled && sr.starFilled]}>★</Text>
      ))}
      <Text style={sr.value}>
        {rating != null ? Number(rating).toFixed(1) : '—'}
      </Text>
      <Text style={sr.count}>{countLabel}</Text>
    </View>
  );
}

const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  star: { fontSize: 16, color: '#d1d5db' },
  starFilled: { color: '#fbbf24' },
  value: { fontSize: 14, fontWeight: fontWeight.bold as any, color: colors.textPrimary, marginLeft: 4 },
  count: { fontSize: 12, color: colors.textSecondary },
});

export default function ProfileScreen() {
  const router = useRouter();
  const { t, tSkill, tWorkerLanguage, tWeekday, fShortDate } = useT();
  const { language, setLanguage } = useLanguage();
  const [profile, setProfile]     = useState<WorkerProfile | null>(null);
  const [reviews, setReviews]     = useState<RatingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await authApi.getMe();
      setProfile(data as WorkerProfile);
      // Reviews are a separate call and must never block the profile — an
      // employer's written note is nice to have, the profile is not.
      ratingsApi.getMySummary()
        .then(s => setReviews(s.recentRatings ?? []))
        .catch(() => setReviews([]));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        await tokenStorage.clear();
        Alert.alert(
          t('common.sessionExpired'),
          t('common.sessionExpiredBody'),
          [{ text: t('common.signIn'), onPress: () => router.replace('/login') }],
        );
        return;
      }
      setError(t('mobile.profile.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [router, t]);

  useEffect(() => { load(); }, [load]);

  /**
   * Master availability switch. Saved immediately (optimistic, reverted on
   * failure) — making the worker open the editor and press Guardar for a
   * one-tap state would defeat the point of having a switch here.
   */
  const toggleAvailability = useCallback(async (next: boolean) => {
    setProfile(prev => prev && { ...prev, isAvailableForWork: next });
    try {
      await authApi.updateWorkerPartial({ isAvailableForWork: next });
    } catch {
      setProfile(prev => prev && { ...prev, isAvailableForWork: !next });
      Alert.alert(t('common.error'), t('mobile.profile.availabilityError'));
    }
  }, [t]);

  /**
   * Switch the UI language and mirror it to the server, so push notifications
   * and emails — composed without a browser — use the same language.
   * The server call is best-effort: the UI must switch even if it fails.
   */
  const handleLanguageChange = useCallback(async (lang: AppLanguage) => {
    await setLanguage(lang);
    authApi.updateWorkerPartial({ preferredLanguage: lang }).catch(() => {});
  }, [setLanguage]);

  const handleLogout = () => {
    Alert.alert(
      t('mobile.profile.logoutConfirmTitle'),
      t('mobile.profile.logoutConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('mobile.profile.logoutConfirmYes'), style: 'destructive',
          onPress: async () => {
            disconnectSocket();
            await tokenStorage.clear();
            router.replace('/login');
          },
        },
      ],
    );
  };

  const score       = profile?.profileQualityScore ?? 0;
  const statusKey   = profile?.status ?? '';
  const statusColour = STATUS_COLOURS[statusKey] ?? { bg: '#f3f4f6', text: '#6b7280' };
  const statusLabel  = STATUS_COLOURS[statusKey]
    ? t(`domain.workerStatus.${statusKey}`)
    : (statusKey || '—');
  const scoreColor  = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  const activeBadges = (profile?.badges ?? []).filter(b => BADGE_EMOJI[b]);

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <LinearGradient colors={['#6a79ff', '#9b6dff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('mobile.profile.title')}</Text>
          <TouchableOpacity onPress={() => router.push('/edit-profile' as any)} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="pencil-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load}>
            <Text style={s.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Avatar + name + rating ── */}
          <View style={s.avatarSection}>
            {profile?.photoUrl ? (
              <Image source={{ uri: profile.photoUrl }} style={s.avatar} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitial}>
                  {(profile?.fullName?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}

            <Text style={s.fullName}>{profile?.fullName ?? t('mobile.profile.noName')}</Text>

            {/* Star rating */}
            <StarRow
              rating={profile?.avgRating ?? null}
              total={profile?.totalRatings ?? 0}
              countLabel={t('mobile.profile.ratingsCount', { count: profile?.totalRatings ?? 0 })}
            />

            {/* Badges */}
            {activeBadges.length > 0 && (
              <View style={s.badgesRow}>
                {activeBadges.map(b => (
                  <View key={b} style={s.badge}>
                    <Text style={s.badgeText}>{BADGE_EMOJI[b]} {t(`domain.badges.${b}`)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Status */}
            <View style={[s.statusBadge, { backgroundColor: statusColour.bg }]}>
              <Text style={[s.statusText, { color: statusColour.text }]}>{statusLabel}</Text>
            </View>
          </View>

          {/* ── Bio / intro ── */}
          {!!profile?.bio && (
            <View style={s.bioCard}>
              <Text style={s.bioText}>{profile.bio}</Text>
            </View>
          )}

          {/* ── Employer reviews ── */}
          {reviews.length > 0 && (
            <View style={s.reviewsSection}>
              <Text style={s.reviewsTitle}>{t('mobile.profile.reviewsTitle')}</Text>
              {reviews.map((r, i) => (
                <View key={`${r.createdAt}-${i}`} style={s.reviewCard}>
                  <View style={s.reviewHead}>
                    <Text style={s.reviewStars}>{'★'.repeat(r.score)}<Text style={s.reviewStarsDim}>{'★'.repeat(5 - r.score)}</Text></Text>
                    <Text style={s.reviewDate}>{fShortDate(r.createdAt)}</Text>
                  </View>
                  {!!r.review && <Text style={s.reviewText}>“{r.review}”</Text>}
                  <Text style={s.reviewAuthor}>— {r.raterName}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Availability master switch ── */}
          <View style={s.availCard}>
            <View style={s.availRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.availTitle}>
                  {profile?.isAvailableForWork
                    ? t('mobile.profile.availabilityOn')
                    : t('mobile.profile.availabilityOff')}
                </Text>
                <Text style={s.availSub}>
                  {profile?.isAvailableForWork
                    ? t('mobile.profile.availabilityOnSub')
                    : t('mobile.profile.availabilityOffSub')}
                </Text>
              </View>
              <Switch
                value={profile?.isAvailableForWork ?? true}
                onValueChange={toggleAvailability}
                trackColor={{ false: '#d1d5db', true: '#86efac' }}
                thumbColor={profile?.isAvailableForWork ? '#16a34a' : '#f4f4f5'}
              />
            </View>
            {(profile?.availableDays?.length ?? 0) > 0 && (
              <View style={[s.availDaysRow, !profile?.isAvailableForWork && { opacity: 0.45 }]}>
                <Text style={s.availDaysLabel}>{t('mobile.profile.onDays')}</Text>
                {/* Stored PT values stay the key; only the initial shown changes. */}
                {STORED_WEEKDAYS.map(d => (
                  <View key={d} style={[s.dayDot, profile!.availableDays.includes(d) && s.dayDotActive]}>
                    <Text style={[s.dayDotText, profile!.availableDays.includes(d) && s.dayDotTextActive]}>
                      {tWeekday(d)[0]}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Experiências ── */}
          {(profile?.experiences?.length ?? 0) > 0 && (
            <View style={s.card}>
              <View style={s.cardHeaderRow}>
                <Ionicons name="briefcase-outline" size={15} color={colors.primary} />
                <Text style={s.cardTitle}>{t('mobile.profile.experiencesTitle')}</Text>
              </View>
              {profile!.experiences.map(exp => (
                <View key={exp.jobTitle} style={s.expRow}>
                  <Text style={s.expTitle}>{tSkill(exp.jobTitle)}</Text>
                  <Text style={s.expLevel}>{t(`domain.experienceLevels.${exp.level}`)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── CV ── */}
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <Ionicons name="document-text-outline" size={15} color={colors.primary} />
              <Text style={s.cardTitle}>{t('mobile.profile.cvTitle')}</Text>
            </View>
            {profile?.cvUrl ? (
              <TouchableOpacity
                style={s.cvRow}
                onPress={() => Linking.openURL(profile.cvUrl!)}
                activeOpacity={0.8}
              >
                <Ionicons name="document-attach" size={18} color="#16a34a" />
                <Text style={s.cvName} numberOfLines={1}>{profile.cvFileName ?? t('mobile.profile.cvView')}</Text>
                <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={s.cvEmpty}
                onPress={() => router.push('/edit-profile' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                <Text style={s.cvEmptyText}>{t('mobile.profile.cvUpload')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Quick highlights (skills + languages + availability) ── */}
          {((profile?.skills?.length ?? 0) > 0 || (profile?.languages?.length ?? 0) > 0) && (
            <View style={s.highlightCard}>
              {/* Top skills */}
              {profile?.skills && profile.skills.length > 0 && (
                <View style={s.highlightRow}>
                  <Ionicons name="construct-outline" size={15} color={colors.primary} />
                  {/* "Competências", not "Experiência" — declared years of
                      experience are now their own section above. */}
                  <Text style={s.highlightLabel}>{t('mobile.profile.skills')}</Text>
                  <View style={s.highlightChips}>
                    {profile.skills.slice(0, 3).map(sk => (
                      <View key={sk} style={s.hlChip}>
                        <Text style={s.hlChipText}>{tSkill(sk)}</Text>
                      </View>
                    ))}
                    {profile.skills.length > 3 && (
                      <Text style={s.hlMore}>+{profile.skills.length - 3}</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Languages */}
              {profile?.languages && profile.languages.length > 0 && (
                <View style={[s.highlightRow, { marginTop: 10 }]}>
                  <Ionicons name="language-outline" size={15} color={colors.primary} />
                  <Text style={s.highlightLabel}>{t('mobile.profile.languages')}</Text>
                  <View style={s.highlightChips}>
                    {profile.languages.map(lang => (
                      <View key={lang} style={[s.hlChip, { backgroundColor: '#f0fdf4' }]}>
                        <Text style={[s.hlChipText, { color: '#15803d' }]}>{tWorkerLanguage(lang)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

            </View>
          )}

          {/* ── Profile completeness ── */}
          <View style={s.card}>
            <View style={s.scoreRow}>
              <View style={s.cardHeaderRow}>
                <Ionicons name="checkmark-circle-outline" size={15} color={colors.primary} />
                <Text style={s.cardTitle}>{t('mobile.profile.completenessTitle')}</Text>
              </View>
              <Text style={[s.scoreNum, { color: scoreColor }]}>{score}%</Text>
            </View>
            <View style={s.scoreBarBg}>
              <View style={[s.scoreBarFill, { width: `${score}%` as any, backgroundColor: scoreColor }]} />
            </View>
            {score < 100 && (
              <Text style={s.scoreHint}>
                {score < 80
                  ? t('mobile.profile.completenessHintLow')
                  : t('mobile.profile.completenessHintHigh')}
              </Text>
            )}
          </View>

          {/* ── All skills ── */}
          {profile?.skills && profile.skills.length > 0 && (
            <View style={s.card}>
              <View style={s.cardHeaderRow}>
                <Ionicons name="construct-outline" size={15} color={colors.primary} />
                <Text style={s.cardTitle}>{t('mobile.profile.skillsTitle')}</Text>
              </View>
              <View style={s.tagWrap}>
                {profile.skills.map(sk => (
                  <View key={sk} style={s.tag}>
                    <Text style={s.tagText}>{tSkill(sk)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Legal data ── */}
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <Ionicons name="card-outline" size={15} color={colors.primary} />
              <Text style={s.cardTitle}>{t('mobile.profile.personalDataTitle')}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.rowLabel}>NIF</Text>
              <Text style={s.rowValue}>{profile?.nif ? maskNif(profile.nif) : '—'}</Text>
            </View>
            <View style={[s.row, s.rowLast]}>
              <Text style={s.rowLabel}>IBAN</Text>
              <Text style={s.rowValue}>{profile?.iban ? maskIban(profile.iban) : '—'}</Text>
            </View>
          </View>

          {/* ── App language ── */}
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <Ionicons name="language-outline" size={15} color={colors.primary} />
              <Text style={s.cardTitle}>{t('mobile.profile.languageTitle')}</Text>
            </View>
            <Text style={s.langSub}>{t('mobile.profile.languageSub')}</Text>
            <View style={s.langRow}>
              {APP_LANGUAGES.map(lang => {
                const active = language === lang;
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[s.langBtn, active && s.langBtnActive]}
                    onPress={() => handleLanguageChange(lang as AppLanguage)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.langBtnText, active && s.langBtnTextActive]}>
                      {APP_LANGUAGE_LABELS[lang]}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={16} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Earnings CTA ── */}
          <TouchableOpacity style={s.ctaBtn} onPress={() => router.push('/earnings' as any)} activeOpacity={0.85}>
            <View style={[s.ctaIcon, { backgroundColor: '#eef0ff' }]}>
              <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
            </View>
            <View style={s.ctaBody}>
              <Text style={s.ctaTitle}>{t('mobile.profile.earningsCta')}</Text>
              <Text style={s.ctaSub}>{t('mobile.profile.earningsCtaSub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>

          {/* ── Edit CTA ── */}
          <TouchableOpacity style={s.ctaBtn} onPress={() => router.push('/edit-profile' as any)} activeOpacity={0.85}>
            <View style={[s.ctaIcon, { backgroundColor: '#eef0ff' }]}>
              <Ionicons name="pencil-outline" size={20} color={colors.primary} />
            </View>
            <View style={s.ctaBody}>
              <Text style={s.ctaTitle}>{t('mobile.profile.editCta')}</Text>
              <Text style={s.ctaSub}>{t('mobile.profile.editCtaSub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>

          {/* ── Logout ── */}
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color="#dc2626" />
            <Text style={s.logoutText}>{t('mobile.profile.logout')}</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Bottom nav ── */}
      <View style={s.bottomNav}>
        <TouchableOpacity style={s.navItem} onPress={() => router.push('/')} activeOpacity={0.7}>
          <Ionicons name="compass-outline" size={24} color={colors.textSecondary} />
          <Text style={s.navLabel}>{t('mobile.nav.shifts')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => router.push('/my-shifts')} activeOpacity={0.7}>
          <Ionicons name="briefcase-outline" size={24} color={colors.textSecondary} />
          <Text style={s.navLabel}>{t('mobile.nav.myShifts')}</Text>
        </TouchableOpacity>
        <View style={s.navItemActive}>
          <Ionicons name="person-circle" size={24} color={colors.primary} />
          <Text style={s.navLabelActive}>{t('mobile.nav.profile')}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { color: '#ef4444', fontSize: fontSize.body, textAlign: 'center', marginBottom: spacing.md },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: fontWeight.bold as any },

  /* Header */
  header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: fontSize.h3, fontWeight: fontWeight.bold as any },

  scroll: { padding: spacing.md, gap: 14 },

  /* Avatar */
  avatarSection: { alignItems: 'center', paddingVertical: spacing.md, gap: 6 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 4 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#eef0ff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  avatarInitial: { fontSize: 38, fontWeight: fontWeight.bold as any, color: colors.primary },
  fullName: { fontSize: fontSize.h2, fontWeight: fontWeight.bold as any, color: colors.textPrimary },
  badgesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  badge: { backgroundColor: '#fef9c3', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: '#fde68a' },
  badgeText: { fontSize: 11, fontWeight: fontWeight.bold as any, color: '#92400e' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 2 },
  statusText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold as any },

  /* Highlight card */
  bioCard: {
    backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
    borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  bioText: {
    fontSize: fontSize.body, color: colors.textPrimary, lineHeight: 22, fontStyle: 'italic',
  },

  /* Employer reviews */
  reviewsSection: { gap: spacing.sm },
  reviewsTitle: {
    fontSize: fontSize.body, fontWeight: fontWeight.semibold as any,
    color: colors.textPrimary, marginBottom: 2,
  },
  reviewCard: {
    backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4, elevation: 2, gap: 6,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewStars: { fontSize: fontSize.body, color: '#f59e0b', letterSpacing: 1 },
  reviewStarsDim: { color: '#e5e7eb' },
  reviewDate: { fontSize: fontSize.caption, color: colors.textSecondary },
  reviewText: { fontSize: fontSize.body, color: colors.textPrimary, lineHeight: 21 },
  reviewAuthor: {
    fontSize: fontSize.caption, color: colors.textSecondary, fontWeight: fontWeight.semibold as any,
  },

  /* Availability master switch */
  availCard: {
    backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.neutral, marginBottom: spacing.sm,
  },
  availRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  availTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.textPrimary },
  availSub: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
  availDaysRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.neutral,
  },
  availDaysLabel: {
    fontSize: fontSize.caption, color: colors.textSecondary,
    fontWeight: fontWeight.semibold as any, marginRight: 4,
  },

  /* App language */
  langSub: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2, marginBottom: 10, lineHeight: 16 },
  langRow: { flexDirection: 'row', gap: 8 },
  langBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.neutral, backgroundColor: '#fff',
  },
  langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langBtnText: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.textSecondary },
  langBtnTextActive: { color: '#fff' },

  /* Experiences */
  expRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.neutral,
  },
  expTitle: { fontSize: fontSize.body, fontWeight: fontWeight.semibold as any, color: colors.textPrimary, flex: 1 },
  expLevel: { fontSize: fontSize.caption, fontWeight: fontWeight.bold as any, color: colors.primary },

  /* CV */
  cvRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: radius.md, padding: spacing.sm, marginTop: 4,
  },
  cvName: { flex: 1, fontSize: fontSize.body, fontWeight: fontWeight.semibold as any, color: '#166534' },
  cvEmpty: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: radius.md, marginTop: 4,
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed',
    backgroundColor: '#f5f6ff',
  },
  cvEmptyText: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.primary },

  highlightCard: {
    backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
  },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  highlightLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.bold as any, color: colors.textSecondary, width: 68 },
  highlightChips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  hlChip: { backgroundColor: '#eef0ff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  hlChipText: { fontSize: 11, fontWeight: fontWeight.semibold as any, color: colors.primary },
  hlMore: { fontSize: 11, color: colors.textSecondary, fontWeight: fontWeight.semibold as any },
  dayDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.secondary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.neutral,
  },
  dayDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayDotText: { fontSize: 10, fontWeight: fontWeight.bold as any, color: colors.textSecondary },
  dayDotTextActive: { color: '#fff' },

  /* Card */
  card: {
    backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: {
    fontSize: 11, fontWeight: fontWeight.bold as any, color: colors.primary,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  /* Score */
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreNum: { fontSize: 20, fontWeight: fontWeight.bold as any },
  scoreBarBg: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 4 },
  scoreHint: { fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 18 },

  /* Tags */
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#eef0ff', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  tagText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold as any, color: colors.primary },
  tagBlue: { backgroundColor: '#dbeafe' },
  tagBlueText: { color: '#1d4ed8' },

  /* Rows */
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  rowLabel: { fontSize: fontSize.body, color: colors.textSecondary, fontWeight: fontWeight.semibold as any },
  rowValue: { fontSize: fontSize.body, color: colors.textPrimary, fontFamily: 'monospace' },

  /* CTA buttons */
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
  },
  ctaIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ctaBody: { flex: 1 },
  ctaTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.textPrimary },
  ctaSub: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 1 },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#fca5a5', borderRadius: radius.md, paddingVertical: 14,
  },
  logoutText: { color: '#dc2626', fontSize: fontSize.body, fontWeight: fontWeight.bold as any },

  /* Bottom nav */
  bottomNav: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingBottom: 24, paddingTop: 10,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navItemActive: { flex: 1, alignItems: 'center', gap: 3 },
  navLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: fontWeight.semibold as any },
  navLabelActive: { fontSize: 11, color: colors.primary, fontWeight: fontWeight.bold as any },
});

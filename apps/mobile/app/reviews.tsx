/**
 * Employer reviews screen — what companies said about the worker.
 *
 * This used to be an inline section on /profile, where it pushed everything
 * below it (availability, experience, CV, skills, legal data) off the first
 * screens. Reviews grow without bound and the profile does not, so they get
 * their own screen, reached from the profile the same way Ganhos is.
 *
 * Everything here comes from a single GET /ratings/me — the same summary the
 * profile header already uses for the star row, plus the 10 most recent
 * written reviews.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';
import { ratingsApi, WorkerRatingSummary } from '../lib/api';
import { useT } from '../lib/i18n';

const BADGE_EMOJI: Record<string, string> = {
  TOP_RATED: '🏆',
  RELIABLE:  '✅',
  VERIFIED:  '✔️',
};

/** Static stars — the worker reads these, never taps them. */
function Stars({ score, size = 15 }: { score: number; size?: number }) {
  return (
    <Text style={{ fontSize: size, letterSpacing: 1 }}>
      <Text style={{ color: '#f59e0b' }}>{'★'.repeat(score)}</Text>
      <Text style={{ color: '#e5e7eb' }}>{'★'.repeat(Math.max(0, 5 - score))}</Text>
    </Text>
  );
}

export default function ReviewsScreen() {
  const router = useRouter();
  const { t, fShortDate } = useT();

  const [summary, setSummary] = useState<WorkerRatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSummary(await ratingsApi.getMySummary());
    } catch {
      setError(t('mobile.reviews.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const reviews      = summary?.recentRatings ?? [];
  const total        = summary?.totalRatings ?? 0;
  const avg          = summary?.avgRating ?? null;
  const activeBadges = (summary?.badges ?? []).filter(b => BADGE_EMOJI[b]);

  // Tag counts across the reviews we have. Deliberately not framed as an
  // all-time total — it can only ever cover the 10 the API returns.
  const tagCounts = reviews
    .flatMap(r => r.tags ?? [])
    .reduce<Record<string, number>>((acc, tag) => {
      acc[tag] = (acc[tag] ?? 0) + 1;
      return acc;
    }, {});
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <LinearGradient
        colors={['#6a79ff', '#9b6dff']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={s.header}
      >
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('mobile.reviews.title')}</Text>
          <View style={s.iconBtn} />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.loadingText}>{t('mobile.reviews.loading')}</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.85}>
            <Text style={s.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Summary hero ── */}
          <View style={s.heroCard}>
            <View style={s.heroLeft}>
              <Text style={s.heroAvg}>{avg != null ? Number(avg).toFixed(1) : '—'}</Text>
              <Stars score={Math.round(Number(avg ?? 0))} size={17} />
              <Text style={s.heroCount}>
                {total > 0
                  ? t('mobile.reviews.ratingsCount', { count: total })
                  : t('mobile.reviews.noRatingsYet')}
              </Text>
            </View>

            <View style={s.heroDivider} />

            <View style={s.heroRight}>
              <View style={s.statRow}>
                {/* Number(): the same numeric-string guard the profile applies
                    to avgRating — Postgres decimals arrive as strings. */}
                <Text style={s.statValue}>
                  {Math.round(Number(summary?.completionRate ?? 0) * 100)}%
                </Text>
                <Text style={s.statLabel}>{t('mobile.reviews.statCompletion')}</Text>
              </View>
              <View style={s.statRow}>
                <Text style={[s.statValue, (summary?.noShowCount ?? 0) > 0 && { color: '#dc2626' }]}>
                  {summary?.noShowCount ?? 0}
                </Text>
                <Text style={s.statLabel}>{t('mobile.reviews.statNoShows')}</Text>
              </View>
            </View>
          </View>

          {/* ── Badges ── */}
          {activeBadges.length > 0 && (
            <View style={s.badgesRow}>
              {activeBadges.map(b => (
                <View key={b} style={s.badge}>
                  <Text style={s.badgeText}>{BADGE_EMOJI[b]} {t(`domain.badges.${b}`)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Tag highlights ── */}
          {topTags.length > 0 && (
            <View style={s.card}>
              <View style={s.cardHeaderRow}>
                <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
                <Text style={s.cardTitle}>{t('mobile.reviews.tagsTitle')}</Text>
              </View>
              <View style={s.tagWrap}>
                {topTags.map(([tag, count]) => (
                  <View key={tag} style={s.tag}>
                    <Text style={s.tagText}>
                      {t('mobile.reviews.tagCount', {
                        tag: t(`domain.ratingTags.${tag}`),
                        count,
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Review list ── */}
          {reviews.length > 0 ? (
            <View style={s.listSection}>
              <Text style={s.listTitle}>{t('mobile.reviews.listTitle')}</Text>
              {reviews.map((r, i) => (
                <View key={`${r.createdAt}-${i}`} style={s.reviewCard}>
                  <View style={s.reviewHead}>
                    <Stars score={r.score} />
                    <Text style={s.reviewDate}>{fShortDate(r.createdAt)}</Text>
                  </View>
                  {r.review
                    ? <Text style={s.reviewText}>“{r.review}”</Text>
                    : <Text style={s.reviewNoText}>{t('mobile.reviews.starOnly')}</Text>}
                  <Text style={s.reviewAuthor}>— {r.raterName}</Text>
                </View>
              ))}
              {total > reviews.length && (
                <Text style={s.listNote}>{t('mobile.reviews.listNote')}</Text>
              )}
            </View>
          ) : (
            <View style={s.emptyCard}>
              <Text style={s.emptyIcon}>⭐</Text>
              <Text style={s.emptyTitle}>{t('mobile.reviews.emptyTitle')}</Text>
              <Text style={s.emptyBody}>{t('mobile.reviews.emptyBody')}</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/')} activeOpacity={0.85}>
                <Text style={s.emptyBtnText}>{t('mobile.reviews.emptyCta')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  loadingText: { fontSize: fontSize.caption, color: colors.textSecondary },
  errorText: { color: '#ef4444', fontSize: fontSize.body, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.primary, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, borderRadius: radius.md,
  },
  retryText: { color: '#fff', fontWeight: fontWeight.bold as any },

  /* Header */
  header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: fontSize.h3, fontWeight: fontWeight.bold as any },

  scroll: { padding: spacing.md, gap: 14 },

  /* Summary hero */
  heroCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4, elevation: 2,
  },
  heroLeft: { flex: 1, alignItems: 'center', gap: 4 },
  heroAvg: { fontSize: 40, fontWeight: fontWeight.bold as any, color: colors.textPrimary, lineHeight: 44 },
  heroCount: { fontSize: fontSize.caption, color: colors.textSecondary },
  heroDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.neutral, marginHorizontal: spacing.md },
  heroRight: { flex: 1, gap: 12 },
  statRow: { gap: 1 },
  statValue: { fontSize: fontSize.h3, fontWeight: fontWeight.bold as any, color: colors.textPrimary },
  statLabel: { fontSize: fontSize.caption, color: colors.textSecondary },

  /* Badges */
  badgesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    backgroundColor: '#fef9c3', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: '#fde68a',
  },
  badgeText: { fontSize: 11, fontWeight: fontWeight.bold as any, color: '#92400e' },

  /* Card */
  card: {
    backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4, elevation: 2,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: {
    fontSize: 11, fontWeight: fontWeight.bold as any, color: colors.primary,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#eef0ff', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  tagText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold as any, color: colors.primary },

  /* Review list */
  listSection: { gap: spacing.sm },
  listTitle: {
    fontSize: 11, fontWeight: fontWeight.bold as any, color: colors.primary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2,
  },
  reviewCard: {
    backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, gap: 6,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4, elevation: 2,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewDate: { fontSize: fontSize.caption, color: colors.textSecondary },
  reviewText: { fontSize: fontSize.body, color: colors.textPrimary, lineHeight: 21 },
  reviewNoText: { fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic' },
  reviewAuthor: {
    fontSize: fontSize.caption, color: colors.textSecondary,
    fontWeight: fontWeight.semibold as any,
  },
  listNote: {
    fontSize: fontSize.caption, color: colors.textSecondary,
    textAlign: 'center', marginTop: 4,
  },

  /* Empty state */
  emptyCard: {
    backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.lg,
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4, elevation: 2,
  },
  emptyIcon: { fontSize: 34 },
  emptyTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.bold as any, color: colors.textPrimary },
  emptyBody: {
    fontSize: fontSize.body, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 21,
  },
  emptyBtn: {
    marginTop: 6, backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg, paddingVertical: 12, borderRadius: radius.md,
  },
  emptyBtnText: { color: '#fff', fontSize: fontSize.body, fontWeight: fontWeight.bold as any },
});

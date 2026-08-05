/**
 * Earnings screen — Worker income dashboard.
 *
 * Shows the gross the worker receives in full (paid directly by the company —
 * Turnos charges workers nothing) and the informative 11% TSU the worker must
 * declare and pay to the Portuguese Segurança Social (MCD contract).
 *
 * Period toggles: Hoje | Este mês | Este ano
 * Each period fetches from GET /payments/worker/earnings?period=...
 *
 * Quarterly SS reminder: the screen itself shows a prominent banner in
 * March, June, September and December reminding the worker to submit
 * their SS declaration before the end of the month.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Linking, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';
import { paymentsApi, wagesApi, ConnectStatus, EarningsReport, EarningRecord } from '../lib/api';
import { useT } from '../lib/i18n';

// ── Constants ─────────────────────────────────────────────────────────────────

type Period = 'day' | 'month' | 'year';

const PERIODS: Period[] = ['day', 'month', 'year'];

// Months that trigger SS quarterly reminder (end of quarter)
const SS_REMINDER_MONTHS = [3, 6, 9, 12];

const SS_DIRETA_URL = 'https://www.seg-social.pt/inicio';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `€${n.toFixed(2)}`;
}

function isQuarterReminder(): boolean {
  return SS_REMINDER_MONTHS.includes(new Date().getMonth() + 1);
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function EarningsScreen() {
  const router = useRouter();
  const { t, fMonthName } = useT();

  const now = new Date();
  const [period,  setPeriod]  = useState<Period>('month');
  const [report,  setReport]  = useState<EarningsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [connect, setConnect] = useState<ConnectStatus | null>(null);
  const [activating, setActivating] = useState(false);

  const loadConnectStatus = useCallback(() => {
    wagesApi.connectStatus().then(setConnect).catch(() => {});
  }, []);

  useEffect(() => { loadConnectStatus(); }, [loadConnectStatus]);

  const handleActivatePayLink = useCallback(async () => {
    setActivating(true);
    try {
      const { onboardingUrl } = await wagesApi.startConnect();
      // Stripe-hosted onboarding — resolves when the worker closes the browser
      await WebBrowser.openBrowserAsync(onboardingUrl);
      loadConnectStatus();
    } catch {
      Alert.alert(t('common.error'), t('mobile.earnings.payLinkFailed'));
    } finally {
      setActivating(false);
    }
  }, [loadConnectStatus, t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await paymentsApi.getWorkerEarnings(
        period,
        period === 'day'  ? now.toISOString().slice(0, 10) : undefined,
        period === 'month' ? now.getMonth() + 1              : undefined,
        period !== 'day'  ? now.getFullYear()               : undefined,
      );
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mobile.earnings.loadError'));
    } finally {
      setLoading(false);
    }
  }, [period, t]);

  useEffect(() => { load(); }, [load]);

  // "Este mês" / "This month" reads mid-sentence in both languages lowercased.
  const periodLabelLower = t(`mobile.earnings.periods.${period}`).toLowerCase();

  const handleSsLink = () => {
    Alert.alert(
      t('mobile.earnings.ssCtaTitle'),
      t('mobile.earnings.ssAlertBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('mobile.earnings.ssAlertOpen'), onPress: () => Linking.openURL(SS_DIRETA_URL) },
      ],
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>

      {/* Header */}
      <LinearGradient
        colors={['#6a79ff', '#9b6dff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.header}
      >
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('mobile.earnings.title')}</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Period toggle */}
        <View style={s.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p}
              style={[s.periodBtn, period === p && s.periodBtnActive]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.8}
            >
              <Text style={[s.periodLabel, period === p && s.periodLabelActive]}>
                {t(`mobile.earnings.periods.${p}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Pay Link activation card ── */}
        {connect && !connect.payoutsEnabled && (
          <View style={s.payLinkCard}>
            <Text style={s.payLinkIcon}>💳</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.payLinkTitle}>
                {connect.onboardingComplete
                  ? t('mobile.earnings.payLinkTitleVerifying')
                  : connect.hasAccount
                    ? t('mobile.earnings.payLinkTitleContinue')
                    : t('mobile.earnings.payLinkTitleStart')}
              </Text>
              <Text style={s.payLinkText}>
                {connect.onboardingComplete
                  ? t('mobile.earnings.payLinkBodyVerifying')
                  : t('mobile.earnings.payLinkBodyStart')}
              </Text>
              {!connect.onboardingComplete && (
                <TouchableOpacity
                  style={s.payLinkBtn}
                  onPress={handleActivatePayLink}
                  disabled={activating}
                  activeOpacity={0.85}
                >
                  <Text style={s.payLinkBtnText}>
                    {activating
                      ? t('mobile.earnings.payLinkOpening')
                      : connect.hasAccount
                        ? t('mobile.earnings.payLinkContinue')
                        : t('mobile.earnings.payLinkActivate')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        {connect?.payoutsEnabled && (
          <View style={s.payLinkActiveCard}>
            <Text style={s.payLinkActiveText}>{t('mobile.earnings.payLinkActive')}</Text>
            <Text style={s.payLinkActiveSub}>
              {connect.mbWayEnabled
                ? t('mobile.earnings.payLinkActiveMbWay')
                : t('mobile.earnings.payLinkActiveCard')}
            </Text>
          </View>
        )}

        {/* Quarterly SS reminder */}
        {isQuarterReminder() && (
          <TouchableOpacity style={s.ssReminder} onPress={handleSsLink} activeOpacity={0.85}>
            <Text style={s.ssReminderIcon}>🏛️</Text>
            <View style={s.ssReminderBody}>
              <Text style={s.ssReminderTitle}>{t('mobile.earnings.ssReminderTitle')}</Text>
              <Text style={s.ssReminderText}>
                {t('mobile.earnings.ssReminderBody', {
                  month: fMonthName(now.getMonth(), now.getFullYear()),
                })}
              </Text>
              <Text style={s.ssReminderLink}>{t('mobile.earnings.ssReminderLink')}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Loading */}
        {loading && (
          <View style={s.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={s.loadingText}>{t('mobile.earnings.loading')}</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error !== '' && (
          <View style={s.errorCard}>
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={load}>
              <Text style={s.retryText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        {!loading && error === '' && report && (
          <>
            {/* KPI summary strip */}
            <View style={s.kpiStrip}>
              <KpiCard
                icon="💶"
                label={t('mobile.earnings.kpiGross')}
                value={fmt(report.totalGross)}
                accent="#6a79ff"
              />
              <View style={s.kpiDivider} />
              <KpiCard
                icon="✅"
                label={t('mobile.earnings.kpiReceived')}
                value={fmt(report.workerNet)}
                accent="#16a34a"
              />
              <View style={s.kpiDivider} />
              <KpiCard
                icon="📋"
                label={t('mobile.earnings.kpiShifts')}
                value={String(report.shiftCount)}
                accent="#f59e0b"
              />
            </View>

            {/* Fee & TSU breakdown */}
            <View style={s.card}>
              <Text style={s.cardTitle}>{t('mobile.earnings.breakdownTitle')}</Text>

              <Row label={t('mobile.earnings.rowGross')} value={fmt(report.totalGross)} bold />
              <Divider />
              <Row
                label={t('mobile.earnings.rowTsu')}
                value={fmt(report.workerTsuOwed)}
                accent="#d97706"
              />
              <Row label={t('mobile.earnings.rowAfterTsu')} value={fmt(report.workerNet)} />
              <View style={s.tsuNote}>
                <Text style={s.tsuNoteText}>
                  {t('mobile.earnings.tsuNote')}
                  <Text style={s.tsuNoteStrong}>{t('mobile.earnings.tsuNoteBold')}</Text>
                  {t('mobile.earnings.tsuNoteEnd')}
                </Text>
              </View>
            </View>

            {/* Shift list */}
            {report.records.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>
                  {t('mobile.earnings.listTitle', { period: periodLabelLower })}
                </Text>
                {report.records.map(r => (
                  <EarningRow key={r.id} record={r} />
                ))}
              </View>
            )}

            {report.records.length === 0 && (
              <View style={s.emptyCard}>
                <Text style={s.emptyIcon}>💶</Text>
                <Text style={s.emptyTitle}>{t('mobile.earnings.emptyTitle', { period: periodLabelLower })}</Text>
                <Text style={s.emptySub}>{t('mobile.earnings.emptySub')}</Text>
              </View>
            )}

            {/* SS CTA */}
            <TouchableOpacity style={s.ssCta} onPress={handleSsLink} activeOpacity={0.85}>
              <Text style={s.ssCtaIcon}>🏛️</Text>
              <View style={s.ssCtaBody}>
                <Text style={s.ssCtaTitle}>{t('mobile.earnings.ssCtaTitle')}</Text>
                <Text style={s.ssCtaText}>{t('mobile.earnings.ssCtaText')}</Text>
              </View>
              <Text style={s.ssCtaArrow}>→</Text>
            </TouchableOpacity>

          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) {
  return (
    <View style={sk.root}>
      <Text style={sk.icon}>{icon}</Text>
      <Text style={[sk.value, { color: accent }]}>{value}</Text>
      <Text style={sk.label}>{label}</Text>
    </View>
  );
}

function Row({ label, value, negative, bold, accent }: {
  label: string; value: string;
  negative?: boolean; bold?: boolean; accent?: string;
}) {
  return (
    <View style={sr.row}>
      <Text style={sr.label}>{label}</Text>
      <Text style={[
        sr.value,
        negative && sr.valueNeg,
        bold     && sr.valueBold,
        accent ? { color: accent } : null,
      ]}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={sr.divider} />;
}

function EarningRow({ record }: { record: EarningRecord }) {
  const { t, fShortDate } = useT();
  return (
    <View style={se.row}>
      <View style={se.left}>
        <Text style={se.date}>{record.shiftDate ? fShortDate(record.shiftDate) : '—'}</Text>
        <Text style={se.hours}>{Number(record.scheduledHours ?? 0).toFixed(1)}h</Text>
      </View>
      <View style={se.right}>
        <Text style={se.gross}>{fmt(Number(record.grossAmount))}</Text>
        <Text style={se.net}>{t('mobile.earnings.rowNet')} {fmt(Number(record.workerNet ?? 0))}</Text>
      </View>
    </View>
  );
}

/* ─────────────────────────── Styles ─────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.secondary },

  // Header
  header:     { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText:   { color: '#fff', fontSize: 22, fontWeight: '600' },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold as any, color: '#fff', letterSpacing: -0.5 },

  // Period toggle
  periodRow:  { flexDirection: 'row', gap: 8 },
  periodBtn:  {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  periodBtnActive: { backgroundColor: '#fff' },
  periodLabel:     { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any, color: 'rgba(255,255,255,0.8)' },
  periodLabelActive: { color: colors.primary },

  // Scroll
  scroll: { padding: spacing.md, gap: spacing.md },

  // Pay Link activation card
  payLinkCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#eef0ff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  payLinkIcon: { fontSize: 24, marginTop: 2 },
  payLinkTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: '#3730a3' },
  payLinkText: { fontSize: fontSize.caption, color: '#4338ca', lineHeight: 18, marginTop: 2 },
  payLinkBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 10,
  },
  payLinkBtnText: { fontSize: 13, fontWeight: fontWeight.bold, color: '#fff' },
  payLinkActiveCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: spacing.md,
  },
  payLinkActiveText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: '#166534', lineHeight: 18 },
  payLinkActiveSub:  { fontSize: fontSize.caption, color: '#15803d', lineHeight: 17, marginTop: 6 },

  // SS reminder
  ssReminder: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fffbeb',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fcd34d',
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  ssReminderIcon: { fontSize: 24, marginTop: 2 },
  ssReminderBody: { flex: 1 },
  ssReminderTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold as any, color: '#92400e', marginBottom: 4 },
  ssReminderText:  { fontSize: 12, color: '#78350f', lineHeight: 18 },
  ssReminderLink:  { fontSize: 12, fontWeight: fontWeight.bold as any, color: '#d97706', marginTop: 6 },

  // States
  center: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: fontSize.sm, color: colors.textMuted },
  errorCard: {
    backgroundColor: '#fee2e2',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 12,
  },
  errorText: { fontSize: fontSize.sm, color: '#991b1b', textAlign: 'center' },
  retryBtn: {
    paddingVertical: 8, paddingHorizontal: 20,
    backgroundColor: '#991b1b',
    borderRadius: radius.full,
  },
  retryText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold as any, color: '#fff' },

  // KPI strip
  kpiStrip: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  kpiDivider: { width: 1, backgroundColor: colors.border },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  // TSU note
  tsuNote: {
    backgroundColor: '#fffbeb',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#fcd34d',
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  tsuNoteText:   { fontSize: 12, color: '#78350f', lineHeight: 17 },
  tsuNoteStrong: { fontWeight: fontWeight.bold as any },

  // Empty
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon:  { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold as any, color: colors.textPrimary, textAlign: 'center' },
  emptySub:   { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // SS CTA
  ssCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  ssCtaIcon:  { fontSize: 28 },
  ssCtaBody:  { flex: 1 },
  ssCtaTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold as any, color: colors.textPrimary },
  ssCtaText:  { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  ssCtaArrow: { fontSize: 18, color: colors.primary, fontWeight: fontWeight.bold as any },
});

// KPI card sub-styles
const sk = StyleSheet.create({
  root:  { flex: 1, alignItems: 'center', paddingVertical: spacing.md, gap: 4 },
  icon:  { fontSize: 22, marginBottom: 2 },
  value: { fontSize: fontSize.xl, fontWeight: fontWeight.bold as any, letterSpacing: -0.5 },
  label: { fontSize: 11, color: colors.textMuted, fontWeight: fontWeight.semibold as any },
});

// Row sub-styles
const sr = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  label:     { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },
  value:     { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any, color: colors.textPrimary },
  valueNeg:  { color: '#dc2626' },
  valueBold: { fontSize: fontSize.md, fontWeight: fontWeight.bold as any },
  divider:   { height: 1, backgroundColor: colors.border, marginVertical: 4 },
});

// Earning row sub-styles
const se = StyleSheet.create({
  row:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  left:  { flex: 1 },
  right: { alignItems: 'flex-end' },
  date:  { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semibold as any },
  hours: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  gross: { fontSize: fontSize.sm, fontWeight: fontWeight.bold as any, color: colors.textPrimary },
  net:   { fontSize: 11, color: '#16a34a', marginTop: 2 },
});

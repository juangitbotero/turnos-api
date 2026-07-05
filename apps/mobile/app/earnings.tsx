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
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';
import { paymentsApi, EarningsReport, EarningRecord } from '../lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────

type Period = 'day' | 'month' | 'year';

const PERIOD_LABELS: Record<Period, string> = {
  day:   'Hoje',
  month: 'Este mês',
  year:  'Este ano',
};

const MONTHS_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

// Months that trigger SS quarterly reminder (end of quarter)
const SS_REMINDER_MONTHS = [3, 6, 9, 12];

const SS_DIRETA_URL = 'https://www.seg-social.pt/inicio';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `€${n.toFixed(2)}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

function isQuarterReminder(): boolean {
  return SS_REMINDER_MONTHS.includes(new Date().getMonth() + 1);
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function EarningsScreen() {
  const router = useRouter();

  const now = new Date();
  const [period,  setPeriod]  = useState<Period>('month');
  const [report,  setReport]  = useState<EarningsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

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
      setError(err instanceof Error ? err.message : 'Erro ao carregar ganhos.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const handleSsLink = () => {
    Alert.alert(
      'Segurança Social Direta',
      'Será redireccionado para o portal da Segurança Social para submeter a tua declaração trimestral.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir', onPress: () => Linking.openURL(SS_DIRETA_URL) },
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
          <Text style={s.headerTitle}>Os Meus Ganhos</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Period toggle */}
        <View style={s.periodRow}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[s.periodBtn, period === p && s.periodBtnActive]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.8}
            >
              <Text style={[s.periodLabel, period === p && s.periodLabelActive]}>
                {PERIOD_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Quarterly SS reminder */}
        {isQuarterReminder() && (
          <TouchableOpacity style={s.ssReminder} onPress={handleSsLink} activeOpacity={0.85}>
            <Text style={s.ssReminderIcon}>🏛️</Text>
            <View style={s.ssReminderBody}>
              <Text style={s.ssReminderTitle}>Lembrete SS trimestral</Text>
              <Text style={s.ssReminderText}>
                {MONTHS_PT[now.getMonth()]} é mês de declaração. Não te esqueças de submeter
                os teus rendimentos na Segurança Social antes do fim do mês.
              </Text>
              <Text style={s.ssReminderLink}>Abrir SS Direta →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Loading */}
        {loading && (
          <View style={s.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={s.loadingText}>A carregar ganhos…</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error !== '' && (
          <View style={s.errorCard}>
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={load}>
              <Text style={s.retryText}>Tentar novamente</Text>
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
                label="Bruto"
                value={fmt(report.totalGross)}
                accent="#6a79ff"
              />
              <View style={s.kpiDivider} />
              <KpiCard
                icon="✅"
                label="Recebido"
                value={fmt(report.workerNet)}
                accent="#16a34a"
              />
              <View style={s.kpiDivider} />
              <KpiCard
                icon="📋"
                label="Turnos"
                value={String(report.shiftCount)}
                accent="#f59e0b"
              />
            </View>

            {/* Fee & TSU breakdown */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Detalhe de ganhos</Text>

              <Row label="Valor bruto (pago pela empresa)" value={fmt(report.totalGross)} bold />
              <Divider />
              <Row
                label="TSU a entregar ao Estado (11%)"
                value={fmt(report.workerTsuOwed)}
                accent="#d97706"
              />
              <Row label="Estimativa após TSU" value={fmt(report.workerNet)} />
              <View style={s.tsuNote}>
                <Text style={s.tsuNoteText}>
                  ⚠️ Recebes o valor bruto por inteiro, diretamente da empresa — a Turnos
                  não cobra qualquer taxa aos trabalhadores. Como trabalhador és responsável
                  por declarar e pagar <Text style={s.tsuNoteStrong}>11% do teu valor bruto</Text> à
                  Segurança Social (valor informativo acima).
                </Text>
              </View>
            </View>

            {/* Shift list */}
            {report.records.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>
                  Turnos concluídos — {PERIOD_LABELS[period].toLowerCase()}
                </Text>
                {report.records.map(r => (
                  <EarningRow key={r.id} record={r} />
                ))}
              </View>
            )}

            {report.records.length === 0 && (
              <View style={s.emptyCard}>
                <Text style={s.emptyIcon}>💶</Text>
                <Text style={s.emptyTitle}>Sem turnos pagos {PERIOD_LABELS[period].toLowerCase()}</Text>
                <Text style={s.emptySub}>
                  Os teus ganhos aparecem aqui após o check-out e processamento do pagamento.
                </Text>
              </View>
            )}

            {/* SS CTA */}
            <TouchableOpacity style={s.ssCta} onPress={handleSsLink} activeOpacity={0.85}>
              <Text style={s.ssCtaIcon}>🏛️</Text>
              <View style={s.ssCtaBody}>
                <Text style={s.ssCtaTitle}>Segurança Social Direta</Text>
                <Text style={s.ssCtaText}>
                  Declara os teus rendimentos trimestralmente no portal SS.
                </Text>
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
  return (
    <View style={se.row}>
      <View style={se.left}>
        <Text style={se.date}>{record.shiftDate ? fmtDate(record.shiftDate) : '—'}</Text>
        <Text style={se.hours}>{Number(record.scheduledHours ?? 0).toFixed(1)}h</Text>
      </View>
      <View style={se.right}>
        <Text style={se.gross}>{fmt(Number(record.grossAmount))}</Text>
        <Text style={se.net}>Líq. {fmt(Number(record.workerNet ?? 0))}</Text>
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

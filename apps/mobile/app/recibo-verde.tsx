/**
 * /recibo-verde — Recibo Verde submission reminder screen.
 *
 * Workers on MCD contracts must submit their own "Recibo Verde" (green
 * receipt) via Portal das Finanças (AT) for each completed shift.
 *
 * This screen is reached from:
 *   a) Tapping a push notification (deep-link from recibo-verde BullMQ job)
 *   b) Navigating from My Shifts → completed shift card
 *
 * Route params:
 *   shiftId    — UUID of the completed shift
 *   shiftTitle — display name
 *   shiftDate  — YYYY-MM-DD
 *   grossAmount — total gross in euros (string, as Expo passes everything as string)
 */
import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';
import { useT } from '../lib/i18n';

/** Step ids — the visible text lives in the catalogue. */
const STEP_KEYS = ['s1', 's2', 's3', 's4', 's5'] as const;

const PORTAL_FINANCAS_URL = 'https://irs.portaldasfinancas.gov.pt/recibos/emitirRecibo.action';
const WORKER_TSU_RATE     = 0.11; // 11 % — informative, paid by the worker to the State

export default function ReciboVerdeScreen() {
  const router = useRouter();
  const { t, fLongDate } = useT();
  const params = useLocalSearchParams<{
    shiftId:     string;
    shiftTitle:  string;
    shiftDate:   string;
    grossAmount: string;
  }>();

  const [submitted, setSubmitted] = useState(false);

  const gross      = parseFloat(params.grossAmount ?? '0');
  // The company pays the full gross directly to the worker — no Turnos fee.
  const tsuAmount  = gross * WORKER_TSU_RATE;    // informative: what the worker pays the State

  const handleOpenPortal = async () => {
    try {
      await Linking.openURL(PORTAL_FINANCAS_URL);
    } catch {
      Alert.alert(t('common.error'), t('mobile.reciboVerde.portalError'));
    }
  };

  const handleConfirmSubmission = () => {
    Alert.alert(
      t('mobile.reciboVerde.confirmTitle'),
      t('mobile.reciboVerde.confirmBody'),
      [{ text: t('common.close'), onPress: () => { setSubmitted(true); router.back(); } }],
    );
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <LinearGradient
        colors={['#16a34a', '#15803d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.header}
      >
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('mobile.reciboVerde.title')}</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={s.headerSub}>{t('mobile.reciboVerde.headerSub')}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Shift info banner */}
        <View style={s.shiftCard}>
          <Text style={s.shiftTitle}>{params.shiftTitle ?? t('mobile.reciboVerde.shiftFallback')}</Text>
          {params.shiftDate ? (
            <Text style={s.shiftDate}>{fLongDate(params.shiftDate + 'T12:00:00')}</Text>
          ) : null}
        </View>

        {/* What is Recibo Verde? */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('mobile.reciboVerde.whatTitle')}</Text>
          <Text style={s.cardBody}>
            {t('mobile.reciboVerde.whatBody1')}
            <Text style={s.bold}>{t('mobile.reciboVerde.whatBoldReceipt')}</Text>
            {t('mobile.reciboVerde.whatBody2')}
            <Text style={s.bold}>{t('mobile.reciboVerde.whatBoldDeadline')}</Text>
            {t('mobile.reciboVerde.whatBody3')}
          </Text>
        </View>

        {/* Pre-filled values */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('mobile.reciboVerde.valuesTitle')}</Text>
          <Text style={s.cardHint}>{t('mobile.reciboVerde.valuesHint')}</Text>

          <View style={s.valueRow}>
            <Text style={s.valueLabel}>{t('mobile.reciboVerde.valueGross')}</Text>
            <Text style={s.valueAmount}>€{gross.toFixed(2)}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.valueRow}>
            <Text style={[s.valueLabel, s.bold]}>{t('mobile.reciboVerde.valueReceived')}</Text>
            <Text style={[s.valueAmount, s.amountGreen, s.bold]}>€{gross.toFixed(2)}</Text>
          </View>

          <View style={s.divider} />

          <View style={[s.valueRow, s.tsuRow]}>
            <Text style={s.tsuLabel}>{t('mobile.reciboVerde.valueTsu')}</Text>
            <Text style={s.tsuAmount}>€{tsuAmount.toFixed(2)}</Text>
          </View>
          <Text style={s.tsuNote}>{t('mobile.reciboVerde.tsuNote')}</Text>
        </View>

        {/* Steps */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('mobile.reciboVerde.howTitle')}</Text>
          {STEP_KEYS.map((key, i) => (
            <View key={key} style={s.step}>
              <View style={s.stepBadge}>
                <Text style={s.stepNum}>{i + 1}</Text>
              </View>
              <Text style={s.stepText}>{t(`mobile.reciboVerde.steps.${key}`)}</Text>
            </View>
          ))}
        </View>

        {/* CTA — open portal */}
        <TouchableOpacity style={s.portalBtn} onPress={handleOpenPortal} activeOpacity={0.85}>
          <LinearGradient
            colors={['#16a34a', '#15803d']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.portalBtnGradient}
          >
            <Text style={s.portalBtnText}>{t('mobile.reciboVerde.openPortal')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Confirm submission */}
        <TouchableOpacity
          style={[s.confirmBtn, submitted && s.confirmBtnDone]}
          onPress={submitted ? undefined : handleConfirmSubmission}
          activeOpacity={submitted ? 1 : 0.8}
        >
          <Text style={[s.confirmBtnText, submitted && s.confirmBtnTextDone]}>
            {submitted ? t('mobile.reciboVerde.confirmed') : t('mobile.reciboVerde.confirm')}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.secondary },

  // Header
  header: {
    paddingTop: 56, paddingBottom: 20, paddingHorizontal: spacing.md,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 22, fontWeight: fontWeight.bold as any },
  headerTitle: { color: '#fff', fontSize: fontSize.h3, fontWeight: fontWeight.bold as any },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.caption, textAlign: 'center' },

  // Scroll
  scroll: { padding: spacing.md, gap: 16 },

  // Shift banner
  shiftCard: {
    backgroundColor: '#fff', borderRadius: radius.lg,
    padding: spacing.md, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
    elevation: 2,
  },
  shiftTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.bold as any, color: colors.textPrimary, textAlign: 'center' },
  shiftDate: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 4 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: fontSize.caption, fontWeight: fontWeight.bold as any,
    color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  cardHint: { fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic' },
  cardBody: { fontSize: fontSize.body, color: colors.textPrimary, lineHeight: 22 },

  // Values
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  valueLabel: { fontSize: fontSize.body, color: colors.textPrimary },
  valueAmount: { fontSize: fontSize.body, color: colors.textPrimary, fontFamily: 'monospace' },
  amountRed: { color: '#dc2626' },
  amountGreen: { color: '#16a34a' },
  bold: { fontWeight: fontWeight.bold as any },
  divider: { height: 1, backgroundColor: '#f3f4f6' },

  // TSU note
  tsuRow: { marginTop: 2 },
  tsuLabel: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  tsuAmount: { fontSize: 12, color: colors.textSecondary, fontFamily: 'monospace' },
  tsuNote: { fontSize: 11, color: colors.textSecondary, lineHeight: 16, fontStyle: 'italic' },

  // Steps
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  stepNum: { fontSize: 11, fontWeight: fontWeight.bold as any, color: '#16a34a' },
  stepText: { fontSize: fontSize.body, color: colors.textPrimary, lineHeight: 22, flex: 1 },

  // Portal button
  portalBtn: {
    borderRadius: radius.full, overflow: 'hidden',
    shadowColor: '#16a34a', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  portalBtnGradient: { height: 56, alignItems: 'center', justifyContent: 'center' },
  portalBtnText: { color: '#fff', fontSize: fontSize.body, fontWeight: fontWeight.bold as any },

  // Confirm button
  confirmBtn: {
    borderWidth: 1.5, borderColor: '#16a34a', borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  confirmBtnDone: { borderColor: '#d1d5db', backgroundColor: '#f9fafb' },
  confirmBtnText: { color: '#16a34a', fontSize: fontSize.body, fontWeight: fontWeight.bold as any },
  confirmBtnTextDone: { color: colors.textSecondary },
});

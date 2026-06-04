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

const PORTAL_FINANCAS_URL = 'https://irs.portaldasfinancas.gov.pt/recibos/emitirRecibo.action';
const TURNOS_FEE_RATE     = 0.10; // 10 %
const WORKER_TSU_RATE     = 0.11; // 11 %

export default function ReciboVerdeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    shiftId:     string;
    shiftTitle:  string;
    shiftDate:   string;
    grossAmount: string;
  }>();

  const [submitted, setSubmitted] = useState(false);

  const gross      = parseFloat(params.grossAmount ?? '0');
  const turnosFee  = gross * TURNOS_FEE_RATE;
  const workerNet  = gross - turnosFee;          // what Turnos pays the worker
  const tsuAmount  = gross * WORKER_TSU_RATE;    // what worker pays the state (from workerNet)

  const handleOpenPortal = async () => {
    try {
      await Linking.openURL(PORTAL_FINANCAS_URL);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o Portal das Finanças. Acede em: irs.portaldasfinancas.gov.pt');
    }
  };

  const handleConfirmSubmission = () => {
    Alert.alert(
      'Recibo submetido! ✅',
      'Obrigado por confirmares. Ficamos à tua disposição caso precisares de ajuda.',
      [{ text: 'Fechar', onPress: () => { setSubmitted(true); router.back(); } }],
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
          <Text style={s.headerTitle}>Recibo Verde</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={s.headerSub}>
          Turno concluído — submete o teu recibo ao Estado
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Shift info banner */}
        <View style={s.shiftCard}>
          <Text style={s.shiftTitle}>{params.shiftTitle ?? 'Turno'}</Text>
          {params.shiftDate ? (
            <Text style={s.shiftDate}>
              {new Date(params.shiftDate + 'T12:00:00').toLocaleDateString('pt-PT', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </Text>
          ) : null}
        </View>

        {/* What is Recibo Verde? */}
        <View style={s.card}>
          <Text style={s.cardTitle}>O que é o Recibo Verde?</Text>
          <Text style={s.cardBody}>
            Como trabalhador independente em Contrato de Muito Curta Duração (MCD), tens de emitir
            um <Text style={s.bold}>Recibo Verde</Text> no Portal das Finanças para cada turno concluído.
            {'\n\n'}
            O prazo legal é de <Text style={s.bold}>5 dias úteis</Text> após a conclusão do turno.
            Guardar o comprovativo é obrigatório para declaração de IRS.
          </Text>
        </View>

        {/* Pre-filled values */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Valores para o teu recibo</Text>
          <Text style={s.cardHint}>Copia estes valores para o Portal das Finanças</Text>

          <View style={s.valueRow}>
            <Text style={s.valueLabel}>Valor bruto do turno</Text>
            <Text style={s.valueAmount}>€{gross.toFixed(2)}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.valueRow}>
            <Text style={s.valueLabel}>Taxa de serviço Turnos (10%)</Text>
            <Text style={[s.valueAmount, s.amountRed]}>− €{turnosFee.toFixed(2)}</Text>
          </View>

          <View style={s.valueRow}>
            <Text style={[s.valueLabel, s.bold]}>Valor que recebes</Text>
            <Text style={[s.valueAmount, s.amountGreen, s.bold]}>€{workerNet.toFixed(2)}</Text>
          </View>

          <View style={s.divider} />

          <View style={[s.valueRow, s.tsuRow]}>
            <Text style={s.tsuLabel}>ℹ️  SS Trabalhador (11% do bruto)</Text>
            <Text style={s.tsuAmount}>€{tsuAmount.toFixed(2)}</Text>
          </View>
          <Text style={s.tsuNote}>
            Este valor é entregue por ti ao Estado via Segurança Social Direta — não é deduzido pela Turnos.
          </Text>
        </View>

        {/* Steps */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Como submeter</Text>
          {STEPS.map((step, i) => (
            <View key={i} style={s.step}>
              <View style={s.stepBadge}>
                <Text style={s.stepNum}>{i + 1}</Text>
              </View>
              <Text style={s.stepText}>{step}</Text>
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
            <Text style={s.portalBtnText}>🌐  Abrir Portal das Finanças</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Confirm submission */}
        <TouchableOpacity
          style={[s.confirmBtn, submitted && s.confirmBtnDone]}
          onPress={submitted ? undefined : handleConfirmSubmission}
          activeOpacity={submitted ? 1 : 0.8}
        >
          <Text style={[s.confirmBtnText, submitted && s.confirmBtnTextDone]}>
            {submitted ? '✅  Recibo já submetido' : 'Já submeti o meu recibo'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const STEPS = [
  'Acede ao Portal das Finanças com o teu NIF e senha.',
  'Vai a "Recibos Verdes" → "Emitir Recibo".',
  'Seleciona "Prestação de Serviços" e preenche com o valor bruto do turno.',
  'Indica o NIF do empregador (encontras na proposta do turno).',
  'Emite o recibo e guarda o comprovativo em PDF.',
];

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

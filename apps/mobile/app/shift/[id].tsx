import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, radius, fontSize, fontWeight, calculateTSU } from '@turnos/shared';
import {
  shiftApi, ShiftSummary, MyApplication, ApiError,
  attendanceApi, AttendanceRecord,
} from '../../lib/api';

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === tomorrow.toDateString()) return 'Amanhã';
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' });
}

function hoursWorked(start: string, end: string): number {
  const sp = start.split(':').map(Number);
  const ep = end.split(':').map(Number);
  const sh = sp[0] ?? 0, sm = sp[1] ?? 0;
  const eh = ep[0] ?? 0, em = ep[1] ?? 0;
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? mins / 60 : 0;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [shift, setShift]           = useState<ShiftSummary | null>(null);
  const [myApp, setMyApp]           = useState<MyApplication | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied]       = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      // Fetch shift data + worker's application status in parallel.
      // Attendance is fetched alongside — gracefully ignored if 401/404.
      const [shiftData, myApps, att] = await Promise.all([
        shiftApi.getById(id),
        shiftApi.getMyApplications().catch(() => [] as MyApplication[]),
        attendanceApi.getAttendance(id).catch(() => null),
      ]);

      setShift(shiftData);
      setMyApp(myApps.find(a => a.shift.id === id) ?? null);
      setAttendance(att);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar o turno.', [
        { text: 'Voltar', onPress: () => router.back() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  // ── apply ─────────────────────────────────────────────────────────────────

  const handleApply = async () => {
    if (!shift) return;
    setIsApplying(true);
    try {
      await shiftApi.apply(shift.id);
      setApplied(true);
      Alert.alert(
        'Candidatura enviada!',
        'A sua candidatura foi enviada. Será notificado quando a empresa responder.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erro ao candidatar-se.';
      Alert.alert('Erro', msg);
    } finally {
      setIsApplying(false);
    }
  };

  // ── derived state ─────────────────────────────────────────────────────────

  const isApproved = myApp?.status === 'APPROVED';
  const hasPending = myApp?.status === 'PENDING';
  const hasRejected = myApp?.status === 'REJECTED';

  const showCheckIn =
    isApproved &&
    shift?.status === 'FILLED' &&
    !attendance?.checkInAt;

  const showCheckOut =
    isApproved &&
    shift?.status === 'ACTIVE' &&
    attendance?.status === 'CHECKED_IN';

  const isShiftDone =
    attendance?.status === 'COMPLETED' ||
    attendance?.status === 'MANUAL' ||
    shift?.status === 'COMPLETED';

  const showApplyButton =
    !applied &&
    !myApp &&
    shift?.status === 'OPEN';

  // ── render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!shift) return null;

  const tsu             = calculateTSU(Number(shift.grossHourlyRate));
  const hours           = hoursWorked(shift.startTime, shift.endTime);
  const estimatedPayout = tsu.workerNetAmount * hours;

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>

        {/* Header bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {shift.title || shift.subcategory}
          </Text>
        </View>

        <View style={styles.content}>

          {/* Title row */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{shift.title || shift.subcategory}</Text>
              <Text style={styles.employer}>{shift.employer?.companyName ?? 'Empresa'}</Text>
            </View>
            <View style={styles.ratePill}>
              <Text style={styles.rateValue}>€{Number(shift.grossHourlyRate).toFixed(2)}</Text>
              <Text style={styles.rateUnit}>/hr</Text>
            </View>
          </View>

          {/* Attendance status banner — shown when worker is assigned */}
          {isApproved && (
            <View style={[
              styles.statusBanner,
              isShiftDone          ? styles.bannerDone
              : showCheckOut       ? styles.bannerActive
              : showCheckIn        ? styles.bannerFilled
                                   : styles.bannerFilled,
            ]}>
              <Text style={styles.statusBannerText}>
                {isShiftDone
                  ? '✅ Turno concluído — pagamento a processar'
                  : showCheckOut
                    ? '🟢 Em curso — faça check-out ao terminar'
                    : '📋 Confirmado — faça check-in ao chegar'}
              </Text>
            </View>
          )}

          {/* Pay breakdown */}
          <View style={styles.payBox}>
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Bruto/hora</Text>
              <Text style={styles.payVal}>€{tsu.grossAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>TSU trabalhador (11%)</Text>
              <Text style={[styles.payVal, { color: '#ef4444' }]}>− €{tsu.workerDeduction.toFixed(2)}</Text>
            </View>
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Taxa Turnos (10%)</Text>
              <Text style={[styles.payVal, { color: '#ef4444' }]}>− €{tsu.turnosFee.toFixed(2)}</Text>
            </View>
            <View style={[styles.payRow, styles.payTotal]}>
              <Text style={styles.payTotalLabel}>Líquido/hora</Text>
              <Text style={styles.payTotalVal}>€{tsu.workerNetAmount.toFixed(2)}</Text>
            </View>
            <Text style={styles.recebe}>💳 Recebe amanhã</Text>
          </View>

          {/* Info card */}
          <View style={styles.infoCard}>
            <InfoRow icon="📅" label="Data" value={formatDate(shift.date)} />
            <InfoRow icon="⏰" label="Horário" value={`${shift.startTime.slice(0, 5)} – ${shift.endTime.slice(0, 5)}`} />
            {hours > 0 && <InfoRow icon="🕐" label="Duração" value={`${hours.toFixed(1)}h`} />}
            <InfoRow icon="📍" label="Morada" value={shift.address} last />
          </View>

          {/* Skills */}
          {shift.skillsRequired && shift.skillsRequired.length > 0 && (
            <View style={styles.skillsSection}>
              <Text style={styles.sectionTitle}>Competências necessárias</Text>
              <View style={styles.skillsWrap}>
                {shift.skillsRequired.map(skill => (
                  <View key={skill} style={styles.skillChip}>
                    <Text style={styles.skillText}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          {shift.description && (
            <View style={styles.descSection}>
              <Text style={styles.sectionTitle}>Sobre o turno</Text>
              <Text style={styles.description}>{shift.description}</Text>
            </View>
          )}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* ── Sticky bottom bar ─────────────────────────────────────────────── */}
      <View style={styles.bottomBar}>

        {/* ① Shift done */}
        {isShiftDone && (
          <View style={styles.doneBox}>
            <Text style={styles.doneIcon}>✅</Text>
            <Text style={styles.doneText}>Turno concluído{'\n'}
              <Text style={styles.doneSubText}>
                {attendance?.scheduledHours
                  ? `${attendance.scheduledHours}h pagas · recebe amanhã`
                  : 'Pagamento a processar'}
              </Text>
            </Text>
          </View>
        )}

        {/* ② Check-in button */}
        {!isShiftDone && showCheckIn && (
          <>
            {hours > 0 && (
              <View style={styles.payoutBox}>
                <Text style={styles.payoutLabel}>Total estimado</Text>
                <Text style={styles.payoutValue}>€{estimatedPayout.toFixed(2)}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.checkInBtn]}
              onPress={() => router.push(`/scan?action=check-in`)}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>📷 Fazer Check-in</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ③ Check-out button */}
        {!isShiftDone && showCheckOut && (
          <>
            {attendance?.checkInAt && (
              <View style={styles.payoutBox}>
                <Text style={styles.payoutLabel}>Check-in às</Text>
                <Text style={styles.payoutValue}>
                  {new Date(attendance.checkInAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.checkOutBtn]}
              onPress={() => router.push(`/scan?action=check-out`)}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>📷 Fazer Check-out</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ④ Apply button (OPEN shift, no application yet) */}
        {!isShiftDone && !showCheckIn && !showCheckOut && showApplyButton && (
          <>
            {hours > 0 && (
              <View style={styles.payoutBox}>
                <Text style={styles.payoutLabel}>Estimativa total</Text>
                <Text style={styles.payoutValue}>€{estimatedPayout.toFixed(2)}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.applyBtn, isApplying && styles.applyBtnDisabled]}
              onPress={handleApply}
              disabled={isApplying}
              activeOpacity={0.85}
            >
              <Text style={styles.applyBtnText}>
                {isApplying ? 'A candidatar...' : 'Candidatar-me'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ⑤ Application already sent (just applied) */}
        {!isShiftDone && !showCheckIn && !showCheckOut && (applied || hasPending) && (
          <View style={styles.pendingBox}>
            <Text style={styles.pendingIcon}>⏳</Text>
            <Text style={styles.pendingText}>Candidatura enviada — a aguardar confirmação</Text>
          </View>
        )}

        {/* ⑥ Rejected */}
        {!isShiftDone && !showCheckIn && !showCheckOut && hasRejected && (
          <View style={styles.rejectedBox}>
            <Text style={styles.pendingIcon}>✕</Text>
            <Text style={styles.pendingText}>Candidatura não selecionada</Text>
          </View>
        )}

        {/* ⑦ Cancelled shift */}
        {shift.status === 'CANCELLED' && (
          <View style={styles.pendingBox}>
            <Text style={styles.pendingIcon}>🚫</Text>
            <Text style={styles.pendingText}>Este turno foi cancelado</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 }]}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  container: { flex: 1, backgroundColor: colors.secondary },

  headerBar: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 56,
    paddingHorizontal: spacing.md, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.neutral, gap: spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.secondary,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: colors.textPrimary },
  headerTitle: { flex: 1, fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: colors.textPrimary },

  content: { padding: spacing.md },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: spacing.md },
  title: { fontSize: fontSize.h2, fontWeight: fontWeight.extrabold, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 4 },
  employer: { fontSize: fontSize.body, color: colors.textSecondary, fontWeight: fontWeight.semibold },
  ratePill: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'baseline', gap: 2, flexShrink: 0,
  },
  rateValue: { fontSize: fontSize.h2, fontWeight: fontWeight.extrabold, color: '#fff' },
  rateUnit: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: fontWeight.semibold },

  // Status banner
  statusBanner: {
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10,
    marginBottom: spacing.md, borderWidth: 1,
  },
  bannerFilled:  { backgroundColor: '#ede9fe', borderColor: 'rgba(124,58,237,0.25)' },
  bannerActive:  { backgroundColor: '#dcfce7', borderColor: 'rgba(22,163,74,0.25)' },
  bannerDone:    { backgroundColor: '#cffafe', borderColor: 'rgba(8,145,178,0.25)' },
  statusBannerText: { fontSize: 13, fontWeight: fontWeight.semibold, color: colors.textPrimary },

  payBox: {
    backgroundColor: '#f0f4ff', borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(99,102,241,0.15)',
  },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  payLabel: { fontSize: 13, color: '#4338ca' },
  payVal: { fontSize: 13, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  payTotal: { borderTopWidth: 1, borderTopColor: 'rgba(99,102,241,0.2)', paddingTop: 8, marginTop: 4, marginBottom: 8 },
  payTotalLabel: { fontSize: 14, fontWeight: fontWeight.bold, color: colors.textPrimary },
  payTotalVal: { fontSize: 16, fontWeight: fontWeight.extrabold, color: colors.primary },
  recebe: { fontSize: 12, color: '#7c3aed', fontWeight: fontWeight.semibold, textAlign: 'center' },

  infoCard: {
    backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.neutral,
  },
  infoRow: {
    flexDirection: 'row', gap: 10, paddingBottom: spacing.sm, marginBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.neutral,
  },
  infoIcon: { fontSize: 18, marginTop: 2 },
  infoLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: fontWeight.semibold, marginBottom: 2 },
  infoValue: { fontSize: 14, color: colors.textPrimary, fontWeight: fontWeight.semibold },

  skillsSection: { marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: {
    backgroundColor: colors.primaryLight, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(106,121,255,0.3)',
  },
  skillText: { fontSize: 12, color: colors.primary, fontWeight: fontWeight.semibold },

  descSection: { marginBottom: spacing.md },
  description: { fontSize: fontSize.body, color: colors.textPrimary, lineHeight: 24 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: spacing.md,
    paddingTop: spacing.md, paddingBottom: 40,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderTopWidth: 1, borderTopColor: colors.neutral,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 12,
  },

  // Done state
  doneBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneIcon: { fontSize: 24 },
  doneText: { fontSize: 14, fontWeight: fontWeight.bold, color: colors.textPrimary },
  doneSubText: { fontSize: 12, color: colors.textSecondary, fontWeight: fontWeight.regular },

  // Check-in / check-out buttons
  checkInBtn: {
    flex: 2, backgroundColor: '#7c3aed', borderRadius: radius.full,
    height: 52, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  checkOutBtn: {
    flex: 2, backgroundColor: '#16a34a', borderRadius: radius.full,
    height: 52, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#16a34a', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  actionBtnText: { color: '#fff', fontSize: fontSize.body, fontWeight: fontWeight.bold },

  // Apply button
  payoutBox: { flex: 1 },
  payoutLabel: { fontSize: fontSize.caption, color: colors.textSecondary },
  payoutValue: { fontSize: fontSize.h2, fontWeight: fontWeight.extrabold, color: colors.textPrimary },
  applyBtn: {
    flex: 2, backgroundColor: colors.primary, borderRadius: radius.full,
    height: 52, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  applyBtnDisabled: { backgroundColor: '#9ca3af', shadowOpacity: 0, elevation: 0 },
  applyBtnText: { color: '#fff', fontSize: fontSize.body, fontWeight: fontWeight.bold },

  // Pending / rejected state
  pendingBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fffbeb', borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  rejectedBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fee2e2', borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  pendingIcon: { fontSize: 18 },
  pendingText: { flex: 1, fontSize: 13, fontWeight: fontWeight.semibold, color: colors.textPrimary },
});

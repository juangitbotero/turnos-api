import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';
import { shiftApi, ratingsApi, MyApplication, ApiError } from '../lib/api';
import { getSocket, ShiftStatusChangedPayload, ShiftCancelledPayload } from '../lib/socket';
import { formatDate } from '../lib/format';

type AppStatus = MyApplication['status'];

const STATUS_LABEL: Record<AppStatus, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Confirmado',
  REJECTED: 'Rejeitado',
  WITHDRAWN: 'Retirado',
};

const STATUS_COLOR: Record<AppStatus, { bg: string; text: string; border: string }> = {
  PENDING: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  APPROVED: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  REJECTED: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  WITHDRAWN: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
};

/** Returns true if the shift has ended (by shift.status or by wall-clock time). */
function isShiftOver(app: MyApplication): boolean {
  if (app.shift.status === 'COMPLETED') return true;
  if (app.status !== 'APPROVED') return false;
  // Fall back to wall-clock: combine date (YYYY-MM-DD) + endTime (HH:MM:SS)
  try {
    const [y, mo, d] = app.shift.date.split('-').map(Number);
    const [h, m] = app.shift.endTime.split(':').map(Number);
    const endDt = new Date(y, (mo ?? 1) - 1, d ?? 1, h ?? 0, m ?? 0);
    return endDt < new Date();
  } catch {
    return false;
  }
}

function formatAppliedAt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function MyShiftsScreen() {
  const router = useRouter();
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ratedShiftIds, setRatedShiftIds] = useState<Set<string>>(new Set());

  const load = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await shiftApi.getMyApplications();
      setApplications(data);

      // Check which concluded shifts have already been rated (best-effort, ignore errors)
      const completedIds = data
        .filter(a => a.status === 'APPROVED' && a.shift.status === 'COMPLETED')
        .map(a => a.shift.id);

      if (completedIds.length > 0) {
        const results = await Promise.allSettled(
          completedIds.map(id => ratingsApi.hasRatedShift(id)),
        );
        const rated = new Set<string>();
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.hasRated) rated.add(completedIds[i]!);
        });
        setRatedShiftIds(rated);
      }
    } catch {
      setApplications([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // ── Real-time socket events ───────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onStatusChanged = (payload: ShiftStatusChangedPayload) => {
      // Update the local application status without a full reload
      setApplications(prev =>
        prev.map(app =>
          app.id === payload.applicationId
            ? { ...app, status: payload.status }
            : app,
        ),
      );
    };

    const onCancelled = (payload: ShiftCancelledPayload) => {
      // Remove cancelled shift from the list (or mark as WITHDRAWN)
      setApplications(prev =>
        prev.filter(app => app.shift.id !== payload.shiftId),
      );
    };

    socket.on('shift:status_changed', onStatusChanged);
    socket.on('shift:cancelled', onCancelled);

    return () => {
      socket.off('shift:status_changed', onStatusChanged);
      socket.off('shift:cancelled', onCancelled);
    };
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Cancel a confirmed shift (24h rule) ──────────────────────────────────
  const handleCancelConfirmed = useCallback((app: MyApplication) => {
    const shiftStart = new Date(`${app.shift.date}T${app.shift.startTime.slice(0, 5)}:00`);
    const hoursUntil = (shiftStart.getTime() - Date.now()) / (1000 * 60 * 60);
    const isLate = hoursUntil <= 24;

    Alert.alert(
      'Cancelar turno',
      isLate
        ? 'Faltam menos de 24h para o início. Cancelar agora conta como cancelamento tardio e afeta a tua fiabilidade (2 em 30 dias = suspensão de 7 dias). Queres continuar?'
        : 'Tens a certeza que queres cancelar este turno confirmado? Como faltam mais de 24h, não há penalização.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: isLate ? 'Cancelar mesmo assim' : 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await shiftApi.cancelAssignment(app.shift.id);
              Alert.alert('Turno cancelado', res.message);
              load();
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : 'Não foi possível cancelar o turno.';
              Alert.alert('Erro', msg);
            }
          },
        },
      ],
    );
  }, [load]);

  // ── Section buckets ──────────────────────────────────────────────────────
  // 0. Pré-selecionado — employer selected this worker, awaiting worker confirmation
  const preSelected = applications.filter(a => a.status === 'APPROVED' && a.shift.status === 'PENDING_ACCEPTANCE');
  // 1. Em curso — APPROVED + shift is currently ACTIVE
  const nowActive   = applications.filter(a => a.status === 'APPROVED' && a.shift.status === 'ACTIVE');
  // 2. Concluídos — APPROVED + shift has ended (status COMPLETED or end time passed)
  const concluded   = applications.filter(a => a.status === 'APPROVED' && isShiftOver(a) && a.shift.status !== 'ACTIVE');
  // 3. Confirmados — APPROVED + not yet started / not completed / not pre-selected
  const confirmed   = applications.filter(a => a.status === 'APPROVED' && !isShiftOver(a) && a.shift.status !== 'ACTIVE' && a.shift.status !== 'PENDING_ACCEPTANCE');
  // 4. Pendentes — awaiting employer decision
  const pending     = applications.filter(a => a.status === 'PENDING');
  // 5. Histórico — rejected or withdrawn
  const history     = applications.filter(a => a.status === 'REJECTED' || a.status === 'WITHDRAWN');

  return (
    <View style={s.root}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Os Meus Turnos</Text>
          <Text style={s.headerSub}>{applications.length} candidatura{applications.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.loadingText}>A carregar candidaturas...</Text>
        </View>
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={null}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <>
              {applications.length === 0 && (
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>📋</Text>
                  <Text style={s.emptyTitle}>Ainda sem candidaturas</Text>
                  <Text style={s.emptySub}>Explore os turnos disponíveis e candidate-se ao primeiro!</Text>
                  <TouchableOpacity style={s.exploreBtn} onPress={() => router.back()} activeOpacity={0.85}>
                    <Text style={s.exploreBtnText}>Ver Turnos</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ⚡ Pre-selected — worker must accept/decline within 2h */}
              {preSelected.length > 0 && (
                <>
                  <Text style={s.sectionTitle}>⚡ Ação necessária</Text>
                  {preSelected.map(app => (
                    <PreSelectedCard
                      key={app.id}
                      app={app}
                      onPress={() => router.push(`/shift/${app.shift.id}`)}
                      onAccept={async () => {
                        try {
                          await shiftApi.confirm(app.shift.id);
                          load(); // refresh list
                        } catch (e: any) {
                          Alert.alert('Erro', e?.message ?? 'Não foi possível confirmar.');
                        }
                      }}
                      onDecline={async () => {
                        Alert.alert(
                          'Recusar turno?',
                          'Tens a certeza que queres recusar este turno? Ele voltará a ficar disponível para outros trabalhadores.',
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Recusar', style: 'destructive',
                              onPress: async () => {
                                try {
                                  await shiftApi.decline(app.shift.id);
                                  load();
                                } catch (e: any) {
                                  Alert.alert('Erro', e?.message ?? 'Não foi possível recusar.');
                                }
                              },
                            },
                          ],
                        );
                      }}
                    />
                  ))}
                </>
              )}

              {nowActive.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, preSelected.length > 0 && { marginTop: spacing.lg }]}>🟢 Em curso</Text>
                  {nowActive.map(app => (
                    <ApplicationCard key={app.id} app={app} onPress={() => router.push(`/shift/${app.shift.id}`)} />
                  ))}
                </>
              )}

              {confirmed.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, nowActive.length > 0 && { marginTop: spacing.lg }]}>✅ Confirmados</Text>
                  {confirmed.map(app => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      onPress={() => router.push(`/shift/${app.shift.id}`)}
                      onCancel={() => handleCancelConfirmed(app)}
                    />
                  ))}
                </>
              )}

              {pending.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, (nowActive.length > 0 || confirmed.length > 0) && { marginTop: spacing.lg }]}>⏳ Pendentes</Text>
                  {pending.map(app => (
                    <ApplicationCard key={app.id} app={app} onPress={() => router.push(`/shift/${app.shift.id}`)} />
                  ))}
                </>
              )}

              {concluded.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: spacing.lg }]}>🏁 Concluídos</Text>
                  {concluded.map(app => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      onPress={() => router.push(`/shift/${app.shift.id}`)}
                      isRated={ratedShiftIds.has(app.shift.id)}
                      onRate={() => router.push(`/rate/${app.shift.id}`)}
                    />
                  ))}
                </>
              )}

              {history.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: spacing.lg }]}>Histórico</Text>
                  {history.map(app => (
                    <ApplicationCard key={app.id} app={app} onPress={() => router.push(`/shift/${app.shift.id}`)} />
                  ))}
                </>
              )}

              <View style={{ height: 100 }} />
            </>
          }
        />
      )}

      {/* Bottom nav */}
      <View style={s.bottomNav}>
        <TouchableOpacity style={s.navItem} onPress={() => router.replace('/')} activeOpacity={0.7}>
          <Ionicons name="compass-outline" size={24} color={colors.textSecondary} />
          <Text style={s.navLabel}>Turnos</Text>
        </TouchableOpacity>
        <View style={s.navItemActive}>
          <Ionicons name="briefcase" size={24} color={colors.primary} />
          <Text style={s.navLabelActive}>Os Meus</Text>
        </View>
        <TouchableOpacity style={s.navItem} onPress={() => router.push('/profile')} activeOpacity={0.7}>
          <Ionicons name="person-circle-outline" size={24} color={colors.textSecondary} />
          <Text style={s.navLabel}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Pre-selected card with Accept / Decline ───────────────────────────────────
function PreSelectedCard({
  app, onPress, onAccept, onDecline,
}: {
  app: MyApplication;
  onPress: () => void;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const shift = app.shift;

  return (
    <TouchableOpacity style={s.preCard} onPress={onPress} activeOpacity={0.9}>
      {/* Urgency banner */}
      <View style={s.preBanner}>
        <Ionicons name="flash" size={14} color="#fff" />
        <Text style={s.preBannerText}>Tens 2h para aceitar este turno</Text>
      </View>

      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={1}>
          {shift.title || shift.subcategory}
        </Text>
        <Text style={s.cardEmployer}>{shift.employer?.companyName ?? 'Empresa'}</Text>
        <View style={s.cardMeta}>
          <View style={s.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
            <Text style={s.metaText}>{new Date(shift.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</Text>
          </View>
          <View style={s.metaItem}>
            <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
            <Text style={s.metaText}>{shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}</Text>
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={s.preActions}>
        <TouchableOpacity
          style={[s.preDecline, declining && { opacity: 0.6 }]}
          onPress={async () => { setDeclining(true); await onDecline(); setDeclining(false); }}
          disabled={accepting || declining}
          activeOpacity={0.8}
        >
          <Text style={s.preDeclineText}>{declining ? '...' : 'Recusar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.preAccept, accepting && { opacity: 0.6 }]}
          onPress={async () => { setAccepting(true); await onAccept(); setAccepting(false); }}
          disabled={accepting || declining}
          activeOpacity={0.85}
        >
          <Text style={s.preAcceptText}>{accepting ? 'A confirmar...' : '✓ Aceitar'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function ApplicationCard({
  app,
  onPress,
  isRated,
  onRate,
  onCancel,
}: {
  app: MyApplication;
  onPress: () => void;
  isRated?: boolean;
  onRate?: () => void;
  onCancel?: () => void;
}) {
  const shift = app.shift;

  // Derive badge from real-world state rather than just application status
  let badgeLabel: string;
  let badgeStyle: { bg: string; text: string; border: string };

  if (app.status === 'APPROVED' && shift.status === 'ACTIVE') {
    badgeLabel = 'Em curso';
    badgeStyle = { bg: '#dcfce7', text: '#166534', border: '#86efac' };
  } else if (app.status === 'APPROVED' && isShiftOver(app)) {
    badgeLabel = 'Concluído';
    badgeStyle = { bg: '#cffafe', text: '#0e7490', border: '#67e8f9' };
  } else {
    badgeLabel = STATUS_LABEL[app.status];
    badgeStyle = STATUS_COLOR[app.status];
  }

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.92}>
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={1}>{shift.title || shift.subcategory}</Text>
          <Text style={s.cardEmployer}>{shift.employer?.companyName ?? 'Empresa'}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: badgeStyle.bg, borderColor: badgeStyle.border }]}>
          <Text style={[s.statusText, { color: badgeStyle.text }]}>{badgeLabel}</Text>
        </View>
      </View>

      <View style={s.cardDivider} />

      <View style={s.cardFooter}>
        <View style={s.footerChip}>
          <Text style={s.footerText}>📅 {formatDate(shift.date)}</Text>
        </View>
        <View style={s.footerChip}>
          <Text style={s.footerText}>⏰ {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}</Text>
        </View>
        <View style={s.footerChip}>
          <Text style={s.footerText}>€{Number(shift.grossHourlyRate).toFixed(2)}/hr</Text>
        </View>
      </View>

      <View style={s.cardBottom}>
        <Text style={s.appliedAt}>Candidatou-se em {formatAppliedAt(app.appliedAt)}</Text>
        {onRate !== undefined && (
          isRated ? (
            <View style={s.ratedChip}>
              <Text style={s.ratedChipText}>✓ Avaliado</Text>
            </View>
          ) : (
            <TouchableOpacity style={s.rateBtn} onPress={onRate} activeOpacity={0.85}>
              <Text style={s.rateBtnText}>⭐ Avaliar</Text>
            </TouchableOpacity>
          )
        )}
        {onCancel !== undefined && (
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.85}>
            <Text style={s.cancelBtnText}>Cancelar turno</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.secondary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: spacing.md,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral,
    gap: spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.secondary,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: colors.textPrimary },
  headerTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: colors.textPrimary },
  headerSub: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 1 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: fontSize.body, color: colors.textSecondary, fontWeight: fontWeight.semibold },

  listContent: { padding: spacing.md },

  sectionTitle: {
    fontSize: fontSize.h3,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyIcon: { fontSize: 56, marginBottom: 8 },
  emptyTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: colors.textPrimary },
  emptySub: { fontSize: fontSize.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
  exploreBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  exploreBtnText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.body },

  card: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  cardTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.extrabold, color: colors.textPrimary, letterSpacing: -0.3 },
  cardEmployer: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2, fontWeight: fontWeight.semibold },

  statusBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 11, fontWeight: fontWeight.bold },

  cardDivider: { height: 1, backgroundColor: colors.neutral, marginBottom: 10 },

  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  footerChip: {
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.neutral,
  },
  footerText: { fontSize: 11, color: colors.textSecondary, fontWeight: fontWeight.semibold },

  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  appliedAt: { fontSize: 11, color: colors.textSecondary, flex: 1 },

  rateBtn: {
    backgroundColor: '#fef9c3',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#fde047',
  },
  rateBtnText: { fontSize: 11, fontWeight: fontWeight.bold, color: '#854d0e' },

  cancelBtn: {
    backgroundColor: '#fff',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  cancelBtnText: { fontSize: 11, fontWeight: fontWeight.bold, color: '#dc2626' },

  ratedChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  ratedChipText: { fontSize: 11, fontWeight: fontWeight.semibold, color: '#6b7280' },

  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.neutral,
    paddingBottom: 28,
    paddingTop: 8,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navItemActive: { flex: 1, alignItems: 'center', gap: 3 },
  navLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: fontWeight.semibold },
  navLabelActive: { fontSize: 11, color: colors.primary, fontWeight: fontWeight.bold },

  // Pre-selected card
  preCard: {
    backgroundColor: '#fff', borderRadius: radius.lg, overflow: 'hidden',
    marginBottom: spacing.sm,
    borderWidth: 2, borderColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.15, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 4,
  },
  preBanner: {
    backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6,
  },
  preBannerText: { color: '#fff', fontSize: 12, fontWeight: fontWeight.bold },
  preActions: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: 4,
  },
  preDecline: {
    flex: 1, height: 42, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: '#fca5a5',
    alignItems: 'center', justifyContent: 'center',
  },
  preDeclineText: { color: '#dc2626', fontSize: 14, fontWeight: fontWeight.bold },
  preAccept: {
    flex: 2, height: 42, borderRadius: radius.full,
    backgroundColor: '#16a34a',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#16a34a', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 3,
  },
  preAcceptText: { color: '#fff', fontSize: 14, fontWeight: fontWeight.bold },
});

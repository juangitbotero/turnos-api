import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';
import { shiftApi, MyApplication } from '../lib/api';
import { getSocket, ShiftStatusChangedPayload, ShiftCancelledPayload } from '../lib/socket';

type AppStatus = MyApplication['status'];

const STATUS_LABEL: Record<AppStatus, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  WITHDRAWN: 'Retirado',
};

const STATUS_COLOR: Record<AppStatus, { bg: string; text: string; border: string }> = {
  PENDING: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  APPROVED: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  REJECTED: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  WITHDRAWN: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === tomorrow.toDateString()) return 'Amanhã';
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
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

  const load = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await shiftApi.getMyApplications();
      setApplications(data);
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

  const active = applications.filter(a => a.status === 'PENDING' || a.status === 'APPROVED');
  const past = applications.filter(a => a.status === 'REJECTED' || a.status === 'WITHDRAWN');

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

              {active.length > 0 && (
                <>
                  <Text style={s.sectionTitle}>Em curso</Text>
                  {active.map(app => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      onPress={() => router.push(`/shift/${app.shift.id}`)}
                    />
                  ))}
                </>
              )}

              {past.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: spacing.lg }]}>Histórico</Text>
                  {past.map(app => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      onPress={() => router.push(`/shift/${app.shift.id}`)}
                    />
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
          <Text style={s.navIcon}>🏠</Text>
          <Text style={s.navLabel}>Turnos</Text>
        </TouchableOpacity>
        <View style={s.navItemActive}>
          <Text style={s.navIconActive}>📋</Text>
          <Text style={s.navLabelActive}>Os Meus</Text>
        </View>
      </View>
    </View>
  );
}

function ApplicationCard({ app, onPress }: { app: MyApplication; onPress: () => void }) {
  const shift = app.shift;
  const st = STATUS_COLOR[app.status];
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.92}>
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={1}>{shift.title || shift.subcategory}</Text>
          <Text style={s.cardEmployer}>{shift.employer?.companyName ?? 'Empresa'}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
          <Text style={[s.statusText, { color: st.text }]}>{STATUS_LABEL[app.status]}</Text>
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

      <Text style={s.appliedAt}>Candidatou-se em {formatAppliedAt(app.appliedAt)}</Text>
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

  appliedAt: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

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
  navIcon: { fontSize: 22, opacity: 0.5 },
  navIconActive: { fontSize: 22 },
  navLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: fontWeight.semibold },
  navLabelActive: { fontSize: 11, color: colors.primary, fontWeight: fontWeight.bold },
});

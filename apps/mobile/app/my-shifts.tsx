import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  colors, spacing, radius, fontSize, fontWeight, PaymentMethod,
} from '@turnos/shared';
import { shiftApi, ratingsApi, wagesApi, MyApplication, WagePayment, ApiError } from '../lib/api';
import { getSocket, ShiftStatusChangedPayload, ShiftCancelledPayload } from '../lib/socket';
import { useT } from '../lib/i18n';
import { syncShiftToCalendar, isShiftInCalendar } from '../lib/calendar';

type AppStatus = MyApplication['status'];

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

/** Shift start as a Date, from date (YYYY-MM-DD) + startTime (HH:MM:SS). */
function shiftStart(app: MyApplication): Date {
  return new Date(`${app.shift.date}T${app.shift.startTime.slice(0, 5)}:00`);
}

/**
 * Whole calendar days until the shift starts, so an 18:00 shift today still
 * counts as 0 ("Hoje"/"Today") at 09:00. The label itself is built in the
 * component, where the translator is available.
 */
function daysUntil(start: Date): number {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round(
    (startOfDay(start).getTime() - startOfDay(new Date()).getTime()) / (24 * 60 * 60 * 1000),
  );
}

export default function MyShiftsScreen() {
  const router = useRouter();
  const { t } = useT();
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ratedShiftIds, setRatedShiftIds] = useState<Set<string>>(new Set());
  const [wagesByShift, setWagesByShift]   = useState<Record<string, WagePayment>>({});

  const load = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await shiftApi.getMyApplications();
      setApplications(data);

      // Payment status per shift (best-effort — chips simply hide on failure)
      wagesApi.mine()
        .then(wages => {
          const byShift: Record<string, WagePayment> = {};
          for (const w of wages) {
            // Completion wage wins over a cancellation minimum for the same shift
            if (!byShift[w.shiftId] || w.type === 'SHIFT_COMPLETION') byShift[w.shiftId] = w;
          }
          setWagesByShift(byShift);
        })
        .catch(() => {});

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
  const doCancelAssignment = useCallback(async (shiftId: string, reasonCategory?: string) => {
    try {
      const res = await shiftApi.cancelAssignment(shiftId, reasonCategory ? { reasonCategory } : undefined);
      Alert.alert(t('mobile.myShifts.cancelledTitle'), res.message);
      load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('mobile.myShifts.cancelFailed');
      Alert.alert(t('common.error'), msg);
    }
  }, [load, t]);

  const handleCancelConfirmed = useCallback((app: MyApplication) => {
    const shiftStart = new Date(`${app.shift.date}T${app.shift.startTime.slice(0, 5)}:00`);
    const hoursUntil = (shiftStart.getTime() - Date.now()) / (1000 * 60 * 60);
    const isLate = hoursUntil <= 24;

    Alert.alert(
      t('mobile.myShifts.cancelShift'),
      isLate
        ? t('mobile.myShifts.cancelLateBody')
        : t('mobile.myShifts.cancelFreeBody'),
      [
        { text: t('common.back'), style: 'cancel' },
        {
          text: isLate ? t('mobile.myShifts.cancelAnyway') : t('mobile.myShifts.cancelYes'),
          style: 'destructive',
          onPress: () => {
            if (!isLate) {
              void doCancelAssignment(app.shift.id);
              return;
            }
            // Late cancel — offer a justification (reviewed by Turnos in 48h;
            // if accepted the strike is removed). Android caps alerts at 3
            // buttons, so illness/injury share one option.
            Alert.alert(
              t('mobile.myShifts.reasonTitle'),
              t('mobile.myShifts.reasonBody'),
              [
                { text: t('mobile.myShifts.reasonIllness'),   onPress: () => void doCancelAssignment(app.shift.id, 'DOENCA') },
                { text: t('mobile.myShifts.reasonEmergency'), onPress: () => void doCancelAssignment(app.shift.id, 'EMERGENCIA') },
                { text: t('mobile.myShifts.reasonNone'), style: 'destructive', onPress: () => void doCancelAssignment(app.shift.id) },
              ],
            );
          },
        },
      ],
    );
  }, [doCancelAssignment, t]);

  // ── Wage trust loop: "Recebi" / "Não recebi" ──────────────────────────────
  const handleConfirmWage = useCallback((wage: WagePayment) => {
    Alert.alert(
      t('mobile.myShifts.wageConfirmTitle'),
      t('mobile.myShifts.wageConfirmBody', {
        amount: Number(wage.amount).toFixed(2),
        shift: wage.shiftTitle,
      }),
      [
        { text: t('common.back'), style: 'cancel' },
        {
          text: t('mobile.myShifts.wageNotReceived'),
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await wagesApi.flagNotReceived(wage.id);
              setWagesByShift(prev => ({ ...prev, [wage.shiftId]: updated }));
              Alert.alert(t('mobile.myShifts.wageFlaggedTitle'), t('mobile.myShifts.wageFlaggedBody'));
            } catch {
              Alert.alert(t('common.error'), t('mobile.myShifts.wageFlagFailed'));
            }
          },
        },
        {
          text: t('mobile.myShifts.wageReceived'),
          onPress: async () => {
            try {
              const updated = await wagesApi.confirmReceived(wage.id);
              setWagesByShift(prev => ({ ...prev, [wage.shiftId]: updated }));
            } catch {
              Alert.alert(t('common.error'), t('mobile.myShifts.wageConfirmFailed'));
            }
          },
        },
      ],
    );
  }, [t]);

  // ── Section buckets ──────────────────────────────────────────────────────
  // 0. Pré-selecionado — employer selected this worker, awaiting worker confirmation
  const preSelected = applications.filter(a => a.status === 'APPROVED' && a.shift.status === 'PENDING_ACCEPTANCE');
  // 1. Em curso — APPROVED + shift is currently ACTIVE
  const nowActive   = applications.filter(a => a.status === 'APPROVED' && a.shift.status === 'ACTIVE');
  // 2. Concluídos — APPROVED + shift has ended (status COMPLETED or end time passed)
  const concluded   = applications.filter(a => a.status === 'APPROVED' && isShiftOver(a) && a.shift.status !== 'ACTIVE');
  // 3. Confirmados — APPROVED + not yet started / not completed / not pre-selected
  const allConfirmed = applications.filter(a => a.status === 'APPROVED' && !isShiftOver(a) && a.shift.status !== 'ACTIVE' && a.shift.status !== 'PENDING_ACCEPTANCE');
  // The soonest confirmed shift gets its own hero card; the rest fill the section
  // below it, so the same shift is never rendered twice.
  const nextJob     = [...allConfirmed].sort((a, b) => shiftStart(a).getTime() - shiftStart(b).getTime())[0];
  const confirmed   = allConfirmed.filter(a => a.id !== nextJob?.id);
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
          <Text style={s.headerTitle}>{t('mobile.myShifts.title')}</Text>
          <Text style={s.headerSub}>
            {applications.length === 1
              ? t('mobile.myShifts.countOne')
              : t('mobile.myShifts.countOther', { count: applications.length })}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.loadingText}>{t('mobile.myShifts.loading')}</Text>
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
                  <Text style={s.emptyTitle}>{t('mobile.myShifts.emptyTitle')}</Text>
                  <Text style={s.emptySub}>{t('mobile.myShifts.emptySub')}</Text>
                  <TouchableOpacity style={s.exploreBtn} onPress={() => router.back()} activeOpacity={0.85}>
                    <Text style={s.exploreBtnText}>{t('mobile.myShifts.emptyCta')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 📌 Próximo turno — the soonest confirmed shift, always on top */}
              {nextJob && (
                <NextJobCard
                  app={nextJob}
                  onPress={() => router.push(`/shift/${nextJob.shift.id}`)}
                />
              )}

              {/* ⚡ Pre-selected — worker must accept/decline within 2h */}
              {preSelected.length > 0 && (
                <>
                  <Text style={s.sectionTitle}>{t('mobile.myShifts.sectionActionNeeded')}</Text>
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
                          Alert.alert(t('common.error'), e?.message ?? t('mobile.myShifts.confirmFailed'));
                        }
                      }}
                      onDecline={async () => {
                        Alert.alert(
                          t('mobile.myShifts.declineTitle'),
                          t('mobile.myShifts.declineBody'),
                          [
                            { text: t('common.cancel'), style: 'cancel' },
                            {
                              text: t('mobile.myShifts.decline'), style: 'destructive',
                              onPress: async () => {
                                try {
                                  await shiftApi.decline(app.shift.id);
                                  load();
                                } catch (e: any) {
                                  Alert.alert(t('common.error'), e?.message ?? t('mobile.myShifts.declineFailed'));
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
                  <Text style={[s.sectionTitle, preSelected.length > 0 && { marginTop: spacing.lg }]}>{t('mobile.myShifts.sectionActive')}</Text>
                  {nowActive.map(app => (
                    <ApplicationCard key={app.id} app={app} onPress={() => router.push(`/shift/${app.shift.id}`)} />
                  ))}
                </>
              )}

              {confirmed.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, nowActive.length > 0 && { marginTop: spacing.lg }]}>{t('mobile.myShifts.sectionConfirmed')}</Text>
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
                  <Text style={[s.sectionTitle, (nowActive.length > 0 || confirmed.length > 0) && { marginTop: spacing.lg }]}>{t('mobile.myShifts.sectionPending')}</Text>
                  {pending.map(app => (
                    <ApplicationCard key={app.id} app={app} onPress={() => router.push(`/shift/${app.shift.id}`)} />
                  ))}
                </>
              )}

              {concluded.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: spacing.lg }]}>{t('mobile.myShifts.sectionConcluded')}</Text>
                  {concluded.map(app => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      onPress={() => router.push(`/shift/${app.shift.id}`)}
                      isRated={ratedShiftIds.has(app.shift.id)}
                      onRate={() => router.push(`/rate/${app.shift.id}`)}
                      wage={wagesByShift[app.shift.id]}
                      onConfirmWage={handleConfirmWage}
                    />
                  ))}
                </>
              )}

              {history.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: spacing.lg }]}>{t('mobile.myShifts.sectionHistory')}</Text>
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
          <Text style={s.navLabel}>{t('mobile.nav.shifts')}</Text>
        </TouchableOpacity>
        <View style={s.navItemActive}>
          <Ionicons name="briefcase" size={24} color={colors.primary} />
          <Text style={s.navLabelActive}>{t('mobile.nav.myShifts')}</Text>
        </View>
        <TouchableOpacity style={s.navItem} onPress={() => router.push('/profile')} activeOpacity={0.7}>
          <Ionicons name="person-circle-outline" size={24} color={colors.textSecondary} />
          <Text style={s.navLabel}>{t('mobile.nav.profile')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Próximo turno — hero card for the soonest confirmed shift ────────────────
function NextJobCard({ app, onPress }: { app: MyApplication; onPress: () => void }) {
  const { t, fWeekdayDate, fDateRange } = useT();
  const shift = app.shift;
  const days = daysUntil(shiftStart(app));
  const isImminent = days <= 1;
  const countdown =
    days <= 0 ? t('common.today')
    : days === 1 ? t('common.tomorrow')
    : t('mobile.myShifts.countdownDays', { count: days });
  const seriesDays = shift.seriesDates?.length ?? 1;
  const [syncing, setSyncing] = useState(false);
  const [inCalendar, setInCalendar] = useState(false);

  useEffect(() => {
    isShiftInCalendar(shift.id).then(setInCalendar).catch(() => {});
  }, [shift.id]);

  const addToCalendar = async () => {
    setSyncing(true);
    const result = await syncShiftToCalendar({
      id: shift.id,
      title: shift.title,
      subcategory: shift.subcategory,
      address: shift.address,
      startTime: shift.startTime,
      endTime: shift.endTime,
      grossHourlyRate: Number(shift.grossHourlyRate),
      // The calendar note follows the app language, like everything else the
      // worker reads — the stored PaymentMethod enum is untouched.
      paymentMethod: shift.paymentMethod
        ? t(`domain.paymentMethods.${shift.paymentMethod as PaymentMethod}`, {
            defaultValue: shift.paymentMethod,
          })
        : null,
      companyName: shift.employer?.companyName ?? null,
      dates: shift.seriesDates?.length ? shift.seriesDates : [shift.date],
    });
    setSyncing(false);

    if (result.ok) {
      setInCalendar(true);
      Alert.alert(
        result.replaced ? t('mobile.calendar.updated') : t('mobile.calendar.added'),
        result.created > 1
          ? t('mobile.calendar.bodyDays', { count: result.created })
          : t('mobile.calendar.bodyOne'),
      );
    } else {
      Alert.alert(
        t('mobile.calendar.failTitle'),
        result.reason === 'permission'
          ? t('mobile.calendar.failPermission')
          : t('mobile.calendar.failOther'),
      );
    }
  };

  return (
    <TouchableOpacity style={s.nextCard} onPress={onPress} activeOpacity={0.92}>
      <LinearGradient
        colors={['#6a79ff', '#9b6dff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.nextBanner}
      >
        <View style={s.nextBannerLeft}>
          <Ionicons name="bookmark" size={14} color="#fff" />
          <Text style={s.nextBannerText}>{t('mobile.myShifts.nextBanner')}</Text>
        </View>
        <View style={[s.nextCountdown, isImminent && s.nextCountdownHot]}>
          <Text style={[s.nextCountdownText, isImminent && s.nextCountdownTextHot]}>{countdown}</Text>
        </View>
      </LinearGradient>

      <View style={s.nextBody}>
        <Text style={s.nextTitle} numberOfLines={1}>{shift.title || shift.subcategory}</Text>
        <Text style={s.nextEmployer}>{shift.employer?.companyName ?? t('common.company')}</Text>

        {seriesDays > 1 && (
          <View style={s.nextSeriesPill}>
            <Ionicons name="repeat" size={12} color="#1d4ed8" />
            <Text style={s.nextSeriesText}>
              {t('mobile.myShifts.seriesPill', {
                count: seriesDays,
                range: fDateRange(shift.seriesDates!),
              })}
            </Text>
          </View>
        )}

        <View style={s.nextRows}>
          <View style={s.nextRow}>
            <Ionicons name="calendar-outline" size={15} color={colors.primary} />
            {/* Full weekday+date here — the countdown pill above already says Hoje/Amanhã */}
            <Text style={s.nextRowText}>{fWeekdayDate(shift.date)}</Text>
          </View>
          <View style={s.nextRow}>
            <Ionicons name="time-outline" size={15} color={colors.primary} />
            <Text style={s.nextRowText}>
              {shift.startTime.slice(0, 5)} – {shift.endTime.slice(0, 5)}
            </Text>
          </View>
          {!!shift.address && (
            <View style={s.nextRow}>
              <Ionicons name="location-outline" size={15} color={colors.primary} />
              <Text style={s.nextRowText} numberOfLines={1}>{shift.address}</Text>
            </View>
          )}
        </View>

        {/* Calendar sync — right where the worker checks what's next */}
        <TouchableOpacity
          style={s.nextCalendarBtn}
          onPress={addToCalendar}
          disabled={syncing}
          activeOpacity={0.85}
        >
          {syncing ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Ionicons
                name={inCalendar ? 'checkmark-circle' : 'calendar-outline'}
                size={16}
                color={inCalendar ? '#16a34a' : colors.primary}
              />
              <Text style={[s.nextCalendarText, inCalendar && { color: '#16a34a' }]}>
                {inCalendar
                  ? t('mobile.calendar.inCalendar')
                  : seriesDays > 1
                    ? t('mobile.calendar.addDays', { count: seriesDays })
                    : t('mobile.calendar.add')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={s.nextFooter}>
          <Text style={s.nextRate}>€{Number(shift.grossHourlyRate).toFixed(2)}{t('common.perHour')}</Text>
          <Text style={s.nextCta}>{t('common.seeDetails')} →</Text>
        </View>
      </View>
    </TouchableOpacity>
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
  const { t, fShortDate } = useT();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const shift = app.shift;

  return (
    <TouchableOpacity style={s.preCard} onPress={onPress} activeOpacity={0.9}>
      {/* Urgency banner */}
      <View style={s.preBanner}>
        <Ionicons name="flash" size={14} color="#fff" />
        <Text style={s.preBannerText}>{t('mobile.myShifts.preBanner')}</Text>
      </View>

      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={1}>
          {shift.title || shift.subcategory}
        </Text>
        <Text style={s.cardEmployer}>{shift.employer?.companyName ?? t('common.company')}</Text>
        <View style={s.cardMeta}>
          <View style={s.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
            <Text style={s.metaText}>{fShortDate(shift.date)}</Text>
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
          <Text style={s.preDeclineText}>{declining ? '...' : t('mobile.myShifts.decline')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.preAccept, accepting && { opacity: 0.6 }]}
          onPress={async () => { setAccepting(true); await onAccept(); setAccepting(false); }}
          disabled={accepting || declining}
          activeOpacity={0.85}
        >
          <Text style={s.preAcceptText}>{accepting ? t('mobile.myShifts.accepting') : t('mobile.myShifts.accept')}</Text>
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
  wage,
  onConfirmWage,
}: {
  app: MyApplication;
  onPress: () => void;
  isRated?: boolean;
  onRate?: () => void;
  onCancel?: () => void;
  wage?: WagePayment;
  onConfirmWage?: (wage: WagePayment) => void;
}) {
  const { t, fDateTime, fDateRange, fSmartDate } = useT();
  const shift = app.shift;
  const seriesDays    = shift.seriesDates?.length ?? 1;
  const seriesStarted = !!shift.seriesStarted;

  // Derive badge from real-world state rather than just application status
  let badgeLabel: string;
  let badgeStyle: { bg: string; text: string; border: string };

  if (app.status === 'APPROVED' && shift.status === 'ACTIVE') {
    badgeLabel = t('mobile.myShifts.badgeActive');
    badgeStyle = { bg: '#dcfce7', text: '#166534', border: '#86efac' };
  } else if (app.status === 'APPROVED' && isShiftOver(app)) {
    badgeLabel = t('mobile.myShifts.badgeCompleted');
    badgeStyle = { bg: '#cffafe', text: '#0e7490', border: '#67e8f9' };
  } else {
    badgeLabel = t(`domain.applicationStatus.${app.status}`);
    badgeStyle = STATUS_COLOR[app.status];
  }

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.92}>
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={1}>{shift.title || shift.subcategory}</Text>
          <Text style={s.cardEmployer}>{shift.employer?.companyName ?? t('common.company')}</Text>
        </View>
        <View style={[s.statusBadge,{ backgroundColor: badgeStyle.bg, borderColor: badgeStyle.border }]}>
          <Text style={[s.statusText, { color: badgeStyle.text }]}>{badgeLabel}</Text>
        </View>
      </View>

      <View style={s.cardDivider} />

      <View style={s.cardFooter}>
        <View style={s.footerChip}>
          <Text style={s.footerText}>
            📅 {seriesDays > 1 ? fDateRange(shift.seriesDates!) : fSmartDate(shift.date)}
          </Text>
        </View>
        {seriesDays > 1 && (
          <View style={[s.footerChip, s.seriesChip]}>
            <Text style={[s.footerText, s.seriesChipText]}>{t('mobile.myShifts.multiDayChip', { count: seriesDays })}</Text>
          </View>
        )}
        <View style={s.footerChip}>
          <Text style={s.footerText}>⏰ {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}</Text>
        </View>
        <View style={s.footerChip}>
          <Text style={s.footerText}>€{Number(shift.grossHourlyRate).toFixed(2)}/hr</Text>
        </View>
      </View>

      <View style={s.cardBottom}>
        <Text style={s.appliedAt}>{t('mobile.myShifts.appliedAt', { date: fDateTime(app.appliedAt) })}</Text>
        {onRate !== undefined && (
          isRated ? (
            <View style={s.ratedChip}>
              <Text style={s.ratedChipText}>{t('mobile.myShifts.rated')}</Text>
            </View>
          ) : (
            <TouchableOpacity style={s.rateBtn} onPress={onRate} activeOpacity={0.85}>
              <Text style={s.rateBtnText}>{t('mobile.myShifts.rate')}</Text>
            </TouchableOpacity>
          )
        )}
        {/* A started multi-day job has no cancel path in the app — the worker
            committed to the full schedule. Support handles genuine emergencies
            with the context to judge them. The server enforces this too. */}
        {onCancel !== undefined && (
          seriesStarted ? (
            <TouchableOpacity
              style={s.supportBtn}
              onPress={() => Alert.alert(
                t('mobile.myShifts.seriesLockTitle'),
                t('mobile.myShifts.seriesLockBody'),
                [
                  { text: t('common.back'), style: 'cancel' },
                  { text: t('mobile.myShifts.support'), onPress: () => Linking.openURL('mailto:suporte@turnos.pt') },
                ],
              )}
              activeOpacity={0.85}
            >
              <Text style={s.supportBtnText}>{t('mobile.myShifts.support')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.85}>
              <Text style={s.cancelBtnText}>
                {seriesDays > 1 ? t('mobile.myShifts.cancelJob') : t('mobile.myShifts.cancelShift')}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {/* ── Payment status (trust loop) ── */}
      {wage && (
        <View style={s.wageRow}>
          {(wage.status === 'PAID' || wage.status === 'CONFIRMED') ? (
            <View style={[s.wageChip, s.wageChipPaid]}>
              <Text style={s.wageChipPaidText}>
                {t(
                  wage.status === 'PAID' ? 'mobile.myShifts.wagePaidChip' : 'mobile.myShifts.wageReceivedChip',
                  { amount: Number(wage.amount).toFixed(2) },
                )}
              </Text>
            </View>
          ) : wage.status === 'DISPUTED' ? (
            <View style={[s.wageChip, s.wageChipDisputed]}>
              <Text style={s.wageChipDisputedText}>{t('mobile.myShifts.wageDisputedChip')}</Text>
            </View>
          ) : wage.paymentMethod === 'TURNOS_PAY_LINK' && wage.status === 'PENDING' ? (
            <View style={[s.wageChip, s.wageChipPending]}>
              <Text style={s.wageChipPendingText}>
                {t('mobile.myShifts.wagePendingChip', { amount: Number(wage.amount).toFixed(2) })}
              </Text>
            </View>
          ) : onConfirmWage ? (
            <>
              <TouchableOpacity
                style={[s.wageChip, s.wageChipAction]}
                onPress={() => onConfirmWage(wage)}
                activeOpacity={0.85}
              >
                <Text style={s.wageChipActionText}>
                  {t(
                    wage.status === 'MARKED_PAID' ? 'mobile.myShifts.wageMarkedChip' : 'mobile.myShifts.wageAskChip',
                    { amount: Number(wage.amount).toFixed(2) },
                  )}
                </Text>
              </TouchableOpacity>
              {/* Check the receipt before confirming */}
              {wage.paymentProofUrl && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(wage.paymentProofUrl!)}
                  activeOpacity={0.7}
                >
                  <Text style={s.wageProofLink}>{t('mobile.myShifts.wageProof')}</Text>
                </TouchableOpacity>
              )}
            </>
          ) : null}
        </View>
      )}
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

  supportBtn: {
    backgroundColor: '#fff',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  supportBtnText: { fontSize: 11, fontWeight: fontWeight.bold, color: '#1d4ed8' },

  seriesChip: { backgroundColor: '#dbeafe', borderColor: '#bfdbfe' },
  seriesChipText: { color: '#1d4ed8', fontWeight: fontWeight.bold },

  nextSeriesPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: '#dbeafe', borderRadius: radius.full,
  },
  nextSeriesText: { fontSize: 12, fontWeight: fontWeight.bold, color: '#1d4ed8' },

  nextCalendarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 40, borderRadius: radius.md, marginTop: spacing.md,
    borderWidth: 1.5, borderColor: colors.primary, backgroundColor: '#f5f6ff',
  },
  nextCalendarText: { fontSize: 13, fontWeight: fontWeight.bold, color: colors.primary },

  /* Wage trust-loop chips */
  wageRow: { marginTop: 8 },
  wageChip: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  wageChipPaid:         { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  wageChipPaidText:     { fontSize: 12, fontWeight: fontWeight.bold, color: '#166534' },
  wageChipDisputed:     { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  wageChipDisputedText: { fontSize: 12, fontWeight: fontWeight.semibold, color: '#991b1b' },
  wageChipPending:      { backgroundColor: '#eef0ff', borderColor: '#c7d2fe' },
  wageChipPendingText:  { fontSize: 12, fontWeight: fontWeight.semibold, color: '#4338ca' },
  wageChipAction:       { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  wageChipActionText:   { fontSize: 12, fontWeight: fontWeight.bold, color: '#92400e' },
  wageProofLink:        { fontSize: 12, fontWeight: fontWeight.semibold, color: '#16a34a', marginTop: 6 },

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

  // Próximo turno hero card
  nextCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#e0e2ff',
    shadowColor: '#6a79ff',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,
  },
  nextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  nextBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextBannerText: { color: '#fff', fontSize: 11, fontWeight: fontWeight.extrabold, letterSpacing: 0.8 },
  nextCountdown: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  nextCountdownHot: { backgroundColor: '#fff' },
  nextCountdownText: { color: '#fff', fontSize: 11, fontWeight: fontWeight.bold },
  nextCountdownTextHot: { color: '#6a79ff' },

  nextBody: { padding: spacing.md },
  nextTitle: {
    fontSize: 20,
    fontWeight: fontWeight.extrabold,
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  nextEmployer: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
    marginTop: 2,
  },
  nextRows: { gap: 8, marginTop: spacing.md },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextRowText: {
    fontSize: fontSize.body,
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
    flex: 1,
  },
  nextFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral,
  },
  nextRate: { fontSize: fontSize.body, fontWeight: fontWeight.extrabold, color: '#16a34a' },
  nextCta: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.primary },

  // Pre-selected card body — outlined Ionicons + secondary text, matching the
  // monochrome meta rows used on the other cards.
  cardBody: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: colors.textSecondary, fontWeight: fontWeight.semibold },

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

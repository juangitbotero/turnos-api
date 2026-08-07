import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Modal,
  ScrollView, ActivityIndicator, Linking, Platform, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  colors, spacing, radius, fontSize, fontWeight, calculateTSU, PaymentMethod,
} from '@turnos/shared';
import {
  shiftApi, ShiftSummary, MyApplication, ApiError,
  attendanceApi, AttendanceRecord, authApi,
} from '../../lib/api';
import { useT } from '../../lib/i18n';
import { ShiftSchedule } from '../../components/ShiftSchedule';
import { syncShiftToCalendar, isShiftInCalendar } from '../../lib/calendar';

/**
 * Hours in one day of a shift.
 *
 * Wraps past midnight, like `calcHours` on the API does. Without the wrap an
 * overnight shift (20:00 → 00:00) produced NEGATIVE minutes, was clamped to 0,
 * and every estimate on this screen either vanished or read €0.00 — on exactly
 * the late-night hospitality shifts this marketplace is mostly made of.
 */
function hoursWorked(start: string, end: string): number {
  const sp = start.split(':').map(Number);
  const ep = end.split(':').map(Number);
  const sh = sp[0] ?? 0, sm = sp[1] ?? 0;
  const eh = ep[0] ?? 0, em = ep[1] ?? 0;
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins > 0 ? mins / 60 : 0;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, tSkill, fSmartDate, fDateRange } = useT();

  const [shift, setShift]             = useState<ShiftSummary | null>(null);
  const [myApp, setMyApp]             = useState<MyApplication | null>(null);
  const [attendance, setAttendance]   = useState<AttendanceRecord | null>(null);
  const [profileScore, setProfileScore] = useState<number | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [isApplying, setIsApplying]   = useState(false);
  const [applied, setApplied]         = useState(false);
  const [showGate, setShowGate]       = useState(false);  // profile-gate modal
  const [showApplySheet, setShowApplySheet] = useState(false); // cover note sheet
  const [coverNote, setCoverNote]     = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [inCalendar, setInCalendar]     = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      // Fetch shift data + worker's application status in parallel.
      // Attendance is fetched alongside — gracefully ignored if 401/404.
      const [shiftData, myApps, att, me] = await Promise.all([
        shiftApi.getById(id),
        shiftApi.getMyApplications().catch(() => [] as MyApplication[]),
        attendanceApi.getAttendance(id).catch(() => null),
        authApi.getMe().catch(() => null),
      ]);
      if (me) setProfileScore(me.profileQualityScore ?? 0);

      setShift(shiftData);
      setMyApp(myApps.find(a => a.shift.id === id) ?? null);
      setAttendance(att);
    } catch {
      Alert.alert(t('common.error'), t('mobile.shiftDetail.loadError'), [
        { text: t('common.back'), onPress: () => router.back() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [id, router, t]);

  useEffect(() => { load(); }, [load]);

  // Reflect whether this shift is already in the phone calendar
  useEffect(() => {
    if (id) isShiftInCalendar(id).then(setInCalendar).catch(() => {});
  }, [id]);

  // ── apply ─────────────────────────────────────────────────────────────────

  // Called when worker taps "Candidatar-me"
  const handleApplyPress = () => {
    if (!shift) return;
    // Profile gate: score must be >= 80 to apply
    if (profileScore !== null && profileScore < 80) {
      setShowGate(true);
      return;
    }
    // Multi-day: make the commitment explicit before the cover-note sheet
    if ((shift.seriesDates?.length ?? 0) > 1) {
      Alert.alert(
        t('mobile.shiftDetail.multiDayTitle'),
        t('mobile.shiftDetail.multiDayBody', {
          count: shift.seriesDates!.length,
          range: fDateRange(shift.seriesDates!),
        }),
        [
          { text: t('common.back'), style: 'cancel' },
          { text: t('mobile.shiftDetail.multiDayContinue'), onPress: () => setShowApplySheet(true) },
        ],
      );
      return;
    }
    // Show cover note sheet (optional message to employer)
    setShowApplySheet(true);
  };

  // ── calendar sync ─────────────────────────────────────────────────────────

  const handleAddToCalendar = async () => {
    if (!shift) return;
    setSyncingCalendar(true);
    const result = await syncShiftToCalendar({
      id: shift.id,
      title: shift.title,
      subcategory: shift.subcategory,
      address: shift.address,
      startTime: shift.startTime,
      endTime: shift.endTime,
      grossHourlyRate: Number(shift.grossHourlyRate),
      // Calendar notes follow the app language; the stored enum is untouched.
      paymentMethod: shift.paymentMethod
        ? t(`domain.paymentMethods.${shift.paymentMethod as PaymentMethod}`, {
            defaultValue: shift.paymentMethod,
          })
        : null,
      companyName: shift.employer?.companyName ?? null,
      dates: shift.seriesDates?.length ? shift.seriesDates : [shift.date],
    });
    setSyncingCalendar(false);

    if (result.ok) {
      setInCalendar(true);
      Alert.alert(
        result.replaced ? t('mobile.calendar.updated') : t('mobile.calendar.added'),
        result.created > 1
          ? t('mobile.calendar.bodyDays', { count: result.created })
          : t('mobile.calendar.bodyOne'),
      );
      return;
    }

    Alert.alert(
      t('mobile.calendar.failTitle'),
      result.reason === 'permission'
        ? t('mobile.calendar.failPermission')
        : result.reason === 'no-calendar'
          ? t('mobile.calendar.failNoCalendar')
          : t('mobile.calendar.failOther'),
    );
  };

  // Called after cover note sheet is confirmed
  const handleApplyConfirm = async () => {
    if (!shift) return;
    setShowApplySheet(false);
    setIsApplying(true);
    try {
      await shiftApi.apply(shift.id, coverNote.trim() || undefined);
      setApplied(true);
      setCoverNote('');
      Alert.alert(
        t('mobile.shiftDetail.appliedTitle'),
        t('mobile.shiftDetail.appliedBody'),
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        Alert.alert(
          t('common.sessionExpired'),
          t('common.sessionExpiredBody'),
          [{ text: t('common.signIn'), onPress: () => router.replace('/login') }],
        );
      } else {
        const msg = err instanceof ApiError ? err.message : t('mobile.shiftDetail.applyError');
        // The server message is still PT-only until Phase 4 translates it —
        // match both wordings so this keeps working afterwards.
        const lower = msg.toLowerCase();
        const is11h = lower.includes('descanso') || lower.includes('rest') || lower.includes('11h');
        Alert.alert(is11h ? t('mobile.shiftDetail.restTitle') : t('common.error'), msg);
      }
    } finally {
      setIsApplying(false);
    }
  };

  // ── open address in native maps app ───────────────────────────────────────

  const openInMaps = (address: string) => {
    const query = encodeURIComponent(address);
    // On iOS open Apple Maps; on Android/other use Google Maps URL (works on both)
    const url = Platform.OS === 'ios'
      ? `maps:0,0?q=${query}`
      : `geo:0,0?q=${query}`;

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Universal fallback — opens in browser, then Maps picks it up
        Linking.openURL(`https://maps.google.com/maps?q=${query}`);
      }
    });
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
  // The worker receives the FULL gross, paid directly by the company.
  const recebePerHour   = tsu.grossAmount;
  const paymentLabel    = shift.paymentMethod
    ? t(`domain.paymentMethods.${shift.paymentMethod as PaymentMethod}`, { defaultValue: '' }) || null
    : null;
  const seriesDates     = shift.seriesDates?.length ? shift.seriesDates : [shift.date];
  const isMultiDay      = seriesDates.length > 1;
  // × days: a multi-day job is committed to and paid as ONE job, so the figure
  // next to the Apply button must be what the whole job is worth. It previously
  // showed a single day's value, understating a 3-day job by two thirds. This
  // matches the "Total" row in the details card above, which was already right.
  const estimatedPayout = recebePerHour * hours * seriesDates.length;

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
              <Text style={styles.employer}>{shift.employer?.companyName ?? t('common.company')}</Text>
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
                  ? t('mobile.shiftDetail.bannerDone')
                  : showCheckOut
                    ? t('mobile.shiftDetail.bannerActive', { time: shift.endTime.slice(0, 5) })
                    : t('mobile.shiftDetail.bannerFilled')}
              </Text>
            </View>
          )}

          {/* ── Multi-day commitment banner ── */}
          {isMultiDay && (
            <View style={styles.multiDayBanner}>
              <Ionicons name="alert-circle" size={20} color="#c2410c" />
              <Text style={styles.multiDayBannerText}>{t('mobile.shiftDetail.multiDayBanner')}</Text>
            </View>
          )}

          {/* Pay breakdown */}
          <View style={styles.payBox}>
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>{t('mobile.shiftDetail.payGrossHour')}</Text>
              <Text style={styles.payVal}>€{tsu.grossAmount.toFixed(2)}</Text>
            </View>
            <View style={[styles.payRow, styles.payTotal]}>
              <Text style={styles.payTotalLabel}>{t('mobile.shiftDetail.payNetHour')}</Text>
              <Text style={styles.payTotalVal}>€{recebePerHour.toFixed(2)}</Text>
            </View>
            <View style={styles.tsuNote}>
              <Text style={styles.tsuNoteText}>
                {t('mobile.shiftDetail.tsuNote', { amount: tsu.workerDeduction.toFixed(2) })}
              </Text>
            </View>
            <Text style={styles.recebe}>
              {paymentLabel
                ? t('mobile.shiftDetail.payViaMethod', { method: paymentLabel })
                : t('mobile.shiftDetail.payDirect')}
            </Text>
          </View>

          {/* Info card */}
          <View style={styles.infoCard}>
            <InfoRow
              icon="📅"
              label={isMultiDay ? t('mobile.shiftDetail.labelDays') : t('mobile.shiftDetail.labelDate')}
              value={isMultiDay
                ? t('mobile.shiftDetail.valueDays', { count: seriesDates.length })
                : fSmartDate(shift.date, 'long')}
            />
            <InfoRow
              icon="⏰"
              label={t('mobile.shiftDetail.labelSchedule')}
              value={`${shift.startTime.slice(0, 5)} – ${shift.endTime.slice(0, 5)}`}
            />
            {hours > 0 && (
              <InfoRow
                icon="🕐"
                label={t('mobile.shiftDetail.labelDuration')}
                value={isMultiDay
                  ? t('mobile.shiftDetail.valueTotalHours', { hours: (hours * seriesDates.length).toFixed(0) })
                  : t('mobile.shiftDetail.valueHours', { hours: hours.toFixed(1) })}
              />
            )}
            {isMultiDay && (
              <InfoRow
                icon="💶"
                label={t('mobile.shiftDetail.labelTotal')}
                value={t('mobile.shiftDetail.valueGrossTotal', {
                  amount: estimatedPayout.toFixed(2),
                })}
              />
            )}
            <InfoRow
              icon="📍"
              label={t('mobile.shiftDetail.labelAddress')}
              value={shift.address}
              last
              onPress={() => openInMaps(shift.address)}
              tapHint={t('mobile.shiftDetail.mapHint')}
            />
          </View>

          {/* ── Job period + schedule (multi-day only) ── */}
          {isMultiDay && (
            <View style={styles.periodCard}>
              <TouchableOpacity
                style={styles.periodHead}
                onPress={() => setShowSchedule(v => !v)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.periodTitle}>{t('mobile.shiftDetail.periodTitle')}</Text>
                  <View style={styles.periodRangePill}>
                    <Ionicons name="repeat" size={13} color="#1d4ed8" />
                    <Text style={styles.periodRangeText}>{fDateRange(seriesDates)}</Text>
                  </View>
                </View>
                <Text style={styles.periodToggle}>
                  {showSchedule ? t('mobile.shiftDetail.periodHide') : t('mobile.shiftDetail.periodShow')}
                </Text>
                <Ionicons
                  name={showSchedule ? 'chevron-up' : 'chevron-forward'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {showSchedule && (
                <View style={styles.periodBody}>
                  <ShiftSchedule
                    dates={seriesDates}
                    startTime={shift.startTime}
                    endTime={shift.endTime}
                  />
                </View>
              )}
            </View>
          )}

          {/* ── Add to phone calendar (confirmed shifts only) ── */}
          {isApproved && !isShiftDone && (
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={handleAddToCalendar}
              disabled={syncingCalendar}
              activeOpacity={0.85}
            >
              {syncingCalendar ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <>
                  <Ionicons
                    name={inCalendar ? 'checkmark-circle' : 'calendar-outline'}
                    size={18}
                    color={inCalendar ? '#16a34a' : colors.primary}
                  />
                  <Text style={[styles.calendarBtnText, inCalendar && { color: '#16a34a' }]}>
                    {inCalendar
                      ? t('mobile.calendar.inCalendarTap')
                      : isMultiDay
                        ? t('mobile.calendar.addDays', { count: seriesDates.length })
                        : t('mobile.calendar.add')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Skills */}
          {shift.skillsRequired && shift.skillsRequired.length > 0 && (
            <View style={styles.skillsSection}>
              <Text style={styles.sectionTitle}>{t('mobile.shiftDetail.skillsTitle')}</Text>
              <View style={styles.skillsWrap}>
                {/* Stored PT job titles — translated for display only */}
                {shift.skillsRequired.map(skill => (
                  <View key={skill} style={styles.skillChip}>
                    <Text style={styles.skillText}>{tSkill(skill)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          {shift.description && (
            <View style={styles.descSection}>
              <Text style={styles.sectionTitle}>{t('mobile.shiftDetail.aboutTitle')}</Text>
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
            <Text style={styles.doneText}>{t('mobile.shiftDetail.doneTitle')}{'\n'}
              <Text style={styles.doneSubText}>
                {attendance?.scheduledHours
                  ? t('mobile.shiftDetail.doneSubHours', { hours: attendance.scheduledHours })
                  : t('mobile.shiftDetail.doneSub')}
              </Text>
            </Text>
          </View>
        )}

        {/* ② Check-in button */}
        {!isShiftDone && showCheckIn && (
          <>
            {hours > 0 && (
              <View style={styles.payoutBox}>
                <Text style={styles.payoutLabel}>{t('mobile.shiftDetail.estimatedTotal')}</Text>
                <Text style={styles.payoutValue}>€{estimatedPayout.toFixed(2)}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.checkInBtn]}
              onPress={() => router.push(`/scan`)}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>{t('mobile.shiftDetail.checkIn')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ③ In progress — auto-completes at scheduled end (v2.1, no check-out) */}
        {!isShiftDone && showCheckOut && (
          <View style={styles.doneBox}>
            <Text style={styles.doneIcon}>🟢</Text>
            <Text style={styles.doneText}>{t('mobile.shiftDetail.inProgress')}{'\n'}
              <Text style={styles.doneSubText}>
                {t('mobile.shiftDetail.inProgressSub', { time: shift.endTime.slice(0, 5) })}
              </Text>
            </Text>
          </View>
        )}

        {/* ④ Apply button (OPEN shift, no application yet) */}
        {!isShiftDone && !showCheckIn && !showCheckOut && showApplyButton && (
          <>
            {hours > 0 && (
              <View style={styles.payoutBox}>
                <Text style={styles.payoutLabel}>{t('mobile.shiftDetail.estimatedTotal')}</Text>
                <Text style={styles.payoutValue}>€{estimatedPayout.toFixed(2)}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.applyBtn, isApplying && styles.applyBtnDisabled]}
              onPress={handleApplyPress}
              disabled={isApplying}
              activeOpacity={0.85}
            >
              <Text style={styles.applyBtnText}>
                {isApplying ? t('mobile.shiftDetail.applying') : t('mobile.shiftDetail.apply')}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ⑤ Application already sent (just applied) */}
        {!isShiftDone && !showCheckIn && !showCheckOut && (applied || hasPending) && (
          <View style={styles.pendingBox}>
            <Text style={styles.pendingIcon}>⏳</Text>
            <Text style={styles.pendingText}>{t('mobile.shiftDetail.chipPending')}</Text>
          </View>
        )}

        {/* ⑥ Rejected */}
        {!isShiftDone && !showCheckIn && !showCheckOut && hasRejected && (
          <View style={styles.rejectedBox}>
            <Text style={styles.pendingIcon}>✕</Text>
            <Text style={styles.pendingText}>{t('mobile.shiftDetail.chipRejected')}</Text>
          </View>
        )}

        {/* ⑦ Cancelled shift */}
        {shift.status === 'CANCELLED' && (
          <View style={styles.pendingBox}>
            <Text style={styles.pendingIcon}>🚫</Text>
            <Text style={styles.pendingText}>{t('mobile.shiftDetail.chipCancelled')}</Text>
          </View>
        )}
      </View>

      {/* ── Profile gate modal ─────────────────────────────────────────────── */}
      <Modal visible={showGate} transparent animationType="slide" onRequestClose={() => setShowGate(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowGate(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('mobile.shiftDetail.gateTitle')}</Text>
            <Text style={styles.sheetSub}>{t('mobile.shiftDetail.gateSub')}</Text>

            {/* Progress ring */}
            <View style={styles.scoreRow}>
              <View style={styles.scoreBg}>
                <View style={[styles.scoreFill, { width: `${profileScore ?? 0}%` as any }]} />
              </View>
              <Text style={styles.scoreText}>{t('mobile.shiftDetail.gateScore', { score: profileScore ?? 0 })}</Text>
            </View>

            <TouchableOpacity
              style={styles.completeBtnPrimary}
              onPress={() => { setShowGate(false); router.push('/edit-profile' as any); }}
              activeOpacity={0.85}
            >
              <Ionicons name="person-outline" size={18} color="#fff" />
              <Text style={styles.completeBtnText}>{t('mobile.shiftDetail.gateCta')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.completeBtnSecondary} onPress={() => setShowGate(false)}>
              <Text style={styles.completeBtnSecText}>{t('mobile.shiftDetail.gateLater')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Cover note sheet ───────────────────────────────────────────────── */}
      <Modal visible={showApplySheet} transparent animationType="slide" onRequestClose={() => setShowApplySheet(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowApplySheet(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('mobile.shiftDetail.coverTitle')}</Text>
            <Text style={styles.sheetSub}>{t('mobile.shiftDetail.coverSub')}</Text>
            <TextInput
              style={styles.coverInput}
              value={coverNote}
              onChangeText={text => setCoverNote(text.slice(0, 200))}
              placeholder={t('mobile.shiftDetail.coverPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={200}
            />
            <Text style={styles.charCount}>{coverNote.length}/200</Text>
            <TouchableOpacity
              style={styles.completeBtnPrimary}
              onPress={handleApplyConfirm}
              disabled={isApplying}
              activeOpacity={0.85}
            >
              <Text style={styles.completeBtnText}>
                {isApplying ? t('mobile.shiftDetail.coverSending') : t('mobile.shiftDetail.coverSend')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.completeBtnSecondary} onPress={() => setShowApplySheet(false)}>
              <Text style={styles.completeBtnSecText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({
  icon, label, value, last, onPress, tapHint,
}: {
  icon: string; label: string; value: string; last?: boolean;
  onPress?: () => void; tapHint?: string;
}) {
  const rowStyle = [styles.infoRow, last && { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 }];
  const inner = (
    <>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, onPress && styles.infoValueLink]}>{value}</Text>
        {onPress && tapHint && <Text style={styles.infoTapHint}>{tapHint}</Text>}
      </View>
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={rowStyle} onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={rowStyle}>{inner}</View>;
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
  tsuNote: {
    backgroundColor: '#f3f4f6', borderRadius: 6, padding: 8,
  },
  tsuNoteText: { fontSize: 11, color: '#6b7280', lineHeight: 16 },
  recebe: { fontSize: 12, color: '#7c3aed', fontWeight: fontWeight.semibold, textAlign: 'center' },

  /* Multi-day */
  multiDayBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#ffedd5', borderWidth: 1, borderColor: '#fed7aa',
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  multiDayBannerText: {
    flex: 1, fontSize: fontSize.body, lineHeight: 21,
    fontWeight: fontWeight.bold as any, color: '#9a3412',
  },
  periodCard: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.neutral,
    borderRadius: radius.md, marginBottom: spacing.md, overflow: 'hidden',
  },
  periodHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md },
  periodTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.textPrimary },
  periodRangePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    marginTop: 6, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: '#dbeafe', borderRadius: radius.full,
  },
  periodRangeText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold as any, color: '#1d4ed8' },
  periodToggle: { fontSize: fontSize.caption, fontWeight: fontWeight.bold as any, color: colors.primary },
  periodBody: {
    padding: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.neutral,
  },

  /* Calendar sync */
  calendarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: radius.md, marginBottom: spacing.md,
    borderWidth: 1.5, borderColor: colors.primary, backgroundColor: '#f5f6ff',
  },
  calendarBtnText: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.primary },

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
  infoValueLink: { color: colors.primary, textDecorationLine: 'underline' },
  infoTapHint: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },

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

  // Modals
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingBottom: 48, gap: 12,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: colors.neutral, borderRadius: 2,
    alignSelf: 'center', marginBottom: 8,
  },
  sheetTitle: { fontSize: fontSize.h2, fontWeight: fontWeight.bold as any, color: colors.textPrimary },
  sheetSub: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
  scoreRow: { gap: 6 },
  scoreBg: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  scoreFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  scoreText: { fontSize: fontSize.caption, color: colors.textSecondary, fontWeight: fontWeight.semibold as any },
  completeBtnPrimary: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4,
  },
  completeBtnText: { color: '#fff', fontSize: fontSize.body, fontWeight: fontWeight.bold as any },
  completeBtnSecondary: { alignItems: 'center', paddingVertical: 8 },
  completeBtnSecText: { fontSize: fontSize.body, color: colors.textSecondary, fontWeight: fontWeight.semibold as any },
  coverInput: {
    borderWidth: 1.5, borderColor: colors.neutral, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: fontSize.body, color: colors.textPrimary,
    height: 100, textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: -4 },
});

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  colors, spacing, radius, fontSize, fontWeight, ShiftCategory,
  PAYMENT_METHOD_LABELS, PaymentMethod,
} from '@turnos/shared';
import { shiftApi, authApi, ShiftSummary } from '../lib/api';
import { InboxBell } from '../components/InboxBell';
import {
  FeedFilterSheet, FeedFilters, NO_FILTERS, activeFilterCount, matchesFilters,
} from '../components/FeedFilterSheet';
import { useT } from '../lib/i18n';

function toFeedItem(s: ShiftSummary, fmt: {
  range: (d: readonly string[]) => string;
  smart: (d: string) => string;
}) {
  // lat/lng are decimal columns from PostgreSQL — node-pg returns them as strings
  const lat = Number(s.lat) || 38.722;  // fallback: Lisboa centre
  const lng = Number(s.lng) || -9.139;
  return {
    id: s.id,
    title: s.title || s.subcategory,
    employerName: s.employer?.companyName ?? '—',
    category: s.category as ShiftCategory,
    subcategory: s.subcategory,
    grossHourlyRate: Number(s.grossHourlyRate),
    requiredLevel: Number(s.requiredLevel) || 1,
    openSlots: s.openSlots ?? 1,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[s.paymentMethod as PaymentMethod] ?? null,
    startTime: s.startTime.slice(0, 5),
    endTime: s.endTime.slice(0, 5),
    // Multi-day jobs show their range instead of a single date — the API sends
    // one entry per job, not per day.
    seriesDays: s.seriesDates?.length && s.seriesDates.length > 1 ? s.seriesDates.length : 0,
    // Every calendar day of the job, for the date filter
    days: s.seriesDates?.length ? s.seriesDates : [s.date],
    date: s.seriesDates?.length && s.seriesDates.length > 1
      ? fmt.range(s.seriesDates)
      : fmt.smart(s.date),
    coordinate: { latitude: lat, longitude: lng },
    urgent: false,
  };
}

export default function FeedScreen() {
  const [shifts, setShifts]         = useState<ReturnType<typeof toFeedItem>[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode]     = useState<'list' | 'map'>('list');
  const [filters, setFilters]       = useState<FeedFilters>(NO_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [workerName, setWorkerName]       = useState<string | null>(null);
  const [profileScore, setProfileScore]   = useState<number | null>(null); // null until loaded
  const router = useRouter();
  const { t, fDateRange, fSmartDate } = useT();

  // Fetch worker profile — name for greeting + score for completeness banner
  useEffect(() => {
    authApi.getMe().then(p => {
      if (p.fullName) setWorkerName(p.fullName.split(' ')[0] ?? null);
      setProfileScore(p.profileQualityScore ?? 0);
    }).catch(() => {});
  }, []);

  // All open shifts once; category and date are filtered here, so the filter
  // sheet can count results live and several categories can be combined.
  const loadShifts = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await shiftApi.search();
      setShifts(data.map(sh => toFeedItem(sh, { range: fDateRange, smart: fSmartDate })));
    } catch {
      // API not available (dev mode) — show empty state
      setShifts([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fDateRange, fSmartDate]);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  const matchesSearch = (sh: ReturnType<typeof toFeedItem>) =>
    !searchQuery ||
    sh.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sh.employerName.toLowerCase().includes(searchQuery.toLowerCase());

  const countFor = (f: FeedFilters) =>
    shifts.filter(sh => matchesSearch(sh) && matchesFilters(f, sh.category, sh.days)).length;

  const filteredShifts = shifts.filter(sh => matchesSearch(sh) && matchesFilters(filters, sh.category, sh.days));
  const filterCount = activeFilterCount(filters);

  const handleShiftPress = (id: string) => router.push(`/shift/${id}`);

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <LinearGradient
        colors={['#6a79ff', '#9b6dff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.header}
      >
        <View style={s.headerTop}>
          {/* Inbox bell — left, same width as the profile button so the logo stays centred */}
          <InboxBell style={s.headerSide} />
          {/* Turnos logo — centred */}
          <Image
            source={require('../assets/logo-white.png')}
            style={s.logo}
            resizeMode="contain"
          />
          {/* Profile button — right */}
          <TouchableOpacity style={[s.profileBtn, s.headerSide]} activeOpacity={0.8} onPress={() => router.push('/profile')}>
            <Ionicons name="person-circle-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={s.headerGreeting}>
          {workerName ? t('mobile.feed.greeting', { name: workerName }) : t('mobile.feed.greetingNoName')}
        </Text>
        <Text style={s.headerSub}>
          {isLoading ? t('common.loading') : t('mobile.feed.subtitle', { count: filteredShifts.length })}
        </Text>

        {/* Profile completeness banner — shown until worker can apply */}
        {profileScore !== null && profileScore < 80 && (
          <TouchableOpacity
            style={s.profileBanner}
            onPress={() => router.push('/edit-profile' as any)}
            activeOpacity={0.85}
          >
            <View style={s.profileBannerBar}>
              <View style={[s.profileBannerFill, { width: `${profileScore}%` as any }]} />
            </View>
            <View style={s.profileBannerRow}>
              <Text style={s.profileBannerText}>
                {t('mobile.feed.profileBanner', { score: profileScore })}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Search + filters + map/list — one row. The category chip row that
            sat under the header is gone (2026-11-05): categories and date live
            in the filter sheet, which frees a full row for shifts. */}
        <View style={s.searchRow}>
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
            <TextInput
              style={s.searchInput}
              placeholder={t('mobile.feed.searchPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={s.searchClear}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[s.roundBtn, filterCount > 0 && s.roundBtnOn]}
            onPress={() => setFilterOpen(true)}
            activeOpacity={0.8}
            accessibilityLabel={t('mobile.feed.filterButton')}
          >
            <Ionicons name="options-outline" size={20} color={filterCount > 0 ? '#fff' : colors.textSecondary} />
            {filterCount > 0 && (
              <View style={s.filterBadge}>
                <Text style={s.filterBadgeText}>{filterCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Shows the OTHER view: a pin in the list, a list on the map */}
          <TouchableOpacity
            style={s.roundBtn}
            onPress={() => setViewMode(v => (v === 'list' ? 'map' : 'list'))}
            activeOpacity={0.8}
            accessibilityLabel={viewMode === 'list' ? t('mobile.feed.showMap') : t('mobile.feed.showList')}
          >
            <Ionicons name={viewMode === 'list' ? 'location-sharp' : 'list'} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FeedFilterSheet
        visible={filterOpen}
        value={filters}
        onClose={() => setFilterOpen(false)}
        onApply={f => { setFilters(f); setFilterOpen(false); }}
        countFor={countFor}
      />

      {/* ── Content ── */}
      {viewMode === 'map' ? (
        <MapView
          style={s.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: 38.722,
            longitude: -9.139,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
        >
          {filteredShifts.map(shift => (
            <Marker
              key={shift.id}
              coordinate={shift.coordinate}
              title={shift.title}
              description={`€${shift.grossHourlyRate.toFixed(2)}/hr · ${shift.employerName}`}
              onCalloutPress={() => handleShiftPress(shift.id)}
            />
          ))}
        </MapView>
      ) : isLoading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.loadingText}>{t('mobile.feed.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredShifts}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadShifts(true)} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="search-outline" size={44} color={colors.textSecondary} />
              <Text style={s.emptyText}>{t('mobile.feed.emptyTitle')}</Text>
              <Text style={s.emptySub}>{t('mobile.feed.emptySub')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => handleShiftPress(item.id)}
              activeOpacity={0.92}
            >
              {item.urgent && (
                <View style={s.urgentBadge}>
                  <Text style={s.urgentText}>{t('mobile.feed.urgent')}</Text>
                </View>
              )}

              <View style={s.cardHeader}>
                <View style={s.cardTitleWrap}>
                  <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.cardEmployer}>{item.employerName}</Text>
                </View>
                <LinearGradient
                  colors={['#6a79ff', '#9b6dff']}
                  style={s.rateBadge}
                >
                  <Text style={s.rateValue}>€{item.grossHourlyRate.toFixed(2)}</Text>
                  <Text style={s.rateUnit}>/hr</Text>
                </LinearGradient>
              </View>

              <Text style={s.netPay}>
                {t('mobile.feed.fullGross')}
                {item.paymentMethodLabel ? (
                  <>
                    {'  ·  '}
                    <Ionicons name="card-outline" size={12} color={colors.primary} />
                    <Text style={s.recebe}> {item.paymentMethodLabel}</Text>
                  </>
                ) : null}
              </Text>

              <View style={s.cardDivider} />

              <View style={s.cardFooter}>
                <View style={s.footerChip}>
                  <Ionicons name="calendar-outline" size={11} color={colors.textSecondary} />
                  <Text style={s.footerChipText}>{item.date}</Text>
                </View>
                <View style={s.footerChip}>
                  <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
                  <Text style={s.footerChipText}>{item.startTime}–{item.endTime}</Text>
                </View>
                {/* One card for N places of the same role — applying once covers them */}
                {item.openSlots > 1 && (
                  <View style={[s.footerChip, s.slotsChip]}>
                    <Ionicons name="people-outline" size={11} color="#b45309" />
                    <Text style={[s.footerChipText, { color: '#b45309', fontWeight: fontWeight.bold }]}>
                      {t('mobile.feed.slotsChip', { count: item.openSlots })}
                    </Text>
                  </View>
                )}
                {/* Level the company asked for — level 1 means anyone can apply */}
                <View style={[s.footerChip, item.requiredLevel > 1 ? s.levelChip : s.openChip]}>
                  <Ionicons name="ribbon-outline" size={11} color={item.requiredLevel > 1 ? colors.primary : '#15803d'} />
                  <Text style={[s.footerChipText, { color: item.requiredLevel > 1 ? colors.primary : '#15803d', fontWeight: fontWeight.bold }]}>
                    {item.requiredLevel > 1
                      ? t('mobile.roles.levelN', { level: item.requiredLevel })
                      : t('mobile.feed.levelOpenChip')}
                  </Text>
                </View>
                {item.seriesDays > 0 && (
                  <View style={[s.footerChip, s.multiDayChip]}>
                    <Ionicons name="repeat" size={11} color="#1d4ed8" />
                    <Text style={[s.footerChipText, s.multiDayChipText]}>
                      {t(`mobile.feed.multiDayChip`, { count: item.seriesDays })}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Bottom nav */}
      <View style={s.bottomNav}>
        <View style={s.navItemActive}>
          <Ionicons name="compass" size={24} color={colors.primary} />
          <Text style={s.navLabelActive}>{t('mobile.nav.shifts')}</Text>
        </View>
        <TouchableOpacity style={s.navItem} onPress={() => router.push('/my-shifts')} activeOpacity={0.7}>
          <Ionicons name="briefcase-outline" size={24} color={colors.textSecondary} />
          <Text style={s.navLabel}>{t('mobile.nav.myShifts')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => router.push('/profile')} activeOpacity={0.7}>
          <Ionicons name="person-circle-outline" size={24} color={colors.textSecondary} />
          <Text style={s.navLabel}>{t('mobile.nav.profile')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.secondary,
  },

  /* Header */
  header: {
    paddingTop: 52,
    paddingHorizontal: spacing.md,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerSide: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    height: 28,
    width: 110,
  },
  headerGreeting: {
    fontSize: fontSize.h3,
    fontWeight: fontWeight.bold,
    color: '#fff',
    marginBottom: 1,
  },
  headerSub: {
    fontSize: fontSize.caption,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: fontWeight.semibold,
    marginBottom: 8,
  },
  profileBanner: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    gap: 6,
  },
  profileBannerBar: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, overflow: 'hidden',
  },
  profileBannerFill: {
    height: '100%', backgroundColor: '#fff', borderRadius: 2,
  },
  profileBannerRow: { flexDirection: 'row', alignItems: 'center' },
  profileBannerText: {
    fontSize: 12, color: '#fff', fontWeight: fontWeight.semibold,
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Search row: search field + filter + map/list */
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    height: 46,
    gap: spacing.sm,
  },
  roundBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnOn: { backgroundColor: colors.primaryDark },
  filterBadge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 10, fontWeight: fontWeight.extrabold, color: colors.primary },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.textPrimary,
    height: '100%',
  },
  searchClear: { padding: 4 },
  searchClearText: { fontSize: 12, color: colors.textSecondary },

  /* Map */
  map: { flex: 1 },

  /* List */
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: 100,
  },

  /* Card */
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  urgentBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#fef3c7',
    borderBottomLeftRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#92400e',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTitleWrap: { flex: 1, paddingRight: spacing.sm },
  cardTitle: {
    fontSize: fontSize.h3,
    fontWeight: fontWeight.extrabold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  cardEmployer: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: fontWeight.semibold,
  },
  rateBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
    flexShrink: 0,
  },
  rateValue: {
    fontSize: fontSize.h3,
    fontWeight: fontWeight.extrabold,
    color: '#fff',
  },
  rateUnit: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: 'rgba(255,255,255,0.8)',
  },

  /* Net pay */
  netPay: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginBottom: 12,
    marginTop: 2,
  },
  netPayValue: {
    color: colors.success,
    fontWeight: fontWeight.bold,
  },
  recebe: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },

  cardDivider: {
    height: 1,
    backgroundColor: colors.neutral,
    marginBottom: 10,
  },

  /* Footer chips */
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  footerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.neutral,
  },
  footerChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  multiDayChip: { backgroundColor: '#dbeafe', borderColor: '#bfdbfe' },
  levelChip: { backgroundColor: '#eef0ff', borderColor: '#c7cdff' },
  openChip: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  slotsChip: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  multiDayChipText: { color: '#1d4ed8', fontWeight: fontWeight.bold },
  ratingChip: {
    backgroundColor: '#fef9c3',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#92400e',
  },

  /* Empty state */
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: {
    fontSize: fontSize.h3,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
  },

  /* Loading */
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 60,
  },
  loadingText: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },

  /* Bottom nav */
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.neutral,
    paddingBottom: 28,
    paddingTop: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  navItemActive: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  navIcon: { fontSize: 22, opacity: 0.5 },
  navIconActive: { fontSize: 22 },
  navLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: fontWeight.semibold },
  navLabelActive: { fontSize: 11, color: colors.primary, fontWeight: fontWeight.bold },
});

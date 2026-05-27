import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, fontSize, fontWeight, SHIFT_CATEGORIES, ShiftCategory, calculateTSU } from '@turnos/shared';
import { shiftApi, ShiftSummary, ApiError } from '../lib/api';
import { tokenStorage } from '../lib/storage';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === tomorrow.toDateString()) return 'Amanhã';
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

function toFeedItem(s: ShiftSummary) {
  const tsu = calculateTSU(Number(s.grossHourlyRate));
  // lat/lng are decimal columns from PostgreSQL — node-pg returns them as strings
  const lat = Number(s.lat) || 38.722;  // fallback: Lisboa centre
  const lng = Number(s.lng) || -9.139;
  return {
    id: s.id,
    title: s.title || s.subcategory,
    employerName: s.employer?.companyName ?? 'Empresa',
    category: s.category as ShiftCategory,
    subcategory: s.subcategory,
    grossHourlyRate: Number(s.grossHourlyRate),
    netHourlyRate: tsu.workerNetAmount,
    startTime: s.startTime.slice(0, 5),
    endTime: s.endTime.slice(0, 5),
    date: formatDate(s.date),
    coordinate: { latitude: lat, longitude: lng },
    urgent: false,
  };
}

export default function FeedScreen() {
  const [shifts, setShifts] = useState<ReturnType<typeof toFeedItem>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [activeCategory, setActiveCategory] = useState<ShiftCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const categories: (ShiftCategory | 'All')[] = ['All', ...(Object.keys(SHIFT_CATEGORIES) as ShiftCategory[])];

  const loadShifts = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await shiftApi.search(
        activeCategory !== 'All' ? { category: activeCategory } : undefined,
      );
      setShifts(data.map(toFeedItem));
    } catch {
      // API not available (dev mode) — show empty state
      setShifts([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeCategory]);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  const filteredShifts = shifts.filter(s =>
    !searchQuery ||
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.employerName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
          <View>
            <Text style={s.headerGreeting}>Olá 👋</Text>
            <Text style={s.headerSub}>
              {isLoading ? 'A carregar...' : `Lisboa · ${filteredShifts.length} turnos disponíveis`}
            </Text>
          </View>
          <TouchableOpacity style={s.profileBtn} activeOpacity={0.8} onPress={() => router.push('/my-shifts')}>
            <Text style={s.profileInitial}>★</Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={s.searchBar}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Pesquisar turnos ou empresa..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={s.searchClear}>
              <Text style={s.searchClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* ── Category chips ── */}
      <View style={s.filterBar}>
        {/* flex:1 wrapper prevents category chips from overflowing onto the toggle */}
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[s.chip, activeCategory === cat && s.chipActive]}
                onPress={() => setActiveCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={[s.chipText, activeCategory === cat && s.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* View toggle — monochromatic text icons (no coloured emoji) */}
        <View style={s.toggle}>
          <Pressable
            style={[s.toggleBtn, viewMode === 'list' && s.toggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Text style={[s.toggleIcon, viewMode === 'list' && s.toggleIconActive]}>≡</Text>
          </Pressable>
          <Pressable
            style={[s.toggleBtn, viewMode === 'map' && s.toggleBtnActive]}
            onPress={() => setViewMode('map')}
          >
            <Text style={[s.toggleIcon, viewMode === 'map' && s.toggleIconActive]}>◎</Text>
          </Pressable>
        </View>
      </View>

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
          <Text style={s.loadingText}>A carregar turnos...</Text>
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
              <Text style={s.emptyIcon}>🔍</Text>
              <Text style={s.emptyText}>Nenhum turno disponível</Text>
              <Text style={s.emptySub}>Tente outra categoria ou verifique mais tarde</Text>
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
                  <Text style={s.urgentText}>⚡ Urgente</Text>
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
                Líquido: <Text style={s.netPayValue}>€{item.netHourlyRate.toFixed(2)}/hr</Text>
                {'  ·  '}
                <Text style={s.recebe}>Recebe amanhã 💳</Text>
              </Text>

              <View style={s.cardDivider} />

              <View style={s.cardFooter}>
                <View style={s.footerChip}>
                  <Text style={s.footerChipText}>📅 {item.date}</Text>
                </View>
                <View style={s.footerChip}>
                  <Text style={s.footerChipText}>⏰ {item.startTime}–{item.endTime}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Bottom nav */}
      <View style={s.bottomNav}>
        <View style={s.navItemActive}>
          <Text style={s.navIconActive}>🏠</Text>
          <Text style={s.navLabelActive}>Turnos</Text>
        </View>
        <TouchableOpacity style={s.navItem} onPress={() => router.push('/my-shifts')} activeOpacity={0.7}>
          <Text style={s.navIcon}>📋</Text>
          <Text style={s.navLabel}>Os Meus</Text>
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
    paddingTop: 56,
    paddingHorizontal: spacing.md,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerGreeting: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.extrabold,
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: fontSize.caption,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 3,
    fontWeight: fontWeight.semibold,
  },
  profileBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  profileInitial: {
    fontSize: fontSize.h3,
    fontWeight: fontWeight.extrabold,
    color: '#fff',
  },

  /* Search */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    height: 46,
    gap: spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.textPrimary,
    height: '100%',
  },
  searchClear: { padding: 4 },
  searchClearText: { fontSize: 12, color: colors.textSecondary },

  /* Filter bar */
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral,
    paddingRight: spacing.md,
  },
  filterScroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.neutral,
    backgroundColor: colors.secondary,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  chipTextActive: {
    color: '#fff',
  },

  /* Toggle */
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.neutral,
    padding: 2,
    marginLeft: spacing.sm,
    flexShrink: 0,
  },
  toggleBtn: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleIcon: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  toggleIconActive: {
    color: '#fff',
  },

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

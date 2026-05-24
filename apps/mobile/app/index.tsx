import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ScrollView, TextInput, Pressable,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, fontSize, fontWeight, SHIFT_CATEGORIES, ShiftCategory } from '@turnos/shared';

const MOCK_SHIFTS = [
  {
    id: '1',
    title: 'Bartender Sénior',
    employerName: 'Rooftop Bar Lisboa',
    category: 'Hospitality' as ShiftCategory,
    subcategory: 'Bar',
    grossHourlyRate: 8.50,
    netHourlyRate: 7.57,
    startTime: '18:00',
    endTime: '02:00',
    date: 'Hoje',
    rating: 4.8,
    distance: '1.2 km',
    coordinate: { latitude: 38.711, longitude: -9.135 },
    urgent: true,
  },
  {
    id: '2',
    title: 'Staff de Evento',
    employerName: 'Web Summit',
    category: 'Events' as ShiftCategory,
    subcategory: 'Auxiliar',
    grossHourlyRate: 10.00,
    netHourlyRate: 8.90,
    startTime: '08:00',
    endTime: '18:00',
    date: 'Amanhã',
    rating: 4.9,
    distance: '3.5 km',
    coordinate: { latitude: 38.768, longitude: -9.094 },
    urgent: false,
  },
  {
    id: '3',
    title: 'Operador de Caixa',
    employerName: 'Worten Colombo',
    category: 'Sales' as ShiftCategory,
    subcategory: 'Caixa',
    grossHourlyRate: 7.50,
    netHourlyRate: 6.68,
    startTime: '10:00',
    endTime: '19:00',
    date: '26 Mai',
    rating: 4.5,
    distance: '5.0 km',
    coordinate: { latitude: 38.753, longitude: -9.189 },
    urgent: false,
  },
  {
    id: '4',
    title: 'Cozinheiro de Linha',
    employerName: 'Hotel Bairro Alto',
    category: 'Hospitality' as ShiftCategory,
    subcategory: 'Cozinha',
    grossHourlyRate: 9.00,
    netHourlyRate: 8.01,
    startTime: '11:00',
    endTime: '15:00',
    date: 'Hoje',
    rating: 4.7,
    distance: '0.8 km',
    coordinate: { latitude: 38.714, longitude: -9.144 },
    urgent: true,
  },
];

export default function FeedScreen() {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [activeCategory, setActiveCategory] = useState<ShiftCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const categories: (ShiftCategory | 'All')[] = ['All', ...(Object.keys(SHIFT_CATEGORIES) as ShiftCategory[])];

  const filteredShifts = MOCK_SHIFTS
    .filter(s => activeCategory === 'All' || s.category === activeCategory)
    .filter(s =>
      !searchQuery ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.employerName.toLowerCase().includes(searchQuery.toLowerCase())
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
            <Text style={s.headerGreeting}>Olá, Carlos 👋</Text>
            <Text style={s.headerSub}>Lisboa · {filteredShifts.length} turnos disponíveis</Text>
          </View>
          <TouchableOpacity style={s.profileBtn} activeOpacity={0.8}>
            <Text style={s.profileInitial}>C</Text>
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

        {/* View toggle */}
        <View style={s.toggle}>
          <Pressable
            style={[s.toggleBtn, viewMode === 'list' && s.toggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Text style={[s.toggleIcon, viewMode === 'list' && s.toggleIconActive]}>☰</Text>
          </Pressable>
          <Pressable
            style={[s.toggleBtn, viewMode === 'map' && s.toggleBtnActive]}
            onPress={() => setViewMode('map')}
          >
            <Text style={[s.toggleIcon, viewMode === 'map' && s.toggleIconActive]}>🗺</Text>
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
      ) : (
        <FlatList
          data={filteredShifts}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🔍</Text>
              <Text style={s.emptyText}>Nenhum turno encontrado</Text>
              <Text style={s.emptySub}>Tente outra categoria ou pesquisa</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => handleShiftPress(item.id)}
              activeOpacity={0.92}
            >
              {/* Urgent badge */}
              {item.urgent && (
                <View style={s.urgentBadge}>
                  <Text style={s.urgentText}>⚡ Urgente</Text>
                </View>
              )}

              {/* Card header */}
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

              {/* Net pay */}
              <Text style={s.netPay}>
                Líquido: <Text style={s.netPayValue}>€{item.netHourlyRate.toFixed(2)}/hr</Text>
                {'  ·  '}
                <Text style={s.recebe}>Recebe amanhã 💳</Text>
              </Text>

              {/* Divider */}
              <View style={s.cardDivider} />

              {/* Footer row */}
              <View style={s.cardFooter}>
                <View style={s.footerChip}>
                  <Text style={s.footerChipText}>📅 {item.date}</Text>
                </View>
                <View style={s.footerChip}>
                  <Text style={s.footerChipText}>⏰ {item.startTime}–{item.endTime}</Text>
                </View>
                <View style={s.footerChip}>
                  <Text style={s.footerChipText}>📍 {item.distance}</Text>
                </View>
                <View style={s.ratingChip}>
                  <Text style={s.ratingText}>⭐ {item.rating}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
});

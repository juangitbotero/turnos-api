/**
 * Feed filters — category (multi-select) and date — in a bottom sheet opened
 * from the filter button next to the search bar. Replaced the row of category
 * chips under the header (2026-11-05), which took a full row of the screen and
 * could only filter by one category.
 *
 * Built on React Native's Modal: no new dependency, so it ships without a
 * native rebuild concern.
 */
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize, fontWeight, SHIFT_CATEGORIES, ShiftCategory } from '@turnos/shared';
import { useT } from '../lib/i18n';

export type DateFilter =
  | { kind: 'any' }
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'weekend' }
  | { kind: 'week' }
  | { kind: 'day'; date: string }; // YYYY-MM-DD

export interface FeedFilters {
  categories: ShiftCategory[];
  date: DateFilter;
}

export const NO_FILTERS: FeedFilters = { categories: [], date: { kind: 'any' } };

export function activeFilterCount(f: FeedFilters): number {
  return f.categories.length + (f.date.kind === 'any' ? 0 : 1);
}

/** Local calendar day as YYYY-MM-DD (the phone's day, i.e. Lisbon for our users). */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** The calendar days a date filter accepts; null = any day. */
export function daysFor(filter: DateFilter, now = new Date()): Set<string> | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (filter.kind) {
    case 'any':      return null;
    case 'today':    return new Set([isoDay(today)]);
    case 'tomorrow': return new Set([isoDay(addDays(today, 1))]);
    case 'week':     return new Set(Array.from({ length: 7 }, (_, i) => isoDay(addDays(today, i))));
    case 'day':      return new Set([filter.date]);
    case 'weekend': {
      // This weekend if it's Saturday or Sunday now, otherwise the coming one
      const dow = today.getDay(); // 0 = Sunday
      if (dow === 0) return new Set([isoDay(today)]);
      const sat = addDays(today, (6 - dow + 7) % 7);
      return new Set([isoDay(sat), isoDay(addDays(sat, 1))]);
    }
  }
}

/** Does a shift (one day, or every day of a multi-day job) match the filters? */
export function matchesFilters(f: FeedFilters, category: ShiftCategory, dates: string[]): boolean {
  if (f.categories.length > 0 && !f.categories.includes(category)) return false;
  const days = daysFor(f.date);
  return !days || dates.some(d => days.has(d));
}

export function FeedFilterSheet({
  visible, value, onClose, onApply, countFor,
}: {
  visible: boolean;
  value: FeedFilters;
  onClose: () => void;
  onApply: (f: FeedFilters) => void;
  /** How many shifts the draft filters would show — for the "Show N shifts" button. */
  countFor: (f: FeedFilters) => number;
}) {
  const { t, tCategory } = useT();
  const [draft, setDraft] = useState<FeedFilters>(value);
  const [pickingDay, setPickingDay] = useState(false);

  // Each time the sheet opens, start from what is applied now
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) { setDraft(value); setPickingDay(value.date.kind === 'day'); }
  }

  const toggleCategory = (c: ShiftCategory) =>
    setDraft(d => ({
      ...d,
      categories: d.categories.includes(c) ? d.categories.filter(x => x !== c) : [...d.categories, c],
    }));

  const quickDates: Array<{ kind: Exclude<DateFilter['kind'], 'day'>; label: string }> = [
    { kind: 'any',      label: t('mobile.feed.dateAny') },
    { kind: 'today',    label: t('mobile.feed.dateToday') },
    { kind: 'tomorrow', label: t('mobile.feed.dateTomorrow') },
    { kind: 'weekend',  label: t('mobile.feed.dateWeekend') },
    { kind: 'week',     label: t('mobile.feed.dateWeek') },
  ];

  const count = countFor(draft);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.headRow}>
          <Text style={s.title}>{t('mobile.feed.filterTitle')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          <Text style={s.section}>{t('mobile.feed.filterCategory')}</Text>
          <View style={s.chips}>
            {(Object.keys(SHIFT_CATEGORIES) as ShiftCategory[]).map(c => {
              const on = draft.categories.includes(c);
              return (
                <TouchableOpacity key={c} style={[s.chip, on && s.chipOn]} onPress={() => toggleCategory(c)} activeOpacity={0.8}>
                  {on && <Ionicons name="checkmark" size={14} color="#fff" />}
                  <Text style={[s.chipText, on && s.chipTextOn]}>{tCategory(c)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.section}>{t('mobile.feed.filterDate')}</Text>
          <View style={s.chips}>
            {quickDates.map(q => {
              const on = draft.date.kind === q.kind && !pickingDay;
              return (
                <TouchableOpacity
                  key={q.kind}
                  style={[s.chip, on && s.chipOn]}
                  onPress={() => { setPickingDay(false); setDraft(d => ({ ...d, date: { kind: q.kind } as DateFilter })); }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.chipText, on && s.chipTextOn]}>{q.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[s.chip, pickingDay && s.chipOn]}
              onPress={() => setPickingDay(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={14} color={pickingDay ? '#fff' : colors.textSecondary} />
              <Text style={[s.chipText, pickingDay && s.chipTextOn]}>{t('mobile.feed.datePick')}</Text>
            </TouchableOpacity>
          </View>

          {pickingDay && (
            <DayPicker
              selected={draft.date.kind === 'day' ? draft.date.date : null}
              onSelect={iso => setDraft(d => ({ ...d, date: { kind: 'day', date: iso } }))}
            />
          )}
        </ScrollView>

        <View style={s.actions}>
          <TouchableOpacity
            style={s.clearBtn}
            onPress={() => { setPickingDay(false); setDraft(NO_FILTERS); }}
            activeOpacity={0.8}
          >
            <Text style={s.clearText}>{t('mobile.feed.filterClear')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.applyBtn}
            onPress={() => onApply(pickingDay && draft.date.kind !== 'day' ? { ...draft, date: { kind: 'any' } } : draft)}
            activeOpacity={0.85}
          >
            <Text style={s.applyText}>{t('mobile.feed.filterShow', { count: String(count) })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/** One selectable month at a time, from the current month on. */
function DayPicker({ selected, onSelect }: { selected: string | null; onSelect: (iso: string) => void }) {
  const { fMonthName, fWeekdayInitials } = useT();
  const now = new Date();
  const todayIso = isoDay(now);
  const [offset, setOffset] = useState(() => {
    if (!selected) return 0;
    const [y, m] = selected.split('-').map(Number);
    return Math.max(0, (y! - now.getFullYear()) * 12 + (m! - 1 - now.getMonth()));
  });
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = first.getFullYear();
  const mon = first.getMonth();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7; // Monday first
  const cells: Array<number | null> = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View style={s.picker}>
      <View style={s.pickerHead}>
        <TouchableOpacity onPress={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={offset === 0 ? colors.neutral : colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.pickerMonth}>{fMonthName(mon, year)} {year}</Text>
        <TouchableOpacity onPress={() => setOffset(o => Math.min(11, o + 1))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={s.weekHead}>
        {fWeekdayInitials().map((w, i) => <Text key={i} style={s.weekHeadText}>{w}</Text>)}
      </View>
      <View style={s.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`b${i}`} style={s.cell} />;
          const iso = `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const past = iso < todayIso;
          const on = iso === selected;
          return (
            <TouchableOpacity key={iso} style={s.cell} disabled={past} onPress={() => onSelect(iso)} activeOpacity={0.7}>
              <View style={[s.cellInner, on && s.cellInnerOn]}>
                <Text style={[s.cellText, past && s.cellTextPast, on && s.cellTextOn]}>{day}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.35)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: spacing.md, paddingBottom: 28, paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.neutral, marginBottom: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: fontSize.h3, fontWeight: fontWeight.extrabold, color: colors.textPrimary },
  section: {
    fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.neutral, backgroundColor: colors.secondary,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.caption, color: colors.textSecondary, fontWeight: fontWeight.semibold },
  chipTextOn: { color: '#fff' },

  picker: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.neutral, borderRadius: radius.md, padding: spacing.sm },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 4 },
  pickerMonth: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary, textTransform: 'capitalize' },
  weekHead: { flexDirection: 'row' },
  weekHeadText: { flex: 1, textAlign: 'center', fontSize: 11, color: colors.textSecondary, fontWeight: fontWeight.bold, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellInner: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cellInnerOn: { backgroundColor: colors.primary },
  cellText: { fontSize: fontSize.body, color: colors.textPrimary, fontWeight: fontWeight.semibold },
  cellTextPast: { color: colors.neutral },
  cellTextOn: { color: '#fff' },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  clearBtn: {
    flex: 1, height: 48, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.neutral,
    alignItems: 'center', justifyContent: 'center',
  },
  clearText: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.textPrimary },
  applyBtn: { flex: 2, height: 48, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  applyText: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: '#fff' },
});

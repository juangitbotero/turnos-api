/**
 * Schedule of a multi-day job, as a list of days or a month calendar with the
 * worked days highlighted. Shown from the "Ver horário" link on a shift detail.
 */
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';

const WEEKDAY_INITIALS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']; // Mon-first, pt-PT
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

type Mode = 'list' | 'calendar';

export function ShiftSchedule({
  dates, startTime, endTime,
}: {
  dates: string[];
  startTime: string;
  endTime: string;
}) {
  const [mode, setMode] = useState<Mode>('list');
  const sorted = [...dates].sort();

  return (
    <View style={s.root}>
      {/* List / Calendar toggle */}
      <View style={s.toggle}>
        <TouchableOpacity
          style={[s.toggleBtn, mode === 'list' && s.toggleBtnActive]}
          onPress={() => setMode('list')}
          activeOpacity={0.85}
        >
          <Ionicons name="list" size={16} color={mode === 'list' ? '#fff' : colors.textSecondary} />
          <Text style={[s.toggleText, mode === 'list' && s.toggleTextActive]}>Lista</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, mode === 'calendar' && s.toggleBtnActive]}
          onPress={() => setMode('calendar')}
          activeOpacity={0.85}
        >
          <Ionicons name="calendar" size={16} color={mode === 'calendar' ? '#fff' : colors.textSecondary} />
          <Text style={[s.toggleText, mode === 'calendar' && s.toggleTextActive]}>Calendário</Text>
        </TouchableOpacity>
      </View>

      {mode === 'list'
        ? <DayList dates={sorted} startTime={startTime} endTime={endTime} />
        : <MonthGrid dates={sorted} />}
    </View>
  );
}

function DayList({ dates, startTime, endTime }: { dates: string[]; startTime: string; endTime: string }) {
  return (
    <View style={s.list}>
      {dates.map((day, i) => {
        const d = new Date(day);
        const isPast = d < new Date(new Date().toDateString());
        return (
          <View key={day} style={[s.dayRow, isPast && s.dayRowPast]}>
            <View style={s.dayIndex}>
              <Text style={s.dayIndexText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.dayLabel}>
                {d.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })}
              </Text>
              <Text style={s.dayTime}>{startTime.slice(0, 5)} – {endTime.slice(0, 5)}</Text>
            </View>
            {isPast && <Text style={s.dayDone}>✓</Text>}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Month grid for every month the job touches. Weeks start on Monday, matching
 * the pt-PT convention.
 */
function MonthGrid({ dates }: { dates: string[] }) {
  const marked = new Set(dates);

  // One grid per distinct month in the range
  const months = [...new Set(dates.map(d => d.slice(0, 7)))].sort();

  return (
    <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
      {months.map(month => {
        const [year, mon] = month.split('-').map(Number);
        const firstOfMonth = new Date(year!, mon! - 1, 1);
        const daysInMonth = new Date(year!, mon!, 0).getDate();
        // JS getDay(): 0=Sunday. Shift so Monday is column 0.
        const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

        const cells: Array<number | null> = [
          ...Array<null>(leadingBlanks).fill(null),
          ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
        ];

        return (
          <View key={month} style={s.month}>
            <Text style={s.monthName}>{MONTH_NAMES[mon! - 1]} {year}</Text>

            <View style={s.weekHead}>
              {WEEKDAY_INITIALS.map((w, i) => (
                <Text key={i} style={s.weekHeadText}>{w}</Text>
              ))}
            </View>

            <View style={s.grid}>
              {cells.map((day, i) => {
                if (day === null) return <View key={`b${i}`} style={s.cell} />;
                const iso = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const on = marked.has(iso);
                return (
                  <View key={iso} style={s.cell}>
                    <View style={[s.cellInner, on && s.cellInnerOn]}>
                      <Text style={[s.cellText, on && s.cellTextOn]}>{day}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { gap: spacing.sm },

  toggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f2f6',
    borderRadius: radius.full,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: radius.full,
  },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.textSecondary },
  toggleTextActive: { color: '#fff' },

  /* List */
  list: { gap: 8 },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.neutral,
    borderRadius: radius.md, padding: spacing.sm,
  },
  dayRowPast: { opacity: 0.55 },
  dayIndex: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  dayIndexText: { fontSize: 12, fontWeight: fontWeight.bold as any, color: colors.primary },
  dayLabel: {
    fontSize: fontSize.body, fontWeight: fontWeight.bold as any,
    color: colors.textPrimary, textTransform: 'capitalize',
  },
  dayTime: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 1 },
  dayDone: { fontSize: 16, color: '#16a34a', fontWeight: fontWeight.bold as any },

  /* Calendar */
  month: { marginBottom: spacing.md },
  monthName: {
    fontSize: fontSize.h3, fontWeight: fontWeight.bold as any,
    color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.sm,
  },
  weekHead: { flexDirection: 'row', marginBottom: 6 },
  weekHeadText: {
    flex: 1, textAlign: 'center',
    fontSize: fontSize.caption, fontWeight: fontWeight.bold as any, color: colors.textSecondary,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellInner: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cellInnerOn: { backgroundColor: colors.primary },
  cellText: { fontSize: fontSize.body, color: colors.textPrimary },
  cellTextOn: { color: '#fff', fontWeight: fontWeight.bold as any },
});

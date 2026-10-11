/**
 * Notifications inbox (2026-10-11) — every personal notification the API sent
 * this worker, newest first, kept on the server.
 *
 * Push alone was the only channel: a worker with notifications off, or who
 * swiped the banner away, had no record that a company selected them, and the
 * 2-hour window to accept simply ran out. Opening this screen marks
 * everything read; tapping an entry opens the same screen its push would
 * (lib/notificationRoute.ts).
 *
 * Titles and bodies are stored as sent (Portuguese, like the pushes) — they
 * are a record of what the worker was told, not UI copy.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';
import { inboxApi, InboxItem } from '../lib/api';
import { notificationRoute } from '../lib/notificationRoute';
import { useT } from '../lib/i18n';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pre_selected: 'flash',
  offer_withdrawn: 'close-circle-outline',
  acceptance_timeout: 'time-outline',
  shift_cancelled_by_employer: 'close-circle-outline',
  rate_employer: 'star-outline',
  wage_paid: 'cash-outline',
  wage_marked_paid: 'cash-outline',
  wage_adjusted: 'create-outline',
  account_restricted: 'alert-circle-outline',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { t, fDateTime } = useT();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const res = await inboxApi.list();
      setItems(res.items);
      // Opening the inbox is reading it. The list keeps showing which were
      // unread this time (from `res`); the bell clears for next time.
      if (res.unread > 0) inboxApi.markRead().catch(() => {});
    } catch {
      setError(t('mobile.inbox.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const open = (item: InboxItem) => {
    const route = notificationRoute(item.data ?? { type: item.type });
    if (route) router.push(route as any);
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={['#6a79ff', '#9b6dff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('mobile.inbox.title')}</Text>
          <View style={s.iconBtn} />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={items.length === 0 ? s.emptyWrap : s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name={error ? 'cloud-offline-outline' : 'notifications-off-outline'} size={44} color={colors.textSecondary} />
              <Text style={s.emptyTitle}>{error || t('mobile.inbox.emptyTitle')}</Text>
              {!error && <Text style={s.emptySub}>{t('mobile.inbox.emptySub')}</Text>}
            </View>
          }
          renderItem={({ item }) => {
            const unread = !item.readAt;
            const tappable = !!notificationRoute(item.data ?? { type: item.type });
            return (
              <TouchableOpacity
                style={[s.row, unread && s.rowUnread]}
                onPress={() => open(item)}
                disabled={!tappable}
                activeOpacity={0.8}
              >
                <View style={[s.icon, unread && s.iconUnread]}>
                  <Ionicons name={ICONS[item.type] ?? 'notifications-outline'} size={18} color={unread ? '#fff' : colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, unread && s.titleUnread]}>{item.title}</Text>
                  <Text style={s.body}>{item.body}</Text>
                  <Text style={s.when}>{fDateTime(item.createdAt)}</Text>
                </View>
                {tappable && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.secondary },
  header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: fontSize.h3, fontWeight: fontWeight.bold as any },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  emptyWrap: { flexGrow: 1 },
  emptyTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.textPrimary, textAlign: 'center' },
  emptySub: { fontSize: fontSize.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },

  list: { padding: spacing.md, gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: radius.md, padding: 14,
    borderWidth: 1, borderColor: '#e8eaf2',
  },
  rowUnread: { borderColor: 'rgba(106,121,255,0.45)', backgroundColor: '#f6f7ff' },
  icon: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  iconUnread: { backgroundColor: colors.primary },
  title: { fontSize: fontSize.body, fontWeight: fontWeight.semibold as any, color: colors.textPrimary },
  titleUnread: { fontWeight: fontWeight.bold as any },
  body: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 19 },
  when: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
});

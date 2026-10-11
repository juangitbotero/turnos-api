/**
 * Bell with the unread count — opens the notifications inbox.
 *
 * Refreshes when its screen comes into focus (coming back from the inbox
 * clears it) and when a push lands while the app is open, so the number moves
 * without a pull-to-refresh.
 */
import { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { inboxApi } from '../lib/api';
import { useT } from '../lib/i18n';

export function InboxBell({ color = '#fff', style }: { color?: string; style?: object }) {
  const router = useRouter();
  const { t } = useT();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    inboxApi.unreadCount().then(r => setUnread(r.unread)).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => refresh());
    return () => sub.remove();
  }, [refresh]);

  return (
    <TouchableOpacity
      style={[s.btn, style]}
      onPress={() => router.push('/notifications' as any)}
      activeOpacity={0.8}
      accessibilityLabel={t('mobile.inbox.bellLabel', { count: unread })}
    >
      <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={24} color={color} />
      {unread > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});

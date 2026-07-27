import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme } from '../theme/appVisualTheme';
import {
  type NotificationCenterEntry,
  formatNotificationCenterTime,
  localNotificationDateKey,
} from '../utils/notificationCenterStore';

function typeAccent(type: NotificationCenterEntry['type']): string {
  switch (type) {
    case 'success':
      return '#00ff88';
    case 'error':
      return '#ff6b6b';
    case 'warning':
      return '#FFB84D';
    case 'info':
    default:
      return '#7EB6FF';
  }
}

type Props = {
  visible: boolean;
  entries: NotificationCenterEntry[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
};

export function NotificationCenterModal({
  visible,
  entries,
  onClose,
  onMarkAllRead,
  onDeleteEntry,
  onClearAll,
}: Props) {
  const insets = useSafeAreaInsets();
  const todayLabel = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const confirmClearAll = () => {
    if (entries.length === 0) return;
    Alert.alert(
      'Clear notifications?',
      'This removes all of today’s notifications from this list.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear all', style: 'destructive', onPress: onClearAll },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={styles.doneBtn} hitSlop={10}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSub}>{todayLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={confirmClearAll}
            style={styles.clearBtn}
            hitSlop={10}
            disabled={entries.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Clear all notifications"
          >
            <Text style={[styles.clearText, entries.length === 0 && styles.clearTextDisabled]}>
              Clear all
            </Text>
          </TouchableOpacity>
        </View>

        {entries.length > 0 ? (
          <View style={styles.toolbar}>
            <Text style={styles.toolbarCount}>
              {entries.length} today{entries.some((e) => !e.read) ? ' · unread' : ''}
            </Text>
            <TouchableOpacity onPress={onMarkAllRead} hitSlop={8} accessibilityRole="button">
              <Text style={styles.markReadText}>Mark all read</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {entries.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>No notifications today</Text>
              <Text style={styles.emptyBody}>
                Alerts from meals, workouts, coach tips, and app messages will show up here for{' '}
                {localNotificationDateKey()}.
              </Text>
            </View>
          ) : (
            entries.map((entry) => {
              const accent = typeAccent(entry.type);
              return (
                <View
                  key={entry.id}
                  style={[styles.card, !entry.read && styles.cardUnread]}
                >
                  <View style={[styles.accent, { backgroundColor: accent }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardTitleCol}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {entry.title || 'Notification'}
                        </Text>
                        <Text style={styles.cardTime}>{formatNotificationCenterTime(entry.createdAt)}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => onDeleteEntry(entry.id)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Delete notification"
                      >
                        <Text style={styles.deleteBtnText}>×</Text>
                      </TouchableOpacity>
                    </View>
                    {entry.lines.map((line, index) => (
                      <Text key={`${entry.id}-line-${index}`} style={styles.cardLine}>
                        {line}
                      </Text>
                    ))}
                    {!entry.read ? <View style={styles.unreadDot} /> : null}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  doneBtn: {
    minWidth: 56,
    minHeight: 44,
    justifyContent: 'center',
  },
  doneText: {
    color: AppTheme.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: AppTheme.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSub: {
    color: AppTheme.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  clearBtn: {
    minWidth: 72,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  clearText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '700',
  },
  clearTextDisabled: {
    opacity: 0.35,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toolbarCount: {
    color: AppTheme.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  markReadText: {
    color: AppTheme.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
    opacity: 0.7,
  },
  emptyTitle: {
    color: AppTheme.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyBody: {
    color: AppTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  cardUnread: {
    borderColor: 'rgba(0, 255, 136, 0.35)',
    backgroundColor: 'rgba(0, 255, 136, 0.06)',
  },
  accent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: 12,
    paddingRight: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  cardTitleCol: {
    flex: 1,
    paddingRight: 4,
  },
  cardTitle: {
    color: AppTheme.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  cardTime: {
    color: AppTheme.textFaint,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  deleteBtnText: {
    color: AppTheme.textMuted,
    fontSize: 20,
    fontWeight: '600',
    marginTop: -1,
  },
  cardLine: {
    color: AppTheme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 2,
    paddingRight: 28,
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 44,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
  },
});

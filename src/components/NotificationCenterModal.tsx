import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
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
};

export function NotificationCenterModal({ visible, entries, onClose, onMarkAllRead }: Props) {
  const insets = useSafeAreaInsets();
  const todayLabel = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

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
            onPress={onMarkAllRead}
            style={styles.clearBtn}
            hitSlop={10}
            disabled={entries.length === 0}
          >
            <Text style={[styles.clearText, entries.length === 0 && styles.clearTextDisabled]}>
              Mark read
            </Text>
          </TouchableOpacity>
        </View>

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
                      {entry.title ? (
                        <Text style={styles.cardTitle}>{entry.title}</Text>
                      ) : (
                        <Text style={styles.cardTitle}>Notification</Text>
                      )}
                      <Text style={styles.cardTime}>{formatNotificationCenterTime(entry.createdAt)}</Text>
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
    color: AppTheme.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  clearTextDisabled: {
    opacity: 0.35,
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
    paddingRight: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    color: AppTheme.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  cardTime: {
    color: AppTheme.textFaint,
    fontSize: 12,
    fontWeight: '600',
  },
  cardLine: {
    color: AppTheme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
  },
});

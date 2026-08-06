import { Platform } from 'react-native';
import { requestNotificationPermissions } from './notifications';

type NotificationsModule = typeof import('expo-notifications');

const CHANNEL_ID = 'rest_timer';

let pendingNotificationId: string | null = null;

async function getNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

async function ensureAndroidChannel(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Rest timer',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 150, 250],
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/** Cancel any pending rest-complete notification (by id only — never cancel-all). */
export async function cancelRestCompleteNotification(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications || !pendingNotificationId) {
    pendingNotificationId = null;
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(pendingNotificationId);
  } catch {
    /* ignore */
  }
  pendingNotificationId = null;
}

/**
 * Schedule a Clock-style local notification for when rest ends.
 * Works while the phone is locked / app is backgrounded.
 */
export async function scheduleRestCompleteNotification(
  endsAtMs: number,
  opts?: { title?: string; body?: string }
): Promise<boolean> {
  await cancelRestCompleteNotification();

  const fireAt = Math.max(endsAtMs, Date.now() + 800);
  if (fireAt - Date.now() < 500) return false;

  const ok = await requestNotificationPermissions();
  if (!ok) return false;

  const Notifications = await getNotifications();
  if (!Notifications) return false;

  await ensureAndroidChannel(Notifications);

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: opts?.title ?? 'Rest over',
        body: opts?.body ?? 'Time for your next set.',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { type: 'rest_timer_complete' },
        ...(Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' as const } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(fireAt),
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
    pendingNotificationId = id;
    return true;
  } catch (error) {
    console.warn('[restTimerNotifications] schedule failed', error);
    pendingNotificationId = null;
    return false;
  }
}

export async function rescheduleRestCompleteNotification(endsAtMs: number): Promise<boolean> {
  return scheduleRestCompleteNotification(endsAtMs);
}

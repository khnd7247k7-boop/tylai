import { Platform } from 'react-native';
import { loadUserData, saveUserData } from './userStorage';
import { requestNotificationPermissions } from './notifications';

const META_KEY = 'smallWinsNotificationMeta';

type Meta = { microNudgeNotificationId: string | null };

type NotificationsModule = typeof import('expo-notifications');

async function getNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

async function loadMeta(): Promise<Meta> {
  const m = await loadUserData<Meta>(META_KEY);
  return { microNudgeNotificationId: m?.microNudgeNotificationId ?? null };
}

async function saveMeta(m: Meta): Promise<void> {
  await saveUserData(META_KEY, m);
}

export async function cancelMicroGoalNudge(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  const meta = await loadMeta();
  if (meta.microNudgeNotificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(meta.microNudgeNotificationId);
    } catch {
      /* ignore */
    }
    await saveMeta({ microNudgeNotificationId: null });
  }
}

/**
 * If user has had no small win for 5+ days, schedule a one-shot local notification
 * (next day ~9:00 local) suggesting a micro-goal.
 */
export async function scheduleMicroGoalNudgeIfNeeded(lastSmallWinAgeDays: number | null): Promise<void> {
  if (lastSmallWinAgeDays == null || lastSmallWinAgeDays < 5) {
    await cancelMicroGoalNudge();
    return;
  }

  const ok = await requestNotificationPermissions();
  if (!ok) return;

  const Notifications = await getNotifications();
  if (!Notifications) return;

  await cancelMicroGoalNudge();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('small_wins', {
      name: 'Coach nudges',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const when = new Date();
  when.setDate(when.getDate() + 1);
  when.setHours(9, 0, 0, 0);
  if (when.getTime() <= Date.now() + 60_000) {
    when.setDate(when.getDate() + 1);
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Micro-goal from your coach',
      body: 'Pick one easy win today: open the workout logger, log a 10-minute walk, or note your sleep. Small steps rebuild momentum.',
      sound: true,
      data: { type: 'micro_goal_nudge' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: Platform.OS === 'android' ? 'small_wins' : undefined,
    },
  });

  await saveMeta({ microNudgeNotificationId: id });
}

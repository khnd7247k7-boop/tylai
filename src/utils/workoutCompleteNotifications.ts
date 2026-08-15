/**
 * Celebrate a logged workout via in-app banner + OS notification.
 * Honors Smart Coach celebration prefs and the existing notification pipeline.
 */
import { Platform } from 'react-native';
import { showAppNotification } from './appNotificationBridge';
import { requestNotificationPermissions } from './notifications';

type WorkoutCompleteInput = {
  programName?: string;
  duration?: number;
  exerciseCount?: number;
};

const CHANNEL_ID = 'workout_complete';

function celebrationCopy(input: WorkoutCompleteInput): { title: string; body: string } {
  const name = input.programName?.trim() || 'your workout';
  const mins = input.duration != null && input.duration > 0 ? Math.round(input.duration) : 0;
  const moves = input.exerciseCount != null && input.exerciseCount > 0 ? input.exerciseCount : 0;
  const title = 'Workout complete 💪';
  if (mins > 0 && moves > 0) {
    return {
      title,
      body: `You finished ${name} — ${moves} exercise${moves === 1 ? '' : 's'} in ${mins} min. That’s a session worth celebrating.`,
    };
  }
  if (mins > 0) {
    return {
      title,
      body: `Nice work — you completed ${name} in ${mins} min. Be proud of that effort.`,
    };
  }
  return {
    title,
    body: `Nice work — you completed ${name}. Be proud of showing up today.`,
  };
}

async function getNotifications(): Promise<typeof import('expo-notifications') | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

async function celebrationsAllowed(): Promise<boolean> {
  try {
    const { loadSmartNotificationPrefs } = await import('../services/notificationPrefsService');
    const prefs = await loadSmartNotificationPrefs();
    if (prefs.enabled === false) return false;
    if (prefs.categories?.celebration === false) return false;
    return true;
  } catch {
    return true;
  }
}

async function presentOsCelebration(title: string, body: string): Promise<void> {
  const ok = await requestNotificationPermissions();
  if (!ok) return;
  const Notifications = await getNotifications();
  if (!Notifications) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Workout celebrations',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 120, 180],
      sound: 'default',
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: {
        type: 'workout_complete',
        category: 'celebration',
        action: 'view_progress',
        screen: 'progress',
      },
    },
    trigger: null,
  });
}

export async function notifyWorkoutCompleted(input: WorkoutCompleteInput): Promise<void> {
  const { title, body } = celebrationCopy(input);

  showAppNotification({
    title,
    lines: [body],
    type: 'success',
    durationMs: 4800,
  });

  try {
    if (!(await celebrationsAllowed())) return;
    await presentOsCelebration(title, body);
  } catch (error) {
    console.warn('[workoutCompleteNotifications] OS notify failed', error);
  }
}

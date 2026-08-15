/**
 * Handle incoming smart notification taps and mirror into Notification Center.
 */
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { recordNotificationCenterEntry } from './notificationCenterStore';
import type { NotificationAction } from '../types/smartNotifications';

export type SmartNotificationNavTarget =
  | 'dashboard'
  | 'fitness'
  | 'fitness_log_food'
  | 'progress'
  | 'health';

type SmartPushData = {
  type?: string;
  category?: string;
  action?: NotificationAction | string;
  screen?: string;
  historyId?: string;
  candidateId?: string;
  title?: string;
  body?: string;
};

let responseSub: { remove: () => void } | null = null;
let receiveSub: { remove: () => void } | null = null;

export function mapScreenToTarget(screen?: string | null): SmartNotificationNavTarget {
  switch (screen) {
    case 'fitness':
      return 'fitness';
    case 'fitness_log_food':
      return 'fitness_log_food';
    case 'progress':
      return 'progress';
    case 'health':
      return 'health';
    default:
      return 'dashboard';
  }
}

export function mapActionToTarget(action?: string | null): SmartNotificationNavTarget {
  switch (action) {
    case 'start_workout':
    case 'adjust_schedule':
      return 'fitness';
    case 'log_food':
      return 'fitness_log_food';
    case 'view_progress':
      return 'progress';
    case 'view_recovery':
      return 'health';
    default:
      return 'dashboard';
  }
}

async function markHistoryEvent(
  historyId: string,
  event: 'opened' | 'acted' | 'dismissed'
): Promise<void> {
  const uid = auth?.currentUser?.uid;
  if (!uid || !historyId || !db || auth?._isMock) return;
  try {
    const patch: Record<string, string> = {};
    const now = new Date().toISOString();
    if (event === 'opened') patch.openedAt = now;
    if (event === 'acted') {
      patch.actedAt = now;
      patch.openedAt = now;
    }
    if (event === 'dismissed') patch.dismissedAt = now;
    await updateDoc(doc(db, 'users', uid, 'notificationHistory', historyId), patch);
  } catch (e) {
    console.warn('[smartNotification] markHistoryEvent failed', e);
  }
}

export function startSmartNotificationListeners(opts: {
  onNavigate: (target: SmartNotificationNavTarget) => void;
}): () => void {
  if (Platform.OS === 'web') return () => {};

  let cancelled = false;

  void (async () => {
    try {
      const Notifications = await import('expo-notifications');
      if (cancelled) return;

      receiveSub = Notifications.addNotificationReceivedListener((notification) => {
        const data = (notification.request.content.data || {}) as SmartPushData;
        if (data.type !== 'smart_notification') return;
        const title = notification.request.content.title || data.title || 'TYL Coach';
        const body = notification.request.content.body || data.body || '';
        void recordNotificationCenterEntry(`smart_${Date.now()}`, {
          title: String(title),
          lines: body ? [String(body)] : [],
          type: 'info',
        });
      });

      responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = (response.notification.request.content.data || {}) as SmartPushData;
        if (data.type === 'workout_complete') {
          opts.onNavigate(mapScreenToTarget(data.screen) !== 'dashboard'
            ? mapScreenToTarget(data.screen)
            : mapActionToTarget(data.action));
          return;
        }
        if (data.type !== 'smart_notification') return;
        const historyId = data.historyId;
        if (historyId) void markHistoryEvent(String(historyId), 'acted');
        const target =
          mapScreenToTarget(data.screen) !== 'dashboard'
            ? mapScreenToTarget(data.screen)
            : mapActionToTarget(data.action);
        opts.onNavigate(target);
      });
    } catch (e) {
      console.warn('[smartNotification] listeners unavailable', e);
    }
  })();

  return () => {
    cancelled = true;
    responseSub?.remove();
    receiveSub?.remove();
    responseSub = null;
    receiveSub = null;
  };
}

export async function markSmartNotificationOpened(historyId: string): Promise<void> {
  await markHistoryEvent(historyId, 'opened');
}

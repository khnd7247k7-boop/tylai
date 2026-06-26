import { Alert, Platform } from 'react-native';
import {
  coachAdaptationAlertTitle,
  consumePendingCoachAdaptationNotice,
  formatCoachAdaptationAlertBody,
} from './planAdaptationNotice';
import { showAppNotification } from './appNotificationBridge';

/** Show a one-time banner the next time the user opens a saved plan after coach adaptation. */
export async function showPendingCoachAdaptationNoticeIfAny(planId: string): Promise<void> {
  const notice = await consumePendingCoachAdaptationNotice(planId);
  if (!notice) return;

  const title = coachAdaptationAlertTitle(notice.action);
  const body = formatCoachAdaptationAlertBody(notice.action, notice.changes);
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);

  if (showAppNotification({ title, lines, type: 'info', actions: [{ label: 'Got it' }] })) {
    return;
  }

  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${body}`);
    return;
  }

  Alert.alert(title, body, [{ text: 'Got it' }]);
}

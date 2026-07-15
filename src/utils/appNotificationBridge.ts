import { Alert, type AlertButton } from 'react-native';

export type NotificationAction = {
  label: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AppNotificationPayload = {
  title?: string;
  lines?: string[];
  type?: 'success' | 'error' | 'info' | 'warning';
  actions?: NotificationAction[];
  durationMs?: number;
  /** Stays until the user taps an action or dismiss. */
  persistent?: boolean;
  /** Called when the user closes the banner (× or auto-dismiss), not when tapping an action. */
  onDismiss?: () => void;
};

type ShowNotificationFn = (payload: AppNotificationPayload) => string;

let showNotificationFn: ShowNotificationFn | null = null;

export function registerNotificationBridge(show: ShowNotificationFn): void {
  showNotificationFn = show;
}

export function showAppNotification(payload: AppNotificationPayload): string | null {
  return showNotificationFn?.(payload) ?? null;
}

function mapAlertButtons(buttons?: AlertButton[]): NotificationAction[] {
  if (!buttons || buttons.length === 0) {
    return [{ label: 'OK' }];
  }
  return buttons.map((button) => ({
    label: button.text ?? 'OK',
    onPress: button.onPress,
    style: button.style ?? 'default',
  }));
}

function inferAlertType(title: string, interactive: boolean): AppNotificationPayload['type'] {
  if (/error|fail|unable|could not|invalid/i.test(title)) return 'error';
  if (/success|saved|updated|deleted|complete|applied|copied/i.test(title)) return 'success';
  if (interactive) return 'warning';
  return 'info';
}

let alertBridgeInstalled = false;
const nativeAlert = Alert.alert.bind(Alert);

/**
 * Route React Native `Alert.alert` calls through the top notification banner.
 * Simple “OK / Success” alerts auto-dismiss and never block the next action.
 * Multi-button or destructive alerts stay interactive.
 */
export function installAppAlertBridge(): void {
  if (alertBridgeInstalled) return;
  alertBridgeInstalled = true;

  Alert.alert = (
    title: string,
    message?: string,
    buttons?: AlertButton[]
  ) => {
    if (!showNotificationFn) {
      nativeAlert(title, message, buttons);
      return;
    }

    const lines = (message ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const actions = mapAlertButtons(buttons);
    const interactive =
      actions.length > 1 ||
      actions.some((a) => a.style === 'destructive' || a.style === 'cancel') ||
      (buttons?.length ?? 0) > 1;

    // Post-action acks: run any side effect immediately, show a brief non-blocking toast.
    if (!interactive) {
      const only = actions[0];
      try {
        only?.onPress?.();
      } catch {
        /* ignore */
      }
      showNotificationFn({
        title,
        lines,
        type: inferAlertType(title, false),
        durationMs: /error|fail/i.test(title) ? 4000 : 2400,
      });
      return;
    }

    showNotificationFn({
      title,
      lines,
      actions,
      persistent: true,
      type: inferAlertType(title, true),
    });
  };
}

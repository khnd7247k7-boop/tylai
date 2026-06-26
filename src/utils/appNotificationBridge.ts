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

/** Route React Native `Alert.alert` calls through the top notification banner. */
export function installAppAlertBridge(): void {
  const original = Alert.alert.bind(Alert);
  Alert.alert = (
    title: string,
    message?: string,
    buttons?: AlertButton[]
  ) => {
    if (!showNotificationFn) {
      original(title, message, buttons);
      return;
    }

    const lines = (message ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const actions = mapAlertButtons(buttons);
    const persistent = actions.length > 1 || actions.some((a) => a.style === 'destructive');

    showNotificationFn({
      title,
      lines,
      actions,
      persistent,
      durationMs: persistent ? undefined : 4500,
      type: actions.some((a) => a.style === 'destructive') ? 'warning' : 'info',
    });
  };
}

/**
 * Client types for Smart Notification prefs (mirrors Cloud Functions).
 */

export type NotificationCategory =
  | 'coaching'
  | 'nutrition'
  | 'accountability'
  | 'celebration'
  | 'progress'
  | 'recovery';

export type NotificationIntensity = 'minimal' | 'balanced' | 'high';

export type NotificationAction =
  | 'start_workout'
  | 'log_food'
  | 'view_progress'
  | 'adjust_schedule'
  | 'view_recovery'
  | 'open_app';

export interface SmartNotificationPrefs {
  enabled: boolean;
  intensity: NotificationIntensity;
  categories: Record<NotificationCategory, boolean>;
  timezone: string;
  quietHoursStart: number;
  quietHoursEnd: number;
  updatedAt?: string;
}

export const DEFAULT_SMART_NOTIFICATION_PREFS: SmartNotificationPrefs = {
  enabled: true,
  intensity: 'balanced',
  categories: {
    coaching: true,
    nutrition: true,
    accountability: true,
    celebration: true,
    progress: true,
    recovery: true,
  },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver',
  quietHoursStart: 21,
  quietHoursEnd: 8,
};

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  coaching: 'Coaching',
  nutrition: 'Nutrition',
  accountability: 'Accountability',
  celebration: 'Celebrations',
  progress: 'Progress',
  recovery: 'Recovery',
};

export const NOTIFICATION_INTENSITY_LABELS: Record<NotificationIntensity, string> = {
  minimal: 'Minimal — important updates only',
  balanced: 'Balanced — 1–2 coaching notes/day',
  high: 'High support — more proactive (still capped at 2/day)',
};

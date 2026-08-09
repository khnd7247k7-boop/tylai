/**
 * Shared types for the Smart Notification Engine (Cloud Functions).
 */

export type NotificationCategory =
  | 'coaching'
  | 'nutrition'
  | 'accountability'
  | 'celebration'
  | 'progress'
  | 'recovery';

export type NotificationIntensity = 'minimal' | 'balanced' | 'high';

/** Maps onboarding proactiveCoaching → tone. */
export type CoachingTone = 'coach_me' | 'work_with_me' | 'analyze_me';

export type ProactiveCoachingLevel = 'yes' | 'occasionally' | 'only_if_ask';

export type NotificationAction =
  | 'start_workout'
  | 'log_food'
  | 'view_progress'
  | 'adjust_schedule'
  | 'view_recovery'
  | 'open_app';

export interface NotificationPrefs {
  enabled: boolean;
  intensity: NotificationIntensity;
  categories: Record<NotificationCategory, boolean>;
  timezone: string;
  quietHoursStart: number; // 0–23 local
  quietHoursEnd: number;
  updatedAt?: string;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
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
  timezone: 'America/Denver',
  quietHoursStart: 21,
  quietHoursEnd: 8,
};

export interface UserDailyState {
  userId: string;
  localDateKey: string;
  localHour: number;
  coachingTone: CoachingTone;
  proactiveCoaching: ProactiveCoachingLevel | null;
  profile: {
    primaryGoal: string | null;
    experienceLevel: string | null;
    daysPerWeek: number;
  };
  training: {
    scheduledToday: boolean;
    completedToday: boolean;
    todayLabel: string | null;
    weeklyCompleted: number;
    weeklyTarget: number;
    recentMissedWorkouts: number;
    currentStreak: number;
    totalCompletedSessions: number;
  };
  nutrition: {
    caloriesLogged: number;
    proteinLogged: number;
    calorieTarget: number;
    proteinTarget: number;
    caloriesRemaining: number;
    proteinRemaining: number;
    proteinGapSignificant: boolean;
    loggingToday: boolean;
  };
  progress: {
    weightTrendLabel: string | null;
  };
  recovery: {
    recentSleepQualityAvg: number | null;
  };
  notificationHistory: {
    notificationsToday: number;
    recentTypes: NotificationCategory[];
    ignoredCategories: NotificationCategory[];
  };
}

export interface NotificationCandidate {
  id: string;
  type: NotificationCategory;
  title: string;
  message: string;
  reason: string;
  verifiedFacts: string[];
  priority: number;
  relevanceScore: number;
  goalAlignmentScore: number;
  potentialImpactScore: number;
  urgencyScore: number;
  fatiguePenalty: number;
  cooldownPenalty: number;
  action: NotificationAction;
  combined?: boolean;
  milestoneId?: string;
}

export interface SmartNotificationState {
  lastEvaluatedAt: string | null;
  sentTodayCount: number;
  sentTodayDateKey: string | null;
  recentCategoryTimestamps: Partial<Record<NotificationCategory, string>>;
  recentMilestoneIds?: string[];
  categoryIgnoreCounts?: Partial<Record<NotificationCategory, number>>;
}

export interface DeviceDoc {
  expoPushToken: string;
  platform: string;
  updatedAt: string;
  appVersion?: string;
}

export function mapProactiveToTone(
  level: ProactiveCoachingLevel | null | undefined
): CoachingTone {
  if (level === 'yes') return 'coach_me';
  if (level === 'only_if_ask') return 'analyze_me';
  return 'work_with_me';
}

export function maxDailyForIntensity(intensity: NotificationIntensity): number {
  if (intensity === 'minimal') return 1;
  if (intensity === 'high') return 2;
  return 2;
}

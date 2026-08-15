/**
 * Single registry of user data that must survive app updates, reinstalls,
 * and device switches (via AsyncStorage + Firestore backup).
 *
 * Ephemeral caches (AI insights, food DB caches, subscription tier cache)
 * are intentionally excluded.
 */

/** Keys stored as user_{uid}_{key} and backed up to Firestore. */
export const DURABLE_USER_DATA_KEYS = [
  // Workouts
  'savedWorkoutPlans',
  'activeWorkoutPlans',
  'workoutHistory',
  'customExerciseLibrary_v1',
  'planAdaptationState',
  'activeWorkoutSnapshot',
  // Nutrition
  'meals',
  'savedMeals',
  'nutritionGoals',
  'nutritionTargetsMeta',
  'recurringMealRules',
  'waterLogEntries',
  'waterQuickAmounts',
  'nutritionAdaptationState',
  // Body / progress
  'weightEntries',
  'measurementEntries',
  'progressPhotoSessions',
  'progressPhotoSettings',
  'userMilestones',
  'smallWinsNotificationMeta',
  // Journals / wellness
  'moodEntries',
  'emotionalExercises',
  'emotionalExercisesLastReset',
  'mentalExercises',
  'mentalExercisesLastReset',
  'dailyMentalProgress',
  'gratitudeEntries',
  'affirmationEntries',
  'reflectionEntries',
  // Profile / settings
  'userProfile',
  'appSettings',
  'interfaceSettings',
  'userPreferences',
  'coachingProfile',
  'movementProfile',
  'discomfortReports',
  'trainingConstraints',
  'movementAssessments',
  'postWorkoutMovementFeedback',
  'latestMovementAdaptationPlan',
  'exerciseCompetencyRecords',
  'healthDataPermissions',
  // Tasks / onboarding
  'completedTasks',
  'completedTasksLastReset',
  'onboardingMedicalDisclaimerAccepted',
  'onboardingGuideCompleted',
  'onboardingGuideDismissed',
  'onboardingProfileCompleted',
  'pendingFirstWorkoutPlan',
  // Coach
  'coachChatHistory',
] as const;

export type DurableUserDataKey = (typeof DURABLE_USER_DATA_KEYS)[number];

/**
 * Legacy / unused keys still migrated if found on device so old installs
 * do not lose data during account recovery.
 */
export const LEGACY_USER_DATA_KEYS = [
  'breathingExercises',
  'visualizationExercises',
  'mindfulnessExercises',
  'dashboardTasks',
  'dailyCheckIn',
  'healthPermissionsRequested',
  'aiInsights',
  'aiRecommendations',
  'lastAISync',
  'notificationCenterDaily',
] as const;

/** All keys considered for local orphan/legacy migration. */
export const USER_DATA_BASE_KEYS = [
  ...DURABLE_USER_DATA_KEYS,
  ...LEGACY_USER_DATA_KEYS,
] as const;

export type UserDataBaseKey = (typeof USER_DATA_BASE_KEYS)[number];

export function isDurableUserDataKey(baseKey: string): baseKey is DurableUserDataKey {
  return (DURABLE_USER_DATA_KEYS as readonly string[]).includes(baseKey);
}

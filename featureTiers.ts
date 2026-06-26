/**
 * Product tiers — single source of truth for Basic vs Premium.
 * Premium = Gemini-backed AI coaching and AI-powered search.
 * Basic = workout tracking, manual plans, nutrition logging, and trends.
 */

export type SubscriptionTier = 'basic' | 'premium';

export type FeatureTierId =
  | 'workout_tracking'
  | 'manual_workout_plans'
  | 'build_your_own_workout'
  | 'program_templates'
  | 'nutrition_logging'
  | 'macro_counting'
  | 'barcode_scan'
  | 'usda_offline_search'
  | 'health_trends'
  | 'workout_history_calendar'
  | 'apple_health_sync'
  | 'mental_emotional_tools'
  | 'ai_coach_chat'
  | 'ai_daily_mindset'
  | 'gemini_food_coach'
  | 'gemini_restaurant_search'
  | 'ai_workout_builder';

export type FeatureTierEntry = {
  id: FeatureTierId;
  label: string;
  description: string;
  tier: SubscriptionTier;
};

export const FEATURE_TIER_CATALOG: FeatureTierEntry[] = [
  // —— Basic ——
  {
    id: 'workout_tracking',
    label: 'Workout tracking',
    description: 'Log sets, reps, weight, and complete sessions.',
    tier: 'basic',
  },
  {
    id: 'manual_workout_plans',
    label: 'Your workout plans',
    description: 'Save and run programs you build or import.',
    tier: 'basic',
  },
  {
    id: 'build_your_own_workout',
    label: 'Build your own workout',
    description: 'Pick exercises, days, and reorder with drag-and-drop.',
    tier: 'basic',
  },
  {
    id: 'program_templates',
    label: 'Program templates',
    description: 'Starter splits and templates from the library.',
    tier: 'basic',
  },
  {
    id: 'nutrition_logging',
    label: 'Nutrition logging',
    description: 'Log meals by meal slot throughout the day.',
    tier: 'basic',
  },
  {
    id: 'macro_counting',
    label: 'Macro counting',
    description: 'Calories, protein, carbs, and fat vs your daily goals.',
    tier: 'basic',
  },
  {
    id: 'barcode_scan',
    label: 'Barcode scan',
    description: 'Add packaged foods from the label.',
    tier: 'basic',
  },
  {
    id: 'usda_offline_search',
    label: 'USDA food search (offline)',
    description: 'Search the local USDA database — no AI required.',
    tier: 'basic',
  },
  {
    id: 'health_trends',
    label: 'Trends & charts',
    description: 'Strength, volume, body weight, nutrition, sleep, and related charts.',
    tier: 'basic',
  },
  {
    id: 'workout_history_calendar',
    label: 'History calendar',
    description: 'Review past workouts and meals by day.',
    tier: 'basic',
  },
  {
    id: 'apple_health_sync',
    label: 'Apple Health sync',
    description: 'Optional HealthKit metrics for trends and dashboard context.',
    tier: 'basic',
  },
  {
    id: 'mental_emotional_tools',
    label: 'Mental & emotional tools',
    description: 'Check-ins, journaling, and mindset exercises.',
    tier: 'basic',
  },
  // —— Premium (Gemini) ——
  {
    id: 'ai_coach_chat',
    label: 'AI Coach chat',
    description: 'Personalized coaching using your health and training snapshot (Gemini).',
    tier: 'premium',
  },
  {
    id: 'ai_daily_mindset',
    label: 'AI daily mindset prompt',
    description: 'State-of-mind check-in generated from your recovery signals (Gemini).',
    tier: 'premium',
  },
  {
    id: 'gemini_food_coach',
    label: 'Food coach',
    description: 'Restaurant and eating-out suggestions within your macro budget (Gemini).',
    tier: 'premium',
  },
  {
    id: 'gemini_restaurant_search',
    label: 'AI menu search',
    description: 'Gemini looks up menus and ranks orders to fit your remaining macros.',
    tier: 'premium',
  },
  {
    id: 'ai_workout_builder',
    label: 'AI Workout builder',
    description: 'Personalized workout plans from your goals, experience, and profile (Gemini).',
    tier: 'premium',
  },
];

export const BASIC_FEATURES = FEATURE_TIER_CATALOG.filter((f) => f.tier === 'basic');
export const PREMIUM_FEATURES = FEATURE_TIER_CATALOG.filter((f) => f.tier === 'premium');

/** Gemini API surfaces — must check premium before calling. */
export const GEMINI_PREMIUM_FEATURE_IDS: FeatureTierId[] = [
  'ai_coach_chat',
  'ai_daily_mindset',
  'gemini_food_coach',
  'gemini_restaurant_search',
  'ai_workout_builder',
];

export function featureRequiresPremium(featureId: FeatureTierId): boolean {
  const entry = FEATURE_TIER_CATALOG.find((f) => f.id === featureId);
  return entry?.tier === 'premium';
}

export function tierLabel(tier: SubscriptionTier): string {
  return tier === 'premium' ? 'Premium' : 'Basic';
}

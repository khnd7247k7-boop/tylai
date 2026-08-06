import type { TourNavHandlers, TourStep } from './types';
import { TOUR_TARGET_IDS, tourSelector } from './tourTargets';
import { TOUR_MODAL_SETTLE_MS, tourPause } from './tourTiming';

/**
 * Interactive tour: Dashboard → Workouts (deep) → Nutrition → Log Food → More.
 * Tapping a highlight navigates for real; the tour waits, then continues on that screen.
 */
export function createAppTourSteps(nav: TourNavHandlers): TourStep[] {
  return [
    {
      id: 'intro',
      title: 'Welcome to TYL',
      content:
        'This tour walks through training, food logging, and settings. Tap each highlight to go there — the guide picks up on that screen.',
      placement: 'auto',
      requireActualClick: false,
      popoverVariant: 'hero',
      emoji: '👋',
      prepare: async () => {
        await nav.ensureDashboard();
        await tourPause();
      },
    },
    {
      id: 'start-today',
      targetSelector: tourSelector(TOUR_TARGET_IDS.startToday),
      title: 'Start Workout',
      content:
        'Jump into your workout overview and today\'s training from here.',
      placement: 'bottom',
      requireActualClick: true,
      spotlightPadding: 12,
      emoji: '🏋',
      tapPrompt: 'Tap Start Workout to continue.',
      prepare: async () => {
        await nav.ensureDashboard();
        await tourPause();
      },
    },
    {
      id: 'fitness-today-card',
      targetSelector: tourSelector(TOUR_TARGET_IDS.fitnessTodayCard),
      title: "Today's Workout",
      content:
        'See duration, exercises, and calories at a glance. When you have an active plan, START WORKOUT launches your session with set logging and rest timers.',
      placement: 'bottom',
      requireActualClick: false,
      spotlightPadding: 14,
      emoji: '📋',
      prepare: async () => {
        await nav.ensureWorkoutsHome();
        await tourPause(TOUR_MODAL_SETTLE_MS);
      },
    },
    {
      id: 'fitness-my-plans',
      targetSelector: tourSelector(TOUR_TARGET_IDS.fitnessMyPlans),
      title: 'Log Workout',
      content:
        'Log a past session or a one-off daily workout when you train something different from your saved plan.',
      placement: 'top',
      requireActualClick: true,
      spotlightPadding: 10,
      emoji: '📝',
      tapPrompt: 'Tap Log Workout to continue.',
      prepare: async () => {
        await nav.ensureWorkoutsHome();
        await tourPause();
      },
    },
    {
      id: 'fitness-my-plans-panel',
      targetSelector: tourSelector(TOUR_TARGET_IDS.fitnessMyPlansPanel),
      title: 'Your Saved Programs',
      content:
        'Active plans show here first. Tap any plan to preview the schedule, see exercises, and hit Start on a training day.',
      placement: 'top',
      requireActualClick: false,
      spotlightPadding: 12,
      emoji: '✅',
      prepare: async () => {
        await nav.ensureWorkoutsHome();
        await tourPause(TOUR_MODAL_SETTLE_MS);
      },
    },
    {
      id: 'fitness-build-workout',
      targetSelector: tourSelector(TOUR_TARGET_IDS.fitnessBuildWorkout),
      title: 'Build Workout',
      content:
        'Create your own multi-week program — pick training days, add exercises, sets, and reps, then save it to My Plans.',
      placement: 'top',
      requireActualClick: true,
      spotlightPadding: 10,
      emoji: '🔧',
      tapPrompt: 'Tap Build Workout to continue.',
      prepare: async () => {
        await nav.closeWorkoutTour();
        await nav.ensureWorkoutsHome();
        await tourPause();
      },
    },
    {
      id: 'fitness-build-intro',
      targetSelector: tourSelector(TOUR_TARGET_IDS.fitnessBuildIntro),
      title: 'Custom Program Builder',
      content:
        'Name your program, choose how many weeks, pick training days, then add exercises for each day. Perfect when you know exactly what you want to train.',
      placement: 'bottom',
      requireActualClick: false,
      spotlightPadding: 10,
      emoji: '🛠',
      settleMs: TOUR_MODAL_SETTLE_MS,
      prepare: async () => {
        await nav.ensureBuildWorkoutOpen();
        await tourPause(TOUR_MODAL_SETTLE_MS);
      },
    },
    {
      id: 'fitness-ai-workout',
      targetSelector: tourSelector(TOUR_TARGET_IDS.fitnessAiWorkout),
      title: 'AI Workout',
      content:
        'Let AI build a personalized plan from your onboarding profile — goals, schedule, equipment, and experience level.',
      placement: 'top',
      requireActualClick: true,
      spotlightPadding: 10,
      emoji: '🧠',
      tapPrompt: 'Tap AI Workout to continue.',
      prepare: async () => {
        await nav.closeWorkoutTour();
        await nav.ensureWorkoutsHome();
        await tourPause();
      },
    },
    {
      id: 'fitness-ai-generate',
      targetSelector: tourSelector(TOUR_TARGET_IDS.fitnessAiGenerate),
      title: 'AI Coach',
      content:
        'Review your coaching profile summary, then tap Generate My Personalized Plan. AI creates workout options you can save and run anytime.',
      placement: 'top',
      requireActualClick: false,
      spotlightPadding: 12,
      emoji: '✨',
      settleMs: TOUR_MODAL_SETTLE_MS,
      prepare: async () => {
        await nav.ensureAiWorkoutOpen();
        await tourPause(TOUR_MODAL_SETTLE_MS);
      },
    },
    {
      id: 'fitness-start',
      targetSelector: tourSelector(TOUR_TARGET_IDS.fitnessStart),
      title: 'Start Workout',
      content:
        'When you have an active plan, this launches your session immediately — log sets, reps, weight, and rest between exercises.',
      placement: 'top',
      requireActualClick: false,
      spotlightPadding: 12,
      emoji: '🏋',
      prepare: async () => {
        await nav.closeWorkoutTour();
        await nav.ensureWorkoutsHome();
        await tourPause();
      },
    },
    {
      id: 'fitness-plan-preview',
      targetSelector: tourSelector(TOUR_TARGET_IDS.fitnessSavedPlanStart),
      title: 'Plan Preview & Session Start',
      content:
        'Each training day lists exercises with sets and reps. Tap Start on any day to begin logging — AI suggestions appear here as you complete sessions.',
      placement: 'top',
      requireActualClick: false,
      spotlightPadding: 12,
      emoji: '🎯',
      settleMs: TOUR_MODAL_SETTLE_MS,
      prepare: async () => {
        await nav.ensurePlanPreviewOpen();
        await tourPause(TOUR_MODAL_SETTLE_MS);
      },
    },
    {
      id: 'tab-nutrition',
      targetSelector: tourSelector(TOUR_TARGET_IDS.tabNutrition),
      title: 'Nutrition Tab',
      content:
        'Switch here for your full food log, macro tracking, barcode scan, and daily nutrition history.',
      placement: 'top',
      requireActualClick: true,
      spotlightPadding: 8,
      spotlightShape: 'circle',
      emoji: '🍎',
      tapPrompt: 'Tap the Nutrition tab to continue.',
      afterClick: nav.closeWorkoutTour,
      prepare: async () => {
        await nav.closeWorkoutTour();
        await nav.closeLogFood();
        await tourPause();
      },
    },
    {
      id: 'nutrition-log-food',
      targetSelector: tourSelector(TOUR_TARGET_IDS.nutritionLogFood),
      title: 'Open Log Food',
      content:
        'Tap Log Food to open the logging panel — every meal, snack, and drink gets recorded here.',
      placement: 'top',
      requireActualClick: true,
      spotlightPadding: 10,
      emoji: '➕',
      tapPrompt: 'Tap Log Food to open the logger.',
      settleMs: TOUR_MODAL_SETTLE_MS,
      prepare: async () => {
        await nav.ensureNutrition();
        await tourPause(TOUR_MODAL_SETTLE_MS);
      },
    },
    {
      id: 'log-food-precision',
      targetSelector: tourSelector(TOUR_TARGET_IDS.logFoodModePrecision),
      title: 'Precision Mode',
      content:
        'Best for exact logging — search USDA foods, scan barcodes, and enter precise portions in grams or servings.',
      placement: 'bottom',
      requireActualClick: true,
      spotlightPadding: 8,
      emoji: '🎯',
      tapPrompt: 'Tap Precision to continue.',
      scrollIntoView: true,
      settleMs: TOUR_MODAL_SETTLE_MS,
      prepare: async () => {
        await nav.ensureLogFoodOpen('precision');
        await tourPause(TOUR_MODAL_SETTLE_MS);
      },
    },
    {
      id: 'log-food-meal-name',
      targetSelector: tourSelector(TOUR_TARGET_IDS.logFoodMealName),
      title: 'Search & Log Exactly',
      content:
        'Type a food name to search your history and the database, or scan a barcode. Adjust servings, then tap Add to log.',
      placement: 'bottom',
      requireActualClick: false,
      spotlightPadding: 10,
      emoji: '🔍',
      scrollIntoView: true,
      settleMs: TOUR_MODAL_SETTLE_MS,
      prepare: async () => {
        await nav.ensureLogFoodOpen('precision');
        await tourPause(TOUR_MODAL_SETTLE_MS);
      },
    },
    {
      id: 'log-food-ai-mode',
      targetSelector: tourSelector(TOUR_TARGET_IDS.logFoodModeAi),
      title: 'Quick (AI) Mode',
      content:
        'Describe what you ate in plain English — perfect when you don\'t have exact weights. AI estimates calories and macros for you.',
      placement: 'bottom',
      requireActualClick: true,
      spotlightPadding: 8,
      emoji: '⚡',
      tapPrompt: 'Tap Quick (AI) to continue.',
      scrollIntoView: true,
      settleMs: TOUR_MODAL_SETTLE_MS,
      prepare: async () => {
        await nav.ensureLogFoodOpen('precision');
        await tourPause(TOUR_MODAL_SETTLE_MS);
      },
    },
    {
      id: 'log-food-ai-input',
      targetSelector: tourSelector(TOUR_TARGET_IDS.logFoodAiInput),
      title: 'Describe Any Meal',
      content:
        'Works for restaurant orders AND home plates — e.g. "plate of rice with ground beef and eggs" or "2 eggs and a banana". Tap Estimate macros, review, then add to your log.',
      placement: 'top',
      requireActualClick: false,
      spotlightPadding: 10,
      emoji: '🍳',
      scrollIntoView: true,
      settleMs: TOUR_MODAL_SETTLE_MS,
      prepare: async () => {
        await nav.ensureLogFoodOpen('ai');
        await tourPause(TOUR_MODAL_SETTLE_MS);
      },
    },
    {
      id: 'tab-more',
      targetSelector: tourSelector(TOUR_TARGET_IDS.tabMore),
      title: 'Settings & Tools',
      content:
        'More is your hub for Settings, Health trends, Mindset tools, and replaying this guide.',
      placement: 'top',
      requireActualClick: true,
      spotlightPadding: 8,
      spotlightShape: 'circle',
      emoji: '⚙️',
      tapPrompt: 'Tap the More tab to finish up.',
      afterClick: nav.closeLogFood,
      prepare: async () => {
        await nav.closeLogFood();
        await nav.ensureNutrition();
        await tourPause();
      },
    },
    {
      id: 'finish',
      title: 'You\'re All Set',
      content:
        'Train with My Plans, Build, or AI Workout from Workouts. Log with Precision or Quick AI from Nutrition. Replay this guide anytime from More → App guide.',
      placement: 'auto',
      requireActualClick: false,
      popoverVariant: 'hero',
      emoji: '🎉',
      prepare: async () => {
        await nav.closeLogFood();
        await nav.closeWorkoutTour();
        await nav.ensureMore();
        await tourPause();
      },
    },
  ];
}

/** @deprecated Use createAppTourSteps(nav) for the full interactive tour. */
export const DEFAULT_WEB_TOUR_STEPS: TourStep[] = createAppTourSteps({
  ensureDashboard: () => undefined,
  ensureWorkouts: () => undefined,
  ensureNutrition: () => undefined,
  ensureMore: () => undefined,
  ensureLogFoodOpen: () => undefined,
  closeLogFood: () => undefined,
  ensureWorkoutsHome: () => undefined,
  ensureMyPlansOpen: () => undefined,
  ensureBuildWorkoutOpen: () => undefined,
  ensureAiWorkoutOpen: () => undefined,
  ensurePlanPreviewOpen: () => undefined,
  closeWorkoutTour: () => undefined,
  dismissFitnessOverlays: () => undefined,
});

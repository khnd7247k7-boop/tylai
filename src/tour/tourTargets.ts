/** Stable DOM ids for spotlight tour selectors (`#tour-*`). */
export const TOUR_TARGET_IDS = {
  startToday: 'tour-start-today',
  logFood: 'tour-log-food',
  trends: 'tour-trends',
  tabWorkouts: 'tour-tab-workouts',
  tabNutrition: 'tour-tab-nutrition',
  tabMore: 'tour-tab-more',
  fitnessStart: 'tour-fitness-start',
  fitnessTodayCard: 'tour-fitness-today-card',
  fitnessAiWorkout: 'tour-fitness-ai-workout',
  fitnessBuildWorkout: 'tour-fitness-build-workout',
  fitnessMyPlans: 'tour-fitness-my-plans',
  fitnessMyPlansPanel: 'tour-fitness-my-plans-panel',
  fitnessBuildIntro: 'tour-fitness-build-intro',
  fitnessAiGenerate: 'tour-fitness-ai-generate',
  fitnessSavedPlanStart: 'tour-fitness-saved-plan-start',
  nutritionLogFood: 'tour-nutrition-log-food',
  logFoodModePrecision: 'tour-log-food-mode-precision',
  logFoodModeAi: 'tour-log-food-mode-ai',
  logFoodMealName: 'tour-log-food-meal-name',
  logFoodAiInput: 'tour-log-food-ai-input',
} as const;

export const tourSelector = (id: string) => `#${id}`;

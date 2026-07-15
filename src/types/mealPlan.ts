/** AI-generated weekly meal plan stored per user. */

export type PlannedMealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface PlannedMealItem {
  name: string;
  amount?: string;
}

export interface PlannedMeal {
  slot: PlannedMealSlot;
  name: string;
  description?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepMinutes?: number;
  ingredients?: PlannedMealItem[];
}

export interface MealPlanDay {
  dayLabel: string;
  meals: PlannedMeal[];
  dailyTotals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface GeneratedMealPlan {
  id: string;
  name: string;
  createdAt: string;
  summary: string;
  coachingNotes?: string;
  targetGoals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  days: MealPlanDay[];
}

export const MEAL_PLAN_STORAGE_KEY = 'generatedMealPlans';
export const ACTIVE_MEAL_PLAN_KEY = 'activeMealPlanId';

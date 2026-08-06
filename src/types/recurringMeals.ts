import type { LogFoodItem } from './nutritionLogging';

/** JS `Date.getDay()` — 0 Sunday … 6 Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RecurringMealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type RecurringMealTemplate = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealSlot: RecurringMealSlot;
  time?: string;
  servings?: number;
  baseProtein?: number;
  baseCarbs?: number;
  baseFat?: number;
  servingAmount?: string;
  servingUnit?: string;
  items?: LogFoodItem[];
};

/**
 * A saved schedule that materializes logged meals on matching days.
 * Deduped via `recurringRuleId` on each generated meal.
 */
export type RecurringMealRule = {
  id: string;
  createdAt: string;
  active: boolean;
  template: RecurringMealTemplate;
  /** Days of week to fire. Empty treated as every day. */
  weekdays: Weekday[];
  /** Inclusive YYYY-MM-DD */
  startDate: string;
  /** Inclusive YYYY-MM-DD, or null for no end. */
  endDate: string | null;
};

export const WEEKDAY_LABELS: { day: Weekday; short: string; long: string }[] = [
  { day: 0, short: 'Sun', long: 'Sunday' },
  { day: 1, short: 'Mon', long: 'Monday' },
  { day: 2, short: 'Tue', long: 'Tuesday' },
  { day: 3, short: 'Wed', long: 'Wednesday' },
  { day: 4, short: 'Thu', long: 'Thursday' },
  { day: 5, short: 'Fri', long: 'Friday' },
  { day: 6, short: 'Sat', long: 'Saturday' },
];

export const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS_ONLY: Weekday[] = [1, 2, 3, 4, 5];
export const WEEKENDS_ONLY: Weekday[] = [0, 6];

import { loadUserData, saveUserData } from './userStorage';
import type { LogFoodItem } from '../types/nutritionLogging';

/** Matches persisted `meals` entries from Fitness / Log Food (extra fields optional). */
export type LoggedMeal = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
  date: string;
  servings?: number;
  baseProtein?: number;
  baseCarbs?: number;
  baseFat?: number;
  mealSlot?: string;
  /** Optional display from barcode / manual log (e.g. amount + unit). */
  servingAmount?: string;
  servingUnit?: string;
  items?: LogFoodItem[];
  /**
   * When set, this entry was generated from a recurring schedule.
   * Used to avoid duplicating the same rule on the same day.
   */
  recurringRuleId?: string;
};

export function calculateCaloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

export function isMealLoggedToday(meal: LoggedMeal): boolean {
  const today = new Date();
  const todayDateString = today.toDateString();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
  const mealDate = new Date(meal.date);
  return (
    mealDate.toDateString() === todayDateString ||
    (mealDate.getTime() >= todayStart && mealDate.getTime() < todayEnd)
  );
}

export function filterMealsLoggedToday(meals: LoggedMeal[]): LoggedMeal[] {
  return meals.filter(isMealLoggedToday);
}

/**
 * Replace one meal by `id` in persisted `meals`, recalc calories from macros when P/C/F are touched.
 * Returns the new full list, or `null` if the id was not found.
 */
export async function updateLoggedMeal(
  mealId: string,
  updatedData: Partial<LoggedMeal>
): Promise<LoggedMeal[] | null> {
  const meals = (await loadUserData<LoggedMeal[]>('meals')) || [];
  const idx = meals.findIndex((m) => m.id === mealId);
  if (idx < 0) return null;

  const prev = meals[idx];
  const merged: LoggedMeal = { ...prev, ...updatedData, id: prev.id };

  const pTouched = updatedData.protein !== undefined;
  const cTouched = updatedData.carbs !== undefined;
  const fTouched = updatedData.fat !== undefined;
  if (pTouched || cTouched || fTouched) {
    merged.calories = calculateCaloriesFromMacros(
      Number(merged.protein) || 0,
      Number(merged.carbs) || 0,
      Number(merged.fat) || 0
    );
  }

  const next = [...meals];
  next[idx] = merged;
  await saveUserData('meals', next);
  return next;
}

/** Remove a meal by id from persisted `meals`. Returns new list or `null` if id missing. */
export async function deleteLoggedMeal(mealId: string): Promise<LoggedMeal[] | null> {
  const meals = (await loadUserData<LoggedMeal[]>('meals')) || [];
  const next = meals.filter((m) => m.id !== mealId);
  if (next.length === meals.length) return null;
  await saveUserData('meals', next);
  return next;
}

/** Local calendar day key `YYYY-MM-DD` from an ISO or parseable date string. */
export function localDateKeyFromIso(dateString: string): string {
  const dt = new Date(dateString);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Noon local time on `dateKey` as ISO (stable grouping with history calendar). */
export function dateKeyToLocalNoonIso(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return new Date().toISOString();
  const y = Number(match[1]);
  const mo = Number(match[2]);
  const d = Number(match[3]);
  return new Date(y, mo - 1, d, 12, 0, 0, 0).toISOString();
}

export type LoggedMealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

/** Normalize stored slot strings (incl. legacy `snack`) to a known meal time. */
export function normalizeLoggedMealSlot(raw: unknown): LoggedMealSlot | null {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snacks') return v;
  if (v === 'snack') return 'snacks';
  return null;
}

/**
 * Resolve which meal bucket a logged entry belongs in.
 * Prefer an explicit slot; otherwise use name hints, then original log hour.
 * Call this BEFORE rewriting `date` to noon on copy — noon would otherwise re-bucket meals.
 */
export function resolveLoggedMealSlot(meal: Pick<LoggedMeal, 'mealSlot' | 'name' | 'date'>): LoggedMealSlot {
  const fromStored = normalizeLoggedMealSlot(meal.mealSlot);
  if (fromStored) return fromStored;

  const n = String(meal.name ?? '').toLowerCase();
  if (/\b(breakfast|brunch)\b/.test(n)) return 'breakfast';
  if (/\blunch\b/.test(n)) return 'lunch';
  if (/\b(dinner|supper)\b/.test(n)) return 'dinner';
  if (/\bsnack/.test(n)) return 'snacks';

  const h = new Date(meal.date).getHours();
  if (Number.isFinite(h)) {
    if (h < 11) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 21) return 'dinner';
  }
  return 'snacks';
}

function cloneMealForDate(
  meal: LoggedMeal,
  targetDateKey: string,
  opts?: { mealSlot?: string }
): LoggedMeal {
  // Resolve slot from the source meal *before* the date becomes noon, then stamp it
  // so copies stay in breakfast/lunch/dinner instead of collapsing into snacks/lunch.
  const mealSlot =
    normalizeLoggedMealSlot(opts?.mealSlot) ?? resolveLoggedMealSlot(meal);
  return {
    ...meal,
    id: `meal-copy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    date: dateKeyToLocalNoonIso(targetDateKey),
    mealSlot,
    recurringRuleId: undefined,
  };
}

/** Duplicate one logged meal onto another calendar day (new entry, same macros). */
export async function duplicateLoggedMealToDate(
  mealId: string,
  targetDateKey: string,
  opts?: { mealSlot?: string }
): Promise<{ meals: LoggedMeal[]; copy: LoggedMeal } | null> {
  const meals = (await loadUserData<LoggedMeal[]>('meals')) || [];
  const source = meals.find((m) => m.id === mealId);
  if (!source) return null;

  const copy = cloneMealForDate(source, targetDateKey, opts);
  const next = [...meals, copy];
  await saveUserData('meals', next);
  return { meals: next, copy };
}

/** Duplicate every meal from one day onto another calendar day. */
export async function duplicateMealsFromDayToDate(
  sourceDateKey: string,
  targetDateKey: string
): Promise<{ meals: LoggedMeal[]; copies: LoggedMeal[] } | null> {
  const meals = (await loadUserData<LoggedMeal[]>('meals')) || [];
  const fromDay = meals.filter((m) => localDateKeyFromIso(m.date) === sourceDateKey);
  if (fromDay.length === 0) return null;

  const copies = fromDay.map((m) => cloneMealForDate(m, targetDateKey));
  const next = [...meals, ...copies];
  await saveUserData('meals', next);
  return { meals: next, copies };
}

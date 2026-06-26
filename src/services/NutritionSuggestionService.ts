import { loadUserData, saveUserData } from '../utils/userStorage';
import { loadPersistedNutritionGoals, savePersistedNutritionGoals } from '../utils/nutritionGoalsStorage';
import type { NutritionGoals } from '../types/nutritionGoals';
import type { NutritionTargetsMeta } from '../utils/nutritionTargets';
import type { LoggedMeal } from '../utils/loggedMeals';
import { goalsAreSimilar, isUserHittingCurrentMacros } from '../utils/nutritionMacroCompliance';

const PENDING_KEY = 'pendingNutritionSuggestion';

export type NutritionSuggestionSource = 'profile_update' | 'adaptation';

export interface PendingNutritionSuggestion {
  id: string;
  createdAt: string;
  source: NutritionSuggestionSource;
  reason: string;
  suggestedGoals: NutritionGoals;
  meta?: NutritionTargetsMeta;
}

export function buildCalorieAdjustedGoals(
  suggestedCalories: number,
  prev: NutritionGoals,
  derivedFrom: NutritionGoals['derivedFrom'] = 'adaptation'
): NutritionGoals {
  const ratio = suggestedCalories / Math.max(1, prev.calories);
  return {
    calories: suggestedCalories,
    protein: Math.max(80, Math.round(prev.protein * Math.min(1.05, ratio))),
    carbs: Math.max(50, Math.round(prev.carbs * ratio)),
    fat: Math.max(30, Math.round(prev.fat * ratio)),
    water: prev.water,
    bmr: prev.bmr,
    tdee: prev.tdee,
    derivedFrom,
  };
}

export function formatNutritionSuggestionSummary(goals: NutritionGoals): string {
  return `${goals.calories.toLocaleString()} kcal · ${goals.protein}g protein · ${goals.carbs}g carbs · ${goals.fat}g fat`;
}

export async function loadPendingNutritionSuggestion(): Promise<PendingNutritionSuggestion | null> {
  const raw = await loadUserData<PendingNutritionSuggestion>(PENDING_KEY);
  if (!raw?.suggestedGoals || !raw.reason) return null;
  return raw;
}

export async function queueNutritionSuggestion(input: {
  source: NutritionSuggestionSource;
  reason: string;
  suggestedGoals: NutritionGoals;
  meta?: NutritionTargetsMeta;
}): Promise<void> {
  const pending: PendingNutritionSuggestion = {
    id: `nut-${Date.now()}`,
    createdAt: new Date().toISOString(),
    source: input.source,
    reason: input.reason,
    suggestedGoals: input.suggestedGoals,
    meta: input.meta,
  };
  await saveUserData(PENDING_KEY, pending);
}

export async function dismissPendingNutritionSuggestion(): Promise<void> {
  await saveUserData(PENDING_KEY, null);
}

export async function applyPendingNutritionSuggestion(): Promise<NutritionGoals | null> {
  const pending = await loadPendingNutritionSuggestion();
  if (!pending) return null;

  const goals: NutritionGoals = {
    ...pending.suggestedGoals,
    derivedFrom: pending.source === 'adaptation' ? 'adaptation' : 'profile_update',
  };
  await savePersistedNutritionGoals(goals);
  if (pending.meta) {
    await saveUserData('nutritionTargetsMeta', pending.meta);
  }
  await saveUserData(PENDING_KEY, null);
  return goals;
}

/** Keep current goals when the user set them manually or is already hitting them. */
export async function shouldDeferNutritionOverride(
  suggestedGoals: NutritionGoals,
  meals?: LoggedMeal[]
): Promise<boolean> {
  const existing = await loadPersistedNutritionGoals();
  if (!existing) return false;
  if (goalsAreSimilar(existing, suggestedGoals)) return false;
  if (existing.derivedFrom === 'manual') return true;

  const mealLog =
    meals ?? (await loadUserData<LoggedMeal[]>('meals')) ?? [];
  return isUserHittingCurrentMacros(mealLog, existing);
}

export async function offerNutritionGoalsUpdate(input: {
  source: NutritionSuggestionSource;
  reason: string;
  suggestedGoals: NutritionGoals;
  meta?: NutritionTargetsMeta;
  meals?: LoggedMeal[];
}): Promise<'applied' | 'queued'> {
  const defer = await shouldDeferNutritionOverride(input.suggestedGoals, input.meals);
  if (!defer) {
    await savePersistedNutritionGoals({
      ...input.suggestedGoals,
      derivedFrom: input.source === 'adaptation' ? 'adaptation' : 'profile_update',
    });
    if (input.meta) {
      await saveUserData('nutritionTargetsMeta', input.meta);
    }
    await saveUserData(PENDING_KEY, null);
    return 'applied';
  }

  await queueNutritionSuggestion(input);
  if (input.meta) {
    await saveUserData('nutritionTargetsMeta', input.meta);
  }
  return 'queued';
}

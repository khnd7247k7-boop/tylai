/**
 * Goal-driven nutrition coaching — BMR-aware targets and trend-based adjustments
 * when food logging and weight data show a plateau or mismatch.
 */

import { loadUserData } from '../utils/userStorage';
import { loadPersistedNutritionGoals, savePersistedNutritionGoals } from '../utils/nutritionGoalsStorage';
import {
  buildCalorieAdjustedGoals,
  offerNutritionGoalsUpdate,
  queueNutritionSuggestion,
  shouldDeferNutritionOverride,
} from './NutritionSuggestionService';
import type { LoggedMeal } from '../utils/loggedMeals';
import type { CoachingProfile, PrimaryGoal } from '../types/coachingProfile';
import type { NutritionGoals } from '../types/nutritionGoals';
import type { NutritionTargetsMeta } from '../utils/nutritionTargets';
import { calculateBmrKgCm, resolveNutritionBodyMetrics } from '../utils/nutritionTargets';

export interface NutritionAdaptationResult {
  shouldAdjust: boolean;
  applied: boolean;
  suggestedCalories?: number;
  deltaCalories?: number;
  reason: string;
  focus: 'deficit' | 'compliance' | 'maintain' | 'surplus';
  trend?: 'plateau' | 'losing_fast' | 'under_eating' | 'over_target' | 'gaining_slow' | 'on_track';
}

interface WeightEntry {
  date: string;
  weight: number;
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function avgDailyCalories(meals: LoggedMeal[], days: number): number | null {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const byDay = new Map<string, number>();
  for (const m of meals) {
    const dt = new Date(m.date);
    if (dt < since) continue;
    const key = localDateKey(dt);
    byDay.set(key, (byDay.get(key) || 0) + (m.calories || 0));
  }
  if (byDay.size < Math.min(7, days)) return null;
  const vals = [...byDay.values()];
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function weightPlateau(entries: WeightEntry[], minDays = 14): boolean {
  const sorted = [...entries]
    .filter((e) => e.weight > 0 && e.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (sorted.length < 2) return false;

  const recent = sorted.slice(0, Math.min(4, sorted.length));
  const newest = new Date(recent[0].date);
  const oldest = new Date(recent[recent.length - 1].date);
  const spanDays = (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24);
  if (spanDays < minDays) return false;

  const weights = recent.map((e) => e.weight);
  const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
  const maxDev = Math.max(...weights.map((w) => Math.abs(w - avg) / Math.max(avg, 1)));
  return maxDev <= 0.008;
}

/** Positive = gaining (lbs/week), negative = losing. */
function weightChangeLbsPerWeek(entries: WeightEntry[]): number | null {
  const sorted = [...entries]
    .filter((e) => e.weight > 0 && e.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (sorted.length < 2) return null;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
  if (days < 7) return null;

  const weeks = days / 7;
  return (last.weight - first.weight) / weeks;
}

function nutritionFocusForGoal(goal: PrimaryGoal | null): NutritionAdaptationResult['focus'] {
  switch (goal) {
    case 'fat_loss':
      return 'deficit';
    case 'muscle_gain':
      return 'surplus';
    case 'general_fitness':
      return 'compliance';
    default:
      return 'maintain';
  }
}

function minimumSafeCalories(profile: CoachingProfile | null, goals: NutritionGoals | null): number {
  const meta = goals?.bmr;
  if (meta && meta > 0) return Math.max(1200, Math.round(meta * 1.1));
  const metrics = profile ? resolveNutritionBodyMetrics(profile) : null;
  if (metrics) {
    const bmr = calculateBmrKgCm(
      metrics.weightKg,
      metrics.heightCm,
      metrics.ageYears,
      metrics.sex
    );
    return Math.max(1200, Math.round(bmr * 1.1));
  }
  return 1200;
}

export async function evaluateNutritionAdaptation(
  profile: CoachingProfile | null,
  meals: LoggedMeal[],
  nutritionCompliancePct: number
): Promise<NutritionAdaptationResult> {
  const goal = profile?.goalProfile.primaryGoal ?? null;
  const focus = nutritionFocusForGoal(goal);
  const goals = (await loadPersistedNutritionGoals()) ?? null;
  const calorieGoal = goals?.calories ?? 2200;
  const floor = minimumSafeCalories(profile, goals);
  const avgCal = avgDailyCalories(meals, 14);
  const weightEntries = (await loadUserData<WeightEntry[]>('weightEntries')) ?? [];
  const weightTrend = weightChangeLbsPerWeek(weightEntries);
  const loggingNearGoal =
    avgCal !== null && avgCal >= calorieGoal * 0.85 && avgCal <= calorieGoal * 1.1;

  if (!goal) {
    return {
      shouldAdjust: false,
      applied: false,
      reason: 'Finish onboarding with your body stats so we can estimate calories and adapt from your logs.',
      focus: 'maintain',
    };
  }

  if (nutritionCompliancePct < 50 || avgCal === null) {
    return {
      shouldAdjust: false,
      applied: false,
      reason:
        'Log meals for about 2 weeks — your coach uses food trends and weight to fine-tune calories.',
      focus: 'compliance',
      trend: 'on_track',
    };
  }

  if (focus === 'compliance' || focus === 'maintain') {
    if (nutritionCompliancePct < 55) {
      return {
        shouldAdjust: false,
        applied: false,
        reason:
          'Consistent food logging matters more than changing calories right now — aim for a few days in a row.',
        focus: 'compliance',
      };
    }
    return {
      shouldAdjust: false,
      applied: false,
      reason: 'Nutrition on track — keep protein steady and training consistent.',
      focus,
      trend: 'on_track',
    };
  }

  if (goal === 'muscle_gain') {
    const gainingSlow = weightTrend !== null && weightTrend < 0.15;
    const hittingTarget = loggingNearGoal && nutritionCompliancePct >= 60;
    if (hittingTarget && gainingSlow) {
      const delta = 150;
      const suggested = calorieGoal + delta;
      return {
        shouldAdjust: true,
        applied: false,
        suggestedCalories: suggested,
        deltaCalories: delta,
        reason:
          'You are hitting calories but weight is flat — a small +150 kcal bump can support muscle gain.',
        focus: 'surplus',
        trend: 'gaining_slow',
      };
    }
    return {
      shouldAdjust: false,
      applied: false,
      reason: gainingSlow
        ? 'Eat closer to your daily target for a few more weeks before we raise calories.'
        : 'Muscle gain on track — keep protein high and training progressive.',
      focus: 'surplus',
      trend: weightTrend !== null && weightTrend >= 0.15 ? 'on_track' : 'gaining_slow',
    };
  }

  if (goal !== 'fat_loss') {
    return {
      shouldAdjust: false,
      applied: false,
      reason: 'No nutrition adjustment suggested for your current goal.',
      focus,
    };
  }

  const losingFast = weightTrend !== null && weightTrend <= -1.5;
  if (losingFast && loggingNearGoal) {
    const delta = 150;
    return {
      shouldAdjust: true,
      applied: false,
      suggestedCalories: Math.min(calorieGoal + delta, (goals?.tdee ?? calorieGoal + delta)),
      deltaCalories: delta,
      reason:
        'Weight is dropping quickly — adding ~150 kcal helps preserve muscle and energy while still losing fat.',
      focus: 'deficit',
      trend: 'losing_fast',
    };
  }

  const underEating = avgCal !== null && avgCal < calorieGoal * 0.75;
  if (underEating && weightPlateau(weightEntries, 10)) {
    const delta = 125;
    return {
      shouldAdjust: true,
      applied: false,
      suggestedCalories: Math.min(calorieGoal + delta, goals?.tdee ?? calorieGoal + 200),
      deltaCalories: delta,
      reason:
        'You are under your target often and weight is flat — eating a bit more can restart progress without abandoning the deficit.',
      focus: 'deficit',
      trend: 'under_eating',
    };
  }

  const plateau = weightPlateau(weightEntries) || (loggingNearGoal && nutritionCompliancePct >= 65);
  if (!plateau) {
    return {
      shouldAdjust: false,
      applied: false,
      reason: loggingNearGoal
        ? 'Fat loss on track — keep current calories unless weight stalls for 2+ weeks.'
        : 'Log meals near your target for ~2 weeks so your coach can spot a true plateau.',
      focus: 'deficit',
      trend: 'on_track',
    };
  }

  const delta = calorieGoal > 1800 ? -125 : -100;
  const suggested = Math.max(floor, calorieGoal + delta);

  return {
    shouldAdjust: true,
    applied: false,
    suggestedCalories: suggested,
    deltaCalories: delta,
    reason: `Weight looks flat while you are hitting calories — a small ${delta} kcal adjustment can restart fat loss.`,
    focus: 'deficit',
    trend: 'plateau',
  };
}

/** Apply a coach-recommended calorie change after the user confirms. */
export async function applyNutritionCalorieAdjustment(
  suggestedCalories: number,
  current?: NutritionGoals | null
): Promise<NutritionGoals> {
  const base = current ?? (await loadPersistedNutritionGoals());
  const prev = base ?? { calories: 2000, protein: 150, carbs: 250, fat: 80, water: 64 };
  const next = buildCalorieAdjustedGoals(suggestedCalories, prev, 'adaptation');
  await savePersistedNutritionGoals(next);
  return next;
}

const NUTRITION_ADAPT_STATE_KEY = 'nutritionAdaptationState';

/** Queue a calorie tweak suggestion when trends warrant it (max once per 14 days). */
export async function autoAdaptNutritionIfNeeded(): Promise<string | null> {
  const { buildCoachingContextSnapshot } = await import('./CoachingEngine');
  const ctx = await buildCoachingContextSnapshot();
  const suggestion = ctx.goalAdaptation.nutrition;
  if (!suggestion?.shouldAdjust || suggestion.suggestedCalories == null) {
    return null;
  }

  const state =
    (await loadUserData<{ lastAppliedAt?: string; lastQueuedAt?: string }>(NUTRITION_ADAPT_STATE_KEY)) ||
    {};
  const lastTouch = state.lastQueuedAt || state.lastAppliedAt;
  if (lastTouch) {
    const daysSince = (Date.now() - new Date(lastTouch).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 14) return null;
  }

  const current = await loadPersistedNutritionGoals();
  const prev = current ?? { calories: 2000, protein: 150, carbs: 250, fat: 80, water: 64 };
  const suggestedGoals = buildCalorieAdjustedGoals(suggestion.suggestedCalories, prev, 'adaptation');

  const defer = await shouldDeferNutritionOverride(suggestedGoals);
  if (defer) {
    await queueNutritionSuggestion({
      source: 'adaptation',
      reason: suggestion.reason,
      suggestedGoals,
    });
    await saveUserData(NUTRITION_ADAPT_STATE_KEY, {
      ...state,
      lastQueuedAt: new Date().toISOString(),
    });
    return 'Your coach has a new macro suggestion — review it below.';
  }

  await applyNutritionCalorieAdjustment(suggestion.suggestedCalories, current);
  await saveUserData(NUTRITION_ADAPT_STATE_KEY, {
    ...state,
    lastAppliedAt: new Date().toISOString(),
  });
  return suggestion.reason;
}

export async function loadNutritionTargetsMeta(): Promise<NutritionTargetsMeta | null> {
  return (await loadUserData<NutritionTargetsMeta>('nutritionTargetsMeta')) ?? null;
}

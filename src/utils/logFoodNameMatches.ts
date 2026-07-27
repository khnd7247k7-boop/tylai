/**
 * Meal-name suggestions: remembered foods (frequency + recency) before USDA API hits in Log Food.
 * Logged meals are upserted into saved templates; each log bumps use count for faster re-find.
 */

import type { LogFoodItem } from '../types/nutritionLogging';

export interface LogFoodSavedMatch {
  kind: 'saved';
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timesUsed: number;
  lastUsed: string;
  servingUnit?: string;
  baseServingSize?: string;
  servings?: string;
  servingAmount?: string;
  items?: LogFoodItem[];
}

export interface LogFoodHistoryMatch {
  kind: 'history';
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
  logCount: number;
  servingUnit?: string;
  baseServingSize?: string;
  servings?: string;
  servingAmount?: string;
  items?: LogFoodItem[];
}

/** Unified row for inline suggestions — saved + history merged by priority score. */
export interface LogFoodYourFoodMatch {
  kind: 'saved' | 'history';
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timesUsed: number;
  lastUsed: string;
  logCount: number;
  score: number;
  servingUnit?: string;
  baseServingSize?: string;
  servings?: string;
  servingAmount?: string;
  items?: LogFoodItem[];
}

export interface LogFoodNameMatchGroups {
  saved: LogFoodSavedMatch[];
  history: LogFoodHistoryMatch[];
  /** Merged list sorted by priority (frequency, recency, query match). */
  yourFoods: LogFoodYourFoodMatch[];
}

export interface LogFoodSavedLike {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timesUsed: number;
  lastUsed?: string;
  lastServingUnit?: string;
  lastBaseServingSize?: string;
  lastServings?: string;
  lastServingAmount?: string;
  items?: LogFoodItem[];
}

export interface LogFoodMealLike {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
  servings?: number;
  servingUnit?: string;
  servingAmount?: string;
  items?: LogFoodItem[];
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** True if `mealNorm` (already lowercased) matches the search `queryNorm` (lowercased, len ≥ 2). */
function mealNameMatchesQuery(mealNorm: string, queryNorm: string): boolean {
  if (queryNorm.length < 2) return false;
  if (mealNorm.includes(queryNorm)) return true;
  const tokens = queryNorm.split(/\s+/).filter(Boolean);
  const significant = tokens.filter((t) => t.length >= 2);
  if (significant.length === 0) {
    return tokens.length > 0 && tokens.every((t) => mealNorm.includes(t));
  }
  return significant.every((t) => mealNorm.includes(t));
}

function recencyBoost(lastUsedIso: string): number {
  const lastTs = new Date(lastUsedIso).getTime();
  if (!Number.isFinite(lastTs)) return 0;
  const daysAgo = (Date.now() - lastTs) / 86_400_000;
  if (daysAgo < 1) return 600;
  if (daysAgo < 3) return 450;
  if (daysAgo < 7) return 300;
  if (daysAgo < 30) return 120;
  return 0;
}

function queryMatchBoost(q: string, name: string): number {
  const qq = norm(q);
  if (qq.length < 2) return 0;
  const n = norm(name);
  if (n === qq) return 2000;
  if (n.startsWith(qq)) return 900;
  if (mealNameMatchesQuery(n, qq)) return 450;
  let partial = 0;
  for (const w of qq.split(/\s+/).filter((x) => x.length > 1)) {
    if (n.includes(w)) partial += 60;
  }
  return partial;
}

function foodPriorityScore(
  q: string,
  name: string,
  timesUsed: number,
  lastUsedIso: string,
  logCount: number
): number {
  return (
    timesUsed * 14 +
    logCount * 5 +
    recencyBoost(lastUsedIso) +
    queryMatchBoost(q, name)
  );
}

interface MealNameAggregate {
  logCount: number;
  lastDate: string;
  latest: LogFoodMealLike;
}

function buildMealNameAggregates(meals: LogFoodMealLike[]): Map<string, MealNameAggregate> {
  const map = new Map<string, MealNameAggregate>();
  for (const m of meals) {
    const nk = norm(m.name);
    if (nk.length < 2) continue;
    const cur = map.get(nk);
    if (!cur) {
      map.set(nk, { logCount: 1, lastDate: m.date, latest: m });
      continue;
    }
    cur.logCount += 1;
    if (new Date(m.date).getTime() >= new Date(cur.lastDate).getTime()) {
      cur.lastDate = m.date;
      cur.latest = m;
    }
  }
  return map;
}

function portionFromMeal(m: LogFoodMealLike): Pick<
  LogFoodYourFoodMatch,
  'servingUnit' | 'baseServingSize' | 'servings' | 'servingAmount'
> {
  const storedServings = Math.max(parseFloat(String(m.servings ?? 1)) || 1, 0.0001);
  const storedPortionAmount =
    m.servingAmount != null && parseFloat(String(m.servingAmount)) > 0
      ? parseFloat(String(m.servingAmount))
      : storedServings;
  const perServingSize = storedPortionAmount / storedServings;
  const baseServingSizeStr =
    Math.abs(perServingSize - Math.round(perServingSize)) < 0.001
      ? String(Math.round(perServingSize))
      : String(Math.round(perServingSize * 10) / 10);
  return {
    servingUnit: m.servingUnit,
    baseServingSize: baseServingSizeStr,
    servings: String(storedServings),
    servingAmount: m.servingAmount != null ? String(m.servingAmount) : undefined,
  };
}

function portionFromSaved(m: LogFoodSavedLike): Pick<
  LogFoodYourFoodMatch,
  'servingUnit' | 'baseServingSize' | 'servings' | 'servingAmount'
> {
  return {
    servingUnit: m.lastServingUnit,
    baseServingSize: m.lastBaseServingSize,
    servings: m.lastServings,
    servingAmount: m.lastServingAmount,
  };
}

/**
 * Returns saved meals and past meals merged into a single priority-ranked list.
 * When `query` is under 2 characters, returns frequent/recent quick picks instead.
 */
export function getLogFoodNameMatches(
  query: string,
  savedMeals: LogFoodSavedLike[],
  meals: LogFoodMealLike[],
  opts?: { maxSaved?: number; maxHistory?: number; maxYourFoods?: number }
): LogFoodNameMatchGroups {
  const maxSaved = opts?.maxSaved ?? 14;
  const maxHistory = opts?.maxHistory ?? 10;
  const maxYourFoods = opts?.maxYourFoods ?? 16;
  const q = norm(query);
  const quickPickMode = q.length < 2;
  const mealAgg = buildMealNameAggregates(meals);
  const byName = new Map<string, LogFoodYourFoodMatch>();

  for (const m of savedMeals) {
    const nk = norm(m.name);
    if (nk.length < 2) continue;
    if (!quickPickMode && !mealNameMatchesQuery(nk, q)) continue;
    const agg = mealAgg.get(nk);
    const logCount = agg?.logCount ?? 0;
    const lastUsed = m.lastUsed ?? agg?.lastDate ?? '';
    const score = foodPriorityScore(q, m.name, m.timesUsed, lastUsed, logCount);
    byName.set(nk, {
      kind: 'saved',
      id: m.id,
      name: m.name,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      timesUsed: m.timesUsed,
      lastUsed,
      logCount: Math.max(logCount, m.timesUsed),
      score,
      ...portionFromSaved(m),
      items: m.items?.length ? m.items : agg?.latest.items,
    });
  }

  for (const [nk, agg] of mealAgg) {
    if (!quickPickMode && !mealNameMatchesQuery(nk, q)) continue;
    const existing = byName.get(nk);
    if (existing && existing.kind === 'saved') continue;
    const latest = agg.latest;
    const score = foodPriorityScore(q, latest.name, 0, agg.lastDate, agg.logCount);
    if (existing && existing.score >= score) continue;
    byName.set(nk, {
      kind: 'history',
      id: latest.id,
      name: latest.name,
      calories: latest.calories,
      protein: latest.protein,
      carbs: latest.carbs,
      fat: latest.fat,
      timesUsed: 0,
      lastUsed: agg.lastDate,
      logCount: agg.logCount,
      score,
      ...portionFromMeal(latest),
      items: latest.items,
    });
  }

  const yourFoods = Array.from(byName.values())
    .sort((a, b) => b.score - a.score || b.lastUsed.localeCompare(a.lastUsed))
    .slice(0, maxYourFoods);

  const saved: LogFoodSavedMatch[] = yourFoods
    .filter((r): r is LogFoodYourFoodMatch & { kind: 'saved' } => r.kind === 'saved')
    .slice(0, maxSaved)
    .map((r) => ({
      kind: 'saved' as const,
      id: r.id,
      name: r.name,
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      timesUsed: r.timesUsed,
      lastUsed: r.lastUsed,
      servingUnit: r.servingUnit,
      baseServingSize: r.baseServingSize,
      servings: r.servings,
      servingAmount: r.servingAmount,
      items: r.items,
    }));

  const savedNameKeys = new Set(saved.map((s) => norm(s.name)));
  const history: LogFoodHistoryMatch[] = yourFoods
    .filter((r) => r.kind === 'history' && !savedNameKeys.has(norm(r.name)))
    .slice(0, maxHistory)
    .map((r) => ({
      kind: 'history' as const,
      id: r.id,
      name: r.name,
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      date: r.lastUsed,
      logCount: r.logCount,
      servingUnit: r.servingUnit,
      baseServingSize: r.baseServingSize,
      servings: r.servings,
      servingAmount: r.servingAmount,
      items: r.items,
    }));

  return { saved, history, yourFoods };
}

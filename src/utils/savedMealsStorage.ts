import { loadUserData, saveUserData, getUserStorageKey } from './userStorage';

export type SavedMealRecord = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timesUsed: number;
  lastUsed: string;
  lastServingUnit?: string;
  lastBaseServingSize?: string;
  lastServings?: string;
  lastServingAmount?: string;
};

export type SavedMealPortionHint = {
  lastServingUnit?: string;
  lastBaseServingSize?: string;
  lastServings?: string;
  lastServingAmount?: string;
};

function lastUsedTs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function normalizeSavedMeal(m: Partial<SavedMealRecord> | null | undefined): SavedMealRecord | null {
  if (!m) return null;
  const name = String(m.name ?? '').trim();
  if (!name) return null;
  return {
    id: String(m.id ?? `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`),
    name,
    calories: Math.max(0, Math.round(Number(m.calories) || 0)),
    protein: Math.max(0, Math.round(Number(m.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(m.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(m.fat) || 0)),
    timesUsed: Math.max(0, Math.round(Number(m.timesUsed) || 0)),
    lastServingUnit: typeof m.lastServingUnit === 'string' ? m.lastServingUnit : undefined,
    lastBaseServingSize: typeof m.lastBaseServingSize === 'string' ? m.lastBaseServingSize : undefined,
    lastServings: typeof m.lastServings === 'string' ? m.lastServings : undefined,
    lastServingAmount: typeof m.lastServingAmount === 'string' ? m.lastServingAmount : undefined,
    lastUsed:
      typeof m.lastUsed === 'string' && Number.isFinite(new Date(m.lastUsed).getTime())
        ? m.lastUsed
        : new Date().toISOString(),
  };
}

export function normalizeSavedMealsList(meals: unknown): SavedMealRecord[] {
  if (!Array.isArray(meals)) return [];
  const out: SavedMealRecord[] = [];
  for (const row of meals) {
    const n = normalizeSavedMeal(row as Partial<SavedMealRecord>);
    if (n) out.push(n);
  }
  return dedupeSavedMealsByName(out);
}

/** Keep the newest entry per meal name (case-insensitive). */
export function dedupeSavedMealsByName(meals: SavedMealRecord[]): SavedMealRecord[] {
  const byName = new Map<string, SavedMealRecord>();
  for (const m of meals) {
    const k = m.name.toLowerCase();
    const cur = byName.get(k);
    if (!cur || lastUsedTs(m.lastUsed) >= lastUsedTs(cur.lastUsed)) {
      byName.set(k, m);
    }
  }
  return Array.from(byName.values()).sort((a, b) => lastUsedTs(b.lastUsed) - lastUsedTs(a.lastUsed));
}

/**
 * Merge disk + in-memory lists without losing either side.
 * Same id → prefer newer lastUsed; same name → prefer newer lastUsed.
 */
export function mergeSavedMealLists(
  disk: SavedMealRecord[],
  memory: SavedMealRecord[]
): SavedMealRecord[] {
  const byId = new Map<string, SavedMealRecord>();
  for (const m of [...disk, ...memory]) {
    const cur = byId.get(m.id);
    if (!cur || lastUsedTs(m.lastUsed) >= lastUsedTs(cur.lastUsed)) {
      byId.set(m.id, m);
    }
  }
  return dedupeSavedMealsByName(Array.from(byId.values()));
}

/** Upsert a meal template by name; collapses duplicate names. */
export function applySavedMealUpsert(
  prev: SavedMealRecord[],
  mealName: string,
  totals: { calories: number; protein: number; carbs: number; fat: number },
  opts?: { bumpUsesOnMatch?: boolean; portion?: SavedMealPortionHint }
): SavedMealRecord[] {
  const trimmed = mealName.trim();
  if (!trimmed) return prev;
  const key = trimmed.toLowerCase();
  const existing = prev.find((m) => m.name.toLowerCase() === key);
  const now = new Date().toISOString();
  const portion = opts?.portion;
  let next: SavedMealRecord[];
  if (existing) {
    next = prev.map((m) =>
      m.id === existing.id
        ? {
            ...m,
            name: trimmed,
            calories: totals.calories,
            protein: totals.protein,
            carbs: totals.carbs,
            fat: totals.fat,
            lastUsed: now,
            timesUsed: opts?.bumpUsesOnMatch ? m.timesUsed + 1 : m.timesUsed,
            ...(portion?.lastServingUnit ? { lastServingUnit: portion.lastServingUnit } : {}),
            ...(portion?.lastBaseServingSize ? { lastBaseServingSize: portion.lastBaseServingSize } : {}),
            ...(portion?.lastServings ? { lastServings: portion.lastServings } : {}),
            ...(portion?.lastServingAmount ? { lastServingAmount: portion.lastServingAmount } : {}),
          }
        : m
    );
  } else {
    next = [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        name: trimmed,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        timesUsed: 1,
        lastUsed: now,
        ...(portion?.lastServingUnit ? { lastServingUnit: portion.lastServingUnit } : {}),
        ...(portion?.lastBaseServingSize ? { lastBaseServingSize: portion.lastBaseServingSize } : {}),
        ...(portion?.lastServings ? { lastServings: portion.lastServings } : {}),
        ...(portion?.lastServingAmount ? { lastServingAmount: portion.lastServingAmount } : {}),
      },
      ...prev,
    ];
  }
  return dedupeSavedMealsByName(next);
}

export async function loadSavedMealsFromDisk(): Promise<SavedMealRecord[]> {
  const parsed = await loadUserData<unknown>('savedMeals');
  return normalizeSavedMealsList(parsed);
}

/**
 * Persist an upsert against what's already on disk (merged with memory),
 * so a late/empty UI state cannot wipe favorites on save.
 */
export async function persistSavedMealUpsert(
  memoryList: SavedMealRecord[],
  mealName: string,
  totals: { calories: number; protein: number; carbs: number; fat: number },
  opts?: { bumpUsesOnMatch?: boolean; portion?: SavedMealPortionHint }
): Promise<SavedMealRecord[]> {
  const key = await getUserStorageKey('savedMeals');
  if (!key) {
    throw new Error('Sign in is required to save favorite meals on this device.');
  }
  const disk = await loadSavedMealsFromDisk();
  const base = mergeSavedMealLists(disk, memoryList);
  const next = applySavedMealUpsert(base, mealName, totals, opts);
  await saveUserData('savedMeals', next);
  return next;
}

export async function persistSavedMealsList(meals: SavedMealRecord[]): Promise<SavedMealRecord[]> {
  const key = await getUserStorageKey('savedMeals');
  if (!key) {
    throw new Error('Sign in is required to save favorite meals on this device.');
  }
  const disk = await loadSavedMealsFromDisk();
  const next = mergeSavedMealLists(disk, normalizeSavedMealsList(meals));
  await saveUserData('savedMeals', next);
  return next;
}

export async function bumpSavedMealUse(
  memoryList: SavedMealRecord[],
  mealId: string
): Promise<SavedMealRecord[]> {
  const key = await getUserStorageKey('savedMeals');
  if (!key) {
    throw new Error('Sign in is required to update saved meals.');
  }
  const disk = await loadSavedMealsFromDisk();
  const base = mergeSavedMealLists(disk, memoryList);
  const now = new Date().toISOString();
  const next = base.map((meal) =>
    meal.id === mealId ? { ...meal, timesUsed: meal.timesUsed + 1, lastUsed: now } : meal
  );
  await saveUserData('savedMeals', next);
  return next;
}

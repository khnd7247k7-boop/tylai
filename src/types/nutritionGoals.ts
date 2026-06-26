export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
  /** Estimated basal metabolic rate when derived from onboarding. */
  bmr?: number;
  /** Estimated maintenance calories (BMR × activity). */
  tdee?: number;
  derivedFrom?: 'onboarding' | 'adaptation' | 'manual' | 'profile_update';
}

export const DEFAULT_NUTRITION_GOALS: NutritionGoals = {
  calories: 2000,
  protein: 150,
  carbs: 250,
  fat: 80,
  water: 64,
};

export function normalizeNutritionGoals(raw: unknown): NutritionGoals | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const protein = Number(o.protein);
  const carbs = Number(o.carbs);
  const fat = Number(o.fat);
  const water = Number(o.water);
  if (![protein, carbs, fat, water].every((n) => Number.isFinite(n) && n >= 0)) {
    return null;
  }
  const caloriesRaw = Number(o.calories);
  const calories =
    Number.isFinite(caloriesRaw) && caloriesRaw > 0
      ? caloriesRaw
      : Math.round(protein * 4 + carbs * 4 + fat * 9);
  const derivedFrom = o.derivedFrom;
  const bmr = Number(o.bmr);
  const tdee = Number(o.tdee);
  return {
    calories,
    protein,
    carbs,
    fat,
    water,
    ...(Number.isFinite(bmr) && bmr > 0 ? { bmr } : {}),
    ...(Number.isFinite(tdee) && tdee > 0 ? { tdee } : {}),
    ...(derivedFrom === 'onboarding' ||
    derivedFrom === 'adaptation' ||
    derivedFrom === 'manual' ||
    derivedFrom === 'profile_update'
      ? { derivedFrom }
      : {}),
  };
}

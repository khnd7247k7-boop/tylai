import type { GeneratedMealPlan, MealPlanDay, PlannedMeal, PlannedMealSlot } from '../types/mealPlan';

function stripJsonFromModelText(raw: string): string {
  const t = raw.trim();
  return t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

function coerceInt(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function normalizeSlot(v: unknown): PlannedMealSlot {
  const s = String(v ?? '').toLowerCase();
  if (s === 'breakfast' || s === 'lunch' || s === 'dinner') return s;
  return 'snack';
}

function normalizePlannedMeal(raw: unknown, index: number): PlannedMeal | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? o.title ?? `Meal ${index + 1}`).trim();
  if (!name) return null;
  const protein = coerceInt(o.protein ?? o.protein_g);
  const carbs = coerceInt(o.carbs ?? o.carbs_g);
  const fat = coerceInt(o.fat ?? o.fat_g);
  const calRaw = coerceInt(o.calories);
  const calories = calRaw > 0 ? calRaw : Math.round(protein * 4 + carbs * 4 + fat * 9);
  const ingredientsRaw = o.ingredients;
  const ingredients = Array.isArray(ingredientsRaw)
    ? ingredientsRaw
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const row = item as Record<string, unknown>;
          const ingName = String(row.name ?? '').trim();
          if (!ingName) return null;
          return {
            name: ingName,
            amount: row.amount != null ? String(row.amount).trim() : undefined,
          };
        })
        .filter((x): x is { name: string; amount?: string } => x !== null)
    : undefined;
  return {
    slot: normalizeSlot(o.slot ?? o.meal_slot ?? o.type),
    name,
    description: o.description != null ? String(o.description).trim() : undefined,
    calories,
    protein,
    carbs,
    fat,
    prepMinutes: o.prep_minutes != null ? coerceInt(o.prep_minutes) : undefined,
    ingredients: ingredients?.length ? ingredients : undefined,
  };
}

function normalizeDay(raw: unknown, index: number): MealPlanDay | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const dayLabel = String(o.day_label ?? o.dayLabel ?? o.day ?? `Day ${index + 1}`).trim();
  const mealsRaw = o.meals;
  const meals = Array.isArray(mealsRaw)
    ? mealsRaw
        .map((m, i) => normalizePlannedMeal(m, i))
        .filter((x): x is PlannedMeal => x !== null)
    : [];
  if (!meals.length) return null;
  const totalsRaw = o.daily_totals ?? o.dailyTotals;
  const totalsObj =
    totalsRaw && typeof totalsRaw === 'object' ? (totalsRaw as Record<string, unknown>) : {};
  const protein = meals.reduce((s, m) => s + m.protein, 0);
  const carbs = meals.reduce((s, m) => s + m.carbs, 0);
  const fat = meals.reduce((s, m) => s + m.fat, 0);
  const calories = meals.reduce((s, m) => s + m.calories, 0);
  return {
    dayLabel,
    meals,
    dailyTotals: {
      calories: coerceInt(totalsObj.calories, calories),
      protein: coerceInt(totalsObj.protein ?? totalsObj.protein_g, protein),
      carbs: coerceInt(totalsObj.carbs ?? totalsObj.carbs_g, carbs),
      fat: coerceInt(totalsObj.fat ?? totalsObj.fat_g, fat),
    },
  };
}

export function parseGeneratedMealPlanPayload(
  raw: string,
  targetGoals: GeneratedMealPlan['targetGoals']
): { plan: GeneratedMealPlan | null; parseWarning?: string; rawFallback?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { plan: null, parseWarning: 'Empty AI response.', rawFallback: '' };
  }
  const t = stripJsonFromModelText(trimmed);
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  const slice = start >= 0 && end > start ? t.slice(start, end + 1) : t;
  try {
    const o = JSON.parse(slice) as Record<string, unknown>;
    const daysRaw = o.days;
    const days = Array.isArray(daysRaw)
      ? daysRaw
          .map((d, i) => normalizeDay(d, i))
          .filter((x): x is MealPlanDay => x !== null)
      : [];
    if (!days.length) {
      return {
        plan: null,
        parseWarning: 'No valid days in meal plan response.',
        rawFallback: trimmed,
      };
    }
    const plan: GeneratedMealPlan = {
      id: `meal-plan-${Date.now()}`,
      name: String(o.name ?? o.plan_name ?? 'Your meal plan').trim() || 'Your meal plan',
      createdAt: new Date().toISOString(),
      summary: String(o.summary ?? '').trim(),
      coachingNotes: o.coaching_notes != null ? String(o.coaching_notes).trim() : undefined,
      targetGoals,
      days,
    };
    return { plan };
  } catch {
    return { plan: null, parseWarning: 'Could not parse meal plan JSON.', rawFallback: trimmed };
  }
}

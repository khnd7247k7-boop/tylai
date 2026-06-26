import type { LoggedMeal } from './loggedMeals';
import type { NutritionGoals } from '../types/nutritionGoals';

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** True when recent food logs show the user is consistently near their current macro goals. */
export function isUserHittingCurrentMacros(
  meals: LoggedMeal[],
  goals: NutritionGoals,
  lookbackDays = 14
): boolean {
  if (!goals?.calories || goals.calories <= 0) return false;

  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  const byDay = new Map<string, { cal: number; p: number }>();
  for (const meal of meals) {
    const dt = new Date(meal.date);
    if (Number.isNaN(dt.getTime()) || dt < since) continue;
    const key = localDateKey(dt);
    const cur = byDay.get(key) ?? { cal: 0, p: 0 };
    cur.cal += meal.calories || 0;
    cur.p += meal.protein || 0;
    byDay.set(key, cur);
  }

  if (byDay.size < 5) return false;

  let hitDays = 0;
  for (const day of byDay.values()) {
    const calRatio = day.cal / goals.calories;
    const proteinRatio = goals.protein > 0 ? day.p / goals.protein : 1;
    if (calRatio >= 0.8 && calRatio <= 1.2 && proteinRatio >= 0.7 && proteinRatio <= 1.3) {
      hitDays += 1;
    }
  }

  return hitDays / byDay.size >= 0.55;
}

export function goalsAreSimilar(
  a: NutritionGoals,
  b: NutritionGoals,
  tolerance = 0.08
): boolean {
  const within = (x: number, y: number) => {
    if (x <= 0 || y <= 0) return x === y;
    return Math.abs(x - y) / x <= tolerance;
  };
  return (
    within(a.calories, b.calories) &&
    within(a.protein, b.protein) &&
    within(a.carbs, b.carbs) &&
    within(a.fat, b.fat)
  );
}

import type { Food, FoodMacrosPer100g, FoodNutrient } from '../types/fdcApi';

/**
 * Scale a per-100 g lab value to an arbitrary portion (grams).
 * USDA Foundation / SR convention: stored values are per 100 g.
 */
export function calculateNutrients(baseValue: number, grams: number): number {
  if (!Number.isFinite(baseValue) || !Number.isFinite(grams)) return NaN;
  return (baseValue / 100) * grams;
}

function normUnit(u: string | undefined): string {
  return String(u ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function normName(n: string | undefined): string {
  return String(n ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function rowAmount(row: FoodNutrient): number | undefined {
  const a = row.amount;
  if (typeof a === 'number' && Number.isFinite(a)) return a;
  const v = row.value;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v != null) {
    const n = parseFloat(String(v).replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function nutrientId(row: FoodNutrient): number | undefined {
  const nested = row.nutrient?.id;
  if (typeof nested === 'number' && Number.isFinite(nested)) return nested;
  if (typeof row.nutrientId === 'number' && Number.isFinite(row.nutrientId)) return row.nutrientId;
  if (typeof row.id === 'number' && Number.isFinite(row.id)) return row.id;
  return undefined;
}

/**
 * Human-readable + ID mapping for core nutrients from `foodNutrients`.
 * Calories: only **KCAL** rows (skips kJ "Energy" duplicates).
 */
export const FDC_CORE_NUTRIENT_MAP = {
  calories: {
    ids: [1008, 2047] as const,
    nameIncludes: ['energy'],
    /** Must match this unit (USDA uses "KCAL", "kcal", etc.). */
    unitMustBe: 'KCAL',
  },
  protein: {
    ids: [1003] as const,
    names: ['protein'],
    unitPreferred: 'G',
  },
  fat: {
    ids: [1004] as const,
    nameIncludes: ['total lipid (fat)', 'total lipid'],
    unitPreferred: 'G',
  },
  carbs: {
    ids: [1005, 205] as const,
    nameIncludes: ['carbohydrate, by difference'],
    unitPreferred: 'G',
  },
} as const;

function pickByIds(rows: FoodNutrient[], ids: readonly number[]): number | null {
  const byId = new Map<number, number>();
  for (const row of rows) {
    const id = nutrientId(row);
    if (id == null) continue;
    const amt = rowAmount(row);
    if (amt == null || !Number.isFinite(amt)) continue;
    byId.set(id, amt);
  }
  for (const id of ids) {
    if (byId.has(id)) return byId.get(id)!;
  }
  return null;
}

/**
 * Extract Energy (kcal only), Protein, Total lipid (fat), Carbohydrate by difference — per 100 g.
 */
export function extractMacrosPer100g(food: Food | null | undefined): FoodMacrosPer100g {
  const empty: FoodMacrosPer100g = {
    energyKcal: null,
    proteinG: null,
    fatG: null,
    carbsG: null,
  };
  if (!food?.foodNutrients?.length) return empty;

  const rows = food.foodNutrients;

  let energyKcal: number | null = null;
  for (const row of rows) {
    const name = normName(row.nutrient?.name);
    const unit = normUnit(row.nutrient?.unitName);
    if (!name.includes('energy')) continue;
    if (unit !== 'KCAL' && unit !== 'KCALS') continue;
    const amt = rowAmount(row);
    if (amt == null || !Number.isFinite(amt)) continue;
    energyKcal = amt;
    break;
  }
  if (energyKcal == null) {
    for (const row of rows) {
      const id = nutrientId(row);
      if (id == null || ![1008, 2047, 208].includes(id)) continue;
      const unit = normUnit(row.nutrient?.unitName);
      if (id !== 208 && unit !== 'KCAL' && unit !== 'KCALS' && unit !== '') continue;
      const amt = rowAmount(row);
      if (amt != null && Number.isFinite(amt)) {
        energyKcal = amt;
        break;
      }
    }
  }

  let proteinG: number | null = null;
  for (const row of rows) {
    if (nutrientId(row) === 1003) {
      const amt = rowAmount(row);
      if (amt != null && Number.isFinite(amt)) {
        proteinG = amt;
        break;
      }
    }
  }
  if (proteinG == null) {
    for (const row of rows) {
      if (normName(row.nutrient?.name) === 'protein') {
        const amt = rowAmount(row);
        if (amt != null && Number.isFinite(amt)) {
          proteinG = amt;
          break;
        }
      }
    }
  }
  if (proteinG == null) proteinG = pickByIds(rows, [...FDC_CORE_NUTRIENT_MAP.protein.ids]);

  let fatG: number | null = null;
  for (const row of rows) {
    if (nutrientId(row) === 1004) {
      const amt = rowAmount(row);
      if (amt != null && Number.isFinite(amt)) {
        fatG = amt;
        break;
      }
    }
  }
  if (fatG == null) {
    for (const row of rows) {
      const name = normName(row.nutrient?.name);
      if (!name.includes('total lipid')) continue;
      const amt = rowAmount(row);
      if (amt != null && Number.isFinite(amt)) {
        fatG = amt;
        break;
      }
    }
  }
  if (fatG == null) fatG = pickByIds(rows, [...FDC_CORE_NUTRIENT_MAP.fat.ids]);

  let carbsG: number | null = null;
  for (const row of rows) {
    const id = nutrientId(row);
    if (id === 1005 || id === 205) {
      const amt = rowAmount(row);
      if (amt != null && Number.isFinite(amt)) {
        carbsG = amt;
        break;
      }
    }
  }
  if (carbsG == null) {
    for (const row of rows) {
      const name = normName(row.nutrient?.name);
      if (!name.includes('carbohydrate, by difference') && !name.includes('carbohydrate by difference')) continue;
      const amt = rowAmount(row);
      if (amt != null && Number.isFinite(amt)) {
        carbsG = amt;
        break;
      }
    }
  }
  if (carbsG == null) carbsG = pickByIds(rows, [...FDC_CORE_NUTRIENT_MAP.carbs.ids]);

  return { energyKcal, proteinG, fatG, carbsG };
}

export function scaleMacrosFrom100g(macros: FoodMacrosPer100g, grams: number): FoodMacrosPer100g {
  const g = Number.isFinite(grams) && grams > 0 ? grams : 100;
  return {
    energyKcal: macros.energyKcal != null ? calculateNutrients(macros.energyKcal, g) : null,
    proteinG: macros.proteinG != null ? calculateNutrients(macros.proteinG, g) : null,
    fatG: macros.fatG != null ? calculateNutrients(macros.fatG, g) : null,
    carbsG: macros.carbsG != null ? calculateNutrients(macros.carbsG, g) : null,
  };
}

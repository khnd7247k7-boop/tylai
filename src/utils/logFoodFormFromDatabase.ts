import type { Food } from '../types/fdcApi';
import type { Micronutrients } from './foodDatabase';
import {
  extractMicronutrientsPer100g,
  scaleMicronutrientsFrom100g,
} from './fdcMicronutrients';
import { extractMacrosPer100g, scaleMacrosFrom100g } from './fdcNutrients';
import { buildPortionOptions } from './fdcPortions';
import {
  formatLogFoodPortionAmount,
  type LogFoodServingUnit,
} from './logFoodPortionScale';
import { inferNaturalReferenceFromFood } from './wholeFoodPortions';

export interface LogFoodFormDatabasePayload {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  time: string;
  servings: string;
  servingUnit: LogFoodServingUnit;
  servingWeight: string;
  baseServingSize: string;
  micronutrients?: Micronutrients;
  nutritionScanNote: string;
  referenceGramsPerPiece?: number;
}

function formatMacro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '0';
  return String(Math.round(n * 10) / 10);
}

function formatEnergy(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '0';
  return String(Math.round(n));
}

function caloriesFromMacros(p: number, c: number, f: number): number {
  return Math.round(p * 4 + c * 4 + f * 9);
}

function isFatSecretFood(food: Food): boolean {
  return (
    String(food.dataType ?? '')
      .toLowerCase()
      .includes('fatsecret') || (food.fdcId != null && food.fdcId < 0)
  );
}

/** Portions that are labeled servings without real metric weight (FatSecret brand items). */
function isCountOnlyServingBasis(food: Food): boolean {
  if (!isFatSecretFood(food)) return false;
  const portions = food.foodPortions ?? [];
  if (!portions.length) return true;
  return portions.every((p) => {
    const abbr = String(p.measureUnit?.abbreviation ?? '').toLowerCase();
    return abbr === 'srv' || abbr === 'count';
  });
}

/**
 * Prefer a realistic default portion:
 * - FatSecret/USDA labeled serving with real grams
 * - else ~100 g lab convention
 * - else first available gram portion
 */
export function pickPreferredPortionGrams(
  food: Food,
  fallbackGrams = 100
): { grams: number; label: string } {
  const options = buildPortionOptions(food);
  if (!options.length) {
    return { grams: fallbackGrams, label: `${fallbackGrams} g` };
  }

  const byExactHundred = options.find((o) => Math.abs(o.gramWeight - 100) < 0.6);
  if (byExactHundred) {
    return { grams: byExactHundred.gramWeight, label: byExactHundred.label };
  }

  // Prefer default-ish mid servings over tiny garnish weights when possible.
  const sensible = options
    .filter((o) => o.gramWeight >= 20 && o.gramWeight <= 500)
    .sort((a, b) => a.gramWeight - b.gramWeight);
  if (sensible.length) {
    return { grams: sensible[0].gramWeight, label: sensible[0].label };
  }

  return { grams: options[0].gramWeight, label: options[0].label };
}

/**
 * Build Log Food form values from catalog food detail (USDA or FatSecret-mapped).
 * Uses a real default serving when available instead of always forcing 100 g.
 */
export function buildLogFoodFormFromFdcFood(
  food: Food,
  opts?: { defaultPortionGrams?: number; hitDescription?: string }
): LogFoodFormDatabasePayload {
  const name = (food.description ?? opts?.hitDescription ?? 'Food').trim();
  const dt = food.dataType ?? 'FDC';
  const naturalRef = inferNaturalReferenceFromFood(food);
  const fatSecret = isFatSecretFood(food);

  if (isCountOnlyServingBasis(food)) {
    // Macros were stored as "per serving" in the per-100g fields (see fatsecret mapper).
    const perServing = extractMacrosPer100g(food);
    const protein = parseFloat(formatMacro(perServing.proteinG)) || 0;
    const carbs = parseFloat(formatMacro(perServing.carbsG)) || 0;
    const fat = parseFloat(formatMacro(perServing.fatG)) || 0;
    let calories = parseInt(formatEnergy(perServing.energyKcal), 10) || 0;
    if (calories <= 0) calories = caloriesFromMacros(protein, carbs, fat);
    const micros = extractMicronutrientsPer100g(food);
    const servingLabel =
      food.foodPortions?.[0]?.portionDescription?.trim() ||
      food.foodPortions?.[0]?.modifier?.trim() ||
      '1 serving';

    return {
      name,
      calories: String(calories),
      protein: formatMacro(perServing.proteinG),
      carbs: formatMacro(perServing.carbsG),
      fat: formatMacro(perServing.fatG),
      time: new Date().toLocaleTimeString(),
      servings: '1',
      servingUnit: 'piece',
      servingWeight: '1',
      baseServingSize: '1',
      micronutrients: micros,
      nutritionScanNote: fatSecret
        ? `Powered by fatsecret Platform API (${dt}). Default: ${servingLabel}. Change serving type to weigh it, or adjust servings.`
        : `Default: ${servingLabel}. Adjust serving type, amount, and servings as needed.`,
      referenceGramsPerPiece: naturalRef?.referenceGrams,
    };
  }

  const preferred = pickPreferredPortionGrams(food, opts?.defaultPortionGrams ?? 100);
  const portionGrams = preferred.grams;
  const gStr = formatLogFoodPortionAmount(portionGrams, 'g');
  const per100 = extractMacrosPer100g(food);
  const scaled = scaleMacrosFrom100g(per100, portionGrams);
  const protein = parseFloat(formatMacro(scaled.proteinG)) || 0;
  const carbs = parseFloat(formatMacro(scaled.carbsG)) || 0;
  const fat = parseFloat(formatMacro(scaled.fatG)) || 0;
  let calories = parseInt(formatEnergy(scaled.energyKcal), 10) || 0;
  if (calories <= 0) calories = caloriesFromMacros(protein, carbs, fat);

  const microsPer100 = extractMicronutrientsPer100g(food);
  const micronutrients = scaleMicronutrientsFrom100g(microsPer100, portionGrams);

  const nutritionScanNote = fatSecret
    ? `Powered by fatsecret Platform API (${dt}). Default portion: ${preferred.label} (${gStr} g). Switch type to oz etc. — amount converts automatically.`
    : `USDA FoodData Central (${dt}). Default portion: ${preferred.label} (${gStr} g). Switch type to oz etc. — amount converts automatically.`;

  return {
    name,
    calories: String(calories),
    protein: formatMacro(scaled.proteinG),
    carbs: formatMacro(scaled.carbsG),
    fat: formatMacro(scaled.fatG),
    time: new Date().toLocaleTimeString(),
    servings: '1',
    servingUnit: 'g',
    servingWeight: gStr,
    baseServingSize: gStr,
    micronutrients,
    nutritionScanNote,
    referenceGramsPerPiece: naturalRef?.referenceGrams,
  };
}

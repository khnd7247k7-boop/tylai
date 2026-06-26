import type { Food } from '../types/fdcApi';
import type { Micronutrients } from './foodDatabase';
import {
  extractMicronutrientsPer100g,
  scaleMicronutrientsFrom100g,
} from './fdcMicronutrients';
import { extractMacrosPer100g, scaleMacrosFrom100g } from './fdcNutrients';
import type { LogFoodServingUnit } from './logFoodPortionScale';
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

/**
 * Build Log Food form values from USDA FDC food detail (default portion = per 100 g convention).
 */
export function buildLogFoodFormFromFdcFood(
  food: Food,
  opts?: { defaultPortionGrams?: number; hitDescription?: string }
): LogFoodFormDatabasePayload {
  const portionGrams = opts?.defaultPortionGrams ?? 100;
  const gStr = String(Math.round(portionGrams * 10) / 10);
  const per100 = extractMacrosPer100g(food);
  const scaled = scaleMacrosFrom100g(per100, portionGrams);
  const protein = parseFloat(formatMacro(scaled.proteinG)) || 0;
  const carbs = parseFloat(formatMacro(scaled.carbsG)) || 0;
  const fat = parseFloat(formatMacro(scaled.fatG)) || 0;
  let calories = parseInt(formatEnergy(scaled.energyKcal), 10) || 0;
  if (calories <= 0) calories = caloriesFromMacros(protein, carbs, fat);

  const microsPer100 = extractMicronutrientsPer100g(food);
  const micronutrients = scaleMicronutrientsFrom100g(microsPer100, portionGrams);

  const name = (food.description ?? opts?.hitDescription ?? 'USDA food').trim();
  const dt = food.dataType ?? 'FDC';
  const naturalRef = inferNaturalReferenceFromFood(food);

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
    nutritionScanNote: `USDA FoodData Central (${dt}). Per 100 g on file — adjust serving size, units, and macros below, then tap Add to log.`,
    referenceGramsPerPiece: naturalRef?.referenceGrams,
  };
}

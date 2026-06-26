import type { MacroMicroSnapshot } from '../types/portionInput';
import { macroSnapshotFromMealInputStrings, scaleMacroSnapshot } from './wholeFoodPortions';

export type LogFoodServingUnit = 'g' | 'oz' | 'fl_oz' | 'piece' | 'cup' | 'ml' | 'tbsp' | 'tsp';

/** Exact avoirdupois ounce (g) — matches USDA / NIST. */
export const GRAMS_PER_OZ = 28.349523125;

/** US nutrition-label customary measures (volume in ml). */
export const ML_PER_FL_OZ = 29.5735295625;
export const ML_PER_CUP = 240;
export const ML_PER_TBSP = 15;
export const ML_PER_TSP = 5;

/** Wheel / picker order with user-facing labels. */
export const LOG_FOOD_SERVING_UNIT_OPTIONS: ReadonlyArray<{ unit: LogFoodServingUnit; label: string }> = [
  { unit: 'g', label: 'Grams' },
  { unit: 'oz', label: 'Ounces' },
  { unit: 'fl_oz', label: 'Fluid oz' },
  { unit: 'ml', label: 'Milliliters' },
  { unit: 'cup', label: 'Cups' },
  { unit: 'tbsp', label: 'Tablespoons' },
  { unit: 'tsp', label: 'Teaspoons' },
  { unit: 'piece', label: 'Piece' },
];

export function isLogFoodServingUnit(raw: string): raw is LogFoodServingUnit {
  return LOG_FOOD_SERVING_UNIT_OPTIONS.some((o) => o.unit === raw);
}

export function logFoodServingUnitLabel(unit: LogFoodServingUnit): string {
  return LOG_FOOD_SERVING_UNIT_OPTIONS.find((o) => o.unit === unit)?.label ?? unit;
}

/** Approximate water density for weight ↔ volume when no food-specific density exists. */
export const GRAMS_PER_ML = 1;

export type LogFoodUnitCategory = 'weight' | 'volume' | 'count';

/** Macros + the portion amount they were captured for. */
export interface LogFoodPortionBasis {
  snapshot: MacroMicroSnapshot;
  baseServingSize: number;
  servings: number;
  servingUnit: LogFoodServingUnit;
  /** Gram weight of one count/piece when known (USDA portion, label, scan). */
  referenceGramsPerPiece?: number;
}

export function logFoodUnitCategory(unit: LogFoodServingUnit): LogFoodUnitCategory {
  switch (unit) {
    case 'g':
    case 'oz':
      return 'weight';
    case 'ml':
    case 'fl_oz':
    case 'cup':
    case 'tbsp':
    case 'tsp':
      return 'volume';
    case 'piece':
      return 'count';
    default:
      return 'count';
  }
}

export function logFoodUnitsAreCompatible(a: LogFoodServingUnit, b: LogFoodServingUnit): boolean {
  if (a === b) return true;
  return logFoodUnitCategory(a) === logFoodUnitCategory(b);
}

export function parseLogFoodPortionAmount(raw: string | number | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : 1;
  const n = parseFloat(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function logFoodTotalPortionAmount(basis: Pick<LogFoodPortionBasis, 'baseServingSize' | 'servings'>): number {
  return parseLogFoodPortionAmount(basis.baseServingSize) * parseLogFoodPortionAmount(basis.servings);
}

/** Convert a weight amount to grams. */
export function logFoodWeightToGrams(amount: number, unit: LogFoodServingUnit): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  switch (unit) {
    case 'g':
      return amount;
    case 'oz':
      return amount * GRAMS_PER_OZ;
    default:
      return null;
  }
}

/** Convert grams to a weight unit amount. */
export function logFoodGramsToWeight(grams: number, unit: LogFoodServingUnit): number | null {
  if (!Number.isFinite(grams) || grams <= 0) return null;
  switch (unit) {
    case 'g':
      return grams;
    case 'oz':
      return grams / GRAMS_PER_OZ;
    default:
      return null;
  }
}

/** Convert a volume amount to milliliters. */
export function logFoodVolumeToMl(amount: number, unit: LogFoodServingUnit): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  switch (unit) {
    case 'ml':
      return amount;
    case 'fl_oz':
      return amount * ML_PER_FL_OZ;
    case 'cup':
      return amount * ML_PER_CUP;
    case 'tbsp':
      return amount * ML_PER_TBSP;
    case 'tsp':
      return amount * ML_PER_TSP;
    default:
      return null;
  }
}

/** Convert milliliters to a volume unit amount. */
export function logFoodMlToVolume(ml: number, unit: LogFoodServingUnit): number | null {
  if (!Number.isFinite(ml) || ml <= 0) return null;
  switch (unit) {
    case 'ml':
      return ml;
    case 'fl_oz':
      return ml / ML_PER_FL_OZ;
    case 'cup':
      return ml / ML_PER_CUP;
    case 'tbsp':
      return ml / ML_PER_TBSP;
    case 'tsp':
      return ml / ML_PER_TSP;
    default:
      return null;
  }
}

/**
 * @deprecated Prefer category-specific helpers. Kept for callers that expect a single mass-like scalar.
 */
export function logFoodAmountToGrams(amount: number, unit: LogFoodServingUnit): number | null {
  const cat = logFoodUnitCategory(unit);
  if (cat === 'weight') return logFoodWeightToGrams(amount, unit);
  if (cat === 'volume') {
    const ml = logFoodVolumeToMl(amount, unit);
    return ml != null ? ml * GRAMS_PER_ML : null;
  }
  return null;
}

/** Convert between units within the same category (weight↔weight, volume↔volume). */
export function convertLogFoodAmountBetweenUnits(
  amount: number,
  from: LogFoodServingUnit,
  to: LogFoodServingUnit
): number | null {
  if (from === to) return amount;
  if (!logFoodUnitsAreCompatible(from, to)) return null;

  const cat = logFoodUnitCategory(from);
  if (cat === 'weight') {
    const grams = logFoodWeightToGrams(amount, from);
    return grams != null ? logFoodGramsToWeight(grams, to) : null;
  }
  if (cat === 'volume') {
    const ml = logFoodVolumeToMl(amount, from);
    return ml != null ? logFoodMlToVolume(ml, to) : null;
  }
  return null;
}

/**
 * Convert a portion amount between any units when the physical quantity can be preserved
 * (weight↔weight, volume↔volume, and cross-category via g/ml bridge or piece reference weight).
 */
export function convertLogFoodPortionAmountAcrossUnits(
  amount: number,
  from: LogFoodServingUnit,
  to: LogFoodServingUnit,
  referenceGramsPerPiece?: number
): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (from === to) return amount;

  if (logFoodUnitsAreCompatible(from, to)) {
    return convertLogFoodAmountBetweenUnits(amount, from, to);
  }

  const grams = totalWeightGrams(amount, from, referenceGramsPerPiece);
  if (grams == null || grams <= 0) return null;

  const toCat = logFoodUnitCategory(to);
  if (toCat === 'weight') {
    return logFoodGramsToWeight(grams, to);
  }
  if (toCat === 'volume') {
    const ml = grams / GRAMS_PER_ML;
    return logFoodMlToVolume(ml, to);
  }
  if (toCat === 'count') {
    if (referenceGramsPerPiece != null && referenceGramsPerPiece > 0) {
      return grams / referenceGramsPerPiece;
    }
    // Treat the full portion as one piece and remember its gram weight for later conversions.
    const fromCat = logFoodUnitCategory(from);
    if (fromCat === 'weight' || fromCat === 'volume') {
      return 1;
    }
    return null;
  }
  return null;
}

/** Convert total logged portion (base × servings) to a new unit; returns new base amount. */
export function convertLogFoodBaseServingForUnitChange(
  baseServingSize: string | number,
  servings: string | number,
  from: LogFoodServingUnit,
  to: LogFoodServingUnit,
  referenceGramsPerPiece?: number
): { baseServingSize: string; converted: boolean } {
  const servingsN = parseLogFoodPortionAmount(servings);
  const totalAmount = parseLogFoodPortionAmount(baseServingSize) * servingsN;
  const convertedTotal = convertLogFoodPortionAmountAcrossUnits(
    totalAmount,
    from,
    to,
    referenceGramsPerPiece
  );
  if (convertedTotal == null) {
    return { baseServingSize: '1', converted: false };
  }
  const nextBase = convertedTotal / servingsN;
  return {
    baseServingSize: formatLogFoodPortionAmount(nextBase, to),
    converted: true,
  };
}

export function formatLogFoodPortionAmount(n: number, unit?: LogFoodServingUnit): string {
  if (!Number.isFinite(n) || n <= 0) return '1';
  if (Math.abs(n - Math.round(n)) < 0.0005) return String(Math.round(n));
  if (unit === 'oz' || unit === 'fl_oz') return String(Math.round(n * 100) / 100);
  if (n < 10) return String(Math.round(n * 100) / 100);
  return String(Math.round(n * 10) / 10);
}

export function logFoodPortionHasMacros(basis: LogFoodPortionBasis): boolean {
  const { protein, carbs, fat } = basis.snapshot;
  return protein + carbs + fat > 0;
}

function totalWeightGrams(
  totalAmount: number,
  unit: LogFoodServingUnit,
  referenceGramsPerPiece?: number
): number | null {
  const cat = logFoodUnitCategory(unit);
  if (cat === 'weight') return logFoodWeightToGrams(totalAmount, unit);
  if (cat === 'volume') {
    const ml = logFoodVolumeToMl(totalAmount, unit);
    return ml != null ? ml * GRAMS_PER_ML : null;
  }
  if (cat === 'count' && referenceGramsPerPiece != null && referenceGramsPerPiece > 0) {
    return totalAmount * referenceGramsPerPiece;
  }
  return null;
}

/** Scale factor from basis portion to a new portion. */
export function computeLogFoodPortionScaleFactor(
  basis: LogFoodPortionBasis,
  next: Pick<LogFoodPortionBasis, 'baseServingSize' | 'servings' | 'servingUnit'>,
  nextReferenceGramsPerPiece?: number
): number | null {
  const basisTotal = logFoodTotalPortionAmount(basis);
  const nextTotal = logFoodTotalPortionAmount(next);
  if (basisTotal <= 0 || nextTotal <= 0) return null;

  const basisCat = logFoodUnitCategory(basis.servingUnit);
  const nextCat = logFoodUnitCategory(next.servingUnit);
  const refBasis = basis.referenceGramsPerPiece;
  const refNext = nextReferenceGramsPerPiece ?? refBasis;

  // Same category — convert within weight or volume.
  if (basisCat === nextCat && basisCat !== 'count') {
    if (basisCat === 'weight') {
      const b = logFoodWeightToGrams(basisTotal, basis.servingUnit);
      const n = logFoodWeightToGrams(nextTotal, next.servingUnit);
      if (b != null && n != null && b > 0) return n / b;
    }
    if (basisCat === 'volume') {
      const b = logFoodVolumeToMl(basisTotal, basis.servingUnit);
      const n = logFoodVolumeToMl(nextTotal, next.servingUnit);
      if (b != null && n != null && b > 0) return n / b;
    }
  }

  // Countable pieces — ratio only when still in pieces.
  if (basisCat === 'count' && nextCat === 'count') {
    return nextTotal / basisTotal;
  }

  // Cross-category via known piece weight or water-density weight↔volume.
  const basisGrams = totalWeightGrams(basisTotal, basis.servingUnit, refBasis);
  const nextGrams = totalWeightGrams(nextTotal, next.servingUnit, refNext);
  if (basisGrams != null && nextGrams != null && basisGrams > 0) {
    return nextGrams / basisGrams;
  }

  return null;
}

export function buildLogFoodPortionBasis(input: {
  protein: string;
  carbs: string;
  fat: string;
  calories: string;
  micronutrients?: Record<string, number | undefined | null> | undefined;
  baseServingSize: string;
  servings: string;
  servingUnit: LogFoodServingUnit;
  referenceGramsPerPiece?: number;
}): LogFoodPortionBasis {
  return {
    snapshot: macroSnapshotFromMealInputStrings({
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
      calories: input.calories,
      micronutrients: input.micronutrients,
    }),
    baseServingSize: parseLogFoodPortionAmount(input.baseServingSize),
    servings: parseLogFoodPortionAmount(input.servings),
    servingUnit: input.servingUnit,
    referenceGramsPerPiece:
      input.referenceGramsPerPiece != null &&
      Number.isFinite(input.referenceGramsPerPiece) &&
      input.referenceGramsPerPiece > 0
        ? input.referenceGramsPerPiece
        : undefined,
  };
}

export function scaleLogFoodPortionBasis(
  basis: LogFoodPortionBasis,
  next: Pick<LogFoodPortionBasis, 'baseServingSize' | 'servings' | 'servingUnit'>,
  nextReferenceGramsPerPiece?: number
): MacroMicroSnapshot | null {
  if (!logFoodPortionHasMacros(basis)) return null;
  const factor = computeLogFoodPortionScaleFactor(basis, next, nextReferenceGramsPerPiece);
  if (factor == null || !Number.isFinite(factor) || factor <= 0) return null;
  return scaleMacroSnapshot(basis.snapshot, factor);
}

/** Infer grams-per-piece from a weight-based portion when switching to count. */
export function inferReferenceGramsPerPiece(
  totalAmount: number,
  unit: LogFoodServingUnit,
  totalGrams: number
): number | null {
  if (unit !== 'g' && unit !== 'oz') return null;
  if (totalAmount <= 0 || totalGrams <= 0) return null;
  const grams = logFoodWeightToGrams(totalAmount, unit);
  if (grams == null || grams <= 0) return null;
  return grams / totalAmount;
}

import type { Food } from '../types/fdcApi';
import { buildPortionOptions } from './fdcPortions';
import type { MacroMicroSnapshot, NaturalPortionReference } from '../types/portionInput';

/** Common fraction presets for sliders / chips. */
export const NATURAL_FRACTION_PRESETS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1] as const;

const WHOLE_FOOD_KEYWORDS =
  /\b(banana|apple|avocado|orange|pear|peach|plum|kiwi|mango|egg|eggs|tomato|potato|onion|carrot|cucumber|pepper|lemon|lime|nectarine|apricot|melon|berries|berry|grape|grapes|slice|medium|large|small|whole)\b/i;

const POOR_NATURAL_CANDIDATES =
  /\b(rice|pasta|oil|juice|milk|water|soup|sauce|flour|sugar|salt|cereal|oatmeal|mixed|stew|smoothie|shake|powder|ground)\b/i;

/** Fine step for optional decimal control (e.g. slider). */
export const NATURAL_FRACTION_FINE_STEP = 0.05;

/** Clamp fraction to a sane logging range. */
export function clampNaturalFraction(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(2, Math.max(0.05, Math.round(n * 1000) / 1000));
}

/** Greatest common divisor for reduced fractions. */
function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Format a decimal as a human-friendly fraction + noun, e.g. `0.75` + "banana" → "3/4 banana".
 */
export function formatHumanFraction(decimal: number, wholeName: string): string {
  const f = clampNaturalFraction(decimal);
  const name = wholeName.trim() || 'item';
  const tol = 0.02;
  const pairs: [number, string][] = [
    [0.25, '1/4'],
    [1 / 3, '1/3'],
    [0.5, '1/2'],
    [2 / 3, '2/3'],
    [0.75, '3/4'],
    [1, '1'],
  ];
  for (const [v, label] of pairs) {
    if (Math.abs(f - v) < tol) {
      return `${label} ${name}`.trim();
    }
  }
  if (Math.abs(f - Math.round(f)) < tol && f >= 1) {
    return `${Math.round(f)} ${name}`.trim();
  }
  const frac = approximateFraction(f, 16);
  if (frac) {
    return `${frac} ${name}`.trim();
  }
  return `${f} ${name}`.trim();
}

function approximateFraction(x: number, maxDen = 16): string | null {
  if (x <= 0 || x > 2) return null;
  let bestNum = 1;
  let bestDen = 1;
  let bestErr = Infinity;
  for (let den = 1; den <= maxDen; den++) {
    const num = Math.round(x * den);
    const err = Math.abs(x - num / den);
    if (err < bestErr) {
      bestErr = err;
      bestNum = num;
      bestDen = den;
    }
  }
  if (bestErr > 0.06) return null;
  const g = gcd(bestNum, bestDen);
  const n = bestNum / g;
  const d = bestDen / g;
  if (d === 1) return `${n}`;
  return `${n}/${d}`;
}

/**
 * Scale protein / carbs / fat / calories by one factor (e.g. fraction of a whole).
 */
export function scaleMacroSnapshot(base: MacroMicroSnapshot, factor: number): MacroMicroSnapshot {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return {
    protein: Math.round(base.protein * f * 10) / 10,
    carbs: Math.round(base.carbs * f * 10) / 10,
    fat: Math.round(base.fat * f * 10) / 10,
    calories: Math.round(base.calories * f),
    micronutrients: scaleMicronutrientLikeRecord(base.micronutrients, f),
  };
}

export function scaleMicronutrientLikeRecord(
  micros: Record<string, number | undefined | null> | undefined,
  factor: number
): Record<string, number | undefined | null> | undefined {
  if (!micros) return undefined;
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const out: Record<string, number | undefined | null> = {};
  for (const [k, v] of Object.entries(micros)) {
    if (v == null || !Number.isFinite(v)) {
      out[k] = v as undefined | null;
      continue;
    }
    const scaled = v * f;
    out[k] = Math.abs(scaled - Math.round(scaled)) < 0.0001 ? Math.round(scaled) : Math.round(scaled * 1000) / 1000;
  }
  return out;
}

/** Calories from macros (4/4/9 rule). */
export function caloriesFromMacros(p: number, c: number, fat: number): number {
  return Math.round(p * 4 + c * 4 + fat * 9);
}

/**
 * Build a snapshot from current string inputs (Log Food form) + optional micros.
 */
export function macroSnapshotFromMealInputStrings(input: {
  protein: string;
  carbs: string;
  fat: string;
  calories: string;
  micronutrients?: Record<string, number | undefined | null> | undefined;
}): MacroMicroSnapshot {
  const protein = parseFloat(String(input.protein).replace(/,/g, '')) || 0;
  const carbs = parseFloat(String(input.carbs).replace(/,/g, '')) || 0;
  const fat = parseFloat(String(input.fat).replace(/,/g, '')) || 0;
  let calories = parseFloat(String(input.calories).replace(/,/g, '')) || 0;
  if (!Number.isFinite(calories) || calories <= 0) {
    calories = caloriesFromMacros(protein, carbs, fat);
  }
  return {
    protein,
    carbs,
    fat,
    calories,
    micronutrients: input.micronutrients ? { ...input.micronutrients } : undefined,
  };
}

/**
 * Heuristic: should we surface “simple / whole” mode for this food name?
 */
export function shouldOfferSimplePortionMode(mealName: string): boolean {
  const n = mealName.trim();
  if (n.length < 2) return false;
  if (POOR_NATURAL_CANDIDATES.test(n)) return false;
  return WHOLE_FOOD_KEYWORDS.test(n);
}

/**
 * Derive a short noun for labels from a free-text meal name (best-effort).
 */
export function inferDisplayWholeName(mealName: string): string {
  const raw = mealName.trim();
  if (!raw) return 'item';
  const cleaned = raw.replace(/^[\d./\s]+/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'item';
  const last = parts[parts.length - 1].toLowerCase();
  if (last === 'eggs') return 'eggs';
  if (last.endsWith('s') && last.length > 3 && !last.endsWith('ss')) {
    return last;
  }
  return last;
}

/**
 * Pick the best FDC portion row that looks like a countable whole (egg, banana, etc.).
 */
export function inferNaturalReferenceFromFood(food: Food | null | undefined): NaturalPortionReference | null {
  if (!food) return null;
  const opts = buildPortionOptions(food);
  if (!opts.length) return null;
  const preferWhole =
    /\b(egg|banana|apple|avocado|orange|tomato|potato|onion|carrot|pepper|pear|peach|kiwi|unit|piece|slice|fruit|medium|large|small)\b/i;
  const scored = opts
    .filter((o) => o.gramWeight > 0 && o.gramWeight < 900)
    .map((o) => {
      let score = 0;
      const lab = o.label.toLowerCase();
      if (preferWhole.test(lab)) score += 4;
      if (/\b1\b/.test(lab)) score += 1;
      if (lab.includes('g')) score -= 1;
      return { o, score };
    })
    .sort((a, b) => b.score - a.score);
  const best = scored[0]?.o;
  if (!best) return null;
  const displayWholeName = inferDisplayWholeName(best.label.replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim());
  return {
    referenceGrams: best.gramWeight,
    displayWholeName: displayWholeName || inferDisplayWholeName(food.description ?? ''),
    portionKey: best.key,
  };
}

/**
 * Convert grams consumed to an equivalent fraction of `referenceGrams` (whole = 1).
 */
export function fractionFromGrams(consumedGrams: number, referenceGrams: number): number {
  const g = Number.isFinite(consumedGrams) && consumedGrams > 0 ? consumedGrams : 0;
  const r = Number.isFinite(referenceGrams) && referenceGrams > 0 ? referenceGrams : 0;
  if (r <= 0) return 1;
  return clampNaturalFraction(g / r);
}

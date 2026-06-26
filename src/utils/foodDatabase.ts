import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchFdcMicronutrientGapFill } from './fdcLabelNutrients';
import { hasNutritionixCredentials, lookupBarcodeNutritionix } from '../services/NutritionService';

export interface Micronutrients {
  fiber?: number;
  sugar?: number;
  sodium?: number;
  calcium?: number;
  iron?: number;
  potassium?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
  vitaminE?: number;
  vitaminK?: number;
  thiamin?: number;
  riboflavin?: number;
  niacin?: number;
  vitaminB6?: number;
  folate?: number;
  vitaminB12?: number;
  biotin?: number;
  pantothenicAcid?: number;
  phosphorus?: number;
  iodine?: number;
  magnesium?: number;
  zinc?: number;
  selenium?: number;
  copper?: number;
  manganese?: number;
  chromium?: number;
  molybdenum?: number;
  chloride?: number;
}

/** How macros were derived from Open Food Facts (for debugging / future UI). */
export type NutritionBasis = 'label_serving' | 'scaled_from_100g' | 'per_100g_fallback';

export interface ScannedFood {
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  barcode: string;
  micronutrients?: Micronutrients;
  /** Unit shown in Log Food (prefer `g` when label serving is known in grams). */
  servingUnit?: 'piece' | 'g' | 'oz' | 'fl_oz' | 'cup' | 'ml' | 'tbsp' | 'tsp';
  /** Grams (or ml treated as g) for one label serving — used with `g` unit. */
  servingWeight?: number;
  /** One label serving = 1 base unit in the logger. */
  baseServingSize?: number;
  /** Grams that the returned P/C/F/calories refer to (set Log Food “Serving size” to this when unit is g). */
  referenceGrams?: number;
  /** Short note e.g. scaled from per 100 g using 42 g serving. */
  nutritionNote?: string;
  nutritionBasis?: NutritionBasis;
}

/** v6: USDA FDC labelNutrients fill when OFF omits iron/potassium etc. */
const CACHE_PREFIX = 'FOOD_CACHE_v6_';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/** Open Food Facts asks for a descriptive User-Agent (app + contact). */
const OPEN_FOOD_FACTS_USER_AGENT =
  'TYLAI/1.0 (iOS+Android; com.tyl-ai.tylai; contact:https://github.com/tyl-ai)';

interface OpenFoodFactsResponse {
  status: number;
  product?: any;
}

function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

/**
 * Parse label serving mass in grams from OFF fields.
 * Prefers explicit quantity+unit, then parenthetical "(42 g)", then a sensible "X g" match.
 */
function extractServingGrams(product: any): number | null {
  const unitRaw = product?.serving_quantity_unit;
  const qty = product?.serving_quantity;
  if (qty != null && unitRaw != null) {
    const u = String(unitRaw).toLowerCase().trim();
    const q = parseFloat(String(qty).replace(',', '.'));
    if (Number.isFinite(q) && q > 0) {
      if (u === 'g' || u === 'gram' || u === 'grams') return q;
      if (u === 'mg' && q > 0) return q / 1000;
      if (u === 'kg' && q > 0) return q * 1000;
      if (u === 'oz' || u === 'ounce' || u === 'ounces') return q * 28.349523125;
      if (u === 'ml' || u === 'milliliters' || u === 'milliliter') return q;
    }
  }

  const raw = product?.serving_size;
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  const parenG = s.match(/\(\s*(\d+(?:[.,]\d+)?)\s*(g|grams?)\s*\)/i);
  if (parenG) {
    const v = parseFloat(parenG[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0 && v < 2000) return v;
  }

  const parenMl = s.match(/\(\s*(\d+(?:[.,]\d+)?)\s*m[lL]\s*\)/);
  if (parenMl) {
    const v = parseFloat(parenMl[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0 && v < 5000) return v;
  }

  const gramMatches = [...s.matchAll(/(\d+(?:[.,]\d+)?)\s*(g|grams?)\b/gi)];
  const gramVals: number[] = [];
  for (const m of gramMatches) {
    const v = parseFloat(m[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0 && v < 2000) gramVals.push(v);
  }
  if (gramVals.length === 0) return null;
  if (gramVals.length === 1) return gramVals[0];

  // Prefer a typical single-eat portion (candy/snack bar) over whole-pack grams when both appear.
  const snackBand = gramVals.filter((g) => g >= 8 && g <= 120);
  if (snackBand.length) return Math.min(...snackBand);

  const mealBand = gramVals.filter((g) => g > 120 && g <= 500);
  if (mealBand.length) return Math.min(...mealBand);

  const any = gramVals.filter((g) => g >= 2 && g <= 500);
  if (any.length) return Math.min(...any);

  return gramVals[0];
}

/** Read OFF nutriments without rounding tiny values to 0 (critical for iron, zinc, etc.). */
function readNutriment(nutriments: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = nutriments[k];
    if (v === undefined || v === null || v === '') continue;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) continue;
    return n;
  }
  return undefined;
}

function formatMicroScalar(s: number): number {
  if (!Number.isFinite(s) || s <= 0) return s;
  const a = Math.abs(s);
  if (a < 0.001) return Math.round(s * 1e6) / 1e6;
  if (a < 0.01) return Math.round(s * 1e5) / 1e5;
  if (a < 1) return Math.round(s * 1000) / 1000;
  if (a < 100) return Math.round(s * 100) / 100;
  return Math.round(s * 10) / 10;
}

/** OFF often stores trace minerals in g/100g; US labels use mg — convert when value is clearly in grams. */
function normalizeTraceMineralToLabelMg(field: string, value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined;
  /** Values this small are usually OFF grams mis-read as mg; avoid catching common sub-0.05 mg label amounts. */
  if (['iron', 'zinc', 'copper', 'manganese'].includes(field) && value < 0.025) {
    return formatMicroScalar(value * 1000);
  }
  return formatMicroScalar(value);
}

function scaleFrom100g(per100: number | undefined, servingGrams: number): number | undefined {
  if (per100 === undefined || per100 <= 0 || servingGrams <= 0) return undefined;
  return (per100 * servingGrams) / 100;
}

/**
 * Open Food Facts often has only per-100 g data with no serving_size (e.g. Twizzlers Bunnies UPC 034000564538).
 * Infer grams for one typical US snack serving from common label calories vs energy-kcal_100g.
 */
function inferServingGramsFromPer100Kcal(kcalPer100g: number): number | null {
  if (!Number.isFinite(kcalPer100g) || kcalPer100g < 220 || kcalPer100g > 620) return null;
  const servingKcalCandidates = [
    50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 220, 230, 250,
  ];
  let best: number | null = null;
  let bestScore = 1e9;
  for (const sk of servingKcalCandidates) {
    const g = (sk * 100) / kcalPer100g;
    if (g < 8 || g > 95) continue;
    const rounded = Math.round(g);
    const grain = Math.abs(g - rounded);
    const pref = Math.abs(sk - 100) * 0.012;
    const score = grain + pref;
    if (score < bestScore) {
      bestScore = score;
      best = g;
    }
  }
  if (best == null) return null;
  return Math.round(best * 10) / 10;
}

/** OFF often copies per-100 g values into *_serving for small portions (candy, bars). */
function nutrimentsServingLooksLikePer100gCopy(
  nutriments: Record<string, unknown>,
  servingGrams: number | null
): boolean {
  if (!servingGrams || servingGrams >= 130) return false;
  const pS = readNutriment(nutriments, ['proteins_serving', 'protein_serving']);
  const p100 = readNutriment(nutriments, ['proteins_100g']);
  if (pS != null && p100 != null && Math.abs(pS - p100) < 0.35) return true;
  const cS = readNutriment(nutriments, ['carbohydrates_serving']);
  const c100 = readNutriment(nutriments, ['carbohydrates_100g']);
  if (cS != null && c100 != null && Math.abs(cS - c100) < 0.6) return true;
  const fS = readNutriment(nutriments, ['fat_serving']);
  const f100 = readNutriment(nutriments, ['fat_100g']);
  if (fS != null && f100 != null && Math.abs(fS - f100) < 0.35) return true;
  const kS = readNutriment(nutriments, ['energy-kcal_serving', 'energy_kcal_serving', 'energy-kcal_value_serving']);
  const k100 = readNutriment(nutriments, ['energy-kcal_100g', 'energy_kcal_100g', 'energy-kcal_value_100g']);
  if (kS != null && k100 != null && k100 > 0 && Math.abs(kS - k100) <= Math.max(12, k100 * 0.08)) return true;
  return false;
}

function parseNutriments(product: any): Omit<ScannedFood, 'barcode'> | null {
  if (!product) return null;

  const name: string = product.product_name || product.generic_name || 'Unknown Item';
  const brand: string | undefined = product.brands || product.brand_owner || undefined;
  const nutriments = (product.nutriments || {}) as Record<string, unknown>;
  const dataPer = String(product?.nutrition_data_per ?? '').toLowerCase();

  let servingGrams = extractServingGrams(product);
  let servingGramsInferred = false;

  const kcalServing = readNutriment(nutriments, [
    'energy-kcal_serving',
    'energy_kcal_serving',
    'energy-kcal_value_serving',
  ]);
  const proteinServing = readNutriment(nutriments, ['proteins_serving', 'protein_serving']);
  const carbsServing = readNutriment(nutriments, ['carbohydrates_serving', 'carbohydrate_serving']);
  const fatServing = readNutriment(nutriments, ['fat_serving', 'fats_serving']);

  const kcal100 =
    readNutriment(nutriments, ['energy-kcal_100g', 'energy_kcal_100g', 'energy-kcal_value_100g']) ??
    (dataPer.includes('100') ? readNutriment(nutriments, ['energy-kcal', 'energy_kcal']) : undefined);
  const protein100 =
    readNutriment(nutriments, ['proteins_100g']) ??
    (dataPer.includes('100') ? readNutriment(nutriments, ['proteins']) : undefined);
  const carbs100 =
    readNutriment(nutriments, ['carbohydrates_100g']) ??
    (dataPer.includes('100') ? readNutriment(nutriments, ['carbohydrates']) : undefined);
  const fat100 =
    readNutriment(nutriments, ['fat_100g']) ?? (dataPer.includes('100') ? readNutriment(nutriments, ['fat']) : undefined);

  const energyKj100 = readNutriment(nutriments, ['energy_100g', 'energy-kj_100g']);
  const kcalFromKj100 = !kcal100 && energyKj100 && energyKj100 > 0 ? energyKj100 / 4.184 : undefined;
  const kcal100Effective = kcal100 ?? kcalFromKj100;

  if (servingGrams == null && kcal100Effective != null && kcal100Effective > 0) {
    const inferred = inferServingGramsFromPer100Kcal(kcal100Effective);
    if (inferred != null) {
      servingGrams = inferred;
      servingGramsInferred = true;
    }
  }

  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let nutritionBasis: NutritionBasis = 'label_serving';
  let nutritionNote: string | undefined;

  let hasExplicitServingMacros =
    (kcalServing != null && kcalServing > 0) ||
    (proteinServing != null && proteinServing > 0) ||
    (carbsServing != null && carbsServing > 0) ||
    (fatServing != null && fatServing > 0);

  if (dataPer.includes('100') && servingGrams != null && servingGrams > 0) {
    hasExplicitServingMacros = false;
  }
  if (nutrimentsServingLooksLikePer100gCopy(nutriments, servingGrams)) {
    hasExplicitServingMacros = false;
  }

  if (hasExplicitServingMacros) {
    nutritionBasis = 'label_serving';
    calories = kcalServing != null && kcalServing > 0 ? kcalServing : 0;
    protein = proteinServing != null && proteinServing > 0 ? proteinServing : 0;
    carbs = carbsServing != null && carbsServing > 0 ? carbsServing : 0;
    fat = fatServing != null && fatServing > 0 ? fatServing : 0;

    if (calories <= 0 && servingGrams) {
      const scaledK = scaleFrom100g(kcal100Effective, servingGrams);
      if (scaledK) calories = scaledK;
    }
    if (calories <= 0) {
      const kjServing = readNutriment(nutriments, ['energy_serving', 'energy-kj_serving', 'energy_serving']);
      if (kjServing != null && kjServing > 0) calories = kjServing / 4.184;
    }

    if (protein <= 0 && protein100 != null && servingGrams) {
      const s = scaleFrom100g(protein100, servingGrams);
      if (s) protein = s;
    }
    if (carbs <= 0 && carbs100 != null && servingGrams) {
      const s = scaleFrom100g(carbs100, servingGrams);
      if (s) carbs = s;
    }
    if (fat <= 0 && fat100 != null && servingGrams) {
      const s = scaleFrom100g(fat100, servingGrams);
      if (s) fat = s;
    }

    if (calories <= 0 && (protein > 0 || carbs > 0 || fat > 0)) {
      calories = Math.round(protein * 4 + carbs * 4 + fat * 9);
    }
  } else if (servingGrams && (kcal100Effective || protein100 || carbs100 || fat100)) {
    const c = scaleFrom100g(kcal100Effective, servingGrams) ?? 0;
    const p = scaleFrom100g(protein100, servingGrams) ?? 0;
    const ch = scaleFrom100g(carbs100, servingGrams) ?? 0;
    const f = scaleFrom100g(fat100, servingGrams) ?? 0;
    calories = c > 0 ? c : Math.round(p * 4 + ch * 4 + f * 9);
    protein = p;
    carbs = ch;
    fat = f;
    nutritionBasis = 'scaled_from_100g';
    nutritionNote = servingGramsInferred
      ? `Estimated ~${Math.round(servingGrams)} g per serving (Open Food Facts had no serving size; matched typical US snack calories vs per 100 g). Confirm on your package (e.g. 16 pieces ≈ 30 g).`
      : `Per label serving (~${Math.round(servingGrams)} g), scaled from per 100 g data.`;
  } else {
    calories = toNum(kcal100Effective ?? 0);
    protein = toNum(protein100 ?? 0);
    carbs = toNum(carbs100 ?? 0);
    fat = toNum(fat100 ?? 0);
    nutritionBasis = 'per_100g_fallback';
    nutritionNote =
      'Macros shown per 100 g (label serving size unclear). Adjust serving size in Log Food to match your package.';
  }

  const servingSizeLabel: string =
    typeof product.serving_size === 'string' && product.serving_size.trim()
      ? product.serving_size.trim()
      : servingGrams
        ? servingGramsInferred
          ? `~${Math.round(servingGrams)} g (estimated serving — check package)`
          : `1 serving (~${Math.round(servingGrams)} g)`
        : '100 g (typical label basis)';

  const getMicro = (fieldId: string, base: string, alt: string[] = []): number | undefined => {
    const names = [base, ...alt];
    for (const b of names) {
      const sv = readNutriment(nutriments, [`${b}_serving`]);
      if (sv != null && sv > 0) return normalizeTraceMineralToLabelMg(fieldId, formatMicroScalar(sv));
    }
    for (const b of names) {
      const p100 = readNutriment(nutriments, [`${b}_100g`, b]);
      if (p100 == null || p100 <= 0) continue;
      if (nutritionBasis === 'scaled_from_100g' && servingGrams) {
        const s = scaleFrom100g(p100, servingGrams);
        if (s != null && s > 0) return normalizeTraceMineralToLabelMg(fieldId, s);
      }
      if (nutritionBasis === 'per_100g_fallback') return normalizeTraceMineralToLabelMg(fieldId, p100);
      if (nutritionBasis === 'label_serving' && servingGrams) {
        const s = scaleFrom100g(p100, servingGrams);
        if (s != null && s > 0) return normalizeTraceMineralToLabelMg(fieldId, s);
      }
    }
    return undefined;
  };

  const micronutrients: Micronutrients = {
    fiber: getMicro('fiber', 'fiber'),
    sugar: getMicro('sugar', 'sugars', ['sugars-value', 'sugar']),
    sodium: getMicro('sodium', 'sodium'),
    calcium: getMicro('calcium', 'calcium'),
    iron: getMicro('iron', 'iron'),
    potassium: getMicro('potassium', 'potassium'),
    vitaminA: getMicro('vitaminA', 'vitamin-a'),
    vitaminC: getMicro('vitaminC', 'vitamin-c'),
    vitaminD: getMicro('vitaminD', 'vitamin-d'),
    vitaminE: getMicro('vitaminE', 'vitamin-e'),
    vitaminK: getMicro('vitaminK', 'vitamin-k'),
    thiamin: getMicro('thiamin', 'thiamin', ['vitamin-b1']),
    riboflavin: getMicro('riboflavin', 'riboflavin', ['vitamin-b2']),
    niacin: getMicro('niacin', 'niacin', ['vitamin-b3']),
    vitaminB6: getMicro('vitaminB6', 'vitamin-b6'),
    folate: getMicro('folate', 'folate', ['folic-acid']),
    vitaminB12: getMicro('vitaminB12', 'vitamin-b12'),
    biotin: getMicro('biotin', 'biotin'),
    pantothenicAcid: getMicro('pantothenicAcid', 'pantothenic-acid', ['vitamin-b5']),
    phosphorus: getMicro('phosphorus', 'phosphorus'),
    iodine: getMicro('iodine', 'iodine'),
    magnesium: getMicro('magnesium', 'magnesium'),
    zinc: getMicro('zinc', 'zinc'),
    selenium: getMicro('selenium', 'selenium'),
    copper: getMicro('copper', 'copper'),
    manganese: getMicro('manganese', 'manganese'),
    chromium: getMicro('chromium', 'chromium'),
    molybdenum: getMicro('molybdenum', 'molybdenum'),
    chloride: getMicro('chloride', 'chloride'),
  };

  const hasMicronutrients = Object.values(micronutrients).some((v) => v !== undefined);

  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) {
    return null;
  }

  const out: Omit<ScannedFood, 'barcode'> = {
    name,
    brand,
    calories: Math.max(0, Math.round(calories)),
    protein: Math.max(0, Math.round(protein * 10) / 10),
    carbs: Math.max(0, Math.round(carbs * 10) / 10),
    fat: Math.max(0, Math.round(fat * 10) / 10),
    servingSize: servingSizeLabel,
    ...(hasMicronutrients && { micronutrients }),
    nutritionBasis,
    ...(nutritionNote && { nutritionNote }),
  };

  const referenceGrams: number | null =
    servingGrams != null && servingGrams > 0
      ? Math.round(servingGrams * 10) / 10
      : nutritionBasis === 'per_100g_fallback'
        ? 100
        : null;

  if (referenceGrams != null && referenceGrams > 0) {
    out.referenceGrams = referenceGrams;
    out.servingUnit = 'g';
    out.servingWeight = referenceGrams;
    out.baseServingSize = referenceGrams;
  }

  return out;
}

async function readCache(barcode: string): Promise<ScannedFood | null> {
  try {
    const key = `${CACHE_PREFIX}${barcode}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.data as ScannedFood;
  } catch {
    return null;
  }
}

async function writeCache(barcode: string, data: ScannedFood): Promise<void> {
  try {
    const key = `${CACHE_PREFIX}${barcode}`;
    await AsyncStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

function mergeMicronutrientGaps(
  base: Micronutrients | undefined,
  fill: Partial<Micronutrients>
): Micronutrients | undefined {
  const fillKeys = Object.keys(fill) as (keyof Micronutrients)[];
  if (!fillKeys.length && !base) return undefined;
  const out: Micronutrients = { ...(base || {}) };
  for (const k of fillKeys) {
    const v = fill[k];
    if (v === undefined || v === null) continue;
    if (out[k] === undefined || out[k] === null) out[k] = v;
  }
  return Object.values(out).some((x) => x !== undefined && x !== null) ? out : undefined;
}

export function isScannedFoodUsable(food: ScannedFood | null | undefined): boolean {
  if (!food) return false;
  const calories = Number(food.calories) || 0;
  const protein = Number(food.protein) || 0;
  const carbs = Number(food.carbs) || 0;
  const fat = Number(food.fat) || 0;
  return calories > 0 || protein > 0 || carbs > 0 || fat > 0;
}

export async function lookupFoodByBarcode(barcode: string): Promise<ScannedFood | null> {
  const normalized = String(barcode).replace(/\s/g, '').trim();
  if (!normalized) return null;

  const cached = await readCache(normalized);
  if (cached) return cached;

  if (hasNutritionixCredentials()) {
    try {
      const nx = await lookupBarcodeNutritionix(normalized);
      if (nx) {
        let result: ScannedFood = {
          name: nx.name,
          brand: nx.brand,
          calories: nx.calories,
          protein: nx.protein,
          carbs: nx.carbs,
          fat: nx.fat,
          servingSize: nx.servingSize,
          barcode: normalized,
          nutritionBasis: nx.nutritionBasis,
          nutritionNote: nx.nutritionNote,
          ...(nx.referenceGrams != null && nx.referenceGrams > 0
            ? {
                referenceGrams: nx.referenceGrams,
                servingUnit: nx.servingUnit,
                servingWeight: nx.servingWeight,
                baseServingSize: nx.baseServingSize,
              }
            : {}),
        };
        const fdcFill = await fetchFdcMicronutrientGapFill(normalized);
        const mergedMicro = mergeMicronutrientGaps(undefined, fdcFill);
        if (mergedMicro) result = { ...result, micronutrients: mergedMicro };
        await writeCache(normalized, result);
        return result;
      }
    } catch {
      /* fall through to Open Food Facts */
    }
  }

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(normalized)}.json`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': OPEN_FOOD_FACTS_USER_AGENT,
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: OpenFoodFactsResponse = await res.json();
    if (json.status !== 1 || !json.product) return null;

    const parsed = parseNutriments(json.product);
    if (!parsed) return null;

    const result: ScannedFood = { ...parsed, barcode: normalized };

    const fdcFill = await fetchFdcMicronutrientGapFill(normalized);
    const mergedMicro = mergeMicronutrientGaps(parsed.micronutrients, fdcFill);
    if (mergedMicro) {
      result.micronutrients = mergedMicro;
    }

    await writeCache(normalized, result);
    return result;
  } catch (e) {
    return null;
  }
}

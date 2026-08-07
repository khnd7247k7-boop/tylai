import type { Food, FoodNutrient, FoodPortion, FoodSearchHit } from '../types/fdcApi';
import { getProxyBaseUrl, proxyJsonFetch } from '../services/proxyClient';

/** Encode FatSecret food_id as a negative fdcId so USDA cache keys never collide. */
export function fatSecretFoodIdToFdcId(foodId: number | string): number {
  const n = typeof foodId === 'number' ? foodId : parseInt(String(foodId), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return -Math.abs(Math.trunc(n));
}

export function fdcIdToFatSecretFoodId(fdcId: number): number {
  return Math.abs(Math.trunc(fdcId));
}

export function isFatSecretFdcId(fdcId: number | null | undefined): boolean {
  return typeof fdcId === 'number' && Number.isFinite(fdcId) && fdcId < 0;
}

export function mapFatSecretRequestError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message || '';
    if (/503|not configured/i.test(msg)) {
      return 'FatSecret is not configured on the proxy.';
    }
    if (/429|rate limit/i.test(msg)) {
      return 'FatSecret rate limit reached. Please try again later.';
    }
    if (/401|403|invalid token|invalid_client/i.test(msg)) {
      return 'FatSecret authentication failed. Check proxy Client ID/Secret.';
    }
    return msg || 'FatSecret request failed';
  }
  return 'FatSecret request failed';
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

type FsServing = Record<string, unknown>;

function metricGrams(serving: FsServing): number | null {
  const amt = num(serving.metric_serving_amount);
  const unit = str(serving.metric_serving_unit).toLowerCase();
  if (amt == null || amt <= 0) return null;
  if (unit === 'g' || unit === 'gram' || unit === 'grams') return amt;
  if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') return amt * 28.349523125;
  if (unit === 'ml' || unit === 'milliliter' || unit === 'millilitre') return amt;
  return null;
}

function nutrientRow(id: number, name: string, unitName: string, amount: number | null): FoodNutrient | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return {
    nutrientId: id,
    nutrient: { id, name, unitName },
    amount,
  };
}

function macrosToNutrients(macros: {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  sodium?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  potassium?: number | null;
  calcium?: number | null;
  iron?: number | null;
  cholesterol?: number | null;
}): FoodNutrient[] {
  const rows: FoodNutrient[] = [];
  const push = (row: FoodNutrient | null) => {
    if (row) rows.push(row);
  };
  push(nutrientRow(1008, 'Energy', 'KCAL', macros.calories));
  push(nutrientRow(1003, 'Protein', 'G', macros.protein));
  push(nutrientRow(1004, 'Total lipid (fat)', 'G', macros.fat));
  push(nutrientRow(1005, 'Carbohydrate, by difference', 'G', macros.carbs));
  push(nutrientRow(1093, 'Sodium, Na', 'MG', macros.sodium ?? null));
  push(nutrientRow(1079, 'Fiber, total dietary', 'G', macros.fiber ?? null));
  push(nutrientRow(2000, 'Sugars, total including NLEA', 'G', macros.sugar ?? null));
  push(nutrientRow(1092, 'Potassium, K', 'MG', macros.potassium ?? null));
  push(nutrientRow(1087, 'Calcium, Ca', 'MG', macros.calcium ?? null));
  push(nutrientRow(1089, 'Iron, Fe', 'MG', macros.iron ?? null));
  push(nutrientRow(1253, 'Cholesterol', 'MG', macros.cholesterol ?? null));
  return rows;
}

function scaleMacros(serving: FsServing, factor: number) {
  const scale = (v: unknown) => {
    const n = num(v);
    return n == null ? null : n * factor;
  };
  return {
    calories: scale(serving.calories),
    protein: scale(serving.protein),
    fat: scale(serving.fat),
    carbs: scale(serving.carbohydrate),
    sodium: scale(serving.sodium),
    fiber: scale(serving.fiber),
    sugar: scale(serving.sugar),
    potassium: scale(serving.potassium),
    calcium: scale(serving.calcium),
    iron: scale(serving.iron),
    cholesterol: scale(serving.cholesterol),
  };
}

function pickReferenceServing(servings: FsServing[]): FsServing | null {
  if (!servings.length) return null;
  const withGrams = servings.filter((s) => metricGrams(s) != null);
  const hundred = withGrams.find((s) => {
    const g = metricGrams(s);
    return g != null && Math.abs(g - 100) < 0.6;
  });
  if (hundred) return hundred;
  const def = servings.find((s) => String(s.is_default) === '1' || s.is_default === 1);
  if (def && metricGrams(def) != null) return def;
  if (withGrams[0]) return withGrams[0];
  if (def) return def;
  return servings[0];
}

function foodDescription(food: Record<string, unknown>): string {
  const name = str(food.food_name) || 'Unknown food';
  const brand = str(food.brand_name);
  return brand ? `${brand} ${name}` : name;
}

/**
 * Map FatSecret food.get.v2 (or search.v2 food) into the USDA-shaped Food used by portion UI.
 * Nutrients are stored per 100 g when metric grams exist; otherwise per default serving (gramWeight 100 = 1 serving).
 */
export function mapFatSecretFoodToFdcFood(raw: unknown): Food {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const foodObj =
    root.food && typeof root.food === 'object'
      ? (root.food as Record<string, unknown>)
      : root;
  const foodId = num(foodObj.food_id) ?? 0;
  const servingsRaw = foodObj.servings;
  const servingList = asArray(
    servingsRaw && typeof servingsRaw === 'object'
      ? (servingsRaw as { serving?: FsServing | FsServing[] }).serving
      : undefined
  ).filter((s) => s && typeof s === 'object') as FsServing[];

  const ref = pickReferenceServing(servingList);
  const refGrams = ref ? metricGrams(ref) : null;
  let foodNutrients: FoodNutrient[] = [];
  if (ref && refGrams != null && refGrams > 0) {
    foodNutrients = macrosToNutrients(scaleMacros(ref, 100 / refGrams));
  } else if (ref) {
    // No metric weight — treat default serving macros as the "per 100 g" basis and
    // expose portions as 100 g ≡ 1 serving so existing scale math still works.
    foodNutrients = macrosToNutrients(scaleMacros(ref, 1));
  }

  const foodPortions: FoodPortion[] = [];
  servingList.forEach((s, index) => {
    const g = metricGrams(s);
    const sid = num(s.serving_id);
    const label = str(s.serving_description) || `Serving ${index + 1}`;
    if (g != null && g > 0) {
      foodPortions.push({
        id: sid ?? index,
        gramWeight: g,
        amount: 1,
        portionDescription: label,
        modifier: label,
        measureUnit: { name: 'serving', abbreviation: 'svg' },
      });
    } else {
      foodPortions.push({
        id: sid ?? index,
        gramWeight: 100,
        amount: 1,
        portionDescription: label,
        modifier: label,
        measureUnit: { name: 'serving', abbreviation: 'svg' },
      });
    }
  });

  const foodType = str(foodObj.food_type);
  return {
    fdcId: fatSecretFoodIdToFdcId(foodId),
    description: foodDescription(foodObj),
    dataType: foodType === 'Brand' ? 'FatSecret Brand' : 'FatSecret',
    foodClass: foodType || undefined,
    foodCategory: foodType || undefined,
    foodNutrients,
    foodPortions,
  };
}

function normalizeSearchHit(row: unknown): FoodSearchHit | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const foodId = num(r.food_id);
  if (foodId == null || foodId <= 0) return null;
  const brand = str(r.brand_name) || undefined;
  const foodType = str(r.food_type);
  return {
    fdcId: fatSecretFoodIdToFdcId(foodId),
    source: 'fatsecret',
    fatSecretFoodId: String(Math.trunc(foodId)),
    description: foodDescription(r),
    dataType: foodType === 'Brand' ? 'FatSecret Brand' : 'FatSecret',
    brandName: brand,
    brandOwner: brand,
    foodCategory: foodType || undefined,
  };
}

function extractFoodRows(data: unknown): unknown[] {
  if (!data || typeof data !== 'object') return [];
  const root = data as Record<string, unknown>;

  // v2: foods_search.results.food
  const foodsSearch = root.foods_search;
  if (foodsSearch && typeof foodsSearch === 'object') {
    const results = (foodsSearch as Record<string, unknown>).results;
    if (results && typeof results === 'object') {
      return asArray((results as Record<string, unknown>).food);
    }
  }

  // v1: foods.food
  const foods = root.foods;
  if (foods && typeof foods === 'object') {
    return asArray((foods as Record<string, unknown>).food);
  }

  if (Array.isArray(root.food)) return root.food;
  return [];
}

export async function searchFatSecretFoods(query: string): Promise<FoodSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  if (!getProxyBaseUrl()) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_PROXY_URL. Configure proxy URL and rebuild app.');
  }
  try {
    const data = await proxyJsonFetch<unknown>(
      `/api/fatsecret/foods/search?q=${encodeURIComponent(q)}&max_results=20&page_number=0`
    );
    const rows = extractFoodRows(data);
    const hits: FoodSearchHit[] = [];
    for (const row of rows) {
      const hit = normalizeSearchHit(row);
      if (hit) hits.push(hit);
    }
    return hits;
  } catch (e) {
    throw new Error(mapFatSecretRequestError(e));
  }
}

export async function getFatSecretFoodDetails(foodId: number): Promise<Food> {
  const id = Math.trunc(Math.abs(foodId));
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Invalid FatSecret food id.');
  }
  if (!getProxyBaseUrl()) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_PROXY_URL. Configure proxy URL and rebuild app.');
  }
  try {
    const data = await proxyJsonFetch<unknown>(`/api/fatsecret/food/${id}`);
    return mapFatSecretFoodToFdcFood(data);
  } catch (e) {
    throw new Error(mapFatSecretRequestError(e));
  }
}

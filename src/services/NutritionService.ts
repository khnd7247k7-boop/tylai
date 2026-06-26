/**
 * Central nutrition fetch layer: Nutritionix (branded / chain menus, UPC label lookup)
 * and USDA FoodData Central (whole foods, SR / Foundation / Survey, branded label nutrients).
 *
 * Barcode capture uses expo-camera `CameraView` in `BarcodeScanner.tsx` (Expo stack).
 * Production mode routes Nutritionix/USDA traffic through the authenticated backend proxy so API keys remain server-only.
 * If proxy is unavailable, barcode lookup falls back to Open Food Facts + limited USDA/public data flows where applicable.
 */

import { getProxyBaseUrl, proxyJsonFetch } from './proxyClient';

const NUTRITIONIX_TRACK = 'https://trackapi.nutritionix.com';
const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';

/** FDC attr ids for foods/search macro hints when present */
const FDC_NUTRIENT_IDS = {
  energyKcal: 208,
  protein: 203,
  fat: 204,
  carbs: 205,
} as const;

function nutritionixAppId(): string {
  return '';
}

function nutritionixApiKey(): string {
  return '';
}

export function hasNutritionixCredentials(): boolean {
  return Boolean(getProxyBaseUrl());
}

function fdcApiKey(): string {
  return 'PROXY';
}

function nutritionixHeaders(): Record<string, string> | null {
  return null;
}

function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function readFullNutrient(full: unknown, attrId: number): number | undefined {
  if (!Array.isArray(full)) return undefined;
  for (const row of full) {
    if (!row || typeof row !== 'object') continue;
    const id = (row as { attr_id?: unknown }).attr_id;
    const val = (row as { value?: unknown }).value;
    if (Number(id) === attrId) {
      const n = toNum(val);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

/** Label-serving barcode hit (mapped to `ScannedFood` in `foodDatabase.ts`). */
export type NutritionixBarcodePayload = {
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  barcode: string;
  nutritionBasis: 'label_serving';
  nutritionNote: string;
  referenceGrams?: number;
  servingUnit?: 'g';
  servingWeight?: number;
  baseServingSize?: number;
};

/** Map Nutritionix `/v2/search/item` food object → payload (per label serving). */
function mapNutritionixFoodToPayload(food: Record<string, unknown>, barcode: string): NutritionixBarcodePayload | null {
  const name =
    String(food.food_name ?? food.nix_item_name ?? food.item_name ?? '').trim() ||
    String(food.brand_name_item_name ?? '').trim();
  if (!name) return null;

  const brand = String(food.brand_name ?? food.nix_brand_name ?? '').trim() || undefined;
  let calories = toNum(food.nf_calories);
  let protein = toNum(food.nf_protein);
  let carbs = toNum(food.nf_total_carbohydrate);
  let fat = toNum(food.nf_total_fat);
  const full = food.full_nutrients;
  if (!Number.isFinite(calories) || calories <= 0) {
    const c = readFullNutrient(full, FDC_NUTRIENT_IDS.energyKcal);
    if (c != null) calories = c;
  }
  if (!Number.isFinite(protein) || protein < 0) {
    const p = readFullNutrient(full, FDC_NUTRIENT_IDS.protein);
    if (p != null) protein = p;
  }
  if (!Number.isFinite(carbs) || carbs < 0) {
    const c = readFullNutrient(full, FDC_NUTRIENT_IDS.carbs);
    if (c != null) carbs = c;
  }
  if (!Number.isFinite(fat) || fat < 0) {
    const f = readFullNutrient(full, FDC_NUTRIENT_IDS.fat);
    if (f != null) fat = f;
  }

  if (!Number.isFinite(calories) || calories <= 0) return null;
  if (!Number.isFinite(protein)) protein = 0;
  if (!Number.isFinite(carbs)) carbs = 0;
  if (!Number.isFinite(fat)) fat = 0;

  const qty = toNum(food.serving_qty);
  const unit = String(food.serving_unit ?? '').trim() || 'serving';
  const servingSize =
    Number.isFinite(qty) && qty > 0 ? `${qty} ${unit}`.trim() : String(food.serving_weight_grams ? `${food.serving_weight_grams} g` : '1 serving');

  const grams = toNum(food.serving_weight_grams);
  const out: NutritionixBarcodePayload = {
    name: brand ? `${brand} — ${name}` : name,
    brand,
    calories: Math.round(calories),
    protein: Math.max(0, Math.round(protein * 10) / 10),
    carbs: Math.max(0, Math.round(carbs * 10) / 10),
    fat: Math.max(0, Math.round(fat * 10) / 10),
    servingSize,
    barcode: String(barcode).replace(/\s/g, '').trim(),
    nutritionBasis: 'label_serving',
    nutritionNote: 'Nutritionix branded item (label-style serving).',
  };
  if (Number.isFinite(grams) && grams > 0) {
    out.referenceGrams = Math.round(grams * 10) / 10;
    out.servingUnit = 'g';
    out.servingWeight = out.referenceGrams;
    out.baseServingSize = out.referenceGrams;
  }
  return out;
}

/**
 * Nutritionix `/v2/search/item?upc=` via authenticated backend proxy.
 */
export async function lookupBarcodeNutritionix(upc: string): Promise<NutritionixBarcodePayload | null> {
  const raw = String(upc).replace(/\D/g, '').trim();
  if (!raw || !getProxyBaseUrl()) return null;

  try {
    const json = await proxyJsonFetch<{ foods?: unknown[] }>(`/api/nutritionix/barcode?upc=${encodeURIComponent(raw)}`);
    const foods = (json as { foods?: unknown })?.foods;
    if (!Array.isArray(foods) || foods.length === 0) return null;
    const first = foods[0];
    if (!first || typeof first !== 'object') return null;
    return mapNutritionixFoodToPayload(first as Record<string, unknown>, raw);
  } catch {
    return null;
  }
}

export type VerifiedMacroSource =
  | 'nutritionix_branded'
  | 'fdc_foundation'
  | 'fdc_survey_fndds'
  | 'fdc_sr_legacy'
  | 'fdc_branded'
  | 'fdc_other';

export interface VerifiedMacroResult {
  name: string;
  brand?: string;
  dataType: string;
  source: VerifiedMacroSource;
  fdcId?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingDescription?: string;
}

function fdcDataTypeRank(dataType: string): number {
  const t = dataType.toLowerCase();
  if (t.includes('foundation')) return 0;
  if (t.includes('survey') || t.includes('fndds')) return 1;
  if (t.includes('sr legacy') || t === 'legacy') return 2;
  if (t.includes('branded')) return 3;
  return 4;
}

function mapFdcSource(dataType: string): VerifiedMacroSource {
  const t = dataType.toLowerCase();
  if (t.includes('foundation')) return 'fdc_foundation';
  if (t.includes('survey') || t.includes('fndds')) return 'fdc_survey_fndds';
  if (t.includes('sr legacy') || t === 'legacy') return 'fdc_sr_legacy';
  if (t.includes('branded')) return 'fdc_branded';
  return 'fdc_other';
}

function readMacroTriple(food: Record<string, unknown>): { calories: number; protein: number; carbs: number; fat: number } | null {
  let calories = toNum(food.calories);
  let protein = toNum(food.protein);
  let carbs = toNum(food.carbohydrates ?? food.carbs);
  let fat = toNum(food.fat);

  const nutrients = food.foodNutrients;
  if (Array.isArray(nutrients)) {
    const byId = new Map<number, number>();
    for (const n of nutrients) {
      if (!n || typeof n !== 'object') continue;
      const id = (n as { nutrientId?: unknown; nutrient?: { id?: unknown } }).nutrientId;
      const nid = (n as { nutrient?: { id?: unknown } }).nutrient?.id;
      const numId = Number(id ?? nid);
      const amount = toNum((n as { amount?: unknown; value?: unknown }).amount ?? (n as { value?: unknown }).value);
      if (Number.isFinite(numId) && Number.isFinite(amount)) byId.set(numId, amount);
    }
    const kcal = byId.get(1008) ?? byId.get(208);
    const prot = byId.get(1003) ?? byId.get(203);
    const carb = byId.get(1005) ?? byId.get(205);
    const ft = byId.get(1004) ?? byId.get(204);
    if (!Number.isFinite(calories) || calories <= 0) {
      if (kcal != null && Number.isFinite(kcal)) calories = kcal;
    }
    if (!Number.isFinite(protein) || protein < 0) {
      if (prot != null && Number.isFinite(prot)) protein = prot;
    }
    if (!Number.isFinite(carbs) || carbs < 0) {
      if (carb != null && Number.isFinite(carb)) carbs = carb;
    }
    if (!Number.isFinite(fat) || fat < 0) {
      if (ft != null && Number.isFinite(ft)) fat = ft;
    }
  }

  if (!Number.isFinite(calories) || calories <= 0) return null;
  return {
    calories: Math.round(calories),
    protein: Math.max(0, Math.round(protein * 10) / 10),
    carbs: Math.max(0, Math.round(carbs * 10) / 10),
    fat: Math.max(0, Math.round(fat * 10) / 10),
  };
}

/**
 * USDA FDC `foods/search` with lab-friendly data types first; returns hits that include usable macro numbers.
 */
async function fetchFdcVerifiedCandidates(query: string, limit = 12): Promise<VerifiedMacroResult[]> {
  const q = query.trim();
  if (!q) return [];
  if (!getProxyBaseUrl()) return [];

  try {
    const json = await proxyJsonFetch<{ foods?: unknown[] }>('/api/usda/foods/search', {
      method: 'POST',
      body: JSON.stringify({
        query: q,
        pageSize: limit,
        dataType: ['Foundation', 'Survey (FNDDS)', 'SR Legacy', 'Branded'],
      }),
    });
    const foods = (json as { foods?: unknown[] })?.foods;
    if (!Array.isArray(foods)) return [];
    const out: VerifiedMacroResult[] = [];
    for (const f of foods) {
      if (!f || typeof f !== 'object') continue;
      const row = f as Record<string, unknown>;
      const macros = readMacroTriple(row);
      if (!macros) continue;
      const dt = String(row.dataType ?? 'Unknown');
      const fdcId = typeof row.fdcId === 'number' ? row.fdcId : parseInt(String(row.fdcId), 10);
      out.push({
        name: String(row.description ?? row.lowercaseDescription ?? 'Food').trim(),
        brand: row.brandOwner ? String(row.brandOwner) : row.brandName ? String(row.brandName) : undefined,
        dataType: dt,
        source: mapFdcSource(dt),
        fdcId: Number.isFinite(fdcId) ? fdcId : undefined,
        ...macros,
        servingDescription: row.servingSizeUnit != null ? String(row.servingSizeUnit) : undefined,
      });
    }
    out.sort((a, b) => fdcDataTypeRank(a.dataType) - fdcDataTypeRank(b.dataType));
    return out;
  } catch {
    return [];
  }
}

async function fetchNutritionixInstantBranded(query: string, limit = 8): Promise<VerifiedMacroResult[]> {
  const q = query.trim();
  if (!q || !getProxyBaseUrl()) return [];

  try {
    const json = await proxyJsonFetch<{ branded?: unknown[] }>(
      `/api/nutritionix/instant?detailed=true&branded=true&common=false&query=${encodeURIComponent(q)}`
    );
    const branded = (json as { branded?: unknown[] })?.branded;
    if (!Array.isArray(branded)) return [];
    const out: VerifiedMacroResult[] = [];
    for (const b of branded.slice(0, limit)) {
      if (!b || typeof b !== 'object') continue;
      const row = b as Record<string, unknown>;
      const name = String(row.food_name ?? row.brand_name_item_name ?? '').trim();
      if (!name) continue;
      const calories = toNum(row.nf_calories);
      const protein = toNum(row.nf_protein);
      const carbs = toNum(row.nf_total_carbohydrate);
      const fat = toNum(row.nf_total_fat);
      if (!Number.isFinite(calories) || calories <= 0) continue;
      out.push({
        name,
        brand: row.brand_name ? String(row.brand_name) : undefined,
        dataType: 'Nutritionix branded',
        source: 'nutritionix_branded',
        calories: Math.round(calories),
        protein: Math.max(0, Math.round(protein * 10) / 10),
        carbs: Math.max(0, Math.round(carbs * 10) / 10),
        fat: Math.max(0, Math.round(fat * 10) / 10),
        servingDescription: row.serving_unit ? `${row.serving_qty ?? ''} ${row.serving_unit}`.trim() : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Aggregates Nutritionix branded instant hits (restaurant / packaged) and USDA FDC lab-oriented types,
 * de-duplicated by name, with FDC Foundation / Survey / SR ranked before branded crowd-sourced FDC entries.
 */
export async function fetchVerifiedMacros(query: string): Promise<VerifiedMacroResult[]> {
  const [fdcHits, nxHits] = await Promise.all([fetchFdcVerifiedCandidates(query, 14), fetchNutritionixInstantBranded(query, 10)]);
  const seen = new Set<string>();
  const merged: VerifiedMacroResult[] = [];

  const push = (h: VerifiedMacroResult) => {
    const key = `${h.name}|${h.brand ?? ''}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(h);
  };

  for (const h of fdcHits) push(h);
  for (const h of nxHits) push(h);
  return merged.slice(0, 20);
}

export type RestaurantMenuItemJson = {
  name: string;
  description?: string;
  category: string;
  estimated_calories: number;
  estimated_protein_g: number;
  estimated_carbs_g: number;
  estimated_fat_g: number;
  nix_item_id?: string;
};

/**
 * Branded instant menu lines for a restaurant / chain query (Nutritionix).
 * Used as verified-style menu payload for the eating-out coach before Gemini ranking.
 */
/**
 * Restaurant / chain menu lines from Nutritionix instant search (branded + common).
 * Passes raw structured items to Gemini for clinical ranking (not inventing menu items).
 */
export async function getRestaurantRecommendations(
  restaurant: string,
  _goals?: Record<string, unknown>
): Promise<{ items: RestaurantMenuItemJson[]; query_used: string }> {
  const q = `${restaurant}`.trim();
  if (!hasNutritionixCredentials() || !q) return { items: [], query_used: q };
  try {
    const json = await proxyJsonFetch<{ branded?: unknown[] }>(
      `/api/nutritionix/instant?detailed=true&branded=true&common=true&query=${encodeURIComponent(q)}`
    );
    const branded = (json as { branded?: unknown[] })?.branded;
    if (!Array.isArray(branded) || branded.length === 0) return { items: [], query_used: q };

    const items: RestaurantMenuItemJson[] = [];
    for (const b of branded.slice(0, 28)) {
      if (!b || typeof b !== 'object') continue;
      const row = b as Record<string, unknown>;
      const name = String(row.food_name ?? '').trim();
      if (!name) continue;
      const calories = toNum(row.nf_calories);
      const protein = toNum(row.nf_protein);
      const carbs = toNum(row.nf_total_carbohydrate);
      const fat = toNum(row.nf_total_fat);
      if (!Number.isFinite(calories) || calories <= 0) continue;
      const brand = String(row.brand_name ?? '').trim();
      items.push({
        name: brand ? `${brand} — ${name}` : name,
        description: row.serving_unit ? `Serving ${row.serving_qty ?? ''} ${row.serving_unit}`.trim() : undefined,
        category:
          Array.isArray(row.nix_item_tags) && row.nix_item_tags[0] != null
            ? String(row.nix_item_tags[0])
            : 'menu',
        estimated_calories: Math.round(calories),
        estimated_protein_g: Math.max(0, Math.round(protein * 10) / 10),
        estimated_carbs_g: Math.max(0, Math.round(carbs * 10) / 10),
        estimated_fat_g: Math.max(0, Math.round(fat * 10) / 10),
        nix_item_id: row.nix_item_id ? String(row.nix_item_id) : undefined,
      });
    }
    return { items, query_used: q };
  } catch {
    return { items: [], query_used: q };
  }
}

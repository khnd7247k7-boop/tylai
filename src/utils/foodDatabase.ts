import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

const CACHE_PREFIX = 'FOOD_CACHE_';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

interface OpenFoodFactsResponse {
  status: number;
  product?: any;
}

function parseNutriments(product: any): Omit<ScannedFood, 'barcode'> | null {
  if (!product) return null;

  const name: string = product.product_name || product.generic_name || 'Unknown Item';
  const brand: string | undefined = product.brands || product.brand_owner || undefined;

  const nutriments = product.nutriments || {};

  const perServing = (field: string) =>
    nutriments[`${field}_serving`] ?? nutriments[field];

  // Prefer per-serving data, fallback to per-100g
  const energyKcal = perServing('energy-kcal') ?? perServing('energy_kcal') ?? nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? nutriments['energy-kcal_value'];
  const protein = perServing('proteins') ?? nutriments['proteins_100g'];
  const carbs = perServing('carbohydrates') ?? nutriments['carbohydrates_100g'];
  const fat = perServing('fat') ?? nutriments['fat_100g'];

  // Some products only provide energy in kJ; convert if needed
  let calories: number | undefined = Number(energyKcal);
  if (!calories && (perServing('energy') || nutriments['energy_100g'])) {
    const energyKj = Number(perServing('energy') ?? nutriments['energy_100g']);
    if (!isNaN(energyKj) && energyKj > 0) {
      calories = energyKj / 4.184;
    }
  }

  const servingSize: string = product.serving_size || product.serving_quantity || '1 serving';

  const toNum = (v: any) => {
    const n = Number(v);
    return isNaN(n) ? 0 : Math.round(n * 10) / 10;
  };

  // Extract micronutrients
  const getMicronutrient = (field: string): number | undefined => {
    const value = perServing(field) ?? nutriments[`${field}_100g`] ?? nutriments[field];
    const num = toNum(value);
    return num > 0 ? num : undefined;
  };

  const micronutrients: Micronutrients = {
    fiber: getMicronutrient('fiber'),
    sugar: getMicronutrient('sugars'),
    sodium: getMicronutrient('sodium'),
    calcium: getMicronutrient('calcium'),
    iron: getMicronutrient('iron'),
    potassium: getMicronutrient('potassium'),
    vitaminA: getMicronutrient('vitamin-a'),
    vitaminC: getMicronutrient('vitamin-c'),
    vitaminD: getMicronutrient('vitamin-d'),
    vitaminE: getMicronutrient('vitamin-e'),
    vitaminK: getMicronutrient('vitamin-k'),
    thiamin: getMicronutrient('thiamin') ?? getMicronutrient('vitamin-b1'),
    riboflavin: getMicronutrient('riboflavin') ?? getMicronutrient('vitamin-b2'),
    niacin: getMicronutrient('niacin') ?? getMicronutrient('vitamin-b3'),
    vitaminB6: getMicronutrient('vitamin-b6'),
    folate: getMicronutrient('folate') ?? getMicronutrient('folic-acid'),
    vitaminB12: getMicronutrient('vitamin-b12'),
    biotin: getMicronutrient('biotin'),
    pantothenicAcid: getMicronutrient('pantothenic-acid') ?? getMicronutrient('vitamin-b5'),
    phosphorus: getMicronutrient('phosphorus'),
    iodine: getMicronutrient('iodine'),
    magnesium: getMicronutrient('magnesium'),
    zinc: getMicronutrient('zinc'),
    selenium: getMicronutrient('selenium'),
    copper: getMicronutrient('copper'),
    manganese: getMicronutrient('manganese'),
    chromium: getMicronutrient('chromium'),
    molybdenum: getMicronutrient('molybdenum'),
    chloride: getMicronutrient('chloride'),
  };

  // Only include micronutrients if at least one exists
  const hasMicronutrients = Object.values(micronutrients).some(v => v !== undefined);

  return {
    name,
    brand,
    calories: toNum(calories),
    protein: toNum(protein),
    carbs: toNum(carbs),
    fat: toNum(fat),
    servingSize,
    ...(hasMicronutrients && { micronutrients }),
  };
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

export async function lookupFoodByBarcode(barcode: string): Promise<ScannedFood | null> {
  const cached = await readCache(barcode);
  if (cached) return cached;

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: OpenFoodFactsResponse = await res.json();
    if (json.status !== 1 || !json.product) return null;

    const parsed = parseNutriments(json.product);
    if (!parsed) return null;

    const result: ScannedFood = { ...parsed, barcode };
    await writeCache(barcode, result);
    return result;
  } catch (e) {
    return null;
  }
}



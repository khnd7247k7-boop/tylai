import type { Food, FoodNutrient } from '../types/fdcApi';
import type { Micronutrients } from './foodDatabase';
import { calculateNutrients } from './fdcNutrients';

type MicroKey = keyof Micronutrients;

type MicroRule = {
  key: MicroKey;
  ids: number[];
  nameIncludes?: string[];
};

/** USDA FoodData Central nutrient ids → app Micronutrients keys (values per 100 g). */
const FDC_MICRO_RULES: MicroRule[] = [
  { key: 'fiber', ids: [1079], nameIncludes: ['fiber, total', 'fiber'] },
  { key: 'sugar', ids: [2000, 1063, 1235], nameIncludes: ['sugars, total', 'sugar'] },
  { key: 'sodium', ids: [1093] },
  { key: 'calcium', ids: [1087] },
  { key: 'iron', ids: [1089] },
  { key: 'potassium', ids: [1092] },
  { key: 'vitaminA', ids: [1106, 2067] },
  { key: 'vitaminC', ids: [1162] },
  { key: 'vitaminD', ids: [1114, 3288, 3251] },
  { key: 'vitaminE', ids: [1109] },
  { key: 'vitaminK', ids: [1185, 1183] },
  { key: 'thiamin', ids: [1165] },
  { key: 'riboflavin', ids: [1166] },
  { key: 'niacin', ids: [1167] },
  { key: 'vitaminB6', ids: [1175] },
  { key: 'folate', ids: [1177] },
  { key: 'vitaminB12', ids: [1178, 1246] },
  { key: 'biotin', ids: [1176] },
  { key: 'pantothenicAcid', ids: [1170] },
  { key: 'phosphorus', ids: [1091] },
  { key: 'iodine', ids: [1100] },
  { key: 'magnesium', ids: [1090] },
  { key: 'zinc', ids: [1095] },
  { key: 'selenium', ids: [1103] },
  { key: 'copper', ids: [1098] },
  { key: 'manganese', ids: [1101] },
  { key: 'chromium', ids: [1096] },
  { key: 'molybdenum', ids: [1102] },
  { key: 'chloride', ids: [1088] },
];

function normName(n: string | undefined): string {
  return String(n ?? '')
    .trim()
    .toLowerCase();
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

function roundMicro(n: number): number {
  const a = Math.abs(n);
  if (a < 0.01) return Math.round(n * 10000) / 10000;
  if (a < 1) return Math.round(n * 1000) / 1000;
  if (a < 100) return Math.round(n * 100) / 100;
  return Math.round(n * 10) / 10;
}

function pickPer100g(rows: FoodNutrient[], rule: MicroRule): number | null {
  for (const id of rule.ids) {
    for (const row of rows) {
      if (nutrientId(row) !== id) continue;
      const amt = rowAmount(row);
      if (amt != null && Number.isFinite(amt) && amt >= 0) return amt;
    }
  }
  if (rule.nameIncludes?.length) {
    for (const row of rows) {
      const name = normName(row.nutrient?.name);
      if (!rule.nameIncludes.some((frag) => name.includes(frag))) continue;
      const amt = rowAmount(row);
      if (amt != null && Number.isFinite(amt) && amt >= 0) return amt;
    }
  }
  return null;
}

/** Extract micronutrients per 100 g from a USDA FDC food detail payload. */
export function extractMicronutrientsPer100g(food: Food | null | undefined): Micronutrients | undefined {
  const rows = food?.foodNutrients;
  if (!rows?.length) return undefined;
  const out: Micronutrients = {};
  for (const rule of FDC_MICRO_RULES) {
    const per100 = pickPer100g(rows, rule);
    if (per100 == null) continue;
    out[rule.key] = roundMicro(per100);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function scaleMicronutrientsFrom100g(
  micros: Micronutrients | undefined,
  grams: number
): Micronutrients | undefined {
  if (!micros) return undefined;
  const g = Number.isFinite(grams) && grams > 0 ? grams : 100;
  const out: Micronutrients = {};
  for (const [key, value] of Object.entries(micros)) {
    if (value == null || !Number.isFinite(value)) continue;
    out[key as MicroKey] = roundMicro(calculateNutrients(value, g));
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function logFoodFormHasMicronutrients(micros: Micronutrients | undefined): boolean {
  if (!micros) return false;
  return Object.values(micros).some((v) => v !== undefined && v !== null && Number.isFinite(v as number));
}

import { usdaDbExecute } from './DatabaseManager';
import type {
  UsdaFoodDetail,
  UsdaFoodPortionRow,
  UsdaFoodSearchRow,
  UsdaNutrientRow,
} from '../types/usdaSqlite';

function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function tokenizeForFts(normalized: string): string[] {
  return normalized.split(/[^0-9A-Za-z]+/).filter((t) => t.length > 0);
}

/** FTS5 prefix match: tokens joined with AND, each token suffixed with *. */
export function buildFtsPrefixMatch(normalized: string): string | null {
  const tokens = tokenizeForFts(normalized);
  if (!tokens.length) {
    return null;
  }
  return tokens
    .map((t) => {
      const safe = t.replace(/"/g, '');
      if (!safe) return null;
      return `${safe}*`;
    })
    .filter((x): x is string => x != null)
    .join(' AND ');
}

/**
 * Search foods via FTS5. bm25 primary rank; tie-break so descriptions starting with the first
 * token (e.g. "Apple…") sort before longer matches ("Apple juice…") when scores are close.
 */
export async function searchFoodsFts(
  query: string,
  limit = 80
): Promise<UsdaFoodSearchRow[]> {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [];
  }
  const match = buildFtsPrefixMatch(normalized);
  if (!match) {
    return [];
  }
  const tokens = tokenizeForFts(normalized);
  const firstToken = (tokens[0] ?? '').toLowerCase();
  const likePrefix = firstToken ? `${firstToken}%` : '%';

  const sql = `
    SELECT
      f.fdc_id AS fdc_id,
      f.description AS description,
      bm25(foods_fts) AS bm25
    FROM foods_fts
    JOIN foods f ON f.fdc_id = foods_fts.fdc_id
    WHERE foods_fts MATCH ?
    ORDER BY
      bm25(foods_fts) ASC,
      CASE WHEN lower(f.description) LIKE ? THEN 0 ELSE 1 END ASC,
      length(f.description) ASC
    LIMIT ?
  `;

  const rows = await usdaDbExecute<{ fdc_id: number; description: string; bm25: number }>(sql, [
    match,
    likePrefix,
    limit,
  ]);
  return rows.map((r) => ({
    fdc_id: r.fdc_id,
    description: r.description,
    bm25: r.bm25,
  }));
}

export async function fetchNutrientsForFood(fdcId: number): Promise<UsdaNutrientRow[]> {
  const sql = `
    SELECT nutrient_id, nutrient_name, amount, unit_name
    FROM nutrients
    WHERE fdc_id = ?
    ORDER BY nutrient_id ASC
  `;
  return usdaDbExecute<UsdaNutrientRow>(sql, [fdcId]);
}

export async function fetchPortionsForFood(fdcId: number): Promise<UsdaFoodPortionRow[]> {
  const sql = `
    SELECT id, fdc_id, portion_description, gram_weight, amount
    FROM food_portions
    WHERE fdc_id = ?
    ORDER BY gram_weight ASC, portion_description ASC
  `;
  return usdaDbExecute<UsdaFoodPortionRow>(sql, [fdcId]);
}

/** Single round-trip: food row + nutrients + portions (three subqueries via JOINs is heavier on planner; this stays simple and fast at small scale). */
export async function fetchFoodDetail(fdcId: number): Promise<UsdaFoodDetail | null> {
  const foods = await usdaDbExecute<{ fdc_id: number; description: string }>(
    'SELECT fdc_id, description FROM foods WHERE fdc_id = ? LIMIT 1',
    [fdcId]
  );
  const food = foods[0];
  if (!food) {
    return null;
  }
  const [nutrients, portions] = await Promise.all([
    fetchNutrientsForFood(fdcId),
    fetchPortionsForFood(fdcId),
  ]);
  return { food, nutrients, portions };
}

/**
 * Grams for a chosen portion and user multiplier (e.g. 2 × "1 cup" where row amount is 1).
 * Nutrients in the sample DB are per 100 g; scale with (grams / 100).
 */
export function gramsForPortion(
  gramWeight: number,
  referenceAmount: number,
  userPortionCount: number
): number {
  const denom = referenceAmount === 0 ? 1 : referenceAmount;
  return gramWeight * (userPortionCount / denom);
}

export function scaleNutrientAmount(amountPer100g: number, grams: number): number {
  return (amountPer100g * grams) / 100;
}

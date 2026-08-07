import { searchFood, getFoodDetails as getUsdaFoodDetails } from './usda';
import {
  getFatSecretFoodDetails,
  isFatSecretFdcId,
  searchFatSecretFoods,
} from './fatsecret';
import type { Food, FoodSearchHit } from '../types/fdcApi';

export type FoodCatalogSource = 'fatsecret' | 'usda';

export interface FoodCatalogSearchMeta {
  source: FoodCatalogSource;
  /** True when FatSecret failed/unavailable and USDA was used instead. */
  usedFallback: boolean;
  fallbackReason?: string;
}

export interface FoodCatalogSearchResult {
  hits: FoodSearchHit[];
  meta: FoodCatalogSearchMeta;
}

/**
 * Primary: FatSecret. Backup: USDA when FatSecret errors or is not configured.
 * Empty FatSecret results are NOT a failure (no silent USDA swap).
 */
export async function searchFoodCatalog(query: string): Promise<FoodCatalogSearchResult> {
  const q = query.trim();
  if (!q) {
    return { hits: [], meta: { source: 'fatsecret', usedFallback: false } };
  }

  try {
    const hits = await searchFatSecretFoods(q);
    return {
      hits: hits.map((h) => ({ ...h, source: h.source ?? 'fatsecret' })),
      meta: { source: 'fatsecret', usedFallback: false },
    };
  } catch (e) {
    const fallbackReason = e instanceof Error ? e.message : 'FatSecret unavailable';
    const hits = await searchFood(q);
    return {
      hits: hits.map((h) => ({ ...h, source: 'usda' as const })),
      meta: { source: 'usda', usedFallback: true, fallbackReason },
    };
  }
}

export async function getCatalogFoodDetails(
  fdcId: number,
  source?: FoodCatalogSource | null
): Promise<Food> {
  const fromSource = source ?? (isFatSecretFdcId(fdcId) ? 'fatsecret' : 'usda');
  if (fromSource === 'fatsecret' || isFatSecretFdcId(fdcId)) {
    return getFatSecretFoodDetails(Math.abs(fdcId));
  }
  return getUsdaFoodDetails(fdcId);
}

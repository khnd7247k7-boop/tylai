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

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
type CacheEntry = { hits: FoodSearchHit[]; savedAt: number };
const fatSecretSearchCache = new Map<string, CacheEntry>();

function cacheKey(q: string): string {
  return q.trim().toLowerCase();
}

function readCache(q: string): FoodSearchHit[] | null {
  const key = cacheKey(q);
  const hit = fatSecretSearchCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.savedAt > SEARCH_CACHE_TTL_MS) {
    fatSecretSearchCache.delete(key);
    return null;
  }
  return hit.hits;
}

function writeCache(q: string, hits: FoodSearchHit[]) {
  fatSecretSearchCache.set(cacheKey(q), { hits, savedAt: Date.now() });
}

function isIpAllowlistError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /error 21|Invalid IP address|blocked this Mac/i.test(msg);
}

async function searchFatSecretWithRetry(query: string): Promise<FoodSearchHit[]> {
  const cached = readCache(query);
  if (cached) return cached;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const hits = await searchFatSecretFoods(query);
      writeCache(query, hits);
      return hits;
    } catch (e) {
      lastErr = e;
      if (!isIpAllowlistError(e) || attempt === 2) break;
      // FatSecret IP allowlist often flaps during propagation — brief pause then retry.
      await new Promise((r) => setTimeout(r, 600 + attempt * 400));
    }
  }
  const soft = readCache(query);
  if (soft) return soft;
  throw lastErr instanceof Error ? lastErr : new Error('FatSecret unavailable');
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
    const hits = await searchFatSecretWithRetry(q);
    return {
      hits: hits.map((h) => ({ ...h, source: h.source ?? 'fatsecret' })),
      meta: { source: 'fatsecret', usedFallback: false },
    };
  } catch (e) {
    const fallbackReason = e instanceof Error ? e.message : 'FatSecret unavailable';
    console.warn('[foodCatalog] FatSecret failed; using USDA backup:', fallbackReason);
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

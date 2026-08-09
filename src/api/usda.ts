import axios, { type AxiosInstance, isAxiosError } from 'axios';
import type { Food, FoodsSearchResponse, FoodSearchHit } from '../types/fdcApi';
import { getProxyBaseUrl, proxyJsonFetch } from '../services/proxyClient';
import { previewFromUsdaSearchNutrients } from '../utils/foodSearchMacroPreview';

const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';

export function getUsdaFdcApiKey(): string {
  return 'PROXY';
}

const http: AxiosInstance = axios.create({
  baseURL: FDC_BASE,
  timeout: 25000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

const DATA_TYPES_SEARCH: ('Foundation' | 'SR Legacy')[] = ['Foundation', 'SR Legacy'];

function dataTypeRank(dt: string | undefined): number {
  const u = String(dt ?? '');
  if (u === 'Foundation') return 0;
  if (u === 'SR Legacy') return 1;
  return 99;
}

export function mapUsdaRequestError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 429) {
      return 'USDA FoodData Central rate limit reached. Please wait a minute and try again.';
    }
    if (status === 403 || status === 401) {
      return 'USDA request was rejected by the secure proxy. Check proxy auth and server USDA key configuration.';
    }
    if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
      return 'USDA request timed out. Check your connection and try again.';
    }
    if (status != null && status >= 500) {
      return 'USDA servers are temporarily unavailable. Try again later.';
    }
    const msg = typeof err.response?.data === 'object' && err.response?.data && 'message' in err.response.data
      ? String((err.response.data as { message?: unknown }).message ?? '')
      : '';
    if (msg) return msg;
    return err.message || 'USDA request failed';
  }
  if (err instanceof Error) return err.message;
  return 'USDA request failed';
}

function normalizeSearchHit(row: unknown): FoodSearchHit | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const fdcId = typeof r.fdcId === 'number' ? r.fdcId : parseInt(String(r.fdcId ?? ''), 10);
  if (!Number.isFinite(fdcId)) return null;
  let foodCategory: string | undefined;
  const fc = r.foodCategory;
  if (typeof fc === 'string') foodCategory = fc.trim() || undefined;
  else if (fc && typeof fc === 'object' && 'description' in fc) {
    foodCategory = String((fc as { description?: unknown }).description ?? '').trim() || undefined;
  }
  return {
    fdcId,
    description: String(r.description ?? r.lowercaseDescription ?? 'Unknown food').trim() || 'Unknown food',
    dataType: r.dataType != null ? String(r.dataType) : undefined,
    brandOwner: r.brandOwner != null ? String(r.brandOwner) : undefined,
    brandName: r.brandName != null ? String(r.brandName) : undefined,
    scientificName: r.scientificName != null ? String(r.scientificName) : undefined,
    foodCategory,
    foodNutrients: Array.isArray(r.foodNutrients) ? (r.foodNutrients as Food['foodNutrients']) : undefined,
    previewMacros: Array.isArray(r.foodNutrients)
      ? previewFromUsdaSearchNutrients(r.foodNutrients as Food['foodNutrients']) ?? undefined
      : undefined,
  };
}

function normalizeFoodDetail(data: unknown): Food {
  if (!data || typeof data !== 'object') {
    return { fdcId: 0, description: '', foodNutrients: [], foodPortions: [] };
  }
  const r = data as Record<string, unknown>;
  const fdcId = typeof r.fdcId === 'number' ? r.fdcId : parseInt(String(r.fdcId ?? ''), 10);
  let foodCategory: Food['foodCategory'];
  const fc = r.foodCategory;
  if (typeof fc === 'string') foodCategory = fc;
  else if (fc && typeof fc === 'object') foodCategory = fc as Food['foodCategory'];

  return {
    fdcId: Number.isFinite(fdcId) ? fdcId : 0,
    description: r.description != null ? String(r.description) : undefined,
    dataType: r.dataType != null ? String(r.dataType) : undefined,
    foodClass: r.foodClass != null ? String(r.foodClass) : undefined,
    foodCategory,
    foodNutrients: Array.isArray(r.foodNutrients) ? (r.foodNutrients as Food['foodNutrients']) : [],
    foodPortions: Array.isArray(r.foodPortions) ? (r.foodPortions as Food['foodPortions']) : [],
  };
}

/**
 * POST /v1/foods/search — Foundation + SR Legacy only.
 */
export async function searchFood(query: string): Promise<FoodSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  if (!getProxyBaseUrl()) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_PROXY_URL. Configure proxy URL and rebuild app.');
  }

  try {
    const data = await proxyJsonFetch<FoodsSearchResponse>('/api/usda/foods/search', {
      method: 'POST',
      body: JSON.stringify({
        query: q,
        pageSize: 50,
        pageNumber: 1,
        dataType: DATA_TYPES_SEARCH,
      }),
    });

    const foods = Array.isArray(data?.foods) ? data.foods : [];
    const normalized: FoodSearchHit[] = [];
    for (const row of foods) {
      const hit = normalizeSearchHit(row);
      if (hit) normalized.push(hit);
    }

    normalized.sort((a, b) => {
      const d = dataTypeRank(a.dataType) - dataTypeRank(b.dataType);
      if (d !== 0) return d;
      return a.description.localeCompare(b.description);
    });
    return normalized;
  } catch (e) {
    throw new Error(mapUsdaRequestError(e));
  }
}

/** GET /v1/food/{fdcId} */
export async function getFoodDetails(fdcId: number): Promise<Food> {
  if (!getProxyBaseUrl()) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_PROXY_URL. Configure proxy URL and rebuild app.');
  }
  try {
    const data = await proxyJsonFetch<unknown>(`/api/usda/food/${fdcId}`);
    return normalizeFoodDetail(data);
  } catch (e) {
    throw new Error(mapUsdaRequestError(e));
  }
}

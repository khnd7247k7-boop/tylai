import type { Micronutrients } from './foodDatabase';
import { getProxyBaseUrl, proxyJsonFetch } from '../services/proxyClient';

function digitsOnly(s: string): string {
  return String(s).replace(/\D/g, '');
}

function upcMatches(stored: string | undefined, wanted: string): boolean {
  if (!stored) return false;
  const a = digitsOnly(stored);
  const b = digitsOnly(wanted);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= b.length && a.endsWith(b)) return true;
  if (b.length >= a.length && b.endsWith(a)) return true;
  return false;
}

function roundLabelMicro(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return n;
  const a = Math.abs(n);
  if (a < 0.01) return Math.round(n * 10000) / 10000;
  if (a < 1) return Math.round(n * 1000) / 1000;
  if (a < 100) return Math.round(n * 100) / 100;
  return Math.round(n * 10) / 10;
}

function readLabelNum(ln: Record<string, unknown> | undefined, key: string): number | undefined {
  if (!ln) return undefined;
  const block = ln[key];
  if (!block || typeof block !== 'object') return undefined;
  const v = (block as { value?: unknown }).value;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return roundLabelMicro(n);
}

/**
 * USDA FoodData Central branded foods often include `labelNutrients` (per FDA-style serving)
 * when Open Food Facts omits trace minerals (iron, potassium, etc.).
 */
export async function fetchFdcMicronutrientGapFill(upc: string): Promise<Partial<Micronutrients>> {
  const wanted = digitsOnly(upc);
  if (!wanted || !getProxyBaseUrl()) return {};

  try {
    const sJson: any = await proxyJsonFetch('/api/usda/foods/search', {
      method: 'POST',
      body: JSON.stringify({
        query: wanted,
        dataType: ['Branded'],
        pageSize: 15,
      }),
    });
    const foods: any[] = Array.isArray(sJson?.foods) ? sJson.foods : [];
    const hit = foods.find((f) => upcMatches(f?.gtinUpc, wanted));
    const fdcId = hit?.fdcId;
    if (fdcId == null || !Number.isFinite(Number(fdcId))) return {};

    const food: any = await proxyJsonFetch(`/api/usda/food/${encodeURIComponent(String(fdcId))}`);
    const ln = food?.labelNutrients as Record<string, unknown> | undefined;
    if (!ln || typeof ln !== 'object') return {};

    const out: Partial<Micronutrients> = {};
    const fiber = readLabelNum(ln, 'fiber');
    const sodium = readLabelNum(ln, 'sodium');
    const calcium = readLabelNum(ln, 'calcium');
    const iron = readLabelNum(ln, 'iron');
    const potassium = readLabelNum(ln, 'potassium');
    const vitD = readLabelNum(ln, 'vitaminD');
    const added = readLabelNum(ln, 'addedSugar');

    if (fiber !== undefined) out.fiber = fiber;
    if (sodium !== undefined) out.sodium = sodium;
    if (calcium !== undefined) out.calcium = calcium;
    if (iron !== undefined) out.iron = iron;
    if (potassium !== undefined) out.potassium = potassium;
    if (vitD !== undefined) out.vitaminD = vitD;
    if (added !== undefined) out.sugar = added;

    return out;
  } catch {
    return {};
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Food } from '../types/fdcApi';

const KEY = '@fdc_food_detail_cache_v1';
const MAX = 10;

type CacheEntry = { fdcId: number; food: Food; savedAt: string };

async function readAll(): Promise<CacheEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is CacheEntry =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as CacheEntry).fdcId === 'number' &&
        (x as CacheEntry).food != null
    );
  } catch {
    return [];
  }
}

async function writeAll(entries: CacheEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export async function getCachedFoodDetail(fdcId: number): Promise<Food | null> {
  const all = await readAll();
  const hit = all.find((e) => e.fdcId === fdcId);
  return hit?.food ?? null;
}

/** LRU-style: most recent first, cap 10. */
export async function rememberFoodDetail(food: Food): Promise<void> {
  if (!food?.fdcId || !Number.isFinite(food.fdcId)) return;
  const all = await readAll();
  const next = [{ fdcId: food.fdcId, food, savedAt: new Date().toISOString() }, ...all.filter((e) => e.fdcId !== food.fdcId)];
  await writeAll(next);
}

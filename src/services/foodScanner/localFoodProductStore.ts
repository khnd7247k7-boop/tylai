import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FoodProduct } from '../../types/foodProduct';

const PRODUCTS_KEY = 'tyl_food_products_v1';
const BARCODE_INDEX_KEY = 'tyl_barcode_index_v1';
const OFFLINE_QUEUE_KEY = 'tyl_food_scan_offline_queue_v1';

type BarcodeIndex = Record<string, string>; // barcode → product id
type ProductMap = Record<string, FoodProduct>;

export type OfflineScanJob = {
  id: string;
  createdAt: string;
  barcode?: string;
  imageBase64?: string;
  mimeType?: string;
  note?: string;
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getFoodProductById(id: string): Promise<FoodProduct | null> {
  const map = await readJson<ProductMap>(PRODUCTS_KEY, {});
  return map[id] ?? null;
}

export async function getFoodProductByBarcode(barcode: string): Promise<FoodProduct | null> {
  const clean = barcode.replace(/\D/g, '');
  if (!clean) return null;
  const index = await readJson<BarcodeIndex>(BARCODE_INDEX_KEY, {});
  const id = index[clean];
  if (!id) return null;
  return getFoodProductById(id);
}

/** Upsert FoodProduct and optional barcode index entry (avoids duplicates). */
export async function upsertFoodProduct(product: FoodProduct): Promise<FoodProduct> {
  const map = await readJson<ProductMap>(PRODUCTS_KEY, {});
  const index = await readJson<BarcodeIndex>(BARCODE_INDEX_KEY, {});

  let id = product.id;
  const barcode = product.barcode?.replace(/\D/g, '');
  if (barcode && index[barcode]) {
    id = index[barcode];
  }

  const next: FoodProduct = { ...product, id };
  map[id] = next;
  if (barcode) index[barcode] = id;

  await writeJson(PRODUCTS_KEY, map);
  await writeJson(BARCODE_INDEX_KEY, index);
  return next;
}

export async function enqueueOfflineScan(job: Omit<OfflineScanJob, 'id' | 'createdAt'>): Promise<void> {
  const queue = await readJson<OfflineScanJob[]>(OFFLINE_QUEUE_KEY, []);
  queue.push({
    ...job,
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  });
  await writeJson(OFFLINE_QUEUE_KEY, queue);
}

export async function peekOfflineScanQueue(): Promise<OfflineScanJob[]> {
  return readJson<OfflineScanJob[]>(OFFLINE_QUEUE_KEY, []);
}

export async function clearOfflineScanJob(id: string): Promise<void> {
  const queue = await readJson<OfflineScanJob[]>(OFFLINE_QUEUE_KEY, []);
  await writeJson(
    OFFLINE_QUEUE_KEY,
    queue.filter((j) => j.id !== id)
  );
}

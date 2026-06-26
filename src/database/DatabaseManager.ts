/**
 * Web / unsupported runtimes: QuickSQLite is not loaded (see `.native.ts`).
 */
export const isUsdaNutritionDbSupported = false;

export const USDA_DB_FILE = 'usda_nutrition.db';
export const USDA_DB_SUBDIR = 'tylai';

export async function ensureUsdaNutritionDatabase(): Promise<void> {
  return;
}

export async function usdaDbExecute<T = Record<string, unknown>>(
  _sql: string,
  _params?: (string | number | null)[]
): Promise<T[]> {
  return [];
}

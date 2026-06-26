import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { isRunningInExpoGo } from '../utils/expoGo';

export const USDA_DB_FILE = 'usda_nutrition.db';
export const USDA_DB_SUBDIR = 'tylai';

function resolveBundledDbAsset(): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../../assets/usda_nutrition.db');
  } catch {
    return null;
  }
}

const bundledDbAsset = resolveBundledDbAsset();

/** Dev/Xcode only; needs bootstrap script + on-device (no remote Chrome debugger for SQLite). */
export const isUsdaNutritionDbSupported =
  !isRunningInExpoGo() && bundledDbAsset != null;

let initPromise: Promise<void> | null = null;
let opened = false;
let quickSqliteModule: { QuickSQLite: any } | null | undefined;

function getQuickSQLite(): any | null {
  if (isRunningInExpoGo()) return null;
  if (quickSqliteModule !== undefined) {
    return quickSqliteModule?.QuickSQLite ?? null;
  }
  try {
    // Lazy require avoids loading native module in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    quickSqliteModule = require('react-native-quick-sqlite');
    return quickSqliteModule?.QuickSQLite ?? null;
  } catch {
    quickSqliteModule = null;
    return null;
  }
}

async function copyBundledDatabaseIfNeeded(): Promise<void> {
  if (!bundledDbAsset) {
    throw new Error(
      'USDA database asset missing. Run: npm run db:bootstrap (see scripts/bootstrap-usda-sqlite.sh)'
    );
  }

  const destDir = new Directory(Paths.document, USDA_DB_SUBDIR);
  destDir.create({ intermediates: true, idempotent: true });
  const destFile = new File(destDir, USDA_DB_FILE);

  if (destFile.exists) {
    return;
  }

  const [asset] = await Asset.loadAsync(bundledDbAsset);
  await asset.downloadAsync();
  const srcUri = asset.localUri ?? asset.uri;
  if (!srcUri) {
    throw new Error('USDA nutrition asset missing localUri');
  }
  new File(srcUri).copy(destFile);
}

function openDatabase(): boolean {
  if (opened) {
    return true;
  }
  const QuickSQLite = getQuickSQLite();
  if (!QuickSQLite) {
    return false;
  }
  try {
    QuickSQLite.open(USDA_DB_FILE, USDA_DB_SUBDIR);
    opened = true;
    return true;
  } catch (error) {
    console.warn('[USDA DB] QuickSQLite.open failed (avoid remote JS debugging):', error);
    return false;
  }
}

export async function ensureUsdaNutritionDatabase(): Promise<void> {
  if (!isUsdaNutritionDbSupported || !getQuickSQLite()) {
    return;
  }
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await copyBundledDatabaseIfNeeded();
        openDatabase();
      } catch (error) {
        console.warn('[USDA DB] init failed:', error);
        initPromise = null;
      }
    })();
  }
  await initPromise;
}

export async function usdaDbExecute<T = Record<string, unknown>>(
  sql: string,
  params?: (string | number | null)[]
): Promise<T[]> {
  const QuickSQLite = getQuickSQLite();
  if (!isUsdaNutritionDbSupported || !QuickSQLite || !opened) {
    return [];
  }
  try {
    await ensureUsdaNutritionDatabase();
    if (!opened) return [];
    const res = await QuickSQLite.executeAsync(USDA_DB_FILE, sql, params ?? []);
    const rows = res.rows?._array ?? [];
    return rows as T[];
  } catch (error) {
    console.warn('[USDA DB] query failed:', error);
    return [];
  }
}

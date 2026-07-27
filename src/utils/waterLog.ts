import { loadUserData, saveUserData } from './userStorage';

export type WaterLogEntry = {
  id: string;
  /** Local calendar day YYYY-MM-DD */
  dateKey: string;
  ounces: number;
  timestamp: string;
};

const ENTRIES_KEY = 'waterLogEntries';
const QUICK_AMOUNTS_KEY = 'waterQuickAmounts';
const MAX_QUICK = 3;

function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeOunces(raw: number): number | null {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  // Allow half-ounces; clamp to a sane bottle size.
  const rounded = Math.round(raw * 2) / 2;
  if (rounded <= 0 || rounded > 500) return null;
  return rounded;
}

export async function loadWaterLogEntries(): Promise<WaterLogEntry[]> {
  const raw = await loadUserData<WaterLogEntry[]>(ENTRIES_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e) =>
      e &&
      typeof e.id === 'string' &&
      typeof e.dateKey === 'string' &&
      typeof e.ounces === 'number' &&
      e.ounces > 0
  );
}

export async function loadWaterQuickAmounts(): Promise<number[]> {
  const raw = await loadUserData<number[]>(QUICK_AMOUNTS_KEY);
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const n of raw) {
    const oz = normalizeOunces(Number(n));
    if (oz != null && !out.includes(oz)) out.push(oz);
    if (out.length >= MAX_QUICK) break;
  }
  return out;
}

export function sumWaterForDate(entries: WaterLogEntry[], dateKey = localDateKey()): number {
  return entries
    .filter((e) => e.dateKey === dateKey)
    .reduce((sum, e) => sum + (Number(e.ounces) || 0), 0);
}

export function getTodayWaterTotal(entries: WaterLogEntry[]): number {
  return sumWaterForDate(entries, localDateKey());
}

/**
 * Log water in fluid ounces. Updates today's total and remembers this amount
 * in the last-3 quick-add list (most recent first, unique).
 */
export async function addWaterOunces(ouncesInput: number): Promise<{
  entries: WaterLogEntry[];
  quickAmounts: number[];
  todayTotal: number;
  added: number;
}> {
  const ounces = normalizeOunces(ouncesInput);
  if (ounces == null) {
    throw new Error('Enter a water amount greater than 0 fl oz.');
  }

  const entries = await loadWaterLogEntries();
  const entry: WaterLogEntry = {
    id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    dateKey: localDateKey(),
    ounces,
    timestamp: new Date().toISOString(),
  };
  const nextEntries = [entry, ...entries];
  await saveUserData(ENTRIES_KEY, nextEntries);

  const prevQuick = await loadWaterQuickAmounts();
  const quickAmounts = [ounces, ...prevQuick.filter((n) => n !== ounces)].slice(0, MAX_QUICK);
  await saveUserData(QUICK_AMOUNTS_KEY, quickAmounts);

  return {
    entries: nextEntries,
    quickAmounts,
    todayTotal: getTodayWaterTotal(nextEntries),
    added: ounces,
  };
}

export async function undoLastWaterEntryToday(): Promise<{
  entries: WaterLogEntry[];
  todayTotal: number;
} | null> {
  const today = localDateKey();
  const entries = await loadWaterLogEntries();
  const idx = entries.findIndex((e) => e.dateKey === today);
  if (idx < 0) return null;
  const next = entries.filter((_, i) => i !== idx);
  await saveUserData(ENTRIES_KEY, next);
  return { entries: next, todayTotal: getTodayWaterTotal(next) };
}

export { localDateKey as waterLocalDateKey };

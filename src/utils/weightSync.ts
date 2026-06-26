import type { WeightEntry } from './workoutHistoryChartData';

export type ImportedWeightSample = {
  date: string;
  weightLbs: number;
};

function dayKey(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr.slice(0, 10);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function toLocalNoonIso(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const y = Number(match[1]);
  const mo = Number(match[2]);
  const d = Number(match[3]);
  return new Date(y, mo - 1, d, 12, 0, 0, 0).toISOString();
}

/** Merge HealthKit samples into local entries without overwriting manual logs for the same day. */
export function mergeWeightEntriesFromHealth(
  existing: WeightEntry[],
  imported: ImportedWeightSample[]
): { merged: WeightEntry[]; added: number } {
  const byDate = new Map<string, WeightEntry>();
  for (const entry of existing) {
    byDate.set(dayKey(entry.date), entry);
  }
  let added = 0;

  for (const sample of imported) {
    if (!sample.date || !Number.isFinite(sample.weightLbs) || sample.weightLbs <= 0) continue;
    const key = dayKey(sample.date);
    if (byDate.has(key)) continue;
    const entry: WeightEntry = {
      id: `health-${key}`,
      date: toLocalNoonIso(key),
      weight: Math.round(sample.weightLbs * 10) / 10,
    };
    byDate.set(key, entry);
    added += 1;
  }

  const merged = Array.from(byDate.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return { merged, added };
}

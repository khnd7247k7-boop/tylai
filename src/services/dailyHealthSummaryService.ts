/**
 * Daily Apple Health / Watch summaries for History + Progress calendars.
 * Aggregates steps, active energy, distance, heart rate, and HK workouts by local day.
 */

import HealthService from './HealthService';
import type { HealthKitWorkoutSample } from '../native/healthKitBridge';
import type { HeartRateDataPoint } from './HealthService';
import {
  dailyHealthHasActivity,
  emptyDailyHealthSummary,
  type DailyHealthSummary,
} from '../types/dailyHealthSummary';
import type { MetricValue } from '../types/sessionProgressMetrics';

export type { DailyHealthSummary };
export { dailyHealthHasActivity, emptyDailyHealthSummary };

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export function monthRangeLocal(month: Date): { start: Date; end: Date } {
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function formatCompactSteps(steps: number): string {
  if (!(steps > 0)) return '';
  if (steps < 1000) return String(Math.round(steps));
  const k = steps / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

export function formatDistanceMiles(meters: number): string {
  if (!(meters > 0)) return '';
  const miles = meters / 1609.34;
  return `${miles >= 10 ? Math.round(miles) : miles.toFixed(1)} mi`;
}

function upsert(
  map: Record<string, DailyHealthSummary>,
  dateKey: string
): DailyHealthSummary {
  if (!map[dateKey]) map[dateKey] = emptyDailyHealthSummary(dateKey);
  return map[dateKey];
}

export function indexDailyHealthSummaries(input: {
  steps: Array<{ date: Date; value: number }>;
  calories: Array<{ date: Date; value: number }>;
  distance: Array<{ date: Date; value: number }>;
  heartRate: HeartRateDataPoint[];
  workouts: HealthKitWorkoutSample[];
}): Record<string, DailyHealthSummary> {
  const map: Record<string, DailyHealthSummary> = {};

  for (const row of input.steps) {
    const key = toLocalDateKey(row.date);
    upsert(map, key).steps += Math.max(0, Math.round(row.value || 0));
  }
  for (const row of input.calories) {
    const key = toLocalDateKey(row.date);
    upsert(map, key).activeCalories += Math.max(0, Math.round(row.value || 0));
  }
  for (const row of input.distance) {
    const key = toLocalDateKey(row.date);
    upsert(map, key).distanceM += Math.max(0, Math.round(row.value || 0));
  }

  const hrBuckets = new Map<string, number[]>();
  for (const point of input.heartRate) {
    const key = toLocalDateKey(point.timestamp);
    const list = hrBuckets.get(key) ?? [];
    list.push(point.value);
    hrBuckets.set(key, list);
  }
  for (const [key, values] of hrBuckets) {
    if (!values.length) continue;
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    upsert(map, key).avgHeartRate = avg;
  }

  for (const workout of input.workouts) {
    const key = toLocalDateKey(new Date(workout.startMs));
    upsert(map, key).workouts.push(workout);
  }

  for (const summary of Object.values(map)) {
    summary.workouts.sort((a, b) => a.startMs - b.startMs);
  }

  return map;
}

export async function loadDailyHealthSummaries(
  start: Date,
  end: Date
): Promise<Record<string, DailyHealthSummary>> {
  try {
    const [historical, workouts] = await Promise.all([
      HealthService.getHistoricalHealthData(start, end),
      HealthService.fetchWatchWorkouts(start, end),
    ]);
    return indexDailyHealthSummaries({
      steps: historical.steps,
      calories: historical.calories,
      distance: historical.distance,
      heartRate: historical.heartRate,
      workouts,
    });
  } catch (error) {
    console.warn('[dailyHealthSummary] load failed', error);
    return {};
  }
}

export function dailyHealthToMetricValues(
  summary: DailyHealthSummary | undefined | null
): MetricValue[] {
  if (!summary || !dailyHealthHasActivity(summary)) return [];
  const extras: MetricValue[] = [];
  if (summary.steps > 0) {
    extras.push({
      label: 'Steps',
      value: summary.steps,
      unit: '',
      status: 'available',
      delta: null,
    });
  }
  if (summary.activeCalories > 0) {
    extras.push({
      label: 'Active',
      value: summary.activeCalories,
      unit: 'kcal',
      status: 'available',
      delta: null,
    });
  }
  if (summary.avgHeartRate != null && summary.avgHeartRate > 0) {
    extras.push({
      label: 'HR',
      value: summary.avgHeartRate,
      unit: 'bpm',
      status: 'available',
      delta: null,
    });
  }
  if (summary.workouts.length > 0) {
    extras.push({
      label: 'Watch',
      value: summary.workouts.length,
      unit: summary.workouts.length === 1 ? 'workout' : 'workouts',
      status: 'available',
      delta: null,
    });
  }
  return extras;
}

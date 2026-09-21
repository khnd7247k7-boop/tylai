import type { HealthKitWorkoutSample } from '../native/healthKitBridge';

/** One local calendar day's Apple Health / Watch snapshot. */
export type DailyHealthSummary = {
  dateKey: string;
  steps: number;
  activeCalories: number;
  distanceM: number;
  avgHeartRate: number | null;
  workouts: HealthKitWorkoutSample[];
};

export function emptyDailyHealthSummary(dateKey: string): DailyHealthSummary {
  return {
    dateKey,
    steps: 0,
    activeCalories: 0,
    distanceM: 0,
    avgHeartRate: null,
    workouts: [],
  };
}

export function dailyHealthHasActivity(summary: DailyHealthSummary | undefined | null): boolean {
  if (!summary) return false;
  return (
    summary.steps > 0 ||
    summary.activeCalories > 0 ||
    summary.distanceM > 0 ||
    summary.avgHeartRate != null ||
    summary.workouts.length > 0
  );
}

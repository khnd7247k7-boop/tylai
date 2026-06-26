import type { HealthMetrics } from '../services/HealthService';

/**
 * True when we have enough smartwatch / Apple Health (expo-health) samples for the session window
 * to infer workload without asking the separate post-workout check-in questions.
 */
export function hasWearableCoverageForSession(metrics: HealthMetrics | undefined): boolean {
  if (!metrics) return false;

  const {
    averageHeartRate,
    maxHeartRate,
    minHeartRate,
    caloriesBurned,
    steps,
    distance,
    heartRateZones,
  } = metrics;

  if (averageHeartRate != null && averageHeartRate > 0) return true;
  if (maxHeartRate != null && maxHeartRate > 0) return true;
  if (minHeartRate != null && minHeartRate > 0) return true;
  if (caloriesBurned != null && caloriesBurned > 0) return true;
  if (steps != null && steps > 0) return true;
  if (distance != null && distance > 0) return true;

  if (heartRateZones) {
    const { fatBurn = 0, cardio = 0, peak = 0 } = heartRateZones;
    if (fatBurn > 0 || cardio > 0 || peak > 0) return true;
  }

  return false;
}

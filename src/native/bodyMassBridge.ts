import { NativeModules, Platform } from 'react-native';
import { isRunningInExpoGo } from '../utils/expoGo';

type BodyMassSampleNative = {
  dateMs: number;
  weightLbs: number;
};

type NativeBridge = {
  fetchBodyMassSamplesSinceDays?: (days: number) => Promise<BodyMassSampleNative[]>;
};

/**
 * iOS only: reads body-mass samples from HealthKit (smart scales, manual Health entries, etc.).
 */
export async function fetchBodyMassSamplesSinceDaysNative(
  daysBack: number
): Promise<BodyMassSampleNative[]> {
  if (Platform.OS !== 'ios') return [];
  if (isRunningInExpoGo()) return [];
  const mod = NativeModules.BodyMassBridge as NativeBridge | undefined;
  if (!mod?.fetchBodyMassSamplesSinceDays) return [];
  try {
    const raw = await mod.fetchBodyMassSamplesSinceDays(Math.max(1, Math.min(daysBack, 365)));
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (row) =>
        row &&
        typeof row.dateMs === 'number' &&
        Number.isFinite(row.dateMs) &&
        typeof row.weightLbs === 'number' &&
        Number.isFinite(row.weightLbs) &&
        row.weightLbs > 0
    );
  } catch {
    return [];
  }
}

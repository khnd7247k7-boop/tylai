import { NativeModules, Platform } from 'react-native';
import { isRunningInExpoGo } from '../utils/expoGo';

export type HealthKitQuantityMetric =
  | 'heartRate'
  | 'activeEnergy'
  | 'steps'
  | 'distance'
  | 'bodyMass';

export type HealthKitQuantitySample = {
  dateMs: number;
  value: number;
};

type AuthResult = {
  ok: boolean;
  available: boolean;
  completed: boolean;
};

export type HealthKitWorkoutSample = {
  uuid: string;
  activityType: number;
  activityLabel: string;
  startMs: number;
  endMs: number;
  durationMin: number;
  calories?: number;
  distanceM?: number;
};

type NativeBridge = {
  isHealthDataAvailable?: () => Promise<boolean>;
  hasCompletedAuthFlow?: () => Promise<boolean>;
  requestAuthorization?: () => Promise<AuthResult>;
  fetchQuantitySamples?: (
    metric: string,
    startMs: number,
    endMs: number
  ) => Promise<HealthKitQuantitySample[]>;
  fetchWorkouts?: (startMs: number, endMs: number) => Promise<unknown[]>;
};

function getBridge(): NativeBridge | null {
  if (Platform.OS !== 'ios') return null;
  if (isRunningInExpoGo()) return null;
  return (NativeModules.HealthKitBridge as NativeBridge | undefined) ?? null;
}

export function isHealthKitBridgeAvailable(): boolean {
  return !!getBridge()?.requestAuthorization;
}

export async function isHealthDataAvailableNative(): Promise<boolean> {
  const mod = getBridge();
  if (!mod?.isHealthDataAvailable) return false;
  try {
    return !!(await mod.isHealthDataAvailable());
  } catch {
    return false;
  }
}

export async function hasHealthKitAuthFlowCompletedNative(): Promise<boolean> {
  const mod = getBridge();
  if (!mod?.hasCompletedAuthFlow) return false;
  try {
    return !!(await mod.hasCompletedAuthFlow());
  } catch {
    return false;
  }
}

/**
 * Shows the system Health permission sheet (first time) and registers TYLAI in
 * Settings → Health → Data Access & Devices.
 */
export async function requestHealthKitAuthorizationNative(): Promise<boolean> {
  const mod = getBridge();
  if (!mod?.requestAuthorization) return false;
  try {
    const result = await mod.requestAuthorization();
    return !!(result?.ok && result?.available);
  } catch {
    return false;
  }
}

export async function fetchQuantitySamplesNative(
  metric: HealthKitQuantityMetric,
  start: Date,
  end: Date
): Promise<HealthKitQuantitySample[]> {
  const mod = getBridge();
  if (!mod?.fetchQuantitySamples) return [];
  try {
    const raw = await mod.fetchQuantitySamples(metric, start.getTime(), end.getTime());
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (row) =>
        row &&
        typeof row.dateMs === 'number' &&
        Number.isFinite(row.dateMs) &&
        typeof row.value === 'number' &&
        Number.isFinite(row.value)
    );
  } catch {
    return [];
  }
}

export async function fetchWorkoutsNative(
  start: Date,
  end: Date
): Promise<HealthKitWorkoutSample[]> {
  const mod = getBridge();
  if (!mod?.fetchWorkouts) return [];
  try {
    const raw = await mod.fetchWorkouts(start.getTime(), end.getTime());
    if (!Array.isArray(raw)) return [];
    const out: HealthKitWorkoutSample[] = [];
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const uuid = typeof r.uuid === 'string' ? r.uuid : '';
      const activityLabel = typeof r.activityLabel === 'string' ? r.activityLabel : 'Cardio';
      const startMs = Number(r.startMs);
      const endMs = Number(r.endMs);
      const durationMin = Number(r.durationMin);
      if (!uuid || !Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
      const calories = Number(r.calories);
      const distanceM = Number(r.distanceM);
      out.push({
        uuid,
        activityType: Number(r.activityType) || 0,
        activityLabel,
        startMs,
        endMs,
        durationMin: Number.isFinite(durationMin) && durationMin > 0 ? durationMin : Math.max(1, (endMs - startMs) / 60000),
        calories: Number.isFinite(calories) && calories > 0 ? calories : undefined,
        distanceM: Number.isFinite(distanceM) && distanceM > 0 ? distanceM : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

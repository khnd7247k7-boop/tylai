import { loadUserData, saveUserData } from './userStorage';

/** Storage key for saveUserData / loadUserData */
export const HEALTH_DATA_PERMISSIONS_KEY = 'healthDataPermissions';

/** Categories aligned with HealthKit / Apple Health and expo-health usage in the app */
export type HealthMetricKey =
  | 'heartRate'
  | 'bodyMass'
  | 'vo2Max'
  | 'activeEnergy'
  | 'sleep'
  | 'steps'
  | 'distance';

export type HealthDataPermissions = Record<HealthMetricKey, boolean>;

export const DEFAULT_HEALTH_DATA_PERMISSIONS: HealthDataPermissions = {
  heartRate: true,
  bodyMass: true,
  vo2Max: true,
  activeEnergy: true,
  sleep: true,
  steps: true,
  distance: true,
};

/** expo-health supports these; others are HealthKit-only in native code today */
export const EXPO_HEALTH_METRIC_KEYS: readonly HealthMetricKey[] = [
  'heartRate',
  'activeEnergy',
  'steps',
  'distance',
] as const;

/** Settings UI order: app-used metrics first, then HealthKit-only types */
export const HEALTH_METRIC_ORDER: HealthMetricKey[] = [
  'heartRate',
  'activeEnergy',
  'steps',
  'distance',
  'bodyMass',
  'vo2Max',
  'sleep',
];

export const HEALTH_METRIC_COPY: Record<
  HealthMetricKey,
  { title: string; description: string }
> = {
  heartRate: {
    title: 'Heart rate',
    description: 'BPM during activity and trends from your watch or chest strap',
  },
  activeEnergy: {
    title: 'Active energy',
    description: 'Calories burned during movement (not resting metabolism)',
  },
  steps: {
    title: 'Steps',
    description: 'Step count from your phone or wearable',
  },
  distance: {
    title: 'Distance',
    description: 'Walking or running distance where available',
  },
  bodyMass: {
    title: 'Body weight',
    description: 'Weight from scales or manual entries in Apple Health',
  },
  vo2Max: {
    title: 'VO₂ max',
    description: 'Cardio fitness estimates from Apple Watch or workouts in Apple Health',
  },
  sleep: {
    title: 'Sleep',
    description: 'Sleep duration and analysis from Apple Watch or other Apple Health sources',
  },
};

export function mergeHealthDataPermissions(
  saved: Partial<HealthDataPermissions> | null | undefined
): HealthDataPermissions {
  return { ...DEFAULT_HEALTH_DATA_PERMISSIONS, ...saved };
}

export async function loadHealthDataPermissions(): Promise<HealthDataPermissions> {
  const saved = await loadUserData<Partial<HealthDataPermissions>>(HEALTH_DATA_PERMISSIONS_KEY);
  return mergeHealthDataPermissions(saved);
}

export async function saveHealthDataPermissions(perms: HealthDataPermissions): Promise<void> {
  await saveUserData(HEALTH_DATA_PERMISSIONS_KEY, perms);
}

async function isMasterHealthSyncEnabled(): Promise<boolean> {
  const appSettings = await loadUserData<{ healthDataSyncEnabled?: boolean }>('appSettings');
  return appSettings?.healthDataSyncEnabled !== false;
}

/** Master “health sync” must be on and the category allowed */
export async function isHealthMetricEnabled(metric: HealthMetricKey): Promise<boolean> {
  if (!(await isMasterHealthSyncEnabled())) return false;
  const perms = await loadHealthDataPermissions();
  return perms[metric] === true;
}

/** True if any expo-health metric is allowed (avoids permission prompts when none apply) */
export async function isAnyExpoHealthMetricEnabled(): Promise<boolean> {
  if (!(await isMasterHealthSyncEnabled())) return false;
  const perms = await loadHealthDataPermissions();
  return EXPO_HEALTH_METRIC_KEYS.some((k) => perms[k] === true);
}

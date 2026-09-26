import { loadUserData, saveUserData } from './userStorage';

const STORAGE_KEY = 'exerciseRestTimerPrefs';

export const REST_DURATION_PRESETS = [
  { label: '30s', seconds: 30 },
  { label: '45s', seconds: 45 },
  { label: '1 min', seconds: 60 },
  { label: '1:30', seconds: 90 },
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
  { label: '4 min', seconds: 240 },
  { label: '5 min', seconds: 300 },
] as const;

export const DEFAULT_REST_SECONDS = 90;

export type ExerciseRestPreference = {
  seconds: number;
  autoApply: boolean;
};

export type ExerciseRestPreferenceMap = Record<string, ExerciseRestPreference>;

export function normalizeExerciseRestKey(name: string): string {
  return name.trim().toLowerCase();
}

export function formatRestDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (remainder === 0) return `${minutes} min`;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export function formatRestClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export async function loadExerciseRestPreferences(): Promise<ExerciseRestPreferenceMap> {
  const raw = await loadUserData<ExerciseRestPreferenceMap>(STORAGE_KEY);
  if (!raw || typeof raw !== 'object') return {};
  const next: ExerciseRestPreferenceMap = {};
  for (const [key, value] of Object.entries(raw)) {
    const seconds = Number(value?.seconds);
    if (!key || !Number.isFinite(seconds) || seconds <= 0) continue;
    next[normalizeExerciseRestKey(key)] = {
      seconds: Math.round(seconds),
      autoApply: value?.autoApply === true,
    };
  }
  return next;
}

export async function saveExerciseRestPreferences(
  prefs: ExerciseRestPreferenceMap
): Promise<void> {
  await saveUserData(STORAGE_KEY, prefs);
}

export function resolveExerciseRestSeconds(
  prefs: ExerciseRestPreferenceMap,
  exerciseName: string,
  fallbackSeconds: number
): number {
  const pref = prefs[normalizeExerciseRestKey(exerciseName)];
  if (pref?.autoApply && pref.seconds > 0) return pref.seconds;
  if (!Number.isFinite(fallbackSeconds)) return DEFAULT_REST_SECONDS;
  return Math.max(0, Math.round(fallbackSeconds));
}

export function isExerciseRestAutoApply(
  prefs: ExerciseRestPreferenceMap,
  exerciseName: string
): boolean {
  return prefs[normalizeExerciseRestKey(exerciseName)]?.autoApply === true;
}

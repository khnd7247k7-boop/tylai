import type { ExerciseData } from '../data/exerciseDatabase';
import { getExerciseData } from '../data/exerciseDatabase';
import { loadUserData, saveUserData } from './userStorage';

const STORAGE_KEY = 'customExerciseLibrary_v1';

/** Minimal catalog row so logging / programs accept the name like built-in exercises. */
export function buildUserExerciseRecord(displayName: string): ExerciseData {
  const trimmed = displayName.trim();
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const id = `user-${slug || 'ex'}-${Date.now().toString(36)}`;
  return {
    id,
    name: trimmed,
    movementPattern: 'isometric',
    primaryMuscleGroup: 'general',
    secondaryMuscleGroups: [],
    equipmentRequired: ['none'],
    difficulty: 'beginner',
    potentialRisks: [],
    alternatives: [],
    category: 'strength',
    muscleGroups: ['general'],
    equipment: ['none'],
    // Sparse MI defaults — customs are unknown until the user tags them later.
    primaryMuscles: ['general'],
    secondaryMuscles: [],
    jointDemands: [],
    mobilityDemand: 'low',
    stabilityDemand: 'low',
    strengthDemand: 'low',
    coordinationDemand: 'low',
    balanceDemand: 'low',
    movementControlDemand: 'low',
    technicalComplexity: 'low',
    movementQualities: [],
    laterality: 'bilateral',
    regressions: [],
    progressions: [],
    variations: [],
    miMovementPattern: 'other',
  };
}

export async function loadUserCustomExercises(): Promise<ExerciseData[]> {
  try {
    const raw = await loadUserData<ExerciseData[]>(STORAGE_KEY);
    return Array.isArray(raw) ? raw.filter((e) => e?.name && e?.id) : [];
  } catch {
    return [];
  }
}

export async function saveUserCustomExercises(list: ExerciseData[]): Promise<void> {
  await saveUserData(STORAGE_KEY, list);
}

/** Returns null if the name already exists in the built-in database. */
export async function addUserCustomExercise(displayName: string): Promise<ExerciseData | null> {
  const trimmed = displayName.trim();
  if (!trimmed) return null;
  if (getExerciseData(trimmed)) return null;

  const existing = await loadUserCustomExercises();
  const dup = existing.find((e) => e.name.toLowerCase() === trimmed.toLowerCase());
  if (dup) return dup;

  const created = buildUserExerciseRecord(trimmed);
  await saveUserCustomExercises([...existing, created]);
  return created;
}

/**
 * Ensure every plan exercise name exists in the catalog.
 * Built-ins are left alone; missing names are added to the user's custom library
 * so scanned programs keep wording like "Dumbbell Squats" instead of collapsing to "Squats".
 */
export async function ensureExercisesInUserCatalog(names: string[]): Promise<ExerciseData[]> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  if (!unique.length) return loadUserCustomExercises();

  const existing = await loadUserCustomExercises();
  const byName = new Map(existing.map((e) => [e.name.toLowerCase(), e]));
  let changed = false;
  const next = [...existing];

  for (const name of unique) {
    if (getExerciseData(name)) continue;
    if (byName.has(name.toLowerCase())) continue;
    const created = buildUserExerciseRecord(name);
    next.push(created);
    byName.set(name.toLowerCase(), created);
    changed = true;
  }

  if (changed) await saveUserCustomExercises(next);
  return next;
}

export function resolveExerciseData(name: string, userCustom: ExerciseData[]): ExerciseData | undefined {
  const fromBuiltIn = getExerciseData(name);
  if (fromBuiltIn) return fromBuiltIn;
  return userCustom.find((e) => e.name.toLowerCase() === name.trim().toLowerCase());
}

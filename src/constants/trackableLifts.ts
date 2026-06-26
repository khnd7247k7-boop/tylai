import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExercisesByCategory } from '../data/exerciseDatabase';

/** Persisted key for Trends strength / volume exercise selection */
export const TRENDS_TRACKED_LIFT_KEY = 'trendsTrackedLiftId';

const CUSTOM_PREFIX = 'custom:';

/** Default chart exercise when nothing valid is stored */
export const DEFAULT_TRACKED_LIFT_ID = 'bench';

export interface TrackableLift {
  id: string;
  label: string;
  /** Match logged exercise names from workout history */
  match: (exerciseName: string) => boolean;
}

/** Full preset list (used for persistence validation and legacy ids). Order: priority lifts first. */
export const TRACKABLE_LIFTS: TrackableLift[] = [
  {
    id: 'deadlift',
    label: 'Deadlift',
    match: (n) => {
      const x = n.toLowerCase();
      return (
        x.includes('deadlift') ||
        x.includes('romanian deadlift') ||
        x.trim() === 'rdl'
      );
    },
  },
  {
    id: 'bench',
    label: 'Bench Press',
    match: (n) => n.toLowerCase().includes('bench'),
  },
  {
    id: 'squat',
    label: 'Squat',
    match: (n) => {
      const x = n.toLowerCase();
      return x.includes('squat') && !x.includes('split') && !x.includes('bulgarian');
    },
  },
  {
    id: 'ohp',
    label: 'Overhead Press',
    match: (n) => {
      const x = n.toLowerCase();
      if (x.includes('bench')) return false;
      return (
        x.includes('overhead press') ||
        x.includes('shoulder press') ||
        x.includes('military press') ||
        x.includes('military') ||
        x.includes('strict press') ||
        /\bohp\b/i.test(n)
      );
    },
  },
  {
    id: 'barbell_row',
    label: 'Barbell Row',
    match: (n) => {
      const x = n.toLowerCase();
      return (
        (x.includes('barbell') && x.includes('row')) ||
        x.includes('bent-over row') ||
        x.includes('bent over row') ||
        x.includes('pendlay')
      );
    },
  },
  {
    id: 'hip_thrust',
    label: 'Hip Thrust',
    match: (n) => {
      const x = n.toLowerCase();
      return x.includes('hip thrust') || x.includes('glute bridge');
    },
  },
];

/** Shown first in the picker: deadlift, bench, squat */
export const PRIORITY_TRACKABLE_LIFTS: TrackableLift[] = TRACKABLE_LIFTS.slice(0, 3);

/** Match logged name to a user-picked exercise name from the database */
export function matchLoggedToCanonical(loggedName: string, canonicalName: string): boolean {
  const a = loggedName.trim().toLowerCase();
  const b = canonicalName.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

export function encodeCustomLiftId(name: string): string {
  return CUSTOM_PREFIX + encodeURIComponent(name.trim());
}

/** Returns decoded exercise name if `id` is a custom lift id, else null */
export function decodeCustomLiftId(id: string): string | null {
  if (!id.startsWith(CUSTOM_PREFIX)) return null;
  try {
    const name = decodeURIComponent(id.slice(CUSTOM_PREFIX.length));
    return name.trim() || null;
  } catch {
    return null;
  }
}

export function getTrackableLiftById(id: string | null | undefined): TrackableLift {
  const fallback =
    TRACKABLE_LIFTS.find((l) => l.id === DEFAULT_TRACKED_LIFT_ID) ?? TRACKABLE_LIFTS[0];
  if (!id) return fallback;
  const custom = decodeCustomLiftId(id);
  if (custom) {
    return {
      id,
      label: custom,
      match: (n: string) => matchLoggedToCanonical(n, custom),
    };
  }
  const found = TRACKABLE_LIFTS.find((l) => l.id === id);
  return found ?? fallback;
}

let cachedStrengthNames: string[] | null = null;

/** Unique strength exercise names from the app database, sorted A–Z */
export function getStrengthExerciseNamesSorted(): string[] {
  if (cachedStrengthNames) return cachedStrengthNames;
  const seen = new Set<string>();
  const list: string[] = [];
  for (const ex of getExercisesByCategory('strength')) {
    const n = ex.name.trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(n);
  }
  list.sort((a, b) => a.localeCompare(b));
  cachedStrengthNames = list;
  return list;
}

/** Filter strength names by search query; excludes priority labels to avoid duplicate rows */
export function filterStrengthNamesForPicker(
  query: string,
  excludeLower: Set<string>
): string[] {
  const all = getStrengthExerciseNamesSorted();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return all.filter((name) => {
    if (excludeLower.has(name.trim().toLowerCase())) return false;
    return name.toLowerCase().includes(q);
  });
}

export async function loadTrackedLiftId(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(TRENDS_TRACKED_LIFT_KEY);
    if (!v) return DEFAULT_TRACKED_LIFT_ID;
    if (v.startsWith(CUSTOM_PREFIX)) {
      const name = decodeCustomLiftId(v);
      if (name && name.length > 0) return v;
      return DEFAULT_TRACKED_LIFT_ID;
    }
    if (TRACKABLE_LIFTS.some((l) => l.id === v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_TRACKED_LIFT_ID;
}

export async function saveTrackedLiftId(id: string): Promise<void> {
  await AsyncStorage.setItem(TRENDS_TRACKED_LIFT_KEY, id);
}

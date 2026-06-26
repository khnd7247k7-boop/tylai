/** Warm-up stretch row inside a collapsed warm-up block. */
export type WarmupItemDef = {
  id: string;
  name: string;
  durationSeconds?: number;
};

export type WarmupLogItem = WarmupItemDef & {
  completed: boolean;
};

export type TrackableExercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  completed: boolean;
  category: 'strength' | 'cardio' | 'flexibility' | 'balance';
  restTime?: number;
  durationSeconds?: number;
  movementPattern?: string;
  muscleGroups?: string[];
  equipment?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  alternatives?: string[];
  phase?: 'Warm-Up' | 'Main Lift' | 'Secondary Lifts' | 'Accessory Lifts' | 'Finisher' | 'Cooldown';
  isWarmupBlock?: boolean;
  warmupItems?: WarmupItemDef[];
};

export type ExerciseSetLog = {
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
};

export type ExerciseLogEntry = {
  exerciseId: string;
  exerciseName: string;
  sets: ExerciseSetLog[];
  totalSets: number;
  isWarmupBlock?: boolean;
  warmupItems?: WarmupLogItem[];
};

const COOLDOWN_NAMES = new Set([
  'Hamstring Stretch',
  "Child's Pose",
  'Shoulder Stretch',
  'Hip Flexor Stretch',
]);

const FINISHER_DURATION_NAMES = new Set(['High Knees', 'Lateral Pogos']);

export function isWarmupExercise(ex: TrackableExercise): boolean {
  if (ex.isWarmupBlock) return false;
  if (ex.phase === 'Warm-Up') return true;
  if (ex.durationSeconds != null && ex.durationSeconds > 0) {
    if (ex.phase === 'Cooldown' || ex.phase === 'Finisher') return false;
    if (COOLDOWN_NAMES.has(ex.name)) return false;
    if (FINISHER_DURATION_NAMES.has(ex.name)) return false;
    return true;
  }
  return false;
}

/** Collapse consecutive warm-up movements into one trackable block. */
export function buildTrackingExercises(exercises: TrackableExercise[]): TrackableExercise[] {
  const out: TrackableExercise[] = [];
  let i = 0;
  while (i < exercises.length) {
    const ex = exercises[i];
    if (!isWarmupExercise(ex)) {
      out.push(ex);
      i += 1;
      continue;
    }

    const items: WarmupItemDef[] = [];
    while (i < exercises.length && isWarmupExercise(exercises[i])) {
      const w = exercises[i];
      items.push({
        id: w.id ?? w.name,
        name: w.name,
        durationSeconds: w.durationSeconds,
      });
      i += 1;
    }

    const totalSec = items.reduce((sum, it) => sum + (it.durationSeconds ?? 0), 0);
    out.push({
      id: `warmup-block-${items[0]?.id ?? 'default'}`,
      name: 'Warm-up',
      sets: 1,
      reps: 0,
      weight: 0,
      completed: false,
      category: 'flexibility',
      restTime: 0,
      phase: 'Warm-Up',
      isWarmupBlock: true,
      warmupItems: items,
      durationSeconds: totalSec > 0 ? totalSec : undefined,
    });
  }
  return out;
}

export function buildInitialExerciseLogs(exercises: TrackableExercise[]): ExerciseLogEntry[] {
  return exercises.map((ex) => {
    if (ex.isWarmupBlock && ex.warmupItems?.length) {
      return {
        exerciseId: ex.id,
        exerciseName: ex.name,
        totalSets: 1,
        isWarmupBlock: true,
        warmupItems: ex.warmupItems.map((w) => ({ ...w, completed: false })),
        sets: [{ setNumber: 1, reps: 0, weight: 0, completed: false }],
      };
    }
    return {
      exerciseId: ex.id ?? ex.name,
      exerciseName: ex.name,
      totalSets: ex.sets,
      sets: Array.from({ length: ex.sets }, (_, i) => ({
        setNumber: i + 1,
        reps: ex.reps,
        weight: 0,
        completed: false,
      })),
    };
  });
}

export function getWarmupProgress(log: ExerciseLogEntry): { done: number; total: number } {
  if (log.warmupItems?.length) {
    return {
      done: log.warmupItems.filter((w) => w.completed).length,
      total: log.warmupItems.length,
    };
  }
  const setDone = log.sets.some((s) => s.completed);
  return { done: setDone ? 1 : 0, total: 1 };
}

export function syncWarmupSetCompletion(log: ExerciseLogEntry): ExerciseLogEntry {
  if (!log.isWarmupBlock || !log.warmupItems?.length) return log;
  const allDone = log.warmupItems.every((w) => w.completed);
  const sets = log.sets.map((s, idx) =>
    idx === 0 ? { ...s, completed: allDone, reps: 0, weight: 0 } : s
  );
  return { ...log, sets };
}

export function expandCompletedExercisesForHistory(
  trackingExercises: TrackableExercise[],
  logs: ExerciseLogEntry[]
): TrackableExercise[] {
  const out: TrackableExercise[] = [];
  for (let i = 0; i < trackingExercises.length; i += 1) {
    const ex = trackingExercises[i];
    const log = logs[i];
    if (!log?.sets.some((s) => s.completed)) continue;

    if (ex.isWarmupBlock && ex.warmupItems?.length) {
      for (const item of ex.warmupItems) {
        const itemLog = log.warmupItems?.find((w) => w.id === item.id);
        if (!itemLog?.completed && !log.sets[0]?.completed) continue;
        if (itemLog?.completed || log.sets[0]?.completed) {
          out.push({
            id: item.id,
            name: item.name,
            sets: 1,
            reps: 0,
            weight: 0,
            completed: true,
            category: 'flexibility',
            durationSeconds: item.durationSeconds,
            phase: 'Warm-Up',
          });
        }
      }
      continue;
    }

    out.push({
      id: log.exerciseId,
      name: log.exerciseName,
      sets: log.totalSets,
      reps: log.sets[0]?.reps ?? ex.reps ?? 0,
      weight: log.sets[0]?.weight ?? 0,
      completed: true,
      category: ex.category ?? 'strength',
      durationSeconds: ex.durationSeconds,
      phase: ex.phase,
    });
  }
  return out;
}

/**
 * Experience toggle → Movement Intelligence plan design.
 *
 * Beginner / intermediate / advanced (competitive maps to advanced) drives:
 *  - which complexity band of exercises belong in the plan (see exerciseSelectionRanking)
 *  - how those chosen lifts are programmed (sets, reps, rest, session shape, split)
 *
 * Uses MI demand metadata (technicalComplexity, coordination, balance, strength,
 * compositeDifficulty) — not catalog difficulty labels alone.
 */

import type { ExerciseData } from '../data/exerciseDatabase';
import type { SelectionExperienceLevel } from '../types/exerciseSelection';
import { clampWorkingSets } from '../utils/progressionLimits';
import {
  demandLevelRank,
  snapshotExerciseDemands,
  toSelectionExperienceLevel,
} from './exerciseSelectionRanking';

export type PlanExerciseRole = 'main' | 'secondary' | 'accessory' | 'finisher' | 'general';

export type MiPrescription = {
  sets: number;
  reps: number;
  restTime?: number;
};

export type SessionShape = {
  exercisesPerDay: number;
  accessoryCount: number;
  mainLiftSets: number;
  secondarySets: number;
  accessorySets: number;
};

const COMPOUND_PATTERNS = new Set(['squat', 'hinge', 'push', 'pull', 'lunge']);

export { toSelectionExperienceLevel };

export function designSessionShape(level: SelectionExperienceLevel): SessionShape {
  if (level === 'beginner') {
    return {
      exercisesPerDay: 4,
      accessoryCount: 3,
      mainLiftSets: 3,
      secondarySets: 3,
      accessorySets: 2,
    };
  }
  if (level === 'intermediate') {
    return {
      exercisesPerDay: 5,
      accessoryCount: 4,
      mainLiftSets: 4,
      secondarySets: 3,
      accessorySets: 3,
    };
  }
  return {
    exercisesPerDay: 6,
    accessoryCount: 5,
    mainLiftSets: 4,
    secondarySets: 4,
    accessorySets: 3,
  };
}

/**
 * Beginners recover and learn better with full-body / upper-lower frequency
 * than body-part PPL splits. Only remaps Push/Pull/Legs days.
 */
export function biasSplitFocusesForExperience(
  focuses: string[],
  level: SelectionExperienceLevel,
  days: number
): string[] {
  if (level !== 'beginner' || focuses.length === 0) return focuses;
  const pplCount = focuses.filter((f) => /^(Push|Pull|Legs)$/i.test(f.trim())).length;
  if (pplCount < Math.min(3, focuses.length)) return focuses;
  if (days <= 3) return focuses.map(() => 'Full Body');
  const ul = ['Upper Body', 'Lower Body'];
  return focuses.map((_, i) => {
    if (days >= 5 && i === 2) return 'Full Body';
    return ul[i % 2];
  });
}

function isLoadedCompound(ex: ExerciseData): boolean {
  const pattern = ex.movementPattern;
  const secondaries = ex.secondaryMuscleGroups?.length ?? 0;
  return secondaries > 0 && !!pattern && COMPOUND_PATTERNS.has(pattern);
}

/**
 * Scale a goal/experience base prescription using this exercise's MI demands.
 * High-skill work stays technical (fewer grind sets); simple isolation stays
 * higher-rep; beginners keep technique volume instead of 5-rep loading.
 */
export function applyMiDemandToPrescription(
  base: MiPrescription,
  ex: ExerciseData,
  level: SelectionExperienceLevel,
  opts?: { goal?: string; role?: PlanExerciseRole }
): MiPrescription {
  const role = opts?.role ?? 'general';
  const goal = opts?.goal ?? 'strength';
  const category = ex.category;
  const d = snapshotExerciseDemands(ex);
  const tech = demandLevelRank(d.technicalComplexity);
  const str = demandLevelRank(d.strength);
  const bal = demandLevelRank(d.balance);
  const coord = demandLevelRank(d.coordination);
  const composite = d.compositeDifficulty;
  const skill = tech >= 2 || (coord >= 2 && bal >= 1);
  const simple = composite <= 0.28 && tech === 0;
  const compound = isLoadedCompound(ex);
  const phase =
    role === 'accessory' || role === 'finisher' ? 'accessory' : role === 'main' ? 'main' : undefined;

  let sets = base.sets;
  let reps = base.reps;
  let restTime = base.restTime;

  if (category === 'cardio') {
    if (level === 'beginner') reps = Math.min(reps, 20);
    else if (level === 'advanced') reps = Math.max(reps, 30);
    return { sets: 1, reps, restTime };
  }

  if (category === 'flexibility' || category === 'balance' || category === 'stability') {
    if (level === 'beginner') {
      sets = Math.min(sets, 2);
      reps = Math.min(Math.max(reps, 20), 30);
    } else if (level === 'advanced') {
      sets = Math.max(sets, 2);
      reps = Math.max(reps, 45);
    }
    return { sets: Math.max(1, sets), reps, restTime };
  }

  // Isolation / low-complexity: practice and hypertrophy, not 5-rep loading.
  if (role === 'accessory' || role === 'finisher' || (!compound && simple)) {
    if (level === 'beginner') {
      reps = Math.max(reps, 10);
      if (restTime != null) restTime = Math.min(restTime, 60);
    } else {
      reps = Math.max(reps, goal === 'strength' ? 8 : 10);
      if (restTime != null) restTime = Math.min(Math.max(restTime, 45), 75);
    }
  }

  // High technical / coordination demand: motor learning, extra rest.
  if (skill) {
    sets = Math.min(sets, level === 'beginner' ? 3 : 4);
    if (level === 'beginner') {
      reps = Math.min(Math.max(reps, 6), 8);
      restTime = Math.max(restTime ?? 90, 120);
    } else {
      reps = Math.min(Math.max(reps, 3), 6);
      restTime = Math.max(restTime ?? 120, 150);
    }
  }

  // Loaded compounds (as mains / secondaries): beginner = technique volume; advanced = intensity.
  if (compound && str >= 1 && role !== 'accessory' && role !== 'finisher') {
    if (level === 'beginner') {
      sets = Math.min(sets, 3);
      reps = Math.max(reps, goal === 'strength' ? 8 : 10);
      restTime = Math.max(restTime ?? 90, 90);
      if (composite > 0.45) {
        sets = Math.max(2, sets - 1);
        restTime = (restTime ?? 90) + 20;
      }
    } else if (level === 'intermediate') {
      restTime = Math.max(restTime ?? 90, 120);
    } else {
      if (role === 'main') sets = Math.max(sets, 4);
      if (goal === 'strength' && str >= 2) reps = Math.min(reps, 5);
      restTime = Math.max(restTime ?? 120, 150);
    }
  }

  // Advanced: don't treat elementary drills like main lifts.
  if (level === 'advanced' && simple && role !== 'main') {
    sets = Math.min(sets, 3);
    reps = Math.max(reps, 10);
    if (restTime != null) restTime = Math.min(restTime, 75);
  }

  if (level === 'beginner' && role === 'accessory') {
    sets = Math.min(sets, 2);
  }

  const clampedSets =
    category === 'strength' ? clampWorkingSets(sets, phase) : Math.max(1, Math.round(sets));

  return {
    sets: clampedSets,
    reps: Math.max(1, Math.round(reps)),
    restTime,
  };
}

/**
 * Order plan-row exercises (already converted) so the main lift matches
 * experience MI complexity: beginner → safer compound first, advanced → harder first.
 */
export function orderPlanExercisesForExperience<T extends { name: string }>(
  exercises: T[],
  catalogOf: (ex: T) => ExerciseData | undefined,
  level: SelectionExperienceLevel
): T[] {
  if (exercises.length <= 1) return [...exercises];
  const withData = exercises.map((ex) => ({ ex, data: catalogOf(ex) }));
  const known = withData.filter((x): x is { ex: T; data: ExerciseData } => !!x.data);
  const unknown = withData.filter((x) => !x.data).map((x) => x.ex);
  if (known.length <= 1) return [...exercises];

  known.sort((a, b) => {
    const da = snapshotExerciseDemands(a.data);
    const db = snapshotExerciseDemands(b.data);
    if (level === 'advanced') {
      return db.compositeDifficulty - da.compositeDifficulty || a.data.name.localeCompare(b.data.name);
    }
    if (level === 'beginner') {
      const score = (d: typeof da) =>
        Math.abs(d.compositeDifficulty - 0.22) +
        demandLevelRank(d.technicalComplexity) * 0.25 +
        demandLevelRank(d.balance) * 0.15;
      return score(da) - score(db) || a.data.name.localeCompare(b.data.name);
    }
    return Math.abs(da.compositeDifficulty - 0.48) - Math.abs(db.compositeDifficulty - 0.48);
  });

  return [...known.map((x) => x.ex), ...unknown];
}

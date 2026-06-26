/**
 * Pure plan adaptation logic (no React Native / storage) — safe for scripts and tests.
 */

import type { ChallengeDial } from '../types/coachingProfile';
import {
  nextCalisthenicsProgression,
  type ProgressionLever,
} from './GoalDrivenCoaching';
import {
  MAX_WORKING_SETS,
  MAX_ACCESSORY_SETS,
  MIN_WORKING_SETS,
  clampWorkingSets,
  canAddWorkingSet,
  maxWorkingSetsFor,
  isAccessoryPhase,
  applyWeightProgression,
  roundToPlateWeight,
  weightProgressionBump,
  MIN_WEIGHT_PROGRESSION_LBS,
  INTENSIFY_WEIGHT_PROGRESSION_LBS,
} from '../utils/progressionLimits';
import {
  isHeavyCompound,
  maxRepCapForExercise,
  nextLoadOrRepProgression,
  type RepCapContext,
} from '../utils/compoundRepCaps';

export type AdaptiveAction =
  | 'maintain'
  | 'progress'
  | 'regress'
  | 'deload'
  | 'simplify'
  | 'intensify';

export const SET_CAPS = {
  mainLift: MAX_WORKING_SETS,
  accessory: MAX_ACCESSORY_SETS,
  minSets: MIN_WORKING_SETS,
  /** Default fallback — use maxRepCapForExercise() for goal-aware caps. */
  compoundMaxReps: 12,
  isolationMaxReps: 15,
  /** Standard progression bump (minimum 5 lb). */
  weightBumpLbs: MIN_WEIGHT_PROGRESSION_LBS,
  intensifyWeightBumpLbs: INTENSIFY_WEIGHT_PROGRESSION_LBS,
} as const;

export interface AdaptableExercise {
  id?: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  category?: string;
  phase?: string;
  muscleGroups?: string[];
  durationSeconds?: number;
}

export interface AdaptableWeeklyPlan {
  weekDays: Array<{
    dayName?: string;
    exercises: AdaptableExercise[];
    duration?: number;
  }>;
}

export interface PlanAdaptationChange {
  exerciseName: string;
  exerciseId?: string;
  field: 'sets' | 'reps' | 'weight';
  oldValue: number;
  newValue: number;
  reason: string;
}

export interface PlanAdaptationResult {
  plan: AdaptableWeeklyPlan;
  changes: PlanAdaptationChange[];
  action: AdaptiveAction;
  applied: boolean;
}

/** Minimal session shape for performance analysis (scripts / tests). */
export interface AdaptationWorkoutSession {
  completed: boolean;
  date: string;
  exercises?: Array<{
    name?: string;
    exerciseId?: string;
    sets?: Array<{ completed?: boolean; weight?: number; reps?: number }>;
  }>;
}

type WeekPerf = { weight: number; reps: number; sets: number; completionPct: number };

function toKey(name: string, id?: string): string {
  return (id || name).toLowerCase().replace(/\s+/g, '-');
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toISOString().slice(0, 10);
}

function isStrengthWork(ex: AdaptableExercise): boolean {
  if (ex.durationSeconds != null && ex.durationSeconds > 0) return false;
  return ex.category === 'strength' || ex.category === 'cardio';
}

function maxSetsFor(ex: AdaptableExercise): number {
  return maxWorkingSetsFor(ex.phase);
}

function isCompound(ex: AdaptableExercise): boolean {
  return isHeavyCompound(ex);
}

function maxRepsFor(ex: AdaptableExercise, repCtx: RepCapContext): number {
  return maxRepCapForExercise(ex, repCtx);
}

function roundWeight(w: number): number {
  return roundToPlateWeight(w);
}

function buildPerformanceMap(history: AdaptationWorkoutSession[]): Map<string, WeekPerf[]> {
  const map = new Map<string, WeekPerf[]>();
  const completed = history
    .filter((w) => w.completed && w.exercises?.length && w.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const seenWeekByKey = new Map<string, Set<string>>();

  for (const session of completed) {
    const weekKey = getWeekKey(session.date);
    for (const ex of session.exercises ?? []) {
      if (!ex.name) continue;
      const key = toKey(ex.name, ex.exerciseId);
      let weeks = seenWeekByKey.get(key);
      if (!weeks) {
        weeks = new Set();
        seenWeekByKey.set(key, weeks);
      }
      if (weeks.has(weekKey)) continue;
      weeks.add(weekKey);

      const sets = ex.sets?.filter((s) => s.completed) ?? [];
      if (!sets.length) continue;
      const avgWeight = sets.reduce((s, set) => s + (set.weight || 0), 0) / sets.length;
      const avgReps = sets.reduce((s, set) => s + (set.reps || 0), 0) / sets.length;
      const completionPct = ex.sets?.length
        ? Math.round((sets.length / ex.sets.length) * 100)
        : 100;

      let list = map.get(key);
      if (!list) {
        list = [];
        map.set(key, list);
      }
      list.push({
        weight: avgWeight,
        reps: Math.round(avgReps),
        sets: sets.length,
        completionPct,
      });
    }
  }
  return map;
}

function adaptExercise(
  ex: AdaptableExercise,
  perf: WeekPerf | undefined,
  action: AdaptiveAction,
  progressionAllowed: boolean,
  challengeDial: ChallengeDial | null,
  progressionLever: ProgressionLever = 'balanced',
  repCtx: RepCapContext = {}
): { exercise: AdaptableExercise; changes: PlanAdaptationChange[] } {
  const changes: PlanAdaptationChange[] = [];
  if (!isStrengthWork(ex)) return { exercise: ex, changes };

  const repContext: RepCapContext = {
    progressionLever,
    ...repCtx,
  };
  const maxSets = maxSetsFor(ex);
  const maxReps = maxRepsFor(ex, repContext);
  const compound = isCompound(ex);
  let sets = ex.sets;
  let reps = typeof ex.reps === 'number' ? ex.reps : parseInt(String(ex.reps), 10) || 8;
  let weight = ex.weight ?? 0;

  const pushChange = (field: 'sets' | 'reps' | 'weight', oldValue: number, newValue: number, reason: string) => {
    if (oldValue === newValue) return;
    changes.push({
      exerciseName: ex.name,
      exerciseId: ex.id,
      field,
      oldValue,
      newValue,
      reason,
    });
  };

  if (action === 'maintain') {
    if (perf && perf.weight > 0) {
      const nw = roundWeight(perf.weight);
      pushChange('weight', weight, nw, 'Sync to recent performance');
      weight = nw;
    }
    return { exercise: { ...ex, sets, reps, weight }, changes };
  }

  if (action === 'simplify') {
    if (sets > MIN_WORKING_SETS) {
      if (isAccessoryPhase(ex.phase) || sets > maxSets) {
        pushChange('sets', sets, Math.max(MIN_WORKING_SETS, sets - 1), 'Simplify — reduce volume');
        sets = Math.max(MIN_WORKING_SETS, sets - 1);
      }
    }
    return { exercise: { ...ex, sets, reps, weight }, changes };
  }

  if (action === 'deload') {
    if (weight > 0) {
      const nw = roundWeight(weight * 0.9);
      pushChange('weight', weight, nw, 'Deload — reduce load ~10%');
      weight = nw;
    }
    if (sets > MIN_WORKING_SETS) {
      pushChange('sets', sets, Math.max(MIN_WORKING_SETS, sets - 1), 'Deload — trim one set');
      sets = Math.max(MIN_WORKING_SETS, sets - 1);
    }
    if (reps > 5) {
      pushChange('reps', reps, reps - 1, 'Deload — slightly fewer reps');
      reps = reps - 1;
    }
    return { exercise: { ...ex, sets, reps, weight }, changes };
  }

  if (action === 'regress') {
    if (weight > 0) {
      const nw = roundToPlateWeight(Math.max(0, weight - SET_CAPS.weightBumpLbs));
      pushChange('weight', weight, nw, 'Regress — lighter load to rebuild consistency');
      weight = nw;
    } else if (reps > 5) {
      pushChange('reps', reps, Math.max(5, reps - 2), 'Regress — fewer reps');
      reps = Math.max(5, reps - 2);
    }
    return { exercise: { ...ex, sets, reps, weight }, changes };
  }

  if ((action === 'progress' || action === 'intensify') && !progressionAllowed) {
    return { exercise: ex, changes };
  }

  if (!perf || perf.completionPct < 75) {
    return { exercise: ex, changes };
  }

  const dial = challengeDial ?? 'balanced';
  const isBodyweightProgression =
    progressionLever === 'exercise_difficulty' && (ex.weight ?? 0) <= 0;

  if (
    isBodyweightProgression &&
    (action === 'progress' || action === 'intensify') &&
    perf.completionPct >= 85
  ) {
    const harder = nextCalisthenicsProgression(ex.name);
    if (harder && harder.toLowerCase() !== ex.name.toLowerCase()) {
      changes.push({
        exerciseName: ex.name,
        exerciseId: ex.id,
        field: 'reps',
        oldValue: reps,
        newValue: reps,
        reason: `Calisthenics progression → ${harder}`,
      });
      return {
        exercise: { ...ex, name: harder, sets, reps, weight: 0 },
        changes,
      };
    }
  }

  const allowSetIncrease =
    dial !== 'easy' &&
    canAddWorkingSet(sets, ex.phase) &&
    perf.completionPct >= 90 &&
    action === 'progress';

  if (allowSetIncrease) {
    const nextSets = sets + 1;
    pushChange('sets', sets, nextSets, 'Earned progression — add one set (below 4-set cap)');
    sets = nextSets;
  } else if (!canAddWorkingSet(sets, ex.phase) || sets >= maxSets) {
    const bump = weightProgressionBump(action === 'intensify');
    const step = nextLoadOrRepProgression({
      reps,
      weight,
      perfReps: perf.reps,
      maxReps,
      weightBumpLbs: bump,
      progressionLever,
      isCompound: compound,
      roundWeight: (_w) => applyWeightProgression(weight, bump),
      repBump: action === 'intensify' ? 2 : 1,
    });
    if (step.kind === 'load') {
      pushChange('weight', weight, step.weight, step.reason);
      weight = step.weight;
      if (step.reps !== reps) {
        pushChange('reps', reps, step.reps, step.reason);
        reps = step.reps;
      }
    } else if (step.kind === 'reps') {
      pushChange('reps', reps, step.reps, `At ${maxSets} sets — progress via reps (cap ${maxReps})`);
      reps = step.reps;
    }
  } else if (perf.weight > 0) {
    const nw = roundWeight(perf.weight);
    if (nw !== weight) {
      pushChange('weight', weight, nw, 'Match recent working weight');
      weight = nw;
    }
    if (perf.reps > reps && reps < maxReps) {
      const matched = Math.min(maxReps, perf.reps);
      pushChange('reps', reps, matched, 'Match recent rep performance');
      reps = matched;
    }
  }

  sets = clampWorkingSets(sets, ex.phase);
  reps = Math.min(maxReps, Math.max(1, reps));

  return { exercise: { ...ex, sets, reps, weight }, changes };
}

export function applyAdaptiveActionToWeeklyPlan(
  weeklyPlan: AdaptableWeeklyPlan,
  history: AdaptationWorkoutSession[],
  ctx: {
    adaptiveRecommendation: AdaptiveAction;
    progressionAllowed: boolean;
    challengeDial?: ChallengeDial | null;
    progressionLever?: ProgressionLever;
  }
): PlanAdaptationResult {
  const action = ctx.adaptiveRecommendation;
  const perfMap = buildPerformanceMap(history);
  const allChanges: PlanAdaptationChange[] = [];

  const weekDays = weeklyPlan.weekDays.map((day) => ({
    ...day,
    exercises: day.exercises.map((ex) => {
      const key = toKey(ex.name, ex.id);
      const perf =
        perfMap.get(key)?.[0] ?? perfMap.get(toKey(ex.name))?.[0];
      const { exercise, changes } = adaptExercise(
        ex,
        perf,
        action,
        ctx.progressionAllowed,
        ctx.challengeDial ?? null,
        ctx.progressionLever ?? 'balanced'
      );
      allChanges.push(...changes);
      return exercise;
    }),
  }));

  return {
    plan: { weekDays },
    changes: allChanges,
    action,
    applied: allChanges.length > 0,
  };
}

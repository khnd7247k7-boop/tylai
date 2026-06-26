/**
 * Goal-based rep ceilings for heavy compounds — past the cap, progress load (not endless reps).
 */

import type { PrimaryGoal } from '../types/coachingProfile';
import type { ProgressionLever } from '../services/GoalDrivenCoaching';
import { resolveProgressionLever } from '../services/GoalDrivenCoaching';

export interface RepCapContext {
  progressionLever?: ProgressionLever | null;
  primaryGoal?: PrimaryGoal | null;
}

const COMPOUND_NAME =
  /bench|squat|deadlift|overhead press|military press|shoulder press|barbell row|bent-over row|pull-up|chin-up|hip thrust|romanian deadlift|\brdl\b|lunge|leg press|clean|snatch|thruster/i;

export function isHeavyCompound(ex: {
  phase?: string;
  muscleGroups?: string[];
  secondaryMuscleGroups?: string[];
  name?: string;
}): boolean {
  const phase = (ex.phase ?? '').toLowerCase();
  if (phase.includes('main lift') || phase.includes('secondary lift')) return true;
  const primary = ex.muscleGroups?.length ?? 0;
  const secondary = ex.secondaryMuscleGroups?.length ?? 0;
  if (primary >= 1 && secondary >= 1) return true;
  if ((ex.muscleGroups?.length ?? 0) > 1) return true;
  return COMPOUND_NAME.test(ex.name ?? '');
}

function resolveLever(ctx: RepCapContext): ProgressionLever {
  if (ctx.progressionLever) return ctx.progressionLever;
  return resolveProgressionLever(ctx.primaryGoal ?? null);
}

/** Max reps before the coach must add load (or harder movement) instead of more reps. */
export function maxRepCapForExercise(
  ex: {
    phase?: string;
    muscleGroups?: string[];
    secondaryMuscleGroups?: string[];
    name?: string;
  },
  ctx: RepCapContext
): number {
  const lever = resolveLever(ctx);
  const compound = isHeavyCompound(ex);

  if (compound) {
    switch (lever) {
      case 'load':
        return 6;
      case 'volume':
        return 12;
      case 'nutrition':
        return 12;
      case 'reps_endurance':
        return 10;
      case 'exercise_difficulty':
        return 15;
      case 'balanced':
      default:
        return 12;
    }
  }

  switch (lever) {
    case 'load':
      return 12;
    case 'volume':
      return 20;
    default:
      return 15;
  }
}

/** After a load bump at the rep ceiling, reset to a productive lower rep range. */
export function repTargetAfterLoadBump(maxReps: number, lever: ProgressionLever): number {
  if (lever === 'load') return Math.max(4, Math.min(5, maxReps - 1));
  if (lever === 'volume') return Math.max(8, Math.min(10, Math.floor(maxReps * 0.67)));
  return Math.max(6, Math.floor(maxReps * 0.75));
}

export type LoadRepProgressionResult =
  | { kind: 'none' }
  | { kind: 'reps'; reps: number }
  | { kind: 'load'; weight: number; reps: number; reason: string };

/**
 * At set cap: prefer load over rep creep on heavy compounds once at/above goal rep max.
 */
export function nextLoadOrRepProgression(opts: {
  reps: number;
  weight: number;
  perfReps: number;
  maxReps: number;
  weightBumpLbs: number;
  progressionLever: ProgressionLever;
  isCompound: boolean;
  roundWeight: (w: number) => number;
  repBump?: number;
}): LoadRepProgressionResult {
  const {
    reps,
    weight,
    perfReps,
    maxReps,
    weightBumpLbs,
    progressionLever,
    isCompound,
    roundWeight,
    repBump = 1,
  } = opts;

  const atOrAboveCap = reps >= maxReps || perfReps >= maxReps;

  if (weight > 0 && atOrAboveCap && isCompound) {
    const nw = roundWeight(weight + weightBumpLbs);
    const resetReps = repTargetAfterLoadBump(maxReps, progressionLever);
    return {
      kind: 'load',
      weight: nw,
      reps: Math.min(reps, resetReps),
      reason: `At ${maxReps} rep cap — add load and work ${resetReps}s for progressive overload`,
    };
  }

  if (weight > 0 && perfReps >= maxReps - 1 && isCompound && progressionLever === 'load') {
    const nw = roundWeight(weight + weightBumpLbs);
    const resetReps = repTargetAfterLoadBump(maxReps, progressionLever);
    return {
      kind: 'load',
      weight: nw,
      reps: Math.min(reps, resetReps),
      reason: `Strength focus — add load at ${maxReps} reps or below`,
    };
  }

  if (reps < maxReps) {
    return { kind: 'reps', reps: Math.min(maxReps, reps + repBump) };
  }

  return { kind: 'none' };
}

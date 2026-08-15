/**
 * Earned Progression Engine
 *
 * Decides how to progress or regress each exercise using:
 * completed vs prescribed reps, load, RPE/RIR, competency, movement quality,
 * stability, discomfort/tolerance, recovery, consistency.
 *
 * Progression is earned — not automatic weekly increases.
 * Regression is temporary support — never a permanent “bad” label.
 *
 * Path: Learn → Control → Strengthen → Load → Progress → Specialize
 *
 * Integrates with Workout Builder via applyEarnedProgressionToWeeklyPlan().
 */

import type { WorkoutSession } from '../../data/workoutPrograms';
import {
  getExerciseById,
  getExerciseData,
  type ExerciseData,
} from '../data/exerciseDatabase';
import {
  COMPETENCY_LEVEL_RANK,
  type ExerciseCompetencyRecord,
} from '../types/exerciseCompetency';
import type {
  ProgressionDecision,
  ProgressionMethod,
  ProgressionStage,
} from '../types/progressionEngine';
import type { WorkoutBuilderMiContext } from './WorkoutBuilderMiIntegration';
import { findMatchingConstraints } from './WorkoutBuilderMiIntegration';
import {
  evaluateExerciseCompetency,
  resolveCatalogExercise,
} from './ExerciseCompetencyService';
import {
  applyWeightProgression,
  canAddWorkingSet,
  clampWorkingSets,
  MIN_WEIGHT_PROGRESSION_LBS,
  roundToPlateWeight,
} from '../utils/progressionLimits';
import {
  isHeavyCompound,
  maxRepCapForExercise,
} from '../utils/compoundRepCaps';

/** Builder exercise shape (WorkoutScreen-compatible). */
export type ProgressionPlanExercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  category?: string;
  phase?: string;
  muscleGroups?: string[];
  equipment?: string | string[];
  durationSeconds?: number;
  restTime?: number;
  movementPattern?: string;
  difficulty?: string;
};

export type WeeklyDayPlan = {
  dayName: string;
  focus: string;
  duration: number;
  exercises: ProgressionPlanExercise[];
};

export type WeeklyPlanLike = {
  weekDays: WeeklyDayPlan[];
};

export type ProgressionEngineInput = {
  plan: WeeklyPlanLike;
  history: WorkoutSession[];
  level: string;
  recoveryScore?: number;
  /** Optional MI context from builder (developing focuses, constraints). */
  miContext?: WorkoutBuilderMiContext | null;
  /** Precomputed competency by exercise id/name. */
  competencyById?: Record<string, ExerciseCompetencyRecord>;
  now?: string;
};

type PerfSnapshot = {
  sessions: number;
  avgCompletedReps: number;
  avgPrescribedReps: number;
  avgLoad: number;
  avgRpe?: number;
  avgRir?: number;
  completionRate: number;
  hitPrescribedStreak: number;
  missedRepsStreak: number;
  spanDays: number;
  consistencyOk: boolean;
};

const PLYOMETRIC_NAME =
  /jump|hop|bound|plyo|depth jump|box jump|skip|sprint|medicine ball slam/i;

function nameKey(s: string): string {
  return s.trim().toLowerCase();
}

function catalogFor(ex: ProgressionPlanExercise): ExerciseData | undefined {
  return getExerciseById(ex.id) || getExerciseData(ex.name) || resolveCatalogExercise(ex.id);
}

function collectPerf(
  history: WorkoutSession[],
  exercise: ProgressionPlanExercise
): PerfSnapshot {
  const id = exercise.id;
  const name = nameKey(exercise.name);
  const points: Array<{
    date: string;
    completedReps: number;
    prescribedReps: number;
    load: number;
    completionRate: number;
    rpe?: number;
    rir?: number;
  }> = [];

  const sorted = [...history]
    .filter((s) => s.completed)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  for (const session of sorted) {
    for (const ex of session.exercises ?? []) {
      const match =
        (ex.exerciseId && ex.exerciseId === id) ||
        nameKey(ex.name || '') === name ||
        getExerciseData(ex.name || '')?.id === id;
      if (!match) continue;
      const sets = ex.sets ?? [];
      if (!sets.length) continue;
      const completed = sets.filter((s) => s.completed);
      const repsDone =
        completed.reduce((a, s) => a + (Number(s.reps) || 0), 0) /
        Math.max(1, completed.length);
      const prescribed = exercise.reps || repsDone;
      const avgWeight =
        completed.reduce((a, s) => a + (Number(s.weight) || 0), 0) /
        Math.max(1, completed.length);
      const rpes = completed
        .map((s) => s.rpe)
        .filter((n): n is number => typeof n === 'number');
      const rirs = completed
        .map((s) => s.rir)
        .filter((n): n is number => typeof n === 'number');
      points.push({
        date: session.date,
        completedReps: repsDone,
        prescribedReps: prescribed,
        load: avgWeight * repsDone,
        completionRate: completed.length / sets.length,
        rpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : undefined,
        rir: rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : undefined,
      });
      break;
    }
  }

  const chronological = [...points].reverse();
  let hitStreak = 0;
  let missStreak = 0;
  for (let i = chronological.length - 1; i >= 0; i -= 1) {
    const p = chronological[i];
    const hit = p.completedReps >= p.prescribedReps * 0.95 && p.completionRate >= 0.8;
    if (hit) {
      if (missStreak === 0) hitStreak += 1;
      else break;
    } else {
      if (hitStreak === 0) missStreak += 1;
      else break;
    }
  }

  const spanDays =
    points.length >= 2
      ? Math.abs(
          (new Date(points[0].date).getTime() -
            new Date(points[points.length - 1].date).getTime()) /
            (24 * 3600 * 1000)
        )
      : 0;

  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

  // Consistency: enough sessions, not all crammed into one day, not only ancient outliers
  const consistencyOk =
    points.length >= 2 &&
    (points.length >= 3 || spanDays >= 3) &&
    spanDays <= 45;

  return {
    sessions: points.length,
    avgCompletedReps: avg(points.map((p) => p.completedReps)),
    avgPrescribedReps: avg(points.map((p) => p.prescribedReps)) || exercise.reps || 0,
    avgLoad: avg(points.map((p) => p.load)),
    avgRpe: (() => {
      const xs = points.map((p) => p.rpe).filter((n): n is number => n != null);
      return xs.length ? avg(xs) : undefined;
    })(),
    avgRir: (() => {
      const xs = points.map((p) => p.rir).filter((n): n is number => n != null);
      return xs.length ? avg(xs) : undefined;
    })(),
    completionRate: avg(points.map((p) => p.completionRate)),
    hitPrescribedStreak: hitStreak,
    missedRepsStreak: missStreak,
    spanDays,
    consistencyOk,
  };
}

function stageFromCompetency(c?: ExerciseCompetencyRecord): ProgressionStage {
  if (!c || c.competencyLevel === 'unfamiliar') return 'learn';
  if (c.competencyLevel === 'learning') return 'control';
  if (c.competencyLevel === 'competent') return 'strengthen';
  if (c.competencyLevel === 'proficient') return 'load';
  return 'specialize';
}

function shouldRegress(args: {
  perf: PerfSnapshot;
  competency?: ExerciseCompetencyRecord;
  recoveryScore?: number;
  miContext?: WorkoutBuilderMiContext | null;
  exerciseName: string;
}): boolean {
  const { perf, competency, recoveryScore, miContext, exerciseName } = args;
  if (competency?.movementTolerance === 'poor' || competency?.movementTolerance === 'limited') {
    return true;
  }
  if (competency?.movementQuality === 'poor') return true;
  if (competency?.performanceTrend === 'declining') return true;
  if (perf.missedRepsStreak >= 2) return true;
  if (perf.sessions >= 2 && perf.completionRate < 0.65) return true;
  if (typeof perf.avgRpe === 'number' && perf.avgRpe >= 9.5 && perf.missedRepsStreak >= 1) {
    return true;
  }
  if (typeof perf.avgRir === 'number' && perf.avgRir <= 0 && perf.missedRepsStreak >= 1) {
    return true;
  }
  if (typeof recoveryScore === 'number' && recoveryScore < 40 && perf.missedRepsStreak >= 1) {
    return true;
  }
  const avoid = miContext?.hardAvoidNames?.some(
    (n) => nameKey(n) === nameKey(exerciseName)
  );
  if (avoid) return true;
  const modifying = miContext?.modifyExerciseNames?.some(
    (n) => nameKey(n) === nameKey(exerciseName)
  );
  if (modifying && perf.missedRepsStreak >= 1) {
    return true;
  }
  return false;
}

function earnedProgressGate(args: {
  perf: PerfSnapshot;
  competency?: ExerciseCompetencyRecord;
  recoveryScore?: number;
}): { ok: boolean; reasons: string[] } {
  const { perf, competency, recoveryScore } = args;
  const reasons: string[] = [];
  if (perf.sessions < 2) reasons.push('need_more_sessions');
  if (!perf.consistencyOk) reasons.push('need_consistent_practice');
  if (perf.hitPrescribedStreak < 2) reasons.push('need_rep_target_streak');
  if (perf.completionRate < 0.85) reasons.push('incomplete_sets');
  if (typeof recoveryScore === 'number' && recoveryScore < 45) {
    reasons.push('recovery_too_low');
  }
  if (competency?.movementTolerance === 'poor' || competency?.movementTolerance === 'limited') {
    reasons.push('tolerance_limits');
  }
  if (competency?.movementQuality === 'poor') reasons.push('movement_quality_limits');
  if (typeof perf.avgRpe === 'number' && perf.avgRpe >= 9) {
    reasons.push('rpe_too_high_to_progress');
  }
  if (typeof perf.avgRir === 'number' && perf.avgRir < 1 && perf.hitPrescribedStreak < 3) {
    reasons.push('insufficient_rir_reserve');
  }
  return { ok: reasons.length === 0, reasons };
}

/** Exercise swaps: competency.progressionReady OR strong earned evidence. */
function canEarnExerciseSwap(
  competency: ExerciseCompetencyRecord | undefined,
  perf: PerfSnapshot
): boolean {
  if (competency?.progressionReady) return true;
  const rank = COMPETENCY_LEVEL_RANK[competency?.competencyLevel ?? 'unfamiliar'];
  if (rank < COMPETENCY_LEVEL_RANK.competent) return false;
  if (perf.hitPrescribedStreak < 3 || perf.sessions < 3 || !perf.consistencyOk) return false;
  if (
    competency?.movementTolerance === 'poor' ||
    competency?.movementTolerance === 'limited' ||
    competency?.movementTolerance === 'needs_assessment'
  ) {
    return false;
  }
  if (competency?.movementQuality === 'poor') return false;
  if (competency?.performanceTrend === 'declining') return false;
  return true;
}

function pickRegressionTarget(
  catalog: ExerciseData | undefined,
  competency?: ExerciseCompetencyRecord
): ExerciseData | undefined {
  const names = catalog?.regressions ?? [];
  if (!names.length) return undefined;
  const resolved = names
    .map((n) => getExerciseData(n))
    .filter((e): e is ExerciseData => !!e);
  if (!resolved.length) return undefined;

  // Stronger struggle → prefer clearly easier pattern (lunge / bodyweight / supported)
  const strong =
    competency?.movementTolerance === 'poor' ||
    competency?.movementTolerance === 'limited' ||
    competency?.movementQuality === 'poor';
  if (strong) {
    const from = (catalog?.name ?? '').toLowerCase();
    const preferred =
      resolved.find((e) => {
        const n = e.name.toLowerCase();
        // Avoid same lift with lighter implement (e.g. Bulgarian → Bulgarian DB)
        if (from.includes('bulgarian') && n.includes('bulgarian')) return false;
        if (from.includes('squat') && !from.includes('split') && /smith|front squat|goblet/.test(n)) {
          return true;
        }
        return /bodyweight|assisted|supported|box |goblet|reverse lunge|walking lunge|^lunges|kickstand|one-legged|romanian deadlift/.test(
          n
        );
      }) || resolved.find((e) => e.difficulty === 'beginner');
    if (preferred) return preferred;
  }
  return resolved[0];
}

function pickProgressionTarget(
  catalog: ExerciseData | undefined,
  competency: ExerciseCompetencyRecord | undefined,
  perf: PerfSnapshot
): ExerciseData | undefined {
  if (!catalog?.progressions?.length) return undefined;
  if (!canEarnExerciseSwap(competency, perf)) return undefined;
  const resolved = catalog.progressions
    .map((n) => getExerciseData(n))
    .filter((e): e is ExerciseData => !!e);
  if (!resolved.length) return undefined;

  // Prefer the clearest next step on the skill ladder (e.g. Goblet → Front → Back)
  const preferred =
    resolved.find((e) => /front squat/i.test(e.name)) ||
    resolved.find((e) => e.id === 'squat' || /^squat$/i.test(e.name)) ||
    resolved.find((e) => e.difficulty === 'advanced') ||
    resolved.find((e) => e.difficulty === 'intermediate') ||
    resolved[0];
  return preferred;
}

function pickUnilateralProgression(catalog: ExerciseData | undefined): ExerciseData | undefined {
  if (!catalog) return undefined;
  for (const name of catalog.progressions ?? []) {
    const next = getExerciseData(name);
    if (next && (next.laterality === 'unilateral' || next.laterality === 'alternating')) {
      return next;
    }
  }
  return undefined;
}

function pickReduceSupportProgression(catalog: ExerciseData | undefined): ExerciseData | undefined {
  if (!catalog) return undefined;
  const n = catalog.name.toLowerCase();
  const isSupported = /assisted|supported|knee |incline|machine|smith|band/.test(n);
  if (!isSupported) return undefined;
  for (const name of catalog.progressions ?? []) {
    const next = getExerciseData(name);
    if (!next) continue;
    const nn = next.name.toLowerCase();
    if (!/assisted|knee |incline/.test(nn)) return next;
  }
  return getExerciseData(catalog.progressions?.[0] ?? '');
}

function lastKnownWeight(
  history: WorkoutSession[],
  exercise: ProgressionPlanExercise
): number | undefined {
  for (const s of history) {
    if (!s.completed) continue;
    for (const ex of s.exercises ?? []) {
      if (nameKey(ex.name || '') !== nameKey(exercise.name) && ex.exerciseId !== exercise.id) {
        continue;
      }
      const sets = (ex.sets ?? []).filter((x) => x.completed && (x.weight || 0) > 0);
      if (sets.length) {
        return Math.max(...sets.map((x) => Number(x.weight) || 0));
      }
    }
  }
  return exercise.weight && exercise.weight > 0 ? exercise.weight : undefined;
}

/**
 * Pure decision for one planned exercise.
 */
export function decideExerciseProgression(input: {
  exercise: ProgressionPlanExercise;
  history: WorkoutSession[];
  competency?: ExerciseCompetencyRecord;
  recoveryScore?: number;
  miContext?: WorkoutBuilderMiContext | null;
  level: string;
}): ProgressionDecision {
  const { exercise, history, competency, recoveryScore, miContext, level } = input;
  const catalog = catalogFor(exercise);
  const perf = collectPerf(history, exercise);
  const stage = stageFromCompetency(competency);
  const base: ProgressionDecision = {
    exerciseId: catalog?.id ?? exercise.id,
    exerciseName: exercise.name,
    method: 'hold',
    stage,
    reasons: [],
    temporary: true,
    sets: exercise.sets,
    reps: exercise.reps,
    weight: exercise.weight,
  };

  // --- Regression path (temporary) ---
  if (shouldRegress({ perf, competency, recoveryScore, miContext, exerciseName: exercise.name })) {
    const regressEx = pickRegressionTarget(catalog, competency);
    if (regressEx) {
      return {
        ...base,
        method: 'regress_exercise',
        nextExerciseId: regressEx.id,
        nextExerciseName: regressEx.name,
        sets: clampWorkingSets(Math.max(2, exercise.sets || 3), exercise.phase),
        reps: Math.max(6, Math.round((exercise.reps || 8) * 0.9)),
        weight:
          exercise.weight && exercise.weight > 0
            ? roundToPlateWeight(exercise.weight * 0.85)
            : exercise.weight,
        romCue: 'pain_free',
        reasons: [
          'temporary_regression_support',
          ...(competency?.progressionBlockedReasons?.slice(0, 3) ?? []),
          perf.missedRepsStreak >= 2 ? 'missed_rep_targets' : '',
        ].filter(Boolean),
      };
    }
    if (perf.missedRepsStreak >= 2 || (perf.completionRate > 0 && perf.completionRate < 0.7)) {
      return {
        ...base,
        method: 'regress_reps',
        reps: Math.max(1, Math.round((exercise.reps || perf.avgCompletedReps || 8) * 0.85)),
        weight: exercise.weight,
        reasons: ['temporary_regress_reps', 'missed_targets'],
      };
    }
    if (exercise.weight && exercise.weight > 0) {
      return {
        ...base,
        method: 'regress_load',
        weight: roundToPlateWeight(exercise.weight * 0.9),
        reasons: ['temporary_regress_load'],
      };
    }
    return { ...base, method: 'hold', reasons: ['hold_after_struggle_no_regression_edge'] };
  }

  const gate = earnedProgressGate({ perf, competency, recoveryScore });
  if (!gate.ok) {
    const lw = lastKnownWeight(history, exercise);
    return {
      ...base,
      method: 'hold',
      weight: lw != null ? roundToPlateWeight(lw) : exercise.weight,
      reps: perf.avgCompletedReps > 0 ? Math.round(perf.avgCompletedReps) : exercise.reps,
      reasons: ['progression_not_earned', ...gate.reasons],
    };
  }

  // Active MI modify/monitor: hold or soft volume only — never earn load past intensityLimit
  const activeConstraint = findMatchingConstraints(exercise, miContext?.constraints ?? []).find(
    (c) => c.status === 'modify' || c.status === 'monitor' || c.status === 'temporarilyAvoid'
  );
  if (activeConstraint && activeConstraint.status !== 'monitor') {
    const lw = lastKnownWeight(history, exercise);
    let weight = lw != null ? roundToPlateWeight(lw) : exercise.weight;
    if (
      weight != null &&
      weight > 0 &&
      typeof activeConstraint.intensityLimit === 'number' &&
      activeConstraint.intensityLimit < 1
    ) {
      weight = roundToPlateWeight(weight * activeConstraint.intensityLimit);
    }
    return {
      ...base,
      method: 'hold',
      weight,
      reasons: ['hold_under_active_mi_constraint', activeConstraint.status],
    };
  }

  // --- Earned progression: choose method by stage + signals ---
  const compound = isHeavyCompound({
    name: exercise.name,
    muscleGroups: exercise.muscleGroups,
    phase: exercise.phase,
  });
  const maxReps = maxRepCapForExercise(
    { name: exercise.name, muscleGroups: exercise.muscleGroups, phase: exercise.phase },
    {}
  );
  const currentReps = exercise.reps || Math.round(perf.avgCompletedReps) || 8;
  const seeded = lastKnownWeight(history, exercise);
  const currentWeight = seeded != null && seeded > 0 ? seeded : exercise.weight && exercise.weight > 0 ? exercise.weight : 0;

  // Double progression first (Learn → Control → Strengthen → Load)
  if (currentReps < maxReps && perf.hitPrescribedStreak >= 2) {
    return {
      ...base,
      method: 'increase_reps',
      reps: Math.min(maxReps, currentReps + 1),
      weight: currentWeight > 0 ? roundToPlateWeight(currentWeight) : currentWeight,
      reasons: ['earned_reps', `streak_${perf.hitPrescribedStreak}`, `stage_${stage}`],
    };
  }

  if (currentWeight > 0 && currentReps >= maxReps - 1 && perf.hitPrescribedStreak >= 2) {
    // Prefer load until ready to Progress / Specialize on the ladder
    const preferSwap =
      canEarnExerciseSwap(competency, perf) &&
      (stage === 'progress' ||
        stage === 'specialize' ||
        competency?.progressionReady === true ||
        perf.hitPrescribedStreak >= 4);
    if (!preferSwap) {
      return {
        ...base,
        method: 'increase_load',
        weight: applyWeightProgression(currentWeight, MIN_WEIGHT_PROGRESSION_LBS),
        reps: Math.max(compound ? 5 : 6, maxReps - 2),
        reasons: ['earned_load', 'hit_rep_cap', `stage_${stage}`],
      };
    }
  }

  if (
    canAddWorkingSet(exercise.sets || 3, exercise.phase) &&
    perf.hitPrescribedStreak >= 3 &&
    (level === 'intermediate' || level === 'advanced') &&
    stage !== 'progress' &&
    stage !== 'specialize' &&
    !competency?.progressionReady
  ) {
    return {
      ...base,
      method: 'increase_sets',
      sets: clampWorkingSets((exercise.sets || 3) + 1, exercise.phase),
      weight: currentWeight > 0 ? roundToPlateWeight(currentWeight) : currentWeight,
      reasons: ['earned_sets', `stage_${stage}`],
    };
  }

  // ROM emphasis when mobility-demanding and reps already capped
  if (
    (stage === 'control' || stage === 'strengthen') &&
    (catalog?.mobilityDemand === 'moderate' || catalog?.mobilityDemand === 'high')
  ) {
    return {
      ...base,
      method: 'increase_rom',
      romCue: 'full_depth',
      weight: currentWeight > 0 ? roundToPlateWeight(currentWeight) : currentWeight,
      reasons: ['earned_rom_emphasis', `stage_${stage}`],
    };
  }

  // Progress → Specialize: harder variation / unilateral / less support
  if (canEarnExerciseSwap(competency, perf)) {
    const reduceSupport = pickReduceSupportProgression(catalog);
    const unilateral =
      stage === 'progress' || stage === 'specialize'
        ? pickUnilateralProgression(catalog)
        : undefined;
    const next =
      reduceSupport ||
      unilateral ||
      pickProgressionTarget(catalog, competency, perf);

    if (next && next.id !== catalog?.id) {
      const method: ProgressionMethod =
        reduceSupport?.id === next.id
          ? 'reduce_support'
          : unilateral?.id === next.id
            ? 'introduce_unilateral'
            : currentWeight <= 0
              ? 'increase_complexity'
              : 'progress_exercise';
      return {
        ...base,
        method,
        nextExerciseId: next.id,
        nextExerciseName: next.name,
        sets: clampWorkingSets(exercise.sets || 3, exercise.phase),
        reps: Math.min(currentReps, maxReps),
        weight: currentWeight > 0 ? roundToPlateWeight(currentWeight * 0.9) : currentWeight,
        romCue: 'full_depth',
        reasons: [
          'earned_exercise_progression',
          `competency_${competency?.competencyLevel ?? 'unknown'}`,
          `stage_${stage}`,
        ],
      };
    }
  }

  return {
    ...base,
    method: 'hold',
    weight: currentWeight > 0 ? roundToPlateWeight(currentWeight) : exercise.weight,
    reasons: ['hold_maintain_form'],
  };
}

function applyDecisionToExercise(
  ex: ProgressionPlanExercise,
  decision: ProgressionDecision
): ProgressionPlanExercise {
  if (
    (decision.method === 'progress_exercise' ||
      decision.method === 'increase_complexity' ||
      decision.method === 'introduce_unilateral' ||
      decision.method === 'reduce_support' ||
      decision.method === 'regress_exercise') &&
    decision.nextExerciseId &&
    decision.nextExerciseName
  ) {
    const next =
      getExerciseById(decision.nextExerciseId) || getExerciseData(decision.nextExerciseName);
    const muscleGroups = next
      ? next.muscleGroups?.length
        ? next.muscleGroups
        : [next.primaryMuscleGroup, ...(next.secondaryMuscleGroups || [])]
      : ex.muscleGroups;
    return {
      ...ex,
      id: decision.nextExerciseId,
      name: decision.nextExerciseName,
      sets: decision.sets ?? ex.sets,
      reps: decision.reps ?? ex.reps,
      weight: decision.weight ?? ex.weight,
      category: (next?.category as ProgressionPlanExercise['category']) || ex.category,
      muscleGroups,
      equipment: next?.equipmentRequired ?? next?.equipment ?? ex.equipment,
      movementPattern: next?.movementPattern ?? ex.movementPattern,
      difficulty: next?.difficulty ?? ex.difficulty,
    };
  }

  return {
    ...ex,
    sets: decision.sets != null ? clampWorkingSets(decision.sets, ex.phase) : ex.sets,
    reps: decision.reps ?? ex.reps,
    weight: decision.weight ?? ex.weight,
  };
}

/**
 * Apply earned progression/regression across a weekly plan.
 * Does not permanently ban exercises.
 */
export function applyEarnedProgressionToWeeklyPlanSync(
  input: ProgressionEngineInput
): { plan: WeeklyPlanLike; decisions: ProgressionDecision[] } {
  const decisions: ProgressionDecision[] = [];
  const weekDays = input.plan.weekDays.map((day) => ({
    ...day,
    exercises: day.exercises.map((ex) => {
      if (ex.durationSeconds != null && ex.durationSeconds > 0) return ex;
      if (ex.category === 'flexibility') return ex;
      if (PLYOMETRIC_NAME.test(ex.name) || PLYOMETRIC_NAME.test(ex.id)) return ex;

      const catalog = catalogFor(ex);
      const key = catalog?.id ?? ex.id;
      let competency = input.competencyById?.[key] || input.competencyById?.[nameKey(ex.name)];
      if (!competency) {
        competency = evaluateExerciseCompetency({
          exerciseId: key,
          exerciseName: ex.name,
          history: input.history,
          catalog,
          profile: input.miContext?.profile,
        });
      }

      const decision = decideExerciseProgression({
        exercise: ex,
        history: input.history,
        competency,
        recoveryScore: input.recoveryScore,
        miContext: input.miContext,
        level: input.level,
      });
      decisions.push(decision);
      return applyDecisionToExercise(ex, decision);
    }),
  }));

  return { plan: { weekDays }, decisions };
}

/**
 * Async wrapper: refreshes competency from store when possible, then applies.
 */
export async function applyEarnedProgressionToWeeklyPlan(
  input: ProgressionEngineInput
): Promise<{ plan: WeeklyPlanLike; decisions: ProgressionDecision[]; summary: string }> {
  let competencyById = { ...(input.competencyById ?? {}) };
  try {
    const { loadCompetencyStore } = await import('./ExerciseCompetencyService');
    const store = await loadCompetencyStore();
    competencyById = { ...store.records, ...competencyById };
  } catch {
    /* pure evaluation from history is enough */
  }

  const { plan, decisions } = applyEarnedProgressionToWeeklyPlanSync({
    ...input,
    competencyById,
  });

  const progressed = decisions.filter((d) =>
    [
      'increase_reps',
      'increase_load',
      'increase_sets',
      'increase_rom',
      'increase_complexity',
      'introduce_unilateral',
      'reduce_support',
      'progress_exercise',
    ].includes(d.method)
  ).length;
  const regressed = decisions.filter((d) =>
    ['regress_exercise', 'regress_load', 'regress_reps', 'regress_sets'].includes(d.method)
  ).length;
  const held = decisions.filter((d) => d.method === 'hold').length;

  return {
    plan,
    decisions,
    summary: `earned_progress=${progressed} regress=${regressed} hold=${held}`,
  };
}

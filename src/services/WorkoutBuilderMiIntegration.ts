/**
 * Workout Builder ← Movement Intelligence integration.
 *
 * Modular adapter: User Data → MI → Exercise Selection → existing Workout Builder.
 * Does NOT rebuild the generator. Goal remains primary; MI:
 *   - re-ranks the goal-filtered pool
 *   - hard-avoids temporarilyAvoid exercises
 *   - swaps modify constraints to preferred / catalog regressions (metadata-driven)
 *   - scales intensity / volume / ROM from structured TrainingConstraints
 *
 * Architecture:
 *   CoachingProfile + MovementProfile + Constraints + Competency + History
 *     → buildWorkoutBuilderMiContext()
 *     → enrichExercisePoolWithMi() / miBiasedShuffle() / pickMiSupportAccessories()
 *     → existing generateWorkoutPlan pool + picks
 *     → applyMiConstraintsToWeeklyPlan() (structured safety, post-progression)
 */

import {
  exerciseDatabase,
  getExerciseById,
  getExerciseData,
  type ExerciseData,
} from '../data/exerciseDatabase';
import type { ExperienceLevel, PrimaryGoal } from '../types/coachingProfile';
import {
  createEmptyMovementProfile,
  type MovementProfile,
  type TrainingConstraint,
} from '../types/movementIntelligence';
import { COMPETENCY_LEVEL_RANK } from '../types/exerciseCompetency';
import type { SelectionExperienceLevel } from '../types/exerciseSelection';
import {
  rankExercisesForExperience,
  toSelectionExperienceLevel,
} from './exerciseSelectionRanking';
import type { WorkoutSession } from '../../data/workoutPrograms';

/** Qualities that are developing (scored low or needs assessment) — not diagnoses. */
export type DevelopingMovementFocus =
  | 'hipStability'
  | 'kneeControl'
  | 'ankleStability'
  | 'shoulderStability'
  | 'scapularControl'
  | 'coreStability'
  | 'singleLegStability'
  | 'ankleMobility'
  | 'hipMobility'
  | 'thoracicMobility'
  | 'shoulderMobility';

export type WorkoutBuilderMiContext = {
  experienceLevel: SelectionExperienceLevel;
  primaryGoal: PrimaryGoal | null;
  /** Generator goal string (strength / muscle_gain / …). */
  generatorGoal: string;
  profile: MovementProfile;
  constraints: TrainingConstraint[];
  developingFocuses: DevelopingMovementFocus[];
  /** Hard avoid names (temporarilyAvoid + profile limitations that are acute). */
  hardAvoidNames: string[];
  /** Soft demote / prefer from modify constraints. */
  preferredVariations: string[];
  modifyExerciseNames: string[];
  /** exerciseId → selection score from Exercise Selection Engine. */
  selectionScoreById: Map<string, number>;
  /** Ordered catalog ids from selection engine (best first). */
  rankedIds: string[];
  recentSessionCount: number;
  summary: string;
};

const DEVELOPING_SCORE_THRESHOLD = 55;

function demandRank(d?: string): number {
  if (d === 'high') return 2;
  if (d === 'moderate') return 1;
  return 0;
}

function nameKey(s: string): string {
  return s.trim().toLowerCase();
}

/** Detect developing movement focuses from MovementProfile — never invents scores. */
export function detectDevelopingFocuses(profile: MovementProfile): DevelopingMovementFocus[] {
  const out: DevelopingMovementFocus[] = [];
  const consider = (
    key: DevelopingMovementFocus,
    metric: { status: string; score?: number } | undefined
  ) => {
    if (!metric) return;
    if (metric.status === 'needs_assessment') {
      out.push(key);
      return;
    }
    if (metric.status === 'scored' && typeof metric.score === 'number' && metric.score < DEVELOPING_SCORE_THRESHOLD) {
      out.push(key);
    }
  };

  consider('hipStability', profile.stability.hipStability);
  consider('kneeControl', profile.stability.kneeControl);
  consider('ankleStability', profile.stability.ankleStability);
  consider('shoulderStability', profile.stability.shoulderStability);
  consider('scapularControl', profile.stability.scapularControl);
  consider('coreStability', profile.stability.coreStability);
  consider('singleLegStability', profile.stability.singleLegStability);
  consider('ankleMobility', profile.mobility.ankleMobility);
  consider('hipMobility', profile.mobility.hipMobility);
  consider('thoracicMobility', profile.mobility.thoracicMobility);
  consider('shoulderMobility', profile.mobility.shoulderMobility);

  // Soft focus areas from discomfort / coaching (text only — no invented scores)
  for (const focus of profile.currentFocusAreas ?? []) {
    const f = focus.toLowerCase();
    if (/hip/.test(f) && /stabil/.test(f) && !out.includes('hipStability')) out.push('hipStability');
    if (/knee/.test(f) && !out.includes('kneeControl')) out.push('kneeControl');
    if (/ankle/.test(f) && /mobil/.test(f) && !out.includes('ankleMobility')) out.push('ankleMobility');
    if (/core|trunk/.test(f) && !out.includes('coreStability')) out.push('coreStability');
    if (/single.?leg|unilateral/.test(f) && !out.includes('singleLegStability')) {
      out.push('singleLegStability');
    }
    if (/shoulder/.test(f) && /stabil/.test(f) && !out.includes('shoulderStability')) {
      out.push('shoulderStability');
    }
    if (/scapula/.test(f) && !out.includes('scapularControl')) out.push('scapularControl');
  }

  return out;
}

function isLowerBodyFocus(focus: string): boolean {
  const f = focus.toLowerCase();
  return /leg|lower|quad|glute|hamstring|calf/.test(f);
}

function isUpperBodyFocus(focus: string): boolean {
  const f = focus.toLowerCase();
  return /push|pull|upper|chest|back|arm|shoulder/.test(f);
}

/**
 * Goal stays primary: MI only re-ranks within the builder's already goal-filtered pool.
 * Soft preferences for developing qualities (e.g. hip stability → more stable loading options).
 */
export function miAdjustmentForExercise(
  ex: ExerciseData,
  ctx: Pick<WorkoutBuilderMiContext, 'developingFocuses' | 'preferredVariations' | 'modifyExerciseNames' | 'hardAvoidNames' | 'primaryGoal'>
): { delta: number; notes: string[] } {
  const notes: string[] = [];
  let delta = 0;
  const n = ex.name.toLowerCase();
  const focuses = new Set(ctx.developingFocuses);

  if (ctx.hardAvoidNames.some((a) => nameKey(a) === nameKey(ex.name))) {
    return { delta: -1000, notes: ['hard_avoid'] };
  }

  if (ctx.preferredVariations.some((p) => nameKey(p) === nameKey(ex.name))) {
    delta += 28;
    notes.push('constraint_preferred_variation');
  }
  if (ctx.modifyExerciseNames.some((m) => nameKey(m) === nameKey(ex.name))) {
    delta -= 18;
    notes.push('under_modify_constraint');
  }

  const hipDeveloping = focuses.has('hipStability') || focuses.has('singleLegStability');
  const kneeDeveloping = focuses.has('kneeControl');
  const coreDeveloping = focuses.has('coreStability');
  const shoulderDeveloping =
    focuses.has('shoulderStability') || focuses.has('scapularControl');

  // --- Hip / single-leg stability developing: prefer stable hypertrophy options ---
  if (hipDeveloping) {
    // Favor machine / supported / hinge posterior work for lower-body stimulus
    if (
      /leg press|hack squat|smith machine squat|goblet|hip thrust|glute bridge|romanian|rdl|good morning|cable|machine/.test(
        n
      ) ||
      (ex.movementPattern === 'hinge' && demandRank(ex.stabilityDemand) <= 1)
    ) {
      delta += 16;
      notes.push('prefer_stable_hypertrophy_option');
    }
    if (
      /bulgarian split squats \(bodyweight\)|reverse lunge|split squat|supported|assisted|smith/.test(n) ||
      (ex.laterality === 'unilateral' &&
        (demandRank(ex.balanceDemand) === 0 || /bodyweight|smith|assisted/.test(n)))
    ) {
      delta += 12;
      notes.push('prefer_supported_unilateral');
    }
    // Demote high-balance free unilateral / skill as mains — still in pool for accessories if scored high otherwise
    if (
      (ex.laterality === 'unilateral' && demandRank(ex.balanceDemand) >= 2) ||
      /pistol|skater|cossack hop|single-leg drop|single leg deadlift|one-legged deadlift/.test(n)
    ) {
      delta -= 14;
      notes.push('demote_high_balance_unilateral');
    }
    // Free barbell back squat is fine for many; slight demote only when stability demand high
    if (
      (ex.id === 'squat' || /^squat$/.test(n)) &&
      demandRank(ex.stabilityDemand) >= 2
    ) {
      delta -= 8;
      notes.push('prefer_more_stable_squat_variant');
    }
  }

  if (kneeDeveloping) {
    if (/leg press|leg extension|glute bridge|hip thrust|seated|machine|smith/.test(n)) {
      delta += 10;
      notes.push('knee_friendly_loading');
    }
    if (/plyo|jump|hop|depth|pistol|walking lunge/.test(n) && demandRank(ex.stabilityDemand) >= 1) {
      delta -= 12;
      notes.push('demote_high_knee_demand_plyo');
    }
  }

  if (coreDeveloping) {
    if (
      ex.movementQualities?.includes('coreStability') ||
      ex.movementQualities?.includes('antiExtension') ||
      /plank|dead bug|bird dog|pallof|carry|suitcase/.test(n)
    ) {
      // Small boost — accessories, not replacing main lifts
      delta += 6;
      notes.push('core_stability_support');
    }
  }

  if (shoulderDeveloping) {
    if (/landmine|neutral grip|floor press|push-up|band pull|scapular|face|external rotation/.test(n)) {
      delta += 10;
      notes.push('shoulder_friendly_pressing');
    }
    if (/behind.?neck|upright row|wide grip snatch|handstand/.test(n)) {
      delta -= 16;
      notes.push('demote_irritating_shoulder_pattern');
    }
  }

  // Goal primacy: for hypertrophy/strength, keep compounds ahead of pure corrective drills
  const goal = ctx.primaryGoal;
  if (goal === 'muscle_gain' || goal === 'strength_powerlifting' || goal === 'general_fitness') {
    const isPureCorrective =
      (ex.category === 'flexibility' || ex.category === 'balance') &&
      !/glute bridge|hip thrust|plank|dead bug|bird dog|banded/.test(n);
    if (isPureCorrective) {
      delta -= 10;
      notes.push('goal_primacy_limit_corrective');
    }
    if (
      ex.category === 'strength' &&
      (ex.movementPattern === 'squat' ||
        ex.movementPattern === 'hinge' ||
        ex.movementPattern === 'push' ||
        ex.movementPattern === 'pull' ||
        ex.movementPattern === 'lunge')
    ) {
      delta += 4;
      notes.push('goal_primacy_compound');
    }
  }

  return { delta, notes };
}

/**
 * Re-rank an existing builder pool with Selection Engine scores + MI adjustments.
 * Does not expand into a rehab program — only reorders / soft-filters within the pool.
 */
export function enrichExercisePoolWithMi(
  pool: ExerciseData[],
  ctx: WorkoutBuilderMiContext
): ExerciseData[] {
  if (!pool.length) return pool;

  const hard = new Set(ctx.hardAvoidNames.map(nameKey));
  const scored = pool
    .filter((ex) => !hard.has(nameKey(ex.name)))
    .map((ex) => {
      const base = ctx.selectionScoreById.get(ex.id) ?? 50;
      const adj = miAdjustmentForExercise(ex, ctx);
      return { ex, score: base + adj.delta };
    })
    .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));

  return scored.map((s) => s.ex);
}

/**
 * Shuffle that preserves MI preference: higher-ranked pool items stay likelier early.
 * variationIndex still produces distinct Option 1/2/3 plans.
 */
export function miBiasedShuffle<T extends { id?: string; name?: string }>(
  items: T[],
  poolOrder: ExerciseData[],
  variationIndex: number
): T[] {
  if (items.length <= 1) return [...items];
  const rank = new Map<string, number>();
  poolOrder.forEach((ex, i) => {
    rank.set(ex.id, i);
    rank.set(nameKey(ex.name), i);
  });

  const keyed = items.map((item, idx) => {
    const id = item.id;
    const name = item.name ? nameKey(item.name) : '';
    const r =
      (id && rank.has(id) ? rank.get(id)! : undefined) ??
      (name && rank.has(name) ? rank.get(name)! : undefined) ??
      poolOrder.length + idx;
    return { item, r };
  });

  // Banded shuffle: sort by rank, then lightly permute within windows using LCG
  keyed.sort((a, b) => a.r - b.r);
  let seed = (variationIndex + 1) * 7919;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const window = Math.max(3, Math.min(6, Math.ceil(keyed.length / 4)));
  for (let start = 0; start < keyed.length; start += window) {
    const end = Math.min(keyed.length, start + window);
    for (let i = end - 1; i > start; i -= 1) {
      const j = start + Math.floor(random() * (i - start + 1));
      [keyed[i], keyed[j]] = [keyed[j], keyed[i]];
    }
  }
  return keyed.map((k) => k.item);
}

/**
 * At most 1–2 support accessories that address developing qualities
 * without turning the day into corrective exercise.
 */
export function pickMiSupportAccessories(
  ctx: WorkoutBuilderMiContext,
  dayFocus: string,
  usedNames: Set<string>,
  limit = 1
): ExerciseData[] {
  if (!ctx.developingFocuses.length || limit <= 0) return [];

  const picks: ExerciseData[] = [];
  const tryAdd = (idOrName: string) => {
    if (picks.length >= limit) return;
    const ex = getExerciseById(idOrName) || getExerciseData(idOrName);
    if (!ex) return;
    if (usedNames.has(ex.name) || picks.some((p) => p.name === ex.name)) return;
    if (ctx.hardAvoidNames.some((a) => nameKey(a) === nameKey(ex.name))) return;
    picks.push(ex);
  };

  const lower = isLowerBodyFocus(dayFocus) || /full body/i.test(dayFocus);
  const upper = isUpperBodyFocus(dayFocus) || /full body/i.test(dayFocus);

  if (lower) {
    if (ctx.developingFocuses.includes('hipStability') || ctx.developingFocuses.includes('singleLegStability')) {
      // Stability stimulus that still fits hypertrophy lower days
      tryAdd('banded-glute-bridges');
      tryAdd('glute-bridge-bodyweight');
      tryAdd('side-plank');
    }
    if (ctx.developingFocuses.includes('coreStability')) {
      tryAdd('dead-bug');
      tryAdd('bird-dog');
      tryAdd('plank');
    }
    if (ctx.developingFocuses.includes('kneeControl')) {
      tryAdd('glute-bridge-bodyweight');
      tryAdd('wall-sit');
    }
  }

  if (upper) {
    if (
      ctx.developingFocuses.includes('scapularControl') ||
      ctx.developingFocuses.includes('shoulderStability')
    ) {
      tryAdd('band-pull-aparts');
      tryAdd('scapular-push-ups');
      tryAdd('shoulder-external-rotations');
    }
    if (ctx.developingFocuses.includes('coreStability')) {
      tryAdd('dead-bug');
      tryAdd('plank');
    }
  }

  return picks.slice(0, limit);
}

export function mergeExcludedWithMi(
  baseExcluded: string[],
  ctx: WorkoutBuilderMiContext
): string[] {
  const out = [...baseExcluded];
  for (const name of ctx.hardAvoidNames) {
    if (!out.some((e) => nameKey(e) === nameKey(name))) out.push(name);
  }
  return out;
}

function buildSummary(ctx: Omit<WorkoutBuilderMiContext, 'summary'>): string {
  const parts: string[] = [];
  parts.push(`goal=${ctx.primaryGoal ?? ctx.generatorGoal}`);
  parts.push(`level=${ctx.experienceLevel}`);
  if (ctx.developingFocuses.length) {
    parts.push(`developing=${ctx.developingFocuses.slice(0, 4).join(',')}`);
  }
  if (ctx.hardAvoidNames.length) {
    parts.push(`avoid=${ctx.hardAvoidNames.length}`);
  }
  if (ctx.modifyExerciseNames.length) {
    parts.push(`modify=${ctx.modifyExerciseNames.length}`);
  }
  parts.push(`ranked=${ctx.rankedIds.length}`);
  return parts.join(' · ');
}

/** Plan exercise shape used by Workout Builder days. */
export type MiPlanExercise = {
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
  movementPattern?: string;
  difficulty?: string;
  restTime?: number;
  /** Soft ROM cue from active constraint (not a medical label). */
  romCue?: string;
  /** True when MI swapped or scaled this row for a constraint. */
  miConstraintApplied?: boolean;
};

export type MiWeeklyPlanLike = {
  weekDays: Array<{
    dayName: string;
    focus: string;
    duration: number;
    exercises: MiPlanExercise[];
  }>;
};

function catalogMovementPattern(ex: { id?: string; name?: string; movementPattern?: string }): string | undefined {
  const catalog =
    (ex.id ? getExerciseById(ex.id) : undefined) ||
    (ex.name ? getExerciseData(ex.name) : undefined);
  return catalog?.movementPattern || ex.movementPattern;
}

/**
 * Match active constraints to an exercise by name and/or movement pattern.
 * Prefer exercise-scoped rows; fall back to pattern-scoped.
 */
export function findMatchingConstraints(
  ex: { id?: string; name: string; movementPattern?: string },
  constraints: TrainingConstraint[]
): TrainingConstraint[] {
  const n = nameKey(ex.name);
  const pattern = catalogMovementPattern(ex);
  const byExercise: TrainingConstraint[] = [];
  const byPattern: TrainingConstraint[] = [];
  for (const c of constraints) {
    if (c.archivedAt) continue;
    if (c.status === 'normal') continue;
    if (c.exercise && nameKey(c.exercise) === n) {
      byExercise.push(c);
      continue;
    }
    if (!c.exercise && c.movementPattern && pattern && c.movementPattern === pattern) {
      byPattern.push(c);
    }
  }
  return byExercise.length ? byExercise : byPattern;
}

/**
 * Pick the best safer variation using preferredVariations + catalog regressions/alternatives
 * + selection ranking — never a hard-coded body-part → exercise map.
 */
export function pickConstraintSafeVariation(
  original: MiPlanExercise,
  constraint: TrainingConstraint,
  ctx: WorkoutBuilderMiContext
): ExerciseData | null {
  const catalog =
    getExerciseById(original.id) || getExerciseData(original.name) || null;
  const avoided = new Set(
    (constraint.avoidedVariations ?? []).map(nameKey).concat(ctx.hardAvoidNames.map(nameKey))
  );

  const candidateNames: string[] = [];
  const pushUnique = (label?: string) => {
    if (!label) return;
    const key = nameKey(label);
    if (!key || avoided.has(key)) return;
    if (candidateNames.some((n) => nameKey(n) === key)) return;
    if (nameKey(label) === nameKey(original.name)) return;
    candidateNames.push(label);
  };

  for (const v of constraint.preferredVariations ?? []) pushUnique(v);
  for (const v of ctx.preferredVariations) pushUnique(v);
  for (const r of catalog?.regressions ?? []) pushUnique(r);
  for (const a of catalog?.alternatives ?? []) pushUnique(a);
  for (const v of catalog?.variations ?? []) pushUnique(v);

  const candidates = candidateNames
    .map((label) => getExerciseData(label) || getExerciseById(label))
    .filter((e): e is ExerciseData => Boolean(e))
    .filter((e) => !avoided.has(nameKey(e.name)));

  if (!candidates.length) return null;

  // Keep training stimulus: prefer same movement pattern / primary muscle when possible
  const samePattern = candidates.filter(
    (e) =>
      !catalog ||
      e.movementPattern === catalog.movementPattern ||
      e.primaryMuscleGroup === catalog.primaryMuscleGroup
  );
  const pool = samePattern.length ? samePattern : candidates;

  const scored = pool.map((ex) => {
    const base = ctx.selectionScoreById.get(ex.id) ?? 50;
    const adj = miAdjustmentForExercise(ex, ctx);
    let score = base + adj.delta;
    // Prefer listed preferredVariations
    if ((constraint.preferredVariations ?? []).some((p) => nameKey(p) === nameKey(ex.name))) {
      score += 40;
    }
    // Prefer lower stability/technical demand under modify / avoid
    if (constraint.status === 'temporarilyAvoid' || constraint.status === 'modify') {
      score += (2 - demandRank(ex.stabilityDemand)) * 4;
      score += (2 - demandRank(ex.technicalComplexity)) * 3;
    }
    return { ex, score };
  });

  scored.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));
  return scored[0]?.ex ?? null;
}

function applyPrescriptionLimits(
  ex: MiPlanExercise,
  constraint: TrainingConstraint
): MiPlanExercise {
  let sets = ex.sets;
  let reps = ex.reps;
  let weight = ex.weight;
  const intensity =
    typeof constraint.intensityLimit === 'number' && constraint.intensityLimit > 0
      ? Math.min(1, constraint.intensityLimit)
      : undefined;
  const volume =
    typeof constraint.volumeLimit === 'number' && constraint.volumeLimit > 0
      ? Math.min(1, constraint.volumeLimit)
      : undefined;

  if (volume != null && volume < 1) {
    sets = Math.max(2, Math.round(sets * volume));
    if (volume <= 0.75) {
      reps = Math.max(4, Math.round(reps * Math.max(0.85, volume)));
    }
  }
  if (intensity != null && intensity < 1 && weight != null && weight > 0) {
    weight = Math.round((weight * intensity) / 2.5) * 2.5;
  }

  const romCue =
    constraint.romLimit === 'pain_free_rom' || constraint.romLimit === 'pain_free'
      ? 'pain_free'
      : constraint.romLimit === 'parallel_only'
        ? 'partial'
        : constraint.romLimit;

  return {
    ...ex,
    sets,
    reps,
    weight,
    romCue: romCue || ex.romCue,
    miConstraintApplied: true,
  };
}

function materializeCatalogExercise(
  next: ExerciseData,
  base: MiPlanExercise
): MiPlanExercise {
  return {
    ...base,
    id: next.id,
    name: next.name,
    category: (next.category as MiPlanExercise['category']) || base.category,
    muscleGroups: next.muscleGroups?.length
      ? next.muscleGroups
      : [next.primaryMuscleGroup, ...(next.secondaryMuscleGroups || [])],
    equipment: next.equipmentRequired ?? next.equipment ?? base.equipment,
    movementPattern: next.movementPattern ?? base.movementPattern,
    difficulty: next.difficulty ?? base.difficulty,
    miConstraintApplied: true,
  };
}

/**
 * Apply structured TrainingConstraints onto a weekly plan:
 * - temporarilyAvoid → swap to best metadata-backed variation (goal stimulus preserved)
 * - modify → prefer safer variation + intensity/volume/ROM limits
 * - monitor → light volume trim only when limits exist
 *
 * Does NOT hard-code body-part → exercise maps.
 */
export function applyMiConstraintsToWeeklyPlan(
  plan: MiWeeklyPlanLike,
  ctx: WorkoutBuilderMiContext
): { plan: MiWeeklyPlanLike; appliedCount: number; notes: string[] } {
  if (!ctx.constraints.length && !ctx.hardAvoidNames.length) {
    return { plan, appliedCount: 0, notes: [] };
  }

  const notes: string[] = [];
  let appliedCount = 0;

  const weekDays = plan.weekDays.map((day) => ({
    ...day,
    exercises: day.exercises.map((ex) => {
      if (ex.durationSeconds != null && ex.durationSeconds > 0) return ex;
      if (ex.category === 'flexibility') return ex;

      const matches = findMatchingConstraints(ex, ctx.constraints);
      const hardName = ctx.hardAvoidNames.some((a) => nameKey(a) === nameKey(ex.name));
      const primary =
        matches.find((c) => c.status === 'temporarilyAvoid') ||
        matches.find((c) => c.status === 'modify') ||
        matches.find((c) => c.status === 'monitor') ||
        (hardName
          ? ({
              id: 'hard-avoid-synthetic',
              status: 'temporarilyAvoid' as const,
              exercise: ex.name,
              reason: 'Hard avoid from Movement Intelligence',
              startDate: new Date().toISOString().slice(0, 10),
              preferredVariations: ctx.preferredVariations,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } satisfies TrainingConstraint)
          : null);

      if (!primary) return ex;

      let nextEx: MiPlanExercise = { ...ex };
      const needsSwap =
        primary.status === 'temporarilyAvoid' ||
        primary.status === 'modify' ||
        (primary.preferredVariations && primary.preferredVariations.length > 0);

      if (needsSwap) {
        const safer = pickConstraintSafeVariation(ex, primary, ctx);
        if (safer && nameKey(safer.name) !== nameKey(ex.name)) {
          nextEx = materializeCatalogExercise(safer, nextEx);
          // Conservative load after swap
          if (nextEx.weight != null && nextEx.weight > 0) {
            const intensity =
              typeof primary.intensityLimit === 'number' ? primary.intensityLimit : 0.85;
            nextEx.weight = Math.round((nextEx.weight * Math.min(1, intensity)) / 2.5) * 2.5;
          }
          notes.push(`${ex.name} → ${safer.name} (${primary.status})`);
          appliedCount += 1;
        } else if (primary.status === 'temporarilyAvoid') {
          // Cannot find a safe swap — drop demand sharply rather than keep banned lift
          nextEx = applyPrescriptionLimits(nextEx, {
            ...primary,
            intensityLimit: Math.min(primary.intensityLimit ?? 0.5, 0.5),
            volumeLimit: Math.min(primary.volumeLimit ?? 0.5, 0.5),
          });
          notes.push(`${ex.name} demand reduced (avoid, no swap)`);
          appliedCount += 1;
          return nextEx;
        }
      }

      if (
        primary.status === 'modify' ||
        primary.status === 'monitor' ||
        primary.status === 'temporarilyAvoid'
      ) {
        const before = `${nextEx.sets}x${nextEx.reps}@${nextEx.weight ?? 0}`;
        nextEx = applyPrescriptionLimits(nextEx, primary);
        if (`${nextEx.sets}x${nextEx.reps}@${nextEx.weight ?? 0}` !== before) {
          appliedCount += 1;
          notes.push(
            `${nextEx.name} limits intensity=${primary.intensityLimit ?? '—'} volume=${primary.volumeLimit ?? '—'}`
          );
        } else {
          nextEx = { ...nextEx, miConstraintApplied: true };
        }
      }

      return nextEx;
    }),
  }));

  return { plan: { weekDays }, appliedCount, notes };
}

/**
 * Load MI + selection context for one generation run.
 * Failures are soft — returns a usable empty-leaning context so the builder still runs.
 */
export async function buildWorkoutBuilderMiContext(input: {
  experienceLevel: string;
  generatorGoal: string;
  primaryGoal?: PrimaryGoal | null;
  baseExcluded?: string[];
}): Promise<WorkoutBuilderMiContext> {
  const experienceLevel = toSelectionExperienceLevel(
    input.experienceLevel as ExperienceLevel
  );

  let profile: MovementProfile;
  try {
    const { loadMovementProfile } = await import('./MovementIntelligenceService');
    profile = await loadMovementProfile();
  } catch {
    profile = createEmptyMovementProfile();
  }

  let constraints: TrainingConstraint[] = [];
  try {
    const { loadActiveTrainingConstraints } = await import('./MovementIntelligenceService');
    constraints = await loadActiveTrainingConstraints();
  } catch {
    constraints = [];
  }

  let recentSessionCount = 0;
  try {
    const { loadDedupedWorkoutHistory } = await import('../utils/workoutHistoryStorage');
    const history = await loadDedupedWorkoutHistory();
    const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
    recentSessionCount = history.filter(
      (s: WorkoutSession) => s.completed && new Date(s.date).getTime() >= cutoff
    ).length;
  } catch {
    recentSessionCount = 0;
  }

  let competencyRanks: Record<string, number> | undefined;
  try {
    const { loadCompetencyStore } = await import('./ExerciseCompetencyService');
    const store = await loadCompetencyStore();
    competencyRanks = {};
    for (const [id, rec] of Object.entries(store.records)) {
      competencyRanks[id] = COMPETENCY_LEVEL_RANK[rec.competencyLevel];
    }
  } catch {
    competencyRanks = undefined;
  }

  const developingFocuses = detectDevelopingFocuses(profile);

  const hardAvoidNames: string[] = [];
  const preferredVariations: string[] = [];
  const modifyExerciseNames: string[] = [];

  for (const c of constraints) {
    if (c.status === 'temporarilyAvoid' && c.exercise) {
      hardAvoidNames.push(c.exercise);
    }
    if ((c.status === 'modify' || c.status === 'monitor') && c.exercise) {
      if (c.status === 'modify') modifyExerciseNames.push(c.exercise);
      for (const v of c.preferredVariations ?? []) preferredVariations.push(v);
    }
    // Pattern-scoped: keep preferred variations for stimulus-preserving swaps
    if (!c.exercise && c.movementPattern && (c.status === 'modify' || c.status === 'temporarilyAvoid')) {
      for (const v of c.preferredVariations ?? []) preferredVariations.push(v);
    }
  }
  // Profile limitations are soft unless also temporarilyAvoid — still demote via modify list
  for (const lim of profile.exerciseLimitations ?? []) {
    if (!hardAvoidNames.some((a) => nameKey(a) === nameKey(lim))) {
      modifyExerciseNames.push(lim);
    }
  }

  const categories: Array<ExerciseData['category']> =
    input.generatorGoal === 'endurance'
      ? ['cardio']
      : input.generatorGoal === 'flexibility'
        ? ['flexibility', 'balance']
        : ['strength', 'stability', 'balance'];

  const selection = rankExercisesForExperience({
    experienceLevel,
    catalog: exerciseDatabase,
    profile,
    competencyRanks,
    filters: {
      categories,
      limit: 120,
      avoidExerciseNames: [...hardAvoidNames, ...(input.baseExcluded ?? [])],
      respectExerciseLimitations: true,
    },
  });

  const selectionScoreById = new Map<string, number>();
  const rankedIds: string[] = [];
  for (const c of selection.candidates) {
    selectionScoreById.set(c.exerciseId, c.score);
    rankedIds.push(c.exerciseId);
  }

  const ctx: WorkoutBuilderMiContext = {
    experienceLevel,
    primaryGoal: input.primaryGoal ?? null,
    generatorGoal: input.generatorGoal,
    profile,
    constraints,
    developingFocuses,
    hardAvoidNames,
    preferredVariations,
    modifyExerciseNames,
    selectionScoreById,
    rankedIds,
    recentSessionCount,
    summary: '',
  };
  ctx.summary = buildSummary(ctx);
  return ctx;
}

/** Empty context when MI load must be skipped. */
export function emptyWorkoutBuilderMiContext(
  experienceLevel: string,
  generatorGoal: string
): WorkoutBuilderMiContext {
  const level = toSelectionExperienceLevel(experienceLevel as ExperienceLevel);
  return {
    experienceLevel: level,
    primaryGoal: null,
    generatorGoal,
    profile: createEmptyMovementProfile(),
    constraints: [],
    developingFocuses: [],
    hardAvoidNames: [],
    preferredVariations: [],
    modifyExerciseNames: [],
    selectionScoreById: new Map(),
    rankedIds: [],
    recentSessionCount: 0,
    summary: 'mi_skipped',
  };
}

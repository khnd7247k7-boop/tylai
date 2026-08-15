/**
 * Exercise Competency & Progression service.
 *
 * Determines whether a user is ready to progress (or should regress) an exercise
 * using performance history, exercise metadata relationships, and Movement Intelligence
 * signals — not session count alone.
 *
 * Reusable query API for a future Workout Builder.
 * Does NOT change workout generation in this phase.
 */

import type { WorkoutSession } from '../../data/workoutPrograms';
import {
  getExerciseById,
  getExerciseData,
  type ExerciseData,
} from '../data/exerciseDatabase';
import type { DemandLevel } from '../data/exerciseMovementIntelligence';
import {
  COMPETENCY_LEVEL_RANK,
  createEmptyCompetencyRecord,
  createEmptyCompetencyStore,
  type CompetencyLevel,
  type ExerciseCompetencyEvidence,
  type ExerciseCompetencyRecord,
  type ExerciseCompetencyStore,
  type ExerciseMovementQualitySignal,
  type ExerciseMovementToleranceSignal,
  type ExerciseProgressionRecommendation,
  type PerformanceTrend,
  type ProgressionAction,
} from '../types/exerciseCompetency';
import type {
  MovementProfile,
  MovementToleranceEntry,
  TrainingConstraint,
} from '../types/movementIntelligence';
import { loadDedupedWorkoutHistory } from '../utils/workoutHistoryStorage';
import { loadUserData, saveUserData } from '../utils/userStorage';
import { auth } from '../../firebaseConfig';
import {
  loadActiveTrainingConstraints,
  loadMovementProfile,
} from './MovementIntelligenceService';

export const EXERCISE_COMPETENCY_KEY = 'exerciseCompetencyRecords';

const LOOKBACK_SESSIONS = 8;
const MIN_SESSIONS_FOR_TREND = 3;
const MIN_SESSIONS_FOR_COMPETENT = 3;
const MIN_SESSIONS_FOR_PROFICIENT = 5;
const MIN_SESSIONS_FOR_ADVANCED = 8;

function nowIso(): string {
  return new Date().toISOString();
}

function currentUserId(): string | undefined {
  try {
    return auth?.currentUser?.uid || undefined;
  } catch {
    return undefined;
  }
}

function demandRank(d?: DemandLevel): number {
  if (d === 'high') return 2;
  if (d === 'moderate') return 1;
  return 0;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

/** Resolve catalog exercise from id or name. */
export function resolveCatalogExercise(
  exerciseIdOrName: string
): ExerciseData | undefined {
  const key = exerciseIdOrName.trim();
  if (!key) return undefined;
  return getExerciseById(key) || getExerciseData(key);
}

function sessionExerciseKey(ex: { exerciseId?: string; name?: string }): string | null {
  const id = (ex.exerciseId || '').trim();
  if (id && id !== 'unknown') {
    const byId = getExerciseById(id);
    if (byId) return byId.id;
  }
  const name = (ex.name || '').trim();
  if (name) {
    const byName = getExerciseData(name);
    if (byName) return byName.id;
    // Fallback: slugify name for custom / unmatched lifts
    if (id && id !== 'unknown') return id;
    return `name:${name.toLowerCase()}`;
  }
  return id || null;
}

function bestSetLoad(sets: WorkoutSession['exercises'][number]['sets']): {
  weight: number;
  reps: number;
  load: number;
  completed: number;
  total: number;
  rpeSum: number;
  rpeCount: number;
} {
  let weight = 0;
  let reps = 0;
  let load = 0;
  let completed = 0;
  let rpeSum = 0;
  let rpeCount = 0;
  for (const s of sets ?? []) {
    if (s.completed) completed += 1;
    const w = Number(s.weight) || 0;
    const r = Number(s.reps) || 0;
    const L = w * r;
    if (L > load || (L === load && w > weight)) {
      load = L;
      weight = w;
      reps = r;
    }
    if (typeof s.rpe === 'number' && Number.isFinite(s.rpe)) {
      rpeSum += s.rpe;
      rpeCount += 1;
    }
  }
  return { weight, reps, load, completed, total: sets?.length ?? 0, rpeSum, rpeCount };
}

type PerformancePoint = {
  date: string;
  load: number;
  weight: number;
  reps: number;
  completionRate: number;
  avgRpe?: number;
};

function collectPerformancePoints(
  history: WorkoutSession[],
  exerciseId: string,
  limit = LOOKBACK_SESSIONS
): PerformancePoint[] {
  const points: PerformancePoint[] = [];
  const sorted = [...history]
    .filter((s) => s.completed)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  for (const session of sorted) {
    for (const ex of session.exercises ?? []) {
      const key = sessionExerciseKey(ex);
      if (!key) continue;
      const matches =
        key === exerciseId ||
        key === `name:${exerciseId}` ||
        (ex.name && getExerciseData(ex.name)?.id === exerciseId);
      if (!matches) continue;
      const best = bestSetLoad(ex.sets);
      if (best.total === 0) continue;
      points.push({
        date: session.date,
        load: best.load,
        weight: best.weight,
        reps: best.reps,
        completionRate: best.total > 0 ? best.completed / best.total : 0,
        avgRpe: best.rpeCount ? best.rpeSum / best.rpeCount : undefined,
      });
      break;
    }
    if (points.length >= limit) break;
  }
  // chronological oldest → newest for trend
  return points.reverse();
}

function computePerformanceTrend(points: PerformancePoint[]): {
  trend: PerformanceTrend;
  loadTrend?: number;
} {
  if (points.length < MIN_SESSIONS_FOR_TREND) {
    return { trend: 'insufficient_data' };
  }
  const loads = points.map((p) => p.load).filter((n) => n > 0);
  if (loads.length < MIN_SESSIONS_FOR_TREND) {
    // Bodyweight / zero-load: use reps as proxy
    const reps = points.map((p) => p.reps);
    if (reps.length < MIN_SESSIONS_FOR_TREND) return { trend: 'insufficient_data' };
    const first = reps.slice(0, Math.ceil(reps.length / 2));
    const second = reps.slice(Math.floor(reps.length / 2));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const delta = (avg(second) - avg(first)) / Math.max(avg(first), 1);
    if (delta > 0.05) return { trend: 'improving', loadTrend: Math.min(1, delta) };
    if (delta < -0.05) return { trend: 'declining', loadTrend: Math.max(-1, delta) };
    return { trend: 'stable', loadTrend: delta };
  }
  const first = loads.slice(0, Math.ceil(loads.length / 2));
  const second = loads.slice(Math.floor(loads.length / 2));
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const delta = (avg(second) - avg(first)) / Math.max(avg(first), 1);
  if (delta > 0.05) return { trend: 'improving', loadTrend: Math.min(1, delta) };
  if (delta < -0.05) return { trend: 'declining', loadTrend: Math.max(-1, delta) };
  return { trend: 'stable', loadTrend: delta };
}

function toleranceFromMi(
  entry: MovementToleranceEntry | undefined,
  constraint: TrainingConstraint | undefined
): ExerciseMovementToleranceSignal {
  if (constraint?.status === 'temporarilyAvoid') return 'poor';
  if (constraint?.status === 'modify') return 'limited';
  if (constraint?.lastOutcome === 'worse') return 'limited';
  if (constraint?.lastOutcome === 'better' && constraint.status === 'monitor') {
    return 'tolerated';
  }
  if (!entry) {
    if (constraint?.status === 'monitor') return 'needs_assessment';
    return 'unknown';
  }
  if (entry.status === 'unknown') return 'unknown';
  if (entry.status === 'needs_assessment') return 'needs_assessment';
  if (typeof entry.score === 'number') {
    if (entry.score < 40) return 'poor';
    if (entry.score < 60) return 'limited';
    return 'tolerated';
  }
  // Provenance without score → needs assessment, not invented "tolerated"
  return 'needs_assessment';
}

function qualityFromSignals(args: {
  catalog: ExerciseData | undefined;
  profile: MovementProfile | undefined;
  completionRate?: number;
  avgRpe?: number;
  constraint?: TrainingConstraint;
}): ExerciseMovementQualitySignal {
  const { catalog, profile, completionRate, avgRpe, constraint } = args;
  if (constraint?.status === 'temporarilyAvoid' || constraint?.lastOutcome === 'worse') {
    return 'poor';
  }

  // Domain profile cues related to this movement — only when scored.
  let domainHits = 0;
  let domainStrong = 0;
  let domainWeak = 0;
  if (profile && catalog) {
    const check = (metric: { status: string; score?: number } | undefined) => {
      if (!metric || metric.status !== 'scored' || typeof metric.score !== 'number') return;
      domainHits += 1;
      if (metric.score >= 70) domainStrong += 1;
      if (metric.score < 45) domainWeak += 1;
    };
    if (catalog.laterality === 'unilateral') {
      check(profile.stability.singleLegStability);
      check(profile.movementControl.unilateralControl);
    }
    if (catalog.miMovementPattern === 'squat' || catalog.movementPattern === 'squat') {
      check(profile.movementControl.squatControl);
      check(profile.stability.kneeControl);
      check(profile.mobility.ankleMobility);
    }
    if (catalog.miMovementPattern === 'hinge' || catalog.movementPattern === 'hinge') {
      check(profile.movementControl.hingeControl);
      check(profile.strength.posteriorChainStrength);
    }
    if (catalog.miMovementPattern === 'lunge' || catalog.movementPattern === 'lunge') {
      check(profile.movementControl.lungeControl);
      check(profile.stability.hipStability);
    }
    if (catalog.miMovementPattern === 'push' || catalog.movementPattern === 'push') {
      check(profile.movementControl.pushingControl);
      check(profile.stability.scapularControl);
    }
    if (catalog.miMovementPattern === 'pull' || catalog.movementPattern === 'pull') {
      check(profile.movementControl.pullingControl);
      check(profile.stability.scapularControl);
    }
    check(profile.movementControl.bracing);
    check(profile.stability.coreStability);
  }

  if (domainWeak > 0) return 'poor';
  if (domainHits === 0) {
    // Performance proxies only — incomplete sets / very high RPE suggest quality issues
    if (typeof completionRate === 'number' && completionRate < 0.6) return 'needs_assessment';
    if (typeof avgRpe === 'number' && avgRpe >= 9.5) return 'needs_assessment';
    return 'unknown';
  }
  if (domainStrong >= Math.ceil(domainHits / 2)) return 'strong';
  return 'adequate';
}

function deriveCompetencyLevel(args: {
  sessionsCompleted: number;
  trend: PerformanceTrend;
  tolerance: ExerciseMovementToleranceSignal;
  quality: ExerciseMovementQualitySignal;
  completionRate?: number;
}): CompetencyLevel {
  const { sessionsCompleted, trend, tolerance, quality } = args;
  if (sessionsCompleted <= 0) return 'unfamiliar';
  if (tolerance === 'poor' || quality === 'poor') {
    return sessionsCompleted >= MIN_SESSIONS_FOR_COMPETENT ? 'learning' : 'learning';
  }
  if (sessionsCompleted < MIN_SESSIONS_FOR_COMPETENT || trend === 'insufficient_data') {
    return 'learning';
  }
  if (tolerance === 'limited' || quality === 'needs_assessment') {
    return 'learning';
  }

  const solidTrend = trend === 'improving' || trend === 'stable';
  const solidTol = tolerance === 'tolerated' || tolerance === 'unknown';
  const solidQual = quality === 'adequate' || quality === 'strong' || quality === 'unknown';

  if (
    sessionsCompleted >= MIN_SESSIONS_FOR_ADVANCED &&
    trend === 'improving' &&
    tolerance === 'tolerated' &&
    (quality === 'strong' || quality === 'adequate')
  ) {
    return 'advanced';
  }
  if (
    sessionsCompleted >= MIN_SESSIONS_FOR_PROFICIENT &&
    solidTrend &&
    solidTol &&
    solidQual &&
    tolerance !== 'unknown'
  ) {
    return 'proficient';
  }
  if (solidTrend && solidTol && solidQual) {
    return 'competent';
  }
  return 'learning';
}

function profileSupportsProgression(
  profile: MovementProfile | undefined,
  current: ExerciseData | undefined,
  next: ExerciseData | undefined
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!profile || !next) return { ok: true, reasons };

  const techJump =
    demandRank(next.technicalComplexity) - demandRank(current?.technicalComplexity);
  const stabJump = demandRank(next.stabilityDemand) - demandRank(current?.stabilityDemand);
  const mobJump = demandRank(next.mobilityDemand) - demandRank(current?.mobilityDemand);

  const scored = (m?: { status: string; score?: number }) =>
    m?.status === 'scored' && typeof m.score === 'number' ? m.score : undefined;

  if (techJump > 0) {
    const control = scored(profile.movementControl.squatControl);
    // Only block when we have evidence of weak control — unknown does not invent readiness
    if (typeof control === 'number' && control < 50) {
      reasons.push('movement_control_below_threshold_for_technical_jump');
    }
  }
  if (stabJump > 0) {
    const stab = scored(profile.stability.singleLegStability) ?? scored(profile.stability.hipStability);
    if (typeof stab === 'number' && stab < 50) {
      reasons.push('stability_below_threshold_for_progression');
    }
  }
  if (mobJump > 0) {
    const mob = scored(profile.mobility.ankleMobility) ?? scored(profile.mobility.hipMobility);
    if (typeof mob === 'number' && mob < 50) {
      reasons.push('mobility_below_threshold_for_progression');
    }
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Pure evaluation — safe to unit test without storage.
 */
export function evaluateExerciseCompetency(input: {
  exerciseId: string;
  exerciseName?: string;
  prior?: ExerciseCompetencyRecord;
  history: WorkoutSession[];
  catalog?: ExerciseData;
  profile?: MovementProfile;
  constraint?: TrainingConstraint;
  toleranceEntry?: MovementToleranceEntry;
  now?: string;
}): ExerciseCompetencyRecord {
  const now = input.now ?? nowIso();
  const catalog = input.catalog ?? resolveCatalogExercise(input.exerciseId);
  const pointsAll = collectPerformancePoints(
    input.history,
    catalog?.id ?? input.exerciseId,
    500
  );
  const points = pointsAll.slice(-LOOKBACK_SESSIONS);
  const { trend, loadTrend } = computePerformanceTrend(points);
  const sessionsCompleted = Math.max(input.prior?.sessionsCompleted ?? 0, pointsAll.length);

  const avgCompletion =
    points.length > 0
      ? points.reduce((s, p) => s + p.completionRate, 0) / points.length
      : undefined;
  const rpePoints = points.filter((p) => typeof p.avgRpe === 'number');
  const avgRpe =
    rpePoints.length > 0
      ? rpePoints.reduce((s, p) => s + (p.avgRpe ?? 0), 0) / rpePoints.length
      : undefined;

  const movementTolerance = toleranceFromMi(input.toleranceEntry, input.constraint);
  const movementQuality = qualityFromSignals({
    catalog,
    profile: input.profile,
    completionRate: avgCompletion,
    avgRpe,
    constraint: input.constraint,
  });

  const competencyLevel = deriveCompetencyLevel({
    sessionsCompleted,
    trend,
    tolerance: movementTolerance,
    quality: movementQuality,
    completionRate: avgCompletion,
  });

  const blocked: string[] = [];
  if (sessionsCompleted < MIN_SESSIONS_FOR_COMPETENT) {
    blocked.push('insufficient_sessions');
  }
  if (trend === 'insufficient_data') blocked.push('insufficient_performance_data');
  if (trend === 'declining') blocked.push('performance_declining');
  if (movementTolerance === 'unknown') blocked.push('tolerance_unknown');
  if (movementTolerance === 'needs_assessment') blocked.push('tolerance_needs_assessment');
  if (movementTolerance === 'limited') blocked.push('tolerance_limited');
  if (movementTolerance === 'poor') blocked.push('tolerance_poor');
  if (movementQuality === 'unknown') blocked.push('movement_quality_unknown');
  if (movementQuality === 'needs_assessment') blocked.push('movement_quality_needs_assessment');
  if (movementQuality === 'poor') blocked.push('movement_quality_poor');
  if (COMPETENCY_LEVEL_RANK[competencyLevel] < COMPETENCY_LEVEL_RANK.competent) {
    blocked.push('competency_below_competent');
  }
  if (input.constraint?.status === 'temporarilyAvoid') blocked.push('active_avoid_constraint');
  if (input.constraint?.status === 'modify') blocked.push('active_modify_constraint');
  if (typeof avgCompletion === 'number' && avgCompletion < 0.75) {
    blocked.push('incomplete_sets');
  }

  // Consistency: need performances spanning > ~7 days when we have dates
  if (points.length >= MIN_SESSIONS_FOR_COMPETENT) {
    const t0 = new Date(points[0].date).getTime();
    const t1 = new Date(points[points.length - 1].date).getTime();
    const spanDays = Math.max(0, (t1 - t0) / (24 * 3600 * 1000));
    if (spanDays < 5) blocked.push('insufficient_consistency_span');
  }

  const progressionReady =
    blocked.length === 0 &&
    COMPETENCY_LEVEL_RANK[competencyLevel] >= COMPETENCY_LEVEL_RANK.competent &&
    (trend === 'improving' || trend === 'stable') &&
    (movementTolerance === 'tolerated') &&
    (movementQuality === 'adequate' || movementQuality === 'strong');

  const spanDays =
    points.length >= 2
      ? Math.max(
          0,
          (new Date(points[points.length - 1].date).getTime() -
            new Date(points[0].date).getTime()) /
            (24 * 3600 * 1000)
        )
      : undefined;

  const evidence: ExerciseCompetencyEvidence = {
    sessionsInWindow: points.length,
    loadTrend,
    completionRate: avgCompletion,
    spanDays,
    avgRpe,
    technicalComplexity: catalog?.technicalComplexity,
    constraintStatus: input.constraint?.status,
  };

  const lastPerformed =
    points.length > 0
      ? points[points.length - 1].date
      : input.prior?.lastPerformed;

  return {
    exerciseId: catalog?.id ?? input.exerciseId,
    exerciseName: catalog?.name ?? input.exerciseName ?? input.prior?.exerciseName,
    competencyLevel,
    sessionsCompleted,
    performanceTrend: trend,
    movementQuality,
    movementTolerance,
    lastPerformed,
    progressionReady,
    progressionBlockedReasons: progressionReady ? [] : blocked,
    evidence,
    createdAt: input.prior?.createdAt ?? now,
    updatedAt: now,
  };
}

export function buildProgressionRecommendation(input: {
  competency: ExerciseCompetencyRecord;
  catalog?: ExerciseData;
  profile?: MovementProfile;
}): ExerciseProgressionRecommendation {
  const catalog =
    input.catalog ?? resolveCatalogExercise(input.competency.exerciseId);
  const progressions = (catalog?.progressions ?? [])
    .map((name) => {
      const ex = getExerciseData(name);
      return ex ? { id: ex.id, name: ex.name } : null;
    })
    .filter((x): x is { id: string; name: string } => Boolean(x));
  const regressions = (catalog?.regressions ?? [])
    .map((name) => {
      const ex = getExerciseData(name);
      return ex ? { id: ex.id, name: ex.name } : null;
    })
    .filter((x): x is { id: string; name: string } => Boolean(x));

  const reasons: string[] = [];
  let action: ProgressionAction = 'hold';

  const c = input.competency;
  const shouldRegress =
    c.movementTolerance === 'poor' ||
    c.movementTolerance === 'limited' ||
    c.movementQuality === 'poor' ||
    c.performanceTrend === 'declining' ||
    c.evidence?.constraintStatus === 'temporarilyAvoid' ||
    c.evidence?.constraintStatus === 'modify';

  if (shouldRegress && regressions.length > 0) {
    action = 'regress';
    reasons.push(
      ...(c.progressionBlockedReasons.length
        ? c.progressionBlockedReasons
        : ['regress_indicated_by_signals'])
    );
  } else if (c.progressionReady && progressions.length > 0) {
    // Filter progressions that jump beyond profile support
    const filtered: Array<{ id: string; name: string; reason?: string }> = [];
    for (const p of progressions) {
      const next = getExerciseById(p.id);
      const support = profileSupportsProgression(input.profile, catalog, next);
      if (support.ok) {
        filtered.push({
          ...p,
          reason: 'catalog_progression_edge',
        });
      } else {
        reasons.push(...support.reasons.map((r) => `${r}:${p.id}`));
      }
    }
    if (filtered.length > 0) {
      reasons.push('progression_ready');
      return {
        exerciseId: c.exerciseId,
        exerciseName: c.exerciseName,
        action: 'progress',
        competency: c,
        progressions: filtered,
        regressions,
        reasons: [...new Set(reasons)],
        considered: {
          strength: true,
          stability: true,
          mobility: true,
          technicalComplexity: true,
          movementControl: true,
          discomfort: true,
          performance: true,
          consistency: true,
        },
      };
    }
    action = 'hold';
    reasons.push('progression_candidates_blocked_by_qualities');
  } else {
    action = 'hold';
    reasons.push(
      ...(c.progressionBlockedReasons.length
        ? c.progressionBlockedReasons
        : ['hold_pending_evidence'])
    );
    if (!progressions.length && !shouldRegress) {
      reasons.push('no_catalog_progression_edge');
    }
  }

  return {
    exerciseId: c.exerciseId,
    exerciseName: c.exerciseName,
    action,
    competency: c,
    progressions: progressions.slice(0, 4),
    regressions: action === 'regress' ? regressions : regressions.slice(0, 4),
    reasons: [...new Set(reasons)],
    considered: {
      strength: true,
      stability: true,
      mobility: true,
      technicalComplexity: true,
      movementControl: true,
      discomfort: true,
      performance: true,
      consistency: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function normalizeRecord(raw: unknown, fallbackId: string): ExerciseCompetencyRecord | null {
  if (!isObject(raw)) return null;
  const exerciseId =
    typeof raw.exerciseId === 'string' && raw.exerciseId.trim()
      ? raw.exerciseId
      : fallbackId;
  const base = createEmptyCompetencyRecord(exerciseId, {
    exerciseName: typeof raw.exerciseName === 'string' ? raw.exerciseName : undefined,
  });
  const levels: CompetencyLevel[] = [
    'unfamiliar',
    'learning',
    'competent',
    'proficient',
    'advanced',
  ];
  const trends: PerformanceTrend[] = [
    'improving',
    'stable',
    'declining',
    'insufficient_data',
  ];
  const qualities: ExerciseMovementQualitySignal[] = [
    'unknown',
    'needs_assessment',
    'poor',
    'adequate',
    'strong',
  ];
  const tolerances: ExerciseMovementToleranceSignal[] = [
    'unknown',
    'needs_assessment',
    'poor',
    'limited',
    'tolerated',
  ];

  return {
    ...base,
    exerciseName:
      typeof raw.exerciseName === 'string' ? raw.exerciseName : base.exerciseName,
    competencyLevel: levels.includes(raw.competencyLevel as CompetencyLevel)
      ? (raw.competencyLevel as CompetencyLevel)
      : 'unfamiliar',
    sessionsCompleted:
      typeof raw.sessionsCompleted === 'number' && raw.sessionsCompleted >= 0
        ? Math.floor(raw.sessionsCompleted)
        : 0,
    performanceTrend: trends.includes(raw.performanceTrend as PerformanceTrend)
      ? (raw.performanceTrend as PerformanceTrend)
      : 'insufficient_data',
    movementQuality: qualities.includes(raw.movementQuality as ExerciseMovementQualitySignal)
      ? (raw.movementQuality as ExerciseMovementQualitySignal)
      : 'unknown',
    movementTolerance: tolerances.includes(
      raw.movementTolerance as ExerciseMovementToleranceSignal
    )
      ? (raw.movementTolerance as ExerciseMovementToleranceSignal)
      : 'unknown',
    lastPerformed:
      typeof raw.lastPerformed === 'string' ? raw.lastPerformed : undefined,
    progressionReady: Boolean(raw.progressionReady),
    progressionBlockedReasons: Array.isArray(raw.progressionBlockedReasons)
      ? raw.progressionBlockedReasons.map(String)
      : [],
    evidence: isObject(raw.evidence)
      ? (raw.evidence as ExerciseCompetencyEvidence)
      : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
  };
}

export function normalizeCompetencyStore(
  raw: unknown,
  userId?: string
): ExerciseCompetencyStore {
  const base = createEmptyCompetencyStore({ userId, now: nowIso() });
  if (!isObject(raw)) return base;
  const recordsIn = isObject(raw.records) ? raw.records : raw;
  const records: Record<string, ExerciseCompetencyRecord> = {};
  if (isObject(recordsIn)) {
    for (const [id, val] of Object.entries(recordsIn)) {
      // Skip store metadata if flattened
      if (id === 'version' || id === 'userId' || id === 'updatedAt' || id === 'records') {
        continue;
      }
      const rec = normalizeRecord(val, id);
      if (rec) records[rec.exerciseId] = rec;
    }
  }
  return {
    version: 1,
    userId: typeof raw.userId === 'string' ? raw.userId : userId,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
    records,
  };
}

export async function loadCompetencyStore(): Promise<ExerciseCompetencyStore> {
  const raw = await loadUserData<unknown>(EXERCISE_COMPETENCY_KEY);
  return normalizeCompetencyStore(raw, currentUserId());
}

export async function saveCompetencyStore(
  store: ExerciseCompetencyStore
): Promise<ExerciseCompetencyStore> {
  const next: ExerciseCompetencyStore = {
    ...normalizeCompetencyStore(store, currentUserId() ?? store.userId),
    updatedAt: nowIso(),
    userId: store.userId ?? currentUserId(),
  };
  await saveUserData(EXERCISE_COMPETENCY_KEY, next);
  return next;
}

export async function getExerciseCompetency(
  exerciseIdOrName: string
): Promise<ExerciseCompetencyRecord> {
  const catalog = resolveCatalogExercise(exerciseIdOrName);
  const id = catalog?.id ?? exerciseIdOrName.trim();
  const store = await loadCompetencyStore();
  return (
    store.records[id] ??
    createEmptyCompetencyRecord(id, { exerciseName: catalog?.name })
  );
}

export async function listExerciseCompetencies(): Promise<ExerciseCompetencyRecord[]> {
  const store = await loadCompetencyStore();
  return Object.values(store.records).sort((a, b) =>
    (b.lastPerformed ?? '').localeCompare(a.lastPerformed ?? '')
  );
}

/**
 * Recompute competency for one exercise from history + MI context and persist.
 */
export async function refreshExerciseCompetency(
  exerciseIdOrName: string
): Promise<ExerciseCompetencyRecord> {
  const catalog = resolveCatalogExercise(exerciseIdOrName);
  const id = catalog?.id ?? exerciseIdOrName.trim();
  const [store, history, profile, constraints] = await Promise.all([
    loadCompetencyStore(),
    loadDedupedWorkoutHistory(),
    loadMovementProfile(),
    loadActiveTrainingConstraints(),
  ]);

  const constraint = constraints.find(
    (c) =>
      (c.exercise &&
        (c.exercise.toLowerCase() === catalog?.name.toLowerCase() ||
          getExerciseData(c.exercise)?.id === id)) ||
      false
  );
  const toleranceEntry = profile.movementTolerance.entries.find(
    (e) =>
      (e.exercise &&
        (e.exercise.toLowerCase() === (catalog?.name ?? '').toLowerCase() ||
          getExerciseData(e.exercise)?.id === id)) ||
      false
  );

  const record = evaluateExerciseCompetency({
    exerciseId: id,
    exerciseName: catalog?.name,
    prior: store.records[id],
    history,
    catalog,
    profile,
    constraint,
    toleranceEntry,
  });

  store.records[id] = record;
  await saveCompetencyStore(store);
  return record;
}

/**
 * After a workout is saved — update competency for every exercise in the session.
 * Safe no-op on failure; never blocks workout completion.
 */
export async function recordCompetencyFromWorkoutSession(
  session: WorkoutSession
): Promise<ExerciseCompetencyRecord[]> {
  const updated: ExerciseCompetencyRecord[] = [];
  const seen = new Set<string>();
  try {
    for (const ex of session.exercises ?? []) {
      const key = sessionExerciseKey(ex);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const target = key.startsWith('name:') ? (ex.name || key) : key;
      const rec = await refreshExerciseCompetency(target);
      updated.push(rec);
    }
  } catch (e) {
    console.warn('[ExerciseCompetency] recordCompetencyFromWorkoutSession failed', e);
  }
  return updated;
}

/**
 * Primary query for future Workout Builder.
 */
export async function getProgressionRecommendation(
  exerciseIdOrName: string
): Promise<ExerciseProgressionRecommendation> {
  const competency = await refreshExerciseCompetency(exerciseIdOrName);
  const catalog = resolveCatalogExercise(competency.exerciseId);
  const profile = await loadMovementProfile();
  return buildProgressionRecommendation({ competency, catalog, profile });
}

/**
 * Walk catalog progression edges forward from an exercise (A → B → C).
 */
export function getProgressionChain(
  exerciseIdOrName: string,
  depth = 4
): Array<{ id: string; name: string }> {
  const start = resolveCatalogExercise(exerciseIdOrName);
  if (!start) return [];
  const chain: Array<{ id: string; name: string }> = [{ id: start.id, name: start.name }];
  const seen = new Set<string>([start.id]);
  let current: ExerciseData | undefined = start;
  for (let i = 0; i < depth; i += 1) {
    const nextName = current?.progressions?.[0];
    if (!nextName) break;
    const next = getExerciseData(nextName);
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    chain.push({ id: next.id, name: next.name });
    current = next;
  }
  return chain;
}

/**
 * Walk catalog regression edges backward (C → B → A).
 */
export function getRegressionChain(
  exerciseIdOrName: string,
  depth = 4
): Array<{ id: string; name: string }> {
  const start = resolveCatalogExercise(exerciseIdOrName);
  if (!start) return [];
  const chain: Array<{ id: string; name: string }> = [{ id: start.id, name: start.name }];
  const seen = new Set<string>([start.id]);
  let current: ExerciseData | undefined = start;
  for (let i = 0; i < depth; i += 1) {
    const prevName = current?.regressions?.[0];
    if (!prevName) break;
    const prev = getExerciseData(prevName);
    if (!prev || seen.has(prev.id)) break;
    seen.add(prev.id);
    chain.push({ id: prev.id, name: prev.name });
    current = prev;
  }
  return chain;
}

/** Suggested next exercise to swap in (progress or regress), or null to hold. */
export async function suggestExerciseSwap(
  exerciseIdOrName: string
): Promise<{ action: ProgressionAction; candidate: { id: string; name: string } | null; recommendation: ExerciseProgressionRecommendation }> {
  const recommendation = await getProgressionRecommendation(exerciseIdOrName);
  if (recommendation.action === 'progress' && recommendation.progressions[0]) {
    return {
      action: 'progress',
      candidate: recommendation.progressions[0],
      recommendation,
    };
  }
  if (recommendation.action === 'regress' && recommendation.regressions[0]) {
    return {
      action: 'regress',
      candidate: recommendation.regressions[0],
      recommendation,
    };
  }
  return { action: 'hold', candidate: null, recommendation };
}

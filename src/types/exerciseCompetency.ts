/**
 * Exercise competency & progression — domain types.
 *
 * Tracks readiness to progress (or need to regress) an exercise.
 * Consumed by future Workout Builder; does not drive generation yet.
 */

import type { DemandLevel } from '../data/exerciseMovementIntelligence';

/** How familiar / skilled the user is with a specific exercise. */
export type CompetencyLevel =
  | 'unfamiliar'
  | 'learning'
  | 'competent'
  | 'proficient'
  | 'advanced';

/** Direction of recent performance (load × reps), when enough data exists. */
export type PerformanceTrend =
  | 'improving'
  | 'stable'
  | 'declining'
  | 'insufficient_data';

/**
 * Observed movement-quality signal for this exercise.
 * Never invent “strong” without evidence.
 */
export type ExerciseMovementQualitySignal =
  | 'unknown'
  | 'needs_assessment'
  | 'poor'
  | 'adequate'
  | 'strong';

/**
 * How well the user tolerates this exercise recently.
 * Distinct from MovementProfile domain qualities.
 */
export type ExerciseMovementToleranceSignal =
  | 'unknown'
  | 'needs_assessment'
  | 'poor'
  | 'limited'
  | 'tolerated';

export type ProgressionAction = 'progress' | 'hold' | 'regress';

export const COMPETENCY_LEVEL_RANK: Record<CompetencyLevel, number> = {
  unfamiliar: 0,
  learning: 1,
  competent: 2,
  proficient: 3,
  advanced: 4,
};

/**
 * Persistent per-user / per-exercise competency record.
 */
export interface ExerciseCompetencyRecord {
  exerciseId: string;
  /** Display name when known (catalog or session). */
  exerciseName?: string;
  competencyLevel: CompetencyLevel;
  sessionsCompleted: number;
  performanceTrend: PerformanceTrend;
  movementQuality: ExerciseMovementQualitySignal;
  movementTolerance: ExerciseMovementToleranceSignal;
  /** ISO timestamp of last completed session containing this exercise. */
  lastPerformed?: string;
  /** True only when evidence supports progressing to a harder variation. */
  progressionReady: boolean;
  /** Machine-readable blockers when progressionReady is false. */
  progressionBlockedReasons: string[];
  /** Soft evidence snapshot (optional; never required to invent scores). */
  evidence?: ExerciseCompetencyEvidence;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseCompetencyEvidence {
  /** Sessions with completed sets in the lookback window. */
  sessionsInWindow?: number;
  /** Best estimated session load (weight × reps) trend slope proxy -1…1. */
  loadTrend?: number;
  /** Fraction of prescribed/logged sets completed 0…1 when known. */
  completionRate?: number;
  /** Days between first and last performance in window. */
  spanDays?: number;
  /** Average RPE when logged. */
  avgRpe?: number;
  /** Catalog technical complexity of current exercise. */
  technicalComplexity?: DemandLevel;
  /** Active MI constraint status when present. */
  constraintStatus?: string;
  /** Last Better / Same / Worse movement response for this exercise. */
  lastFeedbackOutcome?: 'better' | 'same' | 'worse';
}

/** Result of evaluating whether to progress, hold, or regress. */
export interface ExerciseProgressionRecommendation {
  exerciseId: string;
  exerciseName?: string;
  action: ProgressionAction;
  competency: ExerciseCompetencyRecord;
  /** Next harder catalog exercises (relationships). */
  progressions: Array<{ id: string; name: string; reason?: string }>;
  /** Easier catalog exercises (relationships). */
  regressions: Array<{ id: string; name: string; reason?: string }>;
  /** Human-readable rationale for builders / coach. */
  reasons: string[];
  /** Factors considered in this decision. */
  considered: {
    strength: boolean;
    stability: boolean;
    mobility: boolean;
    technicalComplexity: boolean;
    movementControl: boolean;
    discomfort: boolean;
    performance: boolean;
    consistency: boolean;
  };
}

/** Map of exerciseId → record (persisted shape). */
export interface ExerciseCompetencyStore {
  version: 1;
  userId?: string;
  updatedAt: string;
  records: Record<string, ExerciseCompetencyRecord>;
}

export function createEmptyCompetencyStore(opts?: {
  userId?: string;
  now?: string;
}): ExerciseCompetencyStore {
  const now = opts?.now ?? new Date().toISOString();
  return {
    version: 1,
    userId: opts?.userId,
    updatedAt: now,
    records: {},
  };
}

export function createEmptyCompetencyRecord(
  exerciseId: string,
  opts?: { exerciseName?: string; now?: string }
): ExerciseCompetencyRecord {
  const now = opts?.now ?? new Date().toISOString();
  return {
    exerciseId,
    exerciseName: opts?.exerciseName,
    competencyLevel: 'unfamiliar',
    sessionsCompleted: 0,
    performanceTrend: 'insufficient_data',
    movementQuality: 'unknown',
    movementTolerance: 'unknown',
    progressionReady: false,
    progressionBlockedReasons: ['insufficient_data'],
    createdAt: now,
    updatedAt: now,
  };
}

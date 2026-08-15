/**
 * TYL Movement Intelligence — foundational domain types.
 *
 * These models are the persistence contract for later MI phases
 * (constraint-aware programming, reassessment, video analysis).
 * They intentionally do NOT drive workout generation yet.
 *
 * Free-text injury notes remain on CoachingProfile.constraintProfile;
 * MI stores structured, scored, and historical movement data separately.
 *
 * Exercise catalog Movement Intelligence metadata (qualities, joint demands,
 * regressions/progressions) lives on ExerciseData via
 * `src/data/exerciseMovementIntelligence.ts`. Catalog `MovementPattern`
 * (stretch/isometric/cardio) is distinct from this file's MovementPattern;
 * use `toMiMovementPattern()` to bridge.
 */

/** Where a movement-quality signal came from. */
export type MovementDataSource =
  | 'user_input'
  | 'workout_performance'
  | 'movement_assessment'
  | 'video_analysis'
  | 'exercise_feedback'
  /** @deprecated Prefer `user_input` — kept for persisted v1 profiles. */
  | 'user_report'
  /** @deprecated Prefer `exercise_feedback` — kept for persisted v1 profiles. */
  | 'workout_feedback';

/** Metric lifecycle — never invent scores when evidence is missing. */
export type MovementMetricStatus = 'unknown' | 'needs_assessment' | 'scored';

/** Stability qualities tracked on the user MovementProfile. */
export type StabilityQualityKey =
  | 'hipStability'
  | 'kneeControl'
  | 'ankleStability'
  | 'shoulderStability'
  | 'scapularControl'
  | 'coreStability'
  | 'singleLegStability';

/** Mobility qualities tracked on the user MovementProfile. */
export type MobilityQualityKey =
  | 'ankleMobility'
  | 'hipMobility'
  | 'thoracicMobility'
  | 'shoulderMobility';

/** Strength qualities tracked on the user MovementProfile. */
export type StrengthQualityKey =
  | 'lowerBodyStrength'
  | 'upperBodyPushing'
  | 'upperBodyPulling'
  | 'posteriorChainStrength'
  | 'coreStrength';

/** Movement-control qualities tracked on the user MovementProfile. */
export type MovementControlQualityKey =
  | 'squatControl'
  | 'hingeControl'
  | 'lungeControl'
  | 'pushingControl'
  | 'pullingControl'
  | 'unilateralControl'
  | 'bracing';

/** Domain buckets (for history / UI grouping). */
export type MovementDomainKey =
  | 'stability'
  | 'mobility'
  | 'strength'
  | 'movementControl'
  | 'movementTolerance';

/** Any quality key that can appear on history / assessment findings. */
export type MovementQualityKey =
  | MovementDomainKey
  | StabilityQualityKey
  | MobilityQualityKey
  | StrengthQualityKey
  | MovementControlQualityKey;

export const STABILITY_QUALITY_KEYS: readonly StabilityQualityKey[] = [
  'hipStability',
  'kneeControl',
  'ankleStability',
  'shoulderStability',
  'scapularControl',
  'coreStability',
  'singleLegStability',
] as const;

export const MOBILITY_QUALITY_KEYS: readonly MobilityQualityKey[] = [
  'ankleMobility',
  'hipMobility',
  'thoracicMobility',
  'shoulderMobility',
] as const;

export const STRENGTH_QUALITY_KEYS: readonly StrengthQualityKey[] = [
  'lowerBodyStrength',
  'upperBodyPushing',
  'upperBodyPulling',
  'posteriorChainStrength',
  'coreStrength',
] as const;

export const MOVEMENT_CONTROL_QUALITY_KEYS: readonly MovementControlQualityKey[] = [
  'squatControl',
  'hingeControl',
  'lungeControl',
  'pushingControl',
  'pullingControl',
  'unilateralControl',
  'bracing',
] as const;

/**
 * A single quality dimension.
 * `score` is only present when `status === 'scored'` — never invent values.
 */
export interface MovementQualityMetric {
  status: MovementMetricStatus;
  /** 0–100 when status is `scored`; omit otherwise. */
  score?: number;
  /** 0–1 confidence in the score / signal. */
  confidence?: number;
  /** ISO timestamp of last evidence update. */
  lastUpdated?: string;
  /** Primary / latest provenance. */
  dataSource?: MovementDataSource;
  /** All contributing sources (union over time). */
  dataSources?: MovementDataSource[];
}

/**
 * How well the user tolerates a specific exercise or movement pattern.
 * Separate from domain quality scores — response-specific.
 */
export interface MovementToleranceEntry {
  id: string;
  exercise?: string;
  movementPattern?: MovementPattern;
  status: MovementMetricStatus;
  /** 0–100 tolerance when scored; omit when unknown / needs assessment. */
  score?: number;
  confidence?: number;
  lastUpdated?: string;
  dataSource?: MovementDataSource;
  dataSources?: MovementDataSource[];
  notes?: string;
}

export type BodySide = 'left' | 'right' | 'bilateral' | 'midline' | 'unspecified';

/** Broad body regions used across reports and constraints. */
export type BodyArea =
  | 'neck'
  | 'shoulder'
  | 'upper_back'
  | 'lower_back'
  | 'elbow'
  | 'wrist'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'foot'
  | 'core'
  | 'other';

export type SensationType =
  | 'sharp'
  | 'dull'
  | 'ache'
  | 'tightness'
  | 'pinching'
  | 'burning'
  | 'pressure'
  | 'weakness'
  | 'stiffness'
  | 'numbness'
  | 'tingling'
  | 'instability'
  | 'other';

export type DiscomfortFrequency =
  | 'one_time'
  | 'occasional'
  | 'frequent'
  | 'every_session'
  | 'constant';

export type DiscomfortOnset =
  | 'warm_up'
  | 'during_set'
  | 'between_sets'
  | 'after_workout'
  | 'later'
  | 'next_day'
  | 'unknown';

export type ModificationResponse = 'improved' | 'unchanged' | 'worsened' | 'unknown';

export type DiscomfortTrend = 'improving' | 'stable' | 'worsening' | 'unknown';

export type DiscomfortStatus =
  | 'active'
  | 'monitoring'
  | 'resolved'
  | 'archived';

export type MovementPhase =
  | 'beginning'
  | 'eccentric'
  | 'bottom'
  | 'concentric'
  | 'lockout'
  | 'isometric'
  | 'transition'
  | 'after_exercise'
  | 'later'
  | 'next_day'
  | 'unknown';

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'push'
  | 'pull'
  | 'carry'
  | 'rotate'
  | 'gait'
  | 'overhead'
  | 'isolation'
  | 'other';

/**
 * How the workout generator (future) should treat a constraint.
 * `normal` means no special handling for this entry.
 */
export type TrainingConstraintStatus =
  | 'normal'
  | 'monitor'
  | 'modify'
  | 'temporarilyAvoid';

export type PostWorkoutMovementOutcome = 'better' | 'same' | 'worse';

/**
 * Progressive return path for a modified movement.
 * Never permanently marks an exercise as "bad."
 */
export type ProgressiveReturnStage =
  | 'modified'
  | 'regression'
  | 'normal_variation'
  | 'progressive_loading'
  | 'cleared';

export type MovementAssessmentKind =
  | 'baseline'
  | 'follow_up'
  | 'return_to_training'
  | 'video'
  | 'self_check'
  | 'other';

// ---------------------------------------------------------------------------
// MovementProfile
// ---------------------------------------------------------------------------

export interface MovementProfileHistoryEntry {
  id: string;
  /** ISO timestamp. */
  timestamp: string;
  /** Short machine-readable reason, e.g. "discomfort_report", "assessment". */
  event: string;
  summary?: string;
  /** Optional snapshot of quality keys that changed. */
  changedQualities?: MovementQualityKey[];
}

/**
 * Persistent per-user movement intelligence profile.
 * Granular qualities start as `unknown` until evidence exists — never invent scores.
 * Schema v2; v1 aggregates are migrated on load.
 */
export interface MovementProfile {
  /** Schema version for forward migrations. */
  version: 2;
  userId?: string;
  createdAt: string;
  updatedAt: string;

  stability: Record<StabilityQualityKey, MovementQualityMetric>;
  mobility: Record<MobilityQualityKey, MovementQualityMetric>;
  strength: Record<StrengthQualityKey, MovementQualityMetric>;
  movementControl: Record<MovementControlQualityKey, MovementQualityMetric>;
  /** Per-exercise / per-pattern response tracking. */
  movementTolerance: {
    entries: MovementToleranceEntry[];
  };

  /** Soft focus themes for coaching / future programming. */
  currentFocusAreas: string[];
  /** Body regions currently implicated. */
  affectedAreas: BodyArea[];
  /** Free-form or structured exercise names the user should treat carefully. */
  exerciseLimitations: string[];
  /** Human-readable modifications currently in play. */
  trainingModifications: string[];
  /** ISO dates for planned / completed reassessments. */
  reassessmentDates: string[];
  history: MovementProfileHistoryEntry[];
}

// ---------------------------------------------------------------------------
// DiscomfortReport
// ---------------------------------------------------------------------------

export interface DiscomfortReport {
  id: string;
  /** ISO timestamp when the report was filed. */
  timestamp: string;
  bodyArea: BodyArea;
  /** Free-text when bodyArea is `other`. */
  bodyAreaOther?: string;
  side: BodySide;
  sensation: SensationType;
  sensationOther?: string;
  /** 0–10 severity. */
  severity: number;
  exercise?: string;
  movementPattern?: MovementPattern;
  movementPhase?: MovementPhase;
  frequency?: DiscomfortFrequency;
  onset?: DiscomfortOnset;
  modificationsAttempted?: string[];
  modificationResponse?: ModificationResponse;
  trend?: DiscomfortTrend;
  status: DiscomfortStatus;
  /** Links to TrainingConstraint ids or free-text notes. */
  relatedTrainingAdjustments?: string[];
  notes?: string;
}

// ---------------------------------------------------------------------------
// TrainingConstraint
// ---------------------------------------------------------------------------

export interface TrainingConstraint {
  id: string;
  /** Specific exercise name when the constraint is exercise-scoped. */
  exercise?: string;
  /** Pattern-level constraint when not exercise-specific. */
  movementPattern?: MovementPattern;
  status: TrainingConstraintStatus;
  /** Soft cap on relative intensity (e.g. 0.7 = ~70% of normal). */
  intensityLimit?: number;
  /** Soft cap on relative volume (sets/reps). */
  volumeLimit?: number;
  /** Range-of-motion guidance, e.g. "parallel_only", "pain_free_rom". */
  romLimit?: string;
  preferredVariations?: string[];
  avoidedVariations?: string[];
  reason: string;
  /** ISO date (YYYY-MM-DD) or full timestamp. */
  startDate: string;
  reassessmentDate?: string;
  /** Linked DiscomfortReport / MovementAssessment ids. */
  sourceIds?: string[];
  /** Where this movement sits on the progressive-return path. */
  progressiveReturnStage?: ProgressiveReturnStage;
  /** Consecutive better / same / worse responses for this constraint. */
  consecutiveBetter?: number;
  consecutiveSame?: number;
  consecutiveWorse?: number;
  lastOutcome?: PostWorkoutMovementOutcome;
  lastDiscomfortSeverity?: number;
  /** Human-readable modification currently applied (e.g. "Goblet Squats · 70% load"). */
  modificationUsed?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

// ---------------------------------------------------------------------------
// MovementAssessment
// ---------------------------------------------------------------------------

export interface MovementAssessmentFinding {
  area?: BodyArea;
  quality?: MovementQualityKey;
  /** Observed score for this finding when available. */
  score?: number;
  notes?: string;
}

/**
 * Point-in-time assessment (self-check, coach, or video).
 * Findings may update MovementProfile qualities in a later phase.
 */
export interface MovementAssessment {
  id: string;
  /** ISO timestamp. */
  timestamp: string;
  kind: MovementAssessmentKind;
  title?: string;
  findings: MovementAssessmentFinding[];
  overallNotes?: string;
  dataSource: MovementDataSource;
  /** Optional link to stored video / media asset id. */
  mediaRef?: string;
  assessor?: 'user' | 'coach' | 'system';
}

// ---------------------------------------------------------------------------
// PostWorkoutMovementFeedback
// ---------------------------------------------------------------------------

export interface PostWorkoutMovementFeedback {
  id: string;
  /** ISO timestamp. */
  timestamp: string;
  outcome: PostWorkoutMovementOutcome;
  /** 0–10 discomfort after the session, when reported. */
  discomfortSeverity?: number;
  /** Prior discomfort for the same exercise/constraint when known. */
  previousDiscomfortSeverity?: number;
  exercise?: string;
  /** Catalog / MI movement pattern when known. */
  movementPattern?: MovementPattern;
  /** What modification was in play (variation name, reduced load, etc.). */
  modificationUsed?: string;
  /** Progressive-return stage at time of feedback. */
  progressiveReturnStage?: ProgressiveReturnStage;
  /** Linked training constraint id. */
  relatedTrainingConstraintId?: string;
  /** Workout session id when feedback is tied to a logged workout. */
  workoutSessionId?: string;
  notes?: string;
  bodyArea?: BodyArea;
  relatedDiscomfortReportId?: string;
}

// ---------------------------------------------------------------------------
// Safety & escalation (conservative; not diagnostic)
// ---------------------------------------------------------------------------

/**
 * What TYL should do next with training automation.
 * `professional_evaluation` means stop auto-modifying and recommend
 * that the user seek evaluation from a qualified healthcare professional.
 */
export type MovementSafetyStatus =
  | 'continue'
  | 'modify'
  | 'monitor'
  | 'professional_evaluation';

/** Risk band for the future Movement Intelligence engine. */
export type MovementSafetyLevel = 'low' | 'moderate' | 'monitor' | 'high';

/**
 * Optional explicit signals not always captured on DiscomfortReport yet.
 * Pass only when the user has clearly indicated them — never infer diagnoses.
 */
export interface DiscomfortSafetySignals {
  /** Recent significant trauma (impact, fall, collision). */
  recentTrauma?: boolean;
  /** Noticeable / significant swelling. */
  significantSwelling?: boolean;
  /** Cannot normally use or bear weight on the area. */
  limitedWeightBearingOrUse?: boolean;
  /** Sudden major loss of strength (not ordinary fatigue). */
  suddenMajorStrengthLoss?: boolean;
}

/** Machine-readable factor codes — coaching signals, not injury labels. */
export type MovementSafetyFactorCode =
  | 'severe_discomfort'
  | 'rapidly_worsening'
  | 'worsening_despite_modification'
  | 'numbness_or_tingling'
  | 'high_severity_weakness'
  | 'high_severity_instability'
  | 'frequent_high_load'
  | 'recent_trauma'
  | 'significant_swelling'
  | 'limited_weight_bearing_or_use'
  | 'sudden_major_strength_loss'
  | 'moderate_discomfort'
  | 'sharp_with_elevated_severity'
  | 'regular_recurrence'
  | 'modification_not_helping'
  | 'mild_signal';

export interface MovementSafetyFactor {
  code: MovementSafetyFactorCode;
  /** Short non-alarming description for logs / future engine. */
  detail: string;
}

/**
 * Result consumed by the future Movement Intelligence engine.
 *
 * Example:
 *   { status: 'modify', safetyLevel: 'monitor' }
 *   { status: 'professional_evaluation', safetyLevel: 'high' }
 */
export interface MovementSafetyAssessmentResult {
  status: MovementSafetyStatus;
  safetyLevel: MovementSafetyLevel;
  /** Coach-facing copy for the user — never diagnostic. */
  userMessage: string;
  factors: MovementSafetyFactor[];
  /**
   * When true, TYL should not automatically rewrite training and should
   * prefer professional-evaluation messaging.
   */
  pauseAutomaticTrainingModification: boolean;
  /** Report id when evaluation was tied to a stored report. */
  sourceReportId?: string;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Adaptive training plan (generator-facing constraints)
// ---------------------------------------------------------------------------

/**
 * Atomic adaptation the workout generator may apply to one exercise.
 * Reasons are training-priority language — never diagnostic.
 */
export type AdaptationActionKind =
  | 'reduce_intensity'
  | 'reduce_volume'
  | 'reduce_rom'
  | 'substitute'
  | 'regress'
  | 'add_stability'
  | 'add_strength'
  | 'add_mobility'
  | 'temporarily_avoid'
  | 'monitor'
  | 'continue_unrelated';

export interface ExerciseModificationDirective {
  exerciseName: string;
  exerciseId?: string;
  action: AdaptationActionKind;
  /** Soft cap on relative intensity (e.g. 0.7 = ~70% of normal). */
  intensityLimit?: number;
  /** Soft cap on relative volume (sets × load exposure). */
  volumeLimit?: number;
  /** e.g. "pain_free_rom", "parallel_only", "shortened_rom". */
  romLimit?: string;
  /** Preferred single replacement when substituting / regressing. */
  preferredReplacement?: string;
  preferredVariations?: string[];
  /** Non-diagnostic coaching rationale. */
  reason: string;
}

/**
 * Structured constraints the existing workout generator can consume later.
 * Prefer smallest necessary change; keep unrelated work intact.
 */
export interface MovementConstraints {
  exercisesToModify: ExerciseModificationDirective[];
  exercisesToMonitor: string[];
  preferredVariations: string[];
  movementQualitiesToBuild: string[];
  mobilityPriorities: string[];
  stabilityPriorities: string[];
  strengthPriorities: string[];
  exercisesToAvoid: string[];
  /** Catalog movement patterns to treat carefully (not blanket delete lower body). */
  patternsToModify: MovementPattern[];
  patternsToMonitor: MovementPattern[];
  reassessmentRequired: boolean;
  reassessmentDate?: string;
  /** Always true in v1 — generator should keep unrelated work. */
  preserveUnrelatedExercises: boolean;
}

/**
 * Full Adaptive Training Engine output for one feedback event (or batch).
 */
export interface MovementAdaptationPlan {
  version: 1;
  generatedAt: string;
  sourceReportIds: string[];
  safety: MovementSafetyAssessmentResult;
  movementConstraints: MovementConstraints;
  /**
   * Short training-priority statements (not diagnoses), e.g.
   * "Knee discomfort reported during squatting — hip stability is an appropriate training focus."
   */
  trainingPriorities: string[];
  /** Soft coach summary for UI / logs. */
  userFacingSummary: string;
  /**
   * Ready-to-persist TrainingConstraint rows (ids assigned on save).
   * Generator may also read `movementConstraints` directly.
   */
  proposedConstraints: Array<
    Omit<TrainingConstraint, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  >;
}

export function createEmptyMovementConstraints(): MovementConstraints {
  return {
    exercisesToModify: [],
    exercisesToMonitor: [],
    preferredVariations: [],
    movementQualitiesToBuild: [],
    mobilityPriorities: [],
    stabilityPriorities: [],
    strengthPriorities: [],
    exercisesToAvoid: [],
    patternsToModify: [],
    patternsToMonitor: [],
    reassessmentRequired: false,
    preserveUnrelatedExercises: true,
  };
}

// ---------------------------------------------------------------------------
// Aggregate snapshot (convenience for later phases)
// ---------------------------------------------------------------------------

export interface MovementIntelligenceSnapshot {
  profile: MovementProfile;
  discomfortReports: DiscomfortReport[];
  trainingConstraints: TrainingConstraint[];
  movementAssessments: MovementAssessment[];
  postWorkoutFeedback: PostWorkoutMovementFeedback[];
  /** Latest adaptation plan when available (not always persisted). */
  latestAdaptationPlan?: MovementAdaptationPlan | null;
}

/** Empty metric — no invented score. */
export function emptyMovementQualityMetric(
  status: MovementMetricStatus = 'unknown'
): MovementQualityMetric {
  return { status };
}

function emptyQualityRecord<K extends string>(
  keys: readonly K[]
): Record<K, MovementQualityMetric> {
  const out = {} as Record<K, MovementQualityMetric>;
  for (const key of keys) {
    out[key] = emptyMovementQualityMetric('unknown');
  }
  return out;
}

export function createEmptyMovementProfile(opts?: {
  userId?: string;
  now?: string;
}): MovementProfile {
  const now = opts?.now ?? new Date().toISOString();
  return {
    version: 2,
    userId: opts?.userId,
    createdAt: now,
    updatedAt: now,
    stability: emptyQualityRecord(STABILITY_QUALITY_KEYS),
    mobility: emptyQualityRecord(MOBILITY_QUALITY_KEYS),
    strength: emptyQualityRecord(STRENGTH_QUALITY_KEYS),
    movementControl: emptyQualityRecord(MOVEMENT_CONTROL_QUALITY_KEYS),
    movementTolerance: { entries: [] },
    currentFocusAreas: [],
    affectedAreas: [],
    exerciseLimitations: [],
    trainingModifications: [],
    reassessmentDates: [],
    history: [],
  };
}

/** True when a metric has no usable score yet. */
export function isMovementMetricUnresolved(metric: MovementQualityMetric): boolean {
  return metric.status === 'unknown' || metric.status === 'needs_assessment' || metric.score == null;
}

/** Human label for unresolved metrics (UI / coach copy). */
export function movementMetricStatusLabel(metric: MovementQualityMetric): string {
  if (metric.status === 'scored' && typeof metric.score === 'number') return 'scored';
  if (metric.status === 'needs_assessment') return 'needs assessment';
  return 'unknown';
}

export function listUnresolvedMovementQualities(profile: MovementProfile): Array<{
  domain: Exclude<MovementDomainKey, 'movementTolerance'>;
  key: string;
  status: MovementMetricStatus;
}> {
  const out: Array<{
    domain: Exclude<MovementDomainKey, 'movementTolerance'>;
    key: string;
    status: MovementMetricStatus;
  }> = [];
  const push = (
    domain: Exclude<MovementDomainKey, 'movementTolerance'>,
    record: Record<string, MovementQualityMetric>
  ) => {
    for (const [key, metric] of Object.entries(record)) {
      if (isMovementMetricUnresolved(metric)) {
        out.push({ domain, key, status: metric.status });
      }
    }
  };
  push('stability', profile.stability);
  push('mobility', profile.mobility);
  push('strength', profile.strength);
  push('movementControl', profile.movementControl);
  return out;
}

export function createEmptyMovementIntelligenceSnapshot(opts?: {
  userId?: string;
}): MovementIntelligenceSnapshot {
  return {
    profile: createEmptyMovementProfile(opts),
    discomfortReports: [],
    trainingConstraints: [],
    movementAssessments: [],
    postWorkoutFeedback: [],
    latestAdaptationPlan: null,
  };
}

/**
 * Movement Intelligence feedback loop.
 *
 * Learns from how the user responds to modified training:
 *   modified workout → quick feedback → adapt constraints + MovementProfile
 *
 * Progressive return path:
 *   modified → regression → normal_variation → progressive_loading → cleared
 *
 * Does not invent progress without evidence.
 * Does not permanently classify exercises as "bad."
 * Does not diagnose.
 */

import type {
  BodyArea,
  MovementPattern,
  MovementProfile,
  PostWorkoutMovementFeedback,
  PostWorkoutMovementOutcome,
  ProgressiveReturnStage,
  TrainingConstraint,
  TrainingConstraintStatus,
} from '../types/movementIntelligence';
import {
  appendPostWorkoutMovementFeedback,
  archiveTrainingConstraint,
  loadActiveTrainingConstraints,
  loadDiscomfortReports,
  loadMovementProfile,
  loadPostWorkoutMovementFeedback,
  saveMovementProfile,
  upsertToleranceEntryOnProfile,
  upsertTrainingConstraint,
} from './MovementIntelligenceService';

const IMPROVE_STREAK_TO_ADVANCE = 2;
const SAME_STREAK_TO_MONITOR = 3;
const SAME_STREAK_TO_ESCALATE_HINT = 4;

export type MovementFeedbackLoopResult = {
  feedback: PostWorkoutMovementFeedback;
  constraint: TrainingConstraint | null;
  profile: MovementProfile;
  /** Soft coaching note — never diagnostic. */
  userMessage: string;
  /** True when unchanged responses suggest considering professional evaluation. */
  suggestProfessionalEvaluation: boolean;
  stage: ProgressiveReturnStage;
};

export type SubmitMovementResponseFeedbackInput = {
  outcome: PostWorkoutMovementOutcome;
  /** 0–10 current discomfort. */
  discomfortSeverity?: number;
  exercise?: string;
  movementPattern?: MovementPattern;
  bodyArea?: BodyArea;
  notes?: string;
  workoutSessionId?: string;
  /** Override when UI already resolved the active constraint. */
  constraintId?: string;
  modificationUsed?: string;
  now?: string;
};

function nowIso(override?: string): string {
  return override ?? new Date().toISOString();
}

function clampSeverity(raw: number | undefined): number | undefined {
  if (raw == null || !Number.isFinite(raw)) return undefined;
  return Math.max(0, Math.min(10, Math.round(raw)));
}

function describeModification(c: TrainingConstraint): string {
  if (c.modificationUsed?.trim()) return c.modificationUsed.trim();
  const parts: string[] = [];
  if (c.preferredVariations?.[0]) parts.push(c.preferredVariations[0]);
  if (typeof c.intensityLimit === 'number') {
    parts.push(`${Math.round(c.intensityLimit * 100)}% load`);
  }
  if (typeof c.volumeLimit === 'number') {
    parts.push(`${Math.round(c.volumeLimit * 100)}% volume`);
  }
  if (c.romLimit) parts.push(c.romLimit.replace(/_/g, ' '));
  if (c.progressiveReturnStage && c.progressiveReturnStage !== 'cleared') {
    parts.push(c.progressiveReturnStage.replace(/_/g, ' '));
  }
  return parts.length ? parts.join(' · ') : 'modified training demand';
}

function stageRank(stage: ProgressiveReturnStage): number {
  const order: ProgressiveReturnStage[] = [
    'modified',
    'regression',
    'normal_variation',
    'progressive_loading',
    'cleared',
  ];
  return order.indexOf(stage);
}

function nextStage(stage: ProgressiveReturnStage): ProgressiveReturnStage {
  const order: ProgressiveReturnStage[] = [
    'modified',
    'regression',
    'normal_variation',
    'progressive_loading',
    'cleared',
  ];
  const i = order.indexOf(stage);
  return order[Math.min(order.length - 1, Math.max(0, i) + 1)] ?? 'cleared';
}

function prevStage(stage: ProgressiveReturnStage): ProgressiveReturnStage {
  const order: ProgressiveReturnStage[] = [
    'modified',
    'regression',
    'normal_variation',
    'progressive_loading',
    'cleared',
  ];
  const i = order.indexOf(stage);
  return order[Math.max(0, (i < 0 ? 0 : i) - 1)] ?? 'modified';
}

function defaultStageForStatus(status: TrainingConstraintStatus): ProgressiveReturnStage {
  if (status === 'temporarilyAvoid') return 'modified';
  if (status === 'monitor') return 'regression';
  if (status === 'modify') return 'modified';
  if (status === 'normal') return 'progressive_loading';
  return 'modified';
}

function limitsForStage(stage: ProgressiveReturnStage): {
  intensity: number;
  volume: number;
  rom?: string;
  status: TrainingConstraintStatus;
} {
  switch (stage) {
    case 'modified':
      return {
        intensity: 0.65,
        volume: 0.7,
        rom: 'shortened_or_pain_free_rom',
        status: 'modify',
      };
    case 'regression':
      return {
        intensity: 0.75,
        volume: 0.8,
        rom: 'pain_free_rom',
        status: 'modify',
      };
    case 'normal_variation':
      return {
        intensity: 0.85,
        volume: 0.9,
        rom: 'pain_free_rom',
        status: 'monitor',
      };
    case 'progressive_loading':
      return {
        intensity: 0.95,
        volume: 0.95,
        rom: undefined,
        status: 'monitor',
      };
    case 'cleared':
      return { intensity: 1, volume: 1, status: 'normal' };
    default:
      return {
        intensity: 0.7,
        volume: 0.75,
        rom: 'pain_free_rom',
        status: 'monitor',
      };
  }
}

/** Active exercise-scoped constraints that warrant a quick check-in. */
export async function loadFeedbackCandidates(): Promise<TrainingConstraint[]> {
  const active = await loadActiveTrainingConstraints();
  return active.filter((c) => Boolean(c.exercise?.trim()) && !c.archivedAt);
}

export async function resolveConstraintForFeedback(opts: {
  constraintId?: string;
  exercise?: string;
}): Promise<TrainingConstraint | null> {
  const active = await loadActiveTrainingConstraints();
  if (opts.constraintId) {
    const hit = active.find((c) => c.id === opts.constraintId);
    if (hit) return hit;
  }
  if (opts.exercise?.trim()) {
    const key = opts.exercise.trim().toLowerCase();
    const hit = active.find((c) => c.exercise?.trim().toLowerCase() === key);
    if (hit) return hit;
    // Also match preferred variation names (user trained the modified version)
    const viaVar = active.find((c) =>
      (c.preferredVariations ?? []).some((v) => v.toLowerCase() === key)
    );
    if (viaVar) return viaVar;
  }
  // Prefer most recently updated exercise-scoped constraint
  const scoped = active
    .filter((c) => c.exercise?.trim())
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return scoped[0] ?? null;
}

async function previousDiscomfortForExercise(exercise?: string): Promise<number | undefined> {
  if (!exercise?.trim()) return undefined;
  const key = exercise.trim().toLowerCase();

  const [feedback, reports] = await Promise.all([
    loadPostWorkoutMovementFeedback(),
    loadDiscomfortReports(),
  ]);

  const priorFb = feedback.find(
    (f) => f.exercise?.trim().toLowerCase() === key && typeof f.discomfortSeverity === 'number'
  );
  if (priorFb?.discomfortSeverity != null) return priorFb.discomfortSeverity;

  const priorReport = reports.find(
    (r) => r.exercise?.trim().toLowerCase() === key && typeof r.severity === 'number'
  );
  return priorReport?.severity;
}

/**
 * Submit quick post-modification feedback and adapt constraints + profile.
 */
export async function submitMovementResponseFeedback(
  input: SubmitMovementResponseFeedbackInput
): Promise<MovementFeedbackLoopResult> {
  const now = nowIso(input.now);
  const severity = clampSeverity(input.discomfortSeverity);

  const constraint = await resolveConstraintForFeedback({
    constraintId: input.constraintId,
    exercise: input.exercise,
  });

  const exerciseName =
    input.exercise?.trim() || constraint?.exercise?.trim() || undefined;
  const previousDiscomfort =
    constraint?.lastDiscomfortSeverity ??
    (await previousDiscomfortForExercise(exerciseName));

  const stageBefore: ProgressiveReturnStage =
    constraint?.progressiveReturnStage ??
    (constraint ? defaultStageForStatus(constraint.status) : 'modified');

  const modificationUsed =
    input.modificationUsed?.trim() ||
    (constraint ? describeModification(constraint) : undefined);

  const feedback = await appendPostWorkoutMovementFeedback({
    outcome: input.outcome,
    discomfortSeverity: severity,
    previousDiscomfortSeverity: previousDiscomfort,
    exercise: exerciseName,
    movementPattern: input.movementPattern ?? constraint?.movementPattern,
    modificationUsed,
    progressiveReturnStage: stageBefore,
    relatedTrainingConstraintId: constraint?.id,
    workoutSessionId: input.workoutSessionId,
    notes: input.notes?.trim() || undefined,
    bodyArea: input.bodyArea,
    relatedDiscomfortReportId: constraint?.sourceIds?.[0],
    timestamp: now,
  });

  let updatedConstraint: TrainingConstraint | null = constraint;
  let stageAfter = stageBefore;
  let suggestProfessionalEvaluation = false;
  let userMessage =
    "Got it — I'll use this to guide how we progress this movement.";

  if (constraint) {
    const adapted = await adaptConstraintFromFeedback({
      constraint,
      outcome: input.outcome,
      severity,
      stageBefore,
      now,
    });
    updatedConstraint = adapted.constraint;
    stageAfter = adapted.stage;
    suggestProfessionalEvaluation = adapted.suggestProfessionalEvaluation;
    userMessage = adapted.userMessage;
  }

  const profile = await updateProfileFromFeedback({
    outcome: input.outcome,
    exerciseName,
    stageAfter,
    suggestProfessionalEvaluation,
    now,
  });

  // Soft competency / tolerance update — feeds next Workout Builder selection.
  try {
    await applyFeedbackToExerciseCompetency({
      exerciseName,
      outcome: input.outcome,
      now,
    });
  } catch (e) {
    console.warn('[MovementFeedbackLoop] competency update failed', e);
  }

  return {
    feedback,
    constraint: updatedConstraint,
    profile,
    userMessage,
    suggestProfessionalEvaluation,
    stage: stageAfter,
  };
}

/**
 * Update exercise competency tolerance / quality signals from Better/Same/Worse.
 * Does not invent numeric MovementProfile scores.
 */
async function applyFeedbackToExerciseCompetency(args: {
  exerciseName?: string;
  outcome: PostWorkoutMovementOutcome;
  now: string;
}): Promise<void> {
  const name = args.exerciseName?.trim();
  if (!name) return;

  const {
    loadCompetencyStore,
    saveCompetencyStore,
    resolveCatalogExercise,
  } = await import('./ExerciseCompetencyService');
  const { createEmptyCompetencyRecord } = await import('../types/exerciseCompetency');

  const store = await loadCompetencyStore();
  const catalog = resolveCatalogExercise(name);
  const id = catalog?.id ?? name.toLowerCase().replace(/\s+/g, '-');
  const prior = store.records[id] ?? createEmptyCompetencyRecord(id, { exerciseName: name, now: args.now });

  let movementTolerance = prior.movementTolerance;
  let movementQuality = prior.movementQuality;
  let progressionReady = prior.progressionReady;
  const blocked = [...(prior.progressionBlockedReasons ?? [])];

  if (args.outcome === 'better') {
    if (movementTolerance === 'poor' || movementTolerance === 'limited' || movementTolerance === 'needs_assessment' || movementTolerance === 'unknown') {
      movementTolerance = 'tolerated';
    }
    if (movementQuality === 'poor' || movementQuality === 'needs_assessment' || movementQuality === 'unknown') {
      movementQuality = 'adequate';
    }
  } else if (args.outcome === 'same') {
    if (movementTolerance === 'unknown') movementTolerance = 'needs_assessment';
    if (movementQuality === 'unknown') movementQuality = 'needs_assessment';
  } else if (args.outcome === 'worse') {
    movementTolerance = movementTolerance === 'poor' ? 'poor' : 'limited';
    if (movementQuality === 'strong' || movementQuality === 'adequate') {
      movementQuality = 'needs_assessment';
    } else if (movementQuality === 'unknown') {
      movementQuality = 'poor';
    }
    progressionReady = false;
    if (!blocked.includes('feedback_worse')) blocked.push('feedback_worse');
  }

  store.records[id] = {
    ...prior,
    exerciseName: prior.exerciseName ?? name,
    movementTolerance,
    movementQuality,
    progressionReady,
    progressionBlockedReasons: progressionReady
      ? blocked.filter((b) => b !== 'feedback_worse' && b !== 'tolerance_limited' && b !== 'tolerance_poor')
      : blocked,
    updatedAt: args.now,
    evidence: {
      ...(prior.evidence ?? {}),
      lastFeedbackOutcome: args.outcome,
    },
  };
  await saveCompetencyStore(store);
}

async function adaptConstraintFromFeedback(args: {
  constraint: TrainingConstraint;
  outcome: PostWorkoutMovementOutcome;
  severity?: number;
  stageBefore: ProgressiveReturnStage;
  now: string;
}): Promise<{
  constraint: TrainingConstraint;
  stage: ProgressiveReturnStage;
  suggestProfessionalEvaluation: boolean;
  userMessage: string;
}> {
  const { constraint, outcome, severity, stageBefore, now } = args;

  let consecutiveBetter = constraint.consecutiveBetter ?? 0;
  let consecutiveSame = constraint.consecutiveSame ?? 0;
  let consecutiveWorse = constraint.consecutiveWorse ?? 0;

  if (outcome === 'better') {
    consecutiveBetter += 1;
    consecutiveSame = 0;
    consecutiveWorse = 0;
  } else if (outcome === 'worse') {
    consecutiveWorse += 1;
    consecutiveBetter = 0;
    consecutiveSame = 0;
  } else {
    consecutiveSame += 1;
    consecutiveBetter = 0;
    consecutiveWorse = 0;
  }

  let stage = stageBefore;
  let suggestProfessionalEvaluation = false;
  let userMessage = "Got it — I'll keep monitoring this movement.";

  if (outcome === 'better' && consecutiveBetter >= IMPROVE_STREAK_TO_ADVANCE) {
    stage = nextStage(stageBefore);
    consecutiveBetter = 0;
    userMessage =
      stage === 'cleared'
        ? "Nice — this movement is responding well. We'll treat it more normally and keep watching."
        : "It's responding well. We'll gradually allow a bit more demand on this movement.";
  } else if (outcome === 'worse') {
    stage = prevStage(stageBefore);
    if (stageRank(stage) <= stageRank('modified')) {
      stage = 'modified';
    }
    userMessage =
      "Thanks — we'll reduce demand on this movement and keep unrelated work on track.";
  } else if (outcome === 'same') {
    if (consecutiveSame >= SAME_STREAK_TO_ESCALATE_HINT) {
      suggestProfessionalEvaluation = true;
      userMessage =
        "This hasn't shifted much across sessions. We'll keep demand conservative — consider having it evaluated by a qualified healthcare professional if it continues.";
    } else if (consecutiveSame >= SAME_STREAK_TO_MONITOR) {
      userMessage =
        "Still about the same — we'll keep monitoring and hold progression for now.";
    } else {
      userMessage = "Got it — we'll keep the current modification and check in again next time.";
    }
  }

  const limits = limitsForStage(stage);
  const patch: Parameters<typeof upsertTrainingConstraint>[0] = {
    id: constraint.id,
    exercise: constraint.exercise,
    movementPattern: constraint.movementPattern,
    status: limits.status,
    intensityLimit: limits.intensity,
    volumeLimit: limits.volume,
    romLimit: limits.rom,
    preferredVariations: constraint.preferredVariations,
    avoidedVariations:
      stage === 'cleared' ? undefined : constraint.avoidedVariations,
    reason: constraint.reason,
    startDate: constraint.startDate,
    reassessmentDate:
      suggestProfessionalEvaluation
        ? now.slice(0, 10)
        : constraint.reassessmentDate,
    sourceIds: constraint.sourceIds,
    progressiveReturnStage: stage,
    consecutiveBetter,
    consecutiveSame,
    consecutiveWorse,
    lastOutcome: outcome,
    lastDiscomfortSeverity: severity ?? constraint.lastDiscomfortSeverity,
    modificationUsed: describeModification({
      ...constraint,
      intensityLimit: limits.intensity,
      volumeLimit: limits.volume,
      romLimit: limits.rom,
      progressiveReturnStage: stage,
    }),
    createdAt: constraint.createdAt,
  };

  if (stage === 'cleared') {
    const cleared = await upsertTrainingConstraint({
      ...patch,
      status: 'normal',
      intensityLimit: 1,
      volumeLimit: 1,
      romLimit: undefined,
      progressiveReturnStage: 'cleared',
    });
    await archiveTrainingConstraint(cleared.id);
    return {
      constraint: { ...cleared, archivedAt: now, progressiveReturnStage: 'cleared' },
      stage: 'cleared',
      suggestProfessionalEvaluation,
      userMessage,
    };
  }

  const saved = await upsertTrainingConstraint(patch);
  return {
    constraint: saved,
    stage,
    suggestProfessionalEvaluation,
    userMessage,
  };
}

/**
 * Update MovementProfile to reflect current training needs.
 * Soft focus areas can ease after sustained improvement; never invent quality scores.
 */
async function updateProfileFromFeedback(args: {
  outcome: PostWorkoutMovementOutcome;
  exerciseName?: string;
  stageAfter: ProgressiveReturnStage;
  suggestProfessionalEvaluation: boolean;
  now: string;
}): Promise<MovementProfile> {
  const profile = await loadMovementProfile();
  const { outcome, exerciseName, stageAfter, suggestProfessionalEvaluation, now } = args;

  const historySummary = exerciseName
    ? `Movement response ${outcome} on ${exerciseName} → ${stageAfter}`
    : `Movement response ${outcome} → ${stageAfter}`;

  const historyEntry: MovementProfile['history'][number] = {
    id: `mph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    event: 'movement_response_feedback',
    summary: historySummary,
    changedQualities: ['movementTolerance'],
  };
  profile.history = [historyEntry, ...profile.history].slice(0, 100);

  // Provenance only — do not invent numeric quality scores.
  upsertToleranceEntryOnProfile(profile, {
    exercise: exerciseName,
    dataSource: 'exercise_feedback',
    now,
    markNeedsAssessment: true,
  });

  if (outcome === 'better' && stageAfter === 'cleared' && exerciseName) {
    profile.exerciseLimitations = profile.exerciseLimitations.filter(
      (e) => e.toLowerCase() !== exerciseName.toLowerCase()
    );
    // Softly trim focus areas only when the movement has cleared — insufficient
    // data should not invent “progress” by wiping focuses after a single better day.
    profile.trainingModifications = profile.trainingModifications.filter(
      (m) => !m.toLowerCase().includes(exerciseName.toLowerCase())
    );
  }

  if (outcome === 'worse' && exerciseName) {
    const note = `Reduced demand on ${exerciseName} after session response`;
    if (!profile.trainingModifications.some((m) => m === note)) {
      profile.trainingModifications = [note, ...profile.trainingModifications].slice(0, 20);
    }
    if (
      !profile.exerciseLimitations.some((e) => e.toLowerCase() === exerciseName.toLowerCase())
    ) {
      profile.exerciseLimitations = [...profile.exerciseLimitations, exerciseName].slice(0, 30);
    }
  }

  if (suggestProfessionalEvaluation) {
    const date = now.slice(0, 10);
    if (!profile.reassessmentDates.includes(date)) {
      profile.reassessmentDates = [...profile.reassessmentDates, date].slice(-20);
    }
  }

  // When advancing into progressive loading with clear improvement streak context,
  // allow focus areas to taper only if we have multiple feedback events (evidence).
  if (outcome === 'better' && stageAfter === 'progressive_loading') {
    const recent = await loadPostWorkoutMovementFeedback();
    const forEx = exerciseName
      ? recent.filter((f) => f.exercise?.toLowerCase() === exerciseName.toLowerCase())
      : [];
    const betterCount = forEx.filter((f) => f.outcome === 'better').length;
    if (betterCount >= 3 && profile.currentFocusAreas.length > 2) {
      // Drop the oldest focus only — never wipe the list on thin evidence.
      profile.currentFocusAreas = profile.currentFocusAreas.slice(0, -1);
    }
  }

  return saveMovementProfile(profile);
}

/** Whether the finish flow should prompt for MI movement feedback. */
export async function shouldPromptMovementResponseFeedback(): Promise<boolean> {
  const candidates = await loadFeedbackCandidates();
  return candidates.length > 0;
}

/**
 * Movement Intelligence → AI context pack.
 *
 * Structured MI owns safety, constraints, and history.
 * AI may explain and coach from this pack — never invent diagnoses or
 * override safety / temporarilyAvoid constraints.
 */

import { getExerciseData } from '../data/exerciseDatabase';
import type {
  DiscomfortReport,
  MovementAdaptationPlan,
  MovementProfile,
  PostWorkoutMovementFeedback,
  TrainingConstraint,
} from '../types/movementIntelligence';
import { listUnresolvedMovementQualities } from '../types/movementIntelligence';
import { buildWhyExplanation } from '../utils/movementIntelligenceDashboard';
import {
  loadActiveTrainingConstraints,
  loadDiscomfortReports,
  loadLatestAdaptationPlan,
  loadMovementProfile,
  loadPostWorkoutMovementFeedback,
} from './MovementIntelligenceService';

/** Compact exercise metadata for constrained / focus movements only. */
export type MiAiExerciseMeta = {
  name: string;
  movementPattern?: string;
  miMovementPattern?: string;
  primaryMuscles?: string[];
  movementQualities?: string[];
  laterality?: string;
  regressions?: string[];
  progressions?: string[];
  preferredFromConstraint?: string[];
};

export type MovementIntelligenceAiContext = {
  /** Schema marker for the model. */
  source: 'tyl_movement_intelligence_v1';
  /**
   * Hard rule for the model: structured MI controls these; AI must not override.
   */
  authority: {
    structuredSystemOwns: string[];
    aiOwns: string[];
    aiMustNotOverrideSafety: true;
  };
  currentFocusAreas: string[];
  affectedAreas: string[];
  exerciseLimitations: string[];
  trainingModifications: string[];
  activeConstraints: Array<{
    exercise?: string;
    movementPattern?: string;
    status: string;
    intensityLimit?: number;
    volumeLimit?: number;
    romLimit?: string;
    preferredVariations?: string[];
    progressiveReturnStage?: string;
    modificationUsed?: string;
    lastOutcome?: string;
    consecutiveBetter?: number;
    consecutiveSame?: number;
    consecutiveWorse?: number;
  }>;
  /** Exercises the AI must not recommend at full demand. */
  exercisesToAvoidOrModify: string[];
  recentDiscomfortReports: Array<{
    exercise?: string;
    bodyArea: string;
    side: string;
    sensation: string;
    severity: number;
    trend?: string;
    frequency?: string;
    timestamp: string;
  }>;
  recentMovementFeedback: Array<{
    exercise?: string;
    outcome: string;
    discomfortSeverity?: number;
    previousDiscomfortSeverity?: string | number;
    modificationUsed?: string;
    progressiveReturnStage?: string;
    timestamp: string;
  }>;
  /** Deterministic why text — AI should paraphrase, not invent a different cause. */
  structuredWhyExplanation: string | null;
  coachingTalkingPoints: string[];
  exerciseMetadata: MiAiExerciseMeta[];
  /** Granular qualities that are still unknown / need assessment — AI must not invent scores. */
  unresolvedMovementQualities?: Array<{ domain: string; key: string; status: string }>;
  /** Exercise/pattern tolerance rows (provenance only when unscored). */
  movementToleranceEntries?: Array<{
    exercise?: string;
    movementPattern?: string;
    status: string;
    score?: number;
    dataSource?: string;
  }>;
  reassessmentRequired: boolean;
  latestAdaptationSummary?: {
    safetyStatus?: string;
    safetyLevel?: string;
    userFacingSummary?: string;
    mobilityPriorities?: string[];
    stabilityPriorities?: string[];
    strengthPriorities?: string[];
    preferredVariations?: string[];
  } | null;
};

const MI_AUTHORITY = {
  structuredSystemOwns: [
    'safety_thresholds',
    'discomfort_storage',
    'training_constraints',
    'exercise_limitations',
    'movement_history',
    'reassessment_flags',
    'progressive_return_stage',
  ],
  aiOwns: [
    'explain_why_workout_changed',
    'communicate_current_training_focus',
    'personalize_exercise_instructions',
    'explain_progress',
    'ask_follow_up_questions',
    'conversational_coaching_tone',
  ],
  aiMustNotOverrideSafety: true as const,
};

function humanize(raw: string): string {
  const spaced = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

function metaForName(name: string, preferred?: string[]): MiAiExerciseMeta | null {
  const data = getExerciseData(name) || (preferred?.[0] ? getExerciseData(preferred[0]) : undefined);
  if (!data && !name) return null;
  return {
    name: data?.name ?? name,
    movementPattern: data?.movementPattern,
    miMovementPattern: data?.miMovementPattern,
    primaryMuscles: data?.primaryMuscles ?? (data ? [data.primaryMuscleGroup] : undefined),
    movementQualities: data?.movementQualities?.slice(0, 8),
    laterality: data?.laterality,
    regressions: data?.regressions?.slice(0, 4),
    progressions: data?.progressions?.slice(0, 4),
    preferredFromConstraint: preferred?.slice(0, 4),
  };
}

export function buildMovementIntelligenceAiContextFromData(input: {
  profile: MovementProfile;
  constraints: TrainingConstraint[];
  reports: DiscomfortReport[];
  feedback: PostWorkoutMovementFeedback[];
  plan: MovementAdaptationPlan | null;
}): MovementIntelligenceAiContext {
  const active = input.constraints.filter((c) => !c.archivedAt && c.status !== 'normal');
  const avoidOrModify = [
    ...active
      .filter((c) => c.status === 'temporarilyAvoid' || c.status === 'modify' || c.status === 'monitor')
      .map((c) => c.exercise)
      .filter((n): n is string => Boolean(n?.trim())),
    ...(input.plan?.movementConstraints.exercisesToAvoid ?? []),
    ...input.profile.exerciseLimitations,
  ];

  const why =
    buildWhyExplanation(input.plan, input.reports, input.constraints) ||
    input.plan?.userFacingSummary ||
    null;

  const talkingPoints: string[] = [];
  if (input.profile.currentFocusAreas.length) {
    talkingPoints.push(
      `Current training focus: ${input.profile.currentFocusAreas
        .slice(0, 4)
        .map(humanize)
        .join(', ')}.`
    );
  }
  if (input.plan?.movementConstraints.stabilityPriorities?.length) {
    talkingPoints.push(
      `Stability / control priorities from structured MI: ${input.plan.movementConstraints.stabilityPriorities
        .slice(0, 3)
        .map(humanize)
        .join(', ')}. Frame as useful areas to build — never as the medical cause of discomfort.`
    );
  }
  for (const c of active.slice(0, 3)) {
    if (!c.exercise) continue;
    const stage = c.progressiveReturnStage?.replace(/_/g, ' ') ?? c.status;
    const pref = c.preferredVariations?.[0];
    talkingPoints.push(
      pref
        ? `${c.exercise} is under structured modification (${stage}); prefer ${pref} / reduced demand until feedback supports progress.`
        : `${c.exercise} is under structured modification (${stage}); keep demand reduced until feedback supports progress.`
    );
  }
  if (input.plan?.movementConstraints.reassessmentRequired) {
    talkingPoints.push(
      'Structured MI flagged reassessment — if symptoms are unchanged across sessions, gently suggest evaluation by a qualified healthcare professional without diagnosing.'
    );
  }

  const exerciseNames = new Set<string>();
  for (const c of active) {
    if (c.exercise) exerciseNames.add(c.exercise);
    for (const v of c.preferredVariations ?? []) exerciseNames.add(v);
  }
  for (const r of input.reports.slice(0, 5)) {
    if (r.exercise) exerciseNames.add(r.exercise);
  }

  const exerciseMetadata: MiAiExerciseMeta[] = [];
  for (const name of exerciseNames) {
    const c = active.find((x) => x.exercise === name);
    const meta = metaForName(name, c?.preferredVariations);
    if (meta) exerciseMetadata.push(meta);
  }

  return {
    source: 'tyl_movement_intelligence_v1',
    authority: MI_AUTHORITY,
    currentFocusAreas: input.profile.currentFocusAreas.slice(0, 8).map(humanize),
    affectedAreas: input.profile.affectedAreas.slice(0, 8),
    exerciseLimitations: input.profile.exerciseLimitations.slice(0, 12),
    trainingModifications: input.profile.trainingModifications.slice(0, 8),
    activeConstraints: active.slice(0, 8).map((c) => ({
      exercise: c.exercise,
      movementPattern: c.movementPattern,
      status: c.status,
      intensityLimit: c.intensityLimit,
      volumeLimit: c.volumeLimit,
      romLimit: c.romLimit,
      preferredVariations: c.preferredVariations?.slice(0, 4),
      progressiveReturnStage: c.progressiveReturnStage,
      modificationUsed: c.modificationUsed,
      lastOutcome: c.lastOutcome,
      consecutiveBetter: c.consecutiveBetter,
      consecutiveSame: c.consecutiveSame,
      consecutiveWorse: c.consecutiveWorse,
    })),
    exercisesToAvoidOrModify: [...new Set(avoidOrModify.map((n) => n.trim()).filter(Boolean))].slice(
      0,
      16
    ),
    recentDiscomfortReports: input.reports.slice(0, 5).map((r) => ({
      exercise: r.exercise,
      bodyArea: r.bodyArea,
      side: r.side,
      sensation: r.sensation,
      severity: r.severity,
      trend: r.trend,
      frequency: r.frequency,
      timestamp: r.timestamp,
    })),
    recentMovementFeedback: input.feedback.slice(0, 8).map((f) => ({
      exercise: f.exercise,
      outcome: f.outcome,
      discomfortSeverity: f.discomfortSeverity,
      previousDiscomfortSeverity: f.previousDiscomfortSeverity,
      modificationUsed: f.modificationUsed,
      progressiveReturnStage: f.progressiveReturnStage,
      timestamp: f.timestamp,
    })),
    structuredWhyExplanation: why,
    coachingTalkingPoints: talkingPoints.slice(0, 8),
    exerciseMetadata: exerciseMetadata.slice(0, 10),
    unresolvedMovementQualities: listUnresolvedMovementQualities(input.profile)
      .slice(0, 24)
      .map((q) => ({ domain: q.domain, key: q.key, status: q.status })),
    movementToleranceEntries: (input.profile.movementTolerance?.entries ?? [])
      .slice(0, 12)
      .map((e) => ({
        exercise: e.exercise,
        movementPattern: e.movementPattern,
        status: e.status,
        score: e.score,
        dataSource: e.dataSource,
      })),
    reassessmentRequired: Boolean(input.plan?.movementConstraints.reassessmentRequired),
    latestAdaptationSummary: input.plan
      ? {
          safetyStatus: input.plan.safety.status,
          safetyLevel: input.plan.safety.safetyLevel,
          userFacingSummary: input.plan.userFacingSummary,
          mobilityPriorities: input.plan.movementConstraints.mobilityPriorities?.slice(0, 4),
          stabilityPriorities: input.plan.movementConstraints.stabilityPriorities?.slice(0, 4),
          strengthPriorities: input.plan.movementConstraints.strengthPriorities?.slice(0, 4),
          preferredVariations: input.plan.movementConstraints.preferredVariations?.slice(0, 4),
        }
      : null,
  };
}

/** Load live MI state for AI context. */
export async function buildMovementIntelligenceAiContext(): Promise<MovementIntelligenceAiContext> {
  const [profile, constraints, reports, feedback, plan] = await Promise.all([
    loadMovementProfile(),
    loadActiveTrainingConstraints(),
    loadDiscomfortReports(),
    loadPostWorkoutMovementFeedback(),
    loadLatestAdaptationPlan(),
  ]);
  return buildMovementIntelligenceAiContextFromData({
    profile,
    constraints,
    reports,
    feedback,
    plan,
  });
}

/**
 * Language rules appended to the coach system instruction.
 * Deterministic — not model-invented.
 */
export const MOVEMENT_INTELLIGENCE_AI_RULES = `
Movement Intelligence (health_context.coachingContext.movementIntelligence or health_context.movementIntelligence):
- A structured Movement Intelligence engine already decided safety, constraints, limitations, and reassessment needs. You explain and coach from that data — you do NOT re-diagnose or invent new clinical causes.
- Never say a symptom is "caused by" weak muscles, imbalances, or a named injury. Never say "you have an injury."
- Prefer: "Your responses suggest that hip stability may be a useful area to build." / "This movement may not be tolerating the current demand well."
- When explaining a workout change, paraphrase structuredWhyExplanation and coachingTalkingPoints. Example tone: "Your knee hasn't been loving your normal squat lately, so I've temporarily switched you to a controlled goblet squat and added some hip and single-leg stability work. We'll use your feedback to decide when you're ready to progress back."
- Respect exercisesToAvoidOrModify and activeConstraints: do not tell the user to return to full load, deep ROM, or avoided variations while status is modify / monitor / temporarilyAvoid unless structured progressiveReturnStage is progressive_loading or cleared.
- You must not override safety thresholds, temporarilyAvoid flags, or reassessmentRequired. If the user asks to ignore discomfort, stay supportive but keep the structured limits and suggest professional evaluation when reassessmentRequired is true.
- Personalize cues using exerciseMetadata (pattern, qualities, regressions) without prescribing a brand-new program that conflicts with constraints.
- Ask short follow-ups when useful ("How did that goblet squat feel today compared to last time?") — the app also collects structured better/same/worse feedback.
- Stay fitness-focused and non-diagnostic. If something sounds medical/emergency, direct them to a qualified healthcare professional.
`.trim();

/**
 * Soft post-check: detect if coach text recommends ignored avoided exercises at full demand.
 * Returns warnings for logging / optional UI.
 */
export function findAiConstraintConflicts(
  coachText: string,
  ctx: MovementIntelligenceAiContext
): string[] {
  const lower = coachText.toLowerCase();
  const warnings: string[] = [];
  for (const name of ctx.exercisesToAvoidOrModify) {
    const n = name.toLowerCase();
    if (!n || !lower.includes(n)) continue;
    const avoid = ctx.activeConstraints.find(
      (c) =>
        c.exercise?.toLowerCase() === n &&
        (c.status === 'temporarilyAvoid' || c.status === 'modify')
    );
    if (
      avoid &&
      /(full\s+(load|weight|depth)|go\s+heavy|max\s+out|push\s+through\s+the\s+pain|ignore\s+(the\s+)?(pain|discomfort))/i.test(
        coachText
      )
    ) {
      warnings.push(
        `Response may conflict with structured constraint on ${name} (${avoid.status}).`
      );
    }
    if (avoid?.status === 'temporarilyAvoid') {
      if (
        new RegExp(
          `(do|try|perform|add|program|prescribe)\\s+(.{0,40})?${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
          'i'
        ).test(coachText) ||
        new RegExp(
          `${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(today|this session|as your main|heavy)`,
          'i'
        ).test(coachText)
      ) {
        warnings.push(
          `Response may prescribe temporarilyAvoid exercise ${name}.`
        );
      }
    }
  }
  if (
    ctx.reassessmentRequired &&
    /(nothing\s+wrong|ignore\s+it|push\s+through)/i.test(coachText)
  ) {
    warnings.push('Response may downplay a structured reassessment flag.');
  }
  return warnings;
}

/**
 * Hard safety post-process: AI cannot override structured Movement Intelligence constraints.
 * Appends an authoritative safety note when conflicts are detected; never silently invents new exercises.
 */
export function enforceAiSafetyConstraints(
  coachText: string,
  ctx: MovementIntelligenceAiContext
): { text: string; conflicts: string[]; blocked: boolean } {
  const conflicts = findAiConstraintConflicts(coachText, ctx);
  const hardAvoids = ctx.activeConstraints
    .filter((c) => c.status === 'temporarilyAvoid' && c.exercise)
    .map((c) => c.exercise!);

  let text = coachText.trim();
  const hardConflicts = conflicts.filter((c) => /temporarilyAvoid|prescribe temporarilyAvoid/i.test(c));

  if (hardConflicts.length && hardAvoids.length) {
    const list = hardAvoids.slice(0, 4).join(', ');
    text += `\n\n—\nSafety (Movement Intelligence): Structured constraints remain in effect. Do not perform or push ${list} at full demand. Use the app’s modified variations, reduced intensity/volume, and pain-free ROM until reassessment clears the constraint. I cannot override these safety rules.`;
  } else if (conflicts.length) {
    text += `\n\n—\nSafety (Movement Intelligence): Active modify/monitor constraints still apply — keep reduced demand and preferred variations. Structured safety rules take priority over any coaching suggestion.`;
  }

  return {
    text,
    conflicts,
    blocked: hardConflicts.length > 0,
  };
}

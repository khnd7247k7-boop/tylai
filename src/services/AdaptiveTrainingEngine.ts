/**
 * TYL Movement Intelligence — Adaptive Training Engine (v1)
 *
 * Sits between user discomfort feedback and the existing workout generator:
 *
 *   User Input → Movement Intelligence → Training Constraints → Workout Generator
 *
 * Does NOT rebuild or call the workout generator.
 * Produces structured MovementAdaptationPlan / movementConstraints the generator
 * can consume later.
 *
 * Important:
 * - No diagnoses, no injury labels, no assumed causes.
 * - Identify training priorities from reported context + exercise metadata.
 * - Modify the smallest necessary portion of training; keep unrelated work.
 */

import {
  exerciseDatabase,
  getExerciseData,
  type ExerciseData,
  type MovementPattern as CatalogMovementPattern,
} from '../data/exerciseDatabase';
import {
  findSubstitutesByQuality,
  type ExerciseMovementQuality,
  type JointKey,
} from '../data/exerciseMovementIntelligence';
import type {
  BodyArea,
  DiscomfortReport,
  ExerciseModificationDirective,
  MovementAdaptationPlan,
  MovementConstraints,
  MovementPattern,
  MovementProfile,
  MovementSafetyAssessmentResult,
  TrainingConstraint,
  TrainingConstraintStatus,
} from '../types/movementIntelligence';
import { createEmptyMovementConstraints } from '../types/movementIntelligence';
import { evaluateDiscomfortSafety } from '../utils/movementSafetyEvaluation';

// ---------------------------------------------------------------------------
// Body-area → supportive training focuses (NOT causal diagnosis maps)
// ---------------------------------------------------------------------------

type AreaSupportFocus = {
  joints: JointKey[];
  stability: ExerciseMovementQuality[];
  mobility: ExerciseMovementQuality[];
  strength: ExerciseMovementQuality[];
  control: ExerciseMovementQuality[];
};

/**
 * Supportive qualities that are often appropriate to develop alongside
 * discomfort in a region. These are training focuses, not causes.
 */
const AREA_SUPPORT: Partial<Record<BodyArea, AreaSupportFocus>> = {
  knee: {
    joints: ['knee', 'hip', 'ankle'],
    stability: ['hipStability', 'singleLegControl', 'ankleStability'],
    mobility: ['ankleMobility', 'hipMobility'],
    strength: ['hipStrength'],
    control: ['kneeControl'],
  },
  hip: {
    joints: ['hip', 'lumbar'],
    stability: ['hipStability', 'coreStability', 'singleLegControl'],
    mobility: ['hipMobility', 'thoracicMobility'],
    strength: ['hipStrength', 'posteriorChainStrength'],
    control: ['singleLegControl', 'trunkStability'],
  },
  ankle: {
    joints: ['ankle', 'knee'],
    stability: ['ankleStability', 'singleLegControl'],
    mobility: ['ankleMobility'],
    strength: ['calfStrength'],
    control: ['singleLegControl', 'balance'],
  },
  foot: {
    joints: ['ankle'],
    stability: ['ankleStability', 'balance'],
    mobility: ['ankleMobility'],
    strength: ['calfStrength'],
    control: ['singleLegControl'],
  },
  lower_back: {
    joints: ['lumbar', 'hip', 'thoracic'],
    stability: ['coreStability', 'trunkStability', 'hipStability', 'antiExtension'],
    mobility: ['hipMobility', 'thoracicMobility'],
    strength: ['posteriorChainStrength', 'hipStrength'],
    control: ['trunkStability', 'antiRotation'],
  },
  upper_back: {
    joints: ['thoracic', 'scapula', 'shoulder'],
    stability: ['scapularControl', 'shoulderStability', 'coreStability'],
    mobility: ['thoracicMobility', 'thoracicExtension'],
    strength: ['horizontalPull', 'scapularControl'],
    control: ['scapularControl'],
  },
  shoulder: {
    joints: ['shoulder', 'scapula'],
    stability: ['shoulderStability', 'scapularControl', 'rotatorCuffStrength'],
    mobility: ['thoracicMobility'],
    strength: ['rotatorCuffStrength', 'scapularControl'],
    control: ['scapularControl', 'shoulderStability'],
  },
  neck: {
    joints: ['cervical', 'thoracic', 'scapula'],
    stability: ['scapularControl', 'coreStability'],
    mobility: ['thoracicMobility'],
    strength: ['scapularControl'],
    control: ['scapularControl'],
  },
  elbow: {
    joints: ['elbow', 'shoulder', 'wrist'],
    stability: ['shoulderStability', 'gripStrength'],
    mobility: [],
    strength: ['gripStrength'],
    control: ['scapularControl'],
  },
  wrist: {
    joints: ['wrist', 'elbow'],
    stability: ['gripStrength'],
    mobility: [],
    strength: ['gripStrength'],
    control: [],
  },
  core: {
    joints: ['lumbar', 'thoracic'],
    stability: ['coreStability', 'antiExtension', 'antiRotation', 'trunkStability'],
    mobility: ['thoracicMobility', 'hipMobility'],
    strength: ['coreStability'],
    control: ['trunkStability'],
  },
};

/** Patterns that commonly load a body area — used for scoped modification only. */
const AREA_RELATED_PATTERNS: Partial<Record<BodyArea, CatalogMovementPattern[]>> = {
  knee: ['squat', 'lunge', 'gait'],
  hip: ['squat', 'hinge', 'lunge', 'gait'],
  ankle: ['squat', 'lunge', 'gait'],
  foot: ['squat', 'lunge', 'gait'],
  lower_back: ['hinge', 'squat', 'carry', 'rotation'],
  upper_back: ['pull', 'push', 'rotation'],
  shoulder: ['push', 'pull', 'carry'],
  neck: ['push', 'pull'],
  elbow: ['push', 'pull'],
  wrist: ['push', 'pull', 'carry'],
  core: ['isometric', 'rotation', 'carry', 'squat', 'hinge'],
};

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function catalogPatternToMi(pattern: CatalogMovementPattern): MovementPattern {
  if (pattern === 'rotation') return 'rotate';
  if (pattern === 'stretch' || pattern === 'isometric' || pattern === 'cardio') return 'other';
  return pattern as MovementPattern;
}

function daysFromNow(days: number, nowIso: string): string {
  const d = new Date(nowIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function humanArea(area: BodyArea, other?: string): string {
  if (area === 'other' && other?.trim()) return other.trim();
  return area.replace(/_/g, ' ');
}

function resolveReportedExercise(report: DiscomfortReport): ExerciseData | undefined {
  if (!report.exercise?.trim()) return undefined;
  return getExerciseData(report.exercise.trim());
}

function pickReplacement(
  source: ExerciseData | undefined,
  affectedJoints: JointKey[],
  preferAvoidHighJointLoad: boolean
): { name?: string; variations: string[] } {
  if (!source) return { variations: [] };

  const regressions = (source.regressions ?? [])
    .map((n) => getExerciseData(n))
    .filter((e): e is ExerciseData => Boolean(e));

  const alts = (source.alternatives ?? [])
    .map((n) => getExerciseData(n))
    .filter((e): e is ExerciseData => Boolean(e));

  const qualitySubs = findSubstitutesByQuality(source, exerciseDatabase, {
    preferEasier: true,
    limit: 8,
  });

  const candidates = uniq([...regressions, ...alts, ...qualitySubs].map((e) => e.id))
    .map((id) => exerciseDatabase.find((e) => e.id === id))
    .filter((e): e is ExerciseData => e != null && e.id !== source.id);

  const scored = candidates.map((e) => {
    let score = 0;
    if ((source.regressions ?? []).includes(e.name)) score += 8;
    if ((source.alternatives ?? []).includes(e.name)) score += 4;
    if ((source.variations ?? []).includes(e.name)) score += 3;
    if (e.difficulty === 'beginner') score += 2;
    if (e.movementPattern === source.movementPattern) score += 2;
    // Prefer simpler loading tools when reducing demand (still not a diagnosis).
    const equip = (e.equipmentRequired ?? []).join(' ');
    if (/bodyweight|goblet|dumbbell/.test(e.name.toLowerCase()) || equip.includes('bodyweight')) {
      score += 2;
    }
    if (/smith|machine|leg press/.test(e.name.toLowerCase())) score -= 1;
    if (preferAvoidHighJointLoad) {
      for (const joint of affectedJoints) {
        const demand = e.jointDemands?.find((j) => j.joint === joint)?.demand;
        if (demand === 'high') score -= 3;
        if (demand === 'moderate') score -= 1;
        if (demand === 'low') score += 1;
      }
    }
    return { e, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.e;
  const variations = uniq([
    ...(source.regressions ?? []),
    ...(source.variations ?? []),
    ...scored.slice(0, 4).map((s) => s.e.name),
  ]).filter((n) => n.toLowerCase() !== source.name.toLowerCase());

  return { name: best?.name, variations };
}

function limitsForSafety(safety: MovementSafetyAssessmentResult): {
  intensity?: number;
  volume?: number;
  rom?: string;
  status: TrainingConstraintStatus;
} {
  switch (safety.status) {
    case 'continue':
      return { status: 'normal' };
    case 'modify':
      return {
        intensity: 0.85,
        volume: 0.9,
        rom: 'pain_free_rom',
        status: 'modify',
      };
    case 'monitor':
      return {
        intensity: 0.7,
        volume: 0.75,
        rom: 'shortened_or_pain_free_rom',
        status: 'monitor',
      };
    case 'professional_evaluation':
      return {
        intensity: 0.5,
        volume: 0.5,
        rom: 'avoid_provoking_rom',
        status: 'temporarilyAvoid',
      };
    default:
      return { status: 'monitor' };
  }
}

export type BuildAdaptiveTrainingPlanInput = {
  report: DiscomfortReport;
  safety?: MovementSafetyAssessmentResult;
  profile?: MovementProfile | null;
  /** Optional free-text primary goal label — preserved as priority, not used to diagnose. */
  primaryGoalLabel?: string | null;
  catalog?: ExerciseData[];
  now?: string;
};

/**
 * Core engine entry: discomfort report (+ safety) → MovementAdaptationPlan.
 */
export function buildAdaptiveTrainingPlan(
  input: BuildAdaptiveTrainingPlanInput
): MovementAdaptationPlan {
  const now = input.now ?? new Date().toISOString();
  const report = input.report;
  const safety =
    input.safety ??
    evaluateDiscomfortSafety({
      report,
      now,
    });

  const constraints = createEmptyMovementConstraints();
  constraints.preserveUnrelatedExercises = true;

  const support = AREA_SUPPORT[report.bodyArea];
  const relatedPatterns = AREA_RELATED_PATTERNS[report.bodyArea] ?? [];
  const reportedEx = resolveReportedExercise(report);
  const limits = limitsForSafety(safety);
  const areaLabel = humanArea(report.bodyArea, report.bodyAreaOther);

  const trainingPriorities: string[] = [];
  const proposedConstraints: MovementAdaptationPlan['proposedConstraints'] = [];

  // --- Qualities / priorities (supportive, not causal) ---
  if (support) {
    constraints.stabilityPriorities = [...support.stability];
    constraints.mobilityPriorities = [...support.mobility];
    constraints.strengthPriorities = [...support.strength];
    constraints.movementQualitiesToBuild = uniq([
      ...support.control,
      ...support.stability,
      ...support.strength.slice(0, 2),
    ]);
  }

  if (reportedEx?.movementPattern) {
    const patternNote = reportedEx.movementPattern;
    trainingPriorities.push(
      `User reports ${areaLabel} discomfort during ${reportedEx.name} (${patternNote} pattern) — adjust that movement first and keep unrelated work when appropriate.`
    );
  } else if (report.exercise) {
    trainingPriorities.push(
      `User reports ${areaLabel} discomfort related to ${report.exercise} — reduce demand on that movement and monitor response.`
    );
  } else {
    trainingPriorities.push(
      `User reports ${areaLabel} discomfort — reduce demand on closely related patterns and keep unrelated exercises.`
    );
  }

  if (support?.stability.length) {
    trainingPriorities.push(
      `Current movement context suggests ${support.stability.slice(0, 2).join(' and ')} ${
        support.stability.length > 1 ? 'are' : 'is'
      } an appropriate stability / control focus based on the reported movement — not a medical conclusion about cause.`
    );
  }
  if (support?.mobility.length) {
    trainingPriorities.push(
      `Mobility emphasis may be appropriate: ${support.mobility.join(', ')}.`
    );
  }
  if (input.primaryGoalLabel) {
    trainingPriorities.push(
      `Primary goal (${input.primaryGoalLabel}) remains the programming priority; adaptations should be the smallest change that protects the reported movement.`
    );
  }

  // --- Exercise-scoped actions ---
  const affectedJoints = support?.joints ?? [];
  const { name: replacement, variations } = pickReplacement(
    reportedEx,
    affectedJoints,
    safety.status !== 'continue'
  );
  constraints.preferredVariations = variations.slice(0, 6);

  if (report.exercise?.trim()) {
    const exerciseName = report.exercise.trim();

    if (safety.status === 'professional_evaluation' || limits.status === 'temporarilyAvoid') {
      constraints.exercisesToAvoid.push(exerciseName);
      constraints.exercisesToModify.push({
        exerciseName,
        exerciseId: reportedEx?.id,
        action: 'temporarily_avoid',
        intensityLimit: limits.intensity,
        volumeLimit: limits.volume,
        romLimit: limits.rom,
        preferredReplacement: replacement,
        preferredVariations: variations.slice(0, 4),
        reason:
          'Responses suggest pausing automatic progression on this movement and seeking professional evaluation if symptoms persist — unrelated work can continue.',
      });
      constraints.reassessmentRequired = true;
      constraints.reassessmentDate = daysFromNow(7, now);
    } else if (safety.status === 'continue') {
      constraints.exercisesToMonitor.push(exerciseName);
      constraints.exercisesToModify.push({
        exerciseName,
        exerciseId: reportedEx?.id,
        action: 'monitor',
        reason: 'Low-severity signal — continue with awareness and reassess if it changes.',
      });
    } else {
      // modify / monitor: smallest change — reduce demand, prefer regression/variation
      const mods: ExerciseModificationDirective[] = [];

      mods.push({
        exerciseName,
        exerciseId: reportedEx?.id,
        action: 'reduce_intensity',
        intensityLimit: limits.intensity,
        reason: 'Reduce loading on the reported movement while keeping the pattern available.',
      });
      mods.push({
        exerciseName,
        exerciseId: reportedEx?.id,
        action: 'reduce_volume',
        volumeLimit: limits.volume,
        reason: 'Trim volume on the reported movement; leave unrelated exercises unchanged.',
      });

      if (limits.rom) {
        mods.push({
          exerciseName,
          exerciseId: reportedEx?.id,
          action: 'reduce_rom',
          romLimit: limits.rom,
          reason: 'Prefer a comfortable range rather than forcing end-range under fatigue.',
        });
      }

      if (replacement) {
        const isRegression = (reportedEx?.regressions ?? []).some(
          (n) => n.toLowerCase() === replacement.toLowerCase()
        );
        mods.push({
          exerciseName,
          exerciseId: reportedEx?.id,
          action: isRegression ? 'regress' : 'substitute',
          preferredReplacement: replacement,
          preferredVariations: variations.slice(0, 4),
          intensityLimit: limits.intensity,
          volumeLimit: limits.volume,
          romLimit: limits.rom,
          reason: isRegression
            ? `Prefer an easier related variation (${replacement}) that keeps training progressing toward the user’s goal.`
            : `Prefer a closely related variation (${replacement}) with a more manageable demand profile.`,
        });
      }

      constraints.exercisesToModify.push(...mods);
      if (safety.status === 'monitor') {
        constraints.exercisesToMonitor.push(exerciseName);
      }
    }

    proposedConstraints.push({
      exercise: exerciseName,
      movementPattern: reportedEx
        ? catalogPatternToMi(reportedEx.movementPattern)
        : report.movementPattern,
      status: limits.status === 'normal' ? 'monitor' : limits.status,
      intensityLimit: limits.intensity,
      volumeLimit: limits.volume,
      romLimit: limits.rom,
      preferredVariations: uniq([
        ...(replacement ? [replacement] : []),
        ...variations.slice(0, 4),
      ]),
      avoidedVariations:
        limits.status === 'temporarilyAvoid' ? [exerciseName] : undefined,
      reason: trainingPriorities[0] ?? `Adaptation for ${exerciseName}`,
      startDate: now.slice(0, 10),
      reassessmentDate: constraints.reassessmentDate ?? daysFromNow(14, now),
      sourceIds: [report.id],
      progressiveReturnStage:
        limits.status === 'temporarilyAvoid' || limits.status === 'modify'
          ? 'modified'
          : limits.status === 'monitor'
            ? 'regression'
            : 'normal_variation',
      lastDiscomfortSeverity: report.severity,
      modificationUsed: [
        replacement || exerciseName,
        typeof limits.intensity === 'number'
          ? `${Math.round(limits.intensity * 100)}% load`
          : null,
        limits.rom ? limits.rom.replace(/_/g, ' ') : null,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }

  // --- Pattern-level scope (not whole lower-body wipe) ---
  const patternFromReport: CatalogMovementPattern | undefined =
    reportedEx?.movementPattern ??
    (report.movementPattern === 'rotate'
      ? 'rotation'
      : report.movementPattern &&
          ['squat', 'hinge', 'lunge', 'push', 'pull', 'carry', 'gait'].includes(
            report.movementPattern
          )
        ? (report.movementPattern as CatalogMovementPattern)
        : undefined);

  const patternsToTouch = uniq(
    [patternFromReport, ...relatedPatterns.filter((p) => p === patternFromReport)].filter(
      (p): p is CatalogMovementPattern => Boolean(p)
    )
  );

  // Only mark the reported pattern (and same pattern), not every related pattern —
  // related patterns stay available unless the reported exercise was pattern-less.
  if (patternFromReport) {
    if (limits.status === 'temporarilyAvoid') {
      constraints.patternsToModify.push(catalogPatternToMi(patternFromReport));
      constraints.exercisesToModify.push({
        exerciseName: patternFromReport,
        action: 'temporarily_avoid',
        reason: `Temporarily avoid high-demand ${patternFromReport} variations of the reported movement; other patterns can continue.`,
      });
    } else if (safety.status !== 'continue') {
      constraints.patternsToModify.push(catalogPatternToMi(patternFromReport));
      constraints.patternsToMonitor.push(catalogPatternToMi(patternFromReport));
    } else {
      constraints.patternsToMonitor.push(catalogPatternToMi(patternFromReport));
    }
  } else if (relatedPatterns.length && safety.status !== 'continue') {
    // No specific exercise — lightly monitor the most related patterns only (first 2)
    for (const p of relatedPatterns.slice(0, 2)) {
      constraints.patternsToMonitor.push(catalogPatternToMi(p));
    }
  }

  // Silence unused in minimal scope — patternsToTouch reserved for future generator hooks
  void patternsToTouch;

  // --- Supportive add-ons (suggestions for generator; not mandatory deletes) ---
  if (safety.status !== 'continue' && support) {
    if (support.stability.length) {
      constraints.exercisesToModify.push({
        exerciseName: '__add_stability__',
        action: 'add_stability',
        preferredVariations: suggestAccessoryNames(support.stability, 'stability'),
        reason: `Consider adding low-skill stability / control work aligned with ${support.stability
          .slice(0, 2)
          .join(', ')}.`,
      });
    }
    if (support.mobility.length && (safety.status === 'modify' || safety.status === 'monitor')) {
      constraints.exercisesToModify.push({
        exerciseName: '__add_mobility__',
        action: 'add_mobility',
        preferredVariations: suggestAccessoryNames(support.mobility, 'mobility'),
        reason: `Consider brief mobility work for ${support.mobility.join(', ')} if it feels comfortable.`,
      });
    }
    if (support.strength.length && safety.status === 'modify') {
      constraints.exercisesToModify.push({
        exerciseName: '__add_strength__',
        action: 'add_strength',
        preferredVariations: suggestAccessoryNames(support.strength, 'strength'),
        reason: `Supportive strengthening focus may include ${support.strength
          .slice(0, 2)
          .join(', ')} — keep loads conservative.`,
      });
    }
  }

  if (safety.status === 'monitor' || safety.status === 'professional_evaluation') {
    constraints.reassessmentRequired = true;
    constraints.reassessmentDate =
      constraints.reassessmentDate ??
      daysFromNow(safety.status === 'professional_evaluation' ? 7 : 14, now);
  }

  // Deduplicate list fields
  constraints.exercisesToMonitor = uniq(constraints.exercisesToMonitor);
  constraints.exercisesToAvoid = uniq(constraints.exercisesToAvoid);
  constraints.preferredVariations = uniq(constraints.preferredVariations);
  constraints.patternsToModify = uniq(constraints.patternsToModify);
  constraints.patternsToMonitor = uniq(constraints.patternsToMonitor);
  constraints.movementQualitiesToBuild = uniq(constraints.movementQualitiesToBuild);
  constraints.mobilityPriorities = uniq(constraints.mobilityPriorities);
  constraints.stabilityPriorities = uniq(constraints.stabilityPriorities);
  constraints.strengthPriorities = uniq(constraints.strengthPriorities);

  // Pattern-level constraint row when we have a clear pattern
  if (patternFromReport && limits.status !== 'normal') {
    proposedConstraints.push({
      movementPattern: catalogPatternToMi(patternFromReport),
      status: limits.status,
      intensityLimit: limits.intensity,
      volumeLimit: limits.volume,
      romLimit: limits.rom,
      preferredVariations: constraints.preferredVariations.slice(0, 4),
      reason: `Scoped ${patternFromReport} pattern adaptation from user-reported ${areaLabel} discomfort.`,
      startDate: now.slice(0, 10),
      reassessmentDate: constraints.reassessmentDate,
      sourceIds: [report.id],
    });
  }

  const userFacingSummary = buildUserFacingSummary({
    safety,
    areaLabel,
    exerciseName: report.exercise,
    replacement,
    constraints,
  });

  return {
    version: 1,
    generatedAt: now,
    sourceReportIds: [report.id],
    safety,
    movementConstraints: constraints,
    trainingPriorities,
    userFacingSummary,
    proposedConstraints,
  };
}

function suggestAccessoryNames(
  qualities: ExerciseMovementQuality[],
  kind: 'stability' | 'mobility' | 'strength'
): string[] {
  const pool = exerciseDatabase.filter((e) => {
    const q = new Set(e.movementQualities ?? []);
    const hits = qualities.filter((x) => q.has(x)).length;
    if (hits === 0) return false;
    if (kind === 'mobility') {
      return e.category === 'flexibility' || e.movementPattern === 'stretch' || e.mobilityDemand !== 'low';
    }
    if (kind === 'stability') {
      return (
        e.category === 'balance' ||
        e.category === 'stability' ||
        e.movementPattern === 'isometric' ||
        e.stabilityDemand === 'moderate' ||
        e.stabilityDemand === 'high'
      );
    }
    // strength accessories: prefer isolation-ish / lower skill, not max compounds
    return (
      e.category === 'strength' &&
      e.difficulty !== 'advanced' &&
      (e.movementPattern === 'isometric' ||
        e.laterality === 'unilateral' ||
        (e.strengthDemand === 'low' || e.strengthDemand === 'moderate'))
    );
  });

  return pool
    .sort((a, b) => {
      const ah = qualities.filter((q) => a.movementQualities?.includes(q)).length;
      const bh = qualities.filter((q) => b.movementQualities?.includes(q)).length;
      return bh - ah;
    })
    .slice(0, 4)
    .map((e) => e.name);
}

function buildUserFacingSummary(args: {
  safety: MovementSafetyAssessmentResult;
  areaLabel: string;
  exerciseName?: string;
  replacement?: string;
  constraints: MovementConstraints;
}): string {
  const { safety, areaLabel, exerciseName, replacement, constraints } = args;
  const target = exerciseName?.trim() || `movements involving the ${areaLabel}`;

  if (safety.status === 'professional_evaluation') {
    return `${safety.userMessage} We'll keep unrelated training available and pause pushing ${target}.`;
  }
  if (safety.status === 'continue') {
    return `We'll keep an eye on ${target} and leave the rest of your training on track.`;
  }
  if (replacement) {
    return `Let's adjust ${target} (for example toward ${replacement}) and keep unrelated exercises. ${
      constraints.stabilityPriorities[0]
        ? `We'll also bias supportive work like ${constraints.stabilityPriorities[0].replace(/([A-Z])/g, ' $1').toLowerCase().trim()}.`
        : ''
    }`.trim();
  }
  return `Let's reduce demand on ${target}, keep unrelated exercises, and monitor how your body responds.`;
}

/**
 * Merge multiple plans (e.g. several recent reports) preferring higher-concern safety.
 */
export function mergeAdaptationPlans(plans: MovementAdaptationPlan[]): MovementAdaptationPlan | null {
  if (!plans.length) return null;
  const rank: Record<string, number> = {
    continue: 0,
    modify: 1,
    monitor: 2,
    professional_evaluation: 3,
  };
  const sorted = [...plans].sort(
    (a, b) => rank[b.safety.status] - rank[a.safety.status]
  );
  const primary = sorted[0];
  const mc = createEmptyMovementConstraints();
  mc.preserveUnrelatedExercises = true;

  for (const plan of sorted) {
    const c = plan.movementConstraints;
    mc.exercisesToModify.push(...c.exercisesToModify);
    mc.exercisesToMonitor.push(...c.exercisesToMonitor);
    mc.preferredVariations.push(...c.preferredVariations);
    mc.movementQualitiesToBuild.push(...c.movementQualitiesToBuild);
    mc.mobilityPriorities.push(...c.mobilityPriorities);
    mc.stabilityPriorities.push(...c.stabilityPriorities);
    mc.strengthPriorities.push(...c.strengthPriorities);
    mc.exercisesToAvoid.push(...c.exercisesToAvoid);
    mc.patternsToModify.push(...c.patternsToModify);
    mc.patternsToMonitor.push(...c.patternsToMonitor);
    if (c.reassessmentRequired) mc.reassessmentRequired = true;
    if (c.reassessmentDate) {
      if (!mc.reassessmentDate || c.reassessmentDate < mc.reassessmentDate) {
        mc.reassessmentDate = c.reassessmentDate;
      }
    }
  }

  mc.exercisesToMonitor = uniq(mc.exercisesToMonitor);
  mc.preferredVariations = uniq(mc.preferredVariations);
  mc.movementQualitiesToBuild = uniq(mc.movementQualitiesToBuild);
  mc.mobilityPriorities = uniq(mc.mobilityPriorities);
  mc.stabilityPriorities = uniq(mc.stabilityPriorities);
  mc.strengthPriorities = uniq(mc.strengthPriorities);
  mc.exercisesToAvoid = uniq(mc.exercisesToAvoid);
  mc.patternsToModify = uniq(mc.patternsToModify);
  mc.patternsToMonitor = uniq(mc.patternsToMonitor);

  return {
    version: 1,
    generatedAt: primary.generatedAt,
    sourceReportIds: uniq(plans.flatMap((p) => p.sourceReportIds)),
    safety: primary.safety,
    movementConstraints: mc,
    trainingPriorities: uniq(plans.flatMap((p) => p.trainingPriorities)),
    userFacingSummary: primary.userFacingSummary,
    proposedConstraints: plans.flatMap((p) => p.proposedConstraints),
  };
}

/** Convert plan proposed constraints into upsert payloads (caller persists). */
export function proposedConstraintsFromPlan(
  plan: MovementAdaptationPlan
): Array<Omit<TrainingConstraint, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }> {
  return plan.proposedConstraints;
}

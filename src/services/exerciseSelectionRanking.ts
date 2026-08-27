/**
 * Pure Exercise Selection ranking (no I/O).
 *
 * Scores catalog exercises for Beginner / Intermediate / Advanced using
 * exercise MI metadata + optional MovementProfile — not fixed lists.
 */

import {
  exerciseDatabase,
  type Equipment,
  type ExerciseData,
  type MovementPattern,
} from '../data/exerciseDatabase';
import type { DemandLevel } from '../data/exerciseMovementIntelligence';
import type { ExperienceLevel } from '../types/coachingProfile';
import type { MovementProfile } from '../types/movementIntelligence';
import type {
  ExerciseDemandSnapshot,
  ExerciseSelectionFilters,
  ExerciseSelectionReasonCode,
  ExerciseSelectionResult,
  RankedExerciseCandidate,
  SelectionExperienceLevel,
} from '../types/exerciseSelection';
import { COMPETENCY_LEVEL_RANK } from '../types/exerciseCompetency';

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function toSelectionExperienceLevel(
  level: ExperienceLevel | SelectionExperienceLevel | null | undefined
): SelectionExperienceLevel {
  if (level === 'advanced' || level === 'competitive') return 'advanced';
  if (level === 'intermediate') return 'intermediate';
  return 'beginner';
}

export function demandLevelRank(d?: DemandLevel): number {
  if (d === 'high') return 2;
  if (d === 'moderate') return 1;
  return 0;
}

export function snapshotExerciseDemands(ex: ExerciseData): ExerciseDemandSnapshot {
  const strength = ex.strengthDemand ?? (ex.difficulty === 'advanced' ? 'high' : ex.difficulty === 'intermediate' ? 'moderate' : 'low');
  const stability = ex.stabilityDemand ?? 'low';
  const mobility = ex.mobilityDemand ?? 'low';
  const coordination = ex.coordinationDemand ?? 'low';
  const balance = ex.balanceDemand ?? 'low';
  const technicalComplexity =
    ex.technicalComplexity ??
    (ex.difficulty === 'advanced' ? 'high' : ex.difficulty === 'intermediate' ? 'moderate' : 'low');

  const compositeDifficulty =
    (demandLevelRank(strength) +
      demandLevelRank(stability) +
      demandLevelRank(mobility) +
      demandLevelRank(coordination) +
      demandLevelRank(balance) +
      demandLevelRank(technicalComplexity)) /
    12; // 0–1

  return {
    strength,
    stability,
    mobility,
    coordination,
    balance,
    technicalComplexity,
    compositeDifficulty,
  };
}

/** Target composite difficulty band by experience (soft center + width). */
export function targetDifficultyBand(level: SelectionExperienceLevel): { center: number; width: number } {
  switch (level) {
    case 'beginner':
      return { center: 0.22, width: 0.28 };
    case 'intermediate':
      return { center: 0.48, width: 0.32 };
    case 'advanced':
      return { center: 0.72, width: 0.35 };
  }
}

/**
 * Hard gate: does this exercise's MI complexity fit the user's experience toggle?
 * Uses technicalComplexity / coordination / balance / composite — not catalog labels alone.
 */
export function exerciseFitsExperienceComplexity(
  ex: ExerciseData,
  level: SelectionExperienceLevel,
  opts?: { difficultyBias?: number }
): boolean {
  const bias = opts?.difficultyBias ?? 0;
  const d = snapshotExerciseDemands(ex);
  const tech = demandLevelRank(d.technicalComplexity);
  const coord = demandLevelRank(d.coordination);
  const bal = demandLevelRank(d.balance);
  const skill = isSkillHeavy(ex);

  if (level === 'beginner') {
    // Challenge dial can gently open the band; never auto-include olympic skill work.
    if (skill && bias < 1) return false;
    if (tech >= 2 && bias < 1) return false;
    if (coord >= 2 && bal >= 1 && bias < 1) return false;
    if (d.compositeDifficulty > 0.55 + Math.max(0, bias) * 0.1) return false;
    return true;
  }

  if (level === 'intermediate') {
    if (skill && bias < 0) return false;
    if (tech >= 2 && coord >= 2 && bal >= 2 && bias < 1) return false;
    if (d.compositeDifficulty > 0.85 && bias < 0) return false;
    return true;
  }

  // Advanced: allow full spectrum; very elementary skill-light drills stay selectable as accessories.
  return true;
}

/**
 * Order a day/focus pool so picks match experience MI complexity:
 * beginner → safer / lower technical demand first
 * advanced → higher complexity / loading demand first
 */
export function orderPoolForExperience(
  pool: ExerciseData[],
  level: SelectionExperienceLevel
): ExerciseData[] {
  if (pool.length <= 1) return [...pool];
  const band = targetDifficultyBand(level);
  return [...pool].sort((a, b) => {
    const da = snapshotExerciseDemands(a);
    const db = snapshotExerciseDemands(b);
    if (level === 'advanced') {
      const scoreA =
        da.compositeDifficulty * 2 +
        demandLevelRank(da.technicalComplexity) * 0.2 +
        demandLevelRank(da.strength) * 0.15 -
        (a.difficulty === 'beginner' && da.compositeDifficulty < 0.3 ? 0.4 : 0);
      const scoreB =
        db.compositeDifficulty * 2 +
        demandLevelRank(db.technicalComplexity) * 0.2 +
        demandLevelRank(db.strength) * 0.15 -
        (b.difficulty === 'beginner' && db.compositeDifficulty < 0.3 ? 0.4 : 0);
      return scoreB - scoreA || a.name.localeCompare(b.name);
    }
    if (level === 'beginner') {
      const scoreA =
        Math.abs(da.compositeDifficulty - band.center) +
        demandLevelRank(da.technicalComplexity) * 0.25 +
        demandLevelRank(da.balance) * 0.15 +
        (isSkillHeavy(a) ? 1 : 0);
      const scoreB =
        Math.abs(db.compositeDifficulty - band.center) +
        demandLevelRank(db.technicalComplexity) * 0.25 +
        demandLevelRank(db.balance) * 0.15 +
        (isSkillHeavy(b) ? 1 : 0);
      return scoreA - scoreB || a.name.localeCompare(b.name);
    }
    // Intermediate: closest to band center
    return (
      Math.abs(da.compositeDifficulty - band.center) -
        Math.abs(db.compositeDifficulty - band.center) || a.name.localeCompare(b.name)
    );
  });
}

function hasEquipment(ex: ExerciseData, items: Equipment[]): boolean {
  const eq = ex.equipmentRequired?.length ? ex.equipmentRequired : ex.equipment ?? [];
  return items.some((i) => eq.includes(i));
}

function isStableEquipment(ex: ExerciseData): boolean {
  return hasEquipment(ex, [
    'bodyweight',
    'dumbbells',
    'cable machine',
    'smith machine',
    'mat',
    'bench',
    'none',
    'resistance bands',
  ]);
}

function isMachineLike(ex: ExerciseData): boolean {
  const n = ex.name.toLowerCase();
  return (
    hasEquipment(ex, ['smith machine', 'cable machine']) ||
    /machine|smith|leg press|pec deck|assisted|lat pulldown/.test(n)
  );
}

function isFoundationalPattern(pattern: MovementPattern): boolean {
  return (
    pattern === 'squat' ||
    pattern === 'hinge' ||
    pattern === 'push' ||
    pattern === 'pull' ||
    pattern === 'lunge' ||
    pattern === 'isometric' ||
    pattern === 'carry'
  );
}

function isSkillHeavy(ex: ExerciseData): boolean {
  const n = ex.name.toLowerCase();
  return /snatch|clean|jerk|muscle-?up|handstand|pistol|turkish|overhead squat|depth jump|plyo/.test(
    n
  );
}

function isSupportedUnilateral(ex: ExerciseData): boolean {
  if (ex.laterality !== 'unilateral' && ex.laterality !== 'alternating') return false;
  const n = ex.name.toLowerCase();
  // Supported / reduced-balance unilateral
  return /assisted|supported|hold|incline|knee|wall|split squat \(bodyweight\)|bulgarian split squats \(bodyweight\)|reverse lunge|glute bridge|step/.test(
    n
  ) || hasEquipment(ex, ['smith machine', 'cable machine']);
}

function nameMatchesExclude(ex: ExerciseData, names?: string[]): boolean {
  if (!names?.length) return false;
  const n = ex.name.toLowerCase();
  return names.some((x) => n === x.toLowerCase() || n.includes(x.toLowerCase()));
}

function muscleMatches(ex: ExerciseData, muscles?: string[]): boolean {
  if (!muscles?.length) return true;
  const primary = (ex.primaryMuscleGroup || '').toLowerCase();
  const all = [
    primary,
    ...(ex.secondaryMuscleGroups || []).map((m) => m.toLowerCase()),
    ...(ex.primaryMuscles || []).map((m) => m.toLowerCase()),
  ];
  return muscles.some((m) => all.some((a) => a.includes(m.toLowerCase())));
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

type ScoreAcc = {
  score: number;
  reasons: ExerciseSelectionReasonCode[];
  notes: string[];
};

function add(
  acc: ScoreAcc,
  delta: number,
  reason?: ExerciseSelectionReasonCode,
  note?: string
) {
  acc.score += delta;
  if (reason) acc.reasons.push(reason);
  if (note) acc.notes.push(note);
}

function scoreForExperience(
  level: SelectionExperienceLevel,
  ex: ExerciseData,
  demands: ExerciseDemandSnapshot,
  profile: MovementProfile | null | undefined,
  competencyLevelRank: number | null
): ScoreAcc {
  const acc: ScoreAcc = { score: 50, reasons: [], notes: [] };
  const band = targetDifficultyBand(level);
  const dist = Math.abs(demands.compositeDifficulty - band.center);
  const inBand = dist <= band.width;

  if (inBand) {
    add(acc, 18, 'matches_experience_band', `Composite demand fits ${level} band`);
  } else if (demands.compositeDifficulty > band.center + band.width) {
    add(acc, -22, 'demand_too_high', 'Overall demand above experience band');
  } else {
    add(acc, level === 'advanced' ? -8 : 4, 'demand_too_low');
  }

  // Distance soft score
  acc.score += Math.max(-15, 12 - dist * 40);

  if (level === 'beginner') {
    scoreBeginner(acc, ex, demands, profile);
  } else if (level === 'intermediate') {
    scoreIntermediate(acc, ex, demands, profile);
  } else {
    scoreAdvanced(acc, ex, demands, profile);
  }

  // MovementProfile — never invent scores; only react when scored / needs_assessment
  applyMovementProfileAdjustments(acc, level, ex, demands, profile);

  if (competencyLevelRank != null) {
    if (competencyLevelRank >= COMPETENCY_LEVEL_RANK.competent) {
      add(acc, 6, 'competency_ready', 'User shows competency on this lift');
    } else if (competencyLevelRank === COMPETENCY_LEVEL_RANK.learning) {
      add(acc, 2, 'competency_learning');
    } else if (competencyLevelRank === COMPETENCY_LEVEL_RANK.unfamiliar && level === 'beginner') {
      // Fine for beginners to see unfamiliar basics
      add(acc, 1);
    } else if (competencyLevelRank === COMPETENCY_LEVEL_RANK.unfamiliar && level === 'advanced') {
      add(acc, -2);
    }
  }

  return acc;
}

function scoreBeginner(
  acc: ScoreAcc,
  ex: ExerciseData,
  demands: ExerciseDemandSnapshot,
  _profile: MovementProfile | null | undefined
) {
  if (isFoundationalPattern(ex.movementPattern)) {
    add(acc, 10, 'foundational_pattern', 'Builds a basic movement pattern');
  }
  if (demandLevelRank(demands.technicalComplexity) === 0) {
    add(acc, 10, 'low_technical_complexity', 'Simple technique demand');
  } else if (demandLevelRank(demands.technicalComplexity) >= 2) {
    add(acc, -18, 'complex_for_level');
  }
  if (demandLevelRank(demands.coordination) <= 1) {
    add(acc, 6, 'coordination_friendly');
  } else {
    add(acc, -12, 'complex_for_level', 'Coordination demand high for beginner');
  }
  if (demandLevelRank(demands.balance) === 0) {
    add(acc, 6, 'technique_friendly', 'Stable base of support');
  } else if (demandLevelRank(demands.balance) >= 2) {
    add(acc, -10, 'complex_for_level');
  }
  if (demandLevelRank(demands.stability) <= 1) {
    add(acc, 6, 'stability_priority');
  }

  if (isStableEquipment(ex) || isMachineLike(ex) || hasEquipment(ex, ['dumbbells', 'bodyweight'])) {
    add(acc, 8, 'stable_equipment', 'Dumbbells / bodyweight / machine-friendly');
  }
  if (hasEquipment(ex, ['barbell']) && !isMachineLike(ex) && demandLevelRank(demands.technicalComplexity) > 0) {
    add(acc, -8, 'complex_for_level', 'Free barbell skill load');
  }
  if (ex.laterality === 'bilateral') {
    add(acc, 5, 'technique_friendly', 'Bilateral / stable position');
  }
  if (isSupportedUnilateral(ex)) {
    add(acc, 7, 'supported_unilateral', 'Supported unilateral option');
  } else if (ex.laterality === 'unilateral' && demandLevelRank(demands.balance) >= 1) {
    add(acc, -10, 'complex_for_level', 'Unsupported unilateral');
  }
  if (isSkillHeavy(ex)) {
    add(acc, -25, 'olympic_or_skill_heavy', 'Unnecessarily complex for beginners');
  }
  if (ex.difficulty === 'beginner') add(acc, 6, 'matches_experience_band');
  if (ex.difficulty === 'advanced') add(acc, -14, 'demand_too_high');

  // Controlled / regenerative categories for confidence & technique
  if (ex.category === 'stability' || ex.movementPattern === 'isometric') {
    add(acc, 4, 'stability_priority');
  }

  // Prefer compounds / pattern builders over accessory isolation for general picks
  if (ex.miMovementPattern === 'isolation') {
    add(acc, -6, 'demand_too_low', 'Isolation accessory — secondary for beginners');
  }
  if (
    ex.movementQualities?.some((q) =>
      ['horizontalPush', 'verticalPush', 'horizontalPull', 'verticalPull', 'hipStrength', 'posteriorChainStrength', 'kneeStrength'].includes(
        q
      )
    )
  ) {
    add(acc, 5, 'foundational_pattern', 'Builds foundational strength qualities');
  }
}

function scoreIntermediate(
  acc: ScoreAcc,
  ex: ExerciseData,
  demands: ExerciseDemandSnapshot,
  _profile: MovementProfile | null | undefined
) {
  if (demandLevelRank(demands.strength) >= 1) {
    add(acc, 6, 'loading_appropriate', 'Can take meaningful load');
  }
  if (ex.laterality === 'unilateral' || ex.laterality === 'alternating') {
    add(acc, 8, 'unilateral_progression', 'Unilateral work appropriate');
  }
  if (demandLevelRank(demands.technicalComplexity) === 1) {
    add(acc, 8, 'complexity_appropriate');
  }
  if (demandLevelRank(demands.mobility) >= 1) {
    add(acc, 4, 'rom_and_specificity', 'Encourages fuller ROM');
  }
  if (hasEquipment(ex, ['barbell', 'dumbbells', 'kettlebell', 'cable machine'])) {
    add(acc, 5, 'loading_appropriate');
  }
  if (isSkillHeavy(ex)) {
    add(acc, -6, 'olympic_or_skill_heavy');
  }
  if (ex.difficulty === 'beginner' && demands.compositeDifficulty < 0.2) {
    add(acc, -4, 'demand_too_low');
  }
  if (ex.difficulty === 'intermediate') add(acc, 6, 'matches_experience_band');
  if (isFoundationalPattern(ex.movementPattern)) add(acc, 4, 'foundational_pattern');
}

function scoreAdvanced(
  acc: ScoreAcc,
  ex: ExerciseData,
  demands: ExerciseDemandSnapshot,
  _profile: MovementProfile | null | undefined
) {
  if (demandLevelRank(demands.strength) >= 1) {
    add(acc, 6, 'loading_appropriate', 'Supports heavier loading');
  }
  if (demandLevelRank(demands.technicalComplexity) >= 1) {
    add(acc, 6, 'advanced_variation');
  }
  if (
    ex.laterality === 'unilateral' &&
    demandLevelRank(demands.balance) >= 1
  ) {
    add(acc, 8, 'unilateral_progression', 'Complex unilateral allowed');
  }
  if (
    /fly|raise|curl|extension|pulldown|row|press|squat|deadlift|hinge|thrust/.test(
      ex.name.toLowerCase()
    ) &&
    ex.miMovementPattern === 'isolation'
  ) {
    add(acc, 5, 'hypertrophy_accessory', 'Specialized accessory work');
  }
  if (isSkillHeavy(ex) && demandLevelRank(demands.technicalComplexity) >= 1) {
    add(acc, 4, 'advanced_variation', 'Advanced skill variation permitted');
  }
  if (ex.difficulty === 'advanced') add(acc, 8, 'matches_experience_band');
  if (ex.difficulty === 'beginner' && demands.compositeDifficulty < 0.25) {
    add(acc, -10, 'demand_too_low', 'Too elementary when advanced options exist');
  }
  // Still slightly prefer real training stimuli over random stretches as "main" picks
  if (ex.category === 'strength') add(acc, 3);
}

function applyMovementProfileAdjustments(
  acc: ScoreAcc,
  level: SelectionExperienceLevel,
  ex: ExerciseData,
  demands: ExerciseDemandSnapshot,
  profile: MovementProfile | null | undefined
) {
  if (!profile) return;

  const scored = (m?: { status: string; score?: number }) =>
    m && m.status === 'scored' && typeof m.score === 'number' ? m.score : undefined;

  const needs = (m?: { status: string }) => m?.status === 'needs_assessment';

  // Stability profile
  const hipStab = scored(profile.stability.hipStability);
  const singleLeg = scored(profile.stability.singleLegStability);
  const knee = scored(profile.stability.kneeControl);
  const core = scored(profile.stability.coreStability);

  if (
    (typeof hipStab === 'number' && hipStab < 50) ||
    (typeof singleLeg === 'number' && singleLeg < 50) ||
    needs(profile.stability.hipStability) ||
    needs(profile.stability.singleLegStability)
  ) {
    if (demandLevelRank(demands.stability) >= 2 || (ex.laterality === 'unilateral' && !isSupportedUnilateral(ex))) {
      add(acc, -12, 'profile_stability_support', 'Profile suggests limiting high-stability demand');
    } else if (demandLevelRank(demands.stability) <= 1 || isSupportedUnilateral(ex)) {
      add(acc, 6, 'profile_stability_support', 'Favors stable / supported options');
    }
  }

  if (typeof knee === 'number' && knee < 50 && demandLevelRank(demands.stability) >= 2) {
    add(acc, -8, 'profile_control_caution');
  }

  // Mobility
  const ankleMob = scored(profile.mobility.ankleMobility);
  const hipMob = scored(profile.mobility.hipMobility);
  if (
    ((typeof ankleMob === 'number' && ankleMob < 50) || needs(profile.mobility.ankleMobility)) &&
    demandLevelRank(demands.mobility) >= 2 &&
    (ex.movementPattern === 'squat' || /overhead squat|pistol|cossack/.test(ex.name.toLowerCase()))
  ) {
    add(acc, -10, 'profile_mobility_caution', 'High mobility squat demand vs profile');
  }
  if (typeof hipMob === 'number' && hipMob < 50 && demandLevelRank(demands.mobility) >= 2) {
    add(acc, -6, 'profile_mobility_caution');
  }

  // Movement control
  const squatCtrl = scored(profile.movementControl.squatControl);
  if (typeof squatCtrl === 'number' && squatCtrl < 50 && demandLevelRank(demands.technicalComplexity) >= 2) {
    add(acc, -10, 'profile_control_caution');
  }

  // Beginners with weak/unknown core — prefer anti-extension / simple core
  if (level === 'beginner' && (typeof core === 'number' ? core < 55 : needs(profile.stability.coreStability))) {
    if (ex.movementQualities?.includes('coreStability') && demandLevelRank(demands.technicalComplexity) === 0) {
      add(acc, 4, 'stability_priority');
    }
  }
}

// ---------------------------------------------------------------------------
// Core rank (pure)
// ---------------------------------------------------------------------------

export function rankExercisesForExperience(input: {
  experienceLevel: SelectionExperienceLevel;
  catalog?: ExerciseData[];
  filters?: ExerciseSelectionFilters;
  profile?: MovementProfile | null;
  /** exerciseId → competency rank 0–4 */
  competencyRanks?: Record<string, number>;
  now?: string;
}): ExerciseSelectionResult {
  const level = input.experienceLevel;
  const filters = input.filters ?? {};
  const catalog = input.catalog ?? exerciseDatabase;
  const limit = Math.max(1, filters.limit ?? 40);

  const excludeIds = new Set((filters.excludeExerciseIds ?? []).map((x) => x.toLowerCase()));
  const avoid = (filters.avoidExerciseNames ?? []).map((x) => x.toLowerCase());

  const scored: RankedExerciseCandidate[] = [];

  for (const ex of catalog) {
    if (excludeIds.has(ex.id.toLowerCase())) continue;
    if (nameMatchesExclude(ex, filters.excludeNames)) continue;
    if (nameMatchesExclude(ex, filters.avoidExerciseNames)) {
      // still allow into list but heavily penalize below
    }
    if (filters.movementPatterns?.length && !filters.movementPatterns.includes(ex.movementPattern)) {
      continue;
    }
    if (filters.categories?.length && !filters.categories.includes(ex.category)) {
      continue;
    }
    if (!muscleMatches(ex, filters.primaryMuscles)) continue;

    if (filters.availableEquipment?.length) {
      const eq = ex.equipmentRequired?.length ? ex.equipmentRequired : ex.equipment ?? [];
      const ok =
        eq.length === 0 ||
        eq.every((e) => e === 'none' || e === 'bodyweight' || e === 'mat' || filters.availableEquipment!.includes(e)) ||
        eq.some((e) => filters.availableEquipment!.includes(e));
      // Soft: if no intersection and not bodyweight, skip
      const intersection = eq.filter((e) => filters.availableEquipment!.includes(e) || e === 'none' || e === 'bodyweight' || e === 'mat');
      if (eq.length && intersection.length === 0 && !ok) continue;
    }

    const demands = snapshotExerciseDemands(ex);
    const acc = scoreForExperience(
      level,
      ex,
      demands,
      input.profile,
      input.competencyRanks?.[ex.id] ?? null
    );

    // Training style soft preference
    if (filters.trainingStyle === 'machines' && isMachineLike(ex)) {
      add(acc, 6, 'stable_equipment');
    } else if (filters.trainingStyle === 'bodyweight' && hasEquipment(ex, ['bodyweight', 'none', 'mat'])) {
      add(acc, 6, 'stable_equipment');
    } else if (filters.trainingStyle === 'free_weights' && hasEquipment(ex, ['dumbbells', 'barbell', 'kettlebell'])) {
      add(acc, 5, 'loading_appropriate');
    }

    if (filters.respectExerciseLimitations && nameMatchesExclude(ex, filters.avoidExerciseNames)) {
      add(acc, -30, 'constraint_avoid', 'Listed in limitations / avoid list');
    } else if (avoid.some((a) => ex.name.toLowerCase() === a || ex.name.toLowerCase().includes(a))) {
      add(acc, -30, 'constraint_avoid');
    }

    if (
      filters.preferExerciseNames?.length &&
      filters.preferExerciseNames.some(
        (p) =>
          ex.name.toLowerCase() === p.toLowerCase() ||
          ex.name.toLowerCase().includes(p.toLowerCase()) ||
          p.toLowerCase().includes(ex.name.toLowerCase())
      )
    ) {
      add(acc, 22, 'constraint_preferred', 'Preferred variation under active MI constraint');
    }

    if (filters.availableEquipment?.length) {
      const eq = ex.equipmentRequired ?? [];
      const mismatch =
        eq.length > 0 &&
        !eq.some((e) =>
          filters.availableEquipment!.includes(e) || e === 'none' || e === 'bodyweight' || e === 'mat'
        );
      if (mismatch) add(acc, -15, 'equipment_mismatch');
    }

    scored.push({
      exerciseId: ex.id,
      name: ex.name,
      score: Math.round(acc.score * 10) / 10,
      rank: 0,
      experienceFit: level,
      catalogDifficulty: ex.difficulty,
      movementPattern: ex.movementPattern,
      laterality: ex.laterality,
      equipment: ex.equipmentRequired?.length ? ex.equipmentRequired : ex.equipment ?? [],
      demands,
      reasons: [...new Set(acc.reasons)],
      notes: acc.notes.slice(0, 6),
      exercise: ex,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const limited = scored.slice(0, limit).map((c, i) => ({ ...c, rank: i + 1 }));

  return {
    experienceLevel: level,
    generatedAt: input.now ?? new Date().toISOString(),
    candidates: limited,
    scoredCount: scored.length,
    filtersApplied: filters,
  };
}

/**
 * Convenience: rank for a single movement pattern (e.g. builder slot).
 */
export function rankExercisesForPattern(
  pattern: MovementPattern,
  input: Omit<Parameters<typeof rankExercisesForExperience>[0], 'filters'> & {
    filters?: Omit<ExerciseSelectionFilters, 'movementPatterns'>;
  }
): ExerciseSelectionResult {
  return rankExercisesForExperience({
    ...input,
    filters: {
      ...input.filters,
      movementPatterns: [pattern],
    },
  });
}

/** Top N exercise names for a quick debug / coach preview. */
export function previewTopNames(result: ExerciseSelectionResult, n = 10): string[] {
  return result.candidates.slice(0, n).map((c) => c.name);
}

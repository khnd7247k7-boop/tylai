/**
 * Exercise Selection Engine
 *
 * Returns a ranked list of appropriate exercises for Beginner / Intermediate /
 * Advanced users using exercise MI metadata + MovementProfile — not fixed lists.
 *
 * Future Workout Builder can query this; generation is NOT replaced in this phase.
 */

import type { ExerciseSelectionFilters, ExerciseSelectionRequest, ExerciseSelectionResult } from '../types/exerciseSelection';
import { COMPETENCY_LEVEL_RANK } from '../types/exerciseCompetency';
import type { MovementProfile } from '../types/movementIntelligence';
import { loadCoachingProfile } from './CoachingProfileService';
import { loadCompetencyStore } from './ExerciseCompetencyService';
import {
  loadActiveTrainingConstraints,
  loadMovementProfile,
} from './MovementIntelligenceService';
import {
  previewTopNames,
  rankExercisesForExperience,
  rankExercisesForPattern,
  snapshotExerciseDemands,
  toSelectionExperienceLevel,
} from './exerciseSelectionRanking';

export {
  demandLevelRank,
  previewTopNames,
  rankExercisesForExperience,
  rankExercisesForPattern,
  snapshotExerciseDemands,
  toSelectionExperienceLevel,
} from './exerciseSelectionRanking';

/**
 * Load user context and return ranked candidates.
 * Does not mutate plans or call the Workout Builder.
 */
export async function selectExercisesForUser(
  request: ExerciseSelectionRequest = {}
): Promise<ExerciseSelectionResult> {
  let level = toSelectionExperienceLevel(request.experienceLevel ?? null);
  if (request.experienceLevel == null) {
    try {
      const coaching = await loadCoachingProfile();
      level = toSelectionExperienceLevel(coaching.experienceProfile.level);
    } catch {
      level = 'beginner';
    }
  } else {
    level = toSelectionExperienceLevel(request.experienceLevel);
  }

  const filters: ExerciseSelectionFilters = { ...(request.filters ?? {}) };

  let profile: MovementProfile | null = null;
  if (request.useMovementProfile !== false) {
    try {
      profile = await loadMovementProfile();
      if (filters.respectExerciseLimitations !== false) {
        filters.respectExerciseLimitations = true;
        filters.avoidExerciseNames = [
          ...(filters.avoidExerciseNames ?? []),
          ...profile.exerciseLimitations,
        ];
      }
    } catch {
      profile = null;
    }
  }

  try {
    const constraints = await loadActiveTrainingConstraints();
    // Hard avoid only — "modify" must stay selectable so we can swap to preferred variations
    const avoidFromConstraints = constraints
      .filter((c) => c.status === 'temporarilyAvoid')
      .map((c) => c.exercise)
      .filter((n): n is string => Boolean(n));
    if (avoidFromConstraints.length) {
      filters.avoidExerciseNames = [
        ...(filters.avoidExerciseNames ?? []),
        ...avoidFromConstraints,
      ];
    }
    const preferFromConstraints = constraints
      .filter((c) => c.status === 'modify' || c.status === 'monitor')
      .flatMap((c) => c.preferredVariations ?? []);
    if (preferFromConstraints.length) {
      filters.preferExerciseNames = [
        ...(filters.preferExerciseNames ?? []),
        ...preferFromConstraints,
      ];
    }
  } catch {
    /* optional */
  }

  let competencyRanks: Record<string, number> | undefined;
  if (request.useCompetency) {
    try {
      const store = await loadCompetencyStore();
      competencyRanks = {};
      for (const [id, rec] of Object.entries(store.records)) {
        competencyRanks[id] = COMPETENCY_LEVEL_RANK[rec.competencyLevel];
      }
    } catch {
      competencyRanks = undefined;
    }
  }

  if (!filters.availableEquipment || !filters.trainingStyle) {
    try {
      const coaching = await loadCoachingProfile();
      if (!filters.trainingStyle && coaching.preferenceProfile.trainingStyle) {
        filters.trainingStyle = coaching.preferenceProfile.trainingStyle;
      }
      if (!filters.availableEquipment && coaching.equipmentProfile.access) {
        const access = coaching.equipmentProfile.access;
        if (access === 'bodyweight') {
          filters.availableEquipment = ['bodyweight', 'mat', 'none', 'pull-up bar'];
        } else if (access === 'minimal') {
          filters.availableEquipment = [
            'bodyweight',
            'dumbbells',
            'resistance bands',
            'mat',
            'none',
            'pull-up bar',
          ];
        } else if (access === 'home_gym') {
          filters.availableEquipment = [
            'bodyweight',
            'dumbbells',
            'barbell',
            'kettlebell',
            'resistance bands',
            'bench',
            'pull-up bar',
            'mat',
            'none',
          ];
        }
      }
    } catch {
      /* optional */
    }
  }

  return rankExercisesForExperience({
    experienceLevel: level,
    catalog: request.catalog,
    filters,
    profile,
    competencyRanks,
  });
}

/**
 * Exercise Selection Engine — domain types.
 *
 * Ranks catalog exercises for a user's experience level using exercise metadata
 * and MovementProfile signals. Does not replace Workout Builder selection yet.
 */

import type {
  Difficulty,
  Equipment,
  ExerciseData,
  MovementPattern,
} from '../data/exerciseDatabase';
import type { DemandLevel } from '../data/exerciseMovementIntelligence';
import type { ExperienceLevel } from './coachingProfile';

/** Selection tiers used by the engine (competitive maps to advanced). */
export type SelectionExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type ExerciseSelectionReasonCode =
  | 'matches_experience_band'
  | 'foundational_pattern'
  | 'stable_equipment'
  | 'supported_unilateral'
  | 'low_technical_complexity'
  | 'technique_friendly'
  | 'stability_priority'
  | 'coordination_friendly'
  | 'loading_appropriate'
  | 'unilateral_progression'
  | 'complexity_appropriate'
  | 'rom_and_specificity'
  | 'advanced_variation'
  | 'hypertrophy_accessory'
  | 'profile_stability_support'
  | 'profile_mobility_caution'
  | 'profile_control_caution'
  | 'constraint_avoid'
  | 'constraint_preferred'
  | 'competency_ready'
  | 'competency_learning'
  | 'demand_too_high'
  | 'demand_too_low'
  | 'equipment_mismatch'
  | 'pattern_mismatch'
  | 'complex_for_level'
  | 'olympic_or_skill_heavy';

export interface ExerciseDemandSnapshot {
  strength: DemandLevel;
  stability: DemandLevel;
  mobility: DemandLevel;
  coordination: DemandLevel;
  balance: DemandLevel;
  technicalComplexity: DemandLevel;
  /** Composite 0–1 difficulty from the six demand axes. */
  compositeDifficulty: number;
}

export interface RankedExerciseCandidate {
  exerciseId: string;
  name: string;
  score: number;
  rank: number;
  experienceFit: SelectionExperienceLevel;
  catalogDifficulty: Difficulty;
  movementPattern: MovementPattern;
  laterality?: ExerciseData['laterality'];
  equipment: Equipment[];
  demands: ExerciseDemandSnapshot;
  /** Why this exercise ranked here (machine-readable). */
  reasons: ExerciseSelectionReasonCode[];
  /** Short human notes for coach / debug. */
  notes: string[];
  exercise: ExerciseData;
}

export interface ExerciseSelectionFilters {
  /** Limit to these movement patterns when set. */
  movementPatterns?: MovementPattern[];
  /** Prefer / require equipment intersection. */
  availableEquipment?: Equipment[];
  /** Soft-prefer training style. */
  trainingStyle?: 'machines' | 'free_weights' | 'mix' | 'bodyweight' | null;
  /** Categories to include (default: strength-focused + stability/balance as needed). */
  categories?: Array<ExerciseData['category']>;
  /** Exclude exercise ids or names. */
  excludeExerciseIds?: string[];
  excludeNames?: string[];
  /** Prefer these primary muscles when set. */
  primaryMuscles?: string[];
  /** When true, heavily penalize exercises listed in MovementProfile limitations. */
  respectExerciseLimitations?: boolean;
  /** Exercises marked temporarilyAvoid in MI constraints. */
  avoidExerciseNames?: string[];
  /** Soft-prefer these names (e.g. preferredVariations from modify constraints). */
  preferExerciseNames?: string[];
  /** Max results (ranked list length). */
  limit?: number;
}

export interface ExerciseSelectionRequest {
  /** Explicit level; if omitted, load from CoachingProfile. */
  experienceLevel?: SelectionExperienceLevel | ExperienceLevel | null;
  filters?: ExerciseSelectionFilters;
  /** Optional catalog override (defaults to full exerciseDatabase). */
  catalog?: ExerciseData[];
  /** When false, skip loading MovementProfile (pure metadata ranking). */
  useMovementProfile?: boolean;
  /** When true, soft-boost from ExerciseCompetencyStore when available. */
  useCompetency?: boolean;
}

export interface ExerciseSelectionResult {
  experienceLevel: SelectionExperienceLevel;
  generatedAt: string;
  candidates: RankedExerciseCandidate[];
  /** Total scored before limit trim. */
  scoredCount: number;
  /** Filters actually applied. */
  filtersApplied: ExerciseSelectionFilters;
}

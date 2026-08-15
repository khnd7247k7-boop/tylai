/**
 * Earned progression / regression — domain types.
 *
 * Progression is earned from performance + competency + movement signals,
 * not automatic weekly inflation.
 *
 * Path: Learn → Control → Strengthen → Load → Progress → Specialize
 */

export type ProgressionMethod =
  | 'increase_reps'
  | 'increase_load'
  | 'increase_rom'
  | 'increase_sets'
  | 'increase_complexity'
  | 'introduce_unilateral'
  | 'reduce_support'
  | 'progress_exercise'
  | 'hold'
  | 'regress_load'
  | 'regress_reps'
  | 'regress_sets'
  | 'regress_exercise';

export type ProgressionStage =
  | 'learn'
  | 'control'
  | 'strengthen'
  | 'load'
  | 'progress'
  | 'specialize';

export type ProgressionDecision = {
  exerciseId: string;
  exerciseName: string;
  method: ProgressionMethod;
  /** When swapping exercises. */
  nextExerciseId?: string;
  nextExerciseName?: string;
  /** Suggested prescription deltas (applied when not swapping). */
  sets?: number;
  reps?: number;
  weight?: number;
  /** Soft ROM cue for coach / future UI (e.g. "full_depth"). */
  romCue?: 'pain_free' | 'partial' | 'full_depth' | 'extended';
  stage: ProgressionStage;
  reasons: string[];
  /** Never marks the exercise permanently bad. */
  temporary: true;
};

export type ProgressionEngineResult = {
  decisions: ProgressionDecision[];
  summary: string;
};

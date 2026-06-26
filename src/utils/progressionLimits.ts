/**
 * Shared progression limits — working sets cap at 4 for main lifts.
 * Beyond 4 sets, progress via load or reps (double progression), not more sets.
 */

export const MAX_WORKING_SETS = 4;
export const MAX_ACCESSORY_SETS = 3;
export const MIN_WORKING_SETS = 2;

/** Minimum load jump for earned progression (standard). */
export const MIN_WEIGHT_PROGRESSION_LBS = 5;
/** Larger bump when intensifying or on main compounds. */
export const INTENSIFY_WEIGHT_PROGRESSION_LBS = 10;

/** Round to nearest 2.5 lb plate increment. */
export function roundToPlateWeight(weight: number): number {
  return Math.max(0, Math.round(weight / 2.5) * 2.5);
}

/** Add at least `MIN_WEIGHT_PROGRESSION_LBS` (or more if bumpLbs is higher). */
export function applyWeightProgression(
  currentWeight: number,
  bumpLbs: number = MIN_WEIGHT_PROGRESSION_LBS
): number {
  if (currentWeight <= 0) return 0;
  const increment = Math.max(MIN_WEIGHT_PROGRESSION_LBS, bumpLbs);
  return roundToPlateWeight(currentWeight + increment);
}

export function weightProgressionBump(intensify = false): number {
  return intensify ? INTENSIFY_WEIGHT_PROGRESSION_LBS : MIN_WEIGHT_PROGRESSION_LBS;
}

export function isAccessoryPhase(phase?: string): boolean {
  const p = (phase ?? '').toLowerCase();
  return p.includes('accessory') || p.includes('finisher');
}

export function maxWorkingSetsFor(phase?: string): number {
  return isAccessoryPhase(phase) ? MAX_ACCESSORY_SETS : MAX_WORKING_SETS;
}

/** Clamp to valid working-set range for this exercise role. */
export function clampWorkingSets(sets: number, phase?: string): number {
  const max = maxWorkingSetsFor(phase);
  return Math.min(max, Math.max(MIN_WORKING_SETS, Math.round(sets)));
}

/** True only when another working set is allowed (never above cap). */
export function canAddWorkingSet(currentSets: number, phase?: string): boolean {
  return currentSets < maxWorkingSetsFor(phase);
}

/**
 * At the working-set cap, prefer load then reps — never return a 5th set.
 */
export function cappedSetProgression(opts: {
  sets: number;
  reps: number;
  weight: number;
  phase?: string;
  maxReps: number;
  weightBumpLbs?: number;
}): { sets: number; reps: number; weight: number; progressedVia: 'weight' | 'reps' | 'none' } {
  const { sets, reps, weight, phase, maxReps, weightBumpLbs = 5 } = opts;
  const cap = maxWorkingSetsFor(phase);

  if (sets < cap) {
    return { sets, reps, weight, progressedVia: 'none' };
  }

  if (weight > 0 && reps >= maxReps - 1) {
    const nw = applyWeightProgression(weight, weightBumpLbs);
    return { sets: cap, reps, weight: nw, progressedVia: 'weight' };
  }

  if (reps < maxReps) {
    return { sets: cap, reps: Math.min(maxReps, reps + 1), weight, progressedVia: 'reps' };
  }

  return { sets: cap, reps, weight, progressedVia: 'none' };
}

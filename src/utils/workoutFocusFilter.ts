import type { ExerciseData } from '../data/exerciseDatabase';

const LEG_MUSCLES = new Set(['quadriceps', 'hamstrings', 'glutes', 'calves', 'legs']);
const UPPER_MUSCLES = new Set(['chest', 'shoulders', 'back', 'biceps', 'triceps', 'arms']);
const LEG_MOVEMENT_PATTERNS = new Set(['squat', 'lunge', 'hinge']);

function normalizeMuscle(mg: string): string {
  return mg.toLowerCase().trim();
}

export function isLegDayFocus(focus: string): boolean {
  const f = focus.toLowerCase();
  if (f.includes('lower body')) return true;
  if (f.includes('quads') || f.includes('calves')) return true;
  if (f.includes('glutes') || f.includes('hamstrings')) return true;
  if (/\blegs?\b/.test(f)) return true;
  return false;
}

function primaryMuscle(ex: ExerciseData): string {
  return normalizeMuscle(ex.primaryMuscleGroup ?? '');
}

function isLegPrimary(ex: ExerciseData): boolean {
  const primary = primaryMuscle(ex);
  if (LEG_MUSCLES.has(primary)) return true;
  const pattern = ex.movementPattern;
  if (pattern && LEG_MOVEMENT_PATTERNS.has(pattern)) {
    return !UPPER_MUSCLES.has(primary);
  }
  return false;
}

function isUpperBodyPrimary(ex: ExerciseData): boolean {
  return UPPER_MUSCLES.has(primaryMuscle(ex));
}

/** Whether an exercise from the database belongs on this day's split focus. */
export function exerciseDataFitsDayFocus(ex: ExerciseData, focus: string): boolean {
  if (!isLegDayFocus(focus)) return true;

  if (isUpperBodyPrimary(ex)) return false;

  if (ex.category === 'cardio' || ex.category === 'flexibility' || ex.category === 'balance') {
    return true;
  }

  if (ex.category === 'strength') {
    return isLegPrimary(ex);
  }

  return false;
}

/** Same rules for a rendered workout exercise. */
export function exerciseFitsDayFocus(
  ex: { muscleGroups?: string[]; movementPattern?: string; category?: string },
  focus: string
): boolean {
  if (!isLegDayFocus(focus)) return true;

  const groups = (ex.muscleGroups ?? []).map(normalizeMuscle);
  if (groups.length > 0 && UPPER_MUSCLES.has(groups[0])) return false;

  if (ex.category === 'cardio' || ex.category === 'flexibility' || ex.category === 'balance') {
    return true;
  }

  if (ex.category === 'strength') {
    if (groups.some(g => LEG_MUSCLES.has(g))) return true;
    if (ex.movementPattern && LEG_MOVEMENT_PATTERNS.has(ex.movementPattern)) return true;
    return false;
  }

  return false;
}

export function filterExercisePoolForFocus(pool: ExerciseData[], focus: string): ExerciseData[] {
  return pool.filter(ex => exerciseDataFitsDayFocus(ex, focus));
}

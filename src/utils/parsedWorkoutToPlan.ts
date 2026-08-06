import type { MatchedSpreadsheetRoutine } from '../types/workoutSpreadsheetParse';
import {
  createFlexibleTrainingDays,
  type CustomExercise,
  type CustomPlanScheduleMode,
  type DayWorkout,
  type EditableSavedProgram,
  type PlanWeek,
} from './customWorkoutPlan';

function parseRepsString(reps: string | null | undefined): string {
  const raw = String(reps ?? '').trim();
  if (!raw) return '10';
  // Keep ranges like 8-12
  if (/^\d+\s*-\s*\d+$/.test(raw)) {
    return raw.replace(/\s+/g, '');
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? String(n) : '10';
}

function toCustomExercise(
  ex: MatchedSpreadsheetRoutine['days'][0]['exercises'][0],
  index: number
): CustomExercise {
  const sets =
    ex.sets != null && Number.isFinite(ex.sets) && ex.sets > 0
      ? String(Math.round(ex.sets))
      : '3';
  const rest =
    ex.restSeconds != null && Number.isFinite(ex.restSeconds) && ex.restSeconds > 0
      ? Math.round(ex.restSeconds)
      : 60;
  const weight =
    ex.weight != null && Number.isFinite(ex.weight) && ex.weight > 0 ? ex.weight : 0;

  return {
    id: `scan-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    name: ex.matchedName || ex.name,
    sets,
    reps: parseRepsString(ex.reps),
    weight,
    restTime: rest,
  };
}

/**
 * Convert a matched spreadsheet routine into BYOW editable program state.
 * Uses flexible days (Workout 1…N) so weekday mapping is not required.
 */
export function matchedRoutineToEditableProgram(
  routine: MatchedSpreadsheetRoutine
): EditableSavedProgram {
  const days = (routine.days ?? []).filter((d) => d.exercises?.length);
  const count = Math.max(1, Math.min(7, days.length || 1));
  const trainingDays = createFlexibleTrainingDays(count);
  const scheduleMode: CustomPlanScheduleMode = 'flexible_days';

  const dayWorkouts: DayWorkout[] = trainingDays.map((label, i) => {
    const source = days[i];
    const exercises = (source?.exercises ?? []).map((ex, j) => toCustomExercise(ex, i * 100 + j));
    return {
      day: label,
      workoutName: source?.name?.trim() || label,
      exercises,
      completed: exercises.length > 0,
    };
  });

  const programWeeks: PlanWeek[] = [
    {
      id: `week-scan-${Date.now()}`,
      name: 'Week 1',
      dayWorkouts,
      completed: dayWorkouts.every((d) => d.completed),
    },
  ];

  return {
    workoutName: routine.name?.trim() || 'Scanned Program',
    trainingDays,
    numWeeks: 1,
    weekNames: ['Week 1'],
    programWeeks,
    scheduleMode,
    flexibleDayCount: count,
  };
}

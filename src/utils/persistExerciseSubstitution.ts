/**
 * Persist an in-session exercise substitution onto a saved custom workout plan.
 */
import { loadUserData, saveUserData } from './userStorage';

export type ExerciseSubstitutionPersistTarget = {
  planId: string;
  /** Week index in programWeeks (0-based). Omit for top-level exercises-only plans. */
  weekIndex?: number;
  /** Day index within that week (0-based). */
  dayIndex?: number;
};

function patchExerciseList(
  exercises: any[] | undefined,
  opts: {
    exerciseIndex: number;
    oldName: string;
    newName: string;
    newExerciseId: string;
  }
): { list: any[]; changed: boolean } {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return { list: exercises ?? [], changed: false };
  }
  const next = exercises.map((ex, i) => {
    const matchByIndex = i === opts.exerciseIndex;
    const matchByName =
      String(ex?.name || '').toLowerCase() === opts.oldName.toLowerCase();
    if (!matchByIndex && !matchByName) return ex;
    // Prefer index on the active day; name match for other weeks
    if (!matchByIndex && matchByName) {
      return {
        ...ex,
        name: opts.newName,
        id: opts.newExerciseId || ex.id,
      };
    }
    if (matchByIndex) {
      return {
        ...ex,
        name: opts.newName,
        id: opts.newExerciseId || ex.id,
      };
    }
    return ex;
  });
  const changed = next.some((ex, i) => ex !== exercises[i]);
  return { list: next, changed };
}

/**
 * Replace an exercise in the user's saved plan and write it to storage.
 * Updates the active day; also updates the same day slot in other weeks when the old name matches.
 */
export async function persistExerciseSubstitutionInSavedPlan(opts: {
  planId: string;
  weekIndex?: number;
  dayIndex?: number;
  exerciseIndex: number;
  oldName: string;
  newName: string;
  newExerciseId: string;
}): Promise<{ ok: boolean; updatedPlan?: any; error?: string }> {
  const planId = String(opts.planId || '').trim();
  if (!planId) return { ok: false, error: 'Missing plan id.' };

  try {
    const savedPlans = (await loadUserData<any[]>('savedWorkoutPlans')) || [];
    const planIndex = savedPlans.findIndex((p) => p?.id === planId);
    if (planIndex < 0) {
      return { ok: false, error: 'Saved plan not found.' };
    }

    const plan = { ...savedPlans[planIndex] };
    let anyChanged = false;

    const patchArgs = {
      exerciseIndex: opts.exerciseIndex,
      oldName: opts.oldName,
      newName: opts.newName,
      newExerciseId: opts.newExerciseId,
    };

    if (Array.isArray(plan.programWeeks) && plan.programWeeks.length > 0) {
      plan.programWeeks = plan.programWeeks.map((week: any, wIdx: number) => {
        if (!week?.weekDays?.length) return week;
        const weekDays = week.weekDays.map((day: any, dIdx: number) => {
          const isActiveDay =
            opts.weekIndex != null &&
            opts.dayIndex != null &&
            wIdx === opts.weekIndex &&
            dIdx === opts.dayIndex;
          const sameDaySlot =
            opts.dayIndex != null && dIdx === opts.dayIndex;

          if (!isActiveDay && !sameDaySlot) return day;

          const { list, changed } = patchExerciseList(day.exercises, {
            ...patchArgs,
            // Only force index match on the active day; other weeks match by name
            exerciseIndex: isActiveDay ? opts.exerciseIndex : -1,
          });
          if (changed) anyChanged = true;
          return changed ? { ...day, exercises: list } : day;
        });
        return { ...week, weekDays };
      });
    }

    if (plan.weeklyPlan?.weekDays?.length && opts.dayIndex != null) {
      const weekDays = plan.weeklyPlan.weekDays.map((day: any, dIdx: number) => {
        if (dIdx !== opts.dayIndex) return day;
        const { list, changed } = patchExerciseList(day.exercises, patchArgs);
        if (changed) anyChanged = true;
        return changed ? { ...day, exercises: list } : day;
      });
      plan.weeklyPlan = { ...plan.weeklyPlan, weekDays };
    }

    if (Array.isArray(plan.exercises) && plan.exercises.length > 0) {
      const { list, changed } = patchExerciseList(plan.exercises, patchArgs);
      if (changed) {
        plan.exercises = list;
        anyChanged = true;
      }
    }

    if (!anyChanged) {
      return { ok: false, error: 'Could not find that exercise in the saved plan.' };
    }

    savedPlans[planIndex] = plan;
    await saveUserData('savedWorkoutPlans', savedPlans);
    return { ok: true, updatedPlan: plan };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

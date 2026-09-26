import { Alert } from 'react-native';
import type { Exercise } from '../../data/workoutPrograms';
import type { ExerciseData } from '../data/exerciseDatabase';
import { loadUserData, saveUserData } from './userStorage';

export type WorkoutEditScope = 'session' | 'plan' | 'cancel';

export function mapExerciseCategory(
  category?: string
): Exercise['category'] {
  if (category === 'stability') return 'balance';
  if (
    category === 'strength' ||
    category === 'cardio' ||
    category === 'flexibility' ||
    category === 'balance'
  ) {
    return category;
  }
  return 'strength';
}

export function exerciseFromLibrary(
  data: ExerciseData,
  restTime: number,
  defaults?: { sets?: number; reps?: number; weight?: number }
): Exercise {
  return {
    id: data.id || `exercise-${Date.now()}`,
    name: data.name,
    sets: defaults?.sets ?? 3,
    reps: defaults?.reps ?? 10,
    weight: defaults?.weight ?? 0,
    restTime,
    category: mapExerciseCategory(data.category),
    instructions: undefined,
  };
}

export function confirmWorkoutEditScope(options: {
  actionTitle: string;
  detail: string;
  canUpdatePlan: boolean;
}): Promise<WorkoutEditScope> {
  const { actionTitle, detail, canUpdatePlan } = options;
  return new Promise((resolve) => {
    if (!canUpdatePlan) {
      Alert.alert(
        actionTitle,
        `${detail}\n\nThis will apply to this workout only.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
          { text: 'This workout', onPress: () => resolve('session') },
        ]
      );
      return;
    }
    Alert.alert(
      actionTitle,
      `${detail}\n\nKeep it for this workout only, or also update the saved plan for next time?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
        { text: 'This workout only', onPress: () => resolve('session') },
        { text: 'Update plan', onPress: () => resolve('plan') },
      ]
    );
  });
}

type SavedPlanRecord = {
  id?: string;
  exercises?: Exercise[];
  weeklyPlan?: { weekDays?: Array<{ exercises?: Exercise[] }> };
  programWeeks?: Array<{
    weekDays?: Array<{ exercises?: Exercise[] }>;
    dayWorkouts?: Array<{ exercises?: unknown[] }>;
  }>;
};

function toSavedExercise(ex: Exercise) {
  return {
    ...ex,
    id: ex.id,
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    weight: ex.weight ?? 0,
    restTime: ex.restTime,
    category: ex.category || 'strength',
  };
}

export async function persistExercisesToSavedPlan(args: {
  planId: string;
  exercises: Exercise[];
  weekIndex?: number | null;
  dayIndex?: number | null;
}): Promise<{ ok: boolean; updatedPlan?: SavedPlanRecord }> {
  const { planId, exercises, weekIndex, dayIndex } = args;
  if (!planId) return { ok: false };
  const plans = (await loadUserData<SavedPlanRecord[]>('savedWorkoutPlans')) || [];
  const index = plans.findIndex((plan) => plan?.id === planId);
  if (index < 0) return { ok: false };

  const nextExercises = exercises.map(toSavedExercise);
  const plan: SavedPlanRecord = { ...plans[index] };

  if (
    typeof weekIndex === 'number' &&
    weekIndex >= 0 &&
    typeof dayIndex === 'number' &&
    dayIndex >= 0
  ) {
    if (Array.isArray(plan.programWeeks) && plan.programWeeks[weekIndex]) {
      const weeks = [...plan.programWeeks];
      const week = { ...weeks[weekIndex] };
      if (Array.isArray(week.weekDays) && week.weekDays[dayIndex]) {
        const weekDays = [...week.weekDays];
        weekDays[dayIndex] = { ...weekDays[dayIndex], exercises: nextExercises };
        week.weekDays = weekDays;
      }
      weeks[weekIndex] = week;
      plan.programWeeks = weeks;
    }
    if (weekIndex === 0 && Array.isArray(plan.weeklyPlan?.weekDays) && plan.weeklyPlan!.weekDays![dayIndex]) {
      const weekDays = [...plan.weeklyPlan!.weekDays!];
      weekDays[dayIndex] = { ...weekDays[dayIndex], exercises: nextExercises };
      plan.weeklyPlan = { ...plan.weeklyPlan, weekDays };
    }
  } else if (Array.isArray(plan.weeklyPlan?.weekDays) && plan.weeklyPlan!.weekDays!.length === 1) {
    const weekDays = [...plan.weeklyPlan!.weekDays!];
    weekDays[0] = { ...weekDays[0], exercises: nextExercises };
    plan.weeklyPlan = { ...plan.weeklyPlan, weekDays };
  }

  plan.exercises = nextExercises;
  plans[index] = plan;
  await saveUserData('savedWorkoutPlans', plans);
  return { ok: true, updatedPlan: plan };
}

/** Types and helpers for Build Your Own multi-week programs. */

export interface CustomExercise {
  id: string;
  name: string;
  sets: string;
  reps: string;
  weight: number;
  restTime: number;
}

export interface DayWorkout {
  day: string;
  workoutName: string;
  exercises: CustomExercise[];
  completed: boolean;
}

export interface PlanWeek {
  id: string;
  name: string;
  dayWorkouts: DayWorkout[];
  completed: boolean;
}

export type SavedPlanWeek = {
  weekNumber: number;
  name: string;
  weekDays: Array<{
    day: number;
    dayName: string;
    workoutName: string;
    focus: string;
    exercises: Array<{
      id: string;
      name: string;
      sets: number;
      reps: number;
      weight: number;
      restTime: number;
      category: 'strength';
    }>;
    duration: number;
  }>;
};

export function defaultWorkoutNameForDay(day: string): string {
  return `${day} Workout`;
}

export function createEmptyDayWorkouts(trainingDays: string[]): DayWorkout[] {
  return trainingDays.map((day) => ({
    day,
    workoutName: defaultWorkoutNameForDay(day),
    exercises: [],
    completed: false,
  }));
}

export function cloneDayWorkoutsFromPreviousWeek(prev: DayWorkout[], trainingDays: string[]): DayWorkout[] {
  return trainingDays.map((day) => {
    const match = prev.find((d) => d.day === day);
    if (!match) {
      return {
        day,
        workoutName: defaultWorkoutNameForDay(day),
        exercises: [],
        completed: false,
      };
    }
    return {
      day,
      workoutName: match.workoutName,
      exercises: match.exercises.map((ex) => ({
        ...ex,
        id: `exercise-${Date.now()}-${Math.random()}`,
      })),
      completed: false,
    };
  });
}

export function createInitialProgramWeeks(
  numWeeks: number,
  trainingDays: string[],
  weekNames?: string[]
): PlanWeek[] {
  return Array.from({ length: numWeeks }, (_, i) => ({
    id: `week-${Date.now()}-${i}`,
    name: weekNames?.[i]?.trim() || `Week ${i + 1}`,
    dayWorkouts: createEmptyDayWorkouts(trainingDays),
    completed: false,
  }));
}

export function parseSetsAndReps(ex: CustomExercise): { setsNum: number; repsNum: number } {
  const setsNum = ex.sets.includes('-')
    ? parseInt(ex.sets.split('-')[0], 10)
    : parseInt(ex.sets, 10) || 3;
  const repsNum = ex.reps.includes('-')
    ? parseInt(ex.reps.split('-')[0], 10)
    : parseInt(ex.reps, 10) || 10;
  return { setsNum, repsNum };
}

export function dayWorkoutsToSavedWeekDays(
  dayWorkouts: DayWorkout[],
  programName: string
): SavedPlanWeek['weekDays'] {
  return dayWorkouts.map((dw) => ({
    day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(dw.day) + 1,
    dayName: dw.day,
    workoutName: dw.workoutName.trim() || `${programName} - ${dw.day}`,
    focus: dw.workoutName.trim() || `Custom ${dw.day} workout`,
    exercises: dw.exercises.map((ex) => {
      const { setsNum, repsNum } = parseSetsAndReps(ex);
      return {
        id: ex.id,
        name: ex.name,
        sets: setsNum,
        reps: repsNum,
        weight: ex.weight,
        restTime: ex.restTime,
        category: 'strength' as const,
      };
    }),
    duration: dw.exercises.length * 5,
  }));
}

/** Read weeks from a saved plan (new multi-week or legacy single-week). */
export function getProgramWeeksFromSavedPlan(plan: {
  programWeeks?: SavedPlanWeek[];
  weeklyPlan?: { weekDays: SavedPlanWeek['weekDays'] };
}): SavedPlanWeek[] {
  if (plan.programWeeks?.length) {
    return plan.programWeeks;
  }
  if (plan.weeklyPlan?.weekDays?.length) {
    return [{ weekNumber: 1, name: 'Week 1', weekDays: plan.weeklyPlan.weekDays }];
  }
  return [];
}

const DAY_NAMES_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function savedExerciseToCustom(ex: SavedPlanWeek['weekDays'][0]['exercises'][0]): CustomExercise {
  return {
    id: ex.id || `exercise-${Date.now()}-${Math.random()}`,
    name: ex.name,
    sets: String(ex.sets),
    reps: String(ex.reps),
    weight: ex.weight ?? 0,
    restTime: ex.restTime ?? 60,
  };
}

function deriveTrainingDaysFromWeeks(
  weeks: SavedPlanWeek[],
  fallback?: string[]
): string[] {
  if (fallback?.length) {
    return fallback.filter((d) => DAY_NAMES_ORDER.includes(d));
  }
  const names = new Set<string>();
  weeks.forEach((w) => w.weekDays.forEach((d) => names.add(d.dayName)));
  return DAY_NAMES_ORDER.filter((d) => names.has(d));
}

function weekDaysToDayWorkouts(
  weekDays: SavedPlanWeek['weekDays'],
  trainingDays: string[]
): DayWorkout[] {
  return trainingDays.map((dayName) => {
    const match = weekDays.find((d) => d.dayName === dayName);
    if (!match) {
      return {
        day: dayName,
        workoutName: defaultWorkoutNameForDay(dayName),
        exercises: [],
        completed: false,
      };
    }
    return {
      day: dayName,
      workoutName: match.workoutName || defaultWorkoutNameForDay(dayName),
      exercises: (match.exercises || []).map(savedExerciseToCustom),
      completed: (match.exercises || []).length > 0,
    };
  });
}

export type EditableSavedProgram = {
  workoutName: string;
  trainingDays: string[];
  numWeeks: number;
  weekNames: string[];
  programWeeks: PlanWeek[];
};

/** Convert a saved plan into builder state for editing names, exercises, and weeks. */
export function savedPlanToEditableProgram(plan: {
  id?: string;
  name?: string;
  trainingDays?: string[];
  exercises?: SavedPlanWeek['weekDays'][0]['exercises'];
  programWeeks?: SavedPlanWeek[];
  weeklyPlan?: { weekDays: SavedPlanWeek['weekDays'] };
}): EditableSavedProgram | null {
  const weeks = getProgramWeeksFromSavedPlan(plan);

  if (weeks.length > 0 && weeks.some((w) => w.weekDays?.length > 0)) {
    const trainingDays = deriveTrainingDaysFromWeeks(weeks, plan.trainingDays);
    if (trainingDays.length === 0) return null;

    const programWeeks: PlanWeek[] = weeks.map((week, weekIndex) => ({
      id: `week-edit-${plan.id ?? 'plan'}-${weekIndex}`,
      name: week.name || `Week ${weekIndex + 1}`,
      completed: true,
      dayWorkouts: weekDaysToDayWorkouts(week.weekDays, trainingDays),
    }));

    return {
      workoutName: plan.name?.trim() || 'My Program',
      trainingDays,
      numWeeks: weeks.length,
      weekNames: weeks.map((w, i) => w.name || `Week ${i + 1}`),
      programWeeks,
    };
  }

  if (plan.exercises?.length) {
    const dayName = plan.trainingDays?.[0] || 'Monday';
    const trainingDays = plan.trainingDays?.length ? plan.trainingDays : [dayName];
    const exercises = plan.exercises.map(savedExerciseToCustom);

    return {
      workoutName: plan.name?.trim() || 'My Program',
      trainingDays,
      numWeeks: 1,
      weekNames: ['Week 1'],
      programWeeks: [
        {
          id: `week-edit-${plan.id ?? 'plan'}-0`,
          name: 'Week 1',
          completed: true,
          dayWorkouts: [
            {
              day: dayName,
              workoutName: plan.name?.trim() || defaultWorkoutNameForDay(dayName),
              exercises,
              completed: true,
            },
          ],
        },
      ],
    };
  }

  return null;
}

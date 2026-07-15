/** Types and helpers for Build Your Own multi-week programs. */

export type CustomPlanScheduleMode = 'weekly_split' | 'flexible_days';

export const DAY_NAMES_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export interface CustomExercise {
  id: string;
  name: string;
  sets: string;
  reps: string;
  weight: number;
  restTime: number;
  /** When set (>0), exercise is logged by timed holds instead of weight × reps. */
  durationSeconds?: number;
  /** Exercises sharing this id alternate sets (superset). */
  supersetId?: string;
  /** Order within the superset (0 = first). */
  supersetOrder?: number;
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
      durationSeconds?: number;
      supersetId?: string;
      supersetOrder?: number;
    }>;
    duration: number;
  }>;
};

export function defaultWorkoutNameForDay(day: string): string {
  if (isFlexibleDayLabel(day)) return day;
  return `${day} Workout`;
}

export function isFlexibleDayLabel(name: string): boolean {
  return /^Workout \d+$/i.test(name.trim());
}

/** Rotating split: Workout 1 … Workout N (no calendar day). */
export function createFlexibleTrainingDays(count: number): string[] {
  const n = Math.max(1, Math.min(7, Math.round(count)));
  return Array.from({ length: n }, (_, i) => `Workout ${i + 1}`);
}

export function inferScheduleMode(plan: {
  scheduleMode?: CustomPlanScheduleMode;
  trainingDays?: string[];
  programWeeks?: SavedPlanWeek[];
  weeklyPlan?: { weekDays: SavedPlanWeek['weekDays'] };
}): CustomPlanScheduleMode {
  if (plan.scheduleMode === 'flexible_days' || plan.scheduleMode === 'weekly_split') {
    return plan.scheduleMode;
  }
  const fromTraining = plan.trainingDays ?? [];
  if (fromTraining.length > 0 && fromTraining.every(isFlexibleDayLabel)) {
    return 'flexible_days';
  }
  const weeks = getProgramWeeksFromSavedPlan(plan);
  const weekNames = weeks[0]?.weekDays?.map((d) => d.dayName) ?? [];
  if (weekNames.length > 0 && weekNames.every(isFlexibleDayLabel)) {
    return 'flexible_days';
  }
  return 'weekly_split';
}

export function sortWeeklyTrainingDays(days: string[]): string[] {
  return [...days].sort((a, b) => DAY_NAMES_ORDER.indexOf(a as typeof DAY_NAMES_ORDER[number]) - DAY_NAMES_ORDER.indexOf(b as typeof DAY_NAMES_ORDER[number]));
}

export function scheduleModeDescription(
  mode: CustomPlanScheduleMode,
  dayCount: number
): string {
  if (mode === 'flexible_days') {
    return `${dayCount} workouts · rest when you need`;
  }
  return `${dayCount} days/week (weekly split)`;
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
  programName: string,
  scheduleMode: CustomPlanScheduleMode = 'weekly_split'
): SavedPlanWeek['weekDays'] {
  return dayWorkouts.map((dw, index) => ({
    day:
      scheduleMode === 'flexible_days'
        ? index + 1
        : DAY_NAMES_ORDER.indexOf(dw.day as (typeof DAY_NAMES_ORDER)[number]) + 1,
    dayName: dw.day,
    workoutName: dw.workoutName.trim() || `${programName} - ${dw.day}`,
    focus:
      scheduleMode === 'flexible_days'
        ? dw.workoutName.trim() || `Rotation ${index + 1}`
        : dw.workoutName.trim() || `Custom ${dw.day} workout`,
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
        ...(ex.durationSeconds != null && ex.durationSeconds > 0
          ? { durationSeconds: ex.durationSeconds }
          : {}),
        ...(ex.supersetId
          ? { supersetId: ex.supersetId, supersetOrder: ex.supersetOrder ?? 0 }
          : {}),
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

const DAY_NAMES_ORDER_LEGACY = DAY_NAMES_ORDER;

function deriveTrainingDaysFromWeeks(
  weeks: SavedPlanWeek[],
  fallback?: string[],
  scheduleMode?: CustomPlanScheduleMode
): string[] {
  const mode = scheduleMode ?? inferScheduleMode({ trainingDays: fallback, programWeeks: weeks });
  if (mode === 'flexible_days') {
    const firstWeek = weeks[0];
    if (firstWeek?.weekDays?.length) {
      return [...firstWeek.weekDays]
        .sort((a, b) => a.day - b.day)
        .map((d) => d.dayName);
    }
    if (fallback?.length && fallback.every(isFlexibleDayLabel)) return fallback;
    return createFlexibleTrainingDays(fallback?.length || 4);
  }
  if (fallback?.length) {
    return sortWeeklyTrainingDays(fallback.filter((d) => DAY_NAMES_ORDER_LEGACY.includes(d as any)));
  }
  const names = new Set<string>();
  weeks.forEach((w) => w.weekDays.forEach((d) => names.add(d.dayName)));
  return DAY_NAMES_ORDER_LEGACY.filter((d) => names.has(d));
}

function savedExerciseToCustom(ex: SavedPlanWeek['weekDays'][0]['exercises'][0]): CustomExercise {
  return {
    id: ex.id || `exercise-${Date.now()}-${Math.random()}`,
    name: ex.name,
    sets: String(ex.sets),
    reps: String(ex.reps),
    weight: ex.weight ?? 0,
    restTime: ex.restTime ?? 60,
    ...(ex.durationSeconds != null && ex.durationSeconds > 0
      ? { durationSeconds: ex.durationSeconds }
      : {}),
    ...(ex.supersetId
      ? { supersetId: ex.supersetId, supersetOrder: ex.supersetOrder ?? 0 }
      : {}),
  };
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
  scheduleMode: CustomPlanScheduleMode;
  flexibleDayCount: number;
};

/** Convert a saved plan into builder state for editing names, exercises, and weeks. */
export function savedPlanToEditableProgram(plan: {
  id?: string;
  name?: string;
  trainingDays?: string[];
  scheduleMode?: CustomPlanScheduleMode;
  flexibleDayCount?: number;
  exercises?: SavedPlanWeek['weekDays'][0]['exercises'];
  programWeeks?: SavedPlanWeek[];
  weeklyPlan?: { weekDays: SavedPlanWeek['weekDays'] };
}): EditableSavedProgram | null {
  const weeks = getProgramWeeksFromSavedPlan(plan);
  const scheduleMode = inferScheduleMode(plan);

  if (weeks.length > 0 && weeks.some((w) => w.weekDays?.length > 0)) {
    const trainingDays = deriveTrainingDaysFromWeeks(weeks, plan.trainingDays, scheduleMode);
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
      scheduleMode,
      flexibleDayCount: plan.flexibleDayCount ?? trainingDays.length,
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
      scheduleMode,
      flexibleDayCount: plan.flexibleDayCount ?? trainingDays.length,
    };
  }

  return null;
}

export type FlexibleRotationSlot = {
  weekIndex: number;
  dayIndex: number;
  dayWorkout: SavedPlanWeek['weekDays'][number];
};

export function getActiveProgramWeekIndex(plan: {
  activeProgramWeek?: number;
  programWeeks?: SavedPlanWeek[];
  weeklyPlan?: { weekDays: SavedPlanWeek['weekDays'] };
}): number {
  const weeks = getProgramWeeksFromSavedPlan(plan);
  return Math.max(0, Math.min(weeks.length - 1, (plan.activeProgramWeek ?? 1) - 1));
}

export function getFlexibleRotationSlots(
  plan: {
    activeProgramWeek?: number;
    programWeeks?: SavedPlanWeek[];
    weeklyPlan?: { weekDays: SavedPlanWeek['weekDays'] };
  },
  weekIndex?: number
): FlexibleRotationSlot[] {
  const weeks = getProgramWeeksFromSavedPlan(plan);
  const wi = weekIndex ?? getActiveProgramWeekIndex(plan);
  const week = weeks[wi];
  if (!week?.weekDays?.length) return [];
  return [...week.weekDays]
    .map((dayWorkout, dayIndex) => ({ weekIndex: wi, dayIndex, dayWorkout }))
    .sort((a, b) => Number(a.dayWorkout.day) - Number(b.dayWorkout.day));
}

export function parseFlexibleSessionDayNumber(programId: string, planId: string): number | null {
  if (!programId.startsWith(planId)) return null;
  const match = programId.match(/-w\d+-d(\d+)$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export function getLastCompletedFlexibleDayIndex(
  plan: { id: string; flexibleRotationIndex?: number },
  slots: FlexibleRotationSlot[],
  history: Array<{ programId: string; date: string; completed?: boolean }> = []
): number | null {
  if (typeof plan.flexibleRotationIndex === 'number') {
    const bySlot = slots.findIndex((s) => s.dayIndex === plan.flexibleRotationIndex);
    if (bySlot >= 0) return bySlot;
    const idx = plan.flexibleRotationIndex;
    if (idx >= 0 && idx < slots.length) return idx;
  }

  const planSessions = history
    .filter((s) => s.programId.startsWith(plan.id) && s.completed !== false)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  for (const session of planSessions) {
    const dayNum = parseFlexibleSessionDayNumber(session.programId, plan.id);
    if (dayNum == null) continue;
    const idx = slots.findIndex((s) => Number(s.dayWorkout.day) === dayNum);
    if (idx >= 0) return idx;
  }

  return null;
}

/** Next workout in a flexible rotation (wraps after the last slot). */
export function getSuggestedFlexibleRotation(
  plan: {
    id: string;
    flexibleRotationIndex?: number;
    activeProgramWeek?: number;
    programWeeks?: SavedPlanWeek[];
    weeklyPlan?: { weekDays: SavedPlanWeek['weekDays'] };
  },
  history: Array<{ programId: string; date: string; completed?: boolean }> = []
): FlexibleRotationSlot | null {
  const slots = getFlexibleRotationSlots(plan);
  if (!slots.length) return null;

  const lastIdx = getLastCompletedFlexibleDayIndex(plan, slots, history);
  const nextIdx = lastIdx == null ? 0 : (lastIdx + 1) % slots.length;
  return slots[nextIdx] ?? slots[0];
}

export function flexibleRotationLabel(slot: FlexibleRotationSlot | null): string {
  if (!slot) return 'Workout';
  return slot.dayWorkout.workoutName?.trim() || slot.dayWorkout.dayName || 'Workout';
}

/**
 * Keeps an in-progress workout alive across tab / screen changes and app updates.
 * ProgramExecutionScreen hydrates from and syncs into this context.
 * Snapshot is persisted to AsyncStorage (+ cloud) so it survives restarts.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { WorkoutProgram, WorkoutSession } from '../../data/workoutPrograms';
import type { ExerciseSubstitutionPersistTarget } from '../utils/persistExerciseSubstitution';
import { loadUserData, saveUserData } from '../utils/userStorage';

export type ActiveWorkoutSet = {
  setNumber: number;
  reps: number;
  weight: number;
  restTime: number;
  completed: boolean;
  rir?: number;
};

export type ActiveWorkoutExerciseRow = {
  exerciseId: string;
  name: string;
  skipped?: boolean;
  sets: ActiveWorkoutSet[];
};

export type ActiveWorkoutSnapshot = {
  program: WorkoutProgram;
  modifiedProgram: WorkoutProgram | null;
  persistTarget: ExerciseSubstitutionPersistTarget | null;
  exerciseData: ActiveWorkoutExerciseRow[];
  currentExerciseIndex: number;
  currentSetIndex: number;
  notes: string;
  startTimeIso: string;
  /** When false, UI is hidden but session continues (user left Workouts). */
  isPresented: boolean;
};

type StartActiveWorkoutInput = {
  program: WorkoutProgram;
  persistTarget?: ExerciseSubstitutionPersistTarget | null;
  onSessionComplete?: (session: WorkoutSession) => void | Promise<void>;
  onProgramPermanentlyUpdated?: (updatedPlan: any) => void;
};

type ActiveWorkoutContextValue = {
  activeWorkout: ActiveWorkoutSnapshot | null;
  startActiveWorkout: (input: StartActiveWorkoutInput) => void;
  updateActiveWorkout: (patch: Partial<ActiveWorkoutSnapshot>) => void;
  presentActiveWorkout: () => void;
  minimizeActiveWorkout: () => void;
  clearActiveWorkout: () => void;
  /** Run + clear the completion handler registered at start. */
  completeActiveWorkout: (session: WorkoutSession) => Promise<void>;
  notifyProgramPermanentlyUpdated: (updatedPlan: any) => void;
};

const ActiveWorkoutContext = createContext<ActiveWorkoutContextValue | null>(null);
const ACTIVE_WORKOUT_STORAGE_KEY = 'activeWorkoutSnapshot';

function buildInitialExerciseData(program: WorkoutProgram): ActiveWorkoutExerciseRow[] {
  return (program.exercises ?? []).map((exercise) => ({
    exerciseId: exercise.id,
    name: exercise.name,
    sets: Array.from({ length: exercise.sets }, (_, index) => ({
      setNumber: index + 1,
      reps: exercise.reps,
      weight: exercise.weight || 0,
      restTime: exercise.restTime,
      completed: false,
    })),
  }));
}

function isValidSnapshot(value: unknown): value is ActiveWorkoutSnapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as ActiveWorkoutSnapshot;
  return Boolean(
    s.program?.id &&
      Array.isArray(s.exerciseData) &&
      typeof s.startTimeIso === 'string' &&
      typeof s.currentExerciseIndex === 'number'
  );
}

async function persistSnapshot(snapshot: ActiveWorkoutSnapshot | null): Promise<void> {
  try {
    await saveUserData(ACTIVE_WORKOUT_STORAGE_KEY, snapshot);
  } catch (error) {
    console.warn('[ActiveWorkout] persist failed', error);
  }
}

export function ActiveWorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutSnapshot | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const onSessionCompleteRef = useRef<
    ((session: WorkoutSession) => void | Promise<void>) | null
  >(null);
  const onProgramPermanentlyUpdatedRef = useRef<((updatedPlan: any) => void) | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipPersistRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadUserData<ActiveWorkoutSnapshot | null>(ACTIVE_WORKOUT_STORAGE_KEY);
        if (!cancelled && isValidSnapshot(stored)) {
          // Resume minimized so user lands on Fitness root with a resume banner.
          setActiveWorkout({ ...stored, isPresented: false });
        }
      } catch (error) {
        console.warn('[ActiveWorkout] hydrate failed', error);
      } finally {
        if (!cancelled) {
          setHydrated(true);
          skipPersistRef.current = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || skipPersistRef.current) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      void persistSnapshot(activeWorkout);
    }, 400);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [activeWorkout, hydrated]);

  const startActiveWorkout = useCallback((input: StartActiveWorkoutInput) => {
    const program = input.program;
    onSessionCompleteRef.current = input.onSessionComplete ?? null;
    onProgramPermanentlyUpdatedRef.current = input.onProgramPermanentlyUpdated ?? null;
    setActiveWorkout({
      program,
      modifiedProgram: null,
      persistTarget: input.persistTarget ?? null,
      exerciseData: buildInitialExerciseData(program),
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      notes: '',
      startTimeIso: new Date().toISOString(),
      isPresented: true,
    });
  }, []);

  const updateActiveWorkout = useCallback((patch: Partial<ActiveWorkoutSnapshot>) => {
    setActiveWorkout((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const presentActiveWorkout = useCallback(() => {
    setActiveWorkout((prev) => (prev ? { ...prev, isPresented: true } : prev));
  }, []);

  const minimizeActiveWorkout = useCallback(() => {
    setActiveWorkout((prev) => (prev ? { ...prev, isPresented: false } : prev));
  }, []);

  const clearActiveWorkout = useCallback(() => {
    onSessionCompleteRef.current = null;
    onProgramPermanentlyUpdatedRef.current = null;
    setActiveWorkout(null);
    void persistSnapshot(null);
  }, []);

  const completeActiveWorkout = useCallback(async (session: WorkoutSession) => {
    const cb = onSessionCompleteRef.current;
    onSessionCompleteRef.current = null;
    onProgramPermanentlyUpdatedRef.current = null;
    setActiveWorkout(null);
    void persistSnapshot(null);
    if (cb) await cb(session);
  }, []);

  const notifyProgramPermanentlyUpdated = useCallback((updatedPlan: any) => {
    onProgramPermanentlyUpdatedRef.current?.(updatedPlan);
  }, []);

  const value = useMemo(
    () => ({
      activeWorkout,
      startActiveWorkout,
      updateActiveWorkout,
      presentActiveWorkout,
      minimizeActiveWorkout,
      clearActiveWorkout,
      completeActiveWorkout,
      notifyProgramPermanentlyUpdated,
    }),
    [
      activeWorkout,
      startActiveWorkout,
      updateActiveWorkout,
      presentActiveWorkout,
      minimizeActiveWorkout,
      clearActiveWorkout,
      completeActiveWorkout,
      notifyProgramPermanentlyUpdated,
    ]
  );

  return (
    <ActiveWorkoutContext.Provider value={value}>{children}</ActiveWorkoutContext.Provider>
  );
}

export function useActiveWorkout(): ActiveWorkoutContextValue {
  const ctx = useContext(ActiveWorkoutContext);
  if (!ctx) {
    throw new Error('useActiveWorkout must be used within ActiveWorkoutProvider');
  }
  return ctx;
}

/** Safe for screens that may render outside the provider during boot. */
export function useActiveWorkoutOptional(): ActiveWorkoutContextValue | null {
  return useContext(ActiveWorkoutContext);
}

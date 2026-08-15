import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import { AppTextInput as TextInput } from './src/components/AppTextInput';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { WorkoutProgram, WorkoutSession, Exercise } from './data/workoutPrograms';
import { useSmallWins } from './src/context/SmallWinsContext';
import { exerciseDatabase, getExerciseData, ExerciseData } from './src/data/exerciseDatabase';
import ExerciseVideoPlayer from './src/components/ExerciseVideoPlayer';
import RestTimerModal, { REST_TIMER_ENABLED_STORAGE_KEY } from './src/components/RestTimerModal';
import StretchHoldTracker from './src/components/StretchHoldTracker';
import ExerciseNamePickerModal from './src/components/workout/ExerciseNamePickerModal';
import { suggestExerciseNames } from './src/utils/exerciseNameMatch';
import {
  persistExerciseSubstitutionInSavedPlan,
  type ExerciseSubstitutionPersistTarget,
} from './src/utils/persistExerciseSubstitution';
import { prefillNumericSetFromPrevious, resolveSetSlotCount } from './src/utils/setLoggingPrefill';
import {
  formatStretchProtocolLabel,
  getStretchProtocol,
  isStretchLoggingExercise,
} from './src/utils/stretchLogging';
import {
  buildSupersetLetterMap,
  findNextSupersetCursor,
  formatSupersetTag,
  getSupersetGroupIndices,
} from './src/utils/workoutSupersets';
import type { ActiveWorkoutSnapshot } from './src/context/ActiveWorkoutContext';
import TrackCardioPromptModal from './src/components/workout/TrackCardioPromptModal';
import type { CardioLog } from './data/workoutPrograms';
import { notifyWorkoutCompleted } from './src/utils/workoutCompleteNotifications';
import DiscomfortAssessmentFlow, {
  DiscomfortReportCTA,
} from './src/components/movement/DiscomfortAssessmentFlow';
import MovementResponseFeedbackModal from './src/components/movement/MovementResponseFeedbackModal';
import { shouldPromptMovementResponseFeedback } from './src/services/MovementFeedbackLoopService';
// HealthService is imported dynamically to avoid errors if expo-health isn't installed
let HealthService: any;
try {
  HealthService = require('./src/services/HealthService').default;
} catch (error) {
  // HealthService not available - will be handled gracefully
  console.warn('HealthService not available:', error);
  HealthService = null;
}

interface ProgramExecutionScreenProps {
  program: WorkoutProgram;
  onBack: () => void;
  onComplete: (session: WorkoutSession) => void;
  /**
   * When set (custom saved plans), offer to permanently write exercise
   * substitutions back into the stored program.
   */
  persistTarget?: ExerciseSubstitutionPersistTarget | null;
  /** Called after a permanent program update succeeds. */
  onProgramPermanentlyUpdated?: (updatedPlan: any) => void;
  /** Restore an in-progress session (keeps workout alive across navigation). */
  resumeSnapshot?: ActiveWorkoutSnapshot | null;
  /** Persist live progress so leaving the screen does not lose the session. */
  onProgressChange?: (patch: Partial<ActiveWorkoutSnapshot>) => void;
}

export default function ProgramExecutionScreen({
  program,
  onBack,
  onComplete,
  persistTarget = null,
  onProgramPermanentlyUpdated,
  resumeSnapshot = null,
  onProgressChange,
}: ProgramExecutionScreenProps) {
  console.log('ProgramExecutionScreen rendered with program:', program);
  const { onWorkoutSessionSaved } = useSmallWins();

  // All hooks must be called in the same order every time
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(
    () => resumeSnapshot?.currentExerciseIndex ?? 0
  );
  const [currentSetIndex, setCurrentSetIndex] = useState(
    () => resumeSnapshot?.currentSetIndex ?? 0
  );
  const [exerciseData, setExerciseData] = useState<Array<{
    exerciseId: string;
    name: string;
    skipped?: boolean;
    sets: Array<{
      setNumber: number;
      reps: number;
      weight: number;
      restTime: number;
      completed: boolean;
      rir?: number;
    }>;
  }>>(() => resumeSnapshot?.exerciseData ?? []);
  const [notes, setNotes] = useState(() => resumeSnapshot?.notes ?? '');
  const [startTime, setStartTime] = useState<Date>(
    () => (resumeSnapshot?.startTimeIso ? new Date(resumeSnapshot.startTimeIso) : new Date())
  );
  const [isFinishingWorkout, setIsFinishingWorkout] = useState(false);
  const finishingWorkoutRef = useRef(false);
  const [cardioPromptVisible, setCardioPromptVisible] = useState(false);
  const [pendingCardio, setPendingCardio] = useState<CardioLog | null>(null);
  const [discomfortVisible, setDiscomfortVisible] = useState(false);
  const [discomfortExerciseName, setDiscomfortExerciseName] = useState<string | null>(null);
  const [movementFeedbackVisible, setMovementFeedbackVisible] = useState(false);
  const [movementFeedbackExercise, setMovementFeedbackExercise] = useState<string | null>(null);
  const pendingFinishCardioRef = useRef<CardioLog | null>(null);
  const [cardioWindowEnd, setCardioWindowEnd] = useState(() => new Date());
  const pendingFinishRef = useRef<{
    data: Array<{
      exerciseId: string;
      name: string;
      skipped?: boolean;
      sets: Array<{
        setNumber: number;
        reps: number;
        weight: number;
        restTime: number;
        completed: boolean;
        rir?: number;
      }>;
    }>;
    notes: string;
  } | null>(null);
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [substitutionExerciseIndex, setSubstitutionExerciseIndex] = useState<number | null>(null);
  const [substitutionAlternatives, setSubstitutionAlternatives] = useState<ExerciseData[]>([]);
  const [modifiedProgram, setModifiedProgram] = useState<WorkoutProgram | null>(
    () => resumeSnapshot?.modifiedProgram ?? null
  );
  const [previousWorkoutData, setPreviousWorkoutData] = useState<Map<string, Array<{ setNumber: number; weight: number; reps: number }>>>(new Map());
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | undefined>(undefined);
  const [healthMetricsEnabled, setHealthMetricsEnabled] = useState(false);
  const [currentHeartRate, setCurrentHeartRate] = useState<number | null>(null);
  const [restTimerEnabled, setRestTimerEnabled] = useState(true);
  const [restModalVisible, setRestModalVisible] = useState(false);
  const [restModalSeconds, setRestModalSeconds] = useState(90);
  const initializedProgramIdRef = useRef<string | null>(
    resumeSnapshot ? program.id : null
  );
  const skipNextProgressSyncRef = useRef(Boolean(resumeSnapshot));
  const onProgressChangeRef = useRef(onProgressChange);
  onProgressChangeRef.current = onProgressChange;

  // Only reset when a different workout program is loaded — not on every parent re-render.
  useEffect(() => {
    if (!program?.id) return;
    if (initializedProgramIdRef.current === program.id) return;
    initializedProgramIdRef.current = program.id;
    setModifiedProgram(null);

    try {
      if (!program.exercises || program.exercises.length === 0) {
        console.error('Invalid program data:', program);
        setExerciseData([]);
        return;
      }

      const initialData = program.exercises.map((exercise) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        sets: Array.from({ length: resolveSetSlotCount(exercise.sets) }, (_, index) => ({
          setNumber: index + 1,
          reps: exercise.reps,
          weight: exercise.weight || 0,
          restTime: exercise.restTime,
          completed: false,
        })),
      }));
      setExerciseData(initialData);
      setCurrentSetIndex(0);
      setCurrentExerciseIndex(0);
      setStartTime(new Date());
      setNotes('');
    } catch (error) {
      console.error('Error initializing exercise data:', error);
      setExerciseData([]);
      setCurrentSetIndex(0);
      setCurrentExerciseIndex(0);
    }
  }, [program]);

  // Keep live progress in the active-workout store so tab switches can resume.
  useEffect(() => {
    if (!onProgressChangeRef.current) return;
    if (skipNextProgressSyncRef.current) {
      skipNextProgressSyncRef.current = false;
      return;
    }
    if (!exerciseData.length) return;
    onProgressChangeRef.current({
      exerciseData,
      currentExerciseIndex,
      currentSetIndex,
      notes,
      startTimeIso: startTime.toISOString(),
      modifiedProgram,
      program,
      persistTarget: persistTarget ?? null,
    });
  }, [
    exerciseData,
    currentExerciseIndex,
    currentSetIndex,
    notes,
    startTime,
    modifiedProgram,
    program,
    persistTarget,
  ]);

  useEffect(() => {
    AsyncStorage.getItem(REST_TIMER_ENABLED_STORAGE_KEY).then((v) => {
      if (v !== null) {
        setRestTimerEnabled(v === 'true');
      }
    });
  }, []);

  // Request health permissions and check availability on mount
  useEffect(() => {
    if (!HealthService) {
      // HealthService not available - skip initialization
      return;
    }

    const initializeHealth = async () => {
      try {
        const hasPermissions = await HealthService.requestPermissions();
        setHealthMetricsEnabled(hasPermissions);
        
        if (hasPermissions) {
          // Start periodic heart rate updates during workout
          const heartRateInterval = setInterval(async () => {
            try {
              const hr = await HealthService.getCurrentHeartRate();
              if (hr !== null) {
                setCurrentHeartRate(hr);
              }
            } catch (error) {
              // Silently fail - heart rate just won't update
              console.warn('Could not fetch heart rate:', error);
            }
          }, 10000); // Update every 10 seconds

          return () => clearInterval(heartRateInterval);
        }
      } catch (error) {
        // Health service not available - fail silently
        console.warn('Health service not available:', error);
        setHealthMetricsEnabled(false);
      }
    };

    initializeHealth();
  }, []);

  // Load previous workout data
  useEffect(() => {
    const loadPreviousWorkoutData = async () => {
      try {
        const { loadUserData } = await import('./src/utils/userStorage');
        const history = await loadUserData<WorkoutSession[]>('workoutHistory') || [];
        
        // Create a map of exercise name -> last performance data
        const previousData = new Map<string, Array<{ setNumber: number; weight: number; reps: number }>>();
        
        // Find the most recent session for this program (match by ID or name)
        const programSessions = history
          .filter(session => 
            session.programId === program.id || 
            session.programName === program.name
          )
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        if (programSessions.length > 0) {
          const lastSession = programSessions[0];
          
          // For each exercise in the current program, find its last performance
          program.exercises.forEach(exercise => {
            const lastExerciseData = lastSession.exercises.find(
              ex => ex.name === exercise.name || ex.exerciseId === exercise.id
            );
            
            if (lastExerciseData && lastExerciseData.sets) {
              const setsData = lastExerciseData.sets
                .filter(set => set.completed)
                .map(set => ({
                  setNumber: set.setNumber,
                  weight: set.weight,
                  reps: set.reps,
                }));
              
              if (setsData.length > 0) {
                previousData.set(exercise.name, setsData);
              }
            }
          });
        }
        
        setPreviousWorkoutData(previousData);
      } catch (error) {
        console.error('Error loading previous workout data:', error);
      }
    };
    
    loadPreviousWorkoutData();
  }, [program.id]);

  // Always use modifiedProgram if it exists, otherwise use the original program prop
  // Safety check - ensure program is valid
  if (!program || !program.exercises) {
    console.error('Invalid program prop in ProgramExecutionScreen:', program);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={{ padding: 20 }}>
          <Text style={{ color: '#fff', fontSize: 16 }}>
            Invalid workout program. Please go back and try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  const currentProgram = modifiedProgram || program;

  // Function to find similar exercises for substitution
  const findSimilarExercises = (exerciseName: string): ExerciseData[] => {
    const currentExercise = getExerciseData(exerciseName);
    const alternatives: ExerciseData[] = [];
    const seenNames = new Set<string>();

    if (currentExercise?.alternatives?.length) {
      currentExercise.alternatives.forEach((altName) => {
        const altExercise = getExerciseData(altName);
        if (altExercise && !seenNames.has(altExercise.name)) {
          alternatives.push(altExercise);
          seenNames.add(altExercise.name);
        }
      });
    }

    // Fuzzy suggestions work even when the logged name isn't in the catalog
    suggestExerciseNames(exerciseName, 10).forEach((s) => {
      if (s.name.toLowerCase() === exerciseName.toLowerCase()) return;
      if (seenNames.has(s.name)) return;
      const entry = getExerciseData(s.name);
      if (entry) {
        alternatives.push(entry);
        seenNames.add(entry.name);
      }
    });

    if (!currentExercise) {
      return alternatives.slice(0, 10);
    }

    exerciseDatabase.forEach((ex) => {
      if (
        ex.name.toLowerCase() !== exerciseName.toLowerCase() &&
        !seenNames.has(ex.name) &&
        ex.primaryMuscleGroup.toLowerCase() === currentExercise.primaryMuscleGroup.toLowerCase() &&
        ex.category === currentExercise.category
      ) {
        alternatives.push(ex);
        seenNames.add(ex.name);
      }
    });

    return alternatives.slice(0, 10);
  };

  const handleSubstituteExercise = (exerciseIndex: number) => {
    const exercise = currentProgram.exercises[exerciseIndex];
    if (!exercise) return;
    const alternatives = findSimilarExercises(exercise.name);
    setSubstitutionExerciseIndex(exerciseIndex);
    setSubstitutionAlternatives(alternatives);
    setShowSubstitutionModal(true);
  };

  /** Apply a substituted name without wiping completed sets / cursor. */
  const handleSelectSubstitutionByName = (nextName: string) => {
    if (substitutionExerciseIndex === null) return;
    const trimmed = nextName.trim();
    if (!trimmed) return;

    const catalog = getExerciseData(trimmed);
    const nextId = catalog?.id ?? `custom-${Date.now()}-${substitutionExerciseIndex}`;
    const idx = substitutionExerciseIndex;
    const oldExerciseName = currentProgram.exercises[idx]?.name ?? 'Exercise';

    setExerciseData((prev) => {
      const next = [...prev];
      if (!next[idx]) return prev;
      next[idx] = {
        ...next[idx],
        name: trimmed,
        exerciseId: nextId,
      };
      return next;
    });

    setModifiedProgram((prev) => {
      const base = prev || program;
      const newExercises = [...base.exercises];
      if (!newExercises[idx]) return prev;
      newExercises[idx] = {
        ...newExercises[idx],
        name: trimmed,
        id: nextId,
      };
      return {
        ...base,
        exercises: newExercises,
      };
    });

    setShowSubstitutionModal(false);
    setSubstitutionExerciseIndex(null);
    setSubstitutionAlternatives([]);

    if (!persistTarget?.planId) {
      Alert.alert(
        'Exercise updated',
        `${oldExerciseName} → ${trimmed} for this session. Your logged sets were kept.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Would you like to permanently implement this exercise?',
      `“${oldExerciseName}” has been changed to “${trimmed}” for this session.\n\nSave it to your program so future workouts use it too?`,
      [
        { text: 'No, this session only', style: 'cancel' },
        {
          text: 'Yes, save permanently',
          onPress: () => {
            void (async () => {
              const result = await persistExerciseSubstitutionInSavedPlan({
                planId: persistTarget.planId,
                weekIndex: persistTarget.weekIndex,
                dayIndex: persistTarget.dayIndex,
                exerciseIndex: idx,
                oldName: oldExerciseName,
                newName: trimmed,
                newExerciseId: nextId,
              });
              if (!result.ok) {
                Alert.alert(
                  'Couldn’t update program',
                  result.error ||
                    'The change still applies to this session. Try editing the plan from Build Your Own Workout.',
                  [{ text: 'OK' }]
                );
                return;
              }
              if (result.updatedPlan && onProgramPermanentlyUpdated) {
                onProgramPermanentlyUpdated(result.updatedPlan);
              }
              Alert.alert(
                'Program updated',
                `“${trimmed}” is saved in your program. This session and future workouts will use it.`,
                [{ text: 'OK' }]
              );
            })();
          },
        },
      ]
    );
  };

  const isWorkoutFullyDone = useCallback(
    (
      data: Array<{
        skipped?: boolean;
        sets: Array<{ completed: boolean }>;
      }>
    ) =>
      data.length > 0 &&
      data.every((exercise) => exercise.skipped || exercise.sets.every((set) => set.completed)),
    []
  );

  /** Save once and leave — no forced check-in or confirmation dialogs. */
  const finishWorkout = useCallback(
    async (
      data: Array<{
        exerciseId: string;
        name: string;
        skipped?: boolean;
        sets: Array<{
          setNumber: number;
          reps: number;
          weight: number;
          restTime: number;
          completed: boolean;
          rir?: number;
        }>;
      }>,
      workoutNotes: string,
      cardio?: CardioLog | null
    ) => {
      if (finishingWorkoutRef.current) return;
      finishingWorkoutRef.current = true;
      setIsFinishingWorkout(true);

      try {
        const endTime = new Date();
        const duration = Math.max(
          1,
          Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60)
        );

        const completedExercises = data
          .filter((exercise) => exercise.skipped || exercise.sets.some((set) => set.completed))
          .map((exercise) => ({
            exerciseId: exercise.exerciseId,
            name: exercise.name,
            sets: exercise.skipped ? [] : exercise.sets.filter((set) => set.completed),
          }));

        let healthMetrics;
        if (healthMetricsEnabled && HealthService) {
          try {
            healthMetrics = await HealthService.getWorkoutMetrics(startTime, endTime);
          } catch (error) {
            console.error('Error fetching health metrics:', error);
          }
        }

        const cardioMin =
          cardio && cardio.durationMin > 0 ? Math.round(cardio.durationMin) : 0;
        const session: WorkoutSession = {
          id: Date.now().toString(),
          programId: currentProgram.id,
          programName: currentProgram.name,
          date: startTime.toISOString(),
          duration: duration + cardioMin,
          exercises: completedExercises,
          notes: workoutNotes,
          completed: true,
          healthMetrics,
          cardio: cardio && cardio.durationMin > 0 ? cardio : undefined,
        };

        try {
          const { appendCompletedWorkoutSession } = await import(
            './src/utils/workoutHistoryStorage'
          );
          const { notifyUserDataReady } = await import('./src/utils/userDataEvents');
          await appendCompletedWorkoutSession(session, { notify: false });

          try {
            await onWorkoutSessionSaved(session);
          } catch (e) {
            console.warn('Small wins hook:', e);
          }

          // After history + milestones are written, refresh Progress / Fitness.
          notifyUserDataReady();
        } catch (error) {
          console.error('Error saving workout history:', error);
        }

        void notifyWorkoutCompleted({
          programName: currentProgram.name,
          duration: session.duration,
          exerciseCount: completedExercises.length,
        });

        onComplete(session);
      } catch (error) {
        console.error('Error finishing workout:', error);
        finishingWorkoutRef.current = false;
        setIsFinishingWorkout(false);
        Alert.alert('Could not save workout', 'Please try Finish Workout again.');
      }
    },
    [currentProgram, healthMetricsEnabled, onComplete, onWorkoutSessionSaved, startTime]
  );

  const promptThenFinish = useCallback(
    (
      data: Array<{
        exerciseId: string;
        name: string;
        skipped?: boolean;
        sets: Array<{
          setNumber: number;
          reps: number;
          weight: number;
          restTime: number;
          completed: boolean;
          rir?: number;
        }>;
      }>,
      workoutNotes: string
    ) => {
      if (finishingWorkoutRef.current) return;
      pendingFinishRef.current = { data, notes: workoutNotes };
      setCardioWindowEnd(new Date(Date.now() + 30 * 60 * 1000));
      setCardioPromptVisible(true);
    },
    []
  );

  const commitPendingFinish = useCallback(
    (cardio: CardioLog | null) => {
      const pending = pendingFinishRef.current;
      setCardioPromptVisible(false);
      if (!pending) return;
      pendingFinishCardioRef.current = cardio;
      void (async () => {
        try {
          const shouldAsk = await shouldPromptMovementResponseFeedback();
          if (shouldAsk) {
            const names = pending.data
              .filter((ex) => ex.skipped || ex.sets.some((s) => s.completed))
              .map((ex) => ex.name);
            setMovementFeedbackExercise(
              names[names.length - 1] ??
                exerciseData[currentExerciseIndex]?.name ??
                null
            );
            setMovementFeedbackVisible(true);
            return;
          }
        } catch (e) {
          console.warn('[ProgramExecution] movement feedback gate failed', e);
        }
        pendingFinishRef.current = null;
        void finishWorkout(pending.data, pending.notes, cardio);
      })();
    },
    [currentExerciseIndex, exerciseData, finishWorkout]
  );

  const completeMovementFeedbackAndFinish = useCallback(() => {
    const pending = pendingFinishRef.current;
    const cardio = pendingFinishCardioRef.current;
    setMovementFeedbackVisible(false);
    pendingFinishRef.current = null;
    pendingFinishCardioRef.current = null;
    if (!pending) return;
    void finishWorkout(pending.data, pending.notes, cardio);
  }, [finishWorkout]);

  const handleSetComplete = (
    exerciseIndex: number,
    setIndex: number,
    weight: number,
    reps: number,
    rir?: number
  ) => {
    if (finishingWorkoutRef.current) return;

    const newData = [...exerciseData];
    newData[exerciseIndex].sets[setIndex] = {
      ...newData[exerciseIndex].sets[setIndex],
      weight,
      reps,
      completed: true,
      ...(rir != null && Number.isFinite(rir) ? { rir } : {}),
    };
    const restSec = isStretchLoggingExercise(currentProgram.exercises[exerciseIndex] ?? {})
      ? 0
      : Math.max(0, newData[exerciseIndex].sets[setIndex].restTime ?? 90);

    const next = findNextSupersetCursor(
      currentProgram.exercises,
      newData,
      exerciseIndex,
      setIndex
    );

    if (next) {
      newData[next.exerciseIndex] = {
        ...newData[next.exerciseIndex],
        sets: prefillNumericSetFromPrevious(newData[next.exerciseIndex].sets, next.setIndex),
      };
      setExerciseData(newData);
      setCurrentExerciseIndex(next.exerciseIndex);
      setCurrentSetIndex(next.setIndex);
    } else {
      setExerciseData(newData);
    }

    // Last set of the day: stay on this set and show Done. Auto-opening
    // the cardio sheet used to swallow the Done/Finish tap.

    if (restTimerEnabled && next != null && restSec > 0) {
      setRestModalSeconds(restSec);
      setRestModalVisible(true);
    }
  };

  const handleExerciseComplete = () => {
    const currentExerciseSets = exerciseData[currentExerciseIndex]?.sets || [];
    const allSetsCompleted = currentExerciseSets.every((set) => set.completed);
    const ssId = currentProgram.exercises[currentExerciseIndex]?.supersetId;

    if (ssId) {
      const group = getSupersetGroupIndices(currentProgram.exercises, currentExerciseIndex);
      const groupDone = group.every((gi) =>
        (exerciseData[gi]?.sets || []).every((s) => s.completed)
      );
      if (!groupDone) {
        Alert.alert(
          'Finish the superset',
          'Complete one set of each exercise in the superset (round-robin) before moving on.'
        );
        return;
      }
      const after = group[group.length - 1] + 1;
      if (after < currentProgram.exercises.length) {
        setCurrentExerciseIndex(after);
        setCurrentSetIndex(0);
      } else if (isWorkoutFullyDone(exerciseData)) {
        promptThenFinish(exerciseData, notes);
      }
      return;
    }

    if (!allSetsCompleted) {
      Alert.alert('Complete All Sets', 'Please complete all sets for this exercise before moving to the next one.');
      return;
    }

    if (currentExerciseIndex < currentProgram.exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      resetInputsForNextExercise();
    } else if (isWorkoutFullyDone(exerciseData)) {
      promptThenFinish(exerciseData, notes);
    }
  };

  const handleFinishWorkoutPress = () => {
    if (finishingWorkoutRef.current) return;
    const hasProgress = exerciseData.some(
      (exercise) => exercise.skipped || exercise.sets.some((set) => set.completed)
    );
    if (!hasProgress) {
      Alert.alert('Nothing to log', 'Complete or skip at least one exercise first.');
      return;
    }
    if (isWorkoutFullyDone(exerciseData)) {
      // Re-open the cardio sheet if it was dismissed — never no-op.
      promptThenFinish(exerciseData, notes);
      return;
    }
    Alert.alert(
      'Finish workout?',
      'Remaining incomplete exercises will not be logged as complete sets.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Log workout',
          style: 'default',
          onPress: () => {
            promptThenFinish(exerciseData, notes);
          },
        },
      ]
    );
  };

  const goToSet = (exerciseIndex: number, setIndex: number) => {
    setExerciseData((prev) => {
      const next = [...prev];
      next[exerciseIndex] = {
        ...next[exerciseIndex],
        sets: prefillNumericSetFromPrevious(next[exerciseIndex].sets, setIndex),
      };
      return next;
    });
    setCurrentSetIndex(setIndex);
  };

  const handleNavigateToExercise = (index: number) => {
    setCurrentExerciseIndex(index);
    const exercise = exerciseData[index];
    if (exercise && exercise.sets.length > 0) {
      const firstIncompleteSet = exercise.sets.findIndex((set) => !set.completed);
      const targetSet = firstIncompleteSet >= 0 ? firstIncompleteSet : 0;
      goToSet(index, targetSet);
    } else {
      setCurrentSetIndex(0);
    }
  };

  const handleEditSet = (exerciseIndex: number, setIndex: number) => {
    const newData = [...exerciseData];
    newData[exerciseIndex].sets[setIndex] = {
      ...newData[exerciseIndex].sets[setIndex],
      completed: false,
    };
    setExerciseData(newData);
  };

  const resetInputsForNextExercise = () => {
    // Reset all sets for the next exercise to default values
    setExerciseData(prev => prev.map((exercise, index) => {
      if (index === currentExerciseIndex + 1) {
        return {
          ...exercise,
          sets: exercise.sets.map((set, setIndex) => ({
            setNumber: setIndex + 1,
            reps: (exercise as any).reps,
            weight: 0,
            restTime: (exercise as any).restTime || 60,
            completed: false
          }))
        };
      }
      return exercise;
    }));
    // Reset to first set of next exercise
    setCurrentSetIndex(0);
  };

  const handleSkipExercise = () => {
    Alert.alert(
      'Skip Exercise',
      'Are you sure you want to skip this exercise? You can still complete the workout.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Skip',
          onPress: () => {
            const newData = [...exerciseData];
            newData[currentExerciseIndex] = {
              ...newData[currentExerciseIndex],
              skipped: true,
            };
            setExerciseData(newData);

            if (isWorkoutFullyDone(newData)) {
              promptThenFinish(newData, notes);
              return;
            }

            // Move within / past superset when possible
            if (currentExerciseIndex < currentProgram.exercises.length - 1) {
              const next = findNextSupersetCursor(
                currentProgram.exercises,
                newData,
                currentExerciseIndex,
                Math.max(0, (newData[currentExerciseIndex]?.sets?.length ?? 1) - 1)
              );
              if (next) {
                setCurrentExerciseIndex(next.exerciseIndex);
                setCurrentSetIndex(next.setIndex);
              } else {
                const group = getSupersetGroupIndices(
                  currentProgram.exercises,
                  currentExerciseIndex
                );
                const after = group[group.length - 1] + 1;
                if (after < currentProgram.exercises.length) {
                  setCurrentExerciseIndex(after);
                  setCurrentSetIndex(0);
                }
              }
            }
          },
        },
      ]
    );
  };

  const getCompletionRate = () => {
    const totalSets = exerciseData.reduce((acc, exercise) => acc + exercise.sets.length, 0);
    const completedSets = exerciseData.reduce((acc, exercise) => 
      acc + exercise.sets.filter(set => set.completed).length, 0
    );
    return Math.round((completedSets / totalSets) * 100);
  };

  // All hooks must be called before any conditional returns
  // currentProgram is already defined above
  const currentExercise = currentProgram?.exercises?.[currentExerciseIndex];
  const currentExerciseData = exerciseData[currentExerciseIndex];


  // Safety checks - must be after all hooks
  if (!program || !currentExercise || !currentExerciseData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to load workout program</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.retryButtonText}>←</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{program.name}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <Text style={styles.progressText}>{getCompletionRate()}% Complete</Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${getCompletionRate()}%` }
            ]} 
          />
        </View>
        {/* Real-time Heart Rate Display */}
        {healthMetricsEnabled && currentHeartRate && (
          <View style={styles.heartRateDisplay}>
            <Text style={styles.heartRateLabel}>Heart Rate</Text>
            <Text style={styles.heartRateValue}>{currentHeartRate} bpm</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Current Exercise */}
        <View style={styles.currentExercise}>
          <View style={styles.exerciseTitleRow}>
            <Text style={styles.exerciseTitle}>{currentExercise.name}</Text>
            <View style={styles.exerciseActionButtons}>
              {(() => {
                const exerciseInfo = getExerciseData(currentExercise.name);
                if (exerciseInfo?.videoUrl) {
                  return (
                    <TouchableOpacity
                      style={styles.videoButton}
                      onPress={() => {
                        setCurrentVideoUrl(exerciseInfo.videoUrl);
                        setShowVideoModal(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Play exercise video"
                    >
                      <Text style={styles.videoButtonText}>▶</Text>
                    </TouchableOpacity>
                  );
                }
                return null;
              })()}
            </View>
          </View>
          <TouchableOpacity
            style={styles.substituteButton}
            onPress={() => handleSubstituteExercise(currentExerciseIndex)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Change exercise"
          >
            <Text style={styles.substituteButtonText}>Change exercise</Text>
          </TouchableOpacity>
          {currentExercise.supersetId ? (
            <Text style={styles.supersetBanner}>
              {(() => {
                const letters = buildSupersetLetterMap(currentProgram.exercises);
                const tag = formatSupersetTag(
                  letters.get(currentExerciseIndex),
                  currentExercise.supersetOrder ?? 0
                );
                const group = getSupersetGroupIndices(currentProgram.exercises, currentExerciseIndex);
                return `Superset ${tag ?? ''} · set ${currentSetIndex + 1} · ${group.length} moves (alternate)`;
              })()}
            </Text>
          ) : null}
          {currentExercise.durationSeconds != null &&
            currentExercise.durationSeconds > 0 &&
            !isStretchLoggingExercise(currentExercise) && (
            <Text style={styles.warmupDurationHint}>
              {currentExercise.durationSeconds} sec — go slow, feel the muscles engage
            </Text>
          )}
          {currentExercise.instructions && (
          <Text style={styles.exerciseInstructions}>{currentExercise.instructions}</Text>
          )}
          {!isStretchLoggingExercise(currentExercise) && (
          <View style={styles.restTimerRow}>
            <Text style={styles.restTimerLabel}>Rest timer</Text>
            <Switch
              value={restTimerEnabled}
              onValueChange={(v) => {
                setRestTimerEnabled(v);
                AsyncStorage.setItem(REST_TIMER_ENABLED_STORAGE_KEY, v ? 'true' : 'false');
              }}
              trackColor={{ false: '#444', true: '#006644' }}
              thumbColor={restTimerEnabled ? '#00ff88' : '#888'}
            />
          </View>
          )}
          
          {/* Show only current set */}
          {currentExerciseData?.skipped ? (
            <View style={styles.skippedExerciseContainer}>
              <Text style={styles.skippedExerciseText}>This exercise was skipped</Text>
              <TouchableOpacity
                style={styles.unskipButton}
                onPress={() => {
                  const newData = [...exerciseData];
                  newData[currentExerciseIndex] = {
                    ...newData[currentExerciseIndex],
                    skipped: false,
                  };
                  setExerciseData(newData);
                  setCurrentSetIndex(0);
                }}
              >
                <Text style={styles.unskipButtonText}>Undo Skip</Text>
              </TouchableOpacity>
            </View>
          ) : currentExerciseData?.sets && currentExerciseData.sets.length > 0 ? (
            <>
              {currentSetIndex < currentExerciseData.sets.length ? (
                (() => {
                  const stretchProtocol = getStretchProtocol(currentExercise);
                  if (stretchProtocol) {
                    return (
                      <StretchHoldTracker
                        key={`stretch-${currentExerciseIndex}-${currentSetIndex}`}
                        protocol={stretchProtocol}
                        roundIndex={currentSetIndex}
                        completed={Boolean(currentExerciseData.sets[currentSetIndex]?.completed)}
                        onComplete={() => {
                          const loggedSecs =
                            stretchProtocol.kind === 'hold'
                              ? stretchProtocol.holdSeconds
                              : stretchProtocol.workSeconds;
                          handleSetComplete(
                            currentExerciseIndex,
                            currentSetIndex,
                            0,
                            loggedSecs
                          );
                        }}
                        onFinishWorkout={
                          isWorkoutFullyDone(exerciseData) ? handleFinishWorkoutPress : undefined
                        }
                        onEdit={() => handleEditSet(currentExerciseIndex, currentSetIndex)}
                        onPrevious={() => {
                          if (currentSetIndex > 0) {
                            goToSet(currentExerciseIndex, currentSetIndex - 1);
                          }
                        }}
                        onNext={() => {
                          if (currentSetIndex < currentExerciseData.sets.length - 1) {
                            goToSet(currentExerciseIndex, currentSetIndex + 1);
                          }
                        }}
                        canGoPrevious={currentSetIndex > 0}
                        canGoNext={currentSetIndex < currentExerciseData.sets.length - 1}
                      />
                    );
                  }
                  return (
                <SetTracker
                  key={currentSetIndex}
                  set={currentExerciseData.sets[currentSetIndex]}
                  setIndex={currentSetIndex}
                  totalSets={currentExerciseData.sets.length}
                  targetRepsLabel={currentExercise.repsPrescription}
                  onFinishWorkout={
                    isWorkoutFullyDone(exerciseData) ? handleFinishWorkoutPress : undefined
                  }
                  onComplete={(weight, reps, rir) =>
                    handleSetComplete(currentExerciseIndex, currentSetIndex, weight, reps, rir)
                  }
                  onEdit={() => handleEditSet(currentExerciseIndex, currentSetIndex)}
                  onPrevious={() => {
                    if (currentSetIndex > 0) {
                      goToSet(currentExerciseIndex, currentSetIndex - 1);
                    }
                  }}
                  onNext={() => {
                    if (currentSetIndex < currentExerciseData.sets.length - 1) {
                      goToSet(currentExerciseIndex, currentSetIndex + 1);
                    }
                  }}
                  canGoPrevious={currentSetIndex > 0}
                  canGoNext={currentSetIndex < currentExerciseData.sets.length - 1}
                  previousSetData={previousWorkoutData.get(currentExerciseData.name)?.find(s => s.setNumber === currentExerciseData.sets[currentSetIndex].setNumber)}
                />
                  );
                })()
              ) : null}
              
              {/* Set Navigation — strength only (stretch has its own round nav) */}
              {currentExerciseData.sets.length > 1 && !isStretchLoggingExercise(currentExercise) && (
                <View style={styles.setNavigation}>
                  <TouchableOpacity
                    style={[styles.setNavButton, !(currentSetIndex > 0) && styles.setNavButtonDisabled]}
                    onPress={() => {
                      if (currentSetIndex > 0) {
                        goToSet(currentExerciseIndex, currentSetIndex - 1);
                      }
                    }}
                    disabled={currentSetIndex === 0}
                  >
                    <Text style={styles.setNavButtonText}>← Previous Set</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.setNavButton, !(currentSetIndex < currentExerciseData.sets.length - 1) && styles.setNavButtonDisabled]}
                    onPress={() => {
                      if (currentSetIndex < currentExerciseData.sets.length - 1) {
                        goToSet(currentExerciseIndex, currentSetIndex + 1);
                      }
                    }}
                    disabled={currentSetIndex >= currentExerciseData.sets.length - 1}
                  >
                    <Text style={styles.setNavButtonText}>Next Set →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Exercise completion status */}
              {(() => {
                const completedSets = currentExerciseData.sets.filter(set => set.completed).length;
                const allSetsCompleted = currentExerciseData.sets.every(set => set.completed);
                const stretch = isStretchLoggingExercise(currentExercise);
                
                return (
                  <View style={styles.exerciseProgressInfo}>
                    <Text style={styles.exerciseProgressText}>
                      {stretch
                        ? `${completedSets} of ${currentExerciseData.sets.length} holds completed`
                        : `${completedSets} of ${currentExerciseData.sets.length} sets completed`}
                    </Text>
                    {allSetsCompleted && (
                      <Text style={styles.allSetsCompletedText}>
                        {stretch ? '✓ Stretch complete!' : '✓ All sets completed!'}
                      </Text>
                    )}
                  </View>
                );
              })()}
            </>
          ) : null}

          {/* Nav / finish actions */}
          {(() => {
            const currentExerciseSets = exerciseData[currentExerciseIndex]?.sets || [];
            const allSetsCompleted = currentExerciseSets.every((set) => set.completed);
            const hasSets = currentExerciseSets.length > 0;
            const isLastExercise = currentExerciseIndex >= currentProgram.exercises.length - 1;
            const showNext =
              (allSetsCompleted && hasSets && !isLastExercise) ||
              !!exerciseData[currentExerciseIndex]?.skipped;

            if (!showNext) return null;
            return (
              <TouchableOpacity
                style={styles.nextExerciseButton}
                onPress={handleExerciseComplete}
              >
                <Text style={styles.nextExerciseButtonText}>Next Exercise</Text>
              </TouchableOpacity>
            );
          })()}

          {/* Skip Exercise Button */}
          {!currentExerciseData?.skipped && (
            <TouchableOpacity
              style={styles.skipExerciseButton}
              onPress={handleSkipExercise}
            >
              <Text style={styles.skipExerciseButtonText}>Skip Exercise</Text>
            </TouchableOpacity>
          )}

          <DiscomfortReportCTA
            label="Something doesn't feel right?"
            onPress={() => {
              setDiscomfortExerciseName(currentExercise?.name ?? null);
              setDiscomfortVisible(true);
            }}
          />
        </View>

        {/* Exercise List */}
        <View style={styles.exerciseList}>
          <Text style={styles.exerciseListTitle}>All Exercises</Text>
          <Text style={styles.exerciseListHint}>Tap any exercise to navigate to it</Text>
          {(() => {
            const letters = buildSupersetLetterMap(currentProgram?.exercises ?? []);
            return currentProgram?.exercises?.map((exercise, index) => {
            const exerciseSets = exerciseData[index]?.sets || [];
            const completedSets = exerciseSets.filter(set => set.completed).length;
            const allSetsCompleted = exerciseSets.length > 0 && exerciseSets.every(set => set.completed);
            const isSkipped = exerciseData[index]?.skipped || false;
            const ssTag = formatSupersetTag(
              letters.get(index),
              exercise.supersetOrder ?? (exercise.supersetId ? 0 : undefined)
            );
            
            return (
              <TouchableOpacity
                key={exercise.id || `ex-${index}-${exercise.name}`}
                style={[
                  styles.exerciseItem,
                  index === currentExerciseIndex && styles.exerciseItemCurrent,
                  isSkipped && styles.exerciseItemSkipped,
                  !!exercise.supersetId && styles.exerciseItemSuperset,
                ]}
                onPress={() => handleNavigateToExercise(index)}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.exerciseStatus,
                    isSkipped && styles.exerciseSkipped,
                    allSetsCompleted && !isSkipped && styles.exerciseCompleted,
                    index === currentExerciseIndex &&
                      !allSetsCompleted &&
                      !isSkipped &&
                      styles.exerciseCurrent,
                  ]}
                >
                  <Text
                    style={[
                      styles.exerciseStatusText,
                      isSkipped && styles.exerciseStatusTextSkipped,
                      allSetsCompleted && !isSkipped && styles.exerciseStatusTextCompleted,
                      index === currentExerciseIndex &&
                        !allSetsCompleted &&
                        !isSkipped &&
                        styles.exerciseStatusTextCurrent,
                    ]}
                  >
                    {isSkipped
                      ? '⊘'
                      : allSetsCompleted
                        ? '✓'
                        : index === currentExerciseIndex
                          ? '→'
                          : '○'}
                  </Text>
                </View>

                <View style={styles.exerciseInfo}>
                  <Text
                    style={[styles.exerciseName, isSkipped && styles.exerciseNameSkipped]}
                    numberOfLines={2}
                  >
                    {ssTag ? `${ssTag} · ` : ''}
                    {exercise.name}
                    {isSkipped ? ' (Skipped)' : ''}
                  </Text>
                  <Text style={[styles.exerciseSets, isSkipped && styles.exerciseSetsSkipped]}>
                    {(() => {
                      const protocol = getStretchProtocol(exercise);
                      if (protocol) return formatStretchProtocolLabel(protocol);
                      if (exercise.durationSeconds != null && exercise.durationSeconds > 0) {
                        return `1 set • ${exercise.durationSeconds} sec`;
                      }
                      const setsLabel = exercise.setsPrescription || exercise.sets;
                      const repsLabel = exercise.repsPrescription || exercise.reps;
                      return `${setsLabel} sets • ${repsLabel} reps`;
                    })()}
                  </Text>
                  {!isSkipped && exerciseSets.length > 0 ? (
                    <Text style={styles.exerciseProgress}>
                      {isStretchLoggingExercise(exercise)
                        ? `${completedSets}/${exerciseSets.length} holds`
                        : `${completedSets}/${exerciseSets.length} sets completed`}
                    </Text>
                  ) : null}
                </View>

                {!isSkipped ? (
                  <TouchableOpacity
                    style={styles.substituteButtonSmall}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleSubstituteExercise(index);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Change ${exercise.name}`}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <Text style={styles.substituteButtonTextSmall}>Change</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.substituteButtonSpacer} />
                )}
              </TouchableOpacity>
            );
          }) || null;
          })()}
        </View>

        {/* Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>Workout Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="How did this workout feel? Any notes..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
          <DiscomfortReportCTA
            label="Something doesn't feel right?"
            onPress={() => {
              setDiscomfortExerciseName(currentExercise?.name ?? null);
              setDiscomfortVisible(true);
            }}
          />
        </View>
      </ScrollView>

      {(() => {
        const hasProgress = exerciseData.some(
          (exercise) => exercise.skipped || exercise.sets.some((set) => set.completed)
        );
        if (!hasProgress && !isFinishingWorkout) return null;
        const allDone = isWorkoutFullyDone(exerciseData);
        return (
          <View style={styles.stickyFinishBar}>
            {isFinishingWorkout ? (
              <View style={styles.doneWorkoutButton}>
                <Text style={styles.doneWorkoutButtonText}>Saving workout…</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.doneWorkoutButton}
                  onPress={handleFinishWorkoutPress}
                  accessibilityRole="button"
                  accessibilityLabel={allDone ? 'Done' : 'Finish workout'}
                >
                  <Text style={styles.doneWorkoutButtonText}>
                    {allDone ? 'Done' : 'Finish Workout'}
                  </Text>
                </TouchableOpacity>
                {allDone ? (
                  <DiscomfortReportCTA
                    compact
                    label="Report discomfort"
                    onPress={() => {
                      setDiscomfortExerciseName(currentExercise?.name ?? null);
                      setDiscomfortVisible(true);
                    }}
                  />
                ) : null}
              </>
            )}
          </View>
        );
      })()}

      <DiscomfortAssessmentFlow
        visible={discomfortVisible}
        exerciseName={discomfortExerciseName}
        onClose={() => setDiscomfortVisible(false)}
      />

      <RestTimerModal
        visible={restModalVisible}
        seconds={restModalSeconds}
        onDismiss={() => setRestModalVisible(false)}
      />

      {/* Exercise Video Modal */}
      <ExerciseVideoPlayer
        visible={showVideoModal}
        exerciseName={currentExercise?.name || ''}
        videoUrl={currentVideoUrl}
        onClose={() => {
          setShowVideoModal(false);
          setCurrentVideoUrl(undefined);
        }}
      />

      {/* Exercise Substitution Modal — full catalog search so changes always stick */}
      {substitutionExerciseIndex !== null ? (
        <ExerciseNamePickerModal
          visible={showSubstitutionModal}
          rawName={currentProgram.exercises[substitutionExerciseIndex]?.name ?? ''}
          currentName={currentProgram.exercises[substitutionExerciseIndex]?.name ?? ''}
          suggestions={substitutionAlternatives.map((a) => a.name)}
          contextHint={`Replace: ${currentProgram.exercises[substitutionExerciseIndex]?.name ?? 'exercise'}`}
          saveLabel="Save exercise"
          onClose={() => {
            setShowSubstitutionModal(false);
            setSubstitutionExerciseIndex(null);
            setSubstitutionAlternatives([]);
          }}
          onSelect={(name) => {
            handleSelectSubstitutionByName(name);
          }}
        />
      ) : null}

      <TrackCardioPromptModal
        visible={cardioPromptVisible}
        value={pendingCardio}
        onChange={setPendingCardio}
        windowStart={startTime}
        windowEnd={cardioWindowEnd}
        workoutSummary={{
          name: currentProgram.name,
          exerciseNames: exerciseData
            .filter((ex) => ex.skipped || ex.sets.some((s) => s.completed))
            .map((ex) => ex.name),
          durationMin: Math.max(
            1,
            Math.round((Date.now() - startTime.getTime()) / 1000 / 60)
          ),
        }}
        onDismiss={() => setCardioPromptVisible(false)}
        onSkip={() => commitPendingFinish(null)}
        onSave={() => commitPendingFinish(pendingCardio)}
        onReportDiscomfort={() => {
          setDiscomfortExerciseName(currentExercise?.name ?? null);
          setDiscomfortVisible(true);
        }}
      />

      <MovementResponseFeedbackModal
        visible={movementFeedbackVisible}
        exerciseName={movementFeedbackExercise}
        onClose={completeMovementFeedbackAndFinish}
        onDone={completeMovementFeedbackAndFinish}
      />
    </SafeAreaView>
  );
}

interface SetTrackerProps {
  set: {
    setNumber: number;
    reps: number;
    weight: number;
    restTime: number;
    completed: boolean;
    rir?: number;
  };
  setIndex: number;
  totalSets: number;
  onComplete: (weight: number, reps: number, rir?: number) => void;
  onFinishWorkout?: () => void;
  onEdit?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  targetRepsLabel?: string;
  previousSetData?: {
    setNumber: number;
    weight: number;
    reps: number;
  };
}

const SetTracker = ({ set, setIndex, totalSets, onComplete, onEdit, onPrevious, onNext, canGoPrevious, canGoNext, previousSetData, targetRepsLabel, onFinishWorkout }: SetTrackerProps) => {
  // All hooks must be called before any conditional returns
  const [weight, setWeight] = useState(() => {
    const weightValue = set?.weight;
    return weightValue !== undefined && weightValue !== null ? weightValue.toString() : '0';
  });
  const [reps, setReps] = useState(() => {
    const repsValue = set?.reps;
    return repsValue !== undefined && repsValue !== null ? repsValue.toString() : '0';
  });
  const [rirText, setRirText] = useState(() =>
    set?.rir != null && set.rir >= 0 ? String(set.rir) : ''
  );
  const [weightFocused, setWeightFocused] = useState(false);
  const [repsFocused, setRepsFocused] = useState(false);

  // Update state when set data changes
  useEffect(() => {
    if (set) {
      const weightValue = set.weight;
      const repsValue = set.reps;
      
      if (weightValue !== undefined && weightValue !== null) {
        setWeight(weightValue.toString());
      }
      if (repsValue !== undefined && repsValue !== null) {
        setReps(repsValue.toString());
      }
    }
  }, [set?.weight, set?.reps, set?.rir]);

  const handleWeightChange = (text: string) => {
    if (text === '0' && weightFocused) {
      setWeight('');
    } else {
      setWeight(text);
    }
  };

  const handleRepsChange = (text: string) => {
    if (text === '0' && repsFocused) {
      setReps('');
    } else {
      setReps(text);
    }
  };

  const handleWeightFocus = () => {
    setWeightFocused(true);
    if (weight === '0') {
      setWeight('');
    }
  };

  const handleRepsFocus = () => {
    setRepsFocused(true);
    if (reps === '0') {
      setReps('');
    }
  };

  const handleWeightBlur = () => {
    setWeightFocused(false);
    if (weight === '') {
      setWeight('0');
    }
  };

  const handleRepsBlur = () => {
    setRepsFocused(false);
    if (reps === '') {
      setReps('0');
    }
  };

  const handleComplete = () => {
    if (!weight || !reps) {
      Alert.alert('Error', 'Please enter weight and reps');
      return;
    }
    const weightNum = parseInt(weight) || 0;
    const repsNum = parseInt(reps) || 0;
    const t = rirText.trim();
    let rir: number | undefined;
    if (t.length > 0) {
      const n = parseInt(t, 10);
      if (!Number.isFinite(n) || n < 0 || n > 6) {
        Alert.alert('RIR', 'Enter reps in reserve from 0–6, or leave blank.');
        return;
      }
      rir = n;
    }
    onComplete(weightNum, repsNum, rir);
  };

  // Conditional rendering after all hooks
  if (!set) {
    return null;
  }

  // Safety check for set properties
  if (set.weight === undefined || set.reps === undefined) {
    return null;
  }

  return (
    <View style={[styles.setTracker, set.completed && styles.setCompleted]}>
      <Text style={styles.setNumber}>Set {set.setNumber} of {totalSets}</Text>
      
      <View style={styles.setInputs}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Weight (lbs)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="0"
            value={weight}
            onChangeText={handleWeightChange}
            onFocus={handleWeightFocus}
            onBlur={handleWeightBlur}
            editable={true}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Reps</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder={set.reps.toString()}
            value={reps}
            onChangeText={handleRepsChange}
            onFocus={handleRepsFocus}
            onBlur={handleRepsBlur}
            editable={true}
          />
          {targetRepsLabel && String(targetRepsLabel).includes('-') ? (
            <Text style={styles.rirHint}>Target: {targetRepsLabel} reps</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rirRow}>
        <Text style={styles.inputLabel}>RIR (optional)</Text>
        <Text style={styles.rirHint}>Reps left in the tank — 0 = very hard, 4 = several left</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="—"
          value={rirText}
          onChangeText={setRirText}
          editable={true}
        />
      </View>

      {/* Previous Workout Data */}
      {previousSetData && (
        <View style={styles.previousWorkoutContainer}>
          <Text style={styles.previousWorkoutLabel}>Last time:</Text>
          <Text style={styles.previousWorkoutText}>
            {previousSetData.weight} lbs × {previousSetData.reps} reps
          </Text>
        </View>
      )}

      {!set.completed ? (
        <TouchableOpacity 
          style={styles.completeSetButton} 
          onPress={handleComplete}
        >
          <Text style={styles.completeSetButtonText}>Complete Set</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.completedSetContainer}>
          {onFinishWorkout ? (
            <TouchableOpacity
              style={styles.completeSetButton}
              onPress={onFinishWorkout}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.completeSetButtonText}>Done</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.completedSet}>
              <Text style={styles.completedSetText}>✓ DONE</Text>
            </View>
          )}
          {onEdit && (
            <TouchableOpacity style={styles.editSetButton} onPress={onEdit}>
              <Text style={styles.editSetButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#00ff88',
    fontSize: 22,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  progressSection: {
    padding: 20,
    backgroundColor: '#2a2a2a',
    marginBottom: 20,
  },
  progressText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00ff88',
    borderRadius: 4,
  },
  heartRateDisplay: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  heartRateLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  heartRateValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ff88',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  currentExercise: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
  },
  exerciseTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  supersetBanner: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00ff88',
    marginBottom: 12,
    marginTop: 4,
  },
  exerciseInstructions: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  warmupDurationHint: {
    fontSize: 14,
    color: '#00ff88',
    marginBottom: 12,
  },
  setTracker: {
    backgroundColor: '#3a3a3a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#4a4a4a',
  },
  setCompleted: {
    backgroundColor: '#2a4a2a',
    borderColor: '#00ff88',
  },
  setNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  setInputs: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  rirRow: {
    width: '100%',
    marginBottom: 15,
  },
  rirHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  previousWorkoutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  previousWorkoutLabel: {
    fontSize: 12,
    color: '#888',
    marginRight: 6,
  },
  previousWorkoutText: {
    fontSize: 14,
    color: '#00ff88',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#4a4a4a',
  },
  completeSetButton: {
    backgroundColor: '#00ff88',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  completeSetButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  completedSetContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  completedSet: {
    flex: 1,
    backgroundColor: '#00ff88',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  completedSetText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  editSetButton: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  editSetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00ff88',
  },
  finishWorkoutButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  finishWorkoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00ff88',
  },
  setNavigation: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
    marginBottom: 10,
  },
  setNavButton: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  setNavButtonDisabled: {
    opacity: 0.3,
  },
  setNavButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00ff88',
  },
  exerciseProgressInfo: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  exerciseProgressText: {
    fontSize: 14,
    color: '#888',
  },
  allSetsCompletedText: {
    fontSize: 14,
    color: '#00ff88',
    fontWeight: '600',
    marginTop: 5,
  },
  nextExerciseButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  nextExerciseButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  nextExerciseButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  stickyFinishBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  doneWorkoutButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 0,
  },
  doneWorkoutButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  exerciseList: {
    marginBottom: 30,
  },
  exerciseListTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 12,
  },
  exerciseItemCurrent: {
    borderWidth: 2,
    borderColor: '#00ff88',
  },
  exerciseInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 21,
  },
  exerciseSets: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  exerciseStatus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  exerciseCompleted: {
    backgroundColor: '#00ff88',
  },
  exerciseCurrent: {
    backgroundColor: '#4CAF50',
  },
  exerciseStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#888',
  },
  exerciseStatusTextCompleted: {
    color: '#1a1a1a',
  },
  exerciseStatusTextCurrent: {
    color: '#fff',
  },
  skippedExerciseContainer: {
    backgroundColor: '#3a2a2a',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  skippedExerciseText: {
    fontSize: 16,
    color: '#ff6b6b',
    fontWeight: '600',
    marginBottom: 10,
  },
  unskipButton: {
    backgroundColor: '#ff6b6b',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  unskipButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  skipExerciseButton: {
    backgroundColor: '#3a2a2a',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  skipExerciseButtonText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseItemSkipped: {
    opacity: 0.6,
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  exerciseItemSuperset: {
    borderLeftWidth: 3,
    borderLeftColor: '#00ff88',
  },
  exerciseNameSkipped: {
    color: '#888',
    textDecorationLine: 'line-through',
  },
  exerciseSetsSkipped: {
    color: '#666',
  },
  exerciseSkipped: {
    backgroundColor: '#ff6b6b',
  },
  exerciseStatusTextSkipped: {
    color: '#fff',
  },
  exerciseProgress: {
    fontSize: 12,
    color: '#00ff88',
    marginTop: 4,
  },
  exerciseListHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  notesSection: {
    marginBottom: 30,
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  notesInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#fff',
    textAlignVertical: 'top',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#4a4a4a',
  },
  completeButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
    marginBottom: 30,
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#00ff88',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 20,
  },
  retryButtonText: {
    color: '#1a1a1a',
    fontSize: 22,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 25,
  },
  questionsContainer: {
    flexGrow: 1,
  },
  questionContainer: {
    marginBottom: 30,
  },
  questionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
  },
  questionHint: {
    fontSize: 14,
    color: '#888',
    marginBottom: 15,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ratingButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingButtonSelected: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  ratingButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#888',
  },
  ratingButtonTextSelected: {
    color: '#1a1a1a',
  },
  ratingLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  ratingLabelText: {
    fontSize: 12,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  exerciseActionButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  videoButton: {
    backgroundColor: '#00ff88',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  substituteButton: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0, 255, 136, 0.16)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#00ff88',
    marginTop: 10,
    marginBottom: 12,
    minHeight: 48,
  },
  substituteButtonText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  restTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  restTimerLabel: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  substituteButtonSmall: {
    backgroundColor: 'rgba(0, 255, 136, 0.14)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#00ff88',
    flexShrink: 0,
    minWidth: 72,
    minHeight: 40,
  },
  substituteButtonSpacer: {
    width: 72,
    flexShrink: 0,
  },
  substituteButtonTextSmall: {
    color: '#00ff88',
    fontSize: 13,
    fontWeight: '800',
  },
  alternativesContainer: {
    flexGrow: 1,
  },
  alternativeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  alternativeInfo: {
    flex: 1,
  },
  alternativeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
  },
  alternativeDetails: {
    fontSize: 13,
    color: '#888',
    marginBottom: 3,
  },
  alternativeEquipment: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
  },
  selectButton: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },
  emptyAlternatives: {
    padding: 40,
    alignItems: 'center',
  },
  emptyAlternativesText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  emptyAlternativesSubtext: {
    fontSize: 14,
    color: '#888',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#888',
    fontWeight: 'bold',
  },
});

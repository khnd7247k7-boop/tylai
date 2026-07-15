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
import { prefillNumericSetFromPrevious } from './src/utils/setLoggingPrefill';
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
}

export default function ProgramExecutionScreen({ program, onBack, onComplete }: ProgramExecutionScreenProps) {
  console.log('ProgramExecutionScreen rendered with program:', program);
  const { onWorkoutSessionSaved } = useSmallWins();

  // All hooks must be called in the same order every time
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
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
  }>>([]);
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [isFinishingWorkout, setIsFinishingWorkout] = useState(false);
  const finishingWorkoutRef = useRef(false);
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [substitutionExerciseIndex, setSubstitutionExerciseIndex] = useState<number | null>(null);
  const [substitutionAlternatives, setSubstitutionAlternatives] = useState<ExerciseData[]>([]);
  const [modifiedProgram, setModifiedProgram] = useState<WorkoutProgram | null>(null);
  const [previousWorkoutData, setPreviousWorkoutData] = useState<Map<string, Array<{ setNumber: number; weight: number; reps: number }>>>(new Map());
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | undefined>(undefined);
  const [healthMetricsEnabled, setHealthMetricsEnabled] = useState(false);
  const [currentHeartRate, setCurrentHeartRate] = useState<number | null>(null);
  const [restTimerEnabled, setRestTimerEnabled] = useState(true);
  const [restModalVisible, setRestModalVisible] = useState(false);
  const [restModalSeconds, setRestModalSeconds] = useState(90);

  // Reset modifiedProgram when program prop changes
  useEffect(() => {
    if (program) {
      setModifiedProgram(null);
    }
  }, [program]);

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

  useEffect(() => {
    // Initialize exercise data with error handling
    // Always use the current program (modifiedProgram if exists, otherwise original program)
    const programToUse = modifiedProgram || program;
    
    try {
      if (!programToUse || !programToUse.exercises || programToUse.exercises.length === 0) {
        console.error('Invalid program data:', programToUse);
        setExerciseData([]);
        return;
      }

      const initialData = programToUse.exercises.map(exercise => ({
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
      setExerciseData(initialData);
      setCurrentSetIndex(0); // Reset to first set
      setCurrentExerciseIndex(0); // Reset to first exercise
    } catch (error) {
      console.error('Error initializing exercise data:', error);
      setExerciseData([]);
      setCurrentSetIndex(0);
      setCurrentExerciseIndex(0);
    }
  }, [program, modifiedProgram]);

  // Function to find similar exercises for substitution
  const findSimilarExercises = (exerciseName: string): ExerciseData[] => {
    const currentExercise = getExerciseData(exerciseName);
    if (!currentExercise) {
      return [];
    }

    const alternatives: ExerciseData[] = [];
    const seenNames = new Set<string>();

    // 1. Get exercises from the alternatives array
    if (currentExercise.alternatives && currentExercise.alternatives.length > 0) {
      currentExercise.alternatives.forEach(altName => {
        const altExercise = getExerciseData(altName);
        if (altExercise && !seenNames.has(altExercise.name)) {
          alternatives.push(altExercise);
          seenNames.add(altExercise.name);
        }
      });
    }

    // 2. Find exercises with same primary muscle group and muscle region
    exerciseDatabase.forEach(ex => {
      if (
        ex.name.toLowerCase() !== exerciseName.toLowerCase() &&
        !seenNames.has(ex.name) &&
        ex.primaryMuscleGroup.toLowerCase() === currentExercise.primaryMuscleGroup.toLowerCase() &&
        ex.muscleRegion === currentExercise.muscleRegion &&
        ex.category === currentExercise.category
      ) {
        alternatives.push(ex);
        seenNames.add(ex.name);
      }
    });

    // 3. Find exercises with same primary muscle group and movement pattern
    exerciseDatabase.forEach(ex => {
      if (
        ex.name.toLowerCase() !== exerciseName.toLowerCase() &&
        !seenNames.has(ex.name) &&
        ex.primaryMuscleGroup.toLowerCase() === currentExercise.primaryMuscleGroup.toLowerCase() &&
        ex.movementPattern === currentExercise.movementPattern &&
        ex.category === currentExercise.category
      ) {
        alternatives.push(ex);
        seenNames.add(ex.name);
      }
    });

    // 4. Find exercises with same primary muscle group (broader match)
    exerciseDatabase.forEach(ex => {
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

    return alternatives.slice(0, 10); // Limit to 10 alternatives
  };

  const handleSubstituteExercise = (exerciseIndex: number) => {
    const exercise = currentProgram.exercises[exerciseIndex];
    const alternatives = findSimilarExercises(exercise.name);
    setSubstitutionExerciseIndex(exerciseIndex);
    setSubstitutionAlternatives(alternatives);
    setShowSubstitutionModal(true);
  };

  const handleSelectSubstitution = (alternativeExercise: ExerciseData) => {
    if (substitutionExerciseIndex === null) return;

    const oldExerciseName = currentProgram.exercises[substitutionExerciseIndex].name;

    // Update exercise data (this is what drives the UI)
    const newExerciseData = [...exerciseData];
    newExerciseData[substitutionExerciseIndex] = {
      ...newExerciseData[substitutionExerciseIndex],
      name: alternativeExercise.name,
      exerciseId: alternativeExercise.id,
    };

    // Update the program exercises array (create a new array)
    const newExercises = [...currentProgram.exercises];
    newExercises[substitutionExerciseIndex] = {
      ...newExercises[substitutionExerciseIndex],
      name: alternativeExercise.name,
      id: alternativeExercise.id,
    };

    // Create updated program
    const updatedProgram: WorkoutProgram = {
      ...currentProgram,
      exercises: newExercises,
    };
    
    // Reset modifiedProgram when program prop changes
    if (modifiedProgram && modifiedProgram.id !== program.id) {
      setModifiedProgram(null);
    }

    // Update state
    setExerciseData(newExerciseData);
    setModifiedProgram(updatedProgram);
    
    setShowSubstitutionModal(false);
    setSubstitutionExerciseIndex(null);
    setSubstitutionAlternatives([]);
    
    Alert.alert(
      'Exercise Substituted', 
      `${oldExerciseName} has been replaced with ${alternativeExercise.name}`,
      [{ text: 'OK' }]
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
      workoutNotes: string
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

        const session: WorkoutSession = {
          id: Date.now().toString(),
          programId: currentProgram.id,
          programName: currentProgram.name,
          date: startTime.toISOString(),
          duration,
          exercises: completedExercises,
          notes: workoutNotes,
          completed: true,
          healthMetrics,
        };

        try {
          const { loadUserData, saveUserData } = await import('./src/utils/userStorage');
          const existingHistory =
            (await loadUserData<WorkoutSession[]>('workoutHistory')) || [];
          await saveUserData('workoutHistory', [session, ...existingHistory]);
        } catch (error) {
          console.error('Error saving workout history:', error);
        }

        try {
          await onWorkoutSessionSaved(session);
        } catch (e) {
          console.warn('Small wins hook:', e);
        }

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

    if (isWorkoutFullyDone(newData)) {
      void finishWorkout(newData, notes);
      return;
    }

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
        void finishWorkout(exerciseData, notes);
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
      void finishWorkout(exerciseData, notes);
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
      void finishWorkout(exerciseData, notes);
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
            void finishWorkout(exerciseData, notes);
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
              void finishWorkout(newData, notes);
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
                    >
                      <Text style={styles.videoButtonText}>▶</Text>
                    </TouchableOpacity>
                  );
                }
                return null;
              })()}
              <TouchableOpacity
                style={styles.substituteButton}
                onPress={() => handleSubstituteExercise(currentExerciseIndex)}
              >
                <Text style={styles.substituteButtonText}>Change Exercise</Text>
              </TouchableOpacity>
            </View>
          </View>
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
            const allExercisesCompleted = isWorkoutFullyDone(exerciseData);
            const hasProgress = exerciseData.some(
              (exercise) => exercise.skipped || exercise.sets.some((set) => set.completed)
            );

            if (isFinishingWorkout) {
              return (
                <View style={styles.doneWorkoutButton}>
                  <Text style={styles.doneWorkoutButtonText}>Saving workout…</Text>
                </View>
              );
            }

            const showNext =
              (allSetsCompleted && hasSets && !isLastExercise) ||
              !!exerciseData[currentExerciseIndex]?.skipped;

            return (
              <>
                {allExercisesCompleted && hasProgress ? (
                  <TouchableOpacity
                    style={styles.doneWorkoutButton}
                    onPress={handleFinishWorkoutPress}
                  >
                    <Text style={styles.doneWorkoutButtonText}>Finish Workout</Text>
                  </TouchableOpacity>
                ) : null}
                {showNext ? (
                  <TouchableOpacity
                    style={styles.nextExerciseButton}
                    onPress={handleExerciseComplete}
                  >
                    <Text style={styles.nextExerciseButtonText}>Next Exercise</Text>
                  </TouchableOpacity>
                ) : null}
                {hasProgress && !allExercisesCompleted ? (
                  <TouchableOpacity
                    style={styles.finishWorkoutButton}
                    onPress={handleFinishWorkoutPress}
                  >
                    <Text style={styles.finishWorkoutButtonText}>Finish Workout</Text>
                  </TouchableOpacity>
                ) : null}
              </>
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
              >
              <View style={styles.exerciseInfo}>
                  <View style={styles.exerciseNameRow}>
                <Text style={[styles.exerciseName, isSkipped && styles.exerciseNameSkipped]}>
                      {ssTag ? `${ssTag} · ` : ''}{exercise.name}
                      {isSkipped && ' (Skipped)'}
                    </Text>
                    {!isSkipped && (
                      <TouchableOpacity
                        style={styles.substituteButtonSmall}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleSubstituteExercise(index);
                        }}
                      >
                        <Text style={styles.substituteButtonTextSmall}>Change</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                <Text style={[styles.exerciseSets, isSkipped && styles.exerciseSetsSkipped]}>
                  {(() => {
                    const protocol = getStretchProtocol(exercise);
                    if (protocol) return formatStretchProtocolLabel(protocol);
                    if (exercise.durationSeconds != null && exercise.durationSeconds > 0) {
                      return `1 set • ${exercise.durationSeconds} sec`;
                    }
                    return `${exercise.sets} sets • ${exercise.reps} reps`;
                  })()}
                </Text>
                  {!isSkipped && exerciseSets.length > 0 && (
                    <Text style={styles.exerciseProgress}>
                      {isStretchLoggingExercise(exercise)
                        ? `${completedSets}/${exerciseSets.length} holds`
                        : `${completedSets}/${exerciseSets.length} sets completed`}
                    </Text>
                  )}
              </View>
              <View style={[
                styles.exerciseStatus,
                isSkipped && styles.exerciseSkipped,
                  allSetsCompleted && !isSkipped && styles.exerciseCompleted,
                  index === currentExerciseIndex && !allSetsCompleted && !isSkipped && styles.exerciseCurrent
                ]}>
                  <Text style={[
                    styles.exerciseStatusText,
                    isSkipped && styles.exerciseStatusTextSkipped,
                    allSetsCompleted && !isSkipped && styles.exerciseStatusTextCompleted,
                    index === currentExerciseIndex && !allSetsCompleted && !isSkipped && styles.exerciseStatusTextCurrent
                  ]}>
                    {isSkipped ? '⊘' : allSetsCompleted ? '✓' : index === currentExerciseIndex ? '→' : '○'}
                </Text>
              </View>
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
        </View>
      </ScrollView>

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

      {/* Exercise Substitution Modal */}
      <Modal
        visible={showSubstitutionModal}
        animationType="none"
        transparent={true}
        onRequestClose={() => {
          setShowSubstitutionModal(false);
          setSubstitutionExerciseIndex(null);
          setSubstitutionAlternatives([]);
        }}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Substitute Exercise</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowSubstitutionModal(false);
                  setSubstitutionExerciseIndex(null);
                  setSubstitutionAlternatives([]);
                }}
              >
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {substitutionExerciseIndex !== null && (
              <Text style={styles.modalSubtitle}>
                Replace "{currentProgram.exercises[substitutionExerciseIndex].name}" with:
              </Text>
            )}

            <ScrollView style={styles.alternativesContainer} showsVerticalScrollIndicator={false}>
              {substitutionAlternatives.length === 0 ? (
                <View style={styles.emptyAlternatives}>
                  <Text style={styles.emptyAlternativesText}>No similar exercises found</Text>
                  <Text style={styles.emptyAlternativesSubtext}>
                    Try searching for exercises manually
                  </Text>
                </View>
              ) : (
                substitutionAlternatives.map((altExercise, index) => (
                  <TouchableOpacity
                    key={altExercise.id || index}
                    style={styles.alternativeCard}
                    onPress={() => handleSelectSubstitution(altExercise)}
                  >
                    <View style={styles.alternativeInfo}>
                      <Text style={styles.alternativeName}>{altExercise.name}</Text>
                      <Text style={styles.alternativeDetails}>
                        {altExercise.primaryMuscleGroup.charAt(0).toUpperCase() + altExercise.primaryMuscleGroup.slice(1)}
                        {altExercise.muscleRegion && ` • ${altExercise.muscleRegion} region`}
                        {altExercise.difficulty && ` • ${altExercise.difficulty}`}
                      </Text>
                      {altExercise.equipmentRequired && altExercise.equipmentRequired.length > 0 && (
                        <Text style={styles.alternativeEquipment}>
                          Equipment: {altExercise.equipmentRequired.join(', ')}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.selectButton}>Select</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
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
  onEdit?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  previousSetData?: {
    setNumber: number;
    weight: number;
    reps: number;
  };
}

const SetTracker = ({ set, setIndex, totalSets, onComplete, onEdit, onPrevious, onNext, canGoPrevious, canGoNext, previousSetData }: SetTrackerProps) => {
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
        <View style={styles.completedSet}>
            <Text style={styles.completedSetText}>✓ DONE</Text>
          </View>
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
  doneWorkoutButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
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
    padding: 15,
    marginBottom: 10,
  },
  exerciseItemCurrent: {
    borderWidth: 2,
    borderColor: '#00ff88',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  exerciseSets: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  exerciseStatus: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseCompleted: {
    backgroundColor: '#00ff88',
  },
  exerciseCurrent: {
    backgroundColor: '#4CAF50',
  },
  exerciseStatusText: {
    fontSize: 18,
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
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  substituteButtonText: {
    color: '#00ff88',
    fontSize: 11,
    fontWeight: '600',
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
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00ff88',
    marginLeft: 8,
  },
  substituteButtonTextSmall: {
    color: '#00ff88',
    fontSize: 10,
    fontWeight: '600',
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

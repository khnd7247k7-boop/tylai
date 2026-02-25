import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WorkoutProgram, WorkoutSession, Exercise } from './data/workoutPrograms';
import { exerciseDatabase, getExerciseData, ExerciseData } from './src/data/exerciseDatabase';
import ExerciseVideoPlayer from './src/components/ExerciseVideoPlayer';
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
    }>;
  }>>([]);
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [showPostWorkoutQuestions, setShowPostWorkoutQuestions] = useState(false);
  const [sorenessLevel, setSorenessLevel] = useState<number | null>(null);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [motivationLevel, setMotivationLevel] = useState<number | null>(null);
  const [pendingSession, setPendingSession] = useState<WorkoutSession | null>(null);
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [substitutionExerciseIndex, setSubstitutionExerciseIndex] = useState<number | null>(null);
  const [substitutionAlternatives, setSubstitutionAlternatives] = useState<ExerciseData[]>([]);
  const [modifiedProgram, setModifiedProgram] = useState<WorkoutProgram | null>(null);
  const [previousWorkoutData, setPreviousWorkoutData] = useState<Map<string, Array<{ setNumber: number; weight: number; reps: number }>>>(new Map());
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | undefined>(undefined);
  const [healthMetricsEnabled, setHealthMetricsEnabled] = useState(false);
  const [currentHeartRate, setCurrentHeartRate] = useState<number | null>(null);

  // Reset modifiedProgram when program prop changes
  useEffect(() => {
    if (program) {
      setModifiedProgram(null);
    }
  }, [program]);

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
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
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


  const handleSetComplete = (exerciseIndex: number, setIndex: number, weight: number, reps: number) => {
    const newData = [...exerciseData];
    newData[exerciseIndex].sets[setIndex] = {
      ...newData[exerciseIndex].sets[setIndex],
      weight,
      reps,
      completed: true,
    };
    setExerciseData(newData);

    // Auto-advance to next set if available
    const currentExercise = newData[exerciseIndex];
    if (setIndex < currentExercise.sets.length - 1) {
      // Move to next set in same exercise
      setCurrentSetIndex(setIndex + 1);
    } else {
      // All sets completed for this exercise, move to next exercise
      if (exerciseIndex < currentProgram.exercises.length - 1) {
        setCurrentExerciseIndex(exerciseIndex + 1);
        setCurrentSetIndex(0);
      }
    }
  };

  const handleExerciseComplete = () => {
    // Check if all sets are completed for current exercise
    const currentExerciseSets = exerciseData[currentExerciseIndex]?.sets || [];
    const allSetsCompleted = currentExerciseSets.every(set => set.completed);
    
    if (!allSetsCompleted) {
      Alert.alert('Complete All Sets', 'Please complete all sets for this exercise before moving to the next one.');
      return;
    }
    
    if (currentExerciseIndex < currentProgram.exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      // Reset inputs for the next exercise
      resetInputsForNextExercise();
    }
  };

  const handleNavigateToExercise = (index: number) => {
    setCurrentExerciseIndex(index);
    // Find first incomplete set, or start at set 0
    const exercise = exerciseData[index];
    if (exercise && exercise.sets.length > 0) {
      const firstIncompleteSet = exercise.sets.findIndex(set => !set.completed);
      setCurrentSetIndex(firstIncompleteSet >= 0 ? firstIncompleteSet : 0);
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
            
            // Move to next exercise if available
            if (currentExerciseIndex < currentProgram.exercises.length - 1) {
              setCurrentExerciseIndex(currentExerciseIndex + 1);
              setCurrentSetIndex(0);
            }
          },
        },
      ]
    );
  };

  const handleWorkoutComplete = async () => {
    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60); // in minutes

    // Include all exercises - completed ones with sets, and skipped ones with empty sets
    const completedExercises = exerciseData.map(exercise => ({
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      sets: exercise.skipped ? [] : exercise.sets.filter(set => set.completed),
    })).filter(exercise => exercise.skipped || exercise.sets.length > 0); // Include skipped exercises or exercises with completed sets

    // Fetch health metrics if enabled
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
      notes,
      completed: true,
      healthMetrics,
    };

    // Store session and show post-workout questions
    setPendingSession(session);
    setShowPostWorkoutQuestions(true);
    
    // Save to history immediately (before questions)
    try {
      const { loadUserData, saveUserData } = await import('./src/utils/userStorage');
      const existingHistory = await loadUserData<WorkoutSession[]>('workoutHistory') || [];
      const updatedHistory = [session, ...existingHistory];
      await saveUserData('workoutHistory', updatedHistory);
      console.log('Workout session saved to history immediately');
    } catch (error) {
      console.error('Error saving workout history:', error);
    }
  };

  const handleSubmitPostWorkoutQuestions = async () => {
    if (sorenessLevel === null || energyLevel === null || motivationLevel === null) {
      Alert.alert('Please Answer All Questions', 'Please rate all three questions before continuing.');
      return;
    }

    if (!pendingSession) return;

    // Add the responses to the session
    const finalSession: WorkoutSession = {
      ...pendingSession,
      sorenessLevel,
      energyLevel,
      motivationLevel,
    };

    console.log('Workout session being saved with post-workout data:', finalSession);
    console.log('Exercises with sets:', finalSession.exercises.map(ex => ({
      name: ex.name,
      sets: ex.sets.map(s => `Set ${s.setNumber}: ${s.weight}lbs × ${s.reps} reps`)
    })));

    // Update the session in history with post-workout data
    try {
      const { loadUserData, saveUserData } = await import('./src/utils/userStorage');
      const existingHistory = await loadUserData<WorkoutSession[]>('workoutHistory') || [];
      // Find and update the session we just saved
      const sessionIndex = existingHistory.findIndex(s => s.id === finalSession.id);
      if (sessionIndex >= 0) {
        existingHistory[sessionIndex] = finalSession;
      } else {
        // If not found, add it (shouldn't happen, but safety check)
        existingHistory.unshift(finalSession);
      }
      await saveUserData('workoutHistory', existingHistory);
      console.log('Workout session updated in history with post-workout data');
    } catch (error) {
      console.error('Error updating workout history:', error);
    }

    // Reset states
    setShowPostWorkoutQuestions(false);
    setSorenessLevel(null);
    setEnergyLevel(null);
    setMotivationLevel(null);
    setPendingSession(null);

    // Call onComplete to notify parent component
    onComplete(finalSession);
    Alert.alert('Workout Complete!', `Great job! You completed ${currentProgram.name} in ${finalSession.duration} minutes.`);
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
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to load workout program</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onBack}>
            <Text style={styles.retryButtonText}>Go Back</Text>
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
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
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
                <Text style={styles.substituteButtonText}>↻</Text>
              </TouchableOpacity>
            </View>
          </View>
          {currentExercise.instructions && (
          <Text style={styles.exerciseInstructions}>{currentExercise.instructions}</Text>
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
                <SetTracker
                  key={currentSetIndex}
                  set={currentExerciseData.sets[currentSetIndex]}
                  setIndex={currentSetIndex}
                  totalSets={currentExerciseData.sets.length}
                  onComplete={(weight, reps) => handleSetComplete(currentExerciseIndex, currentSetIndex, weight, reps)}
                  onEdit={() => handleEditSet(currentExerciseIndex, currentSetIndex)}
                  onPrevious={() => {
                    if (currentSetIndex > 0) {
                      setCurrentSetIndex(currentSetIndex - 1);
                    }
                  }}
                  onNext={() => {
                    if (currentSetIndex < currentExerciseData.sets.length - 1) {
                      setCurrentSetIndex(currentSetIndex + 1);
                    }
                  }}
                  canGoPrevious={currentSetIndex > 0}
                  canGoNext={currentSetIndex < currentExerciseData.sets.length - 1}
                  previousSetData={previousWorkoutData.get(currentExerciseData.name)?.find(s => s.setNumber === currentExerciseData.sets[currentSetIndex].setNumber)}
                />
              ) : null}
              
              {/* Set Navigation */}
              {currentExerciseData.sets.length > 1 && (
                <View style={styles.setNavigation}>
                  <TouchableOpacity
                    style={[styles.setNavButton, !(currentSetIndex > 0) && styles.setNavButtonDisabled]}
                    onPress={() => {
                      if (currentSetIndex > 0) {
                        setCurrentSetIndex(currentSetIndex - 1);
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
                        setCurrentSetIndex(currentSetIndex + 1);
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
                
                return (
                  <View style={styles.exerciseProgressInfo}>
                    <Text style={styles.exerciseProgressText}>
                      {completedSets} of {currentExerciseData.sets.length} sets completed
                    </Text>
                    {allSetsCompleted && (
                      <Text style={styles.allSetsCompletedText}>✓ All sets completed!</Text>
                    )}
                  </View>
                );
              })()}
            </>
          ) : null}

          {/* Next Exercise Button - only show when all sets are completed */}
          {(() => {
            const currentExerciseSets = exerciseData[currentExerciseIndex]?.sets || [];
            const allSetsCompleted = currentExerciseSets.every(set => set.completed);
            const hasSets = currentExerciseSets.length > 0;
            const isLastExercise = currentExerciseIndex >= currentProgram.exercises.length - 1;
            
            // Check if all exercises are completed or skipped
            const allExercisesCompleted = exerciseData.every(exercise => 
              exercise.skipped || exercise.sets.every(set => set.completed)
            );
            
            // Check if at least one exercise has been completed or skipped
            const hasProgress = exerciseData.some(exercise => 
              exercise.skipped || exercise.sets.some(set => set.completed)
            );
            
            if (allExercisesCompleted && hasProgress) {
              // Show "Done" button when all exercises are completed or skipped
              return (
                <TouchableOpacity
                  style={styles.doneWorkoutButton}
                  onPress={handleWorkoutComplete}
                >
                  <Text style={styles.doneWorkoutButtonText}>Done</Text>
                </TouchableOpacity>
              );
            } else if ((allSetsCompleted && hasSets && !isLastExercise) || exerciseData[currentExerciseIndex]?.skipped) {
              // Show "Next Exercise" button for non-last exercises
              return (
          <TouchableOpacity
            style={styles.nextExerciseButton}
            onPress={handleExerciseComplete}
          >
                  <Text style={styles.nextExerciseButtonText}>Next Exercise</Text>
          </TouchableOpacity>
              );
            }
            return null;
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
          {currentProgram?.exercises?.map((exercise, index) => {
            const exerciseSets = exerciseData[index]?.sets || [];
            const completedSets = exerciseSets.filter(set => set.completed).length;
            const allSetsCompleted = exerciseSets.length > 0 && exerciseSets.every(set => set.completed);
            const isSkipped = exerciseData[index]?.skipped || false;
            
            return (
              <TouchableOpacity
                key={exercise.id || `ex-${index}-${exercise.name}`}
                style={[
                  styles.exerciseItem,
                  index === currentExerciseIndex && styles.exerciseItemCurrent,
                  isSkipped && styles.exerciseItemSkipped
                ]}
                onPress={() => handleNavigateToExercise(index)}
              >
              <View style={styles.exerciseInfo}>
                  <View style={styles.exerciseNameRow}>
                <Text style={[styles.exerciseName, isSkipped && styles.exerciseNameSkipped]}>
                      {exercise.name}
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
                        <Text style={styles.substituteButtonTextSmall}>↻</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                <Text style={[styles.exerciseSets, isSkipped && styles.exerciseSetsSkipped]}>
                  {exercise.sets} sets • {exercise.reps} reps
                </Text>
                  {!isSkipped && exerciseSets.length > 0 && (
                    <Text style={styles.exerciseProgress}>
                      {completedSets}/{exerciseSets.length} sets completed
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
          }) || null}
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

        {/* Complete Workout - only show if all exercises are completed */}
        {(() => {
          const allExercisesCompleted = exerciseData.every(exercise => 
            exercise.sets.every(set => set.completed)
          );
          
          if (allExercisesCompleted) {
            return (
        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleWorkoutComplete}
        >
                <Text style={styles.completeButtonText}>Done</Text>
        </TouchableOpacity>
            );
          }
          return null;
        })()}
      </ScrollView>

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

      {/* Post-Workout Questions Modal */}
      <Modal
        visible={showPostWorkoutQuestions}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          // Don't allow closing without answering
          Alert.alert('Complete Questions', 'Please answer all questions to finish your workout.');
        }}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How did you feel?</Text>
            <Text style={styles.modalSubtitle}>Help us improve your next workout</Text>

            <ScrollView style={styles.questionsContainer} showsVerticalScrollIndicator={false}>
              {/* Soreness Level */}
              <View style={styles.questionContainer}>
                <Text style={styles.questionLabel}>Soreness Level</Text>
                <Text style={styles.questionHint}>How sore were you during this workout?</Text>
                <View style={styles.ratingContainer}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.ratingButton,
                        sorenessLevel === level && styles.ratingButtonSelected
                      ]}
                      onPress={() => setSorenessLevel(level)}
                    >
                      <Text style={[
                        styles.ratingButtonText,
                        sorenessLevel === level && styles.ratingButtonTextSelected
                      ]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.ratingLabels}>
                  <Text style={styles.ratingLabelText}>Not Sore</Text>
                  <Text style={styles.ratingLabelText}>Very Sore</Text>
                </View>
              </View>

              {/* Energy Level */}
              <View style={styles.questionContainer}>
                <Text style={styles.questionLabel}>Energy Level</Text>
                <Text style={styles.questionHint}>How energized did you feel?</Text>
                <View style={styles.ratingContainer}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.ratingButton,
                        energyLevel === level && styles.ratingButtonSelected
                      ]}
                      onPress={() => setEnergyLevel(level)}
                    >
                      <Text style={[
                        styles.ratingButtonText,
                        energyLevel === level && styles.ratingButtonTextSelected
                      ]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.ratingLabels}>
                  <Text style={styles.ratingLabelText}>Low Energy</Text>
                  <Text style={styles.ratingLabelText}>High Energy</Text>
                </View>
              </View>

              {/* Motivation Level */}
              <View style={styles.questionContainer}>
                <Text style={styles.questionLabel}>Motivation Level</Text>
                <Text style={styles.questionHint}>How motivated were you during this workout?</Text>
                <View style={styles.ratingContainer}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.ratingButton,
                        motivationLevel === level && styles.ratingButtonSelected
                      ]}
                      onPress={() => setMotivationLevel(level)}
                    >
                      <Text style={[
                        styles.ratingButtonText,
                        motivationLevel === level && styles.ratingButtonTextSelected
                      ]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.ratingLabels}>
                  <Text style={styles.ratingLabelText}>Low Motivation</Text>
                  <Text style={styles.ratingLabelText}>High Motivation</Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmitPostWorkoutQuestions}
            >
              <Text style={styles.submitButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Exercise Substitution Modal */}
      <Modal
        visible={showSubstitutionModal}
        animationType="slide"
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
  };
  setIndex: number;
  totalSets: number;
  onComplete: (weight: number, reps: number) => void;
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
  }, [set?.weight, set?.reps]);

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
    onComplete(weightNum, repsNum);
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
    fontSize: 16,
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
  exerciseInstructions: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
    fontStyle: 'italic',
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
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  finishWorkoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
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
    fontSize: 16,
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
    maxHeight: 400,
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
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  substituteButtonText: {
    color: '#00ff88',
    fontSize: 18,
    fontWeight: 'bold',
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  substituteButtonSmall: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00ff88',
    marginLeft: 8,
  },
  substituteButtonTextSmall: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
  },
  alternativesContainer: {
    maxHeight: 400,
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

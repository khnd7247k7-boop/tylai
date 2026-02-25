import React, { useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WorkoutProgram, Exercise, WorkoutSession } from './data/workoutPrograms';
import ProgramExecutionScreen from './ProgramExecutionScreen';
import { saveUserData, loadUserData } from './src/utils/userStorage';
import { exerciseDatabase, ExerciseData } from './src/data/exerciseDatabase';

interface BuildYourOwnWorkoutScreenProps {
  onBack: () => void;
  onWorkoutComplete?: () => void;
}

interface CustomExercise {
  id: string;
  name: string;
  sets: string; // Can be "4" or "4-6" for ranges
  reps: string; // Can be "10" or "6-10" for ranges
  weight: number;
  restTime: number;
}

interface DayWorkout {
  day: string;
  exercises: CustomExercise[];
  completed: boolean;
}

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function BuildYourOwnWorkoutScreen({ onBack, onWorkoutComplete }: BuildYourOwnWorkoutScreenProps) {
  // Step 1: Basic Details
  const [workoutName, setWorkoutName] = useState('');
  const [trainingDays, setTrainingDays] = useState<string[]>([]);
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(-1);
  
  // Day-by-day workouts
  const [dayWorkouts, setDayWorkouts] = useState<DayWorkout[]>([]);
  
  // Current day exercise selection
  const [currentDayExercises, setCurrentDayExercises] = useState<CustomExercise[]>([]);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [showCustomExerciseInput, setShowCustomExerciseInput] = useState(false);
  const [customExerciseName, setCustomExerciseName] = useState('');
  
  // Exercise configuration
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
  const [showExerciseConfigModal, setShowExerciseConfigModal] = useState(false);
  const [configExerciseName, setConfigExerciseName] = useState('');
  const [configSets, setConfigSets] = useState('3');
  const [configReps, setConfigReps] = useState('10');
  const [configWeight, setConfigWeight] = useState('0');
  const [configRestTime, setConfigRestTime] = useState('60');
  
  const [selectedProgram, setSelectedProgram] = useState<WorkoutProgram | null>(null);

  // Filter exercises based on search
  const filteredExercises = exerciseDatabase.filter(ex =>
    ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase())
  );

  const handleToggleDay = (day: string) => {
    if (trainingDays.includes(day)) {
      setTrainingDays(trainingDays.filter(d => d !== day));
    } else {
      setTrainingDays([...trainingDays, day]);
    }
  };

  const handleStartBuildingDays = () => {
    if (!workoutName.trim()) {
      Alert.alert('Error', 'Please enter a workout name');
      return;
    }
    if (trainingDays.length === 0) {
      Alert.alert('Error', 'Please select at least one training day');
      return;
    }
    
    // Initialize day workouts
    const initialDayWorkouts: DayWorkout[] = trainingDays.map(day => ({
      day,
      exercises: [],
      completed: false,
    }));
    setDayWorkouts(initialDayWorkouts);
    setCurrentDayIndex(0);
  };

  const handleAddExerciseToCurrentDay = (exerciseName: string) => {
    const newExercise: CustomExercise = {
      id: `exercise-${Date.now()}-${Math.random()}`,
      name: exerciseName,
      sets: '3',
      reps: '10',
      weight: 0,
      restTime: 60,
    };
    setCurrentDayExercises([...currentDayExercises, newExercise]);
  };

  const handleAddCustomExercise = () => {
    if (!customExerciseName.trim()) {
      Alert.alert('Error', 'Please enter an exercise name');
      return;
    }
    handleAddExerciseToCurrentDay(customExerciseName);
    setCustomExerciseName('');
    setShowCustomExerciseInput(false);
  };

  const handleRemoveExercise = (exerciseId: string) => {
    setCurrentDayExercises(currentDayExercises.filter(ex => ex.id !== exerciseId));
  };

  const handleOpenExerciseConfig = (index: number) => {
    const exercise = currentDayExercises[index];
    setEditingExerciseIndex(index);
    setConfigExerciseName(exercise.name);
    setConfigSets(exercise.sets);
    setConfigReps(exercise.reps);
    setConfigWeight(exercise.weight.toString());
    setConfigRestTime(exercise.restTime.toString());
    setShowExerciseConfigModal(true);
  };

  const handleSaveExerciseConfig = () => {
    if (editingExerciseIndex === null) return;
    
    // Validate sets and reps (allow ranges like "4-6" or "6-10")
    const setsPattern = /^(\d+(-\d+)?)$/;
    const repsPattern = /^(\d+(-\d+)?)$/;
    
    if (!setsPattern.test(configSets.trim())) {
      Alert.alert('Invalid Format', 'Sets must be a number (e.g., "4") or range (e.g., "4-6")');
      return;
    }
    
    if (!repsPattern.test(configReps.trim())) {
      Alert.alert('Invalid Format', 'Reps must be a number (e.g., "10") or range (e.g., "6-10")');
      return;
    }
    
    const weight = parseFloat(configWeight) || 0;
    const restTime = parseInt(configRestTime) || 60;

    const updatedExercises = [...currentDayExercises];
    updatedExercises[editingExerciseIndex] = {
      ...updatedExercises[editingExerciseIndex],
      sets: configSets.trim(),
      reps: configReps.trim(),
      weight,
      restTime,
    };
    setCurrentDayExercises(updatedExercises);
    setShowExerciseConfigModal(false);
    setEditingExerciseIndex(null);
  };

  const handleCompleteCurrentDay = () => {
    if (currentDayExercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise for this day');
      return;
    }

    // Save current day's workout
    const updatedDayWorkouts = [...dayWorkouts];
    updatedDayWorkouts[currentDayIndex] = {
      ...updatedDayWorkouts[currentDayIndex],
      exercises: [...currentDayExercises],
      completed: true,
    };
    setDayWorkouts(updatedDayWorkouts);

    // Move to next day or finish
    if (currentDayIndex < trainingDays.length - 1) {
      setCurrentDayIndex(currentDayIndex + 1);
      setCurrentDayExercises([]);
      setExerciseSearchQuery('');
    } else {
      // All days completed, show review/save
      setCurrentDayIndex(-2); // -2 means review mode
    }
  };

  const handleBackToDay = (dayIndex: number) => {
    setCurrentDayIndex(dayIndex);
    setCurrentDayExercises([...dayWorkouts[dayIndex].exercises]);
  };

  const handleStartWorkout = async (dayIndex?: number) => {
    const targetDayIndex = dayIndex !== undefined ? dayIndex : 0;
    const dayWorkout = dayWorkouts[targetDayIndex];
    
    if (!dayWorkout || dayWorkout.exercises.length === 0) {
      Alert.alert('Error', 'No exercises configured for this day');
      return;
    }

    // Convert to WorkoutProgram format
    // Parse sets and reps - if range, use first number; otherwise use the number
    const programExercises: Exercise[] = dayWorkout.exercises.map(ex => {
      const setsNum = ex.sets.includes('-') 
        ? parseInt(ex.sets.split('-')[0]) 
        : parseInt(ex.sets) || 3;
      const repsNum = ex.reps.includes('-') 
        ? parseInt(ex.reps.split('-')[0]) 
        : parseInt(ex.reps) || 10;
      
      return {
        id: ex.id,
        name: ex.name,
        sets: setsNum,
        reps: repsNum,
        weight: ex.weight,
        restTime: ex.restTime,
        category: 'strength' as const,
      };
    });

    const program: WorkoutProgram = {
      id: `custom-${Date.now()}`,
      name: `${workoutName} - ${dayWorkout.day}`,
      description: `Custom workout for ${dayWorkout.day}`,
      duration: dayWorkout.exercises.length * 5,
      frequency: 1,
      level: 'intermediate' as const,
      category: 'strength' as const,
      exercises: programExercises,
      focus: 'Custom workout',
      equipment: [],
    };

    setSelectedProgram(program);
  };

  const handleWorkoutComplete = async (session: WorkoutSession) => {
    try {
      console.log('Saving workout session:', session);
      console.log('Session exercises:', session.exercises);
      const existingHistory = await loadUserData<WorkoutSession[]>('workoutHistory') || [];
      const updatedHistory = [session, ...existingHistory]; // Add to beginning for most recent first
      await saveUserData('workoutHistory', updatedHistory);
      console.log('Workout history saved successfully');
    } catch (error) {
      console.error('Error saving workout history:', error);
    }

    setSelectedProgram(null);
    if (onWorkoutComplete) {
      onWorkoutComplete();
    }
  };

  const handleSaveWorkout = async () => {
    // Check all days are completed
    const allCompleted = dayWorkouts.every(dw => dw.completed && dw.exercises.length > 0);
    if (!allCompleted) {
      Alert.alert('Error', 'Please complete all training days before saving');
      return;
    }

    // Calculate total duration
    const totalDuration = dayWorkouts.reduce((sum, dw) => sum + (dw.exercises.length * 5), 0);

    // Create weekly plan structure
    const weeklyPlan = {
      weekDays: dayWorkouts.map((dw, index) => ({
        day: DAYS_OF_WEEK.indexOf(dw.day) + 1,
        dayName: dw.day,
        workoutName: `${workoutName} - ${dw.day}`,
        focus: `Custom ${dw.day} workout`,
        exercises: dw.exercises.map(ex => {
          // Parse sets and reps - if range, use first number; otherwise use the number
          const setsNum = ex.sets.includes('-') 
            ? parseInt(ex.sets.split('-')[0]) 
            : parseInt(ex.sets) || 3;
          const repsNum = ex.reps.includes('-') 
            ? parseInt(ex.reps.split('-')[0]) 
            : parseInt(ex.reps) || 10;
          
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
      })),
    };

    const savedPlan = {
      id: `custom-${Date.now()}`,
      name: workoutName,
      level: 'intermediate' as const,
      goal: 'strength' as const,
      exercises: dayWorkouts[0].exercises.map(ex => {
        // Parse sets and reps - if range, use first number; otherwise use the number
        const setsNum = ex.sets.includes('-') 
          ? parseInt(ex.sets.split('-')[0]) 
          : parseInt(ex.sets) || 3;
        const repsNum = ex.reps.includes('-') 
          ? parseInt(ex.reps.split('-')[0]) 
          : parseInt(ex.reps) || 10;
        
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
      duration: totalDuration,
      daysPerWeek: trainingDays.length,
      savedAt: new Date().toISOString(),
      trainingDays,
      weeklyPlan,
      isCustom: true,
    };

    try {
      const existingPlans = await loadUserData<any[]>('savedWorkoutPlans') || [];
      const updatedPlans = [...existingPlans, savedPlan];
      await saveUserData('savedWorkoutPlans', updatedPlans);
      Alert.alert('Success', 'Workout plan saved successfully!');
      onBack();
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('Error', 'Failed to save workout');
    }
  };

  if (selectedProgram) {
    return (
      <ProgramExecutionScreen
        program={selectedProgram}
        onBack={() => setSelectedProgram(null)}
        onComplete={handleWorkoutComplete}
      />
    );
  }

  // Step 1: Basic Details
  if (currentDayIndex === -1) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Build Your Own Workout</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.label}>Workout Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter workout name"
              placeholderTextColor="#666"
              value={workoutName}
              onChangeText={setWorkoutName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Training Days</Text>
            <Text style={styles.hint}>Select the days you want to train</Text>
            <View style={styles.daysContainer}>
              {DAYS_OF_WEEK.map(day => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayButton,
                    trainingDays.includes(day) && styles.dayButtonSelected
                  ]}
                  onPress={() => handleToggleDay(day)}
                >
                  <Text style={[
                    styles.dayButtonText,
                    trainingDays.includes(day) && styles.dayButtonTextSelected
                  ]}>
                    {day.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {trainingDays.length > 0 && (
              <Text style={styles.selectedDaysText}>
                Selected: {trainingDays.join(', ')}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.nextButton, (!workoutName.trim() || trainingDays.length === 0) && styles.nextButtonDisabled]}
            onPress={handleStartBuildingDays}
            disabled={!workoutName.trim() || trainingDays.length === 0}
          >
            <Text style={styles.nextButtonText}>Start Building Workouts</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step 2-N: Building each day's workout
  if (currentDayIndex >= 0 && currentDayIndex < trainingDays.length) {
    const currentDay = trainingDays[currentDayIndex];
    const isExerciseSelected = (name: string) => currentDayExercises.some(ex => ex.name === name);

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => {
            if (currentDayIndex > 0) {
              // Save current progress before going back
              const updatedDayWorkouts = [...dayWorkouts];
              updatedDayWorkouts[currentDayIndex] = {
                ...updatedDayWorkouts[currentDayIndex],
                exercises: [...currentDayExercises],
              };
              setDayWorkouts(updatedDayWorkouts);
              setCurrentDayIndex(currentDayIndex - 1);
              setCurrentDayExercises([...dayWorkouts[currentDayIndex - 1].exercises]);
            } else {
              setCurrentDayIndex(-1);
              setCurrentDayExercises([]);
            }
          }}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{currentDay} Workout</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Day {currentDayIndex + 1} of {trainingDays.length}
          </Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.label}>Add Exercises for {currentDay}</Text>
              <Text style={styles.hint}>Select exercises from the database or add custom ones</Text>
              
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search exercises..."
                  placeholderTextColor="#666"
                  value={exerciseSearchQuery}
                  onChangeText={setExerciseSearchQuery}
                  onSubmitEditing={() => {
                    // If search query doesn't match any exercise and is not empty, add it directly
                    if (exerciseSearchQuery.trim() && 
                        filteredExercises.length === 0 && 
                        !isExerciseSelected(exerciseSearchQuery.trim())) {
                      handleAddExerciseToCurrentDay(exerciseSearchQuery.trim());
                      setExerciseSearchQuery('');
                    }
                  }}
                />
                {/* Show "Add [search query]" button if search doesn't match and query exists */}
                {exerciseSearchQuery.trim() && 
                 filteredExercises.length === 0 && 
                 !isExerciseSelected(exerciseSearchQuery.trim()) && (
                  <TouchableOpacity
                    style={styles.addSearchResultButton}
                    onPress={() => {
                      handleAddExerciseToCurrentDay(exerciseSearchQuery.trim());
                      setExerciseSearchQuery('');
                    }}
                  >
                    <Text style={styles.addSearchResultButtonText}>
                      + Add "{exerciseSearchQuery.trim()}"
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.exerciseList}>
                {filteredExercises.map((exercise) => {
                  const selected = isExerciseSelected(exercise.name);
                  return (
                    <TouchableOpacity
                      key={exercise.name}
                      style={[
                        styles.exerciseItem,
                        selected && styles.exerciseItemSelected
                      ]}
                      onPress={() => {
                        if (selected) {
                          handleRemoveExercise(currentDayExercises.find(ex => ex.name === exercise.name)!.id);
                        } else {
                          handleAddExerciseToCurrentDay(exercise.name);
                        }
                      }}
                    >
                      <Text style={[
                        styles.exerciseItemText,
                        selected && styles.exerciseItemTextSelected
                      ]}>
                        {exercise.name}
                      </Text>
                      {selected && <Text style={styles.checkmark}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {currentDayExercises.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.label}>Configure Exercises ({currentDayExercises.length})</Text>
                  {currentDayExercises.map((exercise, index) => (
                    <View key={exercise.id} style={styles.exerciseConfigCard}>
                      <View style={styles.exerciseConfigHeader}>
                        <Text style={styles.exerciseConfigNumber}>{index + 1}</Text>
                        <Text style={styles.exerciseConfigName}>{exercise.name}</Text>
                        <TouchableOpacity
                          style={styles.removeExerciseButton}
                          onPress={() => handleRemoveExercise(exercise.id)}
                        >
                          <Text style={styles.removeExerciseText}>×</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.exerciseConfigDetails}>
                        <Text style={styles.exerciseConfigDetailText}>
                          {exercise.sets} sets × {exercise.reps} reps
                        </Text>
                        {exercise.weight > 0 && (
                          <Text style={styles.exerciseConfigDetailText}>
                            @ {exercise.weight} lbs
                          </Text>
                        )}
                        <Text style={styles.exerciseConfigDetailText}>
                          {exercise.restTime}s rest
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.configureButton}
                        onPress={() => handleOpenExerciseConfig(index)}
                      >
                        <Text style={styles.configureButtonText}>Configure</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.completeDayButton,
                  currentDayExercises.length === 0 && styles.completeDayButtonDisabled
                ]}
                onPress={handleCompleteCurrentDay}
                disabled={currentDayExercises.length === 0}
              >
                <Text style={styles.completeDayButtonText}>
                  {currentDayIndex < trainingDays.length - 1 
                    ? `Complete ${currentDay} & Continue to ${trainingDays[currentDayIndex + 1]}`
                    : `Complete ${currentDay} & Review Plan`}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Exercise Configuration Modal */}
        <Modal
          visible={showExerciseConfigModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowExerciseConfigModal(false)}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Configure Exercise</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowExerciseConfigModal(false);
                    setEditingExerciseIndex(null);
                  }}
                >
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Exercise: {configExerciseName}</Text>
                </View>

                <View style={styles.modalRow}>
                  <View style={styles.modalField}>
                    <Text style={styles.modalLabel}>Sets</Text>
                    <Text style={styles.modalHint}>e.g., 4 or 4-6</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="3 or 4-6"
                      placeholderTextColor="#666"
                      keyboardType="default"
                      value={configSets}
                      onChangeText={setConfigSets}
                    />
                  </View>
                  <View style={styles.modalField}>
                    <Text style={styles.modalLabel}>Reps</Text>
                    <Text style={styles.modalHint}>e.g., 10 or 6-10</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="10 or 6-10"
                      placeholderTextColor="#666"
                      keyboardType="default"
                      value={configReps}
                      onChangeText={setConfigReps}
                    />
                  </View>
                </View>

                <View style={styles.modalRow}>
                  <View style={styles.modalField}>
                    <Text style={styles.modalLabel}>Weight (lbs)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="0"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={configWeight}
                      onChangeText={setConfigWeight}
                    />
                  </View>
                  <View style={styles.modalField}>
                    <Text style={styles.modalLabel}>Rest (seconds)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="60"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={configRestTime}
                      onChangeText={setConfigRestTime}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={handleSaveExerciseConfig}
                >
                  <Text style={styles.modalSaveButtonText}>Save Configuration</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Review & Save Step
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          setCurrentDayIndex(trainingDays.length - 1);
          setCurrentDayExercises([...dayWorkouts[trainingDays.length - 1].exercises]);
        }}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Workout Plan</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.label}>{workoutName}</Text>
          <Text style={styles.hint}>Review your workout plan for all training days</Text>

          {dayWorkouts.map((dayWorkout, index) => (
            <View key={dayWorkout.day} style={styles.reviewDayCard}>
              <View style={styles.reviewDayHeader}>
                <Text style={styles.reviewDayTitle}>{dayWorkout.day}</Text>
                <View style={styles.reviewDayActions}>
                  <TouchableOpacity
                    style={styles.editDayButton}
                    onPress={() => handleBackToDay(index)}
                  >
                    <Text style={styles.editDayButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.startDayButton}
                    onPress={() => handleStartWorkout(index)}
                  >
                    <Text style={styles.startDayButtonText}>Start</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.reviewDaySubtitle}>
                {dayWorkout.exercises.length} exercises • ~{dayWorkout.exercises.length * 5} min
              </Text>
              {dayWorkout.exercises.map((exercise, exIndex) => (
                <View key={exercise.id} style={styles.reviewExerciseItem}>
                  <Text style={styles.reviewExerciseName}>
                    {exIndex + 1}. {exercise.name}
                  </Text>
                  <Text style={styles.reviewExerciseDetails}>
                    {exercise.sets} sets × {exercise.reps} reps
                    {exercise.weight > 0 && ` @ ${exercise.weight} lbs`}
                    {' • '}{exercise.restTime}s rest
                  </Text>
                </View>
              ))}
            </View>
          ))}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSaveWorkout}
            >
              <Text style={styles.saveButtonText}>Save Workout Plan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  progressContainer: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  progressText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  hint: {
    fontSize: 14,
    color: '#888',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  dayButton: {
    flex: 1,
    minWidth: '13%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  dayButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  dayButtonTextSelected: {
    color: '#1a1a1a',
  },
  selectedDaysText: {
    color: '#00ff88',
    fontSize: 14,
    marginTop: 10,
  },
  searchContainer: {
    marginBottom: 15,
  },
  searchInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  addSearchResultButton: {
    backgroundColor: '#00ff88',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  addSearchResultButtonText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addCustomButton: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
    marginBottom: 15,
    alignItems: 'center',
  },
  addCustomButtonText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
  },
  customExerciseInput: {
    marginBottom: 15,
  },
  customExerciseActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    flex: 1,
    backgroundColor: '#00ff88',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: 'bold',
  },
  exerciseList: {
    maxHeight: 250,
    marginBottom: 20,
  },
  exerciseItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 15,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  exerciseItemSelected: {
    backgroundColor: '#1a3a2a',
    borderColor: '#00ff88',
  },
  exerciseItemText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  exerciseItemTextSelected: {
    color: '#00ff88',
    fontWeight: '600',
  },
  checkmark: {
    color: '#00ff88',
    fontSize: 20,
    fontWeight: 'bold',
  },
  exerciseConfigCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  exerciseConfigHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  exerciseConfigNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00ff88',
    marginRight: 10,
    width: 30,
  },
  exerciseConfigName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  removeExerciseButton: {
    padding: 5,
  },
  removeExerciseText: {
    color: '#ff4444',
    fontSize: 24,
    fontWeight: 'bold',
  },
  exerciseConfigDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
    gap: 10,
  },
  exerciseConfigDetailText: {
    color: '#888',
    fontSize: 14,
    marginRight: 15,
  },
  configureButton: {
    backgroundColor: '#333',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
    alignSelf: 'flex-start',
  },
  configureButtonText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
  },
  completeDayButton: {
    backgroundColor: '#00ff88',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  completeDayButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  completeDayButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reviewDayCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  reviewDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewDayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00ff88',
  },
  reviewDayActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editDayButton: {
    backgroundColor: '#333',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  editDayButtonText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
  },
  startDayButton: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  startDayButtonText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: 'bold',
  },
  reviewDaySubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 15,
  },
  reviewExerciseItem: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  reviewExerciseName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  reviewExerciseDetails: {
    color: '#888',
    fontSize: 14,
  },
  actionButtons: {
    marginTop: 20,
    marginBottom: 40,
  },
  actionButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: '#00ff88',
  },
  saveButtonText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextButton: {
    backgroundColor: '#00ff88',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalClose: {
    fontSize: 24,
    color: '#888',
    fontWeight: 'bold',
  },
  modalScroll: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  modalField: {
    flex: 1,
  },
  modalLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  modalInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalSaveButton: {
    backgroundColor: '#00ff88',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  modalSaveButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

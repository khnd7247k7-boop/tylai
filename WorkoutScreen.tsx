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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  completed: boolean;
  category: 'strength' | 'cardio' | 'flexibility' | 'balance';
}

interface WorkoutPlan {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  goal: 'strength' | 'weight_loss' | 'muscle_gain' | 'endurance' | 'flexibility';
  exercises: Exercise[];
  duration: number; // in minutes
}

interface WorkoutLog {
  id: string;
  date: string;
  planId: string;
  exercises: Exercise[];
  notes: string;
  duration: number;
}

export default function WorkoutScreen({ onBack }: { onBack: () => void }) {
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [currentWorkout, setCurrentWorkout] = useState<WorkoutPlan | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exerciseLogs, setExerciseLogs] = useState<Exercise[]>([]);
  const [notes, setNotes] = useState('');

  const goals = [
    { id: 'strength', name: 'Build Strength' },
    { id: 'weight_loss', name: 'Weight Loss' },
    { id: 'muscle_gain', name: 'Muscle Gain' },
    { id: 'endurance', name: 'Endurance' },
    { id: 'flexibility', name: 'Flexibility' },
  ];

  const levels = [
    { id: 'beginner', name: 'Beginner', description: 'New to fitness' },
    { id: 'intermediate', name: 'Intermediate', description: 'Some experience' },
    { id: 'advanced', name: 'Advanced', description: 'Experienced athlete' },
  ];

  const generateWorkoutPlan = (goal: string, level: string): WorkoutPlan => {
    const plans = {
      strength: {
        beginner: {
          name: 'Beginner Strength Builder',
          exercises: [
            { id: '1', name: 'Push-ups', sets: 3, reps: 10, weight: 0, completed: false, category: 'strength' as const },
            { id: '2', name: 'Squats', sets: 3, reps: 15, weight: 0, completed: false, category: 'strength' as const },
            { id: '3', name: 'Plank', sets: 3, reps: 30, weight: 0, completed: false, category: 'strength' as const },
            { id: '4', name: 'Lunges', sets: 3, reps: 10, weight: 0, completed: false, category: 'strength' as const },
          ],
          duration: 30
        },
        intermediate: {
          name: 'Intermediate Strength Program',
          exercises: [
            { id: '1', name: 'Bench Press', sets: 4, reps: 8, weight: 0, completed: false, category: 'strength' as const },
            { id: '2', name: 'Deadlifts', sets: 4, reps: 6, weight: 0, completed: false, category: 'strength' as const },
            { id: '3', name: 'Squats', sets: 4, reps: 8, weight: 0, completed: false, category: 'strength' as const },
            { id: '4', name: 'Pull-ups', sets: 3, reps: 8, weight: 0, completed: false, category: 'strength' as const },
            { id: '5', name: 'Overhead Press', sets: 3, reps: 10, weight: 0, completed: false, category: 'strength' as const },
          ],
          duration: 45
        },
        advanced: {
          name: 'Advanced Power Program',
          exercises: [
            { id: '1', name: 'Power Clean', sets: 5, reps: 3, weight: 0, completed: false, category: 'strength' as const },
            { id: '2', name: 'Snatch', sets: 5, reps: 2, weight: 0, completed: false, category: 'strength' as const },
            { id: '3', name: 'Deadlift', sets: 5, reps: 5, weight: 0, completed: false, category: 'strength' as const },
            { id: '4', name: 'Bench Press', sets: 5, reps: 5, weight: 0, completed: false, category: 'strength' as const },
            { id: '5', name: 'Squat', sets: 5, reps: 5, weight: 0, completed: false, category: 'strength' as const },
          ],
          duration: 60
        }
      },
      weight_loss: {
        beginner: {
          name: 'Beginner Fat Burner',
          exercises: [
            { id: '1', name: 'Walking', sets: 1, reps: 20, weight: 0, completed: false, category: 'cardio' as const },
            { id: '2', name: 'Bodyweight Squats', sets: 3, reps: 15, weight: 0, completed: false, category: 'strength' as const },
            { id: '3', name: 'Push-ups', sets: 3, reps: 8, weight: 0, completed: false, category: 'strength' as const },
            { id: '4', name: 'Jumping Jacks', sets: 3, reps: 20, weight: 0, completed: false, category: 'cardio' as const },
          ],
          duration: 25
        },
        intermediate: {
          name: 'Intermediate Fat Burner',
          exercises: [
            { id: '1', name: 'Running', sets: 1, reps: 20, weight: 0, completed: false, category: 'cardio' as const },
            { id: '2', name: 'Burpees', sets: 4, reps: 10, weight: 0, completed: false, category: 'cardio' as const },
            { id: '3', name: 'Mountain Climbers', sets: 3, reps: 30, weight: 0, completed: false, category: 'cardio' as const },
            { id: '4', name: 'Dumbbell Rows', sets: 3, reps: 12, weight: 0, completed: false, category: 'strength' as const },
            { id: '5', name: 'Plank', sets: 3, reps: 45, weight: 0, completed: false, category: 'strength' as const },
          ],
          duration: 40
        },
        advanced: {
          name: 'Advanced Fat Burner',
          exercises: [
            { id: '1', name: 'HIIT Sprints', sets: 8, reps: 30, weight: 0, completed: false, category: 'cardio' as const },
            { id: '2', name: 'Box Jumps', sets: 4, reps: 15, weight: 0, completed: false, category: 'cardio' as const },
            { id: '3', name: 'Kettlebell Swings', sets: 4, reps: 20, weight: 0, completed: false, category: 'strength' as const },
            { id: '4', name: 'Burpees', sets: 5, reps: 15, weight: 0, completed: false, category: 'cardio' as const },
            { id: '5', name: 'Turkish Get-ups', sets: 3, reps: 5, weight: 0, completed: false, category: 'strength' as const },
          ],
          duration: 50
        }
      }
    };

    const plan = plans[goal as keyof typeof plans]?.[level as keyof typeof plans[keyof typeof plans]];
    
    if (!plan) {
      // Default plan if not found
      return {
        id: Date.now().toString(),
        name: 'Custom Workout',
        level: level as any,
        goal: goal as any,
        exercises: [
          { id: '1', name: 'Push-ups', sets: 3, reps: 10, weight: 0, completed: false, category: 'strength' as const },
          { id: '2', name: 'Squats', sets: 3, reps: 15, weight: 0, completed: false, category: 'strength' as const },
        ],
        duration: 30
      };
    }

    return {
      id: Date.now().toString(),
      name: plan.name,
      level: level as any,
      goal: goal as any,
      exercises: plan.exercises,
      duration: plan.duration
    };
  };

  const handleGenerateWorkout = () => {
    if (!selectedGoal || !selectedLevel) {
      Alert.alert('Error', 'Please select both a goal and experience level');
      return;
    }

    const workout = generateWorkoutPlan(selectedGoal, selectedLevel);
    setCurrentWorkout(workout);
    setExerciseLogs([...workout.exercises]);
    setShowWorkoutModal(true);
    setCurrentExerciseIndex(0);
  };

  const handleExerciseComplete = (exerciseId: string, weight: number, reps: number) => {
    setExerciseLogs(prev => prev.map(ex => 
      ex.id === exerciseId 
        ? { ...ex, weight, reps, completed: true }
        : ex
    ));
  };

  const handleFinishWorkout = () => {
    const completedExercises = exerciseLogs.filter(ex => ex.completed);
    if (completedExercises.length === 0) {
      Alert.alert('Error', 'Please complete at least one exercise');
      return;
    }

    const workoutLog: WorkoutLog = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      planId: currentWorkout!.id,
      exercises: completedExercises,
      notes,
      duration: currentWorkout!.duration
    };

    setWorkoutLogs(prev => [workoutLog, ...prev]);
    setShowWorkoutModal(false);
    setCurrentWorkout(null);
    setExerciseLogs([]);
    setNotes('');
    Alert.alert('Success', 'Workout completed and logged!');
  };

  const getCompletionRate = () => {
    if (!currentWorkout) return 0;
    const completed = exerciseLogs.filter(ex => ex.completed).length;
    return Math.round((completed / currentWorkout.exercises.length) * 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Planner</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Goal Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's your fitness goal?</Text>
          <View style={styles.goalsGrid}>
            {goals.map(goal => (
              <TouchableOpacity
                key={goal.id}
                style={[
                  styles.goalCard,
                  selectedGoal === goal.id && styles.goalCardSelected
                ]}
                onPress={() => setSelectedGoal(goal.id)}
              >
                <Text style={styles.goalName}>{goal.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Level Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's your experience level?</Text>
          <View style={styles.levelsContainer}>
            {levels.map(level => (
              <TouchableOpacity
                key={level.id}
                style={[
                  styles.levelCard,
                  selectedLevel === level.id && styles.levelCardSelected
                ]}
                onPress={() => setSelectedLevel(level.id)}
              >
                <Text style={styles.levelName}>{level.name}</Text>
                <Text style={styles.levelDescription}>{level.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Generate Workout Button */}
        <TouchableOpacity
          style={[styles.generateButton, (!selectedGoal || !selectedLevel) && styles.generateButtonDisabled]}
          onPress={handleGenerateWorkout}
          disabled={!selectedGoal || !selectedLevel}
        >
          <Text style={styles.generateButtonText}>Generate Workout Plan</Text>
        </TouchableOpacity>

        {/* Recent Workouts */}
        {workoutLogs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
            {workoutLogs.slice(0, 3).map(log => (
              <View key={log.id} style={styles.workoutLog}>
                <Text style={styles.workoutDate}>
                  {new Date(log.date).toLocaleDateString()}
                </Text>
                <Text style={styles.workoutStats}>
                  {log.exercises.length} exercises • {log.duration} min
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Workout Modal */}
      <Modal
        visible={showWorkoutModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowWorkoutModal(false)}>
              <Text style={styles.closeButton}>X</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{currentWorkout?.name}</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalScrollView}>
            {/* Progress */}
            <View style={styles.progressSection}>
              <Text style={styles.progressText}>
                {getCompletionRate()}% Complete
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${getCompletionRate()}%` }
                  ]} 
                />
              </View>
            </View>

            {/* Current Exercise */}
            {currentWorkout && currentExerciseIndex < currentWorkout.exercises.length && (
              <View style={styles.currentExercise}>
                <Text style={styles.exerciseTitle}>
                  {currentWorkout.exercises[currentExerciseIndex].name}
                </Text>
                <Text style={styles.exerciseDetails}>
                  {currentWorkout.exercises[currentExerciseIndex].sets} sets • {currentWorkout.exercises[currentExerciseIndex].reps} reps
                </Text>
                
                <View style={styles.inputRow}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Weight (lbs)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="0"
                      value={exerciseLogs[currentExerciseIndex]?.weight?.toString() || ''}
                      onChangeText={(text) => {
                        const newLogs = [...exerciseLogs];
                        newLogs[currentExerciseIndex] = {
                          ...newLogs[currentExerciseIndex],
                          weight: parseInt(text) || 0
                        };
                        setExerciseLogs(newLogs);
                      }}
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Reps</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder={currentWorkout.exercises[currentExerciseIndex].reps.toString()}
                      value={exerciseLogs[currentExerciseIndex]?.reps?.toString() || ''}
                      onChangeText={(text) => {
                        const newLogs = [...exerciseLogs];
                        newLogs[currentExerciseIndex] = {
                          ...newLogs[currentExerciseIndex],
                          reps: parseInt(text) || currentWorkout.exercises[currentExerciseIndex].reps
                        };
                        setExerciseLogs(newLogs);
                      }}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => {
                    const exercise = exerciseLogs[currentExerciseIndex];
                    if (exercise.weight === 0 && exercise.reps === 0) {
                      Alert.alert('Error', 'Please enter weight and reps');
                      return;
                    }
                    handleExerciseComplete(
                      exercise.id,
                      exercise.weight,
                      exercise.reps
                    );
                    if (currentExerciseIndex < currentWorkout.exercises.length - 1) {
                      setCurrentExerciseIndex(currentExerciseIndex + 1);
                    }
                  }}
                >
                  <Text style={styles.completeButtonText}>Complete Exercise</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Exercise List */}
            <View style={styles.exerciseList}>
              <Text style={styles.exerciseListTitle}>All Exercises</Text>
              {currentWorkout?.exercises.map((exercise, index) => (
                <View key={exercise.id} style={styles.exerciseItem}>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseSets}>
                      {exercise.sets} sets • {exercise.reps} reps
                    </Text>
                  </View>
                  <View style={[
                    styles.exerciseStatus,
                    exerciseLogs[index]?.completed && styles.exerciseCompleted
                  ]}>
                    <Text style={styles.exerciseStatusText}>
                      {exerciseLogs[index]?.completed ? 'DONE' : 'PENDING'}
                    </Text>
                  </View>
                </View>
              ))}
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

            {/* Finish Workout */}
            <TouchableOpacity
              style={styles.finishButton}
              onPress={handleFinishWorkout}
            >
              <Text style={styles.finishButtonText}>Finish Workout</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  scrollView: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  goalCard: {
    width: '48%',
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  goalCardSelected: {
    borderColor: '#00ff88',
    backgroundColor: '#2a2a2a',
  },
  goalName: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  levelsContainer: {
    gap: 15,
  },
  levelCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  levelCardSelected: {
    borderColor: '#00ff88',
  },
  levelName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  levelDescription: {
    fontSize: 14,
    color: '#888',
  },
  generateButton: {
    backgroundColor: '#00ff88',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
    marginBottom: 30,
  },
  generateButtonDisabled: {
    backgroundColor: '#333',
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  workoutLog: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  workoutDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  workoutStats: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    color: '#ff6b6b',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalScrollView: {
    flex: 1,
    padding: 20,
  },
  progressSection: {
    marginBottom: 30,
  },
  progressText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
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
  exerciseDetails: {
    fontSize: 16,
    color: '#888',
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  completeButton: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
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
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseCompleted: {
    backgroundColor: '#00ff88',
  },
  exerciseStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
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
  },
  finishButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
    marginBottom: 30,
  },
  finishButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
}); 
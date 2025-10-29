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

interface ProgramExecutionScreenProps {
  program: WorkoutProgram;
  onBack: () => void;
  onComplete: (session: WorkoutSession) => void;
}

export default function ProgramExecutionScreen({ program, onBack, onComplete }: ProgramExecutionScreenProps) {
  console.log('ProgramExecutionScreen rendered with program:', program);
  
  // All hooks must be called in the same order every time
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exerciseData, setExerciseData] = useState<Array<{
    exerciseId: string;
    name: string;
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

  useEffect(() => {
    // Initialize exercise data with error handling
    try {
      if (!program || !program.exercises || program.exercises.length === 0) {
        console.error('Invalid program data:', program);
        setExerciseData([]);
        return;
      }

      const initialData = program.exercises.map(exercise => ({
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
    } catch (error) {
      console.error('Error initializing exercise data:', error);
      setExerciseData([]);
    }
  }, [program]);


  const handleSetComplete = (exerciseIndex: number, setIndex: number, weight: number, reps: number) => {
    const newData = [...exerciseData];
    newData[exerciseIndex].sets[setIndex] = {
      ...newData[exerciseIndex].sets[setIndex],
      weight,
      reps,
      completed: true,
    };
    setExerciseData(newData);

    // Set completed successfully
  };

  const handleExerciseComplete = () => {
    if (currentExerciseIndex < program.exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      // Reset inputs for the next exercise
      resetInputsForNextExercise();
    }
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
  };

  const handleWorkoutComplete = () => {
    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60); // in minutes

    const session: WorkoutSession = {
      id: Date.now().toString(),
      programId: program.id,
      programName: program.name,
      date: startTime.toISOString(),
      duration,
      exercises: exerciseData,
      notes,
      completed: true,
    };

    onComplete(session);
    Alert.alert('Workout Complete!', `Great job! You completed ${program.name} in ${duration} minutes.`);
  };

  const getCompletionRate = () => {
    const totalSets = exerciseData.reduce((acc, exercise) => acc + exercise.sets.length, 0);
    const completedSets = exerciseData.reduce((acc, exercise) => 
      acc + exercise.sets.filter(set => set.completed).length, 0
    );
    return Math.round((completedSets / totalSets) * 100);
  };

  // All hooks must be called before any conditional returns
  const currentExercise = program?.exercises?.[currentExerciseIndex];
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
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Current Exercise */}
        <View style={styles.currentExercise}>
          <Text style={styles.exerciseTitle}>{currentExercise.name}</Text>
          <Text style={styles.exerciseInstructions}>{currentExercise.instructions}</Text>
          
          {currentExerciseData?.sets?.map((set, setIndex) => (
            <SetTracker
              key={setIndex}
              set={set}
              setIndex={setIndex}
              onComplete={(weight, reps) => handleSetComplete(currentExerciseIndex, setIndex, weight, reps)}
            />
          )) || null}

          <TouchableOpacity
            style={styles.nextExerciseButton}
            onPress={handleExerciseComplete}
            disabled={currentExerciseIndex >= program.exercises.length - 1}
          >
            <Text style={styles.nextExerciseButtonText}>
              {currentExerciseIndex >= program.exercises.length - 1 ? 'Complete Workout' : 'Next Exercise'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Exercise List */}
        <View style={styles.exerciseList}>
          <Text style={styles.exerciseListTitle}>All Exercises</Text>
          {program?.exercises?.map((exercise, index) => (
            <View key={exercise.id} style={styles.exerciseItem}>
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseSets}>
                  {exercise.sets} sets • {exercise.reps} reps
                </Text>
              </View>
              <View style={[
                styles.exerciseStatus,
                index < currentExerciseIndex && styles.exerciseCompleted
              ]}>
                <Text style={styles.exerciseStatusText}>
                  {index < currentExerciseIndex ? 'DONE' : index === currentExerciseIndex ? 'CURRENT' : 'PENDING'}
                </Text>
              </View>
            </View>
          )) || null}
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

        {/* Complete Workout */}
        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleWorkoutComplete}
        >
          <Text style={styles.completeButtonText}>Complete Workout</Text>
        </TouchableOpacity>
      </ScrollView>

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
  onComplete: (weight: number, reps: number) => void;
}

const SetTracker = ({ set, setIndex, onComplete }: SetTrackerProps) => {
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
      <Text style={styles.setNumber}>Set {set.setNumber}</Text>
      
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
            editable={!set.completed}
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
            editable={!set.completed}
          />
        </View>
      </View>

      {!set.completed ? (
        <TouchableOpacity style={styles.completeSetButton} onPress={handleComplete}>
          <Text style={styles.completeSetButtonText}>Complete Set</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.completedSet}>
          <Text style={styles.completedSetText}>DONE</Text>
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
  completedSet: {
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
  nextExerciseButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  nextExerciseButtonText: {
    fontSize: 18,
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
});

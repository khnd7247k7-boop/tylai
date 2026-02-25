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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WorkoutSession } from './data/workoutPrograms';
import { saveUserData, loadUserData } from './src/utils/userStorage';
import { exerciseDatabase, getExerciseData } from './src/data/exerciseDatabase';

interface LogPastWorkoutScreenProps {
  onBack: () => void;
  onComplete: (session: WorkoutSession) => void;
}

interface ExerciseEntry {
  id: string;
  name: string;
  sets: Array<{
    setNumber: number;
    weight: string;
    reps: string;
    completed: boolean;
  }>;
}

export default function LogPastWorkoutScreen({ onBack, onComplete }: LogPastWorkoutScreenProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  });
  const [workoutName, setWorkoutName] = useState('');
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [savedPlans, setSavedPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  useEffect(() => {
    loadSavedPlans();
  }, []);

  const loadSavedPlans = async () => {
    try {
      const plans = await loadUserData<any[]>('savedWorkoutPlans') || [];
      setSavedPlans(plans);
    } catch (error) {
      console.error('Error loading saved plans:', error);
    }
  };

  const handleDateChange = (daysAgo: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() - daysAgo);
    setSelectedDate(newDate);
  };

  const handleSearchExercise = (query: string) => {
    setExerciseSearch(query);
    if (query.trim().length > 0) {
      const filtered = exerciseDatabase
        .filter(ex => ex.name.toLowerCase().includes(query.toLowerCase()))
        .map(ex => ex.name)
        .slice(0, 10);
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  };

  const handleAddExercise = (exerciseName: string) => {
    const exerciseData = getExerciseData(exerciseName);
    if (!exerciseData) {
      Alert.alert('Error', 'Exercise not found');
      return;
    }

    const newExercise: ExerciseEntry = {
      id: Date.now().toString(),
      name: exerciseName,
      sets: [
        { setNumber: 1, weight: '', reps: '', completed: false },
        { setNumber: 2, weight: '', reps: '', completed: false },
        { setNumber: 3, weight: '', reps: '', completed: false },
      ],
    };

    setExercises([...exercises, newExercise]);
    setExerciseSearch('');
    setSearchResults([]);
  };

  const handleAddSet = (exerciseId: string) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        return {
          ...ex,
          sets: [...ex.sets, {
            setNumber: ex.sets.length + 1,
            weight: '',
            reps: '',
            completed: false,
          }],
        };
      }
      return ex;
    }));
  };

  const handleRemoveSet = (exerciseId: string, setNumber: number) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        return {
          ...ex,
          sets: ex.sets.filter(s => s.setNumber !== setNumber).map((s, idx) => ({
            ...s,
            setNumber: idx + 1,
          })),
        };
      }
      return ex;
    }));
  };

  const handleRemoveExercise = (exerciseId: string) => {
    setExercises(exercises.filter(ex => ex.id !== exerciseId));
  };

  const handleSetChange = (exerciseId: string, setNumber: number, field: 'weight' | 'reps', value: string) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        return {
          ...ex,
          sets: ex.sets.map(set => {
            if (set.setNumber === setNumber) {
              return {
                ...set,
                [field]: value,
                completed: value.trim() !== '',
              };
            }
            return set;
          }),
        };
      }
      return ex;
    }));
  };

  const handleLoadPlan = (plan: any) => {
    setSelectedPlan(plan);
    setWorkoutName(plan.name);
    setSelectedDayIndex(null);
    setExercises([]);
    
    // If plan has multiple days, don't load exercises yet - wait for day selection
    if (plan.weeklyPlan && plan.weeklyPlan.weekDays && plan.weeklyPlan.weekDays.length > 1) {
      // User needs to select a day first
      return;
    }
    
    // Load exercises from plan (single day or no weekly plan)
    loadExercisesFromPlan(plan, 0);
  };

  const loadExercisesFromPlan = (plan: any, dayIndex: number) => {
    const planExercises: ExerciseEntry[] = [];
    
    if (plan.weeklyPlan && plan.weeklyPlan.weekDays && plan.weeklyPlan.weekDays.length > 0) {
      // Use selected day's exercises
      const dayExercises = plan.weeklyPlan.weekDays[dayIndex].exercises;
      dayExercises.forEach((ex: any, idx: number) => {
        planExercises.push({
          id: `plan-${dayIndex}-${idx}`,
          name: ex.name,
          sets: Array.from({ length: ex.sets || 3 }, (_, i) => ({
            setNumber: i + 1,
            weight: '',
            reps: '',
            completed: false,
          })),
        });
      });
      // Update workout name to include day name
      const dayName = plan.weeklyPlan.weekDays[dayIndex].dayName || `Day ${dayIndex + 1}`;
      setWorkoutName(`${plan.name} - ${dayName}`);
    } else if (plan.exercises) {
      plan.exercises.forEach((ex: any, idx: number) => {
        planExercises.push({
          id: `plan-${idx}`,
          name: ex.name,
          sets: Array.from({ length: ex.sets || 3 }, (_, i) => ({
            setNumber: i + 1,
            weight: '',
            reps: '',
            completed: false,
          })),
        });
      });
    }
    
    setExercises(planExercises);
  };

  const handleSelectDay = (dayIndex: number) => {
    if (!selectedPlan) return;
    setSelectedDayIndex(dayIndex);
    loadExercisesFromPlan(selectedPlan, dayIndex);
  };

  const handleSave = async () => {
    if (!workoutName.trim()) {
      Alert.alert('Error', 'Please enter a workout name');
      return;
    }

    if (exercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    // Validate that at least one set has data
    const hasData = exercises.some(ex => 
      ex.sets.some(set => set.weight.trim() !== '' || set.reps.trim() !== '')
    );

    if (!hasData) {
      Alert.alert('Error', 'Please enter weight and/or reps for at least one set');
      return;
    }

    // Create workout session
    const completedExercises = exercises.map(ex => ({
      exerciseId: ex.id,
      name: ex.name,
      sets: ex.sets
        .filter(set => set.weight.trim() !== '' || set.reps.trim() !== '')
        .map(set => ({
          setNumber: set.setNumber,
          weight: parseFloat(set.weight) || 0,
          reps: parseFloat(set.reps) || 0,
          restTime: 60,
          completed: true,
        })),
    })).filter(ex => ex.sets.length > 0);

    if (completedExercises.length === 0) {
      Alert.alert('Error', 'Please complete at least one exercise');
      return;
    }

    // Create date string for the selected date (set to noon to avoid timezone issues)
    const workoutDate = new Date(selectedDate);
    workoutDate.setHours(12, 0, 0, 0);
    const dateString = workoutDate.toISOString();

    const session: WorkoutSession = {
      id: Date.now().toString(),
      programId: selectedPlan?.id || 'manual',
      programName: workoutName,
      date: dateString,
      duration: completedExercises.length * 5, // Estimate 5 min per exercise
      exercises: completedExercises,
      notes: '',
      completed: true,
    };

    // Save to history
    try {
      const existingHistory = await loadUserData<WorkoutSession[]>('workoutHistory') || [];
      const updatedHistory = [session, ...existingHistory];
      await saveUserData('workoutHistory', updatedHistory);
      
      Alert.alert('Success', 'Past workout logged successfully!', [
        {
          text: 'OK',
          onPress: () => {
            onComplete(session);
            onBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Error saving past workout:', error);
      Alert.alert('Error', 'Failed to save workout');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log Past Workout</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Date</Text>
          <View style={styles.dateSelector}>
            <TouchableOpacity
              style={[styles.dateButton, selectedDate.getDate() === new Date().getDate() - 1 && styles.dateButtonSelected]}
              onPress={() => handleDateChange(1)}
            >
              <Text style={styles.dateButtonText}>Yesterday</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateButton, selectedDate.getDate() === new Date().getDate() - 2 && styles.dateButtonSelected]}
              onPress={() => handleDateChange(2)}
            >
              <Text style={styles.dateButtonText}>2 Days Ago</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateButton, selectedDate.getDate() === new Date().getDate() - 3 && styles.dateButtonSelected]}
              onPress={() => handleDateChange(3)}
            >
              <Text style={styles.dateButtonText}>3 Days Ago</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.selectedDateText}>
            Selected: {formatDate(selectedDate)}
          </Text>
        </View>

        {/* Workout Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Upper Body, Leg Day, Full Body"
            value={workoutName}
            onChangeText={setWorkoutName}
            autoCapitalize="words"
          />
        </View>

        {/* Load from Saved Plan */}
        {savedPlans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Load from Saved Plan (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.plansScroll}>
              {savedPlans.slice(0, 5).map(plan => (
                <TouchableOpacity
                  key={plan.id}
                  style={[styles.planCard, selectedPlan?.id === plan.id && styles.planCardSelected]}
                  onPress={() => handleLoadPlan(plan)}
                >
                  <Text style={styles.planCardName}>{plan.name}</Text>
                  <Text style={styles.planCardInfo}>
                    {plan.weeklyPlan?.weekDays?.length > 1 
                      ? `${plan.weeklyPlan.weekDays.length} days`
                      : `${plan.exercises?.length || plan.weeklyPlan?.weekDays[0]?.exercises?.length || 0} exercises`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Day Selection for Multi-Day Plans */}
        {selectedPlan && selectedPlan.weeklyPlan && selectedPlan.weeklyPlan.weekDays && selectedPlan.weeklyPlan.weekDays.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Workout Day</Text>
            <View style={styles.daySelector}>
              {selectedPlan.weeklyPlan.weekDays.map((day: any, index: number) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayButton,
                    selectedDayIndex === index && styles.dayButtonSelected
                  ]}
                  onPress={() => handleSelectDay(index)}
                >
                  <Text style={[
                    styles.dayButtonText,
                    selectedDayIndex === index && styles.dayButtonTextSelected
                  ]}>
                    {day.dayName || `Day ${index + 1}`}
                  </Text>
                  <Text style={[
                    styles.dayButtonSubtext,
                    selectedDayIndex === index && styles.dayButtonSubtextSelected
                  ]}>
                    {day.exercises?.length || 0} exercises
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Add Exercise */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Exercise</Text>
          <TextInput
            style={styles.input}
            placeholder="Search for exercise..."
            value={exerciseSearch}
            onChangeText={handleSearchExercise}
            autoCapitalize="words"
          />
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map(exerciseName => (
                <TouchableOpacity
                  key={exerciseName}
                  style={styles.searchResultItem}
                  onPress={() => handleAddExercise(exerciseName)}
                >
                  <Text style={styles.searchResultText}>{exerciseName}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Exercises List */}
        {exercises.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exercises ({exercises.length})</Text>
            {exercises.map((exercise, exIdx) => (
              <View key={exercise.id} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveExercise(exercise.id)}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
                
                {exercise.sets.map((set) => (
                  <View key={set.setNumber} style={styles.setRow}>
                    <Text style={styles.setNumber}>Set {set.setNumber}</Text>
                    <TextInput
                      style={styles.setInput}
                      placeholder="Weight"
                      value={set.weight}
                      onChangeText={(value) => handleSetChange(exercise.id, set.setNumber, 'weight', value)}
                      keyboardType="numeric"
                    />
                    <Text style={styles.setLabel}>lbs</Text>
                    <TextInput
                      style={styles.setInput}
                      placeholder="Reps"
                      value={set.reps}
                      onChangeText={(value) => handleSetChange(exercise.id, set.setNumber, 'reps', value)}
                      keyboardType="numeric"
                    />
                    <Text style={styles.setLabel}>reps</Text>
                    {exercise.sets.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeSetButton}
                        onPress={() => handleRemoveSet(exercise.id, set.setNumber)}
                      >
                        <Text style={styles.removeSetButtonText}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                
                <TouchableOpacity
                  style={styles.addSetButton}
                  onPress={() => handleAddSet(exercise.id)}
                >
                  <Text style={styles.addSetButtonText}>+ Add Set</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Workout</Text>
        </TouchableOpacity>
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
  scrollView: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  dateSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  dateButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  dateButtonSelected: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  dateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedDateText: {
    color: '#888',
    fontSize: 14,
    marginTop: 5,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  plansScroll: {
    marginTop: 10,
  },
  planCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 15,
    marginRight: 10,
    minWidth: 150,
    borderWidth: 1,
    borderColor: '#333',
  },
  planCardSelected: {
    borderColor: '#00ff88',
    backgroundColor: '#2a4a2a',
  },
  planCardName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  planCardInfo: {
    color: '#888',
    fontSize: 12,
  },
  searchResults: {
    marginTop: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    maxHeight: 200,
  },
  searchResultItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchResultText: {
    color: '#fff',
    fontSize: 14,
  },
  exerciseCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  setNumber: {
    width: 60,
    color: '#888',
    fontSize: 14,
  },
  setInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  setLabel: {
    width: 40,
    color: '#888',
    fontSize: 12,
  },
  removeSetButton: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addSetButton: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addSetButtonText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  daySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  dayButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  dayButtonSelected: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  dayButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  dayButtonTextSelected: {
    color: '#1a1a1a',
  },
  dayButtonSubtext: {
    color: '#888',
    fontSize: 12,
  },
  dayButtonSubtextSelected: {
    color: '#1a1a1a',
    opacity: 0.7,
  },
});


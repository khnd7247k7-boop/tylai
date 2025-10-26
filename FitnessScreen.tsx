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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import WorkoutScreen from './WorkoutScreen';
import ProgramExecutionScreen from './ProgramExecutionScreen';
import { workoutPrograms, WorkoutProgram, WorkoutSession } from './data/workoutPrograms';
import TabSwipeNavigation from './TabSwipeNavigation';

interface MacroLog {
  id: string;
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
}

interface Meal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
  date: string;
}

interface SavedMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timesUsed: number;
  lastUsed: string;
}

interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
}

interface WorkoutHistory {
  id: string;
  date: string;
  name: string;
  duration: number;
  exercises: number;
}

interface CompletedTask {
  id: string;
  title: string;
  category: 'fitness' | 'mindset' | 'spiritual' | 'emotional';
  completedAt: string;
  completed: boolean;
}

export default function FitnessScreen({ onBack, onCompleteTask }: { onBack: () => void; onCompleteTask: (taskTitle: string) => void }) {
  const [activeTab, setActiveTab] = useState<'workouts' | 'nutrition' | 'history' | 'tasks'>('workouts');
  const [macroLogs, setMacroLogs] = useState<MacroLog[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSavedMeals, setShowSavedMeals] = useState(false);
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals>({
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 80,
    water: 64
  });
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [editGoals, setEditGoals] = useState({
    protein: '150',
    carbs: '250',
    fat: '80',
    water: '64'
  });
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [showWorkoutScreen, setShowWorkoutScreen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<WorkoutProgram | null>(null);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([
    { id: '1', title: '30-minute cardio workout', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '2', title: 'Strength training - upper body', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '3', title: 'Lower body strength training', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '4', title: 'Core workout (15 minutes)', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '5', title: 'Stretching and flexibility', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '6', title: 'HIIT workout (20 minutes)', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
  ]);

  // Load all data from AsyncStorage on component mount
  useEffect(() => {
    loadWorkoutHistory();
    loadSavedMeals();
    loadNutritionGoals();
    loadMeals();
    loadCompletedTasks();
  }, []);

  const loadWorkoutHistory = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem('workoutHistory');
      console.log('Loading workout history:', savedHistory);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        console.log('Parsed workout history:', parsedHistory);
        setWorkoutHistory(parsedHistory);
      }
    } catch (error) {
      console.error('Error loading workout history:', error);
    }
  };

  const saveWorkoutHistory = async (history: WorkoutSession[]) => {
    try {
      console.log('Saving workout history:', history);
      await AsyncStorage.setItem('workoutHistory', JSON.stringify(history));
      console.log('Successfully saved to AsyncStorage');
    } catch (error) {
      console.error('Error saving workout history:', error);
    }
  };

  const loadSavedMeals = async () => {
    try {
      const savedMealsData = await AsyncStorage.getItem('savedMeals');
      console.log('Loading saved meals:', savedMealsData);
      if (savedMealsData) {
        const parsedMeals = JSON.parse(savedMealsData);
        console.log('Parsed saved meals:', parsedMeals);
        setSavedMeals(parsedMeals);
      }
    } catch (error) {
      console.error('Error loading saved meals:', error);
    }
  };

  const saveSavedMeals = async (meals: SavedMeal[]) => {
    try {
      console.log('Saving saved meals:', meals);
      await AsyncStorage.setItem('savedMeals', JSON.stringify(meals));
      console.log('Saved meals saved successfully');
    } catch (error) {
      console.error('Error saving saved meals:', error);
    }
  };

  const loadNutritionGoals = async () => {
    try {
      const savedGoals = await AsyncStorage.getItem('nutritionGoals');
      console.log('Loading nutrition goals:', savedGoals);
      if (savedGoals) {
        const parsedGoals = JSON.parse(savedGoals);
        console.log('Parsed nutrition goals:', parsedGoals);
        setNutritionGoals(parsedGoals);
      }
    } catch (error) {
      console.error('Error loading nutrition goals:', error);
    }
  };

  const saveNutritionGoals = async (goals: NutritionGoals) => {
    try {
      console.log('Saving nutrition goals:', goals);
      await AsyncStorage.setItem('nutritionGoals', JSON.stringify(goals));
      console.log('Nutrition goals saved successfully');
    } catch (error) {
      console.error('Error saving nutrition goals:', error);
    }
  };

  const loadMeals = async () => {
    try {
      const savedMeals = await AsyncStorage.getItem('meals');
      console.log('Loading meals:', savedMeals);
      if (savedMeals) {
        const parsedMeals = JSON.parse(savedMeals);
        console.log('Parsed meals:', parsedMeals);
        setMeals(parsedMeals);
      }
    } catch (error) {
      console.error('Error loading meals:', error);
    }
  };

  const saveMeals = async (meals: Meal[]) => {
    try {
      console.log('Saving meals:', meals);
      await AsyncStorage.setItem('meals', JSON.stringify(meals));
      console.log('Meals saved successfully');
    } catch (error) {
      console.error('Error saving meals:', error);
    }
  };

  const loadCompletedTasks = async () => {
    try {
      const savedTasks = await AsyncStorage.getItem('completedTasks');
      console.log('Loading completed tasks:', savedTasks);
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks);
        console.log('Parsed completed tasks:', parsedTasks);
        setCompletedTasks(parsedTasks);
      }
    } catch (error) {
      console.error('Error loading completed tasks:', error);
    }
  };

  const saveCompletedTasks = async (tasks: CompletedTask[]) => {
    try {
      console.log('Saving completed tasks:', tasks);
      await AsyncStorage.setItem('completedTasks', JSON.stringify(tasks));
      console.log('Completed tasks saved successfully');
    } catch (error) {
      console.error('Error saving completed tasks:', error);
    }
  };

  const [todayMacros, setTodayMacros] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    water: '',
  });

  const [mealInput, setMealInput] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    time: '',
  });

  const handleMacroSubmit = () => {
    if (!todayMacros.calories || !todayMacros.protein || !todayMacros.carbs || !todayMacros.fat) {
      Alert.alert('Error', 'Please fill in all macro fields');
      return;
    }

    const newLog: MacroLog = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      calories: parseInt(todayMacros.calories),
      protein: parseInt(todayMacros.protein),
      carbs: parseInt(todayMacros.carbs),
      fat: parseInt(todayMacros.fat),
      water: parseInt(todayMacros.water) || 0,
    };

    setMacroLogs(prev => [newLog, ...prev]);
    setTodayMacros({ calories: '', protein: '', carbs: '', fat: '', water: '' });
    Alert.alert('Success', 'Macros logged successfully!');
  };

  // Calculate calories from macros (4 cal/g protein, 4 cal/g carbs, 9 cal/g fat)
  const calculateCaloriesFromMacros = (protein: number, carbs: number, fat: number) => {
    return (protein * 4) + (carbs * 4) + (fat * 9);
  };

  const handleMealSubmit = () => {
    if (!mealInput.name || !mealInput.protein || !mealInput.carbs || !mealInput.fat) {
      Alert.alert('Error', 'Please fill in meal name and all macro fields');
      return;
    }

    const protein = parseInt(mealInput.protein);
    const carbs = parseInt(mealInput.carbs);
    const fat = parseInt(mealInput.fat);
    const calculatedCalories = calculateCaloriesFromMacros(protein, carbs, fat);

    const newMeal: Meal = {
      id: Date.now().toString(),
      name: mealInput.name,
      calories: calculatedCalories,
      protein: protein,
      carbs: carbs,
      fat: fat,
      time: mealInput.time || new Date().toLocaleTimeString(),
      date: new Date().toISOString(),
    };

    // Add to today's meals
    const updatedMeals = [newMeal, ...meals];
    setMeals(updatedMeals);
    saveMeals(updatedMeals);

    // Save to saved meals for future use
    const existingSavedMeal = savedMeals.find(meal => meal.name.toLowerCase() === mealInput.name.toLowerCase());
    if (existingSavedMeal) {
      // Update existing saved meal
      const updatedMeals = savedMeals.map(meal => 
        meal.id === existingSavedMeal.id 
          ? { ...meal, timesUsed: meal.timesUsed + 1, lastUsed: new Date().toISOString() }
          : meal
      );
      setSavedMeals(updatedMeals);
      saveSavedMeals(updatedMeals);
    } else {
      // Add new saved meal
      const newSavedMeal: SavedMeal = {
        id: Date.now().toString(),
        name: mealInput.name,
        calories: calculatedCalories,
        protein: protein,
        carbs: carbs,
        fat: fat,
        timesUsed: 1,
        lastUsed: new Date().toISOString(),
      };
      const updatedMeals = [newSavedMeal, ...savedMeals];
      setSavedMeals(updatedMeals);
      saveSavedMeals(updatedMeals);
    }

    setMealInput({ name: '', calories: '', protein: '', carbs: '', fat: '', time: '' });
    Alert.alert('Success', 'Meal logged successfully!');
  };

  const handleUseSavedMeal = (savedMeal: SavedMeal) => {
    const newMeal: Meal = {
      id: Date.now().toString(),
      name: savedMeal.name,
      calories: savedMeal.calories,
      protein: savedMeal.protein,
      carbs: savedMeal.carbs,
      fat: savedMeal.fat,
      time: new Date().toLocaleTimeString(),
      date: new Date().toISOString(),
    };

    const updatedTodayMeals = [newMeal, ...meals];
    setMeals(updatedTodayMeals);
    saveMeals(updatedTodayMeals);
    
    // Update saved meal usage
    const updatedSavedMeals = savedMeals.map(meal => 
      meal.id === savedMeal.id 
        ? { ...meal, timesUsed: meal.timesUsed + 1, lastUsed: new Date().toISOString() }
        : meal
    );
    setSavedMeals(updatedSavedMeals);
    saveSavedMeals(updatedSavedMeals);

    Alert.alert('Success', `${savedMeal.name} added to today's meals!`);
  };

  const handleEditGoals = () => {
    setIsEditingGoals(true);
    setEditGoals({
      protein: nutritionGoals.protein.toString(),
      carbs: nutritionGoals.carbs.toString(),
      fat: nutritionGoals.fat.toString(),
      water: nutritionGoals.water.toString()
    });
  };

  const handleSaveGoals = () => {
    if (!editGoals.protein || !editGoals.carbs || !editGoals.fat || !editGoals.water) {
      Alert.alert('Error', 'Please fill in all macro goal fields');
      return;
    }

    const protein = parseInt(editGoals.protein);
    const carbs = parseInt(editGoals.carbs);
    const fat = parseInt(editGoals.fat);
    const calculatedCalories = calculateCaloriesFromMacros(protein, carbs, fat);

    const newGoals = {
      calories: calculatedCalories,
      protein: protein,
      carbs: carbs,
      fat: fat,
      water: parseInt(editGoals.water)
    };
    setNutritionGoals(newGoals);
    saveNutritionGoals(newGoals);
    setIsEditingGoals(false);
    Alert.alert('Success', 'Goals updated successfully!');
  };

  const handleCancelEdit = () => {
    setIsEditingGoals(false);
    setEditGoals({
      protein: nutritionGoals.protein.toString(),
      carbs: nutritionGoals.carbs.toString(),
      fat: nutritionGoals.fat.toString(),
      water: nutritionGoals.water.toString()
    });
  };

  const handleProgramSelect = (program: WorkoutProgram) => {
    console.log('Selected program:', program);
    setSelectedProgram(program);
  };

  const handleWorkoutComplete = async (session: WorkoutSession) => {
    console.log('Workout completed, session:', session);
    const newHistory = [session, ...workoutHistory];
    console.log('New history:', newHistory);
    setWorkoutHistory(newHistory);
    await saveWorkoutHistory(newHistory);
    console.log('Workout history saved to AsyncStorage');
    setSelectedProgram(null);
    
    // Automatically complete fitness tasks when workout is finished
    onCompleteTask('workout');
    onCompleteTask('cardio');
    onCompleteTask('strength');
  };

  const toggleTaskCompletion = (taskId: string) => {
    const updatedTasks = completedTasks.map(task => 
      task.id === taskId 
        ? { ...task, completed: !task.completed, completedAt: new Date().toISOString() }
        : task
    );
    setCompletedTasks(updatedTasks);
    saveCompletedTasks(updatedTasks);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      fitness: '#FF6B6B',
      mindset: '#4ECDC4',
      spiritual: '#45B7D1',
      emotional: '#96CEB4'
    };
    return colors[category as keyof typeof colors] || '#888';
  };

  const getCategoryTitle = (category: string) => {
    const titles = {
      fitness: 'Fitness',
      mindset: 'Mindset',
      spiritual: 'Spiritual',
      emotional: 'Emotional'
    };
    return titles[category as keyof typeof titles] || category;
  };

  const TabButton = ({ tab, title }: { tab: string, title: string }) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
      onPress={() => setActiveTab(tab as any)}
    >
      <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderWorkouts = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity
        style={styles.startWorkoutButton}
        onPress={() => setShowWorkoutScreen(true)}
      >
        <Text style={styles.startWorkoutButtonText}>Start Custom Workout</Text>
      </TouchableOpacity>
      
      <View style={styles.workoutPrograms}>
        <Text style={styles.sectionTitle}>Workout Programs</Text>
        
        {workoutPrograms && workoutPrograms.length > 0 ? workoutPrograms.map((program, index) => {
          const isFirstInCategory = index === 0 || 
            workoutPrograms[index - 1].category !== program.category;
          
          return (
            <View key={program.id}>
              {isFirstInCategory && (
                <Text style={styles.programCategory}>
                  {program.category === 'strength' && 'Strength Building'}
                  {program.category === 'muscle_building' && 'Muscle Building'}
                  {program.category === 'cardio' && 'Cardio & Conditioning'}
                  {program.category === 'bodyweight' && 'Bodyweight Training'}
                </Text>
              )}
              
              <TouchableOpacity
                style={styles.programCard}
                onPress={() => handleProgramSelect(program)}
              >
                <Text style={styles.programTitle}>{program.name}</Text>
                <Text style={styles.programDescription}>{program.description}</Text>
                <Text style={styles.programDuration}>
                  {program.duration} min • {program.frequency}x/week • {program.focus}
                </Text>
                <Text style={styles.programLevel}>
                  {program.level.charAt(0).toUpperCase() + program.level.slice(1)}
                </Text>
                <Text style={styles.programEquipment}>
                  Equipment: {program.equipment.join(', ')}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No workout programs available</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderMacros = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Today's Macros</Text>
      
      <View style={styles.macroInputs}>
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>Calories</Text>
          <TextInput
            style={styles.macroInput}
            placeholder="2000"
            value={todayMacros.calories}
            onChangeText={(text) => setTodayMacros(prev => ({ ...prev, calories: text }))}
            keyboardType="numeric"
          />
        </View>
        
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>Protein (g)</Text>
          <TextInput
            style={styles.macroInput}
            placeholder="150"
            value={todayMacros.protein}
            onChangeText={(text) => setTodayMacros(prev => ({ ...prev, protein: text }))}
            keyboardType="numeric"
          />
        </View>
        
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>Carbs (g)</Text>
          <TextInput
            style={styles.macroInput}
            placeholder="250"
            value={todayMacros.carbs}
            onChangeText={(text) => setTodayMacros(prev => ({ ...prev, carbs: text }))}
            keyboardType="numeric"
          />
        </View>
        
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>Fat (g)</Text>
          <TextInput
            style={styles.macroInput}
            placeholder="80"
            value={todayMacros.fat}
            onChangeText={(text) => setTodayMacros(prev => ({ ...prev, fat: text }))}
            keyboardType="numeric"
          />
        </View>
        
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>Water (oz)</Text>
          <TextInput
            style={styles.macroInput}
            placeholder="64"
            value={todayMacros.water}
            onChangeText={(text) => setTodayMacros(prev => ({ ...prev, water: text }))}
            keyboardType="numeric"
          />
        </View>
      </View>
      
      <TouchableOpacity style={styles.logButton} onPress={handleMacroSubmit}>
        <Text style={styles.logButtonText}>Log Macros</Text>
      </TouchableOpacity>
      
      {macroLogs.length > 0 && (
        <View style={styles.macroHistory}>
          <Text style={styles.sectionTitle}>Recent Logs</Text>
          {macroLogs.slice(0, 5).map(log => (
            <View key={log.id} style={styles.macroLog}>
              <Text style={styles.macroDate}>
                {new Date(log.date).toLocaleDateString()}
              </Text>
              <Text style={styles.macroStats}>
                {log.calories} cal • {log.protein}g protein • {log.water}oz water
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderHistory = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Workout History</Text>
      
      {/* Debug info */}
      <Text style={styles.debugText}>History count: {workoutHistory.length}</Text>
      
      {/* Test button for debugging */}
      <TouchableOpacity 
        style={styles.testButton} 
        onPress={async () => {
          const testSession: WorkoutSession = {
            id: Date.now().toString(),
            programId: 'test',
            programName: 'Test Workout',
            date: new Date().toISOString(),
            duration: 30,
            exercises: [{
              exerciseId: 'test-exercise',
              name: 'Test Exercise',
              sets: [{
                setNumber: 1,
                reps: 10,
                weight: 100,
                restTime: 60,
                completed: true
              }]
            }],
            notes: 'Test workout for debugging',
            completed: true
          };
          await handleWorkoutComplete(testSession);
        }}
      >
        <Text style={styles.testButtonText}>Add Test Workout</Text>
      </TouchableOpacity>
      
      {workoutHistory.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No workouts completed yet</Text>
          <Text style={styles.emptyStateSubtext}>Start your first workout to see your history here</Text>
        </View>
      ) : (
        workoutHistory.map(session => (
          <View key={session.id} style={styles.historyItem}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyDate}>
                {new Date(session.date).toLocaleDateString()}
              </Text>
              <Text style={styles.historyName}>{session.programName}</Text>
              <Text style={styles.historyStats}>
                {session.duration} min • {session.exercises.length} exercises
              </Text>
            </View>
            
            {/* Exercise Details */}
            <View style={styles.exerciseDetails}>
              <Text style={styles.exerciseDetailsTitle}>Exercise Details:</Text>
              {session.exercises.map((exercise, index) => {
                // Group sets by weight and reps
                const groupedSets = exercise.sets.reduce((groups, set) => {
                  const key = `${set.weight}lbs × ${set.reps} reps`;
                  if (!groups[key]) {
                    groups[key] = [];
                  }
                  groups[key].push(set);
                  return groups;
                }, {} as Record<string, typeof exercise.sets>);

                return (
                  <View key={exercise.exerciseId} style={styles.exerciseDetail}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <View style={styles.setsContainer}>
                      {Object.entries(groupedSets).map(([setData, sets]) => (
                        <View key={setData} style={styles.setDetail}>
                          <Text style={styles.setData}>
                            {setData}
                            {sets.length > 1 && (
                              <Text style={styles.setCount}> (×{sets.length})</Text>
                            )}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
            
            {session.notes && (
              <Text style={styles.historyNotes}>Notes: {session.notes}</Text>
            )}
          </View>
        ))
      )}
    </View>
  );

  const renderNutrition = () => {
    // Calculate today's totals from meals
    const today = new Date().toDateString();
    const todayMeals = meals.filter(meal => new Date(meal.date).toDateString() === today);
    const todayTotals = todayMeals.reduce((totals, meal) => ({
      calories: totals.calories + meal.calories,
      protein: totals.protein + meal.protein,
      carbs: totals.carbs + meal.carbs,
      fat: totals.fat + meal.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const remaining = {
      calories: Math.max(0, nutritionGoals.calories - todayTotals.calories),
      protein: Math.max(0, nutritionGoals.protein - todayTotals.protein),
      carbs: Math.max(0, nutritionGoals.carbs - todayTotals.carbs),
      fat: Math.max(0, nutritionGoals.fat - todayTotals.fat),
    };

    return (
      <View style={styles.tabContent}>
        {/* Nutrition Goals */}
        <View style={styles.goalsSection}>
          <View style={styles.goalsHeader}>
            <Text style={styles.sectionTitle}>Daily Goals</Text>
            {!isEditingGoals ? (
              <TouchableOpacity style={styles.editButton} onPress={handleEditGoals}>
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveGoals}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {!isEditingGoals ? (
            <View style={styles.goalsGrid}>
              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>Calories</Text>
                <Text style={styles.goalValue}>{nutritionGoals.calories}</Text>
              </View>
              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>Protein (g)</Text>
                <Text style={styles.goalValue}>{nutritionGoals.protein}</Text>
              </View>
              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>Carbs (g)</Text>
                <Text style={styles.goalValue}>{nutritionGoals.carbs}</Text>
              </View>
              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>Fat (g)</Text>
                <Text style={styles.goalValue}>{nutritionGoals.fat}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.editGoalsForm}>
              <View style={styles.editGoalRow}>
                <Text style={styles.editGoalLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.editGoalInput}
                  value={editGoals.protein}
                  onChangeText={(text) => setEditGoals(prev => ({ ...prev, protein: text }))}
                  keyboardType="numeric"
                  placeholder="150"
                />
              </View>
              <View style={styles.editGoalRow}>
                <Text style={styles.editGoalLabel}>Carbs (g)</Text>
                <TextInput
                  style={styles.editGoalInput}
                  value={editGoals.carbs}
                  onChangeText={(text) => setEditGoals(prev => ({ ...prev, carbs: text }))}
                  keyboardType="numeric"
                  placeholder="250"
                />
              </View>
              <View style={styles.editGoalRow}>
                <Text style={styles.editGoalLabel}>Fat (g)</Text>
                <TextInput
                  style={styles.editGoalInput}
                  value={editGoals.fat}
                  onChangeText={(text) => setEditGoals(prev => ({ ...prev, fat: text }))}
                  keyboardType="numeric"
                  placeholder="80"
                />
              </View>
              <View style={styles.editGoalRow}>
                <Text style={styles.editGoalLabel}>Water (oz)</Text>
                <TextInput
                  style={styles.editGoalInput}
                  value={editGoals.water}
                  onChangeText={(text) => setEditGoals(prev => ({ ...prev, water: text }))}
                  keyboardType="numeric"
                  placeholder="64"
                />
              </View>
              {editGoals.protein && editGoals.carbs && editGoals.fat && (
                <View style={styles.calculatedCaloriesGoal}>
                  <Text style={styles.calculatedCaloriesGoalText}>
                    Calculated Daily Calories: {calculateCaloriesFromMacros(
                      parseInt(editGoals.protein) || 0,
                      parseInt(editGoals.carbs) || 0,
                      parseInt(editGoals.fat) || 0
                    )}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Today's Progress */}
        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>Today's Progress</Text>
          <View style={styles.progressGrid}>
            <View style={styles.progressItem}>
              <Text style={styles.progressLabel}>Calories</Text>
              <Text style={styles.progressValue}>{todayTotals.calories} / {nutritionGoals.calories}</Text>
              <Text style={[styles.remainingText, { color: remaining.calories > 0 ? '#ff6b6b' : '#00ff88' }]}>
                {remaining.calories > 0 ? `${remaining.calories} remaining` : 'Goal reached!'}
              </Text>
            </View>
            <View style={styles.progressItem}>
              <Text style={styles.progressLabel}>Protein</Text>
              <Text style={styles.progressValue}>{todayTotals.protein}g / {nutritionGoals.protein}g</Text>
              <Text style={[styles.remainingText, { color: remaining.protein > 0 ? '#ff6b6b' : '#00ff88' }]}>
                {remaining.protein > 0 ? `${remaining.protein}g remaining` : 'Goal reached!'}
              </Text>
            </View>
            <View style={styles.progressItem}>
              <Text style={styles.progressLabel}>Carbs</Text>
              <Text style={styles.progressValue}>{todayTotals.carbs}g / {nutritionGoals.carbs}g</Text>
              <Text style={[styles.remainingText, { color: remaining.carbs > 0 ? '#ff6b6b' : '#00ff88' }]}>
                {remaining.carbs > 0 ? `${remaining.carbs}g remaining` : 'Goal reached!'}
              </Text>
            </View>
            <View style={styles.progressItem}>
              <Text style={styles.progressLabel}>Fat</Text>
              <Text style={styles.progressValue}>{todayTotals.fat}g / {nutritionGoals.fat}g</Text>
              <Text style={[styles.remainingText, { color: remaining.fat > 0 ? '#ff6b6b' : '#00ff88' }]}>
                {remaining.fat > 0 ? `${remaining.fat}g remaining` : 'Goal reached!'}
              </Text>
            </View>
          </View>
        </View>

        {/* Add Meal */}
        <View style={styles.mealSection}>
          <View style={styles.mealSectionHeader}>
            <Text style={styles.sectionTitle}>Add Meal</Text>
            <TouchableOpacity 
              style={styles.savedMealsButton} 
              onPress={() => setShowSavedMeals(!showSavedMeals)}
            >
              <Text style={styles.savedMealsButtonText}>
                {showSavedMeals ? 'Hide' : 'Show'} Saved Meals
              </Text>
            </TouchableOpacity>
          </View>

          {/* Saved Meals Search */}
          {showSavedMeals && (
            <View style={styles.savedMealsSection}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search saved meals..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <View style={styles.savedMealsList}>
                {savedMeals
                  .filter(meal => meal.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .sort((a, b) => b.timesUsed - a.timesUsed)
                  .map(meal => (
                    <TouchableOpacity
                      key={meal.id}
                      style={styles.savedMealItem}
                      onPress={() => handleUseSavedMeal(meal)}
                    >
                      <View style={styles.savedMealInfo}>
                        <Text style={styles.savedMealName}>{meal.name}</Text>
                        <Text style={styles.savedMealMacros}>
                          {meal.calories} cal • {meal.protein}g protein • {meal.carbs}g carbs • {meal.fat}g fat
                        </Text>
                        <Text style={styles.savedMealUsage}>Used {meal.timesUsed} times</Text>
                      </View>
                      <Text style={styles.useMealButton}>Use</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          )}

          <View style={styles.mealInputs}>
            <TextInput
              style={styles.mealInput}
              placeholder="Meal name (e.g., Breakfast, Lunch)"
              value={mealInput.name}
              onChangeText={(text) => setMealInput(prev => ({ ...prev, name: text }))}
            />
            <View style={styles.macroRow}>
              <Text style={styles.macroLabel}>Protein (g)</Text>
              <TextInput
                style={styles.macroInput}
                placeholder="0"
                value={mealInput.protein}
                onChangeText={(text) => setMealInput(prev => ({ ...prev, protein: text }))}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.macroRow}>
              <Text style={styles.macroLabel}>Carbs (g)</Text>
              <TextInput
                style={styles.macroInput}
                placeholder="0"
                value={mealInput.carbs}
                onChangeText={(text) => setMealInput(prev => ({ ...prev, carbs: text }))}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.macroRow}>
              <Text style={styles.macroLabel}>Fat (g)</Text>
              <TextInput
                style={styles.macroInput}
                placeholder="0"
                value={mealInput.fat}
                onChangeText={(text) => setMealInput(prev => ({ ...prev, fat: text }))}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.macroRow}>
              <Text style={styles.macroLabel}>Time (optional)</Text>
              <TextInput
                style={styles.macroInput}
                placeholder="12:00 PM"
                value={mealInput.time}
                onChangeText={(text) => setMealInput(prev => ({ ...prev, time: text }))}
              />
            </View>
            {mealInput.protein && mealInput.carbs && mealInput.fat && (
              <View style={styles.calculatedCalories}>
                <Text style={styles.calculatedCaloriesText}>
                  Calculated Calories: {calculateCaloriesFromMacros(
                    parseInt(mealInput.protein) || 0,
                    parseInt(mealInput.carbs) || 0,
                    parseInt(mealInput.fat) || 0
                  )}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.logButton} onPress={handleMealSubmit}>
            <Text style={styles.logButtonText}>Add Meal</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Meals */}
        {todayMeals.length > 0 && (
          <View style={styles.mealsList}>
            <Text style={styles.sectionTitle}>Today's Meals</Text>
            {todayMeals.map(meal => (
              <View key={meal.id} style={styles.mealItem}>
                <View style={styles.mealHeader}>
                  <Text style={styles.mealName}>{meal.name}</Text>
                  <Text style={styles.mealTime}>{meal.time}</Text>
                </View>
                <View style={styles.mealMacros}>
                  <Text style={styles.mealMacro}>{meal.calories} cal</Text>
                  <Text style={styles.mealMacro}>{meal.protein}g protein</Text>
                  <Text style={styles.mealMacro}>{meal.carbs}g carbs</Text>
                  <Text style={styles.mealMacro}>{meal.fat}g fat</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderTasks = () => {
    const fitnessTasks = completedTasks.filter(task => task.category === 'fitness');
    const completedCount = fitnessTasks.filter(task => task.completed).length;
    const totalCount = fitnessTasks.length;
    const categoryColor = getCategoryColor('fitness');
    
    return (
      <View style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Fitness Tasks</Text>
        <Text style={styles.sectionSubtitle}>Check off fitness tasks you've completed today</Text>
        
        <View style={styles.taskCategorySection}>
          <View style={styles.taskCategoryHeader}>
            <Text style={[styles.taskCategoryTitle, { color: categoryColor }]}>
              Fitness
            </Text>
            <Text style={styles.taskCategoryProgress}>
              {completedCount}/{totalCount}
            </Text>
          </View>
          
          {fitnessTasks.map(task => (
            <TouchableOpacity
              key={task.id}
              style={styles.taskItem}
              onPress={() => toggleTaskCompletion(task.id)}
            >
              <View style={[
                styles.taskCheckbox,
                task.completed && { backgroundColor: categoryColor }
              ]}>
                {task.completed && <Text style={styles.taskCheckmark}>DONE</Text>}
              </View>
              <Text style={[
                styles.taskText,
                task.completed && styles.taskTextCompleted
              ]}>
                {task.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.taskSummary}>
          <Text style={styles.taskSummaryTitle}>Fitness Progress</Text>
          <Text style={styles.taskSummaryText}>
            {completedCount} of {totalCount} fitness tasks completed
          </Text>
        </View>
      </View>
    );
  };

  if (showWorkoutScreen) {
    return (
      <WorkoutScreen 
        onBack={() => setShowWorkoutScreen(false)} 
      />
    );
  }

  if (selectedProgram) {
    return (
      <ProgramExecutionScreen
        program={selectedProgram}
        onBack={() => setSelectedProgram(null)}
        onComplete={handleWorkoutComplete}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fitness</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TabButton tab="workouts" title="Workouts" />
        <TabButton tab="nutrition" title="Nutrition" />
        <TabButton tab="history" title="History" />
        <TabButton tab="tasks" title="Tasks" />
      </View>

      {/* Content */}
      <TabSwipeNavigation
        tabs={['workouts', 'nutrition', 'history', 'tasks']}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as any)}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {activeTab === 'workouts' && renderWorkouts()}
          {activeTab === 'nutrition' && renderNutrition()}
          {activeTab === 'history' && renderHistory()}
          {activeTab === 'tasks' && renderTasks()}
        </ScrollView>
      </TabSwipeNavigation>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginVertical: 15,
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  tabButtonActive: {
    backgroundColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textAlign: 'center',
    lineHeight: 16,
  },
  tabButtonTextActive: {
    color: '#1a1a1a',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  tabContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  startWorkoutButton: {
    backgroundColor: '#00ff88',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
    marginBottom: 30,
  },
  startWorkoutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  workoutPrograms: {
    marginBottom: 30,
  },
  programCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  programTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  programDescription: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  programDuration: {
    fontSize: 12,
    color: '#00ff88',
    fontWeight: '600',
    marginBottom: 4,
  },
  programCategory: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 15,
    marginLeft: 5,
  },
  programLevel: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  programEquipment: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
  historyNotes: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  macroInputs: {
    marginBottom: 20,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  macroLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    flex: 1,
  },
  macroInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    width: 120,
    textAlign: 'center',
  },
  logButton: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  logButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  macroHistory: {
    marginTop: 20,
  },
  macroLog: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  macroDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  macroStats: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  historyItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  historyName: {
    fontSize: 14,
    color: '#00ff88',
    marginTop: 2,
  },
  historyStats: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  historyHeader: {
    marginBottom: 15,
  },
  exerciseDetails: {
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  exerciseDetailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  exerciseDetail: {
    marginBottom: 15,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 8,
  },
  setsContainer: {
    marginLeft: 10,
  },
  setDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 2,
  },
  setNumber: {
    fontSize: 12,
    color: '#ccc',
    fontWeight: '600',
  },
  setData: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  setCount: {
    fontSize: 12,
    color: '#00ff88',
    fontWeight: 'bold',
  },
  debugText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
    textAlign: 'center',
  },
  testButton: {
    backgroundColor: '#ff6b6b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Task styles
  sectionSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 20,
    textAlign: 'center',
  },
  taskCategorySection: {
    marginBottom: 25,
  },
  taskCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  taskCategoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  taskCategoryProgress: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 5,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    marginBottom: 8,
  },
  taskCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheckmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  taskText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  taskTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  taskSummary: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
    alignItems: 'center',
  },
  taskSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  taskSummaryText: {
    fontSize: 16,
    color: '#00ff88',
    fontWeight: '600',
  },
  // Nutrition styles
  goalsSection: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  goalsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  editButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    backgroundColor: '#ff6b6b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#00ff88',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveButtonText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: 'bold',
  },
  editGoalsForm: {
    gap: 15,
  },
  editGoalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editGoalLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    flex: 1,
  },
  editGoalInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    width: 100,
    textAlign: 'center',
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  goalItem: {
    width: '48%',
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
  },
  goalLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 5,
  },
  goalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressSection: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  progressItem: {
    width: '48%',
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 5,
  },
  progressValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  remainingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mealSection: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  mealSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  savedMealsButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  savedMealsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  savedMealsSection: {
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  searchInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 15,
  },
  savedMealsList: {
    maxHeight: 200,
  },
  savedMealItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  savedMealInfo: {
    flex: 1,
  },
  savedMealName: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  savedMealMacros: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 2,
  },
  savedMealUsage: {
    fontSize: 12,
    color: '#4ECDC4',
  },
  useMealButton: {
    backgroundColor: '#00ff88',
    color: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 'bold',
  },
  calculatedCalories: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  calculatedCaloriesText: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  calculatedCaloriesGoal: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  calculatedCaloriesGoalText: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  mealInputs: {
    marginBottom: 20,
  },
  mealInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 15,
  },
  mealsList: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  mealItem: {
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mealName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  mealTime: {
    fontSize: 12,
    color: '#888',
  },
  mealMacros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  mealMacro: {
    fontSize: 12,
    color: '#00ff88',
    marginRight: 10,
    marginBottom: 5,
  },
});

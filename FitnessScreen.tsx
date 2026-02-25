import React, { useState, useEffect, useRef } from 'react';
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
  TouchableWithoutFeedback,
  Keyboard,
  AppState,
  Dimensions,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import WorkoutScreen from './WorkoutScreen';
import ProgramExecutionScreen from './ProgramExecutionScreen';
import BuildYourOwnWorkoutScreen from './BuildYourOwnWorkoutScreen';
import SavedPlanViewScreen from './SavedPlanViewScreen';
import WorkoutHistoryDetailScreen from './WorkoutHistoryDetailScreen';
import LogPastWorkoutScreen from './LogPastWorkoutScreen';
import { workoutPrograms, WorkoutProgram, WorkoutSession } from './data/workoutPrograms';
import TabSwipeNavigation from './TabSwipeNavigation';
import BarcodeScanner from './BarcodeScanner';
import { saveUserData, loadUserData } from './src/utils/userStorage';
import AIService, { ProgramAdaptation } from './AIService';
import HealthService from './src/services/HealthService';

interface MacroLog {
  id: string;
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
}

interface Micronutrients {
  fiber?: number;
  sugar?: number;
  sodium?: number;
  calcium?: number;
  iron?: number;
  potassium?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
  vitaminE?: number;
  vitaminK?: number;
  thiamin?: number;
  riboflavin?: number;
  niacin?: number;
  vitaminB6?: number;
  folate?: number;
  vitaminB12?: number;
  biotin?: number;
  pantothenicAcid?: number;
  phosphorus?: number;
  iodine?: number;
  magnesium?: number;
  zinc?: number;
  selenium?: number;
  copper?: number;
  manganese?: number;
  chromium?: number;
  molybdenum?: number;
  chloride?: number;
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
  servings?: number; // Number of servings consumed
  baseProtein?: number; // Protein per serving
  baseCarbs?: number; // Carbs per serving
  baseFat?: number; // Fat per serving
  micronutrients?: Micronutrients;
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

interface WeightEntry {
  id: string;
  date: string;
  weight: number; // in pounds
}

// Unit Picker Wheel Component
const UnitPickerWheel = ({ 
  units, 
  selectedUnit, 
  onUnitChange 
}: { 
  units: string[]; 
  selectedUnit: string; 
  onUnitChange: (unit: string) => void;
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const ITEM_HEIGHT = 50;
  const VISIBLE_ITEMS = 3;
  const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case 'g': return 'grams';
      case 'oz': return 'oz';
      case 'tbsp': return 'tbsp';
      case 'tsp': return 'tsp';
      case 'cup': return 'cup';
      case 'piece': return 'piece';
      default: return unit;
    }
  };

  useEffect(() => {
    const selectedIndex = units.indexOf(selectedUnit);
    if (selectedIndex !== -1 && scrollViewRef.current) {
      const offsetY = selectedIndex * ITEM_HEIGHT;
      // Use requestAnimationFrame for better timing
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: offsetY, animated: false });
      });
    }
  }, []);

  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, units.length - 1));
    const selectedUnitFromScroll = units[clampedIndex];
    
    if (selectedUnitFromScroll !== selectedUnit) {
      onUnitChange(selectedUnitFromScroll);
    }
  };

  const handleMomentumScrollEnd = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, units.length - 1));
    const offsetY = clampedIndex * ITEM_HEIGHT;
    
    scrollViewRef.current?.scrollTo({ y: offsetY, animated: true });
  };

  const handleItemPress = (unit: string, index: number) => {
    const offsetY = index * ITEM_HEIGHT;
    scrollViewRef.current?.scrollTo({ y: offsetY, animated: true });
    onUnitChange(unit);
  };

  return (
    <View style={styles.unitPickerContainer}>
      <View style={styles.unitPickerWrapper}>
        {/* Top scroll indicator */}
        <View style={styles.unitPickerScrollIndicator} pointerEvents="none">
          <Text style={styles.unitPickerScrollIndicatorText}>⌃</Text>
        </View>
        
        {/* Top gradient overlay */}
        <View style={styles.unitPickerOverlay} pointerEvents="none" />
        
        <ScrollView
          ref={scrollViewRef}
          style={styles.unitPickerScrollView}
          contentContainerStyle={styles.unitPickerContentContainer}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
          scrollEnabled={true}
          bounces={true}
        >
          {units.map((unit, index) => {
            const isSelected = unit === selectedUnit;
            return (
              <TouchableOpacity
                key={unit}
                activeOpacity={0.7}
                style={[
                  styles.unitPickerItem,
                  { height: ITEM_HEIGHT },
                  isSelected && styles.unitPickerItemSelected
                ]}
                onPress={() => handleItemPress(unit, index)}
              >
                <Text style={[
                  styles.unitPickerItemText,
                  isSelected && styles.unitPickerItemTextSelected
                ]}>
                  {getUnitLabel(unit)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        
        {/* Bottom gradient overlay */}
        <View style={[styles.unitPickerOverlay, styles.unitPickerOverlayBottom]} pointerEvents="none" />
        
        {/* Bottom scroll indicator */}
        <View style={[styles.unitPickerScrollIndicator, styles.unitPickerScrollIndicatorBottom]} pointerEvents="none">
          <Text style={styles.unitPickerScrollIndicatorText}>⌄</Text>
        </View>
        
        {/* Selection indicator */}
        <View style={styles.unitPickerSelectionIndicator} pointerEvents="none" />
      </View>
    </View>
  );
};

export default function FitnessScreen({ onBack, onCompleteTask }: { onBack: () => void; onCompleteTask: (taskTitle: string) => void }) {
  // Expose internal back handler for swipe navigation
  const handleInternalBack = () => {
    if (selectedProgram) {
      setSelectedProgram(null);
    } else if (selectedHistorySession) {
      setSelectedHistorySession(null);
    } else if (selectedSavedPlan) {
      setSelectedSavedPlan(null);
      loadSavedWorkoutPlans();
      loadWorkoutHistory();
    } else if (showBuildYourOwnScreen) {
      setShowBuildYourOwnScreen(false);
      loadSavedWorkoutPlans();
      loadActivePlans();
    } else if (showWorkoutScreen) {
      setShowWorkoutScreen(false);
      loadSavedWorkoutPlans();
      loadActivePlans();
    } else if (showLogPastWorkout) {
      setShowLogPastWorkout(false);
    } else {
      onBack();
    }
  };

  // Store the handler for App.tsx to access
  React.useEffect(() => {
    (FitnessScreen as any).internalBackHandler = handleInternalBack;
    return () => {
      delete (FitnessScreen as any).internalBackHandler;
    };
  }, [selectedProgram, selectedHistorySession, selectedSavedPlan, showBuildYourOwnScreen, showWorkoutScreen, showLogPastWorkout]);
  const [activeTab, setActiveTab] = useState<'workouts' | 'nutrition' | 'history'>('workouts');
  const [macroLogs, setMacroLogs] = useState<MacroLog[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSavedMeals, setShowSavedMeals] = useState(false);
  const [mealsTab, setMealsTab] = useState<'today' | 'saved'>('today');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
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
  const [showBuildYourOwnScreen, setShowBuildYourOwnScreen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<WorkoutProgram | null>(null);
  const [selectedSavedPlan, setSelectedSavedPlan] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'strength' | 'muscle_building' | 'cardio' | 'bodyweight' | null>(null);
  const [workoutPlanTab, setWorkoutPlanTab] = useState<'programs' | 'myPlans'>('programs');
  const [selectedHistorySession, setSelectedHistorySession] = useState<WorkoutSession | null>(null);
  const [historyCalendarMonth, setHistoryCalendarMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [expandedDayItems, setExpandedDayItems] = useState<Set<string>>(new Set());
  const [showLogPastWorkout, setShowLogPastWorkout] = useState(false);
  const [savedWorkoutPlans, setSavedWorkoutPlans] = useState<any[]>([]);
  const [activePlans, setActivePlans] = useState<string[]>([]);
  const [planAdaptations, setPlanAdaptations] = useState<Map<string, ProgramAdaptation[]>>(new Map());
  const [healthTrends, setHealthTrends] = useState<{
    averageWorkoutHeartRate: number | null;
    weeklyCalories: number;
    weeklySteps: number;
    weeklyDistance: number;
    last7DaysHeartRate: Array<{ date: string; avg: number }>;
  } | null>(null);
  const [loadingHealthData, setLoadingHealthData] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([
    { id: '1', title: '30-minute cardio workout', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '2', title: 'Strength training - upper body', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '3', title: 'Lower body strength training', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '4', title: 'Core workout (15 minutes)', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '5', title: 'Stretching and flexibility', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '6', title: 'HIIT workout (20 minutes)', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
  ]);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightDateInput, setWeightDateInput] = useState(new Date().toISOString().split('T')[0]);

  // Notifications removed per request
  const showToast = (_message: string, _type: 'success' | 'error' = 'success') => {};

  // Load all data from AsyncStorage on component mount
  useEffect(() => {
    loadWorkoutHistory();
    loadSavedMeals();
    loadNutritionGoals();
    loadMeals();
    loadCompletedTasks();
    loadSavedWorkoutPlans();
    loadActivePlans();
    loadWeightEntries();
  }, []);

  // Reload workout history when switching to history tab
  useEffect(() => {
    if (activeTab === 'history') {
      loadWorkoutHistory();
      // Reset calendar to current month when opening history tab
      setHistoryCalendarMonth(new Date());
    }
  }, [activeTab]);


  // Analyze performance for active plans
  useEffect(() => {
    if (workoutHistory.length > 0 && savedWorkoutPlans.length > 0) {
      const adaptationsMap = new Map<string, ProgramAdaptation[]>();
      activePlans.forEach(planId => {
        const plan = savedWorkoutPlans.find(p => p.id === planId);
        if (plan) {
          const adaptations = AIService.analyzeWorkoutPerformance(workoutHistory, plan);
          if (adaptations.length > 0) {
            adaptationsMap.set(planId, adaptations);
          }
        }
      });
      setPlanAdaptations(adaptationsMap);
    }
  }, [workoutHistory, savedWorkoutPlans, activePlans]);

  const loadSavedWorkoutPlans = async () => {
    try {
      const saved = await loadUserData<any[]>('savedWorkoutPlans');
      if (saved) {
        setSavedWorkoutPlans(saved);
      }
    } catch (error) {
      console.error('Error loading saved workout plans:', error);
    }
  };

  const loadActivePlans = async () => {
    try {
      const active = await loadUserData<string[]>('activeWorkoutPlans');
      if (active) {
        setActivePlans(active);
      }
    } catch (error) {
      console.error('Error loading active plans:', error);
    }
  };

  const togglePlanActive = async (planId: string) => {
    try {
      let updatedActive = [...activePlans];
      if (updatedActive.includes(planId)) {
        updatedActive = updatedActive.filter(id => id !== planId);
      } else {
        updatedActive.push(planId);
      }
      setActivePlans(updatedActive);
      await saveUserData('activeWorkoutPlans', updatedActive);
    } catch (error) {
      console.error('Error toggling active plan:', error);
    }
  };

  const deletePlan = async (planId: string) => {
    Alert.alert(
      'Delete Plan',
      'Are you sure you want to delete this workout plan? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from saved plans
              const updatedPlans = savedWorkoutPlans.filter(p => p.id !== planId);
              await saveUserData('savedWorkoutPlans', updatedPlans);
              setSavedWorkoutPlans(updatedPlans);
              
              // Remove from active plans if it was active
              const updatedActive = activePlans.filter(id => id !== planId);
              if (updatedActive.length !== activePlans.length) {
                setActivePlans(updatedActive);
                await saveUserData('activeWorkoutPlans', updatedActive);
              }
              
              // Close the saved plan view if it's open
              if (selectedSavedPlan && selectedSavedPlan.id === planId) {
                setSelectedSavedPlan(null);
              }
              
              Alert.alert('Success', 'Workout plan deleted successfully');
            } catch (error) {
              console.error('Error deleting plan:', error);
              Alert.alert('Error', 'Failed to delete workout plan');
            }
          },
        },
      ]
    );
  };

  const loadWorkoutHistory = async () => {
    try {
      const parsedHistory = await loadUserData<WorkoutSession[]>('workoutHistory');
      console.log('Loading workout history:', parsedHistory);
      if (parsedHistory) {
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
      await saveUserData('workoutHistory', history);
      console.log('Successfully saved to AsyncStorage');
    } catch (error) {
      console.error('Error saving workout history:', error);
    }
  };

  const loadSavedMeals = async () => {
    try {
      const parsedMeals = await loadUserData<SavedMeal[]>('savedMeals');
      console.log('Loading saved meals:', parsedMeals);
      if (parsedMeals) {
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
      await saveUserData('savedMeals', meals);
      console.log('Saved meals saved successfully');
    } catch (error) {
      console.error('Error saving saved meals:', error);
    }
  };

  const loadNutritionGoals = async () => {
    try {
      const parsedGoals = await loadUserData<NutritionGoals>('nutritionGoals');
      console.log('Loading nutrition goals:', parsedGoals);
      if (parsedGoals) {
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
      await saveUserData('nutritionGoals', goals);
      console.log('Nutrition goals saved successfully');
    } catch (error) {
      console.error('Error saving nutrition goals:', error);
    }
  };

  const loadMeals = async () => {
    try {
      const parsedMeals = await loadUserData<Meal[]>('meals');
      console.log('Loading meals:', parsedMeals);
      if (parsedMeals) {
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
      await saveUserData('meals', meals);
      console.log('Meals saved successfully');
    } catch (error) {
      console.error('Error saving meals:', error);
    }
  };

  const loadCompletedTasks = async () => {
    try {
      const today = new Date().toDateString();
      const lastResetDate = await loadUserData<string>('completedTasksLastReset');
      const parsedTasks = await loadUserData<CompletedTask[]>('completedTasks');
      
      console.log('Loading completed tasks:', parsedTasks);
      console.log('Last reset date:', lastResetDate);
      console.log('Today:', today);
      
      if (parsedTasks) {
        console.log('Parsed completed tasks:', parsedTasks);
        
        // If it's a new day, reset all task completions
        if (lastResetDate !== today) {
          console.log('New day detected - resetting fitness task completions');
          const resetTasks = parsedTasks.map(task => ({
            ...task,
            completed: false,
            completedAt: new Date().toISOString()
          }));
          setCompletedTasks(resetTasks);
          await saveCompletedTasks(resetTasks);
          await saveUserData('completedTasksLastReset', today);
        } else {
          setCompletedTasks(parsedTasks);
        }
      } else {
        // First time loading - set reset date
        await saveUserData('completedTasksLastReset', today);
      }
    } catch (error) {
      console.error('Error loading completed tasks:', error);
    }
  };

  const saveCompletedTasks = async (tasks: CompletedTask[]) => {
    try {
      console.log('Saving completed tasks:', tasks);
      await saveUserData('completedTasks', tasks);
      console.log('Completed tasks saved successfully');
    } catch (error) {
      console.error('Error saving completed tasks:', error);
    }
  };

  const loadWeightEntries = async () => {
    try {
      const parsedEntries = await loadUserData<WeightEntry[]>('weightEntries');
      if (parsedEntries) {
        // Sort by date (newest first)
        const sorted = parsedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setWeightEntries(sorted);
      }
    } catch (error) {
      console.error('Error loading weight entries:', error);
    }
  };

  const saveWeightEntries = async (entries: WeightEntry[]) => {
    try {
      await saveUserData('weightEntries', entries);
    } catch (error) {
      console.error('Error saving weight entries:', error);
    }
  };

  const handleAddWeight = async () => {
    const weight = parseFloat(weightInput);
    if (!weight || weight <= 0) {
      return;
    }

    const newEntry: WeightEntry = {
      id: Date.now().toString(),
      date: new Date(weightDateInput).toISOString(),
      weight: weight,
    };

    // Check if entry for this date already exists, update it if so
    const existingIndex = weightEntries.findIndex(
      e => new Date(e.date).toDateString() === new Date(weightDateInput).toDateString()
    );

    let updatedEntries: WeightEntry[];
    if (existingIndex >= 0) {
      updatedEntries = [...weightEntries];
      updatedEntries[existingIndex] = newEntry;
    } else {
      updatedEntries = [newEntry, ...weightEntries];
    }

    // Sort by date (newest first)
    updatedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    setWeightEntries(updatedEntries);
    await saveWeightEntries(updatedEntries);
    setWeightInput('');
    setWeightDateInput(new Date().toISOString().split('T')[0]);
    setShowWeightModal(false);
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
    servings: '1',
    servingUnit: 'piece', // 'piece', 'g', 'oz', 'cup', 'tbsp', 'tsp'
    servingWeight: '', // Weight/amount in the selected unit
    baseServingSize: '1', // Base serving size for calculations
    micronutrients: undefined as Micronutrients | undefined,
  });
  const [showMicronutrients, setShowMicronutrients] = useState(false);
  
  // Store original base macros before weight calculations
  const [baseMacros, setBaseMacros] = useState({
    protein: '',
    carbs: '',
    fat: '',
  });

  // Edit meal state
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [editMealFields, setEditMealFields] = useState({
    name: '',
    protein: '',
    carbs: '',
    fat: '',
    time: '',
    servings: '1',
  });
  // Store base macros per serving when editing
  const [editBaseMacros, setEditBaseMacros] = useState({
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  const openEditMeal = (meal: Meal) => {
    setEditingMeal(meal);
    
    // Use stored base macros and servings if available, otherwise calculate from stored values
    // For backward compatibility: if no base macros stored, assume current macros are for 1 serving
    const storedServings = meal.servings || 1;
    const baseProtein = meal.baseProtein !== undefined ? meal.baseProtein : (meal.protein / storedServings);
    const baseCarbs = meal.baseCarbs !== undefined ? meal.baseCarbs : (meal.carbs / storedServings);
    const baseFat = meal.baseFat !== undefined ? meal.baseFat : (meal.fat / storedServings);
    
    setEditBaseMacros({
      protein: baseProtein,
      carbs: baseCarbs,
      fat: baseFat,
    });
    
    setEditMealFields({
      name: meal.name,
      protein: String(meal.protein),
      carbs: String(meal.carbs),
      fat: String(meal.fat),
      time: meal.time,
      servings: String(storedServings),
    });
  };

  const updateEditMacrosFromServings = (servings: string) => {
    const servingsNum = parseFloat(servings) || 1;
    const totalProtein = Math.round(editBaseMacros.protein * servingsNum);
    const totalCarbs = Math.round(editBaseMacros.carbs * servingsNum);
    const totalFat = Math.round(editBaseMacros.fat * servingsNum);
    
    setEditMealFields(prev => ({
      ...prev,
      servings,
      protein: String(totalProtein),
      carbs: String(totalCarbs),
      fat: String(totalFat),
    }));
  };

  const saveEditedMeal = async () => {
    if (!editingMeal) return;
    const servings = parseFloat(editMealFields.servings) || 1;
    const totalProtein = Math.round(editBaseMacros.protein * servings);
    const totalCarbs = Math.round(editBaseMacros.carbs * servings);
    const totalFat = Math.round(editBaseMacros.fat * servings);
    const calories = calculateCaloriesFromMacros(totalProtein, totalCarbs, totalFat);

    const updated: Meal = {
      ...editingMeal,
      name: editMealFields.name || editingMeal.name,
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat,
      calories,
      time: editMealFields.time || editingMeal.time,
      servings: servings,
      baseProtein: editBaseMacros.protein,
      baseCarbs: editBaseMacros.carbs,
      baseFat: editBaseMacros.fat,
    };

    const updatedMeals = meals.map(m => (m.id === editingMeal.id ? updated : m));
    setMeals(updatedMeals);
    await saveMeals(updatedMeals);
    setEditingMeal(null);
  };

  const cancelEditMeal = () => {
    setEditingMeal(null);
  };

  const deleteMeal = async (mealId: string) => {
    const updatedMeals = meals.filter(m => m.id !== mealId);
    setMeals(updatedMeals);
    await saveMeals(updatedMeals);
  };

  const handleMacroSubmit = () => {
    if (!todayMacros.calories || !todayMacros.protein || !todayMacros.carbs || !todayMacros.fat) {
      showToast('Please fill in all macro fields', 'error');
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
    // no notification
  };

  // Calculate calories from macros (4 cal/g protein, 4 cal/g carbs, 9 cal/g fat)
  const calculateCaloriesFromMacros = (protein: number, carbs: number, fat: number) => {
    return (protein * 4) + (carbs * 4) + (fat * 9);
  };

  // Get unit for micronutrient display
  const getMicronutrientUnit = (key: string): string => {
    if (key === 'sodium' || key === 'potassium' || key === 'calcium' || key === 'iron' || 
        key === 'phosphorus' || key === 'iodine' || key === 'magnesium' || key === 'zinc' || 
        key === 'selenium' || key === 'copper' || key === 'manganese' || key === 'chromium' || 
        key === 'molybdenum' || key === 'chloride') {
      return 'mg';
    }
    if (key.includes('vitamin') || key === 'thiamin' || key === 'riboflavin' || key === 'niacin' || 
        key === 'vitaminB6' || key === 'folate' || key === 'vitaminB12' || key === 'biotin' || 
        key === 'pantothenicAcid') {
      return 'mg';
    }
    if (key === 'fiber' || key === 'sugar') {
      return 'g';
    }
    return 'mg';
  };

  const handleMealSubmit = async () => {
    // Only require macros, name is optional
    if (!mealInput.protein || !mealInput.carbs || !mealInput.fat) {
      // no notification
      return;
    }

    const servings = parseFloat(mealInput.servings) || 1;
    const baseProtein = parseFloat(mealInput.protein) || 0;
    const baseCarbs = parseFloat(mealInput.carbs) || 0;
    const baseFat = parseFloat(mealInput.fat) || 0;

    const totalProtein = Math.round(baseProtein * servings);
    const totalCarbs = Math.round(baseCarbs * servings);
    const totalFat = Math.round(baseFat * servings);
    const calculatedCalories = calculateCaloriesFromMacros(totalProtein, totalCarbs, totalFat);

    // Ensure date is set to today for proper filtering
    const todayDate = new Date();
    const mealName = mealInput.name.trim() || `Meal (${totalProtein}g P / ${totalCarbs}g C / ${totalFat}g F)`;
    
    // Calculate micronutrients based on servings
    const calculateMicronutrients = (micros: Micronutrients | undefined, servings: number): Micronutrients | undefined => {
      if (!micros) return undefined;
      const result: Micronutrients = {};
      Object.keys(micros).forEach(key => {
        const value = micros[key as keyof Micronutrients];
        if (value !== undefined) {
          result[key as keyof Micronutrients] = Math.round(value * servings * 10) / 10;
        }
      });
      return Object.keys(result).length > 0 ? result : undefined;
    };

    const newMeal: Meal = {
      id: Date.now().toString(),
      name: mealName,
      calories: calculatedCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat,
      time: mealInput.time || todayDate.toLocaleTimeString(),
      date: todayDate.toISOString(),
      servings: servings,
      baseProtein: baseProtein,
      baseCarbs: baseCarbs,
      baseFat: baseFat,
      micronutrients: calculateMicronutrients(mealInput.micronutrients, servings),
    };

    // Add to today's meals - this will trigger a re-render and update totals
    const updatedMeals = [newMeal, ...meals];
    setMeals(updatedMeals);
    
    // Save meals immediately to ensure persistence
    await saveMeals(updatedMeals);

    // Clear only macros, keep name if they want to save it later
    setMealInput(prev => ({ ...prev, protein: '', carbs: '', fat: '', servings: '1', micronutrients: undefined }));
    setShowMicronutrients(false);
    // no notification
  };

  const handleSaveMeal = async () => {
    // Save meal requires a name and macros
    if (!mealInput.name || !mealInput.name.trim()) {
      // no notification
      return;
    }

    if (!mealInput.protein || !mealInput.carbs || !mealInput.fat) {
      // no notification
      return;
    }

    const servings = parseFloat(mealInput.servings) || 1;
    const baseProtein = parseFloat(mealInput.protein) || 0;
    const baseCarbs = parseFloat(mealInput.carbs) || 0;
    const baseFat = parseFloat(mealInput.fat) || 0;

    const totalProtein = Math.round(baseProtein * servings);
    const totalCarbs = Math.round(baseCarbs * servings);
    const totalFat = Math.round(baseFat * servings);
    const calculatedCalories = calculateCaloriesFromMacros(totalProtein, totalCarbs, totalFat);

    // Save to saved meals for future use
    const existingSavedMeal = savedMeals.find(meal => meal.name.toLowerCase() === mealInput.name.toLowerCase().trim());
    if (existingSavedMeal) {
      // Update existing saved meal
      const updatedMeals = savedMeals.map(meal => 
        meal.id === existingSavedMeal.id 
          ? { ...meal, timesUsed: meal.timesUsed + 1, lastUsed: new Date().toISOString() }
          : meal
      );
      setSavedMeals(updatedMeals);
      await saveSavedMeals(updatedMeals);
    } else {
      // Add new saved meal
      const newSavedMeal: SavedMeal = {
        id: Date.now().toString(),
        name: mealInput.name.trim(),
        calories: calculatedCalories,
        protein: totalProtein,
        carbs: totalCarbs,
        fat: totalFat,
        timesUsed: 1,
        lastUsed: new Date().toISOString(),
      };
      const updatedMeals = [newSavedMeal, ...savedMeals];
      setSavedMeals(updatedMeals);
      await saveSavedMeals(updatedMeals);
    }

    // Clear meal name and macros after saving
    setMealInput(prev => ({ ...prev, name: '', protein: '', carbs: '', fat: '', servings: '1' }));
    // no notification
  };

  const handleUseSavedMeal = async (savedMeal: SavedMeal) => {
    // Saved meals contain base macros (per serving), so we'll use 1 serving by default
    const newMeal: Meal = {
      id: Date.now().toString(),
      name: savedMeal.name,
      calories: savedMeal.calories,
      protein: savedMeal.protein,
      carbs: savedMeal.carbs,
      fat: savedMeal.fat,
      time: new Date().toLocaleTimeString(),
      date: new Date().toISOString(),
      servings: 1,
      baseProtein: savedMeal.protein,
      baseCarbs: savedMeal.carbs,
      baseFat: savedMeal.fat,
    };

    const updatedTodayMeals = [newMeal, ...meals];
    setMeals(updatedTodayMeals);
    
    // Update saved meal usage
    const updatedSavedMeals = savedMeals.map(meal => 
      meal.id === savedMeal.id
        ? { ...meal, timesUsed: meal.timesUsed + 1, lastUsed: new Date().toISOString() }
        : meal
    );
    setSavedMeals(updatedSavedMeals);
    
    // Save both meals list and saved meals list
    await Promise.all([
      saveMeals(updatedTodayMeals),
      saveSavedMeals(updatedSavedMeals)
    ]);

    // no notification
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

  const handleSaveGoals = async () => {
    if (!editGoals.protein || !editGoals.carbs || !editGoals.fat || !editGoals.water) {
      // no notification
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
    await saveNutritionGoals(newGoals);
    setIsEditingGoals(false);
    // no notification
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
    console.log('Session exercises:', session.exercises);
    console.log('Exercise data:', session.exercises.map(ex => ({
      name: ex.name,
      sets: ex.sets.map(s => ({ setNumber: s.setNumber, weight: s.weight, reps: s.reps, completed: s.completed }))
    })));
    
    // Note: The workout is already saved in ProgramExecutionScreen or SavedPlanViewScreen
    // We just need to reload the history to reflect the new workout
    try {
      // Reload history to ensure it's up to date (workout was already saved by the execution screen)
      await loadWorkoutHistory();
      console.log('Workout history reloaded');
    } catch (error) {
      console.error('Error reloading workout history:', error);
    }
    
    setSelectedProgram(null);
    
    // Automatically complete fitness tasks when workout is finished
    onCompleteTask('workout');
    onCompleteTask('cardio');
    onCompleteTask('strength');
  };

  const handleFoodScanned = (scannedFood: any) => {
    // Populate the meal form with scanned food data
    setMealInput({
      name: scannedFood.name || '',
      calories: scannedFood.calories?.toString() || '0',
      protein: scannedFood.protein?.toString() || '0',
      carbs: scannedFood.carbs?.toString() || '0',
      fat: scannedFood.fat?.toString() || '0',
      time: new Date().toLocaleTimeString(),
      servings: '1',
      servingUnit: scannedFood.servingUnit || 'serving',
      servingWeight: scannedFood.servingWeight?.toString() || '0',
      baseServingSize: scannedFood.baseServingSize?.toString() || '1',
    });
    // No blocking alerts; user can review/edit and tap Add Meal
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

  const renderWorkouts = () => {
    // Category tabs configuration
    const categories = [
      { id: 'strength', name: 'Strength', key: 'strength' as const },
      { id: 'muscle_building', name: 'Muscle Building', key: 'muscle_building' as const },
      { id: 'cardio', name: 'Cardio', key: 'cardio' as const },
      { id: 'bodyweight', name: 'Bodyweight', key: 'bodyweight' as const },
    ];

    // Get unique categories from available programs
    const availableCategories = [...new Set(workoutPrograms.map(p => p.category))];
    
    // Filter programs by selected category
    const filteredPrograms = selectedCategory
      ? workoutPrograms.filter(p => p.category === selectedCategory)
      : workoutPrograms;

    // Get active plans
    const currentPlans = savedWorkoutPlans.filter(plan => activePlans.includes(plan.id));

    return (
      <View style={styles.tabContent}>
        <View style={styles.workoutButtonsContainer}>
          <TouchableOpacity
            style={styles.startWorkoutButton}
            onPress={() => setShowWorkoutScreen(true)}
          >
            <Text style={styles.startWorkoutButtonText}>Custom AI Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.startWorkoutButton, styles.buildYourOwnButton]}
            onPress={() => setShowBuildYourOwnScreen(true)}
          >
            <Text style={[styles.startWorkoutButtonText, styles.buildYourOwnButtonText]}>Build Your Own</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.startWorkoutButton, styles.logPastWorkoutButton]}
            onPress={() => setShowLogPastWorkout(true)}
          >
            <Text style={[styles.startWorkoutButtonText, styles.logPastWorkoutButtonText]}>Log Past Workout</Text>
          </TouchableOpacity>
        </View>
        
        {/* Tab Selector */}
        <View style={styles.workoutPlanTabsContainer}>
          <TouchableOpacity
            style={[
              styles.workoutPlanTab,
              workoutPlanTab === 'programs' && styles.workoutPlanTabActive
            ]}
            onPress={() => setWorkoutPlanTab('programs')}
          >
            <Text style={[
              styles.workoutPlanTabText,
              workoutPlanTab === 'programs' && styles.workoutPlanTabTextActive
            ]}>
              Programs
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.workoutPlanTab,
              workoutPlanTab === 'myPlans' && styles.workoutPlanTabActive
            ]}
            onPress={() => setWorkoutPlanTab('myPlans')}
          >
            <Text style={[
              styles.workoutPlanTabText,
              workoutPlanTab === 'myPlans' && styles.workoutPlanTabTextActive
            ]}>
              My Plans
            </Text>
          </TouchableOpacity>
        </View>

        {workoutPlanTab === 'programs' ? (
          <View style={styles.workoutPrograms}>
            <Text style={styles.sectionTitle}>Workout Programs</Text>
            
            {/* Category Tabs */}
            <View style={styles.categoryTabsContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.categoryTabsScroll}
                contentContainerStyle={{ paddingHorizontal: 20 }}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryTab,
                    selectedCategory === null && styles.categoryTabActive
                  ]}
                  onPress={() => setSelectedCategory(null)}
                >
                  <Text style={[
                    styles.categoryTabText,
                    selectedCategory === null && styles.categoryTabTextActive
                  ]}>
                    All
                  </Text>
                </TouchableOpacity>
                
                {categories
                  .filter(cat => availableCategories.includes(cat.key))
                  .map(category => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryTab,
                        selectedCategory === category.key && styles.categoryTabActive
                      ]}
                      onPress={() => setSelectedCategory(category.key)}
                    >
                      <Text style={[
                        styles.categoryTabText,
                        selectedCategory === category.key && styles.categoryTabTextActive
                      ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>

            {/* Programs List */}
            {filteredPrograms.length > 0 ? (
              filteredPrograms.map((program) => (
                <TouchableOpacity
                  key={program.id}
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
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {selectedCategory 
                    ? `No ${categories.find(c => c.key === selectedCategory)?.name.toLowerCase()} programs available`
                    : 'No workout programs available'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.workoutPrograms}>
            <Text style={styles.sectionTitle}>My Workout Plans</Text>
            
            {currentPlans.length > 0 ? (
              <>
                <Text style={styles.sectionSubtitle}>
                  Active Plans ({currentPlans.length})
                </Text>
                {currentPlans.map((plan) => (
                    <TouchableOpacity
                      key={plan.id}
                      style={styles.programCard}
                      onPress={() => {
                        // Show saved plan view for all plans
                        setSelectedSavedPlan(plan);
                      }}
                    >
                    <View style={styles.planHeader}>
                      <View style={styles.planHeaderLeft}>
                        <Text style={styles.programTitle}>{plan.name}</Text>
                        <View style={styles.badgeRow}>
                          <Text style={styles.activePlanBadge}>Active</Text>
                          {planAdaptations.get(plan.id) && planAdaptations.get(plan.id)!.length > 0 && (
                            <View style={styles.adaptationIndicator}>
                              <Text style={styles.adaptationIndicatorText}>
                                {planAdaptations.get(plan.id)!.length} AI Suggestions
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.planHeaderRight}>
                        <TouchableOpacity
                          style={styles.activeToggle}
                          onPress={(e) => {
                            e.stopPropagation();
                            togglePlanActive(plan.id);
                          }}
                        >
                          <Text style={styles.activeToggleText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.programDescription}>
                      {plan.level || 'Custom'} • {(plan.goal || 'strength').replace('_', ' ')} • {plan.daysPerWeek || (plan.trainingDays && plan.trainingDays.length) || 'N/A'} days/week
                      {plan.isCustom && plan.trainingDays && plan.trainingDays.length > 0 && (
                        <Text style={styles.programDescription}> • {plan.trainingDays.join(', ')}</Text>
                      )}
                    </Text>
                    {plan.weeklyPlan && plan.weeklyPlan.weekDays.length > 0 ? (
                      <Text style={styles.programDuration}>
                        {plan.weeklyPlan.weekDays.length} workout days • ~{plan.duration} min per session
                      </Text>
                    ) : plan.isCustom && plan.exercises ? (
                      <Text style={styles.programDuration}>
                        {plan.exercises.length} exercises • ~{plan.duration || (plan.exercises.length * 5)} min per session
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No active workout plans</Text>
                <Text style={styles.emptyStateSubtext}>
                  Save a custom workout plan and mark it as active to see it here
                </Text>
              </View>
            )}

            {savedWorkoutPlans.filter(p => !activePlans.includes(p.id)).length > 0 && (
              <>
                <Text style={[styles.sectionSubtitle, { marginTop: 20 }]}>
                  Saved Plans ({savedWorkoutPlans.filter(p => !activePlans.includes(p.id)).length})
                </Text>
                {savedWorkoutPlans
                  .filter(plan => !activePlans.includes(plan.id))
                  .map((plan) => (
                    <TouchableOpacity
                      key={plan.id}
                      style={styles.programCard}
                      onPress={() => {
                        // Show saved plan view for all plans
                        setSelectedSavedPlan(plan);
                      }}
                    >
                      <View style={styles.planHeader}>
                        <View style={styles.planHeaderLeft}>
                          <Text style={styles.programTitle}>{plan.name}</Text>
                          {planAdaptations.get(plan.id) && planAdaptations.get(plan.id)!.length > 0 && (
                            <View style={styles.adaptationIndicator}>
                              <Text style={styles.adaptationIndicatorText}>
                                {planAdaptations.get(plan.id)!.length} AI Suggestions
                              </Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity
                          style={[styles.activeToggle, styles.activeToggleInactive]}
                          onPress={() => togglePlanActive(plan.id)}
                        >
                          <Text style={[styles.activeToggleText, { color: '#00ff88' }]}>Set Active</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.programDescription}>
                        {plan.level || 'Custom'} • {(plan.goal || 'strength').replace('_', ' ')} • {plan.daysPerWeek || (plan.trainingDays && plan.trainingDays.length) || 'N/A'} days/week
                        {plan.isCustom && plan.trainingDays && plan.trainingDays.length > 0 && (
                          <Text style={styles.programDescription}> • {plan.trainingDays.join(', ')}</Text>
                        )}
                      </Text>
                      <Text style={styles.programLevel}>
                        {plan.lastSaved ? `Last saved: ${new Date(plan.lastSaved).toLocaleDateString()}` : plan.savedAt ? `Saved ${new Date(plan.savedAt).toLocaleDateString()}` : plan.createdAt ? `Created ${new Date(plan.createdAt).toLocaleDateString()}` : 'Recently saved'}
                        {plan.exerciseLogs && plan.exerciseLogs.length > 0 && (
                          <Text style={styles.progressIndicator}> • In Progress</Text>
                        )}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </>
            )}
          </View>
        )}
      </View>
    );
  };

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

  const renderHistory = () => {
    try {
      const currentMonth = historyCalendarMonth || new Date();

      // Helper function to get local date key (avoids timezone issues)
      const getLocalDateKey = (dateString: string) => {
        try {
          const date = new Date(dateString);
          // Use local date components to avoid timezone shifts
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const day = date.getDate();
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        } catch (error) {
          console.error('Error parsing date:', dateString, error);
          return '';
        }
      };

      // Group workouts by date (YYYY-MM-DD format for easy matching)
      const workoutsByDate = (workoutHistory || []).reduce((groups, session) => {
        if (!session || !session.date) return groups;
        const dateKey = getLocalDateKey(session.date);
        if (dateKey) {
          if (!groups[dateKey]) {
            groups[dateKey] = [];
          }
          groups[dateKey].push(session);
        }
        return groups;
      }, {} as Record<string, WorkoutSession[]>);

      // Group meals by date (YYYY-MM-DD format for easy matching)
      const mealsByDate = (meals || []).reduce((groups, meal) => {
        if (!meal || !meal.date) return groups;
        const dateKey = getLocalDateKey(meal.date);
        if (dateKey) {
          if (!groups[dateKey]) {
            groups[dateKey] = [];
          }
          groups[dateKey].push(meal);
        }
        return groups;
      }, {} as Record<string, Meal[]>);

    const navigateMonth = (direction: 'prev' | 'next') => {
      const newDate = new Date(currentMonth);
      if (direction === 'prev') {
        newDate.setMonth(currentMonth.getMonth() - 1);
      } else {
        newDate.setMonth(currentMonth.getMonth() + 1);
      }
      setHistoryCalendarMonth(newDate);
    };

    const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const days = [];
      
      // Add empty cells for days before the first day of the month
      for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null);
      }

      // Add all days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        days.push(day);
      }

      return days;
    };

    const getDateKey = (day: number | null) => {
      if (day === null) return null;
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const days = getDaysInMonth(currentMonth);
    const today = new Date();
    const isCurrentMonth = today.getMonth() === currentMonth.getMonth() && today.getFullYear() === currentMonth.getFullYear();

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Workout History</Text>
        
        {/* Calendar Header */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity 
            style={styles.monthNavButton}
            onPress={() => navigateMonth('prev')}
          >
            <Text style={styles.monthNavButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthName}</Text>
          <TouchableOpacity 
            style={styles.monthNavButton}
            onPress={() => navigateMonth('next')}
          >
            <Text style={styles.monthNavButtonText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Day Labels */}
        <View style={styles.calendarWeekDays}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <View key={day} style={styles.weekDayLabel}>
              <Text style={styles.weekDayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {days.map((day, index) => {
            const dateKey = getDateKey(day);
            const hasWorkout = dateKey && workoutsByDate[dateKey];
            const hasMeals = dateKey && mealsByDate[dateKey];
            const isToday = isCurrentMonth && day === today.getDate();
            const workouts = dateKey ? workoutsByDate[dateKey] || [] : [];
            const dayMeals = dateKey ? mealsByDate[dateKey] || [] : [];
            const hasData = hasWorkout || hasMeals;
            const isSelected = selectedCalendarDate === dateKey;

            if (day === null) {
              return <View key={`empty-${index}`} style={styles.calendarDay} />;
            }

            return (
              <TouchableOpacity
                key={`day-${dateKey || `empty-${index}`}-${day}`}
                style={[
                  styles.calendarDay,
                  isToday && styles.calendarDayToday,
                  hasWorkout && styles.calendarDayWithWorkout
                ]}
                onPress={() => {
                  if (hasData) {
                    if (isSelected) {
                      setSelectedCalendarDate(null);
                      setExpandedDayItems(new Set());
                    } else {
                      setSelectedCalendarDate(dateKey);
                      // Auto-expand both bubbles when day is first selected
                      const newExpanded = new Set<string>();
                      if (hasWorkout) {
                        newExpanded.add(`workout-${dateKey}`);
                      }
                      if (hasMeals) {
                        newExpanded.add(`nutrition-${dateKey}`);
                      }
                      setExpandedDayItems(newExpanded);
                    }
                  }
                }}
              >
                <Text style={[
                  styles.calendarDayNumber,
                  isToday && styles.calendarDayNumberToday,
                  hasWorkout && styles.calendarDayNumberWithWorkout
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Day Details - Expandable bubbles */}
        {selectedCalendarDate && (
          <View style={styles.dayDetailsContainer}>
            <View style={styles.dayDetailsHeader}>
              <Text style={styles.dayDetailsTitle}>
                {(() => {
                  // Parse YYYY-MM-DD as local date to avoid timezone issues
                  const [year, month, day] = selectedCalendarDate.split('-').map(Number);
                  const localDate = new Date(year, month - 1, day);
                  return localDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  });
                })()}
              </Text>
              <TouchableOpacity 
                style={styles.closeDayDetailsButton}
                onPress={() => {
                  setSelectedCalendarDate(null);
                  setExpandedDayItems(new Set());
                }}
              >
                <Text style={styles.closeDayDetailsText}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Workouts */}
            {workoutsByDate[selectedCalendarDate] && workoutsByDate[selectedCalendarDate].length > 0 && (
              <View style={styles.dayDetailBubble}>
                <TouchableOpacity
                  style={styles.dayDetailBubbleHeader}
                  onPress={() => {
                    const key = `workout-${selectedCalendarDate}`;
                    setExpandedDayItems(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(key)) {
                        newSet.delete(key);
                      } else {
                        newSet.add(key);
                      }
                      return newSet;
                    });
                  }}
                >
                  <Text style={styles.dayDetailBubbleTitle}>
                    Workouts ({workoutsByDate[selectedCalendarDate].length})
                  </Text>
                  <Text style={styles.dayDetailBubbleArrow}>
                    {expandedDayItems.has(`workout-${selectedCalendarDate}`) ? '▼' : '▶'}
                  </Text>
                </TouchableOpacity>
                {expandedDayItems.has(`workout-${selectedCalendarDate}`) && (
                  <View style={styles.dayDetailBubbleContent}>
                    {workoutsByDate[selectedCalendarDate].map((workout, idx) => {
                      const completedSets = workout.exercises.reduce((total, ex) => 
                        total + ex.sets.filter(s => s.completed).length, 0
                      );
                      return (
                        <TouchableOpacity
                          key={`workout-${selectedCalendarDate}-${workout.id || idx}-${workout.date}`}
                          style={styles.dayDetailItem}
                          onPress={() => {
                            setSelectedHistorySession(workout);
                            setSelectedCalendarDate(null);
                          }}
                        >
                          <Text style={styles.dayDetailItemName}>{workout.programName}</Text>
                          <Text style={styles.dayDetailItemInfo}>
                            {new Date(workout.date).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })} • {workout.duration} min • {workout.exercises.length} exercises • {completedSets} sets
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Nutrition */}
            {mealsByDate[selectedCalendarDate] && mealsByDate[selectedCalendarDate].length > 0 && (
              <View style={styles.dayDetailBubble}>
                <TouchableOpacity
                  style={styles.dayDetailBubbleHeader}
                  onPress={() => {
                    const key = `nutrition-${selectedCalendarDate}`;
                    setExpandedDayItems(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(key)) {
                        newSet.delete(key);
                      } else {
                        newSet.add(key);
                      }
                      return newSet;
                    });
                  }}
                >
                  <Text style={styles.dayDetailBubbleTitle}>
                    Nutrition ({mealsByDate[selectedCalendarDate].length} meals)
                  </Text>
                  <Text style={styles.dayDetailBubbleArrow}>
                    {expandedDayItems.has(`nutrition-${selectedCalendarDate}`) ? '▼' : '▶'}
                  </Text>
                </TouchableOpacity>
                {expandedDayItems.has(`nutrition-${selectedCalendarDate}`) && (
                  <View style={styles.dayDetailBubbleContent}>
                    {mealsByDate[selectedCalendarDate].map((meal, idx) => {
                      const mealTime = meal.time || new Date(meal.date).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      });
                      return (
                        <View key={`meal-${selectedCalendarDate}-${meal.id || idx}-${meal.date}-${meal.time || ''}`} style={styles.dayDetailItem}>
                          <Text style={styles.dayDetailItemName}>{meal.name}</Text>
                          <Text style={styles.dayDetailItemInfo}>
                            {mealTime} • {meal.calories} cal
                          </Text>
                          <Text style={styles.dayDetailItemMacros}>
                            P: {meal.protein}g • C: {meal.carbs}g • F: {meal.fat}g
                          </Text>
                        </View>
                      );
                    })}
                    {/* Daily Totals */}
                    {mealsByDate[selectedCalendarDate].length > 0 && (
                      <View style={styles.dayDetailTotals}>
                        <Text style={styles.dayDetailTotalsLabel}>Daily Totals:</Text>
                        <Text style={styles.dayDetailTotalsText}>
                          {mealsByDate[selectedCalendarDate].reduce((sum, m) => sum + m.calories, 0)} cal • 
                          P: {mealsByDate[selectedCalendarDate].reduce((sum, m) => sum + m.protein, 0)}g • 
                          C: {mealsByDate[selectedCalendarDate].reduce((sum, m) => sum + m.carbs, 0)}g • 
                          F: {mealsByDate[selectedCalendarDate].reduce((sum, m) => sum + m.fat, 0)}g
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {!workoutsByDate[selectedCalendarDate] && !mealsByDate[selectedCalendarDate] && (
              <Text style={styles.dayDetailEmpty}>No data for this day</Text>
            )}
          </View>
        )}

        {/* Legend */}
        <View style={styles.calendarLegend}>
          <Text style={styles.legendText}>Today</Text>
          <Text style={styles.legendText}>•</Text>
          <Text style={styles.legendText}>Green highlight = Workout completed</Text>
        </View>

        {/* Weight Tracking Graph */}
        <View style={styles.weightGraphContainer}>
          <View style={styles.weightGraphHeader}>
            <Text style={styles.weightGraphTitle}>Weight Progress</Text>
            <TouchableOpacity 
              style={styles.addWeightButton}
              onPress={() => setShowWeightModal(true)}
            >
              <Text style={styles.addWeightButtonText}>+ Add Weight</Text>
            </TouchableOpacity>
          </View>
          {renderWeightGraph()}
        </View>

        {(!workoutHistory || workoutHistory.length === 0) && (!meals || meals.length === 0) && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No workouts or meals recorded yet</Text>
            <Text style={styles.emptyStateSubtext}>Start tracking to see your history here</Text>
          </View>
        )}
      </ScrollView>
    );
    } catch (error) {
      console.error('Error rendering history:', error);
      return (
        <View style={styles.tabContent}>
          <Text style={styles.sectionTitle}>Workout History</Text>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Error loading history</Text>
            <Text style={styles.emptyStateSubtext}>
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </Text>
          </View>
        </View>
      );
    }
  };

  const renderNutrition = () => {
    // Calculate today's totals from meals
    const today = new Date();
    const todayDateString = today.toDateString();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const todayEnd = todayStart + (24 * 60 * 60 * 1000) - 1;
    
    // Filter meals for today using both date string comparison and timestamp range
    const todayMeals = meals.filter(meal => {
      const mealDate = new Date(meal.date);
      const mealDateString = mealDate.toDateString();
      const mealTimestamp = mealDate.getTime();
      // Use both methods for reliability
      return mealDateString === todayDateString || (mealTimestamp >= todayStart && mealTimestamp < todayEnd);
    });
    
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
        {/* Today's Progress & Goals - Combined Section */}
        <View style={styles.progressSection}>
          <View style={styles.goalsHeader}>
            <Text style={styles.sectionTitle}>Today's Progress</Text>
            {!isEditingGoals ? (
              <TouchableOpacity style={styles.editButton} onPress={handleEditGoals}>
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={() => handleSaveGoals().catch(console.error)}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {!isEditingGoals ? (
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

        {/* Add Meal */}
        <View style={styles.mealSection}>
          <View style={styles.mealSectionHeader}>
            <Text style={styles.sectionTitle}>Add Meal</Text>
          </View>

          <View style={styles.mealInputs}>
            <View style={styles.mealNameInputContainer}>
              <TextInput
                style={styles.mealInput}
                placeholder="Meal name (optional)"
                value={mealInput.name}
                onChangeText={(text) => setMealInput(prev => ({ ...prev, name: text }))}
                autoCapitalize="words"
              />
              {mealInput.name && mealInput.name.trim() && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setMealInput(prev => ({ ...prev, name: '' }))}
                >
                  <Text style={styles.clearButtonText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.macroRow}>
              <Text style={styles.macroLabel}>Protein (g)</Text>
              <TextInput
                style={styles.macroInput}
                placeholder="0"
                value={mealInput.protein}
                onChangeText={(text) => {
                  setMealInput(prev => ({ ...prev, protein: text }));
                  setBaseMacros(prev => ({ ...prev, protein: text }));
                }}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.macroRow}>
              <Text style={styles.macroLabel}>Carbs (g)</Text>
              <TextInput
                style={styles.macroInput}
                placeholder="0"
                value={mealInput.carbs}
                onChangeText={(text) => {
                  setMealInput(prev => ({ ...prev, carbs: text }));
                  setBaseMacros(prev => ({ ...prev, carbs: text }));
                }}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.macroRow}>
              <Text style={styles.macroLabel}>Fat (g)</Text>
              <TextInput
                style={styles.macroInput}
                placeholder="0"
                value={mealInput.fat}
                onChangeText={(text) => {
                  setMealInput(prev => ({ ...prev, fat: text }));
                  setBaseMacros(prev => ({ ...prev, fat: text }));
                }}
                keyboardType="numeric"
              />
            </View>

          {/* Micronutrients Tab */}
          <View style={styles.micronutrientsTabContainer}>
            <TouchableOpacity
              style={[styles.micronutrientsTabButton, showMicronutrients && styles.micronutrientsTabButtonActive]}
              onPress={() => setShowMicronutrients(!showMicronutrients)}
            >
              <Text style={[styles.micronutrientsTabText, showMicronutrients && styles.micronutrientsTabTextActive]}>
                {showMicronutrients ? '▼' : '▶'} Micronutrients
                {mealInput.micronutrients && Object.keys(mealInput.micronutrients).length > 0 && (
                  <Text style={styles.micronutrientsBadge}> ({Object.keys(mealInput.micronutrients).length})</Text>
                )}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Micronutrients List */}
          {showMicronutrients && (
            <View style={styles.micronutrientsContainer}>
              {mealInput.micronutrients && Object.keys(mealInput.micronutrients).length > 0 ? (
                <View style={styles.micronutrientsList}>
                  {Object.entries(mealInput.micronutrients).map(([key, value]) => {
                    if (value === undefined) return null;
                    const servings = parseFloat(mealInput.servings || '1') || 1;
                    const totalValue = Math.round(value * servings * 10) / 10;
                    const displayName = key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, str => str.toUpperCase())
                      .trim();
                    const unit = getMicronutrientUnit(key);
                    return (
                      <View key={key} style={styles.micronutrientItem}>
                        <Text style={styles.micronutrientLabel}>{displayName}</Text>
                        <Text style={styles.micronutrientValue}>
                          {totalValue} {unit}
                          {servings !== 1 && (
                            <Text style={styles.micronutrientPerServing}>
                              {' '}({Math.round(value * 10) / 10} {unit}/serving)
                            </Text>
                          )}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.micronutrientsEmpty}>
                  <Text style={styles.micronutrientsEmptyText}>
                    No micronutrient data available. Scan a barcode to auto-populate micronutrients.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Serving Unit and Weight Selection */}
          <View style={styles.macroRow}>
            <Text style={styles.macroLabel}>Serving Unit</Text>
            <UnitPickerWheel
              units={['piece', 'g', 'oz', 'cup', 'tbsp', 'tsp']}
              selectedUnit={mealInput.servingUnit}
              onUnitChange={(unit) => {
                setMealInput(prev => ({ 
                  ...prev, 
                  servingUnit: unit as any, 
                  baseServingSize: '1',
                }));
              }}
            />
          </View>
          
          <View style={styles.macroRow}>
            <Text style={styles.macroLabel}>Serving Size</Text>
            <TextInput
              style={styles.macroInput}
              placeholder="1"
              value={mealInput.baseServingSize}
              onChangeText={(text) => {
                setMealInput(prev => ({ ...prev, baseServingSize: text }));
              }}
              keyboardType="numeric"
            />
            <Text style={styles.unitLabel}>{mealInput.servingUnit === 'g' ? 'grams' : mealInput.servingUnit === 'oz' ? 'oz' : mealInput.servingUnit === 'tbsp' ? 'tbsp' : mealInput.servingUnit === 'tsp' ? 'tsp' : mealInput.servingUnit === 'cup' ? 'cup' : 'piece'}</Text>
          </View>

          {/* Keep original servings for backward compatibility */}
          <View style={styles.macroRow}>
            <Text style={styles.macroLabel}>Servings (multiplier)</Text>
            <TextInput
              style={styles.macroInput}
              placeholder="1"
              value={mealInput.servings}
              onChangeText={(text) => setMealInput(prev => ({ ...prev, servings: text }))}
              keyboardType="numeric"
            />
          </View>

            {mealInput.protein && mealInput.carbs && mealInput.fat && (
              <View style={styles.calculatedCalories}>
                <Text style={styles.calculatedCaloriesText}>
                  {(() => {
                    const servings = parseFloat(mealInput.servings || '1') || 1;
                    const pTotal = Math.round((parseFloat(mealInput.protein) || 0) * servings);
                    const cTotal = Math.round((parseFloat(mealInput.carbs) || 0) * servings);
                    const fTotal = Math.round((parseFloat(mealInput.fat) || 0) * servings);
                    const totalCals = calculateCaloriesFromMacros(pTotal, cTotal, fTotal);
                    return `Calculated Calories: ${totalCals}`;
                  })()}
                </Text>
                <Text style={styles.perServingText}>
                  {(() => {
                    const p = Math.round(parseFloat(mealInput.protein) || 0);
                    const c = Math.round(parseFloat(mealInput.carbs) || 0);
                    const f = Math.round(parseFloat(mealInput.fat) || 0);
                    const perServingCals = calculateCaloriesFromMacros(p, c, f);
                    const servingSizeDisplay = mealInput.baseServingSize || '1';
                    const unitDisplay = mealInput.servingUnit === 'g' ? 'grams' : mealInput.servingUnit === 'oz' ? 'oz' : mealInput.servingUnit === 'tbsp' ? 'tbsp' : mealInput.servingUnit === 'tsp' ? 'tsp' : mealInput.servingUnit === 'cup' ? 'cup' : 'piece';
                    return `Per ${servingSizeDisplay} ${unitDisplay}: ${perServingCals} cal • ${p}g P • ${c}g C • ${f}g F`;
                  })()}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.mealButtons}>
            <TouchableOpacity style={styles.logButton} onPress={() => handleMealSubmit().catch(console.error)}>
              <Text style={styles.logButtonText}>Add Meal</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.logButton, styles.saveMealButton]} 
              onPress={() => handleSaveMeal().catch(console.error)}
              disabled={!mealInput.name || !mealInput.name.trim()}
            >
              <Text style={[styles.logButtonText, (!mealInput.name || !mealInput.name.trim()) && styles.disabledButtonText]}>Save Meal</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.scanButton} 
              onPress={() => setShowBarcodeScanner(true)}
            >
              <Text style={styles.scanButtonText}>Scan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Meals List - Combined Today's Meals and Saved Meals with Tabs */}
        <View style={styles.mealsList}>
          {/* Tab Selector */}
          <View style={styles.mealsTabContainer}>
            <TouchableOpacity
              style={[styles.mealsTabButton, mealsTab === 'today' && styles.mealsTabButtonActive]}
              onPress={() => setMealsTab('today')}
            >
              <Text style={[styles.mealsTabText, mealsTab === 'today' && styles.mealsTabTextActive]}>
                Today's Meals {todayMeals.length > 0 && `(${todayMeals.length})`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mealsTabButton, mealsTab === 'saved' && styles.mealsTabButtonActive]}
              onPress={() => setMealsTab('saved')}
            >
              <Text style={[styles.mealsTabText, mealsTab === 'saved' && styles.mealsTabTextActive]}>
                Saved Meals {savedMeals.length > 0 && `(${savedMeals.length})`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Today's Meals Tab */}
          {mealsTab === 'today' && (
            <>
              {todayMeals.length > 0 ? (
                <ScrollView style={styles.mealsScroll} contentContainerStyle={styles.mealsScrollContent}>
                  {todayMeals.map(meal => (
                <Swipeable
                  key={meal.id}
                  renderRightActions={() => (
                    <View style={styles.swipeActions}>
                      <TouchableOpacity style={[styles.swipeButton, styles.swipeEdit]} onPress={() => openEditMeal(meal)}>
                        <Text style={styles.swipeButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.swipeButton, styles.swipeDelete]} onPress={() => deleteMeal(meal.id).catch(console.error)}>
                        <Text style={styles.swipeButtonText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                >
                  <View style={styles.mealItem}>
                    <View style={styles.mealHeader}>
                      <View style={styles.mealNameContainer}>
                        <Text style={styles.mealName} numberOfLines={2} ellipsizeMode="tail">{meal.name}</Text>
                        {meal.servings && meal.servings !== 1 && (
                          <Text style={styles.mealServings}>{meal.servings}x</Text>
                        )}
                      </View>
                      <Text style={styles.mealTime} numberOfLines={1} ellipsizeMode="tail">{meal.time}</Text>
                    </View>
                    <View style={styles.mealMacros}>
                      <Text style={styles.mealMacro}>{meal.calories} cal</Text>
                      <Text style={styles.mealMacro}>{meal.protein}g protein</Text>
                      <Text style={styles.mealMacro}>{meal.carbs}g carbs</Text>
                      <Text style={styles.mealMacro}>{meal.fat}g fat</Text>
                    </View>
                  </View>
                </Swipeable>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.emptyMealsContainer}>
                  <Text style={styles.emptyMealsText}>No meals logged today</Text>
                  <Text style={styles.emptyMealsSubtext}>Add a meal using the macro calculator above</Text>
                </View>
              )}
            </>
          )}

          {/* Saved Meals Tab */}
          {mealsTab === 'saved' && (
            <>
              {/* Saved Meals Search */}
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search saved meals..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#888"
                />
                {searchQuery && searchQuery.trim() && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setSearchQuery('')}
                  >
                    <Text style={styles.clearButtonText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {savedMeals.length > 0 ? (
                <ScrollView style={styles.mealsScroll} contentContainerStyle={styles.mealsScrollContent}>
                  {savedMeals
                    .filter(meal => meal.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .sort((a, b) => b.timesUsed - a.timesUsed)
                    .map(meal => (
                      <TouchableOpacity
                        key={meal.id}
                        style={styles.mealItem}
                        onPress={() => handleUseSavedMeal(meal).catch(console.error)}
                      >
                        <View style={styles.mealHeader}>
                          <View style={styles.mealNameContainer}>
                            <Text style={styles.mealName} numberOfLines={2} ellipsizeMode="tail">{meal.name}</Text>
                          </View>
                          <Text style={styles.mealTime}>
                            Used {meal.timesUsed}x
                          </Text>
                        </View>
                        <View style={styles.mealMacros}>
                          <Text style={styles.mealMacro}>{meal.calories} cal</Text>
                          <Text style={styles.mealMacro}>{meal.protein}g protein</Text>
                          <Text style={styles.mealMacro}>{meal.carbs}g carbs</Text>
                          <Text style={styles.mealMacro}>{meal.fat}g fat</Text>
                        </View>
                        {meal.lastUsed && (
                          <View style={styles.mealActionsRow}>
                            <Text style={styles.mealTime}>
                              Last used: {new Date(meal.lastUsed).toLocaleDateString()}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              ) : (
                <View style={styles.emptyMealsContainer}>
                  <Text style={styles.emptyMealsText}>No saved meals yet</Text>
                  <Text style={styles.emptyMealsSubtext}>Save meals from the macro calculator to use them later</Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  const loadHealthTrends = async () => {
    setLoadingHealthData(true);
    try {
      // Check if health data sync is enabled in settings
      const { loadUserData } = await import('./src/utils/userStorage');
      const appSettings = await loadUserData<any>('appSettings');
      const healthDataSyncEnabled = appSettings?.healthDataSyncEnabled !== false; // Default to true for backward compatibility
      
      if (!healthDataSyncEnabled) {
        setHealthTrends({
          averageWorkoutHeartRate: null,
          weeklyCalories: 0,
          weeklySteps: 0,
          weeklyDistance: 0,
          last7DaysHeartRate: [],
        });
        setLoadingHealthData(false);
        return;
      }

      // Request permissions first
      const hasPermissions = await HealthService.requestPermissions();
      if (!hasPermissions) {
        setHealthTrends({
          averageWorkoutHeartRate: null,
          weeklyCalories: 0,
          weeklySteps: 0,
          weeklyDistance: 0,
          last7DaysHeartRate: [],
        });
        setLoadingHealthData(false);
        return;
      }

      // Get last 7 days of data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      // Get historical health data
      const historicalData = await HealthService.getHistoricalHealthData(startDate, endDate);

      // Calculate weekly totals
      const weeklyCalories = historicalData.calories.reduce((sum, item) => sum + item.value, 0);
      const weeklySteps = historicalData.steps.reduce((sum, item) => sum + item.value, 0);
      const weeklyDistance = historicalData.distance.reduce((sum, item) => sum + item.value, 0);

      // Get average heart rate during workouts
      const workoutSessions = workoutHistory
        .filter(session => {
          const sessionDate = new Date(session.date);
          return sessionDate >= startDate && sessionDate <= endDate;
        })
        .map(session => ({
          date: session.date,
          duration: session.duration || 0,
        }));

      const averageWorkoutHeartRate = workoutSessions.length > 0
        ? await HealthService.getAverageHeartRateDuringWorkouts(workoutSessions)
        : null;

      // Group heart rate data by day for the last 7 days
      const dailyHeartRateMap = new Map<string, number[]>();
      historicalData.heartRate.forEach(point => {
        const dateKey = point.timestamp.toISOString().split('T')[0];
        if (!dailyHeartRateMap.has(dateKey)) {
          dailyHeartRateMap.set(dateKey, []);
        }
        dailyHeartRateMap.get(dateKey)!.push(point.value);
      });

      // Calculate average heart rate per day
      const last7DaysHeartRate: Array<{ date: string; avg: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        const heartRates = dailyHeartRateMap.get(dateKey) || [];
        const avg = heartRates.length > 0
          ? Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length)
          : 0;
        last7DaysHeartRate.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          avg,
        });
      }

      setHealthTrends({
        averageWorkoutHeartRate,
        weeklyCalories: Math.round(weeklyCalories),
        weeklySteps: Math.round(weeklySteps),
        weeklyDistance: Math.round(weeklyDistance * 10) / 10, // Round to 1 decimal
        last7DaysHeartRate,
      });
    } catch (error) {
      console.error('Error loading health trends:', error);
      setHealthTrends({
        averageWorkoutHeartRate: null,
        weeklyCalories: 0,
        weeklySteps: 0,
        weeklyDistance: 0,
        last7DaysHeartRate: [],
      });
    } finally {
      setLoadingHealthData(false);
    }
  };

  const renderHealthTrends = () => {
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.healthHeader}>
          <Text style={styles.sectionTitle}>Health Trends</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadHealthTrends}
            disabled={loadingHealthData}
          >
            <Text style={styles.refreshButtonText}>
              {loadingHealthData ? 'Loading...' : '↻ Refresh'}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingHealthData ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Loading health data...</Text>
          </View>
        ) : !healthTrends || (healthTrends.weeklyCalories === 0 && healthTrends.weeklySteps === 0 && healthTrends.averageWorkoutHeartRate === null) ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No health data available</Text>
            <Text style={styles.emptyStateSubtext}>
              Enable "Watch & Health Data Sync" in Settings → Settings → Permissions, then tap Refresh to sync data from your smartwatch and health apps
            </Text>
          </View>
        ) : (
          <>
            {/* Average Workout Heart Rate */}
            {healthTrends.averageWorkoutHeartRate !== null && (
              <View style={styles.healthCard}>
                <Text style={styles.healthCardTitle}>Average Workout Heart Rate</Text>
                <Text style={styles.healthCardValue}>
                  {healthTrends.averageWorkoutHeartRate} bpm
                </Text>
                <Text style={styles.healthCardSubtext}>
                  Based on your recent workouts
                </Text>
              </View>
            )}

            {/* Weekly Summary */}
            <View style={styles.healthCard}>
              <Text style={styles.healthCardTitle}>This Week</Text>
              <View style={styles.healthSummaryRow}>
                <View style={styles.healthSummaryItem}>
                  <Text style={styles.healthSummaryValue}>
                    {healthTrends.weeklyCalories.toLocaleString()}
                  </Text>
                  <Text style={styles.healthSummaryLabel}>Calories</Text>
                </View>
                <View style={styles.healthSummaryItem}>
                  <Text style={styles.healthSummaryValue}>
                    {healthTrends.weeklySteps.toLocaleString()}
                  </Text>
                  <Text style={styles.healthSummaryLabel}>Steps</Text>
                </View>
                <View style={styles.healthSummaryItem}>
                  <Text style={styles.healthSummaryValue}>
                    {healthTrends.weeklyDistance.toFixed(1)}
                  </Text>
                  <Text style={styles.healthSummaryLabel}>Miles</Text>
                </View>
              </View>
            </View>

            {/* Daily Heart Rate Trend */}
            {healthTrends.last7DaysHeartRate.length > 0 && (
              <View style={styles.healthCard}>
                <Text style={styles.healthCardTitle}>Daily Heart Rate Trend</Text>
                <Text style={styles.healthCardSubtext}>Last 7 Days</Text>
                <View style={styles.heartRateTrendContainer}>
                  {healthTrends.last7DaysHeartRate.map((day, index) => {
                    const maxHeartRate = Math.max(
                      ...healthTrends.last7DaysHeartRate.map(d => d.avg).filter(avg => avg > 0),
                      100
                    );
                    const barHeight = day.avg > 0 ? (day.avg / maxHeartRate) * 100 : 0;
                    return (
                      <View key={index} style={styles.heartRateDay}>
                        <View style={styles.heartRateBarContainer}>
                          {day.avg > 0 && (
                            <View
                              style={[
                                styles.heartRateBar,
                                { height: `${barHeight}%` },
                              ]}
                            />
                          )}
                        </View>
                        <Text style={styles.heartRateDayLabel}>{day.date}</Text>
                        <Text style={styles.heartRateDayValue}>
                          {day.avg > 0 ? `${day.avg}` : '-'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {healthTrends.averageWorkoutHeartRate === null &&
              healthTrends.weeklyCalories === 0 &&
              healthTrends.weeklySteps === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No health data available</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Connect your smartwatch and grant permissions to see health trends
                  </Text>
                </View>
              )}
          </>
        )}
      </ScrollView>
    );
  };

  const renderWeightGraph = () => {
    if (weightEntries.length === 0) {
      return (
        <View style={styles.weightGraphEmpty}>
          <Text style={styles.weightGraphEmptyText}>No weight data yet</Text>
          <Text style={styles.weightGraphEmptySubtext}>Add your weight to track progress</Text>
        </View>
      );
    }

    // Get last 30 days of data or all data if less than 30 entries
    const sortedEntries = [...weightEntries]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30);

    if (sortedEntries.length === 0) {
      return (
        <View style={styles.weightGraphEmpty}>
          <Text style={styles.weightGraphEmptyText}>No weight data yet</Text>
        </View>
      );
    }

    const weights = sortedEntries.map(e => e.weight);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const weightRange = maxWeight - minWeight || 10; // Default to 10 if all weights are the same
    const padding = weightRange * 0.1; // 10% padding
    const graphMin = minWeight - padding;
    const graphMax = maxWeight + padding;
    const graphRange = graphMax - graphMin;

    const screenWidth = Dimensions.get('window').width;
    const graphHeight = 200;
    const graphWidth = screenWidth - 100; // Account for padding and Y-axis
    const pointRadius = 4;
    const lineWidth = 2;

    // Calculate points for the graph
    const points = sortedEntries.map((entry, index) => {
      const x = (index / (sortedEntries.length - 1 || 1)) * graphWidth;
      const y = graphHeight - ((entry.weight - graphMin) / graphRange) * graphHeight;
      return { x, y, weight: entry.weight, date: entry.date };
    });

    // Calculate line segments
    const lineSegments = [];
    for (let i = 0; i < points.length - 1; i++) {
      lineSegments.push({
        x1: points[i].x,
        y1: points[i].y,
        x2: points[i + 1].x,
        y2: points[i + 1].y,
      });
    }

    // Calculate Y-axis labels
    const yAxisLabels = [];
    const numLabels = 5;
    for (let i = 0; i < numLabels; i++) {
      const value = graphMax - (graphRange / (numLabels - 1)) * i;
      yAxisLabels.push(value.toFixed(1));
    }

    // Calculate X-axis labels (show first, middle, last dates)
    const xAxisLabels = [];
    if (sortedEntries.length > 0) {
      xAxisLabels.push({
        date: sortedEntries[0].date,
        position: 0,
      });
      if (sortedEntries.length > 1) {
        const midIndex = Math.floor(sortedEntries.length / 2);
        xAxisLabels.push({
          date: sortedEntries[midIndex].date,
          position: midIndex / (sortedEntries.length - 1),
        });
      }
      if (sortedEntries.length > 2) {
        xAxisLabels.push({
          date: sortedEntries[sortedEntries.length - 1].date,
          position: 1,
        });
      }
    }

    return (
      <View style={styles.weightGraphContent}>
        <View style={styles.weightGraphYAxis}>
          {yAxisLabels.map((label, index) => (
            <Text key={index} style={styles.weightGraphYLabel}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.weightGraphMain}>
          <View style={[styles.weightGraphSvg, { width: graphWidth, height: graphHeight }]}>
            {/* Grid lines */}
            {yAxisLabels.map((_, index) => {
              const y = (index / (numLabels - 1)) * graphHeight;
              return (
                <View
                  key={`grid-${index}`}
                  style={[
                    styles.weightGraphGridLine,
                    {
                      top: y,
                      width: graphWidth,
                    },
                  ]}
                />
              );
            })}
            {/* Line segments */}
            {lineSegments.map((segment, index) => {
              const length = Math.sqrt(
                Math.pow(segment.x2 - segment.x1, 2) + Math.pow(segment.y2 - segment.y1, 2)
              );
              const angle = Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1) * (180 / Math.PI);
              return (
                <View
                  key={`line-${index}`}
                  style={[
                    styles.weightGraphLine,
                    {
                      left: segment.x1,
                      top: segment.y1,
                      width: length,
                      transform: [{ rotate: `${angle}deg` }],
                    },
                  ]}
                />
              );
            })}
            {/* Data points */}
            {points.map((point, index) => (
              <View
                key={`point-${index}`}
                style={[
                  styles.weightGraphPoint,
                  {
                    left: point.x - pointRadius,
                    top: point.y - pointRadius,
                    width: pointRadius * 2,
                    height: pointRadius * 2,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.weightGraphXAxis}>
            {xAxisLabels.map((label, index) => (
              <Text
                key={index}
                style={[
                  styles.weightGraphXLabel,
                  { left: `${label.position * 100}%` },
                ]}
              >
                {new Date(label.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            ))}
          </View>
        </View>
        {/* Stats */}
        <View style={styles.weightGraphStats}>
          <View style={styles.weightGraphStat}>
            <Text style={styles.weightGraphStatLabel}>Current</Text>
            <Text style={styles.weightGraphStatValue}>
              {sortedEntries[sortedEntries.length - 1].weight.toFixed(1)} lbs
            </Text>
          </View>
          {sortedEntries.length > 1 && (
            <>
              <View style={styles.weightGraphStat}>
                <Text style={styles.weightGraphStatLabel}>Change</Text>
                <Text
                  style={[
                    styles.weightGraphStatValue,
                    {
                      color:
                        sortedEntries[sortedEntries.length - 1].weight - sortedEntries[0].weight >= 0
                          ? '#00ff88'
                          : '#ff6b6b',
                    },
                  ]}
                >
                  {sortedEntries[sortedEntries.length - 1].weight - sortedEntries[0].weight >= 0 ? '+' : ''}
                  {(sortedEntries[sortedEntries.length - 1].weight - sortedEntries[0].weight).toFixed(1)} lbs
                </Text>
              </View>
              <View style={styles.weightGraphStat}>
                <Text style={styles.weightGraphStatLabel}>Average</Text>
                <Text style={styles.weightGraphStatValue}>
                  {(weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1)} lbs
                </Text>
              </View>
            </>
          )}
        </View>
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
                task.completed && { backgroundColor: categoryColor, borderColor: categoryColor }
              ]}>
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
        onBack={() => {
          setShowWorkoutScreen(false);
          loadSavedWorkoutPlans();
          loadActivePlans();
        }} 
      />
    );
  }

  if (showLogPastWorkout) {
    return (
      <LogPastWorkoutScreen
        onBack={() => {
          setShowLogPastWorkout(false);
          loadWorkoutHistory();
        }}
        onComplete={handleWorkoutComplete}
      />
    );
  }

  if (showBuildYourOwnScreen) {
    return (
      <BuildYourOwnWorkoutScreen 
        onBack={() => {
          setShowBuildYourOwnScreen(false);
          loadSavedWorkoutPlans();
          loadActivePlans();
        }}
        onWorkoutComplete={() => {
          loadWorkoutHistory();
          loadSavedWorkoutPlans();
        }}
      />
    );
  }

  if (selectedSavedPlan) {
    return (
      <SavedPlanViewScreen
        plan={selectedSavedPlan}
        onBack={() => {
          setSelectedSavedPlan(null);
          loadSavedWorkoutPlans();
          loadWorkoutHistory();
        }}
        onWorkoutComplete={() => {
          loadWorkoutHistory();
          loadSavedWorkoutPlans();
        }}
      />
    );
  }

  if (selectedHistorySession) {
    return (
      <WorkoutHistoryDetailScreen
        session={selectedHistorySession}
        onBack={() => setSelectedHistorySession(null)}
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
      </View>

      {/* Content */}
      <TabSwipeNavigation
        tabs={['workouts', 'nutrition', 'history']}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as any)}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {activeTab === 'workouts' && renderWorkouts()}
          {activeTab === 'nutrition' && renderNutrition()}
          {activeTab === 'history' && renderHistory()}
        </ScrollView>
      </TabSwipeNavigation>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        visible={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onFoodScanned={handleFoodScanned}
      />

      {/* Edit Meal Modal */}
      <Modal visible={!!editingMeal} transparent animationType="fade" onRequestClose={cancelEditMeal}>
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); cancelEditMeal(); }}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalCard}>
                <ScrollView 
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.modalTitle}>Edit Meal</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Meal name"
                    value={editMealFields.name}
                    onChangeText={(t) => setEditMealFields(prev => ({ ...prev, name: t }))}
                    autoCapitalize="words"
                  />
                  <View style={styles.modalRow}>
                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Protein (g)</Text>
                      <TextInput
                        style={[styles.modalInput, parseFloat(editMealFields.servings) !== 1 && styles.modalInputDisabled]}
                        placeholder="0"
                        keyboardType="numeric"
                        value={editMealFields.protein}
                        onChangeText={(t) => {
                          // If servings is not 1, recalculate base macros instead
                          if (parseFloat(editMealFields.servings) !== 1) {
                            const servingsNum = parseFloat(editMealFields.servings) || 1;
                            const newBaseProtein = parseFloat(t) / servingsNum;
                            setEditBaseMacros(prev => ({ ...prev, protein: newBaseProtein }));
                            updateEditMacrosFromServings(editMealFields.servings);
                          } else {
                            setEditMealFields(prev => ({ ...prev, protein: t }));
                            setEditBaseMacros(prev => ({ ...prev, protein: parseFloat(t) || 0 }));
                          }
                        }}
                        editable={parseFloat(editMealFields.servings) === 1}
                      />
                    </View>
                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Carbs (g)</Text>
                      <TextInput
                        style={[styles.modalInput, parseFloat(editMealFields.servings) !== 1 && styles.modalInputDisabled]}
                        placeholder="0"
                        keyboardType="numeric"
                        value={editMealFields.carbs}
                        onChangeText={(t) => {
                          if (parseFloat(editMealFields.servings) !== 1) {
                            const servingsNum = parseFloat(editMealFields.servings) || 1;
                            const newBaseCarbs = parseFloat(t) / servingsNum;
                            setEditBaseMacros(prev => ({ ...prev, carbs: newBaseCarbs }));
                            updateEditMacrosFromServings(editMealFields.servings);
                          } else {
                            setEditMealFields(prev => ({ ...prev, carbs: t }));
                            setEditBaseMacros(prev => ({ ...prev, carbs: parseFloat(t) || 0 }));
                          }
                        }}
                        editable={parseFloat(editMealFields.servings) === 1}
                      />
                    </View>
                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Fat (g)</Text>
                      <TextInput
                        style={[styles.modalInput, parseFloat(editMealFields.servings) !== 1 && styles.modalInputDisabled]}
                        placeholder="0"
                        keyboardType="numeric"
                        value={editMealFields.fat}
                        onChangeText={(t) => {
                          if (parseFloat(editMealFields.servings) !== 1) {
                            const servingsNum = parseFloat(editMealFields.servings) || 1;
                            const newBaseFat = parseFloat(t) / servingsNum;
                            setEditBaseMacros(prev => ({ ...prev, fat: newBaseFat }));
                            updateEditMacrosFromServings(editMealFields.servings);
                          } else {
                            setEditMealFields(prev => ({ ...prev, fat: t }));
                            setEditBaseMacros(prev => ({ ...prev, fat: parseFloat(t) || 0 }));
                          }
                        }}
                        editable={parseFloat(editMealFields.servings) === 1}
                      />
                    </View>
                  </View>
                  <View style={styles.modalRow}>
                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Servings</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="1"
                        keyboardType="numeric"
                        value={editMealFields.servings}
                        onChangeText={(t) => updateEditMacrosFromServings(t)}
                      />
                    </View>
                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Time (e.g., 12:15 PM)</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Time"
                        value={editMealFields.time}
                        onChangeText={(t) => setEditMealFields(prev => ({ ...prev, time: t }))}
                      />
                    </View>
                  </View>
                  <View style={styles.editMealInfo}>
                    <Text style={styles.editMealInfoText}>
                      Base per serving: {editBaseMacros.protein}g P • {editBaseMacros.carbs}g C • {editBaseMacros.fat}g F
                    </Text>
                    <Text style={styles.editMealInfoText}>
                      Total ({editMealFields.servings || '1'} servings): {editMealFields.protein}g P • {editMealFields.carbs}g C • {editMealFields.fat}g F
                    </Text>
                  </View>
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.modalButton, styles.modalCancel]} onPress={cancelEditMeal}>
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalButton, styles.modalSave]} onPress={() => saveEditedMeal().catch(console.error)}>
                      <Text style={[styles.modalButtonText, styles.modalSaveText]}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Add Weight Modal */}
      <Modal visible={showWeightModal} transparent animationType="fade" onRequestClose={() => setShowWeightModal(false)}>
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setShowWeightModal(false); }}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Add Weight</Text>
                  <View style={styles.modalField}>
                    <Text style={styles.modalLabel}>Weight (lbs)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Enter weight"
                      keyboardType="decimal-pad"
                      value={weightInput}
                      onChangeText={setWeightInput}
                    />
                  </View>
                  <View style={styles.modalField}>
                    <Text style={styles.modalLabel}>Date</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="YYYY-MM-DD"
                      value={weightDateInput}
                      onChangeText={setWeightDateInput}
                    />
                  </View>
                  <View style={styles.modalActions}>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.modalCancel]} 
                      onPress={() => {
                        setShowWeightModal(false);
                        setWeightInput('');
                        setWeightDateInput(new Date().toISOString().split('T')[0]);
                      }}
                    >
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.modalSave]} 
                      onPress={() => handleAddWeight().catch(console.error)}
                    >
                      <Text style={[styles.modalButtonText, styles.modalSaveText]}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* notifications removed */}
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
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
  },
  emptyStateContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  emptyStateSubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: '#00ff88',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
  healthMetricCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  healthMetricLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  healthMetricValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 4,
  },
  healthMetricSubtext: {
    fontSize: 12,
    color: '#666',
  },
  healthSummaryCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  healthSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  healthSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  healthSummaryItem: {
    alignItems: 'center',
  },
  healthSummaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 5,
  },
  healthSummaryLabel: {
    fontSize: 12,
    color: '#888',
  },
  healthCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  healthCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  healthCardValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 5,
  },
  healthCardSubtext: {
    fontSize: 14,
    color: '#888',
  },
  heartRateTrendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginTop: 20,
    height: 150,
  },
  heartRateDay: {
    flex: 1,
    alignItems: 'center',
  },
  heartRateBarContainer: {
    width: '80%',
    height: 100,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  heartRateBar: {
    width: '100%',
    backgroundColor: '#00ff88',
    borderRadius: 4,
    minHeight: 4,
  },
  heartRateDayLabel: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
  },
  heartRateDayValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
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
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  workoutButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  startWorkoutButton: {
    flex: 1,
    backgroundColor: '#00ff88',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
  },
  buildYourOwnButton: {
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: '#00ff88',
  },
  startWorkoutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  buildYourOwnButtonText: {
    color: '#00ff88',
  },
  logPastWorkoutButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: '#00ff88',
    marginTop: 10,
  },
  logPastWorkoutButtonText: {
    color: '#00ff88',
  },
  workoutPrograms: {
    marginBottom: 30,
  },
  categoryTabsContainer: {
    marginBottom: 20,
  },
  categoryTabsScroll: {
    marginHorizontal: -20,
  },
  categoryTab: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryTabActive: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  categoryTabTextActive: {
    color: '#1a1a1a',
    fontWeight: 'bold',
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
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  adaptationIndicator: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  adaptationIndicatorText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '600',
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
  progressIndicator: {
    fontSize: 11,
    color: '#00ff88',
    fontWeight: '600',
    fontStyle: 'normal',
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
  unitSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  unitButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3a3a3a',
    borderWidth: 1,
    borderColor: '#555',
    minWidth: 60,
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  unitButtonActive: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  unitButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  unitButtonTextActive: {
    color: '#1a1a1a',
  },
  unitPickerContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  unitPickerWrapper: {
    height: 150,
    width: 120,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  unitPickerScrollView: {
    height: 150,
  },
  unitPickerContentContainer: {
    paddingVertical: 50,
    paddingHorizontal: 10,
  },
  unitPickerItem: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  unitPickerItemSelected: {
    backgroundColor: 'transparent',
  },
  unitPickerItemText: {
    fontSize: 16,
    color: 'rgba(0, 255, 136, 0.4)',
    fontWeight: '500',
  },
  unitPickerItemTextSelected: {
    color: '#00ff88',
    fontWeight: '600',
    fontSize: 16,
  },
  unitPickerSelectionIndicator: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    height: 50,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    pointerEvents: 'none',
  },
  unitPickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: '#2a2a2a',
    opacity: 0.7,
    zIndex: 1,
  },
  unitPickerOverlayBottom: {
    top: 'auto',
    bottom: 0,
  },
  unitPickerScrollIndicator: {
    position: 'absolute',
    top: 5,
    left: 0,
    right: 0,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  unitPickerScrollIndicatorBottom: {
    top: 'auto',
    bottom: 5,
  },
  unitPickerScrollIndicatorText: {
    fontSize: 12,
    color: 'rgba(0, 255, 136, 0.6)',
    fontWeight: 'bold',
  },
  unitLabel: {
    fontSize: 14,
    color: '#888',
    marginLeft: 8,
    alignSelf: 'center',
  },
  logButton: {
    backgroundColor: '#00ff88',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  logButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    letterSpacing: 0.3,
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
  dateGroup: {
    marginBottom: 25,
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 10,
  },
  monthNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavButtonText: {
    fontSize: 24,
    color: '#00ff88',
    fontWeight: 'bold',
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  calendarWeekDays: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  weekDayLabel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
  },
  calendarDayToday: {
    backgroundColor: '#2a4a2a',
    borderRadius: 8,
  },
  calendarDayWithWorkout: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  calendarDayNumber: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  calendarDayNumberToday: {
    color: '#00ff88',
    fontWeight: 'bold',
  },
  calendarDayNumberWithWorkout: {
    color: '#00ff88',
  },
  workoutIndicator: {
    position: 'absolute',
    bottom: 2,
    left: '50%',
    transform: [{ translateX: -3 }],
  },
  workoutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00ff88',
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 15,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendDotToday: {
    backgroundColor: '#2a4a2a',
    borderWidth: 2,
    borderColor: '#00ff88',
  },
  legendDotWorkout: {
    backgroundColor: '#00ff88',
  },
  legendText: {
    fontSize: 12,
    color: '#888',
  },
  dayDetailsContainer: {
    marginTop: 20,
    marginHorizontal: 10,
    marginBottom: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  dayDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dayDetailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  closeDayDetailsButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#3a3a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeDayDetailsText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  dayDetailBubble: {
    backgroundColor: '#3a3a3a',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4a4a4a',
  },
  dayDetailBubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  dayDetailBubbleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00ff88',
  },
  dayDetailBubbleArrow: {
    fontSize: 14,
    color: '#888',
  },
  dayDetailBubbleContent: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  dayDetailItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  dayDetailItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  dayDetailItemInfo: {
    fontSize: 13,
    color: '#888',
    marginBottom: 2,
  },
  dayDetailItemMacros: {
    fontSize: 12,
    color: '#00ff88',
  },
  dayDetailTotals: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  dayDetailTotalsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  dayDetailTotalsText: {
    fontSize: 13,
    color: '#00ff88',
  },
  dayDetailEmpty: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  historyItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  historyHeaderLeft: {
    flex: 1,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  historyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  historyTime: {
    fontSize: 14,
    color: '#888',
  },
  historyStatsContainer: {
    alignItems: 'flex-end',
  },
  historyStats: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  viewDetailsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#00ff88',
    textAlign: 'right',
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
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  goalsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  compactGoalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compactGoalBlock: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    width: '23%'
  },
  compactGoalLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  compactGoalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
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
  micronutrientsTabContainer: {
    marginTop: 15,
    marginBottom: 10,
  },
  micronutrientsTabButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  micronutrientsTabButtonActive: {
    backgroundColor: '#3a3a3a',
    borderColor: '#4ECDC4',
  },
  micronutrientsTabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  micronutrientsTabTextActive: {
    color: '#4ECDC4',
  },
  micronutrientsBadge: {
    color: '#00ff88',
    fontSize: 12,
  },
  micronutrientsContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    maxHeight: 300,
  },
  micronutrientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  micronutrientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3a3a3a',
    borderRadius: 6,
    padding: 8,
    minWidth: '48%',
    marginBottom: 8,
  },
  micronutrientLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  micronutrientValue: {
    color: '#00ff88',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  micronutrientPerServing: {
    color: '#888',
    fontSize: 10,
  },
  micronutrientsEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  micronutrientsEmptyText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  mealButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  saveMealButton: {
    backgroundColor: '#00ff88',
    marginLeft: 8,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  disabledButtonText: {
    opacity: 0.5,
  },
  scanButton: {
    backgroundColor: '#00ff88',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  scanButtonText: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
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
  searchInputContainer: {
    position: 'relative',
    width: '100%',
    marginBottom: 15,
  },
  searchInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    paddingRight: 40,
    fontSize: 16,
    color: '#fff',
  },
  savedMealsList: {
    maxHeight: 260,
  },
  savedMealsListContent: {
    paddingBottom: 6,
  },
  savedMealItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  savedMealInfo: {
    flex: 1,
    paddingRight: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  savedMealName: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  savedMealMacros: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 2,
    flexWrap: 'wrap',
    lineHeight: 18,
  },
  savedMealUsage: {
    fontSize: 12,
    color: '#4ECDC4',
    marginTop: 2,
  },
  savedMealMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  savedMealLastUsed: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
    flexShrink: 1,
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
  perServingText: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
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
  mealNameInputContainer: {
    position: 'relative',
    width: '100%',
  },
  mealInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 12,
    paddingRight: 40,
    fontSize: 16,
    color: '#fff',
    marginBottom: 15,
  },
  clearButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  mealsList: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  mealsTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    padding: 4,
    marginBottom: 15,
  },
  mealsTabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealsTabButtonActive: {
    backgroundColor: '#00ff88',
  },
  mealsTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  mealsTabTextActive: {
    color: '#1a1a1a',
  },
  emptyMealsContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMealsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
  },
  emptyMealsSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  mealsScroll: {
    maxHeight: 260,
  },
  mealsScrollContent: {
    paddingBottom: 6,
  },
  mealItem: {
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  mealNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  mealName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  mealServings: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ECDC4',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  mealTime: {
    fontSize: 12,
    color: '#888',
    maxWidth: 100,
    textAlign: 'right',
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
  mealActionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  mealEditButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mealEditButtonText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
    fontSize: 12,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    width: '100%',
    maxHeight: '90%',
    maxWidth: '90%',
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  modalField: {
    flex: 1,
  },
  modalLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    marginBottom: 10,
  },
  modalInputDisabled: {
    opacity: 0.6,
    backgroundColor: '#2a2a2a',
  },
  editMealInfo: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  editMealInfoText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  modalButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalCancel: {
    backgroundColor: '#444',
    marginRight: 8,
  },
  modalSave: {
    backgroundColor: '#00ff88',
    marginLeft: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalSaveText: {
    color: '#1a1a1a',
  },
  // Swipe actions
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginLeft: 6,
    borderRadius: 8,
    height: '85%',
    alignSelf: 'center',
  },
  swipeEdit: {
    backgroundColor: '#4ECDC4',
  },
  swipeDelete: {
    backgroundColor: '#ff6b6b',
  },
  swipeButtonText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  // Workout Plan Styles
  workoutPlanTabsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  workoutPlanTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  workoutPlanTabActive: {
    borderBottomColor: '#00ff88',
  },
  workoutPlanTabText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  workoutPlanTabTextActive: {
    color: '#00ff88',
    fontWeight: 'bold',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  planHeaderLeft: {
    flex: 1,
  },
  planHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activePlanBadge: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  activeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeToggleInactive: {
    backgroundColor: '#333',
  },
  activeToggleText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  weightGraphContainer: {
    marginTop: 20,
    marginHorizontal: 10,
    marginBottom: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 15,
  },
  weightGraphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  weightGraphTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  addWeightButton: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addWeightButtonText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '600',
  },
  weightGraphEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  weightGraphEmptyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  weightGraphEmptySubtext: {
    color: '#888',
    fontSize: 14,
  },
  weightGraphContent: {
    flexDirection: 'row',
  },
  weightGraphYAxis: {
    width: 50,
    justifyContent: 'space-between',
    paddingRight: 10,
    height: 200,
  },
  weightGraphYLabel: {
    color: '#888',
    fontSize: 12,
    textAlign: 'right',
  },
  weightGraphMain: {
    flex: 1,
  },
  weightGraphSvg: {
    position: 'relative',
    marginBottom: 20,
  },
  weightGraphGridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#333',
    left: 0,
  },
  weightGraphLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#00ff88',
    transformOrigin: 'left center',
  },
  weightGraphPoint: {
    position: 'absolute',
    backgroundColor: '#00ff88',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  weightGraphXAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    height: 20,
  },
  weightGraphXLabel: {
    position: 'absolute',
    color: '#888',
    fontSize: 11,
    transform: [{ translateX: -20 }],
  },
  weightGraphStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  weightGraphStat: {
    alignItems: 'center',
  },
  weightGraphStatLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 5,
  },
  weightGraphStatValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // notifications removed
});



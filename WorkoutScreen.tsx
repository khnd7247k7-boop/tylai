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
import { loadUserData, saveUserData } from './src/utils/userStorage';
import AIService, { ProgramAdaptation } from './AIService';
import { exerciseDatabase, getExerciseData, ExerciseData } from './src/data/exerciseDatabase';
import UserProfileService from './src/services/UserProfileService';
import WorkoutOptionsScreen from './WorkoutOptionsScreen';

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  completed: boolean;
  category: 'strength' | 'cardio' | 'flexibility' | 'balance';
  restTime?: number; // seconds between sets
  // Enhanced exercise data
  movementPattern?: string;
  muscleGroups?: string[];
  equipment?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  alternatives?: string[];
}

interface ExerciseSet {
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
}

interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  sets: ExerciseSet[];
  totalSets: number;
}

interface WorkoutPlan {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  goal: 'strength' | 'weight_loss' | 'muscle_gain' | 'endurance' | 'flexibility';
  exercises: Exercise[];
  duration: number; // in minutes
  daysPerWeek?: number;
  weeklyPlan?: WeeklyWorkoutPlan;
}

interface WeeklyWorkoutPlan {
  weekDays: DayWorkout[];
}

interface DayWorkout {
  day: number; // 1-7 (Monday-Sunday)
  dayName: string;
  workoutName: string;
  focus: string; // e.g., "Upper Body", "Cardio", "Legs"
  exercises: Exercise[];
  duration: number;
}

interface WorkoutLog {
  id: string;
  date: string;
  planId: string;
  exercises: Exercise[];
  notes: string;
  duration: number;
}

interface SavedWorkoutPlan extends WorkoutPlan {
  savedAt: string;
  name: string;
  exerciseLogs?: ExerciseLog[]; // Save progress
  currentExerciseIndex?: number;
  currentSetIndex?: number;
  lastSaved?: string;
}

export default function WorkoutScreen({ onBack }: { onBack: () => void }): JSX.Element {
  // Q&A State for AI-powered workout plan generation
  const [fitnessGoals, setFitnessGoals] = useState<string>('');
  const [secondaryGoals, setSecondaryGoals] = useState<string>('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [experienceLevel, setExperienceLevel] = useState<string>('');
  const [workoutFrequency, setWorkoutFrequency] = useState<string>('');
  const [preferredWorkoutLength, setPreferredWorkoutLength] = useState<string>('');
  const [injuriesLimitations, setInjuriesLimitations] = useState<string>('');
  const [exerciseLimitations, setExerciseLimitations] = useState<string>('');
  const [currentActivityLevel, setCurrentActivityLevel] = useState<string>('');
  const [availableEquipment, setAvailableEquipment] = useState<string>('');
  const [preferredWorkoutTime, setPreferredWorkoutTime] = useState<string>('');
  const [dietaryPreferences, setDietaryPreferences] = useState<string>('');
  const [additionalInfo, setAdditionalInfo] = useState<string>('');
  
  // Legacy state (keeping for compatibility)
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [excludedExercises, setExcludedExercises] = useState<string[]>([]);
  const [currentWorkout, setCurrentWorkout] = useState<WorkoutPlan | null>(null);
  const [currentWeeklyPlan, setCurrentWeeklyPlan] = useState<WeeklyWorkoutPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [notes, setNotes] = useState('');
  const [savedPlans, setSavedPlans] = useState<SavedWorkoutPlan[]>([]);
  const [showSavedPlans, setShowSavedPlans] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [planName, setPlanName] = useState('');
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);
  const [adaptations, setAdaptations] = useState<ProgramAdaptation[]>([]);
  const [showAdaptationsModal, setShowAdaptationsModal] = useState(false);
  const [showWorkoutOptions, setShowWorkoutOptions] = useState(false);
  const [workoutOptions, setWorkoutOptions] = useState<WorkoutPlan[]>([]);

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

  // Comprehensive exercise library
  const exerciseLibrary = {
    strength: [
      'Push-ups', 'Pull-ups', 'Dips', 'Bench Press', 'Overhead Press', 'Deadlift', 'Squat',
      'Barbell Row', 'Dumbbell Row', 'Lunges', 'Leg Press', 'Calf Raises', 'Bicep Curls',
      'Tricep Extensions', 'Shoulder Press', 'Lateral Raises', 'Chest Fly', 'Hammer Curls',
      'Romanian Deadlift', 'Bulgarian Split Squats', 'Goblet Squats', 'Farmer\'s Walk',
      'Turkish Get-ups', 'Kettlebell Swings', 'Clean and Press', 'Thrusters'
    ],
    cardio: [
      'Running', 'Walking', 'Jogging', 'Cycling', 'Swimming', 'Rowing', 'Jump Rope',
      'Burpees', 'Mountain Climbers', 'Jumping Jacks', 'High Knees', 'Butt Kicks',
      'Bear Crawls', 'Crab Walks', 'HIIT Sprints', 'Box Jumps', 'Stair Climbing',
      'Elliptical', 'Treadmill', 'Stationary Bike', 'Battle Ropes', 'Sled Push'
    ],
    flexibility: [
      'Yoga', 'Stretching', 'Pilates', 'Hip Flexor Stretch', 'Hamstring Stretch',
      'Quad Stretch', 'Calf Stretch', 'Shoulder Stretch', 'Neck Stretch', 'Spinal Twist',
      'Downward Dog', 'Pigeon Pose', 'Child\'s Pose', 'Cat-Cow', 'Warrior Poses',
      'Forward Fold', 'Side Stretch', 'Chest Opener', 'Hip Circles'
    ],
    balance: [
      'Single Leg Stand', 'Plank', 'Side Plank', 'Bird Dog', 'Dead Bug', 'Superman',
      'Wall Sit', 'Balance Board', 'Bosu Ball Exercises', 'One-Legged Deadlift',
      'Tree Pose', 'Warrior III', 'Standing Calf Raise', 'Single Leg Glute Bridge'
    ]
  };

  // Get all exercises as a flat list with categories
  const getAllExercises = () => {
    const all: Array<{ name: string; category: 'strength' | 'cardio' | 'flexibility' | 'balance' }> = [];
    Object.entries(exerciseLibrary).forEach(([category, exercises]) => {
      exercises.forEach(exercise => {
        all.push({ name: exercise, category: category as any });
      });
    });
    return all.sort((a, b) => a.name.localeCompare(b.name));
  };

  const allExercises = getAllExercises();

  // Load saved plans on mount
  useEffect(() => {
    loadSavedPlans();
  }, []);

  const loadSavedPlans = async () => {
    try {
      const saved = await loadUserData<SavedWorkoutPlan[]>('savedWorkoutPlans');
      if (saved) {
        setSavedPlans(saved);
      }
    } catch (error) {
      console.error('Error loading saved plans:', error);
    }
  };

  const saveCurrentPlan = () => {
    if (!currentWorkout || !currentWeeklyPlan) {
      Alert.alert('Error', 'No workout plan to save');
      return;
    }
    setPlanName('');
    setShowSaveModal(true);
  };

  const handleSavePlan = async () => {
    if (!planName || planName.trim() === '') {
      Alert.alert('Error', 'Please enter a name for the plan');
      return;
    }

    if (!currentWorkout || !currentWeeklyPlan) {
      return;
    }

    const savedPlan: SavedWorkoutPlan = {
      ...currentWorkout,
      weeklyPlan: currentWeeklyPlan,
      name: planName.trim(),
      savedAt: new Date().toISOString(),
    };

    try {
      const updatedPlans = [...savedPlans, savedPlan];
      await saveUserData('savedWorkoutPlans', updatedPlans);
      setSavedPlans(updatedPlans);
      setShowSaveModal(false);
      setPlanName('');
      Alert.alert('Success', 'Workout plan saved!');
    } catch (error) {
      console.error('Error saving plan:', error);
      Alert.alert('Error', 'Failed to save plan');
    }
  };

  const loadPlan = async (plan: SavedWorkoutPlan) => {
    setCurrentWorkout(plan);
    setCurrentWeeklyPlan(plan.weeklyPlan || null);
    if (plan.weeklyPlan && plan.weeklyPlan.weekDays.length > 0) {
      setCurrentWorkout({
        ...plan,
        exercises: plan.weeklyPlan.weekDays[0].exercises,
        duration: plan.weeklyPlan.weekDays[0].duration
      });
      // Restore saved progress if available
      if (plan.exerciseLogs && plan.exerciseLogs.length > 0) {
        setExerciseLogs(plan.exerciseLogs);
        setCurrentExerciseIndex(plan.currentExerciseIndex || 0);
        setCurrentSetIndex(plan.currentSetIndex || 0);
      } else {
        // Initialize fresh logs
        const initialLogs: ExerciseLog[] = plan.weeklyPlan.weekDays[0].exercises.map(ex => ({
          exerciseId: ex.id,
          exerciseName: ex.name,
          totalSets: ex.sets,
          sets: Array.from({ length: ex.sets }, (_, i) => ({
            setNumber: i + 1,
            reps: ex.reps,
            weight: 0,
            completed: false
          }))
        }));
        setExerciseLogs(initialLogs);
        setCurrentExerciseIndex(0);
        setCurrentSetIndex(0);
      }
    } else {
      // Restore saved progress if available
      if (plan.exerciseLogs && plan.exerciseLogs.length > 0) {
        setExerciseLogs(plan.exerciseLogs);
        setCurrentExerciseIndex(plan.currentExerciseIndex || 0);
        setCurrentSetIndex(plan.currentSetIndex || 0);
      } else {
        // Initialize fresh logs
        const initialLogs: ExerciseLog[] = plan.exercises.map(ex => ({
          exerciseId: ex.id,
          exerciseName: ex.name,
          totalSets: ex.sets,
          sets: Array.from({ length: ex.sets }, (_, i) => ({
            setNumber: i + 1,
            reps: ex.reps,
            weight: 0,
            completed: false
          }))
        }));
        setExerciseLogs(initialLogs);
        setCurrentExerciseIndex(0);
        setCurrentSetIndex(0);
      }
    }
    setSelectedDay(0);
    setShowSavedPlans(false);
    
    // Load workout history and analyze performance
    try {
      // Load workout history from storage
      const history = await loadUserData<any[]>('workoutHistory');
      if (history) {
        setWorkoutHistory(history);
        
        // Analyze performance and get adaptations
        if (plan.id) {
          const adaptations = AIService.analyzeWorkoutPerformance(history, plan);
          setAdaptations(adaptations);
        }
      }
    } catch (error) {
      console.error('Error loading workout history:', error);
      // Don't block the workout from loading if history fails
    }
    
    // Wait a moment to ensure state is set before opening modal
    setTimeout(() => {
      setShowWorkoutModal(true);
    }, 50);
  };

  const deletePlan = async (planId: string) => {
    Alert.alert(
      'Delete Plan',
      'Are you sure you want to delete this plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedPlans = savedPlans.filter(p => p.id !== planId);
              await saveUserData('savedWorkoutPlans', updatedPlans);
              setSavedPlans(updatedPlans);
            } catch (error) {
              console.error('Error deleting plan:', error);
              Alert.alert('Error', 'Failed to delete plan');
            }
          },
        },
      ]
    );
  };

  // Generate multiple workout variations
  const generateMultipleWorkoutPlans = async (
    goal: string, 
    level: string, 
    days: number, 
    excludedExercises: string[],
    gender?: 'male' | 'female' | 'other',
    secondaryGoals?: string[],
    preferredLength?: number,
    count: number = 3
  ): Promise<WorkoutPlan[]> => {
    const plans: WorkoutPlan[] = [];
    
    // Generate multiple variations by varying exercise selection
    for (let i = 0; i < count; i++) {
      try {
        const plan = await generateWorkoutPlan(
          goal,
          level,
          days,
          excludedExercises,
          gender,
          secondaryGoals,
          preferredLength,
          i // Pass variation index to create different plans
        );
        // Add variation identifier to name
        plan.name = `${plan.name} - Option ${i + 1}`;
        plan.id = `${Date.now()}-${i}`;
        plans.push(plan);
      } catch (error) {
        console.error(`Error generating workout plan ${i + 1}:`, error);
      }
    }
    
    return plans;
  };

  const generateWorkoutPlan = async (
    goal: string, 
    level: string, 
    days: number, 
    excludedExercises: string[],
    gender?: 'male' | 'female' | 'other',
    secondaryGoals?: string[],
    preferredLength?: number,
    variationIndex: number = 0
  ): Promise<WorkoutPlan> => {
    const userProfile = await UserProfileService.getUserProfileData();
    const userEquipment = userProfile?.equipmentAvailability?.toLowerCase() || availableEquipment.toLowerCase();
    const workoutLength = preferredLength || userProfile?.preferredWorkoutLength || 45;
    const workoutHistory = (await loadUserData<any[]>('workoutHistory')) || [];

    // ─── Step 1: Determine goal (from fitness goals + secondary goals questions) ───
    const resolvedGoal = goal || 'strength';
    const resolvedSecondaryGoals = secondaryGoals ?? [];

    // ─── Step 2: Determine split structure (from goal + days per week question) ───
    const getSplitStructure = (): { focuses: string[]; workoutDayIndices: number[] } => {
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      let focuses: string[] = [];
      if (resolvedGoal === 'strength' || resolvedGoal === 'muscle_gain') {
        if (days <= 3) focuses = ['Full Body', 'Full Body', 'Full Body'];
        else if (days === 4) focuses = ['Upper Body', 'Lower Body', 'Upper Body', 'Lower Body'];
        else if (days === 5) focuses = ['Push', 'Pull', 'Legs', 'Push', 'Pull'];
        else if (days === 6) focuses = ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'];
        else focuses = ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Active Recovery'];
      } else if (resolvedGoal === 'weight_loss') {
        // Same split as strength — weight is lost in the kitchen, not by adding extra cardio
        if (days <= 3) focuses = ['Full Body', 'Full Body', 'Full Body'];
        else if (days === 4) focuses = ['Upper Body', 'Lower Body', 'Upper Body', 'Lower Body'];
        else if (days === 5) focuses = ['Push', 'Pull', 'Legs', 'Push', 'Pull'];
        else if (days === 6) focuses = ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'];
        else focuses = ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Active Recovery'];
      } else if (resolvedGoal === 'endurance') {
        focuses = Array(days).fill('Cardio & Endurance');
      } else if (resolvedGoal === 'flexibility') {
        focuses = Array(days).fill('Flexibility & Mobility');
      } else {
        focuses = Array(days).fill('Full Body');
      }
      let workoutDayIndices: number[] = [];
      if (days === 3) workoutDayIndices = [0, 2, 4];
      else if (days === 4) workoutDayIndices = [0, 2, 4, 6];
      else if (days === 5) workoutDayIndices = [0, 1, 3, 4, 6];
      else if (days === 6) workoutDayIndices = [0, 1, 2, 3, 4, 5];
      else workoutDayIndices = [0, 1, 2, 3, 4, 5, 6];
      return { focuses, workoutDayIndices };
    };
    const { focuses: splitFocuses, workoutDayIndices } = getSplitStructure();

    // ─── Step 3: Determine progression stage (from experience level question) ───
    const progressionStage = level;
    const recentWeeks = workoutHistory
      .filter((w: any) => w.completed && w.date)
      .reduce((acc: { [key: string]: number }, w: any) => {
        const d = new Date(w.date);
        const weekKey = `${d.getFullYear()}-W${Math.ceil(d.getDate() / 7)}`;
        acc[weekKey] = (acc[weekKey] || 0) + 1;
        return acc;
      }, {});
    const sessionsLastTwoWeeks = Object.values(recentWeeks).reduce((a, b) => a + b, 0);
    const suggestLighterWeek = days >= 4 && sessionsLastTwoWeeks >= days * 2;

    // ─── Step 4: Check recovery (from workout history + frequency/length preferences) ───
    const recoveryAdjustment = suggestLighterWeek ? 'reduce_volume' : 'none';
    const exercisesPerDayBase = level === 'beginner' ? 4 : level === 'intermediate' ? 5 : 6;
    const exercisesPerDay = recoveryAdjustment === 'reduce_volume' ? Math.max(3, exercisesPerDayBase - 1) : exercisesPerDayBase;

    // ─── Step 5: Select movements (equipment + injuries/limitations + goal + split) ───
    const getExercisePool = (): ExerciseData[] => {
      let pool: ExerciseData[] = [];
      if (resolvedGoal === 'strength' || resolvedGoal === 'muscle_gain') {
        pool = exerciseDatabase.filter(ex => ex.category === 'strength');
      } else if (resolvedGoal === 'weight_loss') {
        // Strength-focused; don't auto-add cardio — focus on nutrition for weight loss
        pool = exerciseDatabase.filter(ex => ex.category === 'strength');
      } else if (resolvedGoal === 'endurance') {
        pool = exerciseDatabase.filter(ex => ex.category === 'cardio');
      } else if (resolvedGoal === 'flexibility') {
        pool = exerciseDatabase.filter(ex => ex.category === 'flexibility' || ex.category === 'balance');
      }
      if (resolvedSecondaryGoals.some(g => g === 'flexibility' || g === 'mobility')) {
        const flex = exerciseDatabase.filter(ex => ex.category === 'flexibility' || ex.category === 'balance');
        const combined = new Map<string, ExerciseData>();
        pool.forEach(e => combined.set(e.id, e));
        flex.forEach(e => combined.set(e.id, e));
        pool = Array.from(combined.values());
      }
      if (userEquipment && userEquipment !== 'full gym' && userEquipment !== 'all') {
        const getEquipment = (ex: ExerciseData) => ex.equipmentRequired || ex.equipment || [];
        if (userEquipment.includes('bodyweight') || userEquipment.includes('no equipment')) {
          pool = pool.filter(ex => {
            const eq = getEquipment(ex);
            return eq.includes('bodyweight') || eq.includes('none');
          });
        } else if (userEquipment.includes('dumbbell')) {
          pool = pool.filter(ex => {
            const eq = getEquipment(ex);
            return eq.includes('bodyweight') || eq.includes('dumbbells') || eq.includes('none');
          });
        }
      }
      pool = pool.filter(ex => {
        if (level === 'beginner') return ex.difficulty === 'beginner' || ex.difficulty === 'intermediate';
        if (level === 'intermediate') return ex.difficulty === 'beginner' || ex.difficulty === 'intermediate' || ex.difficulty === 'advanced';
        return ex.difficulty === 'intermediate' || ex.difficulty === 'advanced';
      });
      pool = pool.filter(ex => !excludedExercises.includes(ex.name));
      return pool;
    };
    const exercisePool = getExercisePool();
    
    // ─── Step 6: Set sets/reps/rest (goal + progression stage) ───
    const getExerciseDetails = (exerciseData: ExerciseData): Exercise => {
      const rawCategory = exerciseData.category;
      const exerciseCategory: 'strength' | 'cardio' | 'flexibility' | 'balance' =
        rawCategory === 'stability' ? 'balance' : rawCategory;
      let sets = 3;
      let reps = 10;
      let restTime: number | undefined;
      if (exerciseCategory === 'strength') {
        if (resolvedGoal === 'strength') {
          sets = level === 'beginner' ? 3 : 4;
          reps = level === 'beginner' ? 8 : level === 'intermediate' ? 6 : 5;
          restTime = level === 'beginner' ? 90 : level === 'intermediate' ? 120 : 150;
        } else if (resolvedGoal === 'muscle_gain') {
          sets = level === 'beginner' ? 3 : 4;
          reps = level === 'beginner' ? 10 : level === 'intermediate' ? 10 : 8;
          restTime = 60;
        } else if (resolvedGoal === 'weight_loss') {
          sets = 3;
          reps = level === 'beginner' ? 12 : 15;
          restTime = 45;
        } else {
          sets = level === 'beginner' ? 3 : 4;
          reps = level === 'beginner' ? 10 : level === 'intermediate' ? 8 : 6;
          restTime = 90;
        }
      } else if (exerciseCategory === 'cardio') {
        sets = 1;
        reps = level === 'beginner' ? 20 : level === 'intermediate' ? 30 : 45;
      } else if (exerciseCategory === 'flexibility' || exerciseCategory === 'balance') {
        sets = level === 'beginner' ? 1 : level === 'intermediate' ? 2 : 3;
        reps = level === 'beginner' ? 30 : level === 'intermediate' ? 45 : 60;
      }
      // Compound (multiple muscle groups) ≤ 10 reps; isolation (single muscle group) ≤ 20 reps
      if (exerciseCategory === 'strength') {
        const isCompound = (exerciseData.secondaryMuscleGroups?.length ?? 0) >= 1;
        const maxReps = isCompound ? 10 : 20;
        reps = Math.min(reps, maxReps);
      }
      return {
        id: exerciseData.name.toLowerCase().replace(/\s+/g, '-'),
        name: exerciseData.name,
        sets,
        reps,
        weight: 0,
        completed: false,
        category: exerciseCategory,
        restTime,
        movementPattern: exerciseData.movementPattern,
        muscleGroups: exerciseData.muscleGroups || [exerciseData.primaryMuscleGroup, ...exerciseData.secondaryMuscleGroups],
        equipment: exerciseData.equipment || exerciseData.equipmentRequired,
        difficulty: exerciseData.difficulty,
        alternatives: exerciseData.alternatives
      };
    };
    
    if (exercisePool.length === 0) {
      console.error('No exercises available after filtering exclusions');
      const pushUpData = getExerciseData('Push-ups');
      if (!pushUpData) throw new Error('Unable to generate workout plan - no exercises available');
      const defaultExercise = getExerciseDetails(pushUpData);
      return {
        id: Date.now().toString(),
        name: `${level.charAt(0).toUpperCase() + level.slice(1)} ${resolvedGoal.replace('_', ' ')} Program`,
        level: level as any,
        goal: resolvedGoal as any,
        exercises: [defaultExercise],
        duration: workoutLength,
        daysPerWeek: days,
        weeklyPlan: {
          weekDays: [{
            day: 1,
            dayName: 'Monday',
            workoutName: 'Full Body Workout',
            focus: 'Full Body',
            exercises: [defaultExercise],
            duration: workoutLength
          }]
        }
      };
    }

    // Helper function to select exercises ensuring different muscle regions are targeted
    // Helper function to shuffle and select exercises
    // Use variationIndex to create different shuffles for different workout options
    const shuffleArray = <T,>(array: T[]): T[] => {
      const shuffled = [...array];
      // Create a pseudo-random seed based on variationIndex
      let seed = variationIndex * 7919; // Use a prime number for better distribution
      const random = () => {
        seed = (seed * 9301 + 49297) % 233280; // Linear congruential generator
        return seed / 233280;
      };
      
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const selectExercisesWithRegionVariety = (
      availableExercises: ExerciseData[],
      targetMuscleGroup: string,
      usedRegions: Set<string>,
      count: number
    ): ExerciseData[] => {
      const muscleGroupExercises = availableExercises.filter(e => 
        e.primaryMuscleGroup.toLowerCase() === targetMuscleGroup.toLowerCase()
      );
      
      if (muscleGroupExercises.length === 0) return [];
      
      // Group exercises by muscle region
      const exercisesByRegion = new Map<string, ExerciseData[]>();
      const fullRegionExercises: ExerciseData[] = [];
      
      muscleGroupExercises.forEach(ex => {
        const region = ex.muscleRegion || 'full';
        if (region === 'full') {
          fullRegionExercises.push(ex);
        } else {
          if (!exercisesByRegion.has(region)) {
            exercisesByRegion.set(region, []);
          }
          exercisesByRegion.get(region)!.push(ex);
        }
      });
      
      const selected: ExerciseData[] = [];
      const availableRegions = Array.from(exercisesByRegion.keys());
      
      // First, try to select exercises from regions not yet used
      const unusedRegions = availableRegions.filter(r => !usedRegions.has(`${targetMuscleGroup}-${r}`));
      
      for (const region of unusedRegions) {
        if (selected.length >= count) break;
        const regionExercises = exercisesByRegion.get(region) || [];
        if (regionExercises.length > 0) {
          const randomEx = regionExercises[Math.floor(Math.random() * regionExercises.length)];
          selected.push(randomEx);
          usedRegions.add(`${targetMuscleGroup}-${region}`);
        }
      }
      
      // If we still need more exercises, use any available region
      if (selected.length < count) {
        const remaining = muscleGroupExercises.filter(e => !selected.includes(e));
        const needed = count - selected.length;
        const shuffled = shuffleArray(remaining);
        selected.push(...shuffled.slice(0, needed));
      }
      
      return selected.slice(0, count);
    };

    // Generate weekly plan using split structure (step 2) and recovery-adjusted volume (step 4)
    const generateWeeklyPlan = (): WeeklyWorkoutPlan => {
      const weekDays: DayWorkout[] = [];
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const muscleRegionTracker = new Map<string, Set<string>>();
      const focuses = splitFocuses;
      const workoutDays = workoutDayIndices;

      for (let i = 0; i < days; i++) {
        const dayIndex = workoutDays[i];
        const focus = focuses[i] || 'Full Body';
        let dayExercises: Exercise[] = [];
        
        // Safety check: ensure exercise pool has exercises
        if (exercisePool.length === 0) {
          // If all exercises are excluded, use a minimal safe set
            const pushUpData = getExerciseData('Push-ups');
            if (pushUpData) {
              dayExercises = [getExerciseDetails(pushUpData)];
            }
        } else {
        if (focus.includes('Upper Body')) {
          // Upper body: chest, shoulders, back, arms
          const upperBodyMuscleGroups = ['chest', 'shoulders', 'back', 'biceps', 'triceps', 'arms'];
          let upperBodyExercises = exercisePool.filter(e => {
            const muscleGroups = e.muscleGroups || [e.primaryMuscleGroup, ...e.secondaryMuscleGroups];
            return e.category === 'strength' && 
                   muscleGroups.some(mg => upperBodyMuscleGroups.some(umg => mg.toLowerCase().includes(umg.toLowerCase())));
          });
          
          // For advanced users, prioritize advanced exercises
          if (level === 'advanced' && upperBodyExercises.length > 0) {
            const advancedExercises = upperBodyExercises.filter(e => e.difficulty === 'advanced');
            const intermediateExercises = upperBodyExercises.filter(e => e.difficulty === 'intermediate');
            // Prefer advanced exercises, but include some intermediate for variety
            upperBodyExercises = [...advancedExercises, ...intermediateExercises];
          }
          
          // Select exercises ensuring different muscle regions for each muscle group
          if (upperBodyExercises.length > 0) {
            const selectedExercises: ExerciseData[] = [];
            
            // Target chest with region variety
            const chestExercises = upperBodyExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'chest'
            );
            if (chestExercises.length > 0) {
              const usedChestRegions = muscleRegionTracker.get('chest') || new Set<string>();
              const chestCount = Math.min(2, Math.floor(exercisesPerDay / 4));
              const selectedChest = selectExercisesWithRegionVariety(
                chestExercises,
                'chest',
                usedChestRegions,
                chestCount
              );
              muscleRegionTracker.set('chest', usedChestRegions);
              selectedExercises.push(...selectedChest);
            }
            
            // Target back with region variety
            const backExercises = upperBodyExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'back'
            );
            if (backExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const usedBackRegions = muscleRegionTracker.get('back') || new Set<string>();
              const backCount = Math.min(2, Math.floor((exercisesPerDay - selectedExercises.length) / 2));
              const selectedBack = selectExercisesWithRegionVariety(
                backExercises,
                'back',
                usedBackRegions,
                backCount
              );
              muscleRegionTracker.set('back', usedBackRegions);
              selectedExercises.push(...selectedBack);
            }
            
            // Add shoulders, biceps, triceps
            const otherExercises = upperBodyExercises.filter(e => 
              !selectedExercises.includes(e) &&
              (e.primaryMuscleGroup.toLowerCase() === 'shoulders' ||
               e.primaryMuscleGroup.toLowerCase() === 'biceps' ||
               e.primaryMuscleGroup.toLowerCase() === 'triceps')
            );
            if (otherExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(otherExercises);
              selectedExercises.push(...shuffled.slice(0, needed));
            }
            
            // Fill remaining with any upper body exercises
            if (selectedExercises.length < exercisesPerDay) {
              const remaining = upperBodyExercises.filter(e => !selectedExercises.includes(e));
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(remaining);
              selectedExercises.push(...shuffled.slice(0, needed));
            }
            
            dayExercises = selectedExercises.slice(0, exercisesPerDay).map(ex => getExerciseDetails(ex));
          }
        } else if (focus.includes('Lower Body')) {
          // Lower body: quads, hamstrings, glutes, calves
          const lowerBodyMuscleGroups = ['quadriceps', 'hamstrings', 'glutes', 'calves', 'legs'];
          let lowerBodyExercises = exercisePool.filter(e => {
            const muscleGroups = e.muscleGroups || [e.primaryMuscleGroup, ...e.secondaryMuscleGroups];
            return e.category === 'strength' && 
                   muscleGroups.some(mg => lowerBodyMuscleGroups.some(lmg => mg.toLowerCase().includes(lmg.toLowerCase())));
          });
          
          // For advanced users, prioritize advanced exercises
          if (level === 'advanced' && lowerBodyExercises.length > 0) {
            const advancedExercises = lowerBodyExercises.filter(e => e.difficulty === 'advanced');
            const intermediateExercises = lowerBodyExercises.filter(e => e.difficulty === 'intermediate');
            lowerBodyExercises = [...advancedExercises, ...intermediateExercises];
          }
          
          // Select exercises ensuring different muscle regions for each muscle group
          if (lowerBodyExercises.length > 0) {
            const selectedExercises: ExerciseData[] = [];
            
            // Target quads with region variety
            const quadExercises = lowerBodyExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'quadriceps' || 
              e.primaryMuscleGroup.toLowerCase() === 'legs'
            );
            if (quadExercises.length > 0) {
              const usedQuadRegions = muscleRegionTracker.get('quadriceps') || new Set<string>();
              const quadCount = Math.min(2, Math.floor(exercisesPerDay / 3));
              const selectedQuads = selectExercisesWithRegionVariety(
                quadExercises,
                'quadriceps',
                usedQuadRegions,
                quadCount
              );
              muscleRegionTracker.set('quadriceps', usedQuadRegions);
              selectedExercises.push(...selectedQuads);
            }
            
            // Target hamstrings with region variety
            const hamstringExercises = lowerBodyExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'hamstrings'
            );
            if (hamstringExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const usedHamstringRegions = muscleRegionTracker.get('hamstrings') || new Set<string>();
              const hamstringCount = Math.min(2, Math.floor((exercisesPerDay - selectedExercises.length) / 2));
              const selectedHamstrings = selectExercisesWithRegionVariety(
                hamstringExercises,
                'hamstrings',
                usedHamstringRegions,
                hamstringCount
              );
              muscleRegionTracker.set('hamstrings', usedHamstringRegions);
              selectedExercises.push(...selectedHamstrings);
            }
            
            // Target glutes
            const gluteExercises = lowerBodyExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'glutes'
            );
            if (gluteExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(gluteExercises);
              selectedExercises.push(...shuffled.slice(0, Math.min(1, needed)));
            }
            
            // Target calves
            const calfExercises = lowerBodyExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'calves'
            );
            if (calfExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(calfExercises);
              selectedExercises.push(...shuffled.slice(0, Math.min(1, needed)));
            }
            
            // Fill remaining with any lower body exercises
            if (selectedExercises.length < exercisesPerDay) {
              const remaining = lowerBodyExercises.filter(e => !selectedExercises.includes(e));
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(remaining);
              selectedExercises.push(...shuffled.slice(0, needed));
            }
            
            dayExercises = selectedExercises.slice(0, exercisesPerDay).map(ex => getExerciseDetails(ex));
          }
        } else if (focus.includes('Push')) {
          let pushExercises = exercisePool.filter(e => 
            e.category === 'strength' && e.movementPattern === 'push'
          );
          
          // For advanced users, prioritize advanced exercises
          if (level === 'advanced' && pushExercises.length > 0) {
            const advancedExercises = pushExercises.filter(e => e.difficulty === 'advanced');
            const intermediateExercises = pushExercises.filter(e => e.difficulty === 'intermediate');
            pushExercises = [...advancedExercises, ...intermediateExercises];
          }
          
          // Select exercises ensuring different muscle regions for chest, shoulders, triceps
          if (pushExercises.length > 0) {
            const selectedExercises: ExerciseData[] = [];
            
            // Target chest exercises with region variety (upper, mid, lower)
            const chestExercises = pushExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'chest'
            );
            if (chestExercises.length > 0) {
              const usedChestRegions = muscleRegionTracker.get('chest') || new Set<string>();
              const chestCount = Math.min(2, Math.floor(exercisesPerDay / 3)); // 1-2 chest exercises
              const selectedChest = selectExercisesWithRegionVariety(
                chestExercises,
                'chest',
                usedChestRegions,
                chestCount
              );
              muscleRegionTracker.set('chest', usedChestRegions);
              selectedExercises.push(...selectedChest);
            }
            
            // Target shoulder exercises with region variety (front, lateral, rear)
            const shoulderExercises = pushExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'shoulders'
            );
            if (shoulderExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const usedShoulderRegions = muscleRegionTracker.get('shoulders') || new Set<string>();
              const shoulderCount = Math.min(1, exercisesPerDay - selectedExercises.length);
              const selectedShoulders = selectExercisesWithRegionVariety(
                shoulderExercises,
                'shoulders',
                usedShoulderRegions,
                shoulderCount
              );
              muscleRegionTracker.set('shoulders', usedShoulderRegions);
              selectedExercises.push(...selectedShoulders);
            }
            
            // Target tricep exercises
            const tricepExercises = pushExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'triceps'
            );
            if (tricepExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(tricepExercises);
              selectedExercises.push(...shuffled.slice(0, Math.min(1, needed)));
            }
            
            // Fill remaining slots with any push exercises
            if (selectedExercises.length < exercisesPerDay) {
              const remaining = pushExercises.filter(e => !selectedExercises.includes(e));
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(remaining);
              selectedExercises.push(...shuffled.slice(0, needed));
            }
            
            dayExercises = selectedExercises.slice(0, exercisesPerDay).map(ex => getExerciseDetails(ex));
          }
        } else if (focus.includes('Pull')) {
          let pullExercises = exercisePool.filter(e =>
            e.category === 'strength' && e.movementPattern === 'pull'
          );
          
          // For advanced users, prioritize advanced exercises
          if (level === 'advanced' && pullExercises.length > 0) {
            const advancedExercises = pullExercises.filter(e => e.difficulty === 'advanced');
            const intermediateExercises = pullExercises.filter(e => e.difficulty === 'intermediate');
            pullExercises = [...advancedExercises, ...intermediateExercises];
          }
          
          // Select exercises ensuring different muscle regions for back, biceps
          if (pullExercises.length > 0) {
            const selectedExercises: ExerciseData[] = [];
            
            // Target back exercises with region variety (upper, mid, lower)
            const backExercises = pullExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'back'
            );
            if (backExercises.length > 0) {
              const usedBackRegions = muscleRegionTracker.get('back') || new Set<string>();
              const backCount = Math.min(3, Math.floor(exercisesPerDay * 0.6)); // 2-3 back exercises
              const selectedBack = selectExercisesWithRegionVariety(
                backExercises,
                'back',
                usedBackRegions,
                backCount
              );
              muscleRegionTracker.set('back', usedBackRegions);
              selectedExercises.push(...selectedBack);
            }
            
            // Target bicep exercises
            const bicepExercises = pullExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'biceps'
            );
            if (bicepExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(bicepExercises);
              selectedExercises.push(...shuffled.slice(0, Math.min(2, needed)));
            }
            
            // Fill remaining slots with any pull exercises
            if (selectedExercises.length < exercisesPerDay) {
              const remaining = pullExercises.filter(e => !selectedExercises.includes(e));
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(remaining);
              selectedExercises.push(...shuffled.slice(0, needed));
            }
            
            dayExercises = selectedExercises.slice(0, exercisesPerDay).map(ex => getExerciseDetails(ex));
          }
        } else if (focus.includes('Legs')) {
          const legMuscleGroups = ['quadriceps', 'hamstrings', 'glutes', 'calves'];
          let legExercises = exercisePool.filter(e => {
            const muscleGroups = e.muscleGroups || [e.primaryMuscleGroup, ...e.secondaryMuscleGroups];
            return e.category === 'strength' && 
                   (e.movementPattern === 'squat' || e.movementPattern === 'lunge' || e.movementPattern === 'hinge' ||
                    muscleGroups.some(mg => legMuscleGroups.some(lmg => mg.toLowerCase().includes(lmg.toLowerCase()))));
          });
          
          // For advanced users, prioritize advanced exercises
          if (level === 'advanced' && legExercises.length > 0) {
            const advancedExercises = legExercises.filter(e => e.difficulty === 'advanced');
            const intermediateExercises = legExercises.filter(e => e.difficulty === 'intermediate');
            legExercises = [...advancedExercises, ...intermediateExercises];
          }
          
          // Select exercises ensuring different muscle regions for each muscle group
          if (legExercises.length > 0) {
            const selectedExercises: ExerciseData[] = [];
            
            // Target quads with region variety
            const quadExercises = legExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'quadriceps' || 
              e.primaryMuscleGroup.toLowerCase() === 'legs'
            );
            if (quadExercises.length > 0) {
              const usedQuadRegions = muscleRegionTracker.get('quadriceps') || new Set<string>();
              const quadCount = Math.min(2, Math.floor(exercisesPerDay / 3));
              const selectedQuads = selectExercisesWithRegionVariety(
                quadExercises,
                'quadriceps',
                usedQuadRegions,
                quadCount
              );
              muscleRegionTracker.set('quadriceps', usedQuadRegions);
              selectedExercises.push(...selectedQuads);
            }
            
            // Target hamstrings with region variety
            const hamstringExercises = legExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'hamstrings'
            );
            if (hamstringExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const usedHamstringRegions = muscleRegionTracker.get('hamstrings') || new Set<string>();
              const hamstringCount = Math.min(2, Math.floor((exercisesPerDay - selectedExercises.length) / 2));
              const selectedHamstrings = selectExercisesWithRegionVariety(
                hamstringExercises,
                'hamstrings',
                usedHamstringRegions,
                hamstringCount
              );
              muscleRegionTracker.set('hamstrings', usedHamstringRegions);
              selectedExercises.push(...selectedHamstrings);
            }
            
            // Target glutes
            const gluteExercises = legExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'glutes'
            );
            if (gluteExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(gluteExercises);
              selectedExercises.push(...shuffled.slice(0, Math.min(1, needed)));
            }
            
            // Target calves
            const calfExercises = legExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'calves'
            );
            if (calfExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(calfExercises);
              selectedExercises.push(...shuffled.slice(0, Math.min(1, needed)));
            }
            
            // Fill remaining with any leg exercises
            if (selectedExercises.length < exercisesPerDay) {
              const remaining = legExercises.filter(e => !selectedExercises.includes(e));
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(remaining);
              selectedExercises.push(...shuffled.slice(0, needed));
            }
            
            dayExercises = selectedExercises.slice(0, exercisesPerDay).map(ex => getExerciseDetails(ex));
          }
        } else if (focus.includes('Cardio') || focus.includes('HIIT')) {
          let cardioExercises = exercisePool.filter(e =>
            e.category === 'cardio' || (e.category === 'strength' && ['Burpees', 'Kettlebell Swings', 'Thrusters'].includes(e.name))
          );
          if (cardioExercises.length > 0) {
            cardioExercises = shuffleArray(cardioExercises);
            const offset = (i * 3) % cardioExercises.length;
            const rotatedExercises = [...cardioExercises.slice(offset), ...cardioExercises.slice(0, offset)];
            dayExercises = rotatedExercises.slice(0, exercisesPerDay).map(ex => getExerciseDetails(ex));
          }
        } else if (focus.includes('Flexibility')) {
          let flexExercises = exercisePool.filter(e =>
            e.category === 'flexibility' || e.category === 'balance'
          );
          if (flexExercises.length > 0) {
            flexExercises = shuffleArray(flexExercises);
            const offset = (i * 2) % flexExercises.length;
            const rotatedExercises = [...flexExercises.slice(offset), ...flexExercises.slice(0, offset)];
            dayExercises = rotatedExercises.slice(0, exercisesPerDay).map(ex => getExerciseDetails(ex));
          }
        } else {
          // Full Body - mix of exercises from all categories with muscle region variety
          if (exercisePool.length > 0) {
            const selectedExercises: ExerciseData[] = [];
            const strengthExercises = exercisePool.filter(e => e.category === 'strength');
            
            // Target chest with region variety
            const chestExercises = strengthExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'chest'
            );
            if (chestExercises.length > 0) {
              const usedChestRegions = muscleRegionTracker.get('chest') || new Set<string>();
              const chestCount = Math.min(1, Math.floor(exercisesPerDay / 6));
              const selectedChest = selectExercisesWithRegionVariety(
                chestExercises,
                'chest',
                usedChestRegions,
                chestCount
              );
              muscleRegionTracker.set('chest', usedChestRegions);
              selectedExercises.push(...selectedChest);
            }
            
            // Target back with region variety
            const backExercises = strengthExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'back'
            );
            if (backExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const usedBackRegions = muscleRegionTracker.get('back') || new Set<string>();
              const backCount = Math.min(1, Math.floor((exercisesPerDay - selectedExercises.length) / 5));
              const selectedBack = selectExercisesWithRegionVariety(
                backExercises,
                'back',
                usedBackRegions,
                backCount
              );
              muscleRegionTracker.set('back', usedBackRegions);
              selectedExercises.push(...selectedBack);
            }
            
            // Target shoulders with region variety
            const shoulderExercises = strengthExercises.filter(e => 
              e.primaryMuscleGroup.toLowerCase() === 'shoulders'
            );
            if (shoulderExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const usedShoulderRegions = muscleRegionTracker.get('shoulders') || new Set<string>();
              const shoulderCount = Math.min(1, Math.floor((exercisesPerDay - selectedExercises.length) / 4));
              const selectedShoulders = selectExercisesWithRegionVariety(
                shoulderExercises,
                'shoulders',
                usedShoulderRegions,
                shoulderCount
              );
              muscleRegionTracker.set('shoulders', usedShoulderRegions);
              selectedExercises.push(...selectedShoulders);
            }
            
            // Target legs (quads, hamstrings, glutes)
            const legExercises = strengthExercises.filter(e => 
              ['quadriceps', 'hamstrings', 'glutes', 'legs'].includes(e.primaryMuscleGroup.toLowerCase())
            );
            if (legExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const quadExercises = legExercises.filter(e => 
                e.primaryMuscleGroup.toLowerCase() === 'quadriceps' || 
                e.primaryMuscleGroup.toLowerCase() === 'legs'
              );
              if (quadExercises.length > 0) {
                const usedQuadRegions = muscleRegionTracker.get('quadriceps') || new Set<string>();
                const quadCount = Math.min(1, Math.floor((exercisesPerDay - selectedExercises.length) / 3));
                const selectedQuads = selectExercisesWithRegionVariety(
                  quadExercises,
                  'quadriceps',
                  usedQuadRegions,
                  quadCount
                );
                muscleRegionTracker.set('quadriceps', usedQuadRegions);
                selectedExercises.push(...selectedQuads);
              }
              
              const hamstringExercises = legExercises.filter(e => 
                e.primaryMuscleGroup.toLowerCase() === 'hamstrings'
              );
              if (hamstringExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
                const usedHamstringRegions = muscleRegionTracker.get('hamstrings') || new Set<string>();
                const hamstringCount = Math.min(1, Math.floor((exercisesPerDay - selectedExercises.length) / 2));
                const selectedHamstrings = selectExercisesWithRegionVariety(
                  hamstringExercises,
                  'hamstrings',
                  usedHamstringRegions,
                  hamstringCount
                );
                muscleRegionTracker.set('hamstrings', usedHamstringRegions);
                selectedExercises.push(...selectedHamstrings);
              }
            }
            
            // Add arms (biceps, triceps)
            const armExercises = strengthExercises.filter(e => 
              !selectedExercises.includes(e) &&
              (e.primaryMuscleGroup.toLowerCase() === 'biceps' ||
               e.primaryMuscleGroup.toLowerCase() === 'triceps')
            );
            if (armExercises.length > 0 && selectedExercises.length < exercisesPerDay) {
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(armExercises);
              selectedExercises.push(...shuffled.slice(0, Math.min(1, needed)));
            }
            
            // Fill remaining with any exercises (including cardio/flexibility if needed)
            if (selectedExercises.length < exercisesPerDay) {
              const remaining = exercisePool.filter(e => !selectedExercises.includes(e));
              const needed = exercisesPerDay - selectedExercises.length;
              const shuffled = shuffleArray(remaining);
              selectedExercises.push(...shuffled.slice(0, needed));
            }
            
            dayExercises = selectedExercises.slice(0, exercisesPerDay).map(ex => getExerciseDetails(ex));
          }
        }

        // Ensure no excluded exercises are included
        dayExercises = dayExercises.filter(ex => !excludedExercises.includes(ex.name));
        
        // If we don't have enough exercises after filtering, add more from the pool
        if (dayExercises.length < exercisesPerDay) {
          const additionalNeeded = exercisesPerDay - dayExercises.length;
          const usedExerciseNames = dayExercises.map(e => e.name);
          const availableExercises = exercisePool
              .filter(ex => !usedExerciseNames.includes(ex.name) && !excludedExercises.includes(ex.name));
          
          if (availableExercises.length > 0) {
            const shuffledAvailable = shuffleArray(availableExercises);
              const additional = shuffledAvailable.slice(0, additionalNeeded).map(ex => getExerciseDetails(ex));
            
            dayExercises = [...dayExercises, ...additional];
          }
        }
        
        // Final safety check - ensure we have at least one exercise
        if (dayExercises.length === 0) {
          // Fallback to a safe default exercise if all were excluded
            const pushUpData = getExerciseData('Push-ups');
            if (pushUpData) {
              dayExercises = [getExerciseDetails(pushUpData)];
            }
          }
        }

        // Calculate duration based on preferred workout length or default
        let duration = workoutLength;
        if (!duration) {
          duration = exercisesPerDay * (level === 'beginner' ? 5 : level === 'intermediate' ? 6 : 7);
        }

        weekDays.push({
          day: dayIndex + 1,
          dayName: dayNames[dayIndex],
          workoutName: `${focus} Workout`,
          focus,
          exercises: dayExercises.length > 0 ? dayExercises : (() => {
            const pushUpData = getExerciseData('Push-ups');
            return pushUpData ? [getExerciseDetails(pushUpData)] : [];
          })(),
          duration
        });
      }

      return { weekDays };
    };

    const weeklyPlan = generateWeeklyPlan();

    // ─── Step 7: Apply progression logic (from last week's + prior weeks' performance) ───
    const applyProgressionLogic = (plan: WeeklyWorkoutPlan): WeeklyWorkoutPlan => {
      if (!workoutHistory.length) return plan;
      const toKey = (name: string) => name.toLowerCase().replace(/\s+/g, '-');
      const getWeekKey = (dateStr: string) => {
        const d = new Date(dateStr);
        const start = new Date(d);
        start.setDate(d.getDate() - d.getDay());
        return start.toISOString().slice(0, 10);
      };
      type WeekPerf = { weight: number; reps: number; sets: number; weekKey: string };
      const byExerciseByWeek = new Map<string, WeekPerf[]>();
      const completed = workoutHistory
        .filter((w: any) => w.completed && w.exercises && w.date)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      completed.forEach((w: any) => {
        const weekKey = getWeekKey(w.date);
        w.exercises?.forEach((ex: any) => {
          if (!ex.name) return;
          const key = toKey(ex.exerciseId || ex.name);
          const sets = ex.sets?.filter((s: any) => s.completed) || [];
          if (sets.length === 0) return;
          const avgWeight = sets.reduce((s: number, set: any) => s + (set.weight || 0), 0) / sets.length;
          const avgReps = sets.length > 0
            ? sets.reduce((s: number, set: any) => s + (set.reps || 0), 0) / sets.length
            : 0;
          const entry: WeekPerf = { weight: avgWeight, reps: Math.round(avgReps), sets: sets.length, weekKey };
          let list = byExerciseByWeek.get(key);
          if (!list) {
            list = [];
            byExerciseByWeek.set(key, list);
          }
          const alreadyHasWeek = list.some(p => p.weekKey === weekKey);
          if (!alreadyHasWeek) list.push(entry);
        });
      });
      const WEIGHT_BUMP_THRESHOLD_LBS = 5;
      const adjusted = {
        weekDays: plan.weekDays.map(dw => ({
          ...dw,
          exercises: dw.exercises.map(ex => {
            const key = ex.id || toKey(ex.name);
            const keyAlt = toKey(ex.name);
            const weekly = byExerciseByWeek.get(key) || byExerciseByWeek.get(keyAlt);
            if (!weekly || weekly.length === 0 || (ex.category !== 'strength' && ex.category !== 'cardio')) {
              return ex;
            }
            const lastWeek = weekly[0];
            const previousWeek = weekly[1];
            let newReps = ex.reps;
            let newSets = ex.sets;
            let newWeight = ex.weight;
            const muscleGroupCount = ex.muscleGroups?.length ?? 0;
            const isCompound = muscleGroupCount > 1;
            if (lastWeek.weight > 0) {
              newWeight = Math.round(lastWeek.weight / 2.5) * 2.5;
              // If compound and consistently hitting 10+ reps, increase weight by same terms (+5 lbs)
              if (isCompound && lastWeek.reps >= 10) {
                newWeight = Math.round((newWeight + WEIGHT_BUMP_THRESHOLD_LBS) / 2.5) * 2.5;
              }
            }
            if (previousWeek) {
              const weightUp = lastWeek.weight >= previousWeek.weight + WEIGHT_BUMP_THRESHOLD_LBS;
              const weightSameOrDown = lastWeek.weight <= previousWeek.weight;
              const oldestWeek = weekly[weekly.length - 1];
              const noImprovementOverTime =
                weekly.length >= 2 &&
                (lastWeek.weight <= oldestWeek.weight + 2) &&
                !weightUp;
              if (weightUp) {
                if (ex.sets < 4) {
                  newSets = ex.sets + 1;
                  newReps = lastWeek.reps;
                } else {
                  newReps = Math.min(lastWeek.reps + 1, 20);
                }
              } else if (weightSameOrDown) {
                newReps = lastWeek.reps;
                newSets = Math.min(6, Math.max(1, lastWeek.sets || ex.sets));
              }
              if (noImprovementOverTime) {
                const reduction = Math.min(2, Math.max(1, Math.floor((newReps || lastWeek.reps) * 0.1)));
                newReps = Math.max(1, (newReps || lastWeek.reps) - reduction);
              }
            } else {
              newReps = lastWeek.reps;
              newSets = Math.min(6, Math.max(1, lastWeek.sets || ex.sets));
            }
            // Compound (multiple muscle groups) ≤ 10 reps; isolation (single muscle group) ≤ 20 reps
            const maxReps = isCompound ? 10 : 20;
            newReps = Math.min(newReps, maxReps);
            return {
              ...ex,
              weight: newWeight,
              reps: newReps,
              sets: Math.min(6, Math.max(1, newSets))
            };
          })
        }))
      };
      return adjusted;
    };
    const finalWeeklyPlan = applyProgressionLogic(weeklyPlan);

    return {
      id: Date.now().toString(),
      name: `${level.charAt(0).toUpperCase() + level.slice(1)} ${resolvedGoal.replace('_', ' ')} Program`,
      level: level as any,
      goal: resolvedGoal as any,
      exercises: finalWeeklyPlan.weekDays[0]?.exercises || [],
      duration: workoutLength,
      daysPerWeek: days,
      weeklyPlan: finalWeeklyPlan
    };
  };

  // Helper function to parse text responses and extract structured data
  const parseUserResponses = () => {
    try {
      // Extract goal from fitness goals text
      const goalText = (fitnessGoals || '').toLowerCase();
      let parsedGoal = 'strength'; // default
      if (goalText.includes('lose') || goalText.includes('weight') || goalText.includes('fat') || goalText.includes('slim')) {
        parsedGoal = 'weight_loss';
      } else if (goalText.includes('muscle') || goalText.includes('gain') || goalText.includes('bulk') || goalText.includes('size')) {
        parsedGoal = 'muscle_gain';
      } else if (goalText.includes('strength') || goalText.includes('strong') || goalText.includes('lift')) {
        parsedGoal = 'strength';
      } else if (goalText.includes('endurance') || goalText.includes('cardio') || goalText.includes('running') || goalText.includes('stamina')) {
        parsedGoal = 'endurance';
      } else if (goalText.includes('flexible') || goalText.includes('mobility') || goalText.includes('stretch')) {
        parsedGoal = 'flexibility';
      }

      // Extract level from experience text
      const levelText = (experienceLevel || '').toLowerCase();
      let parsedLevel = 'beginner'; // default
      if (levelText.includes('beginner') || levelText.includes('new') || levelText.includes('never') || levelText.includes('start')) {
        parsedLevel = 'beginner';
      } else if (levelText.includes('intermediate') || levelText.includes('some') || levelText.includes('few') || levelText.includes('year')) {
        parsedLevel = 'intermediate';
      } else if (levelText.includes('advanced') || levelText.includes('expert') || levelText.includes('experienced') || levelText.includes('many')) {
        parsedLevel = 'advanced';
      }

      // Extract days per week from frequency text
      const frequencyText = (workoutFrequency || '').toLowerCase();
      let parsedDays = 3; // default
      const dayMatch = frequencyText.match(/(\d+)\s*(day|time|session)/);
      if (dayMatch) {
        const days = parseInt(dayMatch[1]);
        if (days >= 3 && days <= 7) {
          parsedDays = days;
        }
      } else if (frequencyText.includes('three') || frequencyText.includes('3')) {
        parsedDays = 3;
      } else if (frequencyText.includes('four') || frequencyText.includes('4')) {
        parsedDays = 4;
      } else if (frequencyText.includes('five') || frequencyText.includes('5')) {
        parsedDays = 5;
      } else if (frequencyText.includes('six') || frequencyText.includes('6')) {
        parsedDays = 6;
      } else if (frequencyText.includes('seven') || frequencyText.includes('7') || frequencyText.includes('daily') || frequencyText.includes('every day')) {
        parsedDays = 7;
      }

    // Extract excluded exercises from injuries/limitations text
    // (Exercise limitations question removed - now using only injuries/limitations)
    const injuriesText = (injuriesLimitations || '').toLowerCase();
    const combinedText = injuriesText;
    const newExcludedExercises: string[] = [];
    
    // Get all exercise names from the exercise library for matching
    const allExerciseNames = getAllExercises().map(e => e.name);
    
    // Check for common injury-related exercises from both fields
    if (combinedText.includes('knee') || combinedText.includes('squat')) {
      newExcludedExercises.push('Squat', 'Squats', 'Lunges', 'Leg Press', 'Bulgarian Split Squats', 'Goblet Squats', 'Pistol Squats');
    }
    if (combinedText.includes('back') || combinedText.includes('spine') || combinedText.includes('lower back')) {
      newExcludedExercises.push('Deadlift', 'Deadlifts', 'Romanian Deadlift', 'Good Mornings', 'Back Extensions', 'Single Leg Deadlift');
    }
    if (combinedText.includes('shoulder') || combinedText.includes('rotator')) {
      newExcludedExercises.push('Overhead Press', 'Shoulder Press', 'Lateral Raises', 'Front Raises', 'Arnold Press');
    }
    if (combinedText.includes('wrist') || combinedText.includes('carpal')) {
      newExcludedExercises.push('Push-ups', 'Dips', 'Plank', 'Handstand');
    }
    if (combinedText.includes('ankle') || combinedText.includes('foot')) {
      newExcludedExercises.push('Calf Raises', 'Jumping Jacks', 'Box Jumps', 'Plyometric');
    }
    
    // Try to match exercise names mentioned in the injuries/limitations text
    allExerciseNames.forEach(exerciseName => {
      const exerciseLower = exerciseName.toLowerCase();
      // Check if the exercise name is mentioned in the limitations text
      if (injuriesText.includes(exerciseLower) || injuriesText.includes(exerciseLower.replace(/\s+/g, '-'))) {
        if (!newExcludedExercises.includes(exerciseName)) {
          newExcludedExercises.push(exerciseName);
        }
      }
    });
    
    // Also check for common variations and synonyms
    const exerciseSynonyms: { [key: string]: string[] } = {
      'squat': ['Squat', 'Squats', 'Goblet Squats', 'Bulgarian Split Squats'],
      'pull-up': ['Pull-ups', 'Pull-up', 'Chin-ups'],
      'push-up': ['Push-ups', 'Push-up'],
      'deadlift': ['Deadlift', 'Deadlifts', 'Romanian Deadlift'],
      'overhead': ['Overhead Press', 'Shoulder Press'],
      'bench': ['Bench Press', 'Incline Press', 'Decline Press'],
      'row': ['Barbell Row', 'Dumbbell Row', 'Cable Rows'],
    };
    
    Object.entries(exerciseSynonyms).forEach(([keyword, exercises]) => {
      if (injuriesText.includes(keyword)) {
        exercises.forEach(ex => {
          if (!newExcludedExercises.includes(ex)) {
            newExcludedExercises.push(ex);
          }
        });
      }
    });

      // Parse preferred workout length
      let parsedWorkoutLength: number | undefined = undefined;
      if (preferredWorkoutLength) {
        const lengthMatch = preferredWorkoutLength.match(/(\d+)/);
        if (lengthMatch) {
          const length = parseInt(lengthMatch[1]);
          if (length >= 15 && length <= 180) {
            parsedWorkoutLength = length;
          }
        }
      }

      // Parse secondary goals
      const parsedSecondaryGoals: string[] = [];
      if (secondaryGoals) {
        const secondaryGoalsText = secondaryGoals.toLowerCase();
        if (secondaryGoalsText.includes('flexibility') || secondaryGoalsText.includes('flexible')) {
          parsedSecondaryGoals.push('flexibility');
        }
        if (secondaryGoalsText.includes('mobility')) {
          parsedSecondaryGoals.push('mobility');
        }
        if (secondaryGoalsText.includes('core') || secondaryGoalsText.includes('abs')) {
          parsedSecondaryGoals.push('core_strength');
        }
        if (secondaryGoalsText.includes('posture')) {
          parsedSecondaryGoals.push('posture');
        }
        if (secondaryGoalsText.includes('endurance') || secondaryGoalsText.includes('stamina')) {
          parsedSecondaryGoals.push('endurance');
        }
        if (secondaryGoalsText.includes('balance')) {
          parsedSecondaryGoals.push('balance');
        }
      }

      return {
        goal: parsedGoal,
        level: parsedLevel,
        days: parsedDays,
        excludedExercises: [...(excludedExercises || []), ...newExcludedExercises],
        gender: gender || undefined,
        secondaryGoals: parsedSecondaryGoals.length > 0 ? parsedSecondaryGoals : undefined,
        preferredWorkoutLength: parsedWorkoutLength,
        userContext: {
          fitnessGoals: fitnessGoals || '',
          secondaryGoals: secondaryGoals || '',
          gender: gender || '',
          experienceLevel: experienceLevel || '',
          workoutFrequency: workoutFrequency || '',
          preferredWorkoutLength: preferredWorkoutLength || '',
          injuriesLimitations: injuriesLimitations || '',
          currentActivityLevel: currentActivityLevel || '',
          availableEquipment: availableEquipment || '',
          additionalInfo: additionalInfo || ''
        }
      };
    } catch (error) {
      console.error('Error parsing user responses:', error);
      // Return safe defaults
      return {
        goal: 'strength',
        level: 'beginner',
        days: 3,
        excludedExercises: excludedExercises || [],
        userContext: {}
      };
    }
  };

  const handleSelectWorkout = async (workout: WorkoutPlan) => {
    // Remove the "Option X" suffix from the name
    const cleanName = workout.name.replace(/\s*-\s*Option\s*\d+$/, '');
    workout.name = cleanName;
    
    if (!workout || !workout.weeklyPlan || workout.weeklyPlan.weekDays.length === 0) {
      Alert.alert('Error', 'Invalid workout plan selected.');
      return;
    }

    // Close options screen
    setShowWorkoutOptions(false);

    // Save the workout to saved plans
    try {
      const savedPlan: SavedWorkoutPlan = {
        ...workout,
        name: cleanName,
        savedAt: new Date().toISOString(),
      };
      
      const existingPlans = await loadUserData<SavedWorkoutPlan[]>('savedWorkoutPlans') || [];
      const updatedPlans = [...existingPlans, savedPlan];
      await saveUserData('savedWorkoutPlans', updatedPlans);
      setSavedPlans(updatedPlans);
      
      Alert.alert('Success', 'Workout plan saved!');
    } catch (error) {
      console.error('Error saving workout plan:', error);
      Alert.alert('Error', 'Failed to save workout plan');
    }

    // Set the selected workout
    setCurrentWorkout(workout);
    setCurrentWeeklyPlan(workout.weeklyPlan);
    
    if (workout.weeklyPlan.weekDays.length > 0) {
      setCurrentWorkout({
        ...workout,
        exercises: workout.weeklyPlan.weekDays[0].exercises,
        duration: workout.weeklyPlan.weekDays[0].duration
      });
      // Initialize exercise logs with sets
      const initialLogs: ExerciseLog[] = workout.weeklyPlan.weekDays[0].exercises.map((ex: Exercise) => ({
        exerciseId: ex.id,
        exerciseName: ex.name,
        totalSets: ex.sets,
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          setNumber: i + 1,
          reps: ex.reps,
          weight: 0,
          completed: false
        }))
      }));
      setExerciseLogs(initialLogs);
    } else {
      const initialLogs: ExerciseLog[] = workout.exercises.map((ex: Exercise) => ({
        exerciseId: ex.id,
        exerciseName: ex.name,
        totalSets: ex.sets,
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          setNumber: i + 1,
          reps: ex.reps,
          weight: 0,
          completed: false
        }))
      }));
      setExerciseLogs(initialLogs);
    }
    
    // Wait a moment to ensure state is set before opening modal
    setTimeout(() => {
      setSelectedDay(0);
      setCurrentExerciseIndex(0);
      setCurrentSetIndex(0);
      
      // Log for debugging
      console.log('Workout selected:', {
        hasWorkout: !!workout,
        hasWeeklyPlan: !!workout.weeklyPlan,
        exercisesCount: workout.exercises?.length || 0,
        weekDaysCount: workout.weeklyPlan?.weekDays?.length || 0
      });
      
      setShowWorkoutModal(true);
    }, 50);
  };

  const handleGenerateWorkout = async () => {
    // Validate that user has filled in the essential questions
    if (!fitnessGoals.trim() || !experienceLevel.trim() || !workoutFrequency.trim()) {
      Alert.alert('Please Complete', 'Please answer at least the first three questions about your fitness goals, experience level, and workout frequency.');
      return;
    }

    try {
      const parsed = parseUserResponses();
      
      // Save user profile data if available
      if (gender || secondaryGoals || preferredWorkoutLength) {
        try {
          const currentProfile = await loadUserData<any>('userProfile') || {};
          await saveUserData('userProfile', {
            ...currentProfile,
            sex: gender || currentProfile.sex || '',
            secondaryGoals: secondaryGoals ? (typeof secondaryGoals === 'string' ? secondaryGoals.split(',').map((g: string) => g.trim()) : secondaryGoals) : currentProfile.secondaryGoals || [],
            preferredWorkoutLength: preferredWorkoutLength ? parseInt(preferredWorkoutLength) || currentProfile.preferredWorkoutLength : currentProfile.preferredWorkoutLength,
          });
        } catch (error) {
          console.error('Error saving user profile:', error);
        }
      }

      // Generate multiple workout options (3 variations)
      const options = await generateMultipleWorkoutPlans(
        parsed.goal, 
        parsed.level, 
        parsed.days, 
        parsed.excludedExercises,
        parsed.gender,
        parsed.secondaryGoals,
        parsed.preferredWorkoutLength,
        3 // Generate 3 workout options
      );
      
      if (!options || options.length === 0) {
        Alert.alert('Error', 'Failed to generate workout plans. Please try again.');
        return;
      }

      // Show workout options screen
      setWorkoutOptions(options);
      setShowWorkoutOptions(true);
    } catch (error) {
      console.error('Error generating workout:', error);
      Alert.alert('Error', `Failed to generate workout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSelectDay = (dayIndex: number) => {
    if (currentWeeklyPlan && currentWeeklyPlan.weekDays[dayIndex]) {
      const dayWorkout = currentWeeklyPlan.weekDays[dayIndex];
      setSelectedDay(dayIndex);
      setCurrentWorkout(prev => prev ? {
        ...prev,
        exercises: dayWorkout.exercises,
        duration: dayWorkout.duration
      } : null);
      const initialLogs: ExerciseLog[] = dayWorkout.exercises.map(ex => ({
        exerciseId: ex.id,
        exerciseName: ex.name,
        totalSets: ex.sets,
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          setNumber: i + 1,
          reps: ex.reps,
          weight: 0,
          completed: false
        }))
      }));
      setExerciseLogs(initialLogs);
      setCurrentExerciseIndex(0);
      setCurrentSetIndex(0);
    }
  };

  const handleSetComplete = () => {
    if (!currentWorkout || currentExerciseIndex >= currentWorkout.exercises.length) return;
    
    const currentLog = exerciseLogs[currentExerciseIndex];
    
    if (!currentLog || currentSetIndex >= currentLog.sets.length) return;
    
    // Get weight and reps from the current set
    const currentSet = currentLog.sets[currentSetIndex];
    const weight = currentSet.weight;
    const reps = currentSet.reps;
    
    if (weight === 0 && reps === 0) {
      Alert.alert('Error', 'Please enter weight and reps');
      return;
    }
    
    // Mark this set as completed
    const updatedLogs = [...exerciseLogs];
    updatedLogs[currentExerciseIndex] = {
      ...updatedLogs[currentExerciseIndex],
      sets: updatedLogs[currentExerciseIndex].sets.map((set, idx) =>
        idx === currentSetIndex
          ? { ...set, completed: true, weight, reps }
          : set
      )
    };
    setExerciseLogs(updatedLogs);
    
    // Move to next set or next exercise
    if (currentSetIndex < currentLog.sets.length - 1) {
      setCurrentSetIndex(currentSetIndex + 1);
    } else if (currentExerciseIndex < currentWorkout.exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setCurrentSetIndex(0);
    }
  };

  const handleSaveWorkout = async () => {
    if (!currentWorkout) {
      Alert.alert('Error', 'No workout to save');
      return;
    }

    try {
      // Save current workout progress to workout history
      const completedSets = exerciseLogs.flatMap(log => 
        log.sets.filter(set => set.completed)
      );
      
      if (completedSets.length === 0) {
        Alert.alert('Info', 'No sets completed yet. Complete some sets to save progress.');
        return;
      }

      // Convert exercise logs back to exercise format for history
      const completedExercises: Exercise[] = exerciseLogs
        .filter(log => log.sets.some(set => set.completed))
        .map(log => {
          const exercise = currentWorkout.exercises.find(ex => ex.id === log.exerciseId);
          return {
            id: log.exerciseId,
            name: log.exerciseName,
            sets: log.totalSets,
            reps: log.sets[0]?.reps || exercise?.reps || 0,
            weight: log.sets[0]?.weight || 0,
            completed: true,
            category: exercise?.category || 'strength'
          };
        });

      const workoutLog: WorkoutLog = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        planId: currentWorkout.id,
        exercises: completedExercises,
        notes,
        duration: currentWorkout.duration
      };

      setWorkoutLogs(prev => [workoutLog, ...prev]);
      Alert.alert('Success', 'Workout progress saved!');
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('Error', 'Failed to save workout');
    }
  };

  const handleFinishWorkout = () => {
    if (!currentWorkout) {
      Alert.alert('Error', 'No workout to finish');
      return;
    }

    const completedSets = exerciseLogs.flatMap(log => 
      log.sets.filter(set => set.completed)
    );
    if (completedSets.length === 0) {
      Alert.alert('Error', 'Please complete at least one set');
      return;
    }

    // Convert exercise logs back to exercise format for history
    const completedExercises: Exercise[] = exerciseLogs
      .filter(log => log.sets.some(set => set.completed))
      .map(log => {
        const exercise = currentWorkout.exercises.find(ex => ex.id === log.exerciseId);
        return {
          id: log.exerciseId,
          name: log.exerciseName,
          sets: log.totalSets,
          reps: log.sets[0]?.reps || exercise?.reps || 0,
          weight: log.sets[0]?.weight || 0,
          completed: true,
          category: exercise?.category || 'strength'
        };
      });

    const workoutLog: WorkoutLog = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      planId: currentWorkout.id,
      exercises: completedExercises,
      notes,
      duration: currentWorkout.duration
    };

    setWorkoutLogs(prev => [workoutLog, ...prev]);
    setShowWorkoutModal(false);
    setCurrentWorkout(null);
    setCurrentWeeklyPlan(null);
    setExerciseLogs([]);
    setCurrentExerciseIndex(0);
    setCurrentSetIndex(0);
    setNotes('');
    Alert.alert('Success', 'Workout completed and logged!');
  };

  const getCompletionRate = () => {
    try {
      if (!currentWorkout || !exerciseLogs || exerciseLogs.length === 0) return 0;
      const totalSets = exerciseLogs.reduce((sum, log) => {
        if (!log || !log.totalSets) return sum;
        return sum + log.totalSets;
      }, 0);
      const completedSets = exerciseLogs.reduce((sum, log) => {
        if (!log || !log.sets || !Array.isArray(log.sets)) return sum;
        return sum + log.sets.filter(set => set && set.completed).length;
      }, 0);
    return totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
    } catch (error) {
      console.error('Error calculating completion rate:', error);
      return 0;
    }
  };

  const applyAdaptation = async (adaptation: ProgramAdaptation) => {
    if (!currentWorkout) return;

    try {
      let updatedWorkout = { ...currentWorkout };
      let updatedWeeklyPlan = currentWeeklyPlan ? { ...currentWeeklyPlan } : null;

      adaptation.changes.forEach(change => {
        if (change.field === 'weight' && change.exerciseId) {
          const exerciseId = change.exerciseId;
          if (updatedWeeklyPlan) {
            updatedWeeklyPlan.weekDays = updatedWeeklyPlan.weekDays.map(day => ({
              ...day,
              exercises: day.exercises.map(ex => 
                ex.id === exerciseId 
                  ? { ...ex, weight: change.newValue as number }
                  : ex
              )
            }));
          } else {
            updatedWorkout.exercises = updatedWorkout.exercises.map(ex =>
              ex.id === exerciseId
                ? { ...ex, weight: change.newValue as number }
                : ex
            );
          }
        } else if (change.field === 'sets' && change.exerciseId) {
          const exerciseId = change.exerciseId;
          if (updatedWeeklyPlan) {
            updatedWeeklyPlan.weekDays = updatedWeeklyPlan.weekDays.map(day => ({
              ...day,
              exercises: day.exercises.map(ex => 
                ex.id === exerciseId 
                  ? { ...ex, sets: change.newValue as number }
                  : ex
              )
            }));
          } else {
            updatedWorkout.exercises = updatedWorkout.exercises.map(ex =>
              ex.id === exerciseId
                ? { ...ex, sets: change.newValue as number }
                : ex
            );
          }
        } else if (change.field === 'duration') {
          const newDuration = change.newValue as number;
          updatedWorkout.duration = newDuration;
          if (updatedWeeklyPlan) {
            updatedWeeklyPlan.weekDays = updatedWeeklyPlan.weekDays.map(day => ({
              ...day,
              duration: newDuration
            }));
          }
        } else if (change.field === 'frequency') {
          updatedWorkout.daysPerWeek = change.newValue as number;
        }
      });

      setCurrentWorkout(updatedWorkout);
      if (updatedWeeklyPlan) {
        setCurrentWeeklyPlan(updatedWeeklyPlan);
      }

      const planIndex = savedPlans.findIndex(p => p.id === currentWorkout.id);
      if (planIndex >= 0) {
        const updatedPlans = [...savedPlans];
        updatedPlans[planIndex] = {
          ...updatedPlans[planIndex],
          ...updatedWorkout,
          weeklyPlan: updatedWeeklyPlan || updatedPlans[planIndex].weeklyPlan
        };
        setSavedPlans(updatedPlans);
        await saveUserData('savedWorkoutPlans', updatedPlans);
      }

      AIService.clearAdaptation(adaptation.id);
      setAdaptations(prev => prev.filter(a => a.id !== adaptation.id));

      Alert.alert('Success', 'Program updated successfully!');
    } catch (error) {
      console.error('Error applying adaptation:', error);
      Alert.alert('Error', 'Failed to apply changes');
    }
  };

  // Show workout options screen if options are available
  if (showWorkoutOptions && workoutOptions.length > 0) {
    return (
      <WorkoutOptionsScreen
        workoutOptions={workoutOptions}
        generatedGoal={workoutOptions[0]?.goal}
        onSelect={handleSelectWorkout}
        onBack={() => setShowWorkoutOptions(false)}
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
        <Text style={styles.headerTitle}>Workout Planner</Text>
        <TouchableOpacity style={styles.savedPlansButton} onPress={() => setShowSavedPlans(!showSavedPlans)}>
          <Text style={styles.savedPlansButtonText}>
            {showSavedPlans ? 'New Plan' : 'Saved'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Saved Plans View */}
        {showSavedPlans ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Saved Workout Plans</Text>
            {savedPlans.length === 0 ? (
              <View style={styles.emptySavedPlans}>
                <Text style={styles.emptySavedPlansText}>No saved plans yet</Text>
                <Text style={styles.emptySavedPlansSubtext}>
                  Create and save a workout plan to access it later
                </Text>
              </View>
            ) : (
              savedPlans.map(plan => (
                <TouchableOpacity
                  key={plan.id}
                  style={styles.savedPlanCard}
                  onPress={() => loadPlan(plan)}
                >
                  <View style={styles.savedPlanInfo}>
                    <Text style={styles.savedPlanName}>{plan.name}</Text>
                    <Text style={styles.savedPlanDetails}>
                      {plan.level} • {plan.goal.replace('_', ' ')} • {plan.daysPerWeek || 'N/A'} days/week
                    </Text>
                    <Text style={styles.savedPlanDate}>
                      Saved {new Date(plan.savedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deletePlanButton}
                    onPress={() => deletePlan(plan.id)}
                  >
                    <Text style={styles.deletePlanButtonText}>×</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <>
        {/* AI Q&A Section for Personalized Workout Plan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Let's Get to Know You</Text>
          <Text style={styles.sectionSubtitle}>
            Answer these questions so our AI can create a personalized workout and nutrition plan just for you.
          </Text>
          <View style={styles.questionnaireNote}>
            <Text style={styles.questionnaireNoteText}>
              The more detail you add in your responses, the better your workout plan will be.
            </Text>
          </View>
        </View>

        {/* Fitness Goals */}
        <View style={styles.section}>
          <Text style={styles.questionTitle}>What are your fitness goals?</Text>
          <Text style={styles.questionHint}>
            Tell us what you want to achieve (e.g., "I want to lose 20 pounds", "Build muscle and get stronger", "Improve my running endurance", "Get more flexible")
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Describe your fitness goals..."
            placeholderTextColor="#666"
            value={fitnessGoals}
            onChangeText={setFitnessGoals}
            multiline
            numberOfLines={3}
            autoCapitalize="words"
          />
        </View>

        {/* Gender */}
        <View style={styles.section}>
          <Text style={styles.questionTitle}>What is your gender?</Text>
          <Text style={styles.questionHint}>
            This helps us tailor the workout plan to your body type and physiology
          </Text>
          <View style={styles.genderContainer}>
              <TouchableOpacity
              style={[styles.genderButton, gender === 'male' && styles.genderButtonActive]}
              onPress={() => setGender('male')}
            >
              <Text style={[styles.genderButtonText, gender === 'male' && styles.genderButtonTextActive]}>
                Male
              </Text>
              </TouchableOpacity>
              <TouchableOpacity
              style={[styles.genderButton, gender === 'female' && styles.genderButtonActive]}
              onPress={() => setGender('female')}
            >
              <Text style={[styles.genderButtonText, gender === 'female' && styles.genderButtonTextActive]}>
                Female
                </Text>
              </TouchableOpacity>
            <TouchableOpacity
              style={[styles.genderButton, gender === 'other' && styles.genderButtonActive]}
              onPress={() => setGender('other')}
            >
              <Text style={[styles.genderButtonText, gender === 'other' && styles.genderButtonTextActive]}>
                Other
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Experience Level */}
        <View style={styles.section}>
          <Text style={styles.questionTitle}>What's your current fitness level and experience?</Text>
          <Text style={styles.questionHint}>
            Describe your experience with exercise (e.g., "I'm a complete beginner", "I've been working out for 2 years", "I used to be active but haven't in a while")
            </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Tell us about your fitness experience..."
            placeholderTextColor="#666"
            value={experienceLevel}
            onChangeText={setExperienceLevel}
            multiline
            numberOfLines={3}
            autoCapitalize="words"
          />
          </View>

        {/* Workout Frequency */}
        <View style={styles.section}>
          <Text style={styles.questionTitle}>How often can you work out?</Text>
          <Text style={styles.questionHint}>
            Be realistic about your schedule (e.g., "3 days per week", "Every morning before work", "Weekends only", "5-6 days per week")
            </Text>
          <TextInput
            style={styles.textInput}
            placeholder="How many days per week and when?"
            placeholderTextColor="#666"
            value={workoutFrequency}
            onChangeText={setWorkoutFrequency}
            multiline
            numberOfLines={2}
            autoCapitalize="words"
          />
        </View>

        {/* Preferred Workout Length */}
        <View style={styles.section}>
          <Text style={styles.questionTitle}>How long do you want each workout to be?</Text>
          <Text style={styles.questionHint}>
            Enter your preferred workout duration in minutes (e.g., "30", "45", "60", "90")
                </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Workout length in minutes (e.g., 45)"
            placeholderTextColor="#666"
            value={preferredWorkoutLength}
            onChangeText={setPreferredWorkoutLength}
            keyboardType="numeric"
          />
                  </View>

        {/* Secondary Goals */}
        <View style={styles.section}>
          <Text style={styles.questionTitle}>Do you have any secondary fitness goals?</Text>
          <Text style={styles.questionHint}>
            Additional goals beyond your primary one (e.g., "Improve flexibility", "Build core strength", "Increase mobility", "Better posture", "None")
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="List any secondary goals or leave blank if none..."
            placeholderTextColor="#666"
            value={secondaryGoals}
            onChangeText={setSecondaryGoals}
            multiline
            numberOfLines={2}
            autoCapitalize="words"
          />
                </View>

        {/* Injuries & Limitations */}
        <View style={styles.section}>
          <Text style={styles.questionTitle}>Do you have any injuries, limitations, or health concerns?</Text>
          <Text style={styles.questionHint}>
            Describe any health issues that might affect your workouts (e.g., "Lower back pain", "Asthma", "High blood pressure", "Recovering from surgery", "None")
                    </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Describe any injuries, limitations, or health concerns..."
            placeholderTextColor="#666"
            value={injuriesLimitations}
            onChangeText={setInjuriesLimitations}
            multiline
            numberOfLines={3}
            autoCapitalize="words"
          />
          </View>

        {/* Current Activity Level */}
        <View style={styles.section}>
          <Text style={styles.questionTitle}>What's your current activity level?</Text>
          <Text style={styles.questionHint}>
            Describe your daily activity (e.g., "I have a desk job and sit most of the day", "I'm on my feet all day at work", "I walk my dog daily")
                            </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Describe your current daily activity..."
            placeholderTextColor="#666"
            value={currentActivityLevel}
            onChangeText={setCurrentActivityLevel}
            multiline
            numberOfLines={2}
            autoCapitalize="words"
          />
                    </View>

        {/* Available Equipment */}
        <View style={styles.section}>
          <Text style={styles.questionTitle}>What equipment do you have access to?</Text>
          <Text style={styles.questionHint}>
            Tell us what's available (e.g., "Full gym with weights and machines", "Just dumbbells at home", "No equipment, bodyweight only", "Resistance bands")
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="What equipment or facilities do you have?"
            placeholderTextColor="#666"
            value={availableEquipment}
            onChangeText={setAvailableEquipment}
            multiline
            numberOfLines={2}
            autoCapitalize="words"
          />
                  </View>

        {/* Additional Info */}
        <View style={styles.section}>
          <Text style={styles.questionTitle}>Anything else we should know?</Text>
          <Text style={styles.questionHint}>
            Share any other information that might help us create the perfect plan for you
                            </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Any additional information..."
            placeholderTextColor="#666"
            value={additionalInfo}
            onChangeText={setAdditionalInfo}
            multiline
            numberOfLines={3}
            autoCapitalize="words"
          />
        </View>

        {/* Generate Workout Button */}
        <TouchableOpacity
          style={[styles.generateButton, (!fitnessGoals.trim() || !experienceLevel.trim() || !workoutFrequency.trim()) && styles.generateButtonDisabled]}
          onPress={handleGenerateWorkout}
          disabled={!fitnessGoals.trim() || !experienceLevel.trim() || !workoutFrequency.trim()}
        >
          <Text style={styles.generateButtonText}>Generate My Personalized Plan</Text>
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
          </>
        )}
      </ScrollView>

      {/* Workout Modal */}
      <Modal
        visible={showWorkoutModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWorkoutModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              console.log('Closing workout modal');
              setShowWorkoutModal(false);
            }}>
              <Text style={styles.closeButton}>X</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{currentWorkout?.name || 'Workout'}</Text>
            {adaptations.length > 0 ? (
              <TouchableOpacity
                style={styles.adaptationsBadge}
                onPress={() => setShowAdaptationsModal(true)}
              >
                <Text style={styles.adaptationsBadgeText}>
                  {adaptations.length} AI Suggestions
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.placeholder} />
            )}
          </View>

          <ScrollView style={styles.modalScrollView}>
            {(() => {
              try {
                // Debug logging
                if (showWorkoutModal) {
                  console.log('Modal rendering check:', {
                    hasWorkout: !!currentWorkout,
                    hasExercises: !!currentWorkout?.exercises,
                    exercisesLength: currentWorkout?.exercises?.length || 0,
                    hasExerciseLogs: !!exerciseLogs,
                    exerciseLogsLength: exerciseLogs?.length || 0,
                    hasWeeklyPlan: !!currentWeeklyPlan
                  });
                }
                
                if (!currentWorkout) {
                  return (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No workout loaded</Text>
                      <Text style={styles.emptyStateSubtext}>Please generate a workout plan first</Text>
                    </View>
                  );
                }
                
                if (!currentWorkout.exercises || currentWorkout.exercises.length === 0) {
                  return (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No exercises in workout</Text>
                      <Text style={styles.emptyStateSubtext}>Please try generating again</Text>
                    </View>
                  );
                }
                
                if (!exerciseLogs || exerciseLogs.length === 0) {
                  return (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>Initializing workout...</Text>
                      <Text style={styles.emptyStateSubtext}>Please wait</Text>
                    </View>
                  );
                }
                
                return (
                  <>
            {/* Weekly Plan Overview */}
            {currentWeeklyPlan && currentWeeklyPlan.weekDays && currentWeeklyPlan.weekDays.length > 1 && (
              <View style={styles.weeklyPlanSection}>
                <Text style={styles.weeklyPlanTitle}>Weekly Workout Plan</Text>
                <Text style={styles.weeklyPlanSubtitle}>
                  {currentWorkout?.daysPerWeek || currentWeeklyPlan.weekDays.length} days per week • Select a day to view exercises
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScrollView}>
                  {currentWeeklyPlan.weekDays.map((dayWorkout, index) => (
                    <TouchableOpacity
                      key={`day-${index}-${dayWorkout.dayName || dayWorkout.workoutName}`}
                      style={[
                        styles.dayWorkoutCard,
                        selectedDay === index && styles.dayWorkoutCardSelected
                      ]}
                      onPress={() => handleSelectDay(index)}
                    >
                      <Text style={[
                        styles.dayWorkoutName,
                        selectedDay === index && styles.dayWorkoutNameSelected
                      ]}>
                        {dayWorkout.dayName}
                      </Text>
                      <Text style={[
                        styles.dayWorkoutFocus,
                        selectedDay === index && styles.dayWorkoutFocusSelected
                      ]}>
                        {dayWorkout.focus}
                      </Text>
                      <Text style={[
                        styles.dayWorkoutStats,
                        selectedDay === index && styles.dayWorkoutStatsSelected
                      ]}>
                        {dayWorkout.exercises.length} exercises • {dayWorkout.duration} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Progress */}
            {exerciseLogs && exerciseLogs.length > 0 && (
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
            )}

            {/* Current Exercise */}
            {currentWorkout && currentWorkout.exercises && currentWorkout.exercises.length > 0 && exerciseLogs && exerciseLogs.length > 0 && currentExerciseIndex < currentWorkout.exercises.length && currentExerciseIndex < exerciseLogs.length && (
              <View style={styles.currentExercise}>
                <Text style={styles.exerciseTitle}>
                  {currentWorkout.exercises[currentExerciseIndex]?.name || 'Exercise'}
                </Text>
                <Text style={styles.exerciseDetails}>
                  Set {Math.min(currentSetIndex + 1, currentWorkout.exercises[currentExerciseIndex]?.sets || 1)} of {currentWorkout.exercises[currentExerciseIndex]?.sets || 0} • Target: {currentWorkout.exercises[currentExerciseIndex]?.reps || 0} reps
                </Text>
                
                {exerciseLogs[currentExerciseIndex] && exerciseLogs[currentExerciseIndex].sets && exerciseLogs[currentExerciseIndex].sets.length > 0 && currentSetIndex < exerciseLogs[currentExerciseIndex].sets.length && (
                  <>
                    <View style={styles.inputRow}>
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Weight (lbs)</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          placeholder="0"
                          value={exerciseLogs[currentExerciseIndex].sets[currentSetIndex]?.weight?.toString() || ''}
                          onChangeText={(text) => {
                            const newLogs = [...exerciseLogs];
                            const updatedSets = [...newLogs[currentExerciseIndex].sets];
                            updatedSets[currentSetIndex] = {
                              ...updatedSets[currentSetIndex],
                              weight: parseInt(text) || 0
                            };
                            newLogs[currentExerciseIndex] = {
                              ...newLogs[currentExerciseIndex],
                              sets: updatedSets
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
                          placeholder={currentWorkout.exercises[currentExerciseIndex]?.reps?.toString() || '0'}
                          value={exerciseLogs[currentExerciseIndex]?.sets[currentSetIndex]?.reps?.toString() || ''}
                          onChangeText={(text) => {
                            if (!exerciseLogs[currentExerciseIndex] || !currentWorkout.exercises[currentExerciseIndex]) return;
                            const newLogs = [...exerciseLogs];
                            const updatedSets = [...newLogs[currentExerciseIndex].sets];
                            const defaultReps = currentWorkout.exercises[currentExerciseIndex]?.reps || 0;
                            updatedSets[currentSetIndex] = {
                              ...updatedSets[currentSetIndex],
                              reps: parseInt(text) || defaultReps
                            };
                            newLogs[currentExerciseIndex] = {
                              ...newLogs[currentExerciseIndex],
                              sets: updatedSets
                            };
                            setExerciseLogs(newLogs);
                          }}
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.completeButton}
                      onPress={handleSetComplete}
                    >
                      <Text style={styles.completeButtonText}>Complete Set</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* Exercise List */}
            <View style={styles.exerciseList}>
              <Text style={styles.exerciseListTitle}>All Exercises (Tap to select)</Text>
              {currentWorkout?.exercises?.map((exercise, index) => {
                const log = exerciseLogs[index];
                const completedSets = log?.sets?.filter(set => set.completed).length || 0;
                const totalSets = exercise?.sets || 0;
                const isCurrentExercise = currentExerciseIndex === index;
                return (
                  <TouchableOpacity
                    key={exercise?.id || `ex-${index}-${exercise?.name || 'unknown'}`}
                    style={[
                      styles.exerciseItem,
                      isCurrentExercise && styles.exerciseItemActive
                    ]}
                    onPress={() => {
                      setCurrentExerciseIndex(index);
                      // Find the first incomplete set for this exercise
                      const firstIncompleteSet = log?.sets?.findIndex(set => !set.completed);
                      setCurrentSetIndex(firstIncompleteSet !== undefined && firstIncompleteSet >= 0 ? firstIncompleteSet : 0);
                    }}
                  >
                    <View style={styles.exerciseInfo}>
                      <Text style={[
                        styles.exerciseName,
                        isCurrentExercise && styles.exerciseNameActive
                      ]}>
                        {exercise.name}
                      </Text>
                      <Text style={styles.exerciseSets}>
                        {completedSets}/{totalSets} sets completed
                      </Text>
                    </View>
                    <View style={[
                      styles.exerciseStatus,
                      completedSets === totalSets && styles.exerciseCompleted,
                      isCurrentExercise && styles.exerciseStatusActive
                    ]}>
                      <Text style={styles.exerciseStatusText}>
                        {completedSets === totalSets ? 'DONE' : `${completedSets}/${totalSets}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
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

            {/* Save and Finish Buttons */}
            <View style={styles.workoutActions}>
              <TouchableOpacity
                style={styles.saveWorkoutButton}
                onPress={handleSaveWorkout}
              >
                <Text style={styles.saveWorkoutButtonText}>Save Workout</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.finishButton}
                onPress={handleFinishWorkout}
              >
                <Text style={styles.finishButtonText}>Finish Workout</Text>
              </TouchableOpacity>
            </View>
                </>
                );
              } catch (error) {
                console.error('Error rendering workout modal:', error);
                return (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>Error loading workout</Text>
                    <Text style={styles.emptyStateSubtext}>{error instanceof Error ? error.message : 'Unknown error'}</Text>
                  </View>
                );
              }
            })()}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Save Plan Modal */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.saveModalOverlay}>
          <View style={styles.saveModalContent}>
            <Text style={styles.saveModalTitle}>Save Workout Plan</Text>
            <Text style={styles.saveModalSubtitle}>Enter a name for this plan:</Text>
            <TextInput
              style={styles.saveModalInput}
              placeholder="Plan name"
              placeholderTextColor="#666"
              value={planName}
              onChangeText={setPlanName}
              autoFocus
            />
            <View style={styles.saveModalButtons}>
              <TouchableOpacity
                style={[styles.saveModalButton, styles.saveModalButtonCancel]}
                onPress={() => {
                  setShowSaveModal(false);
                  setPlanName('');
                }}
              >
                <Text style={styles.saveModalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalButton, styles.saveModalButtonSave]}
                onPress={handleSavePlan}
              >
                <Text style={styles.saveModalButtonTextSave}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI Adaptations Modal */}
      <Modal
        visible={showAdaptationsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        transparent={false}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAdaptationsModal(false)}>
              <Text style={styles.closeButton}>X</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>AI Program Suggestions</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalScrollView}>
            {adaptations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No suggestions available</Text>
                <Text style={styles.emptyStateSubtext}>
                  Complete more workouts to receive personalized program adjustments
                </Text>
              </View>
            ) : (
              adaptations.map((adaptation) => (
                <View key={adaptation.id} style={styles.adaptationCard}>
                  <View style={styles.adaptationHeader}>
                    <Text style={styles.adaptationTitle}>{adaptation.title}</Text>
                    <View style={[
                      styles.priorityBadge,
                      adaptation.priority === 'high' && styles.priorityHigh,
                      adaptation.priority === 'medium' && styles.priorityMedium,
                      adaptation.priority === 'low' && styles.priorityLow,
                    ]}>
                      <Text style={styles.priorityText}>{adaptation.priority}</Text>
                    </View>
                  </View>
                  <Text style={styles.adaptationDescription}>{adaptation.description}</Text>
                  <Text style={styles.adaptationReason}>{adaptation.reason}</Text>
                  <View style={styles.adaptationActions}>
                    <TouchableOpacity
                      style={[styles.adaptationButton, styles.applyButton]}
                      onPress={() => applyAdaptation(adaptation)}
                    >
                      <Text style={styles.applyButtonText}>Apply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.adaptationButton, styles.dismissButton]}
                      onPress={() => {
                        AIService.clearAdaptation(adaptation.id);
                        setAdaptations(prev => prev.filter(a => a.id !== adaptation.id));
                      }}
                    >
                      <Text style={styles.dismissButtonText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
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
  sectionSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 12,
    lineHeight: 20,
  },
  questionnaireNote: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#00ff88',
  },
  questionnaireNoteText: {
    fontSize: 13,
    color: '#bbb',
    lineHeight: 19,
    fontStyle: 'italic',
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  questionHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
    lineHeight: 18,
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderButtonActive: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  genderButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#aaa',
  },
  genderButtonTextActive: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 8,
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
    // gap replaced with marginBottom on children
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  exerciseItemActive: {
    borderColor: '#00ff88',
    backgroundColor: '#2a3a2a',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  exerciseNameActive: {
    color: '#00ff88',
    fontWeight: 'bold',
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
  exerciseStatusActive: {
    borderWidth: 2,
    borderColor: '#00ff88',
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
  workoutActions: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  saveWorkoutButton: {
    flex: 1,
    backgroundColor: '#00ff88',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
  },
  saveWorkoutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  finishButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
  },
  finishButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  dayButton: {
    width: 60,
    height: 60,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayButtonSelected: {
    borderColor: '#00ff88',
    backgroundColor: '#2a2a2a',
  },
  dayButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  dayButtonTextSelected: {
    color: '#00ff88',
  },
  exerciseHeader: {
    marginBottom: 10,
  },
  exerciseSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
  },
  exerciseToggleButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  exerciseToggleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00ff88',
  },
  exerciseSelectionContainer: {
    maxHeight: 400,
    marginTop: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
  },
  exerciseScrollView: {
    maxHeight: 370,
  },
  exerciseCategory: {
    marginBottom: 20,
  },
  exerciseCategoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  exerciseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  exerciseChip: {
    backgroundColor: '#3a3a3a',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#555',
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseChipExcluded: {
    backgroundColor: '#ff4444',
    borderColor: '#ff4444',
    opacity: 0.7,
  },
  exerciseChipText: {
    fontSize: 14,
    color: '#fff',
  },
  exerciseChipTextExcluded: {
    color: '#fff',
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  excludedIndicator: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  excludedExercisesList: {
    backgroundColor: '#3a3a3a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  excludedExercisesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff4444',
    marginBottom: 10,
  },
  excludedExercisesChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  excludedChip: {
    backgroundColor: '#ff4444',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  excludedChipText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  excludedChipRemove: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  weeklyPlanSection: {
    marginBottom: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  weeklyPlanTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  weeklyPlanSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 15,
  },
  daysScrollView: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  dayWorkoutCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginRight: 12,
    width: 160,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayWorkoutCardSelected: {
    borderColor: '#00ff88',
    backgroundColor: '#2a2a2a',
  },
  dayWorkoutName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  dayWorkoutNameSelected: {
    color: '#00ff88',
  },
  dayWorkoutFocus: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  dayWorkoutFocusSelected: {
    color: '#ccc',
  },
  dayWorkoutStats: {
    fontSize: 12,
    color: '#666',
  },
  dayWorkoutStatsSelected: {
    color: '#888',
  },
  savedPlansButton: {
    padding: 8,
  },
  savedPlansButtonText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySavedPlans: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  emptySavedPlansText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySavedPlansSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  savedPlanCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedPlanInfo: {
    flex: 1,
  },
  savedPlanName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  savedPlanDetails: {
    fontSize: 14,
    color: '#888',
    marginBottom: 3,
  },
  savedPlanDate: {
    fontSize: 12,
    color: '#666',
  },
  deletePlanButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  deletePlanButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  saveButton: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '600',
  },
  saveModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveModalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 25,
    width: '85%',
    maxWidth: 400,
  },
  saveModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  saveModalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 15,
  },
  saveModalInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
  },
  saveModalButtons: {
    flexDirection: 'row',
  },
  saveModalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveModalButtonCancel: {
    backgroundColor: '#3a3a3a',
  },
  saveModalButtonSave: {
    backgroundColor: '#00ff88',
  },
  saveModalButtonTextCancel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveModalButtonTextSave: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  adaptationsBadge: {
    backgroundColor: '#00ff88',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  adaptationsBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  adaptationCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  adaptationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  adaptationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  priorityHigh: {
    backgroundColor: '#ff4444',
  },
  priorityMedium: {
    backgroundColor: '#ffaa00',
  },
  priorityLow: {
    backgroundColor: '#00ff88',
  },
  priorityText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  adaptationDescription: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
    lineHeight: 20,
  },
  adaptationReason: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 15,
  },
  adaptationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  adaptationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButton: {
    backgroundColor: '#00ff88',
  },
  applyButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissButton: {
    backgroundColor: '#3a3a3a',
    borderWidth: 1,
    borderColor: '#555',
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});

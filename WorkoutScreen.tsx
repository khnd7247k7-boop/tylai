import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { AppTextInput as TextInput } from './src/components/AppTextInput';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { loadUserData, saveUserData } from './src/utils/userStorage';
import AIService, { ProgramAdaptation } from './AIService';
import { MAX_WORKING_SETS, clampWorkingSets, canAddWorkingSet, applyWeightProgression, roundToPlateWeight, MIN_WEIGHT_PROGRESSION_LBS } from './src/utils/progressionLimits';
import { exerciseDatabase, getExerciseData, ExerciseData } from './src/data/exerciseDatabase';
import {
  buildWorkoutBuilderMiContext,
  emptyWorkoutBuilderMiContext,
  enrichExercisePoolWithMi,
  mergeExcludedWithMi,
  miBiasedShuffle,
  orderPoolForExperience,
  pickMiSupportAccessories,
  type WorkoutBuilderMiContext,
} from './src/services/WorkoutBuilderMiIntegration';
import { AppTheme } from './src/theme/appVisualTheme';
import DiscomfortAssessmentFlow, {
  DiscomfortReportCTA,
} from './src/components/movement/DiscomfortAssessmentFlow';
import MovementResponseFeedbackModal from './src/components/movement/MovementResponseFeedbackModal';
import { shouldPromptMovementResponseFeedback } from './src/services/MovementFeedbackLoopService';

/** Plyometric exercises (by id) — used when user wants athleticism, mobility, or stability */
const PLYOMETRIC_EXERCISE_IDS = new Set([
  'snap-downs',
  'single-leg-linear-hops',
  'single-leg-drop-landings',
  'lateral-pogos',
  'skater-jumps',
  '90-180-degree-jumps',
  'frog-jumps',
  'split-squat-jumps',
  'cossack-squat-hops',
  'plank-jacks',
  'reverse-lunge-to-knee-up',
  'tuck-jumps',
  'box-jump-ups',
  'pike-jumps',
  'depth-jumps',
  'medicine-ball-slams',
  'plyo-push-ups',
  'rotational-med-ball-throws',
]);
import UserProfileService from './src/services/UserProfileService';
import {
  loadCoachingProfile,
  buildWorkoutGenerationInput,
  isPendingFirstWorkoutPlan,
  clearPendingFirstWorkoutPlan,
  isOnboardingComplete,
} from './src/services/CoachingProfileService';
import { PRIMARY_GOAL_LABELS } from './src/types/coachingProfile';
import type { CoachingProfile } from './src/types/coachingProfile';
import {
  buildWorkoutGenerationModifiers,
  type WorkoutGenerationModifiers,
} from './src/services/GoalDrivenCoaching';
import {
  isHeavyCompound,
  maxRepCapForExercise,
  nextLoadOrRepProgression,
} from './src/utils/compoundRepCaps';
import { computeSystemicVolumeContext, adjustSplitFocusesForSystemicTax } from './src/utils/systemicVolume';
import {
  exerciseDataFitsDayFocus,
  exerciseFitsDayFocus,
  filterExercisePoolForFocus,
  isLegDayFocus,
} from './src/utils/workoutFocusFilter';
import WorkoutOptionsScreen from './WorkoutOptionsScreen';
import type { GeneratedWorkoutPlan } from './data/workoutPrograms';
import { useSmallWins } from './src/context/SmallWinsContext';
import WorkoutSession from './WorkoutSession';
import WarmupBlockSession from './src/components/WarmupBlockSession';
import WorkoutPhaseStructure from './src/components/WorkoutPhaseStructure';
import { buildPlanPhaseBlocks, getOptimalWarmupReps } from './src/utils/workoutPhaseDisplay';
import { showPendingCoachAdaptationNoticeIfAny } from './src/utils/showCoachAdaptationNotice';
import { TOUR_TARGET_IDS } from './src/tour/tourTargets';
import { useTourTargetRef } from './src/tour/useTourTargetRef';
import { useUserSettings } from './SettingsProvider';
import {
  buildInitialExerciseLogs,
  buildTrackingExercises,
  expandCompletedExercisesForHistory,
  getWarmupProgress,
  isPhaseBlock,
  syncWarmupSetCompletion,
  type ExerciseLogEntry,
} from './src/utils/workoutWarmupLogging';

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  completed: boolean;
  category: 'strength' | 'cardio' | 'flexibility' | 'balance';
  restTime?: number; // seconds between sets
  /** For warm-up exercises: suggested duration in seconds (slow, controlled). Total warm-up block ~10 min. */
  durationSeconds?: number;
  // Enhanced exercise data
  movementPattern?: string;
  muscleGroups?: string[];
  equipment?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  alternatives?: string[];
  /** Display grouping block inside a generated workout day. */
  phase?: 'Warm-Up' | 'Main Lift' | 'Secondary Lifts' | 'Accessory Lifts' | 'Finisher' | 'Cooldown';
  /** Collapsed warm-up / cool-down block for workout tracking. */
  isWarmupBlock?: boolean;
  isCooldownBlock?: boolean;
  warmupItems?: Array<{ id: string; name: string; durationSeconds?: number; reps?: number; repNote?: string }>;
}

interface ExerciseSet {
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
}

type ExerciseLog = ExerciseLogEntry;

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

export default function WorkoutScreen({
  onBack,
  onPlanSetupComplete,
  initialSetupPending = false,
}: {
  onBack: () => void;
  onPlanSetupComplete?: () => void;
  /** True while first-time setup still needs a saved workout plan. */
  initialSetupPending?: boolean;
}): React.ReactElement {
  const fitnessAiGenerateRef = useTourTargetRef(TOUR_TARGET_IDS.fitnessAiGenerate);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [currentWorkout, setCurrentWorkout] = useState<WorkoutPlan | null>(null);
  const [currentWeeklyPlan, setCurrentWeeklyPlan] = useState<WeeklyWorkoutPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [notes, setNotes] = useState('');
  const [discomfortVisible, setDiscomfortVisible] = useState(false);
  const [discomfortExerciseName, setDiscomfortExerciseName] = useState<string | null>(null);
  const [movementFeedbackVisible, setMovementFeedbackVisible] = useState(false);
  const [movementFeedbackExercise, setMovementFeedbackExercise] = useState<string | null>(null);
  const pendingFinishFinalizeRef = useRef<(() => void) | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedWorkoutPlan[]>([]);
  const [showSavedPlans, setShowSavedPlans] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [planName, setPlanName] = useState('');
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);
  const [adaptations, setAdaptations] = useState<ProgramAdaptation[]>([]);
  const [showAdaptationsModal, setShowAdaptationsModal] = useState(false);
  const [showWorkoutOptions, setShowWorkoutOptions] = useState(false);
  const [workoutOptions, setWorkoutOptions] = useState<WorkoutPlan[]>([]);
  const [coachingProfile, setCoachingProfile] = useState<CoachingProfile | null>(null);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const { showPredictiveWeight, autoRestTimer } = useUserSettings();

  const trackingExercises = useMemo(
    () => (currentWorkout?.exercises?.length ? buildTrackingExercises(currentWorkout.exercises) : []),
    [currentWorkout?.exercises]
  );

  const initExerciseLogs = (exercises: Exercise[]): ExerciseLog[] =>
    buildInitialExerciseLogs(buildTrackingExercises(exercises));

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

  const refreshCoachingProfile = async () => {
    const cp = await loadCoachingProfile();
    setCoachingProfile(cp);
    setOnboardingReady(await isOnboardingComplete());
  };

  const completeInitialSetupIfNeeded = async () => {
    const wasPending = await isPendingFirstWorkoutPlan();
    if (!wasPending) return;
    await clearPendingFirstWorkoutPlan();
    onPlanSetupComplete?.();
  };

  const createEmergencyFallbackPlan = (
    goal: string,
    level: string,
    days: number,
    preferredLength: number
  ): WorkoutPlan => {
    const length = preferredLength || 45;
    const pushUps = getExerciseData('Push-ups');
    const squats = getExerciseData('Bodyweight Squats') || getExerciseData('Squats');
    const rows = getExerciseData('Inverted Rows') || getExerciseData('Dumbbell Rows');
    const plank = getExerciseData('Plank');
    const pool = [pushUps, squats, rows, plank].filter(Boolean) as NonNullable<
      ReturnType<typeof getExerciseData>
    >[];

    const toExercise = (data: NonNullable<ReturnType<typeof getExerciseData>>) => ({
      id: data.id || data.name.toLowerCase().replace(/\s+/g, '-'),
      name: data.name,
      sets: level === 'beginner' ? 3 : 4,
      reps: 10,
      weight: 0,
      completed: false,
      category: 'strength' as const,
      restTime: 60,
      movementPattern: data.movementPattern,
      muscleGroups: data.muscleGroups || [data.primaryMuscleGroup, ...(data.secondaryMuscleGroups || [])],
      equipment: data.equipment || data.equipmentRequired,
      difficulty: data.difficulty,
      alternatives: data.alternatives,
    });

    const dayExercises =
      pool.length > 0
        ? pool.map(toExercise)
        : [
            {
              id: 'push-ups',
              name: 'Push-ups',
              sets: 3,
              reps: 10,
              weight: 0,
              completed: false,
              category: 'strength' as const,
              restTime: 60,
            },
          ];

    const dayCount = Math.max(2, Math.min(6, days || 3));
    const weekDays = Array.from({ length: dayCount }, (_, i) => ({
      day: i + 1,
      dayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i] || `Day ${i + 1}`,
      workoutName: `Full Body ${i + 1}`,
      focus: 'Full Body',
      exercises: dayExercises.map((ex) => ({ ...ex, id: `${ex.id}-d${i + 1}` })),
      duration: length,
    }));

    return {
      id: `fallback-${Date.now()}`,
      name: `${(level || 'Beginner').toString().charAt(0).toUpperCase()}${(level || 'beginner')
        .toString()
        .slice(1)} Starter Program`,
      level: (level || 'beginner') as any,
      goal: (goal || 'strength') as any,
      exercises: weekDays[0].exercises,
      duration: length,
      daysPerWeek: dayCount,
      weeklyPlan: { weekDays },
    };
  };

  const runGenerateFromProfile = async (
    cp: CoachingProfile,
    opts?: { force?: boolean }
  ) => {
    const force = Boolean(opts?.force || initialSetupPending);
    const input = buildWorkoutGenerationInput(cp);
    if (input.missingFields.length > 0 && !force) {
      Alert.alert(
        'Coaching profile incomplete',
        `Please complete onboarding first. Missing: ${input.missingFields.join(', ')}.`
      );
      return;
    }

    setGeneratingPlan(true);
    try {
      const userProfile = await UserProfileService.getUserProfileData();
      const gender =
        userProfile?.sex === 'male' || userProfile?.sex === 'female' ? userProfile.sex : undefined;
      const goal = input.goal || 'strength';
      const level = input.level || 'beginner';
      const days = Math.max(2, Math.min(7, input.days || 3));
      const preferredLength = input.preferredLength || 45;
      const secondaryGoals = input.secondaryGoals || [];
      const modifiers = input.modifiers;

      let options = await generateMultipleWorkoutPlans(
        goal,
        level,
        days,
        input.excludedExercises,
        gender,
        secondaryGoals,
        preferredLength,
        3,
        modifiers
      );

      // If injury exclusions wiped the pool, retry without exclusions so the user still gets plans.
      if ((!options || options.length === 0) && input.excludedExercises.length > 0) {
        options = await generateMultipleWorkoutPlans(
          goal,
          level,
          days,
          [],
          gender,
          secondaryGoals,
          preferredLength,
          3,
          modifiers
        );
      }

      if (!options || options.length === 0) {
        try {
          const single = await generateWorkoutPlan(
            goal,
            level,
            days,
            [],
            gender,
            secondaryGoals,
            preferredLength,
            0,
            modifiers
          );
          single.name = `${single.name} - Option 1`;
          single.id = `${Date.now()}-0`;
          options = [single];
        } catch (fallbackErr) {
          console.error('Single-plan fallback failed', fallbackErr);
          options = [];
        }
      }

      if (!options || options.length === 0) {
        const emergency = createEmergencyFallbackPlan(goal, level, days, preferredLength);
        emergency.name = `${emergency.name} - Option 1`;
        options = [emergency];
      }

      setWorkoutOptions(options);
      setShowWorkoutOptions(true);
    } finally {
      setGeneratingPlan(false);
    }
  };

  useEffect(() => {
    loadSavedPlans();
    void refreshCoachingProfile();
  }, []);

  const handleSkipInitialSetup = () => {
    Alert.alert(
      'Skip for now?',
      'You can generate and save a workout plan anytime from Workouts. Skip setup to explore the rest of the app.',
      [
        { text: 'Keep setting up', style: 'cancel' },
        {
          text: 'Skip for now',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await clearPendingFirstWorkoutPlan();
              onPlanSetupComplete?.();
              onBack();
            })();
          },
        },
      ]
    );
  };

  const handleWorkoutOptionsBack = () => {
    if (initialSetupPending) {
      Alert.alert(
        'Skip plan for now?',
        'You can generate personalized plans anytime from Workouts, or build your own.',
        [
          { text: 'Keep browsing plans', style: 'cancel' },
          {
            text: 'Skip for now',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setShowWorkoutOptions(false);
                await clearPendingFirstWorkoutPlan();
                onPlanSetupComplete?.();
                onBack();
              })();
            },
          },
        ]
      );
      return;
    }
    setShowWorkoutOptions(false);
  };

  useEffect(() => {
    if (!initialSetupPending) return;
    let cancelled = false;
    void (async () => {
      // Settle onboarding writes, then always force-generate so "Yes" never dead-ends.
      for (let attempt = 0; attempt < 6; attempt++) {
        if (cancelled) return;
        const complete = await isOnboardingComplete();
        if (complete || attempt === 5) {
          const cp = await loadCoachingProfile();
          if (cancelled) return;
          await refreshCoachingProfile();
          try {
            await runGenerateFromProfile(cp, { force: true });
          } catch (e) {
            console.error('Auto-generate first plan', e);
            if (!cancelled) {
              try {
                const input = buildWorkoutGenerationInput(cp);
                const emergency = createEmergencyFallbackPlan(
                  input.goal || 'strength',
                  input.level || 'beginner',
                  input.days || 3,
                  input.preferredLength || 45
                );
                emergency.name = `${emergency.name} - Option 1`;
                setWorkoutOptions([emergency]);
                setShowWorkoutOptions(true);
              } catch (fallbackErr) {
                console.error('Emergency fallback plan failed', fallbackErr);
                Alert.alert(
                  'Plan generation failed',
                  'Your answers were saved. Tap Generate My Personalized Plan below to try again.'
                );
              }
            }
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-run when entering first-plan setup — not on every render of helpers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSetupPending]);

  const { onWorkoutLoggerOpened } = useSmallWins();
  useEffect(() => {
    onWorkoutLoggerOpened().catch(() => {});
  }, [onWorkoutLoggerOpened]);

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
    void showPendingCoachAdaptationNoticeIfAny(plan.id);
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
        const tracked = initExerciseLogs(plan.weeklyPlan.weekDays[0].exercises);
        setExerciseLogs(
          plan.exerciseLogs.length === tracked.length ? plan.exerciseLogs : tracked
        );
        setCurrentExerciseIndex(plan.currentExerciseIndex || 0);
        setCurrentSetIndex(plan.currentSetIndex || 0);
      } else {
        setExerciseLogs(initExerciseLogs(plan.weeklyPlan.weekDays[0].exercises));
        setCurrentExerciseIndex(0);
        setCurrentSetIndex(0);
      }
    } else {
      // Restore saved progress if available
      if (plan.exerciseLogs && plan.exerciseLogs.length > 0) {
        const tracked = initExerciseLogs(plan.exercises);
        setExerciseLogs(
          plan.exerciseLogs.length === tracked.length ? plan.exerciseLogs : tracked
        );
        setCurrentExerciseIndex(plan.currentExerciseIndex || 0);
        setCurrentSetIndex(plan.currentSetIndex || 0);
      } else {
        setExerciseLogs(initExerciseLogs(plan.exercises));
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
    gender?: 'male' | 'female',
    secondaryGoals?: string[],
    preferredLength?: number,
    count: number = 3,
    modifiers?: WorkoutGenerationModifiers
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
          i,
          modifiers
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
    gender?: 'male' | 'female',
    secondaryGoals?: string[],
    preferredLength?: number,
    variationIndex: number = 0,
    modifiers?: WorkoutGenerationModifiers
  ): Promise<WorkoutPlan> => {
    const userProfile = await UserProfileService.getUserProfileData();
    const userEquipment = userProfile?.equipmentAvailability?.toLowerCase() || '';
    const workoutLength = preferredLength || userProfile?.preferredWorkoutLength || 45;
    const workoutHistory = (await loadUserData<any[]>('workoutHistory')) || [];

    // ─── Step 1: Determine goal (from fitness goals + secondary goals questions) ───
    const resolvedGoal = goal || 'strength';
    const resolvedSecondaryGoals = secondaryGoals ?? [];
    const coachingMods = modifiers;
    const isCalisthenicsFocus =
      coachingMods?.primaryGoal === 'calisthenics' ||
      resolvedSecondaryGoals.some((g) => g.toLowerCase().includes('calisthenics'));
    /** Strength-style days use the 6-block workout template; flexibility/endurance keep simpler flow */
    const useOptimalPeakStructure =
      resolvedGoal === 'strength' ||
      resolvedGoal === 'muscle_gain' ||
      resolvedGoal === 'weight_loss';

    // ─── Step 2: Determine split structure (from goal + days per week question) ───
    const getSplitStructure = (): { focuses: string[]; workoutDayIndices: number[] } => {
      const getStrengthSplitVariants = (trainingDays: number): string[][] => {
        if (trainingDays <= 3) {
          return [
            ['Full Body', 'Full Body', 'Full Body'],
            ['Upper Body', 'Lower Body', 'Full Body'],
            ['Chest & Back', 'Quads & Calves', 'Glutes & Hamstrings'],
          ];
        }
        if (trainingDays === 4) {
          return [
            ['Upper Body', 'Lower Body', 'Upper Body', 'Lower Body'],
            ['Chest & Back', 'Arms & Shoulders', 'Quads & Calves', 'Glutes & Hamstrings'],
            ['Push', 'Pull', 'Legs', 'Full Body'],
          ];
        }
        if (trainingDays === 5) {
          return [
            ['Push', 'Pull', 'Legs', 'Push', 'Pull'],
            ['Chest & Back', 'Arms & Shoulders', 'Quads & Calves', 'Glutes & Hamstrings', 'Full Body'],
            ['Upper Body', 'Lower Body', 'Push', 'Pull', 'Legs'],
          ];
        }
        if (trainingDays === 6) {
          return [
            ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
            ['Chest & Back', 'Arms & Shoulders', 'Quads & Calves', 'Glutes & Hamstrings', 'Upper Body', 'Lower Body'],
            ['Upper Body', 'Lower Body', 'Full Body', 'Push', 'Pull', 'Legs'],
          ];
        }
        return [
          ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Active Recovery'],
          ['Chest & Back', 'Arms & Shoulders', 'Quads & Calves', 'Glutes & Hamstrings', 'Upper Body', 'Lower Body', 'Active Recovery'],
          ['Upper Body', 'Lower Body', 'Full Body', 'Push', 'Pull', 'Legs', 'Active Recovery'],
        ];
      };

      let focuses: string[] = [];
      if (resolvedGoal === 'strength' || resolvedGoal === 'muscle_gain') {
        const splitVariants = getStrengthSplitVariants(days);
        focuses = splitVariants[variationIndex % splitVariants.length];
      } else if (resolvedGoal === 'weight_loss') {
        // Keep weight-loss days strength-structured; cardio comes from effort and daily activity.
        const splitVariants = getStrengthSplitVariants(days);
        focuses = splitVariants[variationIndex % splitVariants.length];
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
    const { focuses: splitFocusesRaw, workoutDayIndices } = getSplitStructure();

    // ─── Systemic tax: age + activity → weekly set targets, MRV, deload, split/session bias ───
    const systemicVolumeContext = computeSystemicVolumeContext({
      ageStr: userProfile?.age,
      activityDescription: userProfile?.activityLevel || '',
    });
    const splitFocuses = adjustSplitFocusesForSystemicTax(splitFocusesRaw, days, systemicVolumeContext);

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
    let exercisesPerDay = recoveryAdjustment === 'reduce_volume' ? Math.max(3, exercisesPerDayBase - 1) : exercisesPerDayBase;
    exercisesPerDay = Math.max(3, exercisesPerDay - systemicVolumeContext.sessionExercisePenalty);
    if (coachingMods && coachingMods.recoveryScore < 45) {
      exercisesPerDay = Math.max(3, exercisesPerDay - 1);
    }

    const difficultyBias = coachingMods?.difficultyBias ?? 0;

    // ─── Movement Intelligence → Exercise Selection (modular; does not replace builder) ───
    let miContext: WorkoutBuilderMiContext;
    try {
      miContext = await buildWorkoutBuilderMiContext({
        experienceLevel: level,
        generatorGoal: resolvedGoal,
        primaryGoal: coachingMods?.primaryGoal ?? null,
        baseExcluded: excludedExercises,
        difficultyBias,
      });
    } catch (e) {
      console.warn('[WorkoutBuilder] MI context unavailable; using base pool', e);
      miContext = emptyWorkoutBuilderMiContext(level, resolvedGoal, difficultyBias);
    }
    const effectiveExcluded = mergeExcludedWithMi(excludedExercises, miContext);
    if (miContext.summary && miContext.summary !== 'mi_skipped') {
      console.log('[WorkoutBuilder] MI influence:', miContext.summary);
    }

    // ─── Step 5: Select movements (equipment + injuries/limitations + goal + split) ───
    // Complexity/difficulty comes from MI demands (via enrichExercisePoolWithMi), not catalog labels alone.
    const getExercisePool = (): ExerciseData[] => {
      let pool: ExerciseData[] = [];
      if (resolvedGoal === 'strength' || resolvedGoal === 'muscle_gain') {
        pool = exerciseDatabase.filter(ex => ex.category === 'strength');
      } else if (resolvedGoal === 'weight_loss') {
        pool = exerciseDatabase.filter(ex => ex.category === 'strength');
      } else if (resolvedGoal === 'endurance') {
        pool = exerciseDatabase.filter(ex => ex.category === 'cardio');
      } else if (resolvedGoal === 'flexibility') {
        pool = exerciseDatabase.filter(ex => ex.category === 'flexibility' || ex.category === 'balance');
      }
      if (isCalisthenicsFocus) {
        pool = exerciseDatabase.filter((ex) => {
          const eq = ex.equipmentRequired || ex.equipment || [];
          return eq.includes('bodyweight') || eq.includes('none') || eq.includes('pull-up bar');
        });
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
      pool = pool.filter(ex => !effectiveExcluded.includes(ex.name));
      // MI complexity gate + selection ranking for beginner / intermediate / advanced toggle.
      return enrichExercisePoolWithMi(pool, miContext);
    };
    const exercisePool = getExercisePool();

    const getFilteredPlyometricPool = (): ExerciseData[] => {
      let candidates = exerciseDatabase.filter(ex => PLYOMETRIC_EXERCISE_IDS.has(ex.id));
      candidates = candidates.filter(ex => !effectiveExcluded.includes(ex.name));
      if (userEquipment && userEquipment !== 'full gym' && userEquipment !== 'all') {
        const getEquipment = (ex: ExerciseData) => ex.equipmentRequired || ex.equipment || [];
        if (userEquipment.includes('bodyweight') || userEquipment.includes('no equipment')) {
          candidates = candidates.filter(ex => {
            const eq = getEquipment(ex);
            return eq.every(e => ['bodyweight', 'none', 'mat'].includes(e));
          });
        } else if (userEquipment.includes('dumbbell')) {
          candidates = candidates.filter(ex => {
            const eq = getEquipment(ex);
            return eq.every(e =>
              ['bodyweight', 'none', 'mat', 'dumbbells'].includes(e)
            );
          });
        }
      }
      // MI gates plyo complexity to experience level (beginner skips high skill/balance hops).
      return enrichExercisePoolWithMi(candidates, miContext);
    };

    const plyometricPool = useOptimalPeakStructure ? getFilteredPlyometricPool() : [];
    
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
      // Goal-based rep caps — heavy compounds stop rep creep and progress via load
      if (exerciseCategory === 'strength') {
        const exShape = {
          phase: undefined as string | undefined,
          muscleGroups: exerciseData.muscleGroups
            ? [exerciseData.primaryMuscleGroup, ...exerciseData.secondaryMuscleGroups]
            : [exerciseData.primaryMuscleGroup],
          secondaryMuscleGroups: exerciseData.secondaryMuscleGroups,
          name: exerciseData.name,
        };
        const repCtx = {
          progressionLever: coachingMods?.progressionLever,
          primaryGoal: coachingMods?.primaryGoal,
        };
        const compound = isHeavyCompound(exShape);
        const maxReps = maxRepCapForExercise(exShape, repCtx);
        reps = Math.min(reps, maxReps);
        if (systemicVolumeContext.strengthRepIntensityBias > 0) {
          reps = Math.max(compound ? 4 : 6, reps - systemicVolumeContext.strengthRepIntensityBias);
        }
        if (coachingMods) {
          reps = Math.max(compound ? 4 : 6, reps + coachingMods.repAdjust);
          sets = clampWorkingSets(
            Math.max(2, Math.round(sets * coachingMods.intensityMultiplier) + coachingMods.setBonus),
            undefined
          );
          if (restTime != null) {
            restTime = Math.max(30, restTime + coachingMods.restAdjustSec);
          }
          reps = Math.min(reps, maxReps);
        }
        // Systemic tax: fewer sets per lift when older or sedentary (weekly caps still enforced later).
        const { bracket, activityTier } = systemicVolumeContext;
        if (bracket === 'senior' || (activityTier === 'sedentary' && bracket === 'mid')) {
          sets = Math.max(2, sets - 1);
        }
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

    /** Legacy / non–Optimal-Peak warm-up (flexibility, endurance, etc.) */
    const FULL_BODY_WARMUP_NAMES = ['World\'s Greatest Stretch', 'Arm Circles', 'Leg Swings', 'Jumping Jacks'];
    /** Phase 1 dynamic warm-up: movement over static stretching */
    const DYNAMIC_WARMUP_MOVEMENT_NAMES = ['Leg Swings', 'Cat-Cow', 'Bird Dog', 'World\'s Greatest Stretch', 'Inchworms'];
    const DYNAMIC_WARMUP_SEC_PER_MOVE = 90;
    const FOCUS_DYNAMIC_WARMUP_SEC = 75;
    const FOCUS_SPECIFIC_WARMUPS: Record<string, string[]> = {
      'Push': ['Scapular Push-ups', 'Band Pull-Aparts', 'Doorway Chest Stretch', 'Shoulder External Rotations'],
      'Pull': ['Scapular Pull-ups', 'Thoracic Rotations', 'Cat-Cow'],
      'Legs': ['Glute Bridge (Bodyweight)', 'Walking Lunges with a Twist', 'Lateral Lunges', 'Ankle Rolls / Bottom Squat Transfer'],
      'Lower Body': ['Glute Bridge (Bodyweight)', 'Walking Lunges with a Twist', 'Lateral Lunges', 'Good Mornings (Bodyweight)', 'Bird Dog'],
      'Upper Body': ['Scapular Push-ups', 'Band Pull-Aparts', 'Scapular Pull-ups', 'Thoracic Rotations', 'Cat-Cow'],
      'Full Body': ['Cat-Cow', 'Glute Bridge (Bodyweight)', 'Thoracic Rotations', 'Bird Dog'],
    };
    const WARMUP_TOTAL_SECONDS = 600;
    const FULL_BODY_WARMUP_SECONDS = 75;
    const FOCUS_WARMUP_SECONDS = 100;
    /** Phase timing estimates (minutes) for day duration when using the 6-block template */
    const OPTIMAL_PEAK_PHASE_MINUTES =
      Math.ceil((DYNAMIC_WARMUP_MOVEMENT_NAMES.length * DYNAMIC_WARMUP_SEC_PER_MOVE + 2 * FOCUS_DYNAMIC_WARMUP_SEC) / 60) +
      8 +
      4 +
      5;
    const buildWarmupExercise = (data: ExerciseData, durationSeconds: number): Exercise => {
      const cat: 'strength' | 'cardio' | 'flexibility' | 'balance' =
        data.category === 'cardio' ? 'cardio' : data.category === 'flexibility' || data.category === 'balance' ? data.category : 'strength';
      const warmupReps = getOptimalWarmupReps(data.name);
      return {
        id: data.id || data.name.toLowerCase().replace(/\s+/g, '-'),
        name: data.name,
        sets: 1,
        reps: warmupReps ?? 0,
        weight: 0,
        completed: false,
        category: cat,
        restTime: 0,
        durationSeconds,
        movementPattern: data.movementPattern,
        muscleGroups: data.muscleGroups || [data.primaryMuscleGroup, ...(data.secondaryMuscleGroups || [])],
        equipment: data.equipment || data.equipmentRequired,
        difficulty: data.difficulty,
        alternatives: data.alternatives
      };
    };
    const getFullBodyWarmup = (): Exercise[] => {
      const out: Exercise[] = [];
      for (const name of FULL_BODY_WARMUP_NAMES) {
        const data = getExerciseData(name);
        if (data) out.push(buildWarmupExercise(data, FULL_BODY_WARMUP_SECONDS));
      }
      return out;
    };
    const getFocusSpecificWarmup = (focus: string): Exercise[] => {
      const names = FOCUS_SPECIFIC_WARMUPS[focus]
        || (focus.includes('Push') ? FOCUS_SPECIFIC_WARMUPS['Push']
          : focus.includes('Pull') ? FOCUS_SPECIFIC_WARMUPS['Pull']
          : (focus.includes('Chest') || focus.includes('Arms') || focus.includes('Shoulders')) ? FOCUS_SPECIFIC_WARMUPS['Upper Body']
          : (focus.includes('Quads') || focus.includes('Glutes') || focus.includes('Hamstrings') || focus.includes('Calves')) ? FOCUS_SPECIFIC_WARMUPS['Lower Body']
          : focus.includes('Leg') ? FOCUS_SPECIFIC_WARMUPS['Legs']
          : focus.includes('Upper') ? FOCUS_SPECIFIC_WARMUPS['Upper Body']
          : focus.includes('Lower') ? FOCUS_SPECIFIC_WARMUPS['Lower Body']
          : FOCUS_SPECIFIC_WARMUPS['Full Body']);
      const fullBodyCount = FULL_BODY_WARMUP_NAMES.length;
      const focusCount = Math.min(3, names.length);
      const focusTotalSec = WARMUP_TOTAL_SECONDS - fullBodyCount * FULL_BODY_WARMUP_SECONDS;
      const secPerFocus = focusCount > 0 ? Math.round(focusTotalSec / focusCount) : 0;
      const out: Exercise[] = [];
      for (let i = 0; i < focusCount; i++) {
        const data = getExerciseData(names[i]);
        if (data) out.push(buildWarmupExercise(data, secPerFocus));
      }
      return out;
    };
    const getWarmupRoutine = (focus: string): Exercise[] => [...getFullBodyWarmup(), ...getFocusSpecificWarmup(focus)];

    const getDynamicWarmupPhase = (focus: string): Exercise[] => {
      const out: Exercise[] = [];
      for (const name of DYNAMIC_WARMUP_MOVEMENT_NAMES) {
        const d = getExerciseData(name);
        if (d) out.push(buildWarmupExercise(d, DYNAMIC_WARMUP_SEC_PER_MOVE));
      }
      const focusNames =
        FOCUS_SPECIFIC_WARMUPS[focus] ||
        (focus.includes('Push')
          ? FOCUS_SPECIFIC_WARMUPS['Push']
          : focus.includes('Pull')
            ? FOCUS_SPECIFIC_WARMUPS['Pull']
            : (focus.includes('Chest') || focus.includes('Arms') || focus.includes('Shoulders'))
              ? FOCUS_SPECIFIC_WARMUPS['Upper Body']
              : (focus.includes('Quads') || focus.includes('Glutes') || focus.includes('Hamstrings') || focus.includes('Calves'))
                ? FOCUS_SPECIFIC_WARMUPS['Lower Body']
            : focus.includes('Leg')
              ? FOCUS_SPECIFIC_WARMUPS['Legs']
              : focus.includes('Upper')
                ? FOCUS_SPECIFIC_WARMUPS['Upper Body']
                : focus.includes('Lower')
                  ? FOCUS_SPECIFIC_WARMUPS['Lower Body']
                  : FOCUS_SPECIFIC_WARMUPS['Full Body']);
      for (let fi = 0; fi < Math.min(2, focusNames.length); fi++) {
        const d = getExerciseData(focusNames[fi]);
        if (d) out.push(buildWarmupExercise(d, FOCUS_DYNAMIC_WARMUP_SEC));
      }
      return out;
    };

    const getCnsActivationPhase = (): Exercise[] => {
      const out: Exercise[] = [];
      const hk = getExerciseData('High Knees');
      const pogos = getExerciseData('Lateral Pogos');
      if (hk) out.push(buildWarmupExercise(hk, 80));
      if (pogos) out.push(buildWarmupExercise(pogos, 80));
      return out;
    };

    const getPlyometricPhaseDetails = (data: ExerciseData): Exercise => {
      const reps = level === 'beginner' ? 3 : level === 'intermediate' ? 4 : 5;
      const sets = 4;
      const restTime = level === 'beginner' ? 120 : level === 'intermediate' ? 150 : 180;
      return {
        id: data.id || data.name.toLowerCase().replace(/\s+/g, '-'),
        name: data.name,
        sets,
        reps,
        weight: 0,
        completed: false,
        category: 'cardio',
        restTime,
        movementPattern: data.movementPattern,
        muscleGroups: data.muscleGroups || [data.primaryMuscleGroup, ...data.secondaryMuscleGroups],
        equipment: data.equipment || data.equipmentRequired,
        difficulty: data.difficulty,
        alternatives: data.alternatives
      };
    };

    const getCooldownPhase = (): Exercise[] => {
      const names = ['Hamstring Stretch', 'Child\'s Pose', 'Shoulder Stretch', 'Hip Flexor Stretch'];
      const sec = 75;
      const out: Exercise[] = [];
      for (const name of names) {
        const d = getExerciseData(name);
        if (d) out.push(buildWarmupExercise(d, sec));
      }
      return out;
    };
    
    if (exercisePool.length === 0) {
      console.error('No exercises available after filtering exclusions');
      const pushUpData = getExerciseData('Push-ups');
      if (!pushUpData) throw new Error('Unable to generate workout plan - no exercises available');
      const defaultExercise = getExerciseDetails(pushUpData);
      const warmupRoutine = getWarmupRoutine('Full Body');
      return {
        id: Date.now().toString(),
        name: `${level.charAt(0).toUpperCase() + level.slice(1)} ${resolvedGoal.replace('_', ' ')} Program`,
        level: level as any,
        goal: resolvedGoal as any,
        exercises: [...warmupRoutine, defaultExercise],
        duration: workoutLength + 5,
        daysPerWeek: days,
        weeklyPlan: {
          weekDays: [{
            day: 1,
            dayName: 'Monday',
            workoutName: 'Full Body Workout',
            focus: 'Full Body',
            exercises: [...warmupRoutine, defaultExercise],
            duration: workoutLength + 5
          }]
        }
      };
    }

    // Helper function to select exercises ensuring different muscle regions are targeted
    // Helper function to shuffle and select exercises
    // MI-biased: prefers higher-ranked pool items while keeping Option 1/2/3 variation.
    const shuffleArray = <T extends { id?: string; name?: string }>(array: T[]): T[] => {
      // Rank by MI experience complexity within this subset (beginner → safer first, advanced → harder first).
      const looksLikeExerciseData =
        array.length > 0 &&
        typeof (array[0] as ExerciseData).primaryMuscleGroup === 'string';
      const poolOrder = looksLikeExerciseData
        ? orderPoolForExperience(array as unknown as ExerciseData[], miContext.experienceLevel)
        : exercisePool;
      return miBiasedShuffle(array, poolOrder, variationIndex);
    };

    const exerciseIsCompoundLift = (ex: Exercise): boolean => (ex.muscleGroups?.length ?? 0) > 1;

    const getDefaultFallbackExercise = (focus: string): Exercise | null => {
      const data = isLegDayFocus(focus)
        ? (getExerciseData('Bodyweight Squats') ?? getExerciseData('Goblet Squat'))
        : getExerciseData('Push-ups');
      return data ? getExerciseDetails(data) : null;
    };

    const splitTemplateBlocksForDay = (
      mainList: Exercise[],
      dayIndex: number,
      focus: string
    ): { mainLift: Exercise[]; secondary: Exercise[]; accessory: Exercise[]; finisher: Exercise[] } => {
      const focusFilteredMain = mainList.filter(ex => exerciseFitsDayFocus(ex, focus));
      if (focusFilteredMain.length === 0) return { mainLift: [], secondary: [], accessory: [], finisher: [] };
      const sorted = [...focusFilteredMain].sort(
        (a, b) => (exerciseIsCompoundLift(b) ? 1 : 0) - (exerciseIsCompoundLift(a) ? 1 : 0)
      );
      const compounds = sorted.filter(exerciseIsCompoundLift);
      const isolations = sorted.filter(ex => !exerciseIsCompoundLift(ex));

      const mainLiftSource = compounds.length > 0 ? compounds[0] : sorted[0];
      const mainLift = mainLiftSource ? [{ ...mainLiftSource }] : [];
      const secondaryPool = compounds.filter(ex => ex.name !== mainLiftSource?.name);
      const secondaryTarget = Math.min(2, Math.max(1, Math.round(mainList.length * 0.35)));
      const secondary = secondaryPool.slice(0, secondaryTarget).map(ex => ({ ...ex }));

      let accessory = isolations
        .filter(ex => ex.name !== mainLiftSource?.name && !secondary.some(s => s.name === ex.name))
        .map(ex => ({ ...ex }));
      const targetAccessoryCount = level === 'beginner' ? 3 : level === 'intermediate' ? 4 : 5;
      const used = new Set([...mainLift, ...secondary, ...accessory].map(e => e.name));

      // MI support accessories (≤1): stability/control stimulus without replacing hypertrophy work
      const miSupport = pickMiSupportAccessories(miContext, focus, used, 1);
      for (const support of miSupport) {
        if (accessory.length >= targetAccessoryCount) break;
        accessory.push(getExerciseDetails(support));
        used.add(support.name);
      }

      const accessoryCandidates = exercisePool.filter(ex => {
        if (used.has(ex.name) || effectiveExcluded.includes(ex.name)) return false;
        if (!exerciseDataFitsDayFocus(ex, focus)) return false;
        if (ex.category === 'balance') return true;
        if (ex.category === 'strength' && (ex.secondaryMuscleGroups?.length ?? 0) === 0) return true;
        return false;
      });
      const shuffledAcc = shuffleArray(accessoryCandidates);
      let ai = 0;
      while (accessory.length < targetAccessoryCount && ai < shuffledAcc.length) {
        const ex = shuffledAcc[ai++];
        if (!accessory.some(a => a.name === ex.name)) {
          accessory.push(getExerciseDetails(ex));
          used.add(ex.name);
        }
      }
      if (accessory.length > targetAccessoryCount) {
        accessory = accessory.slice(0, targetAccessoryCount);
      }

      const finisherCandidates = exercisePool.filter(ex => {
        if (used.has(ex.name) || effectiveExcluded.includes(ex.name)) return false;
        if (!exerciseDataFitsDayFocus(ex, focus)) return false;
        if (ex.category === 'cardio' || ex.category === 'balance') return true;
        if (ex.category === 'strength' && (ex.secondaryMuscleGroups?.length ?? 0) === 0) return true;
        return false;
      });
      let finisher: Exercise[] = [];
      if (finisherCandidates.length > 0) {
        const pick = shuffleArray(finisherCandidates)[dayIndex % finisherCandidates.length];
        if (pick) {
          const base = getExerciseDetails(pick);
          const finisherSets = resolvedGoal === 'muscle_gain' ? 2 : 1;
          finisher = [{
            ...base,
            sets: finisherSets,
            reps: base.category === 'strength' ? Math.max(base.reps, 12) : base.reps,
            restTime: base.category === 'strength' ? 30 : 20,
          }];
        }
      }

      return {
        mainLift: (mainLift.length > 0 ? mainLift : sorted.slice(0, 1).map(ex => ({ ...ex }))).map(ex => ({
          ...ex,
          sets: level === 'beginner' ? 3 : level === 'intermediate' ? 4 : 5,
        })),
        secondary: secondary.map(ex => ({
          ...ex,
          sets: level === 'beginner' ? 3 : 4,
        })),
        accessory: accessory.map(ex => ({
          ...ex,
          sets: level === 'beginner' ? 2 : level === 'intermediate' ? 3 : 4,
        })),
        finisher,
      };
    };

    const selectExercisesWithRegionVariety = (
      availableExercises: ExerciseData[],
      targetMuscleGroup: string,
      usedRegions: Set<string>,
      count: number
    ): ExerciseData[] => {
      const muscleGroupExercises = orderPoolForExperience(
        availableExercises.filter(e =>
          e.primaryMuscleGroup.toLowerCase() === targetMuscleGroup.toLowerCase()
        ),
        miContext.experienceLevel
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
          // Already MI-ordered within region lists (parent pool was ordered); take front.
          selected.push(regionExercises[0]);
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
          const fallback = getDefaultFallbackExercise(focus);
          if (fallback) {
            dayExercises = [fallback];
          }
        } else {
        if (focus.includes('Chest') && focus.includes('Back')) {
          const targetMuscles = ['chest', 'back'];
          let chestBackExercises = exercisePool.filter(e => {
            const muscleGroups = e.muscleGroups || [e.primaryMuscleGroup, ...e.secondaryMuscleGroups];
            return e.category === 'strength' &&
              muscleGroups.some(mg => targetMuscles.some(tm => mg.toLowerCase().includes(tm)));
          });
          if (chestBackExercises.length > 0) {
            chestBackExercises = orderPoolForExperience(chestBackExercises, miContext.experienceLevel);
          }
          if (chestBackExercises.length > 0) {
            const selectedExercises: ExerciseData[] = [];
            const chest = shuffleArray(chestBackExercises.filter(e => e.primaryMuscleGroup.toLowerCase() === 'chest'));
            const back = shuffleArray(chestBackExercises.filter(e => e.primaryMuscleGroup.toLowerCase() === 'back'));
            selectedExercises.push(...chest.slice(0, Math.max(1, Math.floor(exercisesPerDay / 2))));
            selectedExercises.push(...back.slice(0, Math.max(1, Math.floor(exercisesPerDay / 2))));
            if (selectedExercises.length < exercisesPerDay) {
              const remaining = chestBackExercises.filter(e => !selectedExercises.includes(e));
              selectedExercises.push(...shuffleArray(remaining).slice(0, exercisesPerDay - selectedExercises.length));
            }
            dayExercises = selectedExercises.slice(0, exercisesPerDay).map(ex => getExerciseDetails(ex));
          }
        } else if (focus.includes('Arms') || focus.includes('Shoulders')) {
          const targetMuscles = ['shoulders', 'biceps', 'triceps', 'arms'];
          let armShoulderExercises = exercisePool.filter(e => {
            const muscleGroups = e.muscleGroups || [e.primaryMuscleGroup, ...e.secondaryMuscleGroups];
            return e.category === 'strength' &&
              muscleGroups.some(mg => targetMuscles.some(tm => mg.toLowerCase().includes(tm)));
          });
          if (armShoulderExercises.length > 0) {
            armShoulderExercises = orderPoolForExperience(armShoulderExercises, miContext.experienceLevel);
          }
          if (armShoulderExercises.length > 0) {
            const selectedExercises: ExerciseData[] = [];
            const shoulders = shuffleArray(armShoulderExercises.filter(e => e.primaryMuscleGroup.toLowerCase() === 'shoulders'));
            const biceps = shuffleArray(armShoulderExercises.filter(e => e.primaryMuscleGroup.toLowerCase() === 'biceps'));
            const triceps = shuffleArray(armShoulderExercises.filter(e => e.primaryMuscleGroup.toLowerCase() === 'triceps'));
            selectedExercises.push(...shoulders.slice(0, Math.max(1, Math.floor(exercisesPerDay / 3))));
            selectedExercises.push(...biceps.slice(0, Math.max(1, Math.floor(exercisesPerDay / 3))));
            selectedExercises.push(...triceps.slice(0, Math.max(1, Math.floor(exercisesPerDay / 3))));
            if (selectedExercises.length < exercisesPerDay) {
              const remaining = armShoulderExercises.filter(e => !selectedExercises.includes(e));
              selectedExercises.push(...shuffleArray(remaining).slice(0, exercisesPerDay - selectedExercises.length));
            }
            dayExercises = selectedExercises.slice(0, exercisesPerDay).map(ex => getExerciseDetails(ex));
          }
        } else if (focus.includes('Quads') || focus.includes('Calves')) {
          const targetMuscles = ['quadriceps', 'legs', 'calves'];
          let quadCalfExercises = exercisePool.filter(e => {
            const muscleGroups = e.muscleGroups || [e.primaryMuscleGroup, ...e.secondaryMuscleGroups];
            return e.category === 'strength' &&
              exerciseDataFitsDayFocus(e, focus) &&
              muscleGroups.some(mg => targetMuscles.some(tm => mg.toLowerCase().includes(tm)));
          });
          if (quadCalfExercises.length > 0) {
            quadCalfExercises = orderPoolForExperience(quadCalfExercises, miContext.experienceLevel);
          }
          if (quadCalfExercises.length > 0) {
            const selectedExercises: ExerciseData[] = [];
            const quads = shuffleArray(quadCalfExercises.filter(e => e.primaryMuscleGroup.toLowerCase() === 'quadriceps' || e.primaryMuscleGroup.toLowerCase() === 'legs'));
            const calves = shuffleArray(quadCalfExercises.filter(e => e.primaryMuscleGroup.toLowerCase() === 'calves'));
            selectedExercises.push(...quads.slice(0, Math.max(2, Math.floor(exercisesPerDay * 0.7))));
            selectedExercises.push(...calves.slice(0, Math.max(1, exercisesPerDay - selectedExercises.length)));
            if (selectedExercises.length < exercisesPerDay) {
              const remaining = quadCalfExercises.filter(e => !selectedExercises.includes(e));
              selectedExercises.push(...shuffleArray(remaining).slice(0, exercisesPerDay - selectedExercises.length));
            }
            dayExercises = selectedExercises.slice(0, exercisesPerDay).map(ex => getExerciseDetails(ex));
          }
        } else if (focus.includes('Glutes') || focus.includes('Hamstrings')) {
          const targetMuscles = ['glutes', 'hamstrings'];
          let gluteHamExercises = exercisePool.filter(e => {
            const muscleGroups = e.muscleGroups || [e.primaryMuscleGroup, ...e.secondaryMuscleGroups];
            return e.category === 'strength' &&
              exerciseDataFitsDayFocus(e, focus) &&
              muscleGroups.some(mg => targetMuscles.some(tm => mg.toLowerCase().includes(tm)));
          });
          if (gluteHamExercises.length > 0) {
            gluteHamExercises = orderPoolForExperience(gluteHamExercises, miContext.experienceLevel);
          }
          if (gluteHamExercises.length > 0) {
            const selectedExercises: ExerciseData[] = [];
            const glutes = shuffleArray(gluteHamExercises.filter(e => e.primaryMuscleGroup.toLowerCase() === 'glutes'));
            const hamstrings = shuffleArray(gluteHamExercises.filter(e => e.primaryMuscleGroup.toLowerCase() === 'hamstrings'));
            selectedExercises.push(...glutes.slice(0, Math.max(2, Math.floor(exercisesPerDay * 0.6))));
            selectedExercises.push(...hamstrings.slice(0, Math.max(1, exercisesPerDay - selectedExercises.length)));
            if (selectedExercises.length < exercisesPerDay) {
              const remaining = gluteHamExercises.filter(e => !selectedExercises.includes(e));
              selectedExercises.push(...shuffleArray(remaining).slice(0, exercisesPerDay - selectedExercises.length));
            }
            dayExercises = selectedExercises.slice(0, exercisesPerDay).map(ex => getExerciseDetails(ex));
          }
        } else if (focus.includes('Upper Body')) {
          // Upper body: chest, shoulders, back, arms
          const upperBodyMuscleGroups = ['chest', 'shoulders', 'back', 'biceps', 'triceps', 'arms'];
          let upperBodyExercises = exercisePool.filter(e => {
            const muscleGroups = e.muscleGroups || [e.primaryMuscleGroup, ...e.secondaryMuscleGroups];
            return e.category === 'strength' && 
                   muscleGroups.some(mg => upperBodyMuscleGroups.some(umg => mg.toLowerCase().includes(umg.toLowerCase())));
          });
          
          // Prioritize by MI complexity for experience toggle (not catalog difficulty labels).
          if (upperBodyExercises.length > 0) {
            upperBodyExercises = orderPoolForExperience(upperBodyExercises, miContext.experienceLevel);
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
                   exerciseDataFitsDayFocus(e, focus) &&
                   muscleGroups.some(mg => lowerBodyMuscleGroups.some(lmg => mg.toLowerCase().includes(lmg.toLowerCase())));
          });
          
          // Prioritize by MI complexity for experience toggle (not catalog difficulty labels).
          if (lowerBodyExercises.length > 0) {
            lowerBodyExercises = orderPoolForExperience(lowerBodyExercises, miContext.experienceLevel);
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
          
          // Prioritize by MI complexity for experience toggle (not catalog difficulty labels).
          if (pushExercises.length > 0) {
            pushExercises = orderPoolForExperience(pushExercises, miContext.experienceLevel);
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
          
          // Prioritize by MI complexity for experience toggle (not catalog difficulty labels).
          if (pullExercises.length > 0) {
            pullExercises = orderPoolForExperience(pullExercises, miContext.experienceLevel);
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
                   exerciseDataFitsDayFocus(e, focus) &&
                   (e.movementPattern === 'squat' || e.movementPattern === 'lunge' || e.movementPattern === 'hinge' ||
                    muscleGroups.some(mg => legMuscleGroups.some(lmg => mg.toLowerCase().includes(lmg.toLowerCase()))));
          });
          
          // Prioritize by MI complexity for experience toggle (not catalog difficulty labels).
          if (legExercises.length > 0) {
            legExercises = orderPoolForExperience(legExercises, miContext.experienceLevel);
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

        // Ensure no excluded exercises are included and exercises match the day's focus
        dayExercises = dayExercises
          .filter(ex => !effectiveExcluded.includes(ex.name))
          .filter(ex => exerciseFitsDayFocus(ex, focus));
        
        // If we don't have enough exercises after filtering, add more from the pool
        if (dayExercises.length < exercisesPerDay) {
          const additionalNeeded = exercisesPerDay - dayExercises.length;
          const usedExerciseNames = dayExercises.map(e => e.name);
          const availableExercises = filterExercisePoolForFocus(exercisePool, focus)
              .filter(ex => !usedExerciseNames.includes(ex.name) && !effectiveExcluded.includes(ex.name));
          
          if (availableExercises.length > 0) {
            const shuffledAvailable = shuffleArray(availableExercises);
              const additional = shuffledAvailable.slice(0, additionalNeeded).map(ex => getExerciseDetails(ex));
            
            dayExercises = [...dayExercises, ...additional];
          }
        }
        
        // Final safety check - ensure we have at least one exercise
        if (dayExercises.length === 0) {
          const fallback = getDefaultFallbackExercise(focus);
          if (fallback) {
            dayExercises = [fallback];
          }
        }
        }

        // Calculate duration based on preferred workout length or default
        let duration = workoutLength;
        if (!duration) {
          duration = exercisesPerDay * (level === 'beginner' ? 5 : level === 'intermediate' ? 6 : 7);
        }

        const mainExercises = (() => {
          const filtered = dayExercises.filter(ex => exerciseFitsDayFocus(ex, focus));
          if (filtered.length > 0) return filtered;
          const fallback = getDefaultFallbackExercise(focus);
          return fallback ? [fallback] : [];
        })();

        let orderedExercises: Exercise[];
        let phaseExtraMinutes: number;

        if (useOptimalPeakStructure) {
          const phase1Warmup = getDynamicWarmupPhase(focus).map(ex => ({ ...ex, phase: 'Warm-Up' as const }));
          const { mainLift, secondary, accessory, finisher } = splitTemplateBlocksForDay(mainExercises, dayIndex, focus);
          const phase2MainLift = mainLift.map(ex => ({ ...ex, phase: 'Main Lift' as const }));
          const phase3Secondary = secondary.map(ex => ({ ...ex, phase: 'Secondary Lifts' as const }));
          const phase4Accessory = accessory.map(ex => ({ ...ex, phase: 'Accessory Lifts' as const }));
          let phase5Finisher = finisher.map(ex => ({ ...ex, phase: 'Finisher' as const }));
          if (phase5Finisher.length === 0) {
            const targetPlyo = plyometricPool.length >= 2 ? 2 : Math.max(1, Math.min(2, plyometricPool.length));
            if (targetPlyo > 0 && plyometricPool.length > 0) {
              let seed = variationIndex * 7919 + i * 997 + dayIndex * 13;
              const pPool = [...filterExercisePoolForFocus(plyometricPool, focus)];
              if (pPool.length > 0) {
                for (let ki = pPool.length - 1; ki > 0; ki--) {
                  seed = (seed * 9301 + 49297) % 233280;
                  const j = Math.floor((seed / 233280) * (ki + 1));
                  [pPool[ki], pPool[j]] = [pPool[j], pPool[ki]];
                }
                phase5Finisher = pPool.slice(0, targetPlyo).map(p => ({
                  ...getPlyometricPhaseDetails(p),
                  phase: 'Finisher' as const,
                }));
              }
            }
          }
          const phase6Cooldown = getCooldownPhase();
          orderedExercises = [
            ...phase1Warmup,
            ...phase2MainLift,
            ...phase3Secondary,
            ...phase4Accessory,
            ...phase5Finisher,
            ...phase6Cooldown.map(ex => ({ ...ex, phase: 'Cooldown' as const })),
          ];
          phaseExtraMinutes = OPTIMAL_PEAK_PHASE_MINUTES;
        } else {
          orderedExercises = [
            ...getWarmupRoutine(focus).map(ex => ({ ...ex, phase: 'Warm-Up' as const })),
            ...mainExercises.map(ex => ({ ...ex, phase: 'Main Lift' as const })),
          ];
          phaseExtraMinutes = Math.ceil(WARMUP_TOTAL_SECONDS / 60);
        }

        weekDays.push({
          day: dayIndex + 1,
          dayName: dayNames[dayIndex],
          workoutName: `${focus} Workout`,
          focus,
          exercises: orderedExercises,
          duration: duration + phaseExtraMinutes,
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
      const WEIGHT_BUMP_THRESHOLD_LBS = MIN_WEIGHT_PROGRESSION_LBS;
      const adjusted = {
        weekDays: plan.weekDays.map(dw => ({
          ...dw,
          exercises: dw.exercises.map(ex => {
            if (ex.durationSeconds != null && ex.durationSeconds > 0) {
              return ex;
            }
            if (PLYOMETRIC_EXERCISE_IDS.has(ex.id)) {
              return ex;
            }
            if (ex.id === 'jumping-jacks' && ex.sets === 4) {
              return ex;
            }
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
            const exShape = {
              phase: ex.phase,
              muscleGroups: ex.muscleGroups,
              name: ex.name,
            };
            const repCtx = {
              progressionLever: coachingMods?.progressionLever,
              primaryGoal: coachingMods?.primaryGoal,
            };
            const compound = isHeavyCompound(exShape);
            const maxReps = maxRepCapForExercise(exShape, repCtx);
            const progressionLever = coachingMods?.progressionLever ?? 'balanced';
            if (lastWeek.weight > 0) {
              newWeight = roundToPlateWeight(lastWeek.weight);
              if (compound && lastWeek.reps >= maxReps) {
                newWeight = applyWeightProgression(lastWeek.weight, WEIGHT_BUMP_THRESHOLD_LBS);
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
                if (canAddWorkingSet(ex.sets, ex.phase)) {
                  newSets = ex.sets + 1;
                  newReps = lastWeek.reps;
                } else {
                  const step = nextLoadOrRepProgression({
                    reps: ex.reps,
                    weight: newWeight,
                    perfReps: lastWeek.reps,
                    maxReps,
                    weightBumpLbs: WEIGHT_BUMP_THRESHOLD_LBS,
                    progressionLever,
                    isCompound: compound,
                    roundWeight: (_w) => applyWeightProgression(newWeight, WEIGHT_BUMP_THRESHOLD_LBS),
                  });
                  if (step.kind === 'load') {
                    newWeight = step.weight;
                    newReps = step.reps;
                  } else if (step.kind === 'reps') {
                    newReps = step.reps;
                  } else {
                    newReps = Math.min(lastWeek.reps, maxReps);
                  }
                }
              } else if (weightSameOrDown) {
                newReps = lastWeek.reps;
                newSets = clampWorkingSets(lastWeek.sets || ex.sets, ex.phase);
              }
              if (noImprovementOverTime) {
                const reduction = Math.min(2, Math.max(1, Math.floor((newReps || lastWeek.reps) * 0.1)));
                newReps = Math.max(1, (newReps || lastWeek.reps) - reduction);
              }
            } else {
              newReps = lastWeek.reps;
              newSets = clampWorkingSets(lastWeek.sets || ex.sets, ex.phase);
            }
            newReps = Math.min(newReps, maxReps);
            return {
              ...ex,
              weight: newWeight,
              reps: newReps,
              sets: clampWorkingSets(newSets, ex.phase),
            };
          })
        }))
      };
      return adjusted;
    };
    /** Age/activity weekly set bands, MRV, deload; spread each muscle ≥2 days/week when training ≥2 days. */
    const enforceSystemicWeeklySetTargets = (plan: WeeklyWorkoutPlan): WeeklyWorkoutPlan => {
      const appliesToGoal =
        resolvedGoal === 'muscle_gain' ||
        resolvedGoal === 'strength' ||
        resolvedGoal === 'weight_loss';
      if (!appliesToGoal) return plan;

      const weeklyMin = systemicVolumeContext.weeklySetsPerMuscleMin;
      const weeklyMax = systemicVolumeContext.weeklySetsPerMuscleMax;
      const minWeeklySetsToRequireTwoSessions = 2;

      const isMainStrengthExercise = (ex: Exercise): boolean => {
        if (ex.durationSeconds != null && ex.durationSeconds > 0) return false;
        if (PLYOMETRIC_EXERCISE_IDS.has(ex.id)) return false;
        if (ex.id === 'jumping-jacks' && ex.sets === 4) return false;
        return ex.category === 'strength';
      };

      const clone: WeeklyWorkoutPlan = {
        weekDays: plan.weekDays.map(day => ({
          ...day,
          exercises: day.exercises.map(ex => ({ ...ex })),
        })),
      };

      const weeklySetsByMuscle = new Map<string, number>();
      const trackedMuscles = new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'legs', 'arms']);

      clone.weekDays.forEach(day => {
        day.exercises.forEach(ex => {
          if (!isMainStrengthExercise(ex)) return;
          const groups = (ex.muscleGroups || []).map(m => m.toLowerCase());
          groups.forEach(group => {
            trackedMuscles.forEach(tracked => {
              if (group.includes(tracked)) {
                weeklySetsByMuscle.set(tracked, (weeklySetsByMuscle.get(tracked) || 0) + ex.sets);
              }
            });
          });
        });
      });

      const tryRaiseSetsForMuscle = (target: string) => {
        if ((weeklySetsByMuscle.get(target) || 0) >= weeklyMin) return;
        for (const day of clone.weekDays) {
          for (let i = 0; i < day.exercises.length; i++) {
            const ex = day.exercises[i];
            if (!isMainStrengthExercise(ex)) continue;
            const hitsTarget = (ex.muscleGroups || []).some(mg => mg.toLowerCase().includes(target));
            if (!hitsTarget) continue;
            const nextSets = clampWorkingSets(ex.sets + 1, ex.phase);
            if (nextSets === ex.sets) continue;
            const delta = nextSets - ex.sets;
            ex.sets = nextSets;
            weeklySetsByMuscle.set(target, (weeklySetsByMuscle.get(target) || 0) + delta);
            if ((weeklySetsByMuscle.get(target) || 0) >= weeklyMin) return;
          }
        }
      };

      const tryLowerSetsForMuscle = (target: string) => {
        if ((weeklySetsByMuscle.get(target) || 0) <= weeklyMax) return;
        for (const day of clone.weekDays) {
          for (let i = day.exercises.length - 1; i >= 0; i--) {
            const ex = day.exercises[i];
            if (!isMainStrengthExercise(ex)) continue;
            const hitsTarget = (ex.muscleGroups || []).some(mg => mg.toLowerCase().includes(target));
            if (!hitsTarget) continue;
            const nextSets = Math.max(2, ex.sets - 1);
            if (nextSets === ex.sets) continue;
            const delta = ex.sets - nextSets;
            ex.sets = nextSets;
            weeklySetsByMuscle.set(target, Math.max(0, (weeklySetsByMuscle.get(target) || 0) - delta));
            if ((weeklySetsByMuscle.get(target) || 0) <= weeklyMax) return;
          }
        }
      };

      const targetOrder = ['chest', 'back', 'shoulders', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'biceps', 'triceps'];
      targetOrder.forEach(muscle => tryRaiseSetsForMuscle(muscle));
      targetOrder.forEach(muscle => tryLowerSetsForMuscle(muscle));

      // ≥2 training days: each muscle with ≥2 weekly sets must appear on ≥2 days (systemic tax / recovery).
      if (clone.weekDays.length >= 2) {
        const hitDaysForMuscle = (muscle: string): Set<number> => {
          const s = new Set<number>();
          clone.weekDays.forEach((day, di) => {
            for (const ex of day.exercises) {
              if (!isMainStrengthExercise(ex)) continue;
              if ((ex.muscleGroups || []).some(mg => mg.toLowerCase().includes(muscle))) {
                s.add(di);
                break;
              }
            }
          });
          return s;
        };
        for (const muscle of targetOrder) {
          const totalWeekly = weeklySetsByMuscle.get(muscle) || 0;
          if (totalWeekly < minWeeklySetsToRequireTwoSessions) continue;
          const daySet = hitDaysForMuscle(muscle);
          if (daySet.size >= 2) continue;
          const onlyDay = [...daySet][0];
          const recipient = clone.weekDays.findIndex((_, i) => i !== onlyDay);
          if (recipient < 0) continue;
          const day = clone.weekDays[onlyDay];
          let exIdx = -1;
          for (let i = day.exercises.length - 1; i >= 0; i--) {
            const ex = day.exercises[i];
            if (!isMainStrengthExercise(ex)) continue;
            if ((ex.muscleGroups || []).some(mg => mg.toLowerCase().includes(muscle))) {
              exIdx = i;
              break;
            }
          }
          if (exIdx < 0) continue;
          const ex = day.exercises[exIdx];
          if (ex.sets < 2) continue;
          const moveSets = Math.max(1, Math.floor(ex.sets / 2));
          if (ex.sets - moveSets < 1) continue;
          ex.sets -= moveSets;
          clone.weekDays[recipient].exercises.push({
            ...ex,
            sets: moveSets,
          });
        }
      }

      return clone;
    };

    const progressionAdjustedPlan = await (async () => {
      let plan: WeeklyWorkoutPlan = weeklyPlan;
      let allowProgression = true;
      try {
        const { buildCoachingContextSnapshot } = await import('./src/services/CoachingEngine');
        const ctx = await buildCoachingContextSnapshot();
        if (!ctx.progressionAllowed) allowProgression = false;
      } catch {
        /* fall through — apply progression if coaching context unavailable */
      }

      if (allowProgression) {
        try {
          const { applyEarnedProgressionToWeeklyPlan } = await import(
            './src/services/ProgressionEngine'
          );
          const { plan: earnedPlan, summary } = await applyEarnedProgressionToWeeklyPlan({
            plan: weeklyPlan,
            history: workoutHistory as any,
            level,
            recoveryScore: coachingMods?.recoveryScore,
            miContext,
          });
          if (summary) {
            console.log('[WorkoutBuilder] Earned progression:', summary);
          }
          plan = earnedPlan as WeeklyWorkoutPlan;
        } catch (e) {
          console.warn('[WorkoutBuilder] Earned progression failed; falling back:', e);
          plan = applyProgressionLogic(weeklyPlan);
        }
      }

      // Structured safety constraints always apply (even when load progression is blocked).
      try {
        const { applyMiConstraintsToWeeklyPlan } = await import(
          './src/services/WorkoutBuilderMiIntegration'
        );
        const { plan: constrainedPlan, appliedCount, notes: miNotes } =
          applyMiConstraintsToWeeklyPlan(plan as any, miContext);
        if (appliedCount > 0) {
          console.log(
            '[WorkoutBuilder] MI constraints applied:',
            appliedCount,
            miNotes.slice(0, 6).join(' | ')
          );
        }
        return constrainedPlan as WeeklyWorkoutPlan;
      } catch (e) {
        console.warn('[WorkoutBuilder] MI constraint apply failed:', e);
        return plan;
      }
    })();
    const finalWeeklyPlan = enforceSystemicWeeklySetTargets(progressionAdjustedPlan);

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

  const persistSavedPlan = async (workout: WorkoutPlan, { activate = true } = {}) => {
    const cleanName = workout.name.replace(/\s*-\s*Option\s*\d+$/, '');
    const savedPlan: SavedWorkoutPlan = {
      ...workout,
      name: cleanName,
      savedAt: new Date().toISOString(),
    };

    const existingPlans = (await loadUserData<SavedWorkoutPlan[]>('savedWorkoutPlans')) || [];
    const withoutDup = existingPlans.filter((p) => p.id !== savedPlan.id);
    const updatedPlans = [...withoutDup, savedPlan];
    await saveUserData('savedWorkoutPlans', updatedPlans);
    setSavedPlans(updatedPlans);

    if (activate) {
      const active = (await loadUserData<string[]>('activeWorkoutPlans')) || [];
      const updatedActive = active.includes(savedPlan.id) ? active : [...active, savedPlan.id];
      await saveUserData('activeWorkoutPlans', updatedActive);
    }

    return savedPlan;
  };

  const handleSavePlanFromOptions = async (workout: WorkoutPlan) => {
    if (!workout?.weeklyPlan || workout.weeklyPlan.weekDays.length === 0) {
      Alert.alert('Error', 'Invalid workout plan selected.');
      return;
    }

    const wasInitialSetup = await isPendingFirstWorkoutPlan();
    setShowWorkoutOptions(false);

    try {
      const savedPlan = await persistSavedPlan(workout, { activate: true });
      await completeInitialSetupIfNeeded();

      Alert.alert(
        'Plan saved',
        `"${savedPlan.name}" is in My Plans under Workouts. Open the Workouts tab anytime to start training.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (wasInitialSetup) onBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving workout plan:', error);
      Alert.alert('Error', 'Failed to save workout plan');
    }
  };

  const handleSelectWorkout = async (workout: WorkoutPlan) => {
    const cleanName = workout.name.replace(/\s*-\s*Option\s*\d+$/, '');
    workout.name = cleanName;

    if (!workout || !workout.weeklyPlan || workout.weeklyPlan.weekDays.length === 0) {
      Alert.alert('Error', 'Invalid workout plan selected.');
      return;
    }

    setShowWorkoutOptions(false);

    try {
      await persistSavedPlan(workout, { activate: true });
      await completeInitialSetupIfNeeded();
    } catch (error) {
      console.error('Error saving workout plan:', error);
      Alert.alert('Error', 'Failed to save workout plan');
      return;
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
      setExerciseLogs(initExerciseLogs(workout.weeklyPlan.weekDays[0].exercises));
    } else {
      setExerciseLogs(initExerciseLogs(workout.exercises));
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
    const complete = await isOnboardingComplete();
    if (!complete) {
      Alert.alert(
        'Complete onboarding first',
        'Your coaching profile powers plan generation. Finish the onboarding wizard from the home screen after sign-in.'
      );
      return;
    }

    try {
      const cp = await loadCoachingProfile();
      await runGenerateFromProfile(cp, { force: initialSetupPending });
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
      setExerciseLogs(initExerciseLogs(dayWorkout.exercises));
      setCurrentExerciseIndex(0);
      setCurrentSetIndex(0);
    }
  };

  const advanceToNextExercise = () => {
    if (currentExerciseIndex < trackingExercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setCurrentSetIndex(0);
    }
  };

  const applyWarmupLogUpdate = (logIndex: number, nextLog: ExerciseLog, autoAdvance: boolean) => {
    const updatedLogs = [...exerciseLogs];
    updatedLogs[logIndex] = syncWarmupSetCompletion(nextLog);
    setExerciseLogs(updatedLogs);
    if (autoAdvance && updatedLogs[logIndex].sets[0]?.completed) {
      advanceToNextExercise();
    }
  };

  const handleWarmupItemToggle = (itemId: string) => {
    const log = exerciseLogs[currentExerciseIndex];
    if (!log?.warmupItems || (!log.isWarmupBlock && !log.isCooldownBlock)) return;
    const warmupItems = log.warmupItems.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    const allDone = warmupItems.every((w) => w.completed);
    applyWarmupLogUpdate(
      currentExerciseIndex,
      { ...log, warmupItems },
      allDone
    );
  };

  const handleWarmupCompleteAll = () => {
    const log = exerciseLogs[currentExerciseIndex];
    if (!log?.warmupItems || (!log.isWarmupBlock && !log.isCooldownBlock)) return;
    const warmupItems = log.warmupItems.map((item) => ({ ...item, completed: true }));
    applyWarmupLogUpdate(
      currentExerciseIndex,
      { ...log, warmupItems },
      true
    );
  };

  const handleSetComplete = () => {
    if (!currentWorkout || currentExerciseIndex >= trackingExercises.length) return false;

    const currentEx = trackingExercises[currentExerciseIndex];
    if (currentEx && isPhaseBlock(currentEx)) return false;
    
    const currentLog = exerciseLogs[currentExerciseIndex];
    
    if (!currentLog || currentSetIndex >= currentLog.sets.length) return false;
    
    // Get weight and reps from the current set
    const currentSet = currentLog.sets[currentSetIndex];
    const weight = currentSet.weight;
    const reps = currentSet.reps;
    
    if (weight === 0 && reps === 0) {
      Alert.alert('Error', 'Please enter weight and reps');
      return false;
    }

    const updatedLogs = [...exerciseLogs];
    let sets = updatedLogs[currentExerciseIndex].sets.map((set, idx) =>
      idx === currentSetIndex ? { ...set, completed: true, weight, reps } : set
    );
    if (currentSetIndex < sets.length - 1) {
      const nextIdx = currentSetIndex + 1;
      const next = sets[nextIdx];
      if (!next.completed) {
        sets = sets.map((set, idx) =>
          idx === nextIdx ? { ...set, weight, reps } : set
        );
      }
    }
    updatedLogs[currentExerciseIndex] = {
      ...updatedLogs[currentExerciseIndex],
      sets,
    };
    setExerciseLogs(updatedLogs);

    // Move to next set or next exercise
    if (currentSetIndex < currentLog.sets.length - 1) {
      setCurrentSetIndex(currentSetIndex + 1);
    } else if (currentExerciseIndex < trackingExercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setCurrentSetIndex(0);
    }

    return true;
  };

  const updateCurrentSetWeight = (nextWeight: number) => {
    if (!exerciseLogs[currentExerciseIndex]) return;
    const newLogs = [...exerciseLogs];
    const updatedSets = [...newLogs[currentExerciseIndex].sets];
    updatedSets[currentSetIndex] = { ...updatedSets[currentSetIndex], weight: Math.max(0, Math.round(nextWeight)) };
    newLogs[currentExerciseIndex] = { ...newLogs[currentExerciseIndex], sets: updatedSets };
    setExerciseLogs(newLogs);
  };

  const updateCurrentSetReps = (nextReps: number) => {
    if (!exerciseLogs[currentExerciseIndex]) return;
    const newLogs = [...exerciseLogs];
    const updatedSets = [...newLogs[currentExerciseIndex].sets];
    updatedSets[currentSetIndex] = { ...updatedSets[currentSetIndex], reps: Math.max(0, Math.round(nextReps)) };
    newLogs[currentExerciseIndex] = { ...newLogs[currentExerciseIndex], sets: updatedSets };
    setExerciseLogs(newLogs);
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

      const completedExercises: Exercise[] = expandCompletedExercisesForHistory(
        trackingExercises,
        exerciseLogs.filter((log) => log.sets.some((set) => set.completed))
      );

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

    const completedExercises: Exercise[] = expandCompletedExercisesForHistory(
      trackingExercises,
      exerciseLogs.filter((log) => log.sets.some((set) => set.completed))
    );

    const workoutLog: WorkoutLog = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      planId: currentWorkout.id,
      exercises: completedExercises,
      notes,
      duration: currentWorkout.duration
    };

    const finalize = () => {
      setWorkoutLogs(prev => [workoutLog, ...prev]);
      setShowWorkoutModal(false);
      setCurrentWorkout(null);
      setCurrentWeeklyPlan(null);
      setExerciseLogs([]);
      setCurrentExerciseIndex(0);
      setCurrentSetIndex(0);
      setNotes('');
      void import('./src/utils/workoutCompleteNotifications').then(({ notifyWorkoutCompleted }) =>
        notifyWorkoutCompleted({
          programName: currentWorkout.name,
          duration: workoutLog.duration,
          exerciseCount: completedExercises.length,
        })
      );
    };

    void (async () => {
      try {
        const shouldAsk = await shouldPromptMovementResponseFeedback();
        if (shouldAsk) {
          const lastName =
            completedExercises[completedExercises.length - 1]?.name ??
            trackingExercises[currentExerciseIndex]?.name ??
            null;
          setMovementFeedbackExercise(lastName);
          pendingFinishFinalizeRef.current = finalize;
          setMovementFeedbackVisible(true);
          return;
        }
      } catch (e) {
        console.warn('[WorkoutScreen] movement feedback gate failed', e);
      }
      finalize();
    })();
  };

  const completeMovementFeedbackAndFinish = () => {
    setMovementFeedbackVisible(false);
    const pending = pendingFinishFinalizeRef.current;
    pendingFinishFinalizeRef.current = null;
    if (pending) pending();
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
        workoutOptions={workoutOptions as unknown as GeneratedWorkoutPlan[]}
        generatedGoal={workoutOptions[0]?.goal}
        isInitialSetup={initialSetupPending}
        onSave={(w) => void handleSavePlanFromOptions(w as unknown as WorkoutPlan)}
        onStartWorkout={(w) => void handleSelectWorkout(w as unknown as WorkoutPlan)}
        onBack={handleWorkoutOptionsBack}
      />
    );
  }

  if (generatingPlan) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.generatingPlanOverlay}>
          <ActivityIndicator size="large" color={AppTheme.accent} />
          <Text style={styles.generatingPlanTitle}>Building your plan…</Text>
          <Text style={styles.generatingPlanSubtitle}>
            Using your onboarding answers to create workout options.
          </Text>
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
        <Text style={styles.headerTitle}>Workout Planner</Text>
        <TouchableOpacity style={styles.savedPlansButton} onPress={() => setShowSavedPlans(!showSavedPlans)}>
          <Text style={styles.savedPlansButtonText}>
            {showSavedPlans ? 'New Plan' : 'Saved'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {initialSetupPending ? (
          <View style={styles.setupBanner}>
            <Text style={styles.setupBannerTitle}>Choose a personalized plan</Text>
            <Text style={styles.setupBannerText}>
              We generated options from your onboarding answers. Pick one and tap Save Plan, or skip and build your own anytime.
            </Text>
            <TouchableOpacity onPress={handleSkipInitialSetup} style={styles.setupSkipLink}>
              <Text style={styles.setupSkipLinkText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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
        {/* Coaching profile summary — data from onboarding wizard */}
        <View style={[styles.section, styles.questionCard]}>
          <Text style={styles.sectionTitle}>Your coaching profile</Text>
          <Text style={styles.sectionSubtitle}>
            Plans are built from your onboarding answers. Update preferences or challenge level in Settings.
          </Text>
          {coachingProfile && onboardingReady ? (
            <View style={styles.profileSummaryBox}>
              <Text style={styles.profileSummaryLine}>
                Goal:{' '}
                {coachingProfile.goalProfile.primaryGoal
                  ? PRIMARY_GOAL_LABELS[coachingProfile.goalProfile.primaryGoal]
                  : '—'}
              </Text>
              <Text style={styles.profileSummaryLine}>
                Schedule: {coachingProfile.scheduleProfile.daysPerWeek} days ×{' '}
                {coachingProfile.scheduleProfile.sessionLengthMinutes} min
              </Text>
              <Text style={styles.profileSummaryLine}>
                Experience: {coachingProfile.experienceProfile.level}
              </Text>
              <Text style={styles.profileSummaryLine}>
                Challenge: {coachingProfile.adherenceProfile.challengeDial}
                {' '}
                (intensity dial — not fewer training days)
              </Text>
              <Text style={styles.profileSummaryLine}>
                Coach focus:{' '}
                {buildWorkoutGenerationModifiers(coachingProfile).coachingNote}
              </Text>
            </View>
          ) : (
            <Text style={styles.questionnaireNoteText}>
              Complete the onboarding wizard after sign-in to generate your first personalized plan.
            </Text>
          )}
        </View>

        {/* Generate Workout Button */}
        <TouchableOpacity
          style={[
            styles.generateButton,
            !onboardingReady && styles.generateButtonDisabled,
          ]}
          ref={fitnessAiGenerateRef}
          nativeID={TOUR_TARGET_IDS.fitnessAiGenerate}
          onPress={handleGenerateWorkout}
          disabled={!onboardingReady}
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
        animationType="none"
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
            {currentWorkout && trackingExercises.length > 0 && exerciseLogs && exerciseLogs.length > 0 && currentExerciseIndex < trackingExercises.length && currentExerciseIndex < exerciseLogs.length && (
              <View style={styles.currentExercise}>
                <Text style={styles.exerciseTitle}>
                  {trackingExercises[currentExerciseIndex]?.name || 'Exercise'}
                </Text>
                {trackingExercises[currentExerciseIndex] && isPhaseBlock(trackingExercises[currentExerciseIndex]) ? (
                  <>
                    <Text style={styles.exerciseDetails}>
                      {trackingExercises[currentExerciseIndex].warmupItems?.length ?? 0} movements · check each off as you go
                    </Text>
                    {exerciseLogs[currentExerciseIndex]?.warmupItems && (
                      <WarmupBlockSession
                        items={exerciseLogs[currentExerciseIndex].warmupItems!}
                        blockComplete={exerciseLogs[currentExerciseIndex].sets[0]?.completed === true}
                        blockLabel={trackingExercises[currentExerciseIndex].isCooldownBlock ? 'Cool-down' : 'Warm-up'}
                        onToggleItem={handleWarmupItemToggle}
                        onCompleteAll={handleWarmupCompleteAll}
                      />
                    )}
                  </>
                ) : (
                  <>
                <Text style={styles.exerciseDetails}>
                  Set {Math.min(currentSetIndex + 1, trackingExercises[currentExerciseIndex]?.sets || 1)} of {trackingExercises[currentExerciseIndex]?.sets || 0} • Target: {trackingExercises[currentExerciseIndex]?.reps || 0} reps
                </Text>
                
                {exerciseLogs[currentExerciseIndex] && exerciseLogs[currentExerciseIndex].sets && exerciseLogs[currentExerciseIndex].sets.length > 0 && currentSetIndex < exerciseLogs[currentExerciseIndex].sets.length && (
                  <WorkoutSession
                    sessionKey={`${currentExerciseIndex}-${currentSetIndex}`}
                    exerciseName={trackingExercises[currentExerciseIndex]?.name || 'Exercise'}
                    currentWeight={exerciseLogs[currentExerciseIndex].sets[currentSetIndex]?.weight || 0}
                    currentReps={exerciseLogs[currentExerciseIndex].sets[currentSetIndex]?.reps || 0}
                    targetWeight={trackingExercises[currentExerciseIndex]?.weight || 0}
                    targetReps={trackingExercises[currentExerciseIndex]?.reps || 0}
                    priorWeight={exerciseLogs[currentExerciseIndex].sets[currentSetIndex - 1]?.weight || trackingExercises[currentExerciseIndex]?.weight || 0}
                    priorReps={exerciseLogs[currentExerciseIndex].sets[currentSetIndex - 1]?.reps || trackingExercises[currentExerciseIndex]?.reps || 0}
                    showPredictiveWeight={showPredictiveWeight}
                    autoRestTimer={autoRestTimer}
                    onWeightChange={updateCurrentSetWeight}
                    onRepsChange={updateCurrentSetReps}
                    onLogSet={handleSetComplete}
                  />
                )}
                  </>
                )}
                <DiscomfortReportCTA
                  compact
                  label="Report discomfort"
                  onPress={() => {
                    setDiscomfortExerciseName(
                      trackingExercises[currentExerciseIndex]?.name ?? null
                    );
                    setDiscomfortVisible(true);
                  }}
                />
              </View>
            )}

            {/* Exercise List */}
            <View style={styles.exerciseList}>
              <Text style={styles.exerciseListTitle}>Workout Structure (Tap to select)</Text>
              <WorkoutPhaseStructure
                blocks={buildPlanPhaseBlocks(trackingExercises)}
                currentExerciseIndex={currentExerciseIndex}
                resolveExerciseIndex={(blockTitle, itemIndex) => {
                  if (blockTitle === 'Warm-Up') {
                    return trackingExercises.findIndex((ex) => ex.isWarmupBlock);
                  }
                  if (blockTitle === 'Cooldown') {
                    return trackingExercises.findIndex((ex) => ex.isCooldownBlock);
                  }
                  let mainIdx = 0;
                  for (let i = 0; i < trackingExercises.length; i += 1) {
                    const ex = trackingExercises[i];
                    if (ex.isWarmupBlock || ex.isCooldownBlock) continue;
                    if (mainIdx === itemIndex) return i;
                    mainIdx += 1;
                  }
                  return undefined;
                }}
                getProgressLabel={(exerciseIndex) => {
                  const log = exerciseLogs[exerciseIndex];
                  const ex = trackingExercises[exerciseIndex];
                  if (!log || !ex) return undefined;
                  if (ex.isWarmupBlock || ex.isCooldownBlock) {
                    const progress = getWarmupProgress(log);
                    return `${progress.done}/${progress.total} movements`;
                  }
                  const completedSets = log.sets?.filter((set) => set.completed).length ?? 0;
                  return `${completedSets}/${ex.sets ?? 0} sets`;
                }}
                onSelectExercise={(exerciseIndex) => {
                  setCurrentExerciseIndex(exerciseIndex);
                  const log = exerciseLogs[exerciseIndex];
                  const firstIncompleteSet = log?.sets?.findIndex((set) => !set.completed);
                  setCurrentSetIndex(
                    firstIncompleteSet !== undefined && firstIncompleteSet >= 0 ? firstIncompleteSet : 0
                  );
                }}
              />
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

            <DiscomfortReportCTA
              label="Something doesn't feel right?"
              onPress={() => {
                setDiscomfortExerciseName(
                  trackingExercises[currentExerciseIndex]?.name ?? null
                );
                setDiscomfortVisible(true);
              }}
            />

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

      <DiscomfortAssessmentFlow
        visible={discomfortVisible}
        exerciseName={discomfortExerciseName}
        onClose={() => setDiscomfortVisible(false)}
      />

      <MovementResponseFeedbackModal
        visible={movementFeedbackVisible}
        exerciseName={movementFeedbackExercise}
        onClose={completeMovementFeedbackAndFinish}
        onDone={completeMovementFeedbackAndFinish}
      />

      {/* Save Plan Modal */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="none"
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
        animationType="none"
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
    backgroundColor: AppTheme.bgScreen,
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
  scrollView: {
    flex: 1,
    padding: 20,
  },
  setupBanner: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.35)',
  },
  setupBannerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: AppTheme.textPrimary,
    marginBottom: 8,
  },
  setupBannerText: {
    fontSize: 14,
    color: AppTheme.textSecondary,
    lineHeight: 20,
  },
  setupSkipLink: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  setupSkipLinkText: {
    color: AppTheme.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  section: {
    marginBottom: 30,
  },
  questionCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: AppTheme.textMuted,
    marginBottom: 12,
    lineHeight: 20,
  },
  questionnaireNote: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#121212',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  questionnaireNoteText: {
    fontSize: 13,
    color: AppTheme.textMuted,
    lineHeight: 19,
  },
  profileSummaryBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#121212',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
    gap: 6,
  },
  profileSummaryLine: {
    fontSize: 14,
    color: AppTheme.textSecondary,
    lineHeight: 20,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  questionHint: {
    fontSize: 13,
    color: AppTheme.textMuted,
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
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderButtonActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.14)',
    borderColor: '#4ADE80',
  },
  genderButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppTheme.textMuted,
  },
  genderButtonTextActive: {
    color: '#4ADE80',
    fontWeight: 'bold',
  },
  textInput: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderRadius: 12,
    padding: 14,
    color: AppTheme.textPrimary,
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
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  goalCardSelected: {
    borderColor: '#4ADE80',
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
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
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  levelCardSelected: {
    borderColor: '#4ADE80',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  levelName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  levelDescription: {
    fontSize: 14,
    color: AppTheme.textMuted,
  },
  generateButton: {
    backgroundColor: '#4ADE80',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 30,
  },
  generateButtonDisabled: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f2517',
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
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppTheme.border,
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
    color: AppTheme.textMuted,
    marginBottom: 12,
  },
  restTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  restTimerLabel: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
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
  exerciseGroupSection: {
    marginBottom: 12,
  },
  exerciseGroupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00ff88',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.7,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  exerciseItemActive: {
    borderColor: '#4ADE80',
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
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
    color: '#4ADE80',
    fontWeight: 'bold',
  },
  exerciseSets: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  warmupSublistHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    lineHeight: 16,
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
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  exerciseCompleted: {
    backgroundColor: '#4ADE80',
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
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: AppTheme.border,
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
    gap: 10,
  },
  saveWorkoutButton: {
    flex: 1,
    backgroundColor: '#4ADE80',
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveWorkoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f2517',
  },
  finishButton: {
    flex: 1,
    backgroundColor: '#121212',
    borderRadius: 12,
    minHeight: 52,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: AppTheme.textPrimary,
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
    marginTop: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
  },
  exerciseScrollView: {
    flexGrow: 0,
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
  generatingPlanOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  generatingPlanTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 20,
    textAlign: 'center',
  },
  generatingPlanSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'center',
  },
});

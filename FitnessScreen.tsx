import React, { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  AppState,
  useWindowDimensions,
} from 'react-native';
import { AppTextInput as TextInput } from './src/components/AppTextInput';
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
import { isScannedFoodUsable } from './src/utils/foodDatabase';
import { getFoodDetails } from './src/api/usda';
import { useFoodSearch } from './src/hooks/useFoodSearch';
import type { FoodSearchHit } from './src/types/fdcApi';
import {
  getLogFoodNameMatches,
  type LogFoodHistoryMatch,
  type LogFoodSavedMatch,
  type LogFoodYourFoodMatch,
} from './src/utils/logFoodNameMatches';
import { TOUR_TARGET_IDS } from './src/tour/tourTargets';
import { fireTourTargetIfNeeded } from './src/tour/fireTourTarget';
import { useTourTargetRef } from './src/tour/useTourTargetRef';
import { registerTourTargetScroll } from './src/tour/tourTargetRegistry';
import type { TourFitnessIntent, TourLogFoodIntent } from './src/tour/types';
import { useSubscription } from './src/context/SubscriptionContext';
import { PremiumRequiredError } from './src/utils/subscription';
import {
  buildLogFoodFormFromFdcFood,
  type LogFoodFormDatabasePayload,
} from './src/utils/logFoodFormFromDatabase';
import { logFoodFormHasMicronutrients } from './src/utils/fdcMicronutrients';

type WorkoutQuickPanel = 'myPlans' | 'templates' | null;
import { tapOutsideToDismissKeyboard } from './src/keyboard';
import { SimplePortionControl } from './src/components/nutrition/SimplePortionControl';
import { ServingTypeWheelPicker } from './src/components/nutrition/ServingTypeWheelPicker';
import type { MacroMicroSnapshot, PortionInputMode } from './src/types/portionInput';
import {
  clampNaturalFraction,
  inferDisplayWholeName,
  macroSnapshotFromMealInputStrings,
  scaleMacroSnapshot,
} from './src/utils/wholeFoodPortions';
import {
  buildLogFoodPortionBasis,
  convertLogFoodBaseServingForUnitChange,
  formatLogFoodPortionAmount,
  logFoodAmountToGrams,
  parseLogFoodPortionAmount,
  scaleLogFoodPortionBasis,
  type LogFoodPortionBasis,
  isLogFoodServingUnit,
  type LogFoodServingUnit,
} from './src/utils/logFoodPortionScale';
import { saveUserData, loadUserData } from './src/utils/userStorage';
import {
  DEFAULT_NUTRITION_GOALS,
  type NutritionGoals,
} from './src/types/nutritionGoals';
import {
  loadPersistedNutritionGoals,
  savePersistedNutritionGoals,
} from './src/utils/nutritionGoalsStorage';
import { subscribeUserDataReady } from './src/utils/userDataEvents';
import {
  calculateCaloriesFromMacros,
  updateLoggedMeal,
  deleteLoggedMeal,
  duplicateLoggedMealToDate,
  duplicateMealsFromDayToDate,
  localDateKeyFromIso,
} from './src/utils/loggedMeals';
import AIService, { ProgramAdaptation } from './AIService';
import HealthService from './src/services/HealthService';
import { AppTheme } from './src/theme/appVisualTheme';
import { useSmallWins } from './src/context/SmallWinsContext';
import { useToast } from './src/components/ToastProvider';
import {
  isGeminiApiKeyConfigured,
  getGeminiSetupHint,
  type EatingOutCoachPayload,
  type EatingOutCoachSuggestion,
  getAiMealEstimateFromDescription,
} from './src/services/geminiService';
import type { AiMealEstimate, LogFoodItem, NutritionLoggingMode } from './src/types/nutritionLogging';
import {
  loadNutritionLoggingMode,
  saveNutritionLoggingMode,
} from './src/utils/nutritionLoggingModeStorage';
import {
  formatAiMealLogName,
  formatEatingOutCoachLogName,
} from './src/utils/eatingOutCoachLogName';
import {
  logFoodItemsFromAiEstimate,
  logFoodItemsFromEatingOutPick,
  sumLogFoodItemMacros,
  formatLogFoodItemsSummary,
} from './src/utils/logFoodItems';
import LogFoodItemBreakdown from './src/components/LogFoodItemBreakdown';

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

type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

function formatEatingOutCoachMacroStrip(s: EatingOutCoachSuggestion): string {
  const bits: string[] = [];
  if (s.calories != null && Number.isFinite(s.calories)) bits.push(`≈ ${Math.round(s.calories)} kcal`);
  const macroBits: string[] = [];
  if (s.protein_g != null) macroBits.push(`${s.protein_g}g protein`);
  if (s.carbs_g != null) macroBits.push(`${s.carbs_g}g carbs`);
  if (s.fat_g != null) macroBits.push(`${s.fat_g}g fat`);
  if (macroBits.length) bits.push(macroBits.join(' · '));
  return bits.join(' · ') || 'Approx. macros vary by location';
}

const EATING_OUT_COACH_HISTORY_KEY = 'fitness_eating_out_coach_history_v1';
const EATING_OUT_COACH_HISTORY_MAX = 15;

interface EatingOutCoachHistoryEntry {
  id: string;
  query: string;
  payload: EatingOutCoachPayload;
  savedAt: string;
}

function formatEatingOutHistoryStamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function isValidEatingOutHistoryEntry(x: unknown): x is EatingOutCoachHistoryEntry {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.query === 'string' &&
    o.payload !== null &&
    typeof o.payload === 'object' &&
    typeof o.savedAt === 'string' &&
    Array.isArray((o.payload as EatingOutCoachPayload).suggestions)
  );
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
  /** Optional itemized breakdown (AI / Food coach). */
  items?: LogFoodItem[];
  mealSlot?: MealSlot;
  /** Optional label from Dashboard edit / future log-food parity */
  servingAmount?: string;
  servingUnit?: string;
}

type NutritionHistBucket = { start: Date; end: Date; label: string };

/** Monday 00:00 local for the week containing `d` (matches Dashboard week logic). */
function mondayStartLocal(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sumMealCaloriesInRange(meals: Meal[], start: Date, end: Date): number {
  const t0 = start.getTime();
  const t1 = end.getTime();
  return meals.reduce((sum, m) => {
    const t = new Date(m.date).getTime();
    if (!Number.isFinite(t)) return sum;
    if (t >= t0 && t < t1) return sum + (Number(m.calories) || 0);
    return sum;
  }, 0);
}

/** Oldest → newest; each bucket is [start, end) with end the following Monday. */
function buildNutritionWeekBuckets(today: Date, count: 4 | 8 | 12): NutritionHistBucket[] {
  const thisMonday = mondayStartLocal(today);
  const buckets: NutritionHistBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(thisMonday);
    start.setDate(start.getDate() - 7 * i);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const label = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    buckets.push({ start, end, label });
  }
  return buckets;
}

/** Oldest → newest calendar months. */
function buildNutritionMonthBuckets(today: Date, count: 3 | 6 | 12): NutritionHistBucket[] {
  const buckets: NutritionHistBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const year = today.getFullYear();
    const month = today.getMonth() - i;
    const start = new Date(year, month, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const label = start.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    buckets.push({ start, end, label });
  }
  return buckets;
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
  lastServingUnit?: string;
  lastBaseServingSize?: string;
  lastServings?: string;
  lastServingAmount?: string;
}

interface SavedMealPortionHint {
  lastServingUnit?: string;
  lastBaseServingSize?: string;
  lastServings?: string;
  lastServingAmount?: string;
}

/** Upsert a meal template by name; collapses duplicate names (e.g. dev StrictMode). */
function applySavedMealUpsert(
  prev: SavedMeal[],
  mealName: string,
  totals: { calories: number; protein: number; carbs: number; fat: number },
  opts?: { bumpUsesOnMatch?: boolean; portion?: SavedMealPortionHint }
): SavedMeal[] {
  const trimmed = mealName.trim();
  if (!trimmed) return prev;
  const key = trimmed.toLowerCase();
  const existing = prev.find((m) => m.name.toLowerCase() === key);
  const now = new Date().toISOString();
  const portion = opts?.portion;
  let next: SavedMeal[];
  if (existing) {
    next = prev.map((m) =>
      m.id === existing.id
        ? {
            ...m,
            name: trimmed,
            calories: totals.calories,
            protein: totals.protein,
            carbs: totals.carbs,
            fat: totals.fat,
            lastUsed: now,
            timesUsed: opts?.bumpUsesOnMatch ? m.timesUsed + 1 : m.timesUsed,
            ...(portion?.lastServingUnit ? { lastServingUnit: portion.lastServingUnit } : {}),
            ...(portion?.lastBaseServingSize ? { lastBaseServingSize: portion.lastBaseServingSize } : {}),
            ...(portion?.lastServings ? { lastServings: portion.lastServings } : {}),
            ...(portion?.lastServingAmount ? { lastServingAmount: portion.lastServingAmount } : {}),
          }
        : m
    );
  } else {
    next = [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        name: trimmed,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        timesUsed: 1,
        lastUsed: now,
        ...(portion?.lastServingUnit ? { lastServingUnit: portion.lastServingUnit } : {}),
        ...(portion?.lastBaseServingSize ? { lastBaseServingSize: portion.lastBaseServingSize } : {}),
        ...(portion?.lastServings ? { lastServings: portion.lastServings } : {}),
        ...(portion?.lastServingAmount ? { lastServingAmount: portion.lastServingAmount } : {}),
      },
      ...prev,
    ];
  }
  const lastUsedTs = (iso: string) => {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  const byName = new Map<string, SavedMeal>();
  for (const m of next) {
    const k = m.name.toLowerCase();
    const cur = byName.get(k);
    if (!cur || lastUsedTs(m.lastUsed) >= lastUsedTs(cur.lastUsed)) {
      byName.set(k, m);
    }
  }
  return Array.from(byName.values());
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

type FitnessMainTab = 'workouts' | 'nutrition' | 'history';

export default function FitnessScreen({
  onBack,
  onCompleteTask,
  syncedFitnessTab,
  fitnessSurfaceNonce = 0,
  tourLogFoodIntent,
  tourFitnessIntent,
  onFitnessTabChange,
}: {
  onBack: () => void;
  onCompleteTask: (taskTitle: string) => void;
  syncedFitnessTab?: FitnessMainTab;
  /** When App bumps this (tab bar / deep links), nested full-screen flows close so the selected tab is visible. */
  fitnessSurfaceNonce?: number;
  /** Guided tour: open/close Log Food and set logging mode. */
  tourLogFoodIntent?: TourLogFoodIntent | null;
  /** Guided tour: open workout panels / nested workout flows. */
  tourFitnessIntent?: TourFitnessIntent | null;
  onFitnessTabChange?: (tab: FitnessMainTab) => void;
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { isPremium, presentUpgrade } = useSubscription();
  const { showToast, showNotification } = useToast();
  const fitnessStartRef = useTourTargetRef(TOUR_TARGET_IDS.fitnessStart);
  const fitnessTodayCardRef = useTourTargetRef(TOUR_TARGET_IDS.fitnessTodayCard);
  const fitnessAiWorkoutRef = useTourTargetRef(TOUR_TARGET_IDS.fitnessAiWorkout);
  const fitnessBuildWorkoutRef = useTourTargetRef(TOUR_TARGET_IDS.fitnessBuildWorkout);
  const fitnessMyPlansRef = useTourTargetRef(TOUR_TARGET_IDS.fitnessMyPlans);
  const fitnessMyPlansPanelRef = useTourTargetRef(TOUR_TARGET_IDS.fitnessMyPlansPanel);
  const nutritionLogFoodRef = useTourTargetRef(TOUR_TARGET_IDS.nutritionLogFood);
  const logFoodModePrecisionRef = useTourTargetRef(TOUR_TARGET_IDS.logFoodModePrecision);
  const logFoodModeAiRef = useTourTargetRef(TOUR_TARGET_IDS.logFoodModeAi);
  const logFoodMealNameRef = useTourTargetRef(TOUR_TARGET_IDS.logFoodMealName);
  const logFoodAiInputRef = useTourTargetRef(TOUR_TARGET_IDS.logFoodAiInput);

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
      setPlanToEdit(null);
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

  const [activeTab, setActiveTab] = useState<FitnessMainTab>('workouts');

  const updateFitnessTab = React.useCallback(
    (t: FitnessMainTab) => {
      setActiveTab(t);
      onFitnessTabChange?.(t);
    },
    [onFitnessTabChange]
  );

  useEffect(() => {
    if (syncedFitnessTab) {
      setActiveTab(syncedFitnessTab);
    }
    if (syncedFitnessTab && syncedFitnessTab !== 'nutrition') {
      setShowLogFoodModal(false);
    }
  }, [syncedFitnessTab]);

  useEffect(() => {
    setShowWorkoutScreen(false);
    setShowLogPastWorkout(false);
    setShowBuildYourOwnScreen(false);
    setShowEatingOutCoachModal(false);
    setPlanToEdit(null);
    setSelectedSavedPlan(null);
    setSelectedHistorySession(null);
    setSelectedProgram(null);
    setWorkoutQuickPanel(null);
  }, [fitnessSurfaceNonce]);
  const [macroLogs, setMacroLogs] = useState<MacroLog[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [savedMealsSearchQuery, setSavedMealsSearchQuery] = useState('');
  const deferredSavedMealsSearchQuery = useDeferredValue(savedMealsSearchQuery);
  const filteredSavedMealsForPicker = useMemo(
    () =>
      savedMeals.filter((m) =>
        m.name.toLowerCase().includes(deferredSavedMealsSearchQuery.toLowerCase().trim())
      ),
    [savedMeals, deferredSavedMealsSearchQuery]
  );
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showLogFoodModal, setShowLogFoodModal] = useState(false);
  const [logFoodSavedPickerOpen, setLogFoodSavedPickerOpen] = useState(false);
  const [logFoodDatabaseLoading, setLogFoodDatabaseLoading] = useState(false);
  const [logFoodSlot, setLogFoodSlot] = useState<MealSlot>('lunch');
  const [mealSlotSheet, setMealSlotSheet] = useState<MealSlot | null>(null);
  /** After picking a saved/history row, hide inline matches and scroll to Nutrition data for review. */
  const [logFoodSuppressInlineSuggest, setLogFoodSuppressInlineSuggest] = useState(false);
  const [logFoodNameInputFocused, setLogFoodNameInputFocused] = useState(false);
  const logFoodScrollRef = useRef<ScrollView | null>(null);
  const logFoodNutritionSectionY = useRef(0);
  const logFoodNameBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Macros + micros for exactly one whole item while Log Food is in “simple” portion mode. */
  const logFoodMacrosPerWholeRef = useRef<MacroMicroSnapshot | null>(null);
  /** Reference portion + macros for Precise mode serving-size scaling. */
  const logFoodPreciseBasisRef = useRef<LogFoodPortionBasis | null>(null);
  const logFoodReferenceGramsPerPieceRef = useRef<number | undefined>(undefined);
  const logFoodMacroRecalcLockRef = useRef(false);
  const [portionInputMode, setPortionInputMode] = useState<PortionInputMode>('precise');
  const [naturalFraction, setNaturalFraction] = useState(1);
  const [showAdjustGoalsModal, setShowAdjustGoalsModal] = useState(false);
  const [showEatingOutCoachModal, setShowEatingOutCoachModal] = useState(false);
  const [eatingOutQuery, setEatingOutQuery] = useState('');
  const [eatingOutCoachLoading, setEatingOutCoachLoading] = useState(false);
  const [eatingOutCoachError, setEatingOutCoachError] = useState<string | null>(null);
  const [eatingOutCoachPayload, setEatingOutCoachPayload] = useState<EatingOutCoachPayload | null>(null);
  const [eatingOutCoachHistory, setEatingOutCoachHistory] = useState<EatingOutCoachHistoryEntry[]>([]);
  const [showEatingOutHistoryModal, setShowEatingOutHistoryModal] = useState(false);
  const [nutritionLoggingMode, setNutritionLoggingMode] = useState<NutritionLoggingMode>('precision');
  const [aiMealQuery, setAiMealQuery] = useState('');
  const [aiMealLoading, setAiMealLoading] = useState(false);
  const [aiMealError, setAiMealError] = useState<string | null>(null);
  const [aiMealEstimate, setAiMealEstimate] = useState<AiMealEstimate | null>(null);
  const [logFoodItems, setLogFoodItems] = useState<LogFoodItem[]>([]);

  const openFoodCoach = React.useCallback(() => {
    if (!isPremium) {
      presentUpgrade();
      return;
    }
    setEatingOutCoachPayload(null);
    setEatingOutCoachError(null);
    setEatingOutQuery('');
    setShowEatingOutCoachModal(true);
  }, [isPremium, presentUpgrade]);

  const openAiWorkout = React.useCallback(() => {
    if (!isPremium) {
      presentUpgrade();
      fireTourTargetIfNeeded(TOUR_TARGET_IDS.fitnessAiWorkout);
      return;
    }
    setShowWorkoutScreen(true);
    fireTourTargetIfNeeded(TOUR_TARGET_IDS.fitnessAiWorkout);
  }, [isPremium, presentUpgrade]);

  const [nutritionHistMode, setNutritionHistMode] = useState<'weeks' | 'months'>('weeks');
  const [nutritionHistWeeks, setNutritionHistWeeks] = useState<4 | 8 | 12>(8);
  const [nutritionHistMonths, setNutritionHistMonths] = useState<3 | 6 | 12>(6);
  const [nutritionHistExpanded, setNutritionHistExpanded] = useState(false);
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals>(DEFAULT_NUTRITION_GOALS);
  const [editGoals, setEditGoals] = useState({
    protein: String(DEFAULT_NUTRITION_GOALS.protein),
    carbs: String(DEFAULT_NUTRITION_GOALS.carbs),
    fat: String(DEFAULT_NUTRITION_GOALS.fat),
    water: String(DEFAULT_NUTRITION_GOALS.water),
  });
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [showWorkoutScreen, setShowWorkoutScreen] = useState(false);
  const [showBuildYourOwnScreen, setShowBuildYourOwnScreen] = useState(false);
  const [planToEdit, setPlanToEdit] = useState<any | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<WorkoutProgram | null>(null);
  const [selectedSavedPlan, setSelectedSavedPlan] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'strength' | 'muscle_building' | 'cardio' | 'bodyweight' | null>(null);
  const [workoutQuickPanel, setWorkoutQuickPanel] = useState<WorkoutQuickPanel>(null);
  const tourPlanPreviewPendingRef = useRef(false);

  const toggleWorkoutQuickPanel = (panel: Exclude<WorkoutQuickPanel, null>) => {
    setWorkoutQuickPanel((prev) => (prev === panel ? null : panel));
  };
  const [selectedHistorySession, setSelectedHistorySession] = useState<WorkoutSession | null>(null);
  const [historyCalendarMonth, setHistoryCalendarMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [expandedDayItems, setExpandedDayItems] = useState<Set<string>>(new Set());
  const [mealCopyPending, setMealCopyPending] = useState<Meal | null>(null);
  const [dayCopyPending, setDayCopyPending] = useState<string | null>(null);
  const [showLogPastWorkout, setShowLogPastWorkout] = useState(false);

  React.useEffect(() => {
    (FitnessScreen as any).internalBackHandler = handleInternalBack;
    return () => {
      delete (FitnessScreen as any).internalBackHandler;
    };
  }, [selectedProgram, selectedHistorySession, selectedSavedPlan, showBuildYourOwnScreen, showWorkoutScreen, showLogPastWorkout]);

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
  // Notifications removed per request

  useEffect(() => {
    let cancelled = false;
    loadNutritionLoggingMode().then((mode) => {
      if (!cancelled) setNutritionLoggingMode(mode);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(EATING_OUT_COACH_HISTORY_KEY);
        if (!raw || cancelled) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const entries = parsed.filter(isValidEatingOutHistoryEntry);
        if (!cancelled) setEatingOutCoachHistory(entries.slice(0, EATING_OUT_COACH_HISTORY_MAX));
      } catch {
        /* ignore corrupt cache */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showLogFoodModal) {
      setLogFoodSavedPickerOpen(false);
      setSavedMealsSearchQuery('');
      setLogFoodDatabaseLoading(false);
      setLogFoodSuppressInlineSuggest(false);
      setLogFoodNameInputFocused(false);
      if (logFoodNameBlurTimerRef.current) {
        clearTimeout(logFoodNameBlurTimerRef.current);
        logFoodNameBlurTimerRef.current = null;
      }
      setPortionInputMode('precise');
      setNaturalFraction(1);
      logFoodMacrosPerWholeRef.current = null;
      logFoodPreciseBasisRef.current = null;
      logFoodReferenceGramsPerPieceRef.current = undefined;
      setLogFoodEditingMealId(null);
    }
  }, [showLogFoodModal]);

  // Reload workout history when switching to history tab
  useEffect(() => {
    if (activeTab === 'history') {
      loadWorkoutHistory();
      // Reset calendar to current month when opening history tab
      setHistoryCalendarMonth(new Date());
    }
  }, [activeTab]);

  const { onWorkoutLoggerOpened } = useSmallWins();
  useEffect(() => {
    if (activeTab === 'workouts') {
      onWorkoutLoggerOpened().catch(() => {});
    }
  }, [activeTab, onWorkoutLoggerOpened]);

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

  useEffect(() => {
    const refreshFitnessData = () => {
      loadWorkoutHistory();
      loadSavedMeals();
      loadNutritionGoals();
      loadMeals();
      loadCompletedTasks();
      loadSavedWorkoutPlans();
      loadActivePlans();
    };
    refreshFitnessData();
    return subscribeUserDataReady(refreshFitnessData);
  }, []);

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
        const seen = new Set<string>();
        const deduped = parsedHistory.filter((s) => {
          const k = `${s.id}|${s.date}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (deduped.length < parsedHistory.length) {
          await saveUserData('workoutHistory', deduped);
        }
        setWorkoutHistory(deduped);
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
      if (parsedMeals && Array.isArray(parsedMeals)) {
        console.log('Parsed saved meals:', parsedMeals);
        setSavedMeals(parsedMeals);
      } else if (parsedMeals != null) {
        console.warn('savedMeals in storage was not an array; resetting');
        setSavedMeals([]);
      }
    } catch (error) {
      console.error('Error loading saved meals:', error);
    }
  };

  const saveSavedMeals = async (meals: SavedMeal[]) => {
    try {
      const safe: SavedMeal[] = (Array.isArray(meals) ? meals : []).map((m) => ({
        id: String(m?.id ?? `${Date.now()}`),
        name: String(m?.name ?? 'Meal').trim() || 'Meal',
        calories: Math.max(0, Math.round(Number(m?.calories) || 0)),
        protein: Math.max(0, Math.round(Number(m?.protein) || 0)),
        carbs: Math.max(0, Math.round(Number(m?.carbs) || 0)),
        fat: Math.max(0, Math.round(Number(m?.fat) || 0)),
        timesUsed: Math.max(0, Math.round(Number(m?.timesUsed) || 0)),
        lastServingUnit: typeof m?.lastServingUnit === 'string' ? m.lastServingUnit : undefined,
        lastBaseServingSize: typeof m?.lastBaseServingSize === 'string' ? m.lastBaseServingSize : undefined,
        lastServings: typeof m?.lastServings === 'string' ? m.lastServings : undefined,
        lastServingAmount: typeof m?.lastServingAmount === 'string' ? m.lastServingAmount : undefined,
        lastUsed:
          typeof m?.lastUsed === 'string' && Number.isFinite(new Date(m.lastUsed).getTime())
            ? m.lastUsed
            : new Date().toISOString(),
      }));
      console.log('Saving saved meals:', safe.length, 'items');
      await saveUserData('savedMeals', safe);
      console.log('Saved meals saved successfully');
    } catch (error) {
      console.error('Error saving saved meals:', error);
      throw error;
    }
  };

  const loadNutritionGoals = async () => {
    try {
      const parsedGoals = await loadPersistedNutritionGoals();
      if (parsedGoals) {
        setNutritionGoals(parsedGoals);
        setEditGoals({
          protein: parsedGoals.protein.toString(),
          carbs: parsedGoals.carbs.toString(),
          fat: parsedGoals.fat.toString(),
          water: parsedGoals.water.toString(),
        });
      }
    } catch (error) {
      console.error('Error loading nutrition goals:', error);
    }
  };

  const saveNutritionGoals = async (goals: NutritionGoals) => {
    try {
      await savePersistedNutritionGoals(goals);
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
      throw error;
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
    servingUnit: 'piece' as LogFoodServingUnit,
    servingWeight: '', // Weight/amount in the selected unit
    baseServingSize: '1', // Base serving size for calculations
    micronutrients: undefined as Micronutrients | undefined,
    /** Set after barcode scan when Open Food Facts serving math used a note. */
    nutritionScanNote: undefined as string | undefined,
  });
  /** Isolated from mealInput so typing a meal name does not re-render the whole log-food form. */
  const [mealNameInput, setMealNameInput] = useState('');
  const deferredMealNameInput = useDeferredValue(mealNameInput);
  const [showMicronutrients, setShowMicronutrients] = useState(false);
  
  // Store original base macros before weight calculations
  const [baseMacros, setBaseMacros] = useState({
    protein: '',
    carbs: '',
    fat: '',
  });

  const assignLogFoodPreciseBasis = useCallback(
    (input: {
      protein: string;
      carbs: string;
      fat: string;
      calories: string;
      micronutrients?: Micronutrients | undefined;
      baseServingSize: string;
      servings: string;
      servingUnit: LogFoodServingUnit;
      referenceGramsPerPiece?: number;
    }) => {
      const macroSum =
        (parseFloat(input.protein) || 0) + (parseFloat(input.carbs) || 0) + (parseFloat(input.fat) || 0);
      if (macroSum <= 0) {
        logFoodPreciseBasisRef.current = null;
        logFoodReferenceGramsPerPieceRef.current = undefined;
        return;
      }
      const refPiece =
        input.referenceGramsPerPiece ??
        (input.servingUnit === 'piece'
          ? logFoodReferenceGramsPerPieceRef.current
          : undefined);
      if (refPiece != null && refPiece > 0) {
        logFoodReferenceGramsPerPieceRef.current = refPiece;
      }
      logFoodPreciseBasisRef.current = buildLogFoodPortionBasis({
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
        calories: input.calories,
        micronutrients: input.micronutrients as Record<string, number | undefined | null> | undefined,
        baseServingSize: input.baseServingSize,
        servings: input.servings,
        servingUnit: input.servingUnit,
        referenceGramsPerPiece: refPiece,
      });
    },
    []
  );

  const updateLogFoodPortion = useCallback(
    (
      updates: Partial<{ baseServingSize: string; servings: string; servingUnit: LogFoodServingUnit }>,
      options?: { convertUnitFrom?: LogFoodServingUnit }
    ) => {
      setMealInput((prev) => {
        let nextBaseServingSize = updates.baseServingSize ?? prev.baseServingSize;
        const nextServingUnit = (updates.servingUnit ?? prev.servingUnit) as LogFoodServingUnit;
        let incompatibleUnitSwitch = false;

        let unitSwitchPreservedMacros = false;

        if (updates.servingUnit && options?.convertUnitFrom) {
          const fromUnit = options.convertUnitFrom;
          const refPiece = logFoodReferenceGramsPerPieceRef.current;
          const { baseServingSize: convertedBase, converted } = convertLogFoodBaseServingForUnitChange(
            prev.baseServingSize,
            prev.servings,
            fromUnit,
            updates.servingUnit,
            refPiece
          );
          nextBaseServingSize = convertedBase;
          if (converted) {
            unitSwitchPreservedMacros = true;
            const totalAmount =
              parseLogFoodPortionAmount(prev.baseServingSize) * parseLogFoodPortionAmount(prev.servings);
            if (updates.servingUnit === 'piece') {
              const fromGrams = logFoodAmountToGrams(totalAmount, fromUnit);
              const pieceCount = parseLogFoodPortionAmount(convertedBase);
              if (fromGrams != null && fromGrams > 0 && pieceCount > 0) {
                logFoodReferenceGramsPerPieceRef.current = fromGrams / pieceCount;
              }
            } else if (fromUnit === 'piece' && refPiece != null && refPiece > 0) {
              logFoodReferenceGramsPerPieceRef.current = refPiece;
            }
          } else {
            incompatibleUnitSwitch = true;
          }
        }

        const next = {
          ...prev,
          ...updates,
          baseServingSize: nextBaseServingSize,
          servingUnit: nextServingUnit,
        };

        if (unitSwitchPreservedMacros) {
          assignLogFoodPreciseBasis({
            protein: prev.protein,
            carbs: prev.carbs,
            fat: prev.fat,
            calories: prev.calories,
            micronutrients: prev.micronutrients,
            baseServingSize: nextBaseServingSize,
            servings: next.servings,
            servingUnit: nextServingUnit,
            referenceGramsPerPiece: logFoodReferenceGramsPerPieceRef.current,
          });
          return next;
        }

        const basis = logFoodPreciseBasisRef.current;
        if (basis && !logFoodMacrosPerWholeRef.current && !incompatibleUnitSwitch) {
          const refPiece = logFoodReferenceGramsPerPieceRef.current;
          const scaled = scaleLogFoodPortionBasis(
            basis,
            {
              baseServingSize: parseFloat(next.baseServingSize) || 1,
              servings: parseFloat(next.servings) || 1,
              servingUnit: next.servingUnit,
            },
            refPiece
          );
          if (scaled) {
            logFoodMacroRecalcLockRef.current = true;
            queueMicrotask(() => {
              logFoodMacroRecalcLockRef.current = false;
            });
            setBaseMacros({
              protein: String(scaled.protein),
              carbs: String(scaled.carbs),
              fat: String(scaled.fat),
            });
            return {
              ...next,
              protein: String(scaled.protein),
              carbs: String(scaled.carbs),
              fat: String(scaled.fat),
              calories: String(scaled.calories),
              micronutrients: scaled.micronutrients as typeof prev.micronutrients,
            };
          }
        }

        if (incompatibleUnitSwitch && basis && !logFoodMacrosPerWholeRef.current) {
          queueMicrotask(() => {
            assignLogFoodPreciseBasis({
              protein: next.protein,
              carbs: next.carbs,
              fat: next.fat,
              calories: next.calories,
              micronutrients: next.micronutrients,
              baseServingSize: next.baseServingSize,
              servings: next.servings,
              servingUnit: next.servingUnit as LogFoodServingUnit,
              referenceGramsPerPiece: logFoodReferenceGramsPerPieceRef.current,
            });
          });
        }

        return next;
      });
    },
    [assignLogFoodPreciseBasis]
  );

  const updateLogFoodNutritionMacro = useCallback(
    (field: 'protein' | 'carbs' | 'fat', text: string) => {
      setMealInput((prev) => {
        const next = { ...prev, [field]: text };
        if (!logFoodMacroRecalcLockRef.current && !logFoodMacrosPerWholeRef.current) {
          assignLogFoodPreciseBasis({
            protein: next.protein,
            carbs: next.carbs,
            fat: next.fat,
            calories: next.calories,
            micronutrients: next.micronutrients,
            baseServingSize: next.baseServingSize,
            servings: next.servings,
            servingUnit: next.servingUnit as LogFoodServingUnit,
          });
        }
        return next;
      });
      setBaseMacros((prev) => ({ ...prev, [field]: text }));
    },
    [assignLogFoodPreciseBasis]
  );

  const logFoodInlineUsda = useFoodSearch({
    enabled: showLogFoodModal && !showBarcodeScanner && !logFoodSavedPickerOpen && !logFoodSuppressInlineSuggest,
    controlledQuery: deferredMealNameInput,
  });

  const logFoodNameMatches = useMemo(
    () =>
      getLogFoodNameMatches(deferredMealNameInput, savedMeals, meals, {
        maxSaved: 12,
        maxHistory: 16,
        maxYourFoods: 14,
      }),
    [deferredMealNameInput, savedMeals, meals]
  );

  /** Frequent / recent foods for empty search — shown as soon as the meal name field is focused. */
  const logFoodQuickPicks = useMemo(
    () =>
      getLogFoodNameMatches('', savedMeals, meals, { maxYourFoods: 14 }).yourFoods,
    [savedMeals, meals]
  );

  const handleLogFoodItemsChange = useCallback((items: LogFoodItem[]) => {
    setLogFoodItems(items);
    const totals = sumLogFoodItemMacros(items);
    setMealInput((prev) => ({
      ...prev,
      protein: String(totals.protein),
      carbs: String(totals.carbs),
      fat: String(totals.fat),
      calories: String(totals.calories),
    }));
    setBaseMacros({
      protein: String(totals.protein),
      carbs: String(totals.carbs),
      fat: String(totals.fat),
    });
  }, []);

  /** Clears meal name search + macros after a meal is logged (fresh sheet next time). */
  const resetLogFoodForm = useCallback(() => {
    setMealNameInput('');
    setMealInput({
      name: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      time: '',
      servings: '1',
      servingUnit: 'piece',
      servingWeight: '',
      baseServingSize: '1',
      micronutrients: undefined,
      nutritionScanNote: undefined,
    });
    setBaseMacros({ protein: '', carbs: '', fat: '' });
    setShowMicronutrients(false);
    setLogFoodSuppressInlineSuggest(false);
    setLogFoodNameInputFocused(false);
    setPortionInputMode('precise');
    setNaturalFraction(1);
    logFoodMacrosPerWholeRef.current = null;
    logFoodPreciseBasisRef.current = null;
    logFoodReferenceGramsPerPieceRef.current = undefined;
    setLogFoodEditingMealId(null);
    setAiMealQuery('');
    setAiMealError(null);
    setAiMealEstimate(null);
    setAiMealLoading(false);
    setLogFoodItems([]);
  }, []);

  const defaultSlotNow = (): MealSlot => {
    const h = new Date().getHours();
    if (h < 11) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 21) return 'dinner';
    return 'snacks';
  };

  const inferMealSlot = (meal: Meal): MealSlot => {
    if (meal.mealSlot) return meal.mealSlot;
    const n = meal.name.toLowerCase();
    if (/\b(breakfast|brunch)\b/.test(n)) return 'breakfast';
    if (/\blunch\b/.test(n)) return 'lunch';
    if (/\b(dinner|supper)\b/.test(n)) return 'dinner';
    if (/\bsnack\b/.test(n)) return 'snacks';
    const h = new Date(meal.date).getHours();
    if (h < 11) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 21) return 'dinner';
    return 'snacks';
  };

  /** When set, Log Food "Add to log" updates this meal id instead of inserting a new row. */
  const [logFoodEditingMealId, setLogFoodEditingMealId] = useState<string | null>(null);

  const deleteMeal = async (mealId: string) => {
    const list = await deleteLoggedMeal(mealId);
    if (list) setMeals(list as Meal[]);
  };

  const startCopyMealToDay = (meal: Meal) => {
    setDayCopyPending(null);
    setMealCopyPending(meal);
    if (activeTab !== 'history') {
      setActiveTab('history');
    }
    showNotification({
      title: 'Copy meal',
      lines: [`Tap any day on the calendar to copy “${meal.name}”.`],
      type: 'info',
      persistent: true,
      onDismiss: () => setMealCopyPending(null),
      actions: [{ label: 'Cancel', style: 'cancel', onPress: () => setMealCopyPending(null) }],
    });
  };

  const startCopyAllMealsFromDay = (sourceDateKey: string, mealCount: number) => {
    setMealCopyPending(null);
    setDayCopyPending(sourceDateKey);
    showNotification({
      title: 'Copy all meals',
      lines: [
        `Tap a day on the calendar to copy all ${mealCount} meal${mealCount === 1 ? '' : 's'} from this day.`,
      ],
      type: 'info',
      persistent: true,
      onDismiss: () => setDayCopyPending(null),
      actions: [{ label: 'Cancel', style: 'cancel', onPress: () => setDayCopyPending(null) }],
    });
  };

  const completeMealCopyToDay = async (targetDateKey: string) => {
    if (mealCopyPending) {
      const name = mealCopyPending.name;
      const result = await duplicateLoggedMealToDate(mealCopyPending.id, targetDateKey);
      setMealCopyPending(null);
      if (!result) {
        showToast('That meal was not found.', 'error');
        return;
      }
      setMeals(result.meals as Meal[]);
      setSelectedCalendarDate(targetDateKey);
      setExpandedDayItems(new Set([`nutrition-${targetDateKey}`]));
      showToast(`“${name}” copied to ${formatHistoryDateLabel(targetDateKey)}.`, 'success', 3500);
      return;
    }

    if (dayCopyPending) {
      if (targetDateKey === dayCopyPending) {
        showToast('Pick a different day to copy meals to.', 'info', 3000);
        return;
      }
      const result = await duplicateMealsFromDayToDate(dayCopyPending, targetDateKey);
      setDayCopyPending(null);
      if (!result) {
        showToast('No meals found to copy from that day.', 'error');
        return;
      }
      setMeals(result.meals as Meal[]);
      setSelectedCalendarDate(targetDateKey);
      setExpandedDayItems(new Set([`nutrition-${targetDateKey}`]));
      showToast(
        `${result.copies.length} meal${result.copies.length === 1 ? '' : 's'} copied to ${formatHistoryDateLabel(targetDateKey)}.`,
        'success',
        3500
      );
    }
  };

  const formatHistoryDateLabel = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const openMealInLogFoodForEdit = (meal: Meal) => {
    Keyboard.dismiss();
    const storedServings = Math.max(parseFloat(String(meal.servings ?? 1)) || 1, 0.0001);
    const totalProtein = Number(meal.protein) || 0;
    const totalCarbs = Number(meal.carbs) || 0;
    const totalFat = Number(meal.fat) || 0;
    const calFromStored =
      meal.calories > 0 && Number.isFinite(meal.calories)
        ? meal.calories
        : calculateCaloriesFromMacros(
            Math.round(totalProtein),
            Math.round(totalCarbs),
            Math.round(totalFat)
          );

    let microsForForm: Micronutrients | undefined;
    if (meal.micronutrients) {
      microsForForm = {};
      (Object.keys(meal.micronutrients) as (keyof Micronutrients)[]).forEach((key) => {
        const v = meal.micronutrients![key];
        if (v !== undefined && v !== null && typeof v === 'number') {
          (microsForForm as Micronutrients)[key] = v;
        }
      });
      if (Object.keys(microsForForm).length === 0) microsForForm = undefined;
    }

    const rawU = String(meal.servingUnit || 'piece').toLowerCase();
    const servingUnit: LogFoodServingUnit = isLogFoodServingUnit(rawU) ? rawU : 'piece';
    const storedPortionAmount =
      meal.servingAmount != null && parseFloat(String(meal.servingAmount)) > 0
        ? parseFloat(String(meal.servingAmount))
        : storedServings;
    const perServingSize = storedPortionAmount / storedServings;
    const baseServingSizeStr =
      Math.abs(perServingSize - Math.round(perServingSize)) < 0.001
        ? String(Math.round(perServingSize))
        : String(Math.round(perServingSize * 10) / 10);

    setLogFoodEditingMealId(meal.id);
    setMealSlotSheet(null);
    setPortionInputMode('precise');
    setNaturalFraction(1);
    logFoodMacrosPerWholeRef.current = null;
    setLogFoodSlot(meal.mealSlot ?? inferMealSlot(meal));
    setLogFoodSuppressInlineSuggest(true);
    setMealNameInput(meal.name);
    const editInput = {
      name: meal.name,
      calories: String(calFromStored),
      protein: String(Math.round(totalProtein * 10) / 10),
      carbs: String(Math.round(totalCarbs * 10) / 10),
      fat: String(Math.round(totalFat * 10) / 10),
      time: meal.time || new Date().toLocaleTimeString(),
      servings: String(storedServings),
      servingUnit,
      servingWeight: meal.servingAmount != null ? String(meal.servingAmount) : '',
      baseServingSize: baseServingSizeStr,
      micronutrients: microsForForm,
      nutritionScanNote: 'Editing this logged meal — adjust amounts, then save.',
    };
    setMealInput(editInput);
    setBaseMacros({
      protein: editInput.protein,
      carbs: editInput.carbs,
      fat: editInput.fat,
    });
    setLogFoodItems(meal.items?.length ? meal.items.map((item) => ({ ...item })) : []);
    assignLogFoodPreciseBasis({
      protein: editInput.protein,
      carbs: editInput.carbs,
      fat: editInput.fat,
      calories: editInput.calories,
      micronutrients: editInput.micronutrients,
      baseServingSize: editInput.baseServingSize,
      servings: editInput.servings,
      servingUnit: editInput.servingUnit as LogFoodServingUnit,
    });
    setShowMicronutrients(!!meal.micronutrients && Object.values(meal.micronutrients).some((x) => x != null));
    setShowLogFoodModal(true);
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

  /** Preserve sub-1 mg amounts when scaling for servings / display (matches food scan precision). */
  const roundScaledMicro = (n: number): number => {
    const a = Math.abs(n);
    if (a < 0.01) return Math.round(n * 10000) / 10000;
    if (a < 1) return Math.round(n * 1000) / 1000;
    if (a < 100) return Math.round(n * 100) / 100;
    return Math.round(n * 10) / 10;
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
    const baseLogSize = parseFloat(mealInput.baseServingSize) || 1;
    const totalPortionAmount = Math.round(baseLogSize * servings * 10) / 10;
    const itemTotals = logFoodItems.length > 0 ? sumLogFoodItemMacros(logFoodItems) : null;
    const totalProtein = Math.round(itemTotals?.protein ?? (parseFloat(mealInput.protein) || 0));
    const totalCarbs = Math.round(itemTotals?.carbs ?? (parseFloat(mealInput.carbs) || 0));
    const totalFat = Math.round(itemTotals?.fat ?? (parseFloat(mealInput.fat) || 0));
    const baseProtein = servings > 0 ? Math.round((totalProtein / servings) * 10) / 10 : totalProtein;
    const baseCarbs = servings > 0 ? Math.round((totalCarbs / servings) * 10) / 10 : totalCarbs;
    const baseFat = servings > 0 ? Math.round((totalFat / servings) * 10) / 10 : totalFat;
    const calculatedCalories = calculateCaloriesFromMacros(totalProtein, totalCarbs, totalFat);

    // Ensure date is set to today for proper filtering
    const todayDate = new Date();
    const mealName =
      mealNameInput.trim() ||
      mealInput.name?.trim() ||
      `Meal (${totalProtein}g P / ${totalCarbs}g C / ${totalFat}g F)`;
    
    const storedMicronutrients = mealInput.micronutrients;

    if (logFoodEditingMealId) {
      const existing = meals.find((m) => m.id === logFoodEditingMealId);
      const prevDate = existing?.date ?? todayDate.toISOString();
      const sw = mealInput.servingWeight?.trim();
      const patch = {
        name: mealName,
        protein: totalProtein,
        carbs: totalCarbs,
        fat: totalFat,
        time: mealInput.time?.trim() || existing?.time || todayDate.toLocaleTimeString(),
        date: prevDate,
        servings,
        baseProtein,
        baseCarbs,
        baseFat,
        micronutrients: storedMicronutrients,
        mealSlot: logFoodSlot,
        servingAmount: totalPortionAmount > 0 ? String(totalPortionAmount) : sw && sw.length > 0 ? sw : undefined,
        servingUnit: mealInput.servingUnit || undefined,
        items: logFoodItems.length > 0 ? logFoodItems : undefined,
      };
      try {
        const list = await updateLoggedMeal(logFoodEditingMealId, patch);
        if (!list) {
          Alert.alert('Could not save', 'This meal was not found. It may have been removed already.');
          return;
        }
        setMeals(list as Meal[]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert('Could not save meal', msg);
        return;
      }

      let nextSavedTemplates: SavedMeal[] = [];
      setSavedMeals((prev) => {
        nextSavedTemplates = applySavedMealUpsert(
          prev,
          mealName,
          {
            calories: Math.round(calculatedCalories),
            protein: totalProtein,
            carbs: totalCarbs,
            fat: totalFat,
          },
          {
            bumpUsesOnMatch: true,
            portion: {
              lastServingUnit: mealInput.servingUnit,
              lastBaseServingSize: mealInput.baseServingSize,
              lastServings: mealInput.servings,
              lastServingAmount: totalPortionAmount > 0 ? String(totalPortionAmount) : undefined,
            },
          }
        );
        return nextSavedTemplates;
      });
      try {
        await saveSavedMeals(nextSavedTemplates);
      } catch {
        // Non-blocking — meal log already saved.
      }

      resetLogFoodForm();
      setShowLogFoodModal(false);
      return;
    }

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
      micronutrients: storedMicronutrients,
      mealSlot: logFoodSlot,
      servingAmount: totalPortionAmount > 0 ? String(totalPortionAmount) : undefined,
      servingUnit: mealInput.servingUnit || undefined,
      items: logFoodItems.length > 0 ? logFoodItems : undefined,
    };

    let updatedMealsSnapshot: Meal[] = [];
    setMeals((prev) => {
      updatedMealsSnapshot = [newMeal, ...prev];
      return updatedMealsSnapshot;
    });

    try {
      await saveMeals(updatedMealsSnapshot);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not save meal', msg);
      setMeals((prev) => prev.filter((m) => m.id !== newMeal.id));
      return;
    }

    let nextSavedTemplates: SavedMeal[] = [];
    setSavedMeals((prev) => {
      nextSavedTemplates = applySavedMealUpsert(
        prev,
        mealName,
        {
          calories: Math.round(calculatedCalories),
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
        },
        {
          bumpUsesOnMatch: true,
          portion: {
            lastServingUnit: mealInput.servingUnit,
            lastBaseServingSize: mealInput.baseServingSize,
            lastServings: mealInput.servings,
            lastServingAmount: totalPortionAmount > 0 ? String(totalPortionAmount) : undefined,
          },
        }
      );
      return nextSavedTemplates;
    });
    try {
      await saveSavedMeals(nextSavedTemplates);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not update saved meals', msg);
    }

    resetLogFoodForm();
    setShowLogFoodModal(false);
    // no notification
  };

  const handleSaveMeal = async () => {
    // Save meal requires a name and macros
    if (!mealNameInput.trim()) {
      // no notification
      return;
    }

    if (!mealInput.protein || !mealInput.carbs || !mealInput.fat) {
      // no notification
      return;
    }

    const servings = parseFloat(mealInput.servings) || 1;
    const baseLogSize = parseFloat(mealInput.baseServingSize) || 1;
    const totalPortionAmount = Math.round(baseLogSize * servings * 10) / 10;
    const itemTotals = logFoodItems.length > 0 ? sumLogFoodItemMacros(logFoodItems) : null;
    const totalProtein = Math.round(itemTotals?.protein ?? (parseFloat(mealInput.protein) || 0));
    const totalCarbs = Math.round(itemTotals?.carbs ?? (parseFloat(mealInput.carbs) || 0));
    const totalFat = Math.round(itemTotals?.fat ?? (parseFloat(mealInput.fat) || 0));
    const calculatedCalories = calculateCaloriesFromMacros(totalProtein, totalCarbs, totalFat);

    let nextSaved: SavedMeal[] = [];
    setSavedMeals((prev) => {
      nextSaved = applySavedMealUpsert(
        prev,
        mealNameInput.trim(),
        {
          calories: Math.round(calculatedCalories),
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
        },
        {
          bumpUsesOnMatch: true,
          portion: {
            lastServingUnit: mealInput.servingUnit,
            lastBaseServingSize: mealInput.baseServingSize,
            lastServings: mealInput.servings,
            lastServingAmount: totalPortionAmount > 0 ? String(totalPortionAmount) : undefined,
          },
        }
      );
      return nextSaved;
    });
    try {
      await saveSavedMeals(nextSaved);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not save favorite', msg);
    }

    // Clear meal name and macros after saving
    setMealNameInput('');
    setMealInput((prev) => ({
      ...prev,
      name: '',
      protein: '',
      carbs: '',
      fat: '',
      servings: '1',
      nutritionScanNote: undefined,
    }));
    // no notification
  };

  const handleUseSavedMeal = async (savedMeal: SavedMeal, slot?: MealSlot) => {
    const mealSlot = slot ?? defaultSlotNow();
    const storedServings = Math.max(parseFloat(savedMeal.lastServings || '1') || 1, 0.0001);
    const newMeal: Meal = {
      id: Date.now().toString(),
      name: savedMeal.name,
      calories: savedMeal.calories,
      protein: savedMeal.protein,
      carbs: savedMeal.carbs,
      fat: savedMeal.fat,
      time: new Date().toLocaleTimeString(),
      date: new Date().toISOString(),
      servings: storedServings,
      baseProtein: storedServings > 0 ? Math.round((savedMeal.protein / storedServings) * 10) / 10 : savedMeal.protein,
      baseCarbs: storedServings > 0 ? Math.round((savedMeal.carbs / storedServings) * 10) / 10 : savedMeal.carbs,
      baseFat: storedServings > 0 ? Math.round((savedMeal.fat / storedServings) * 10) / 10 : savedMeal.fat,
      mealSlot,
      servingAmount: savedMeal.lastServingAmount,
      servingUnit: savedMeal.lastServingUnit,
    };

    let updatedTodayMeals: Meal[] = [];
    setMeals((prev) => {
      updatedTodayMeals = [newMeal, ...prev];
      return updatedTodayMeals;
    });

    // Update saved meal usage (functional update so list matches latest state)
    let updatedSavedMeals: SavedMeal[] = [];
    setSavedMeals((prev) => {
      updatedSavedMeals = prev.map((meal) =>
        meal.id === savedMeal.id
          ? { ...meal, timesUsed: meal.timesUsed + 1, lastUsed: new Date().toISOString() }
          : meal
      );
      return updatedSavedMeals;
    });

    try {
      await Promise.all([saveMeals(updatedTodayMeals), saveSavedMeals(updatedSavedMeals)]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not save', msg);
    }

    setLogFoodSavedPickerOpen(false);
    resetLogFoodForm();
    setShowLogFoodModal(false);
    // no notification
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
      water: parseInt(editGoals.water),
      derivedFrom: 'manual' as const,
    };
    setNutritionGoals(newGoals);
    await saveNutritionGoals(newGoals);
    // no notification
  };

  const handleCancelEdit = () => {
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

  const applyDatabaseFoodToLogFoodForm = useCallback(
    (payload: LogFoodFormDatabasePayload) => {
      Keyboard.dismiss();
      if (logFoodNameBlurTimerRef.current) {
        clearTimeout(logFoodNameBlurTimerRef.current);
        logFoodNameBlurTimerRef.current = null;
      }
      setLogFoodNameInputFocused(false);
      setLogFoodSuppressInlineSuggest(true);
      setPortionInputMode('precise');
      setNaturalFraction(1);
      logFoodMacrosPerWholeRef.current = null;
      if (payload.referenceGramsPerPiece != null && payload.referenceGramsPerPiece > 0) {
        logFoodReferenceGramsPerPieceRef.current = payload.referenceGramsPerPiece;
      } else {
        logFoodReferenceGramsPerPieceRef.current = undefined;
      }
      setMealNameInput(payload.name);
      const formInput = {
        name: payload.name,
        calories: payload.calories,
        protein: payload.protein,
        carbs: payload.carbs,
        fat: payload.fat,
        time: payload.time,
        servings: payload.servings,
        servingUnit: payload.servingUnit,
        servingWeight: payload.servingWeight,
        baseServingSize: payload.baseServingSize,
        micronutrients: payload.micronutrients,
        nutritionScanNote: payload.nutritionScanNote,
      };
      setMealInput(formInput);
      setBaseMacros({ protein: payload.protein, carbs: payload.carbs, fat: payload.fat });
      assignLogFoodPreciseBasis({
        protein: payload.protein,
        carbs: payload.carbs,
        fat: payload.fat,
        calories: payload.calories,
        micronutrients: payload.micronutrients,
        baseServingSize: payload.baseServingSize,
        servings: payload.servings,
        servingUnit: payload.servingUnit,
        referenceGramsPerPiece: payload.referenceGramsPerPiece,
      });
      setShowMicronutrients(false);
      setShowLogFoodModal(true);
      setLogFoodSlot((slot) => slot ?? defaultSlotNow());
      requestAnimationFrame(() => {
        const y = logFoodNutritionSectionY.current;
        logFoodScrollRef.current?.scrollTo({ y: y > 8 ? Math.max(0, y - 12) : 240, animated: false });
      });
    },
    [assignLogFoodPreciseBasis]
  );

  const applyUsdaHitToLogFoodForm = useCallback(
    async (hit: FoodSearchHit) => {
      setLogFoodDatabaseLoading(true);
      try {
        const food = await getFoodDetails(hit.fdcId);
        applyDatabaseFoodToLogFoodForm(
          buildLogFoodFormFromFdcFood(food, {
            defaultPortionGrams: 100,
            hitDescription: hit.description,
          })
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert('Could not load food', msg);
      } finally {
        setLogFoodDatabaseLoading(false);
      }
    },
    [applyDatabaseFoodToLogFoodForm]
  );

  const handleFoodScanned = (scannedFood: any) => {
    if (!isScannedFoodUsable(scannedFood)) {
      setShowBarcodeScanner(false);
      showNotification({
        title: 'Product not in database',
        lines: [
          scannedFood?.name
            ? `"${String(scannedFood.name)}" was found but has no nutrition data on file.`
            : 'No nutrition data was found for that barcode.',
          'Search by food name or enter macros manually from the package label.',
        ],
        type: 'warning',
        durationMs: 7000,
        actions: [{ label: 'OK' }],
      });
      return;
    }
    const su = scannedFood.servingUnit;
    const p = scannedFood.protein != null ? String(scannedFood.protein) : '';
    const c = scannedFood.carbs != null ? String(scannedFood.carbs) : '';
    const f = scannedFood.fat != null ? String(scannedFood.fat) : '';
    const refG =
      typeof scannedFood.referenceGrams === 'number' && Number.isFinite(scannedFood.referenceGrams) && scannedFood.referenceGrams > 0
        ? scannedFood.referenceGrams
        : null;
    const gramPortion =
      refG ??
      (su === 'g' &&
      scannedFood.servingWeight != null &&
      Number.isFinite(Number(scannedFood.servingWeight)) &&
      Number(scannedFood.servingWeight) > 0
        ? Number(scannedFood.servingWeight)
        : null);
    const useGramPortion = gramPortion != null && gramPortion > 0;
    const portionStr =
      useGramPortion && gramPortion != null ? String(Math.round(gramPortion * 10) / 10) : '';
    const sw = useGramPortion
      ? portionStr
      : scannedFood.servingWeight != null && Number.isFinite(Number(scannedFood.servingWeight))
        ? String(scannedFood.servingWeight)
        : '';
    const bs = useGramPortion
      ? portionStr
      : scannedFood.baseServingSize != null && Number.isFinite(Number(scannedFood.baseServingSize))
        ? String(scannedFood.baseServingSize)
        : '1';
    const resolvedUnit: LogFoodServingUnit =
      useGramPortion ? 'g' : isLogFoodServingUnit(String(su).toLowerCase()) ? (String(su).toLowerCase() as LogFoodServingUnit) : 'piece';
    const referenceGramsPerPiece =
      resolvedUnit === 'piece' && refG != null && refG > 0 ? refG : undefined;
    const scanNote = typeof scannedFood.nutritionNote === 'string' ? scannedFood.nutritionNote : '';
    const portionHint = useGramPortion ? `Macros apply to ${portionStr} g (one label portion).` : '';
    const nutritionScanNote =
      [scanNote, portionHint, 'Adjust serving size, units, and macros below, then tap Add to log.']
        .filter(Boolean)
        .join(' ') || undefined;
    const scannedMicros = scannedFood.micronutrients as Micronutrients | undefined;

    applyDatabaseFoodToLogFoodForm({
      name: scannedFood.name || '',
      calories: scannedFood.calories?.toString() || '0',
      protein: p,
      carbs: c,
      fat: f,
      time: new Date().toLocaleTimeString(),
      servings: '1',
      servingUnit: resolvedUnit,
      servingWeight: sw || '0',
      baseServingSize: bs,
      micronutrients: scannedMicros,
      nutritionScanNote: nutritionScanNote ?? 'From label scan.',
      referenceGramsPerPiece,
    });
    setLogFoodSlot(defaultSlotNow());
    setShowBarcodeScanner(false);
  };

  const handleBarcodeScanNotFound = useCallback(
    (barcode: string) => {
      setShowBarcodeScanner(false);
      showNotification({
        title: 'Product not in database',
        lines: [
          `No nutrition data was found for barcode ${barcode}.`,
          'Search by food name or enter macros manually from the package label.',
        ],
        type: 'warning',
        durationMs: 7000,
        actions: [{ label: 'OK' }],
      });
    },
    [showNotification]
  );

  const handleBarcodeScanError = useCallback(
    (_barcode: string) => {
      setShowBarcodeScanner(false);
      showNotification({
        title: 'Barcode lookup failed',
        lines: [
          'Could not look up this barcode. Check your connection and try again, or add the food manually.',
        ],
        type: 'error',
        durationMs: 6000,
        actions: [{ label: 'OK' }],
      });
    },
    [showNotification]
  );

  const scrollLogFoodToNutrition = useCallback(() => {
    const y = logFoodNutritionSectionY.current;
    const targetY = y > 8 ? Math.max(0, y - 12) : 240;
    // Immediate jump avoids delayed, perceivable lag.
    logFoodScrollRef.current?.scrollTo({ y: targetY, animated: false });
  }, []);

  const setNutritionLoggingModeWithPersist = useCallback((mode: NutritionLoggingMode) => {
    setNutritionLoggingMode(mode);
    void saveNutritionLoggingMode(mode);
  }, []);

  useEffect(() => {
    if (!tourLogFoodIntent) return;
    if (!tourLogFoodIntent.open) {
      setShowLogFoodModal(false);
      return;
    }
    setLogFoodSlot(defaultSlotNow());
    setShowLogFoodModal(true);
    if (tourLogFoodIntent.mode) {
      setNutritionLoggingModeWithPersist(tourLogFoodIntent.mode);
    }
  }, [tourLogFoodIntent, setNutritionLoggingModeWithPersist]);

  useEffect(() => {
    if (!tourFitnessIntent) return;
    if (tourFitnessIntent.closeAll) {
      setShowWorkoutScreen(false);
      setShowBuildYourOwnScreen(false);
      setSelectedSavedPlan(null);
      setSelectedProgram(null);
      setWorkoutQuickPanel(null);
      setPlanToEdit(null);
      tourPlanPreviewPendingRef.current = false;
      return;
    }
    if (tourFitnessIntent.myPlansPanel) {
      setShowWorkoutScreen(false);
      setShowBuildYourOwnScreen(false);
      setSelectedSavedPlan(null);
      setSelectedProgram(null);
      setPlanToEdit(null);
      setWorkoutQuickPanel('myPlans');
    }
    if (tourFitnessIntent.buildWorkout) {
      setShowWorkoutScreen(false);
      setSelectedSavedPlan(null);
      setSelectedProgram(null);
      setWorkoutQuickPanel(null);
      setPlanToEdit(null);
      setShowBuildYourOwnScreen(true);
    }
    if (tourFitnessIntent.aiWorkout) {
      setShowBuildYourOwnScreen(false);
      setSelectedSavedPlan(null);
      setSelectedProgram(null);
      setWorkoutQuickPanel(null);
      setShowWorkoutScreen(true);
    }
    if (tourFitnessIntent.planPreview) {
      setShowWorkoutScreen(false);
      setShowBuildYourOwnScreen(false);
      setWorkoutQuickPanel(null);
      setPlanToEdit(null);
      tourPlanPreviewPendingRef.current = true;
      const plan =
        savedWorkoutPlans.find((p) => activePlans.includes(p.id)) ?? savedWorkoutPlans[0] ?? null;
      if (plan) {
        setSelectedSavedPlan(plan);
        tourPlanPreviewPendingRef.current = false;
      }
    }
  }, [tourFitnessIntent, savedWorkoutPlans, activePlans]);

  useEffect(() => {
    if (!tourPlanPreviewPendingRef.current || selectedSavedPlan) return;
    const plan =
      savedWorkoutPlans.find((p) => activePlans.includes(p.id)) ?? savedWorkoutPlans[0] ?? null;
    if (plan) {
      setSelectedSavedPlan(plan);
      tourPlanPreviewPendingRef.current = false;
    }
  }, [savedWorkoutPlans, activePlans, selectedSavedPlan]);

  useEffect(() => {
    const scrollLogFoodTop = () => {
      logFoodScrollRef.current?.scrollTo({ y: 0, animated: false });
    };
    registerTourTargetScroll(TOUR_TARGET_IDS.logFoodModePrecision, scrollLogFoodTop);
    registerTourTargetScroll(TOUR_TARGET_IDS.logFoodModeAi, scrollLogFoodTop);
    registerTourTargetScroll(TOUR_TARGET_IDS.logFoodMealName, scrollLogFoodTop);
    registerTourTargetScroll(TOUR_TARGET_IDS.logFoodAiInput, scrollLogFoodTop);
    registerTourTargetScroll(TOUR_TARGET_IDS.nutritionLogFood, () => undefined);
    return () => {
      registerTourTargetScroll(TOUR_TARGET_IDS.logFoodModePrecision, null);
      registerTourTargetScroll(TOUR_TARGET_IDS.logFoodModeAi, null);
      registerTourTargetScroll(TOUR_TARGET_IDS.logFoodMealName, null);
      registerTourTargetScroll(TOUR_TARGET_IDS.logFoodAiInput, null);
      registerTourTargetScroll(TOUR_TARGET_IDS.nutritionLogFood, null);
    };
  }, []);

  const applyAiMealEstimateToForm = useCallback(
    (estimate: AiMealEstimate, userQuery: string) => {
      const p = Math.round(estimate.protein_g * 10) / 10;
      const c = Math.round(estimate.carbs_g * 10) / 10;
      const f = Math.round(estimate.fat_g * 10) / 10;
      const cal =
        estimate.calories > 0
          ? Math.round(estimate.calories)
          : Math.round(p * 4 + c * 4 + f * 9);
      const logName = formatAiMealLogName(estimate, userQuery);
      const confidenceLabel =
        estimate.confidence === 'high'
          ? 'High confidence'
          : estimate.confidence === 'low'
            ? 'Rough estimate'
            : 'Approximate';
      const noteParts = [
        `AI estimate (${confidenceLabel}).`,
        estimate.assumptions.trim(),
        'Review and edit macros below before adding to your log.',
      ].filter(Boolean);

      Keyboard.dismiss();
      setLogFoodSuppressInlineSuggest(true);
      setMealNameInput(logName);
      const aiInput = {
        name: logName,
        calories: String(cal),
        protein: String(p),
        carbs: String(c),
        fat: String(f),
        time: new Date().toLocaleTimeString(),
        servings: '1',
        servingUnit: 'piece' as LogFoodServingUnit,
        servingWeight: '1',
        baseServingSize: '1',
        micronutrients: undefined as Micronutrients | undefined,
        nutritionScanNote: noteParts.join(' '),
      };
      setMealInput(aiInput);
      setBaseMacros({ protein: String(p), carbs: String(c), fat: String(f) });
      assignLogFoodPreciseBasis(aiInput);
      setShowMicronutrients(false);
      handleLogFoodItemsChange(logFoodItemsFromAiEstimate(estimate));
      scrollLogFoodToNutrition();
    },
    [assignLogFoodPreciseBasis, handleLogFoodItemsChange, scrollLogFoodToNutrition]
  );

  const submitAiMealEstimate = useCallback(async () => {
    if (!isPremium) {
      presentUpgrade();
      return;
    }
    if (!isGeminiApiKeyConfigured()) {
      setAiMealError(getGeminiSetupHint());
      return;
    }
    const q = aiMealQuery.trim();
    if (!q) {
      Alert.alert('Describe your meal', 'Example: Chipotle chicken bowl with rice and black beans');
      return;
    }
    setAiMealLoading(true);
    setAiMealError(null);
    setAiMealEstimate(null);
    try {
      const estimate = await getAiMealEstimateFromDescription(q);
      if (estimate.parseWarning && estimate.protein_g <= 0 && estimate.carbs_g <= 0 && estimate.fat_g <= 0) {
        setAiMealError(estimate.parseWarning);
        setAiMealEstimate(estimate);
        return;
      }
      setAiMealEstimate(estimate);
      applyAiMealEstimateToForm(estimate, q);
    } catch (e) {
      if (e instanceof PremiumRequiredError) {
        presentUpgrade();
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      setAiMealError(msg);
    } finally {
      setAiMealLoading(false);
    }
  }, [aiMealQuery, applyAiMealEstimateToForm, isPremium, presentUpgrade]);

  const applyLogFoodYourFoodMatch = useCallback(
    (row: LogFoodYourFoodMatch) => {
      if (logFoodNameBlurTimerRef.current) {
        clearTimeout(logFoodNameBlurTimerRef.current);
        logFoodNameBlurTimerRef.current = null;
      }
      Keyboard.dismiss();
      setLogFoodNameInputFocused(false);
      setLogFoodSuppressInlineSuggest(true);
      setMealNameInput(row.name);
      const p = Number(row.protein) || 0;
      const c = Number(row.carbs) || 0;
      const f = Number(row.fat) || 0;
      const cal =
        Number(row.calories) > 0 && Number.isFinite(Number(row.calories))
          ? Math.round(Number(row.calories))
          : Math.round(p * 4 + c * 4 + f * 9);
      const rawU = String(row.servingUnit || '').toLowerCase();
      const hasPortion = !!(row.baseServingSize && row.servingUnit);
      const servingUnit: LogFoodServingUnit =
        hasPortion && isLogFoodServingUnit(rawU) ? rawU : 'piece';
      const useCount = row.timesUsed > 0 ? row.timesUsed : row.logCount;
      const foodInput = {
        name: row.name,
        calories: String(cal),
        protein: String(p),
        carbs: String(c),
        fat: String(f),
        time: new Date().toLocaleTimeString(),
        servings: row.servings ?? '1',
        servingUnit,
        servingWeight: row.servingAmount ?? row.baseServingSize ?? '1',
        baseServingSize: row.baseServingSize ?? '1',
        micronutrients: undefined as Micronutrients | undefined,
        nutritionScanNote: `Remembered food · logged ${useCount}×. Adjust if needed, then tap Add to log.`,
      };
      setMealInput((prev) => ({ ...prev, ...foodInput }));
      setBaseMacros({ protein: foodInput.protein, carbs: foodInput.carbs, fat: foodInput.fat });
      assignLogFoodPreciseBasis({
        protein: foodInput.protein,
        carbs: foodInput.carbs,
        fat: foodInput.fat,
        calories: foodInput.calories,
        micronutrients: foodInput.micronutrients,
        baseServingSize: foodInput.baseServingSize,
        servings: foodInput.servings,
        servingUnit: foodInput.servingUnit,
      });
      setShowMicronutrients(false);
      scrollLogFoodToNutrition();
    },
    [scrollLogFoodToNutrition, assignLogFoodPreciseBasis]
  );

  const applyLogFoodSavedTemplate = useCallback(
    (row: LogFoodSavedMatch) => {
      applyLogFoodYourFoodMatch({
        kind: 'saved',
        id: row.id,
        name: row.name,
        calories: row.calories,
        protein: row.protein,
        carbs: row.carbs,
        fat: row.fat,
        timesUsed: row.timesUsed,
        lastUsed: row.lastUsed,
        logCount: row.timesUsed,
        score: 0,
        servingUnit: row.servingUnit,
        baseServingSize: row.baseServingSize,
        servings: row.servings,
        servingAmount: row.servingAmount,
      });
    },
    [applyLogFoodYourFoodMatch]
  );

  const applyLogFoodHistoryTemplate = useCallback(
    (row: LogFoodHistoryMatch) => {
      applyLogFoodYourFoodMatch({
        kind: 'history',
        id: row.id,
        name: row.name,
        calories: row.calories,
        protein: row.protein,
        carbs: row.carbs,
        fat: row.fat,
        timesUsed: 0,
        lastUsed: row.date,
        logCount: row.logCount,
        score: 0,
        servingUnit: row.servingUnit,
        baseServingSize: row.baseServingSize,
        servings: row.servings,
        servingAmount: row.servingAmount,
      });
    },
    [applyLogFoodYourFoodMatch]
  );

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

  const renderWorkouts = () => {
    const categories = [
      { id: 'strength', name: 'Strength', key: 'strength' as const },
      { id: 'muscle_building', name: 'Muscle Building', key: 'muscle_building' as const },
      { id: 'cardio', name: 'Cardio', key: 'cardio' as const },
      { id: 'bodyweight', name: 'Bodyweight', key: 'bodyweight' as const },
    ];

    const availableCategories = [...new Set(workoutPrograms.map((p) => p.category))];
    const filteredPrograms = selectedCategory
      ? workoutPrograms.filter((p) => p.category === selectedCategory)
      : workoutPrograms;

    const currentPlans = savedWorkoutPlans.filter((plan) => activePlans.includes(plan.id));
    const primaryPlan = currentPlans[0] ?? null;

    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = weekdayNames[new Date().getDay()];

    const getTodayWeekDay = (plan: any) => {
      const days = plan?.weeklyPlan?.weekDays;
      if (!days?.length) return null;
      const match = days.find(
        (d: any) => d.dayName && String(d.dayName).toLowerCase() === todayName.toLowerCase()
      );
      return match || days[0];
    };

    const getWorkoutPreviewForPlan = (plan: any) => {
      const lines: { name: string; detail: string }[] = [];
      let duration = typeof plan.duration === 'number' ? plan.duration : 45;
      const wd = getTodayWeekDay(plan);
      if (wd?.exercises?.length) {
        wd.exercises.forEach((e: any) => {
          const sets = e.sets ?? e.targetSets ?? '?';
          const reps = e.reps ?? e.targetReps ?? '?';
          lines.push({ name: e.name, detail: `${sets}×${reps}` });
        });
        if (wd.duration) duration = wd.duration;
      } else if (Array.isArray(plan.exercises)) {
        plan.exercises.forEach((e: any) => {
          lines.push({
            name: e.name,
            detail: `${e.sets ?? '?'}×${e.reps ?? '?'}`,
          });
        });
      }
      return {
        exercises: lines,
        duration,
        dayName: wd?.dayName as string | undefined,
        exerciseCount: lines.length,
      };
    };

    const preview = primaryPlan ? getWorkoutPreviewForPlan(primaryPlan) : null;
    const goalLabel = primaryPlan
      ? String(primaryPlan.goal || 'strength').replace(/_/g, ' ')
      : '';
    const splitLabel =
      primaryPlan?.name ||
      (savedWorkoutPlans.length ? 'Your saved plans' : 'Add a plan');
    const heroSubtitle = primaryPlan
      ? `${preview?.dayName || 'Workout'} · ${goalLabel} · ${splitLabel}`
      : 'Set an active plan or pick a template below';
    const durationMin = preview?.duration ?? 0;
    const exCount = preview?.exerciseCount ?? 0;
    const kcalEst = durationMin > 0 ? Math.round(durationMin * 7) : 0;

    const getNextDayLabel = (plan: any) => {
      const days = plan?.weeklyPlan?.weekDays;
      if (!days?.length) return null;
      const idx = days.findIndex(
        (d: any) => d.dayName && String(d.dayName).toLowerCase() === todayName.toLowerCase()
      );
      const cur = idx >= 0 ? idx : 0;
      const next = days[(cur + 1) % days.length];
      return next?.dayName ? `Next: ${next.dayName}` : null;
    };

    const planProgressPct = (plan: any) => {
      const totalDays = Math.max(
        1,
        plan.weeklyPlan?.weekDays?.length || plan.daysPerWeek || 4
      );
      const done = workoutHistory.filter((w) => w.completed && w.programId === plan.id).length;
      return Math.min(100, Math.round((done / totalDays) * 100));
    };

    const orderedSaved: any[] = [];
    const seen = new Set<string>();
    for (const p of [...currentPlans, ...savedWorkoutPlans.filter((x) => !activePlans.includes(x.id))]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      orderedSaved.push(p);
    }
    const barColors = ['#00ff88', '#4dabf7', '#b482ff'];

    const runOptimizeWorkout = () => {
      const lines: string[] = [];
      if (primaryPlan) {
        const ad = planAdaptations.get(primaryPlan.id);
        ad?.slice(0, 4).forEach((a) => {
          lines.push(`${a.title}: ${a.description}`);
        });
      }
      const last = [...workoutHistory].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      if (last?.completed && lines.length < 4) {
        lines.push(
          `Last session: ${last.programName || 'Workout'} (${last.duration} min). Keep logging sets and weights for better suggestions.`
        );
      }
      if (lines.length === 0) {
        lines.push(
          'Complete a few sessions and log weights so suggestions can include progressions and movement swaps based on your last session.'
        );
      }
      Alert.alert('Optimize My Workout', lines.join('\n\n'));
    };

    const onStartWorkout = () => {
      fireTourTargetIfNeeded(TOUR_TARGET_IDS.fitnessStart);
      if (primaryPlan) {
        setSelectedSavedPlan(primaryPlan);
        return;
      }
      Alert.alert(
        'Choose a workout',
        'Open My Plans, browse program templates below, or use AI / Build to create a plan.',
        [{ text: 'OK' }]
      );
    };

    const recentSessions = [...workoutHistory]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);

    return (
      <View style={[styles.tabContent, styles.nuRoot]}>
        <ScrollView
          style={styles.nutritionContentScroll}
          contentContainerStyle={styles.nuScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.nuCard} ref={fitnessTodayCardRef} nativeID={TOUR_TARGET_IDS.fitnessTodayCard}>
            <Text style={styles.nuCardHeading}>{"Today's Workout"}</Text>
            <Text style={[styles.nuDetailsText, { marginBottom: 8 }]} numberOfLines={3}>
              {heroSubtitle}
            </Text>
            <View style={styles.woStatRow}>
              <View style={styles.woStatItem}>
                <Text style={styles.woStatIcon}>⏱</Text>
                <Text style={styles.woStatValue}>{durationMin > 0 ? `${durationMin} min` : '—'}</Text>
              </View>
              <View style={styles.woStatDivider} />
              <View style={styles.woStatItem}>
                <Text style={styles.woStatIcon}>🏋</Text>
                <Text style={styles.woStatValue}>
                  {exCount > 0 ? `${exCount} Exercises` : '—'}
                </Text>
              </View>
              <View style={styles.woStatDivider} />
              <View style={styles.woStatItem}>
                <Text style={styles.woStatIcon}>🔥</Text>
                <Text style={styles.woStatValue}>{kcalEst > 0 ? `${kcalEst} kcal` : '—'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.nuOptimizeBtn, styles.woStartBtnRow]}
              ref={fitnessStartRef}
              onPress={onStartWorkout}
              activeOpacity={0.88}
              nativeID={TOUR_TARGET_IDS.fitnessStart}
            >
              <Text style={styles.woStartBtnIconNu}>▶</Text>
              <Text style={styles.nuOptimizeBtnText}>START WORKOUT</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.woQuickTilesWrap}>
            <View style={styles.nuQuickRow}>
              <TouchableOpacity
                style={[styles.nuQuickTile, styles.nuQuickGreen]}
                ref={fitnessAiWorkoutRef}
                onPress={openAiWorkout}
                activeOpacity={0.85}
                nativeID={TOUR_TARGET_IDS.fitnessAiWorkout}
              >
                <Text style={styles.nuQuickIcon}>🧠</Text>
                <Text style={styles.nuQuickLabel}>AI Workout</Text>
                {!isPremium ? (
                  <Text style={styles.nuPremiumPill}>Premium</Text>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nuQuickTile, styles.nuQuickBlue]}
                ref={fitnessBuildWorkoutRef}
                onPress={() => {
                  setShowBuildYourOwnScreen(true);
                  fireTourTargetIfNeeded(TOUR_TARGET_IDS.fitnessBuildWorkout);
                }}
                activeOpacity={0.85}
                nativeID={TOUR_TARGET_IDS.fitnessBuildWorkout}
              >
                <Text style={styles.nuQuickIcon}>🔧</Text>
                <Text style={styles.nuQuickLabel}>Build Workout</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.nuQuickRow, styles.woQuickRowLast]}>
              <TouchableOpacity
                style={[
                  styles.nuQuickTile,
                  styles.nuQuickPurple,
                  workoutQuickPanel === 'myPlans' && styles.nuQuickTileActivePurple,
                ]}
                ref={fitnessMyPlansRef}
                onPress={() => {
                  toggleWorkoutQuickPanel('myPlans');
                  fireTourTargetIfNeeded(TOUR_TARGET_IDS.fitnessMyPlans);
                }}
                activeOpacity={0.85}
                nativeID={TOUR_TARGET_IDS.fitnessMyPlans}
              >
                <Text style={styles.nuQuickIcon}>📋</Text>
                <Text style={styles.nuQuickLabel}>My Plans</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.nuQuickTile,
                  styles.nuQuickAmber,
                  workoutQuickPanel === 'templates' && styles.nuQuickTileActiveTemplates,
                ]}
                onPress={() => toggleWorkoutQuickPanel('templates')}
                activeOpacity={0.85}
              >
                <Text style={styles.nuQuickIcon}>📚</Text>
                <Text style={styles.nuQuickLabel}>Program{'\n'}templates</Text>
              </TouchableOpacity>
            </View>
          </View>

          {workoutQuickPanel === 'templates' && (
            <View style={styles.workoutPrograms}>
              <View style={styles.categoryTabsContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryTabsScroll}
                  contentContainerStyle={{ paddingHorizontal: 4 }}
                >
                  <TouchableOpacity
                    style={[styles.categoryTab, selectedCategory === null && styles.categoryTabActive]}
                    onPress={() => setSelectedCategory(null)}
                  >
                    <Text
                      style={[
                        styles.categoryTabText,
                        selectedCategory === null && styles.categoryTabTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  {categories
                    .filter((cat) => availableCategories.includes(cat.key))
                    .map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryTab,
                          selectedCategory === category.key && styles.categoryTabActive,
                        ]}
                        onPress={() => setSelectedCategory(category.key)}
                      >
                        <Text
                          style={[
                            styles.categoryTabText,
                            selectedCategory === category.key && styles.categoryTabTextActive,
                          ]}
                        >
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
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
                    <Text style={styles.programEquipment}>Equipment: {program.equipment.join(', ')}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    {selectedCategory
                      ? `No ${categories.find((c) => c.key === selectedCategory)?.name.toLowerCase()} programs available`
                      : 'No workout programs available'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {workoutQuickPanel === 'myPlans' && (
            <View style={styles.woExpandBlock} ref={fitnessMyPlansPanelRef} nativeID={TOUR_TARGET_IDS.fitnessMyPlansPanel}>
              <Text style={styles.nuSectionTitle}>My plans</Text>
              {currentPlans.length > 0 ? (
                <>
                  <Text style={styles.woPlanSectionSub}>Active ({currentPlans.length})</Text>
                  {currentPlans.map((plan) => (
                    <TouchableOpacity
                      key={plan.id}
                      style={styles.programCard}
                      onPress={() => setSelectedSavedPlan(plan)}
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
                      <Text style={styles.programDescription}>
                        {plan.level || 'Custom'} • {(plan.goal || 'strength').replace('_', ' ')} •{' '}
                        {plan.daysPerWeek || (plan.trainingDays && plan.trainingDays.length) || 'N/A'} days/week
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              ) : (
                <Text style={styles.emptyStateText}>No active plans</Text>
              )}
              {savedWorkoutPlans.filter((p) => !activePlans.includes(p.id)).length > 0 && (
                <>
                  <Text style={[styles.woPlanSectionSub, { marginTop: 10 }]}>
                    Saved ({savedWorkoutPlans.filter((p) => !activePlans.includes(p.id)).length})
                  </Text>
                  {savedWorkoutPlans
                    .filter((plan) => !activePlans.includes(plan.id))
                    .map((plan) => (
                      <TouchableOpacity
                        key={plan.id}
                        style={styles.programCard}
                        onPress={() => setSelectedSavedPlan(plan)}
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
                          {plan.level || 'Custom'} • {(plan.goal || 'strength').replace('_', ' ')} •{' '}
                          {plan.daysPerWeek || (plan.trainingDays && plan.trainingDays.length) || 'N/A'} days/week
                        </Text>
                      </TouchableOpacity>
                    ))}
                </>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.woPreviousButton}
            onPress={() => setShowLogPastWorkout(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.woPreviousButtonText}>Log previous workout</Text>
          </TouchableOpacity>

          {orderedSaved.length > 0 && (
            <>
              <Text style={[styles.nuSectionTitle, { marginTop: 6 }]}>Saved Programs</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.woProgScrollContent}
              >
                {orderedSaved.slice(0, 12).map((plan, idx) => {
                  const pct = planProgressPct(plan);
                  const isActive = activePlans.includes(plan.id);
                  const totalDays = Math.max(
                    1,
                    plan.weeklyPlan?.weekDays?.length || plan.daysPerWeek || 4
                  );
                  const done = workoutHistory.filter((w) => w.completed && w.programId === plan.id).length;
                  const nextLbl = getNextDayLabel(plan);
                  const bar = barColors[idx % barColors.length];
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={styles.woProgCard}
                      onPress={() => setSelectedSavedPlan(plan)}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.woProgTitle} numberOfLines={2}>
                        {plan.name}
                      </Text>
                      <View style={styles.woProgTrack}>
                        <View style={[styles.woProgFill, { width: `${pct}%`, backgroundColor: bar }]} />
                      </View>
                      <Text style={styles.woProgMeta}>
                        {isActive
                          ? `Completed ${Math.min(done, totalDays)}/${totalDays} logged`
                          : 'Saved plan'}
                      </Text>
                      <Text style={styles.woProgLink}>
                        {isActive ? '[ Continue ]' : nextLbl || '[ Open ]'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          <Text style={[styles.nuSectionTitle, { marginTop: 6 }]}>Recent Workouts</Text>
          <View style={styles.woListCard}>
            {recentSessions.length === 0 ? (
              <Text style={styles.woListEmpty}>No sessions yet. Finish a workout to see history here.</Text>
            ) : (
              recentSessions.map((session, index) => (
                <TouchableOpacity
                  key={`recent-${session.id}-${session.date}-${index}`}
                  style={styles.woRecentRow}
                  onPress={() => setSelectedHistorySession(session)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.woRecentIcon, !session.completed && styles.woRecentIconSkip]}
                  >
                    {session.completed ? '✓' : '✗'}
                  </Text>
                  <Text
                    style={[styles.woRecentText, !session.completed && styles.woRecentTextMuted]}
                    numberOfLines={1}
                  >
                    {session.programName || 'Workout'} – {session.completed ? 'Completed' : 'Skipped'}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          <TouchableOpacity style={styles.woOptimizeBtn} onPress={runOptimizeWorkout} activeOpacity={0.85}>
            <Text style={styles.woOptimizeBtnText}>🧠 Optimize My Workout</Text>
          </TouchableOpacity>
          <Text style={styles.nuOptimizeHint}>
            AI suggests weight increases and weak movement swaps based on your last session.
          </Text>
        </ScrollView>
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

    const isCopyMode = Boolean(mealCopyPending || dayCopyPending);

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Workout History</Text>

        {isCopyMode ? (
          <View style={styles.copyModeBanner}>
            <Text style={styles.copyModeBannerTitle}>
              {mealCopyPending ? `Copying “${mealCopyPending.name}”` : 'Copying all meals from selected day'}
            </Text>
            <Text style={styles.copyModeBannerSub}>Tap a calendar day below to paste.</Text>
            <TouchableOpacity
              style={styles.copyModeCancelBtn}
              onPress={() => {
                setMealCopyPending(null);
                setDayCopyPending(null);
              }}
            >
              <Text style={styles.copyModeCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        
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
            const isCopySourceDay = dayCopyPending != null && dateKey === dayCopyPending;

            if (day === null) {
              return <View key={`empty-${index}`} style={styles.calendarDay} />;
            }

            return (
              <TouchableOpacity
                key={`day-${dateKey || `empty-${index}`}-${day}`}
                style={[
                  styles.calendarDay,
                  isToday && styles.calendarDayToday,
                  hasWorkout && styles.calendarDayWithWorkout,
                  isCopyMode && styles.calendarDayCopyMode,
                  isCopySourceDay && styles.calendarDayCopySource,
                ]}
                onPress={() => {
                  if (!dateKey) return;
                  if (isCopyMode) {
                    void completeMealCopyToDay(dateKey);
                    return;
                  }
                  if (hasData) {
                    if (isSelected) {
                      setSelectedCalendarDate(null);
                      setExpandedDayItems(new Set());
                    } else {
                      setSelectedCalendarDate(dateKey);
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
                <View style={styles.dayDetailBubbleHeader}>
                  <TouchableOpacity
                    style={styles.dayDetailBubbleHeaderTap}
                    onPress={() => {
                      const key = `nutrition-${selectedCalendarDate}`;
                      setExpandedDayItems((prev) => {
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
                  <TouchableOpacity
                    style={styles.copyAllMealsBtn}
                    onPress={() =>
                      startCopyAllMealsFromDay(
                        selectedCalendarDate,
                        mealsByDate[selectedCalendarDate].length
                      )
                    }
                  >
                    <Text style={styles.copyAllMealsBtnText}>Copy all</Text>
                  </TouchableOpacity>
                </View>
                {expandedDayItems.has(`nutrition-${selectedCalendarDate}`) && (
                  <View style={styles.dayDetailBubbleContent}>
                    {mealsByDate[selectedCalendarDate].map((meal, idx) => {
                      const mealTime = meal.time || new Date(meal.date).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      });
                      return (
                        <View key={`meal-${selectedCalendarDate}-${meal.id || idx}-${meal.date}-${meal.time || ''}`} style={styles.dayDetailItem}>
                          <View style={styles.dayDetailItemTopRow}>
                            <View style={styles.dayDetailItemTextCol}>
                              <Text style={styles.dayDetailItemName}>{meal.name}</Text>
                              <Text style={styles.dayDetailItemInfo}>
                                {mealTime} • {meal.calories} cal
                              </Text>
                              <Text style={styles.dayDetailItemMacros}>
                                P: {meal.protein}g • C: {meal.carbs}g • F: {meal.fat}g
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.mealCopyBtn}
                              onPress={() => startCopyMealToDay(meal)}
                              accessibilityLabel={`Copy ${meal.name} to another day`}
                            >
                              <Text style={styles.mealCopyBtnText}>Copy</Text>
                            </TouchableOpacity>
                          </View>
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

    const calGoal = Math.max(1, nutritionGoals.calories);
    const proteinGoal = Math.max(1, nutritionGoals.protein);
    const carbsGoal = Math.max(1, nutritionGoals.carbs);
    const fatGoal = Math.max(1, nutritionGoals.fat);
    const calPct = Math.min(100, (todayTotals.calories / calGoal) * 100);
    const proteinPct = Math.min(100, (todayTotals.protein / proteinGoal) * 100);
    const carbsPct = Math.min(100, (todayTotals.carbs / carbsGoal) * 100);
    const fatPct = Math.min(100, (todayTotals.fat / fatGoal) * 100);
    const mealSlotRows: { id: MealSlot; label: string }[] = [
      { id: 'breakfast', label: 'Breakfast' },
      { id: 'lunch', label: 'Lunch' },
      { id: 'dinner', label: 'Dinner' },
      { id: 'snacks', label: 'Snacks' },
    ];

    const slotTotals = (slot: MealSlot) =>
      todayMeals.filter((m) => inferMealSlot(m) === slot).reduce(
        (a, m) => ({
          cal: a.cal + (Number(m.calories) || 0),
          p: a.p + (Number(m.protein) || 0),
          c: a.c + (Number(m.carbs) || 0),
          f: a.f + (Number(m.fat) || 0),
        }),
        { cal: 0, p: 0, c: 0, f: 0 }
      );

    const unitShort: Record<string, string> = {
      piece: 'pc',
      g: 'g',
      oz: 'oz',
      fl_oz: 'fl oz',
      cup: 'cups',
      ml: 'ml',
      tbsp: 'tbsp',
      tsp: 'tsp',
    };

    const formatMealPortionLine = (meal: Meal): string | null => {
      const itemsLine = formatLogFoodItemsSummary(meal.items ?? []);
      if (itemsLine) return itemsLine;
      const amt = meal.servingAmount?.trim();
      const rawUnit = meal.servingUnit?.trim().toLowerCase();
      if (amt && rawUnit) {
        const label = unitShort[rawUnit] ?? rawUnit;
        return `${amt} ${label}`;
      }
      if (meal.servings != null && meal.servings > 0 && meal.servings !== 1) {
        return `${meal.servings} servings`;
      }
      return null;
    };

    const renderLogFoodStyleNutritionBlock = (
      nutrition: { calories: number; protein: number; carbs: number; fat: number },
      opts?: { panelTitle?: string }
    ) => {
      const p = Number(nutrition.protein) || 0;
      const c = Number(nutrition.carbs) || 0;
      const f = Number(nutrition.fat) || 0;
      const explicitCal = Number(nutrition.calories);
      const cal =
        Number.isFinite(explicitCal) && (explicitCal > 0 || opts?.panelTitle != null)
          ? Math.round(Math.max(0, explicitCal))
          : calculateCaloriesFromMacros(p, c, f);
      const hasNutrition = cal > 0 || p + c + f > 0;
      const showNutrition = hasNutrition || !!opts?.panelTitle;
      if (!showNutrition) return null;

      const formatMacro = (n: number) => String(Math.round(n * 10) / 10);

      return (
        <View style={styles.logFoodPanel}>
          {opts?.panelTitle ? <Text style={styles.logFoodPanelTitle}>{opts.panelTitle}</Text> : null}
          {showNutrition ? (
            <>
              <View style={styles.logFoodItemCalorieBlock}>
                <Text style={styles.nuCardHeading}>Calories</Text>
                <View style={styles.nuCalorieTextCol}>
                  <Text style={styles.nuCalorieBig}>
                    {cal.toLocaleString()} <Text style={styles.nuCalorieUnit}>kcal</Text>
                  </Text>
                </View>
              </View>
              <View style={styles.logFoodMacroRow}>
                <View style={styles.logFoodMacroCol}>
                  <Text style={styles.logFoodMacroLabel}>Protein (g)</Text>
                  <Text style={[styles.mealSlotMacroValue, styles.logFoodMacroInputProtein]}>
                    {formatMacro(p)}
                  </Text>
                </View>
                <View style={styles.logFoodMacroCol}>
                  <Text style={styles.logFoodMacroLabel}>Carbs (g)</Text>
                  <Text style={[styles.mealSlotMacroValue, styles.logFoodMacroInputCarbs]}>
                    {formatMacro(c)}
                  </Text>
                </View>
                <View style={styles.logFoodMacroCol}>
                  <Text style={styles.logFoodMacroLabel}>Fat (g)</Text>
                  <Text style={[styles.mealSlotMacroValue, styles.logFoodMacroInputFat]}>
                    {formatMacro(f)}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      );
    };

    const logFoodProtein = parseFloat(mealInput.protein) || 0;
    const logFoodCarbs = parseFloat(mealInput.carbs) || 0;
    const logFoodFat = parseFloat(mealInput.fat) || 0;
    const logFoodItemCalories = calculateCaloriesFromMacros(logFoodProtein, logFoodCarbs, logFoodFat);
    const showLogFoodItemCalories = logFoodProtein + logFoodCarbs + logFoodFat > 0;

    const applyLogFoodSimpleFraction = (fraction: number) => {
      const f = clampNaturalFraction(fraction);
      const snap = logFoodMacrosPerWholeRef.current;
      if (!snap) return;
      const scaled = scaleMacroSnapshot(
        {
          protein: snap.protein,
          carbs: snap.carbs,
          fat: snap.fat,
          calories: snap.calories,
          micronutrients: snap.micronutrients,
        },
        f
      );
      setNaturalFraction(f);
      setMealInput((prev) => ({
        ...prev,
        protein: String(Math.round(scaled.protein * 10) / 10),
        carbs: String(Math.round(scaled.carbs * 10) / 10),
        fat: String(Math.round(scaled.fat * 10) / 10),
        calories: String(scaled.calories),
        micronutrients: scaled.micronutrients as typeof prev.micronutrients,
        servingUnit: 'piece',
        baseServingSize: '1',
        servings: '1',
      }));
      setBaseMacros({
        protein: String(Math.round(scaled.protein * 10) / 10),
        carbs: String(Math.round(scaled.carbs * 10) / 10),
        fat: String(Math.round(scaled.fat * 10) / 10),
      });
    };

    const enterLogFoodSimpleMode = () => {
      const p = parseFloat(mealInput.protein) || 0;
      const c = parseFloat(mealInput.carbs) || 0;
      const f = parseFloat(mealInput.fat) || 0;
      if (p + c + f <= 0) {
        Alert.alert(
          'Add nutrition first',
          'Enter macros or pick a food from search, then use Simple (whole + fraction).'
        );
        return;
      }
      const snap = macroSnapshotFromMealInputStrings({
        protein: mealInput.protein,
        carbs: mealInput.carbs,
        fat: mealInput.fat,
        calories: mealInput.calories,
        micronutrients: mealInput.micronutrients as Record<string, number | undefined | null> | undefined,
      });
      logFoodMacrosPerWholeRef.current = snap;
      logFoodPreciseBasisRef.current = null;
      setPortionInputMode('simple');
      setNaturalFraction(1);
      applyLogFoodSimpleFraction(1);
    };

    const exitLogFoodSimpleMode = () => {
      setPortionInputMode('precise');
      logFoodMacrosPerWholeRef.current = null;
      assignLogFoodPreciseBasis({
        protein: mealInput.protein,
        carbs: mealInput.carbs,
        fat: mealInput.fat,
        calories: mealInput.calories,
        micronutrients: mealInput.micronutrients,
        baseServingSize: mealInput.baseServingSize,
        servings: mealInput.servings,
        servingUnit: mealInput.servingUnit as LogFoodServingUnit,
      });
    };

    const logFoodSuggestPanelMax = Math.min(Math.round(windowHeight * 0.58), 580);
    const logFoodSuggestInnerMax = Math.min(Math.round(windowHeight * 0.52), 520);

    const renderLogFoodNameSuggestions = () => {
      if (logFoodSuppressInlineSuggest) return null;

      const queryTrimmed = mealNameInput.trim();
      const quickPickMode = queryTrimmed.length < 2;
      const showSuggestPanel = logFoodNameInputFocused || queryTrimmed.length >= 2;
      if (!showSuggestPanel) return null;

      const yourFoods = !logFoodSuppressInlineSuggest
        ? quickPickMode
          ? logFoodQuickPicks
          : logFoodNameMatches.yourFoods
        : [];
      const showUsdaSection = queryTrimmed.length >= 2;
      const showPanel =
        yourFoods.length > 0 ||
        showUsdaSection ||
        logFoodInlineUsda.loading ||
        !!logFoodInlineUsda.error;

      if (!showPanel) return null;

      return (
        <View style={[styles.logFoodSuggestPanel, { maxHeight: logFoodSuggestPanelMax }]}>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator
            style={[styles.logFoodSuggestScroll, { maxHeight: logFoodSuggestInnerMax }]}
            contentContainerStyle={styles.logFoodSuggestScrollContent}
          >
            {yourFoods.length > 0 ? (
              <>
                <Text style={styles.logFoodSuggestHeader}>
                  {quickPickMode ? 'Your frequent foods' : 'Your foods'}
                </Text>
                {yourFoods.map((row) => {
                  const useCount = row.timesUsed > 0 ? row.timesUsed : row.logCount;
                  return (
                    <TouchableOpacity
                      key={`log-your-${row.kind}-${row.id}`}
                      style={styles.logFoodSuggestRow}
                      onPressIn={() => {
                        if (logFoodNameBlurTimerRef.current) {
                          clearTimeout(logFoodNameBlurTimerRef.current);
                          logFoodNameBlurTimerRef.current = null;
                        }
                      }}
                      onPress={() => applyLogFoodYourFoodMatch(row)}
                      activeOpacity={0.78}
                    >
                      <Text style={styles.logFoodSuggestTitle}>{row.name}</Text>
                      <Text style={styles.logFoodSuggestSub}>
                        Logged {useCount}× · {row.calories} cal · {row.protein}g P
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            ) : null}
            {logFoodDatabaseLoading ? (
              <View style={styles.logFoodSuggestLoading}>
                <ActivityIndicator color={AppTheme.accent} />
                <Text style={styles.logFoodSuggestMuted}>Loading food details…</Text>
              </View>
            ) : null}
            {showUsdaSection && logFoodInlineUsda.loading ? (
              <View style={styles.logFoodSuggestLoading}>
                <ActivityIndicator color={AppTheme.accent} />
                <Text style={styles.logFoodSuggestMuted}>Looking up USDA…</Text>
              </View>
            ) : null}
            {showUsdaSection && logFoodInlineUsda.error ? (
              <Text style={styles.logFoodSuggestError}>{logFoodInlineUsda.error}</Text>
            ) : null}
            {showUsdaSection && logFoodInlineUsda.results.length > 0 ? (
              <>
                <Text
                  style={[styles.logFoodSuggestHeaderUsda, yourFoods.length > 0 && { marginTop: 10 }]}
                >
                  USDA (Foundation & SR Legacy)
                </Text>
                {logFoodInlineUsda.results.map((hit) => (
                  <TouchableOpacity
                    key={`usda-${hit.fdcId}`}
                    style={styles.logFoodSuggestRow}
                    onPress={() => {
                      Keyboard.dismiss();
                      void applyUsdaHitToLogFoodForm(hit);
                    }}
                    activeOpacity={0.78}
                  >
                    <Text style={styles.logFoodSuggestTitle}>{hit.description}</Text>
                    <Text style={styles.logFoodSuggestSub}>
                      {hit.dataType ?? 'Food'}
                      {hit.foodCategory ? ` · ${hit.foodCategory}` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : null}
            {showUsdaSection &&
            !logFoodInlineUsda.loading &&
            !logFoodInlineUsda.error &&
            logFoodInlineUsda.results.length === 0 &&
            yourFoods.length === 0 ? (
              <Text style={styles.logFoodSuggestMuted}>No matches in your log or USDA yet.</Text>
            ) : null}
            {showUsdaSection &&
            !logFoodInlineUsda.loading &&
            !logFoodInlineUsda.error &&
            logFoodInlineUsda.results.length === 0 &&
            yourFoods.length > 0 ? (
              <Text style={[styles.logFoodSuggestMuted, { marginTop: 8 }]}>
                No USDA matches — pick one of your foods above or keep typing.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      );
    };

    const renderLogFoodMealTimeSlots = () => (
      <>
        <Text style={styles.logFoodSubPanelTitle}>Meal time</Text>
        <View style={styles.logFoodMealSlotList}>
          {mealSlotRows.map((row) => (
            <TouchableOpacity
              key={row.id}
              style={[styles.logFoodMealSlotRow, logFoodSlot === row.id && styles.logFoodMealSlotRowOn]}
              onPress={() => setLogFoodSlot(row.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.logFoodMealSlotRowLabel, logFoodSlot === row.id && styles.logFoodMealSlotRowLabelOn]}>
                {row.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );

    const logMicroHighlights: { key: keyof Micronutrients; label: string; icon: string }[] = [
      { key: 'vitaminC', label: 'Vit C', icon: '🍊' },
      { key: 'iron', label: 'Iron', icon: '⚙️' },
      { key: 'calcium', label: 'Calcium', icon: '🦴' },
      { key: 'vitaminD', label: 'Vit D', icon: '☀️' },
      { key: 'potassium', label: 'Potassium', icon: '🍌' },
      { key: 'magnesium', label: 'Magnesium', icon: '✨' },
      { key: 'zinc', label: 'Zinc', icon: '⚡' },
      { key: 'vitaminB12', label: 'B12', icon: '💊' },
    ];

    const formatMicronutrientKeyLabel = (key: keyof Micronutrients): string =>
      String(key)
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();

    const highlightMicroKeys = new Set(logMicroHighlights.map((h) => h.key));
    const extraMicroKeys =
      mealInput.micronutrients != null
        ? (Object.keys(mealInput.micronutrients) as (keyof Micronutrients)[]).filter((k) => {
            const v = mealInput.micronutrients![k];
            return v !== undefined && v !== null && !highlightMicroKeys.has(k);
          })
        : [];
    extraMicroKeys.sort((a, b) => formatMicronutrientKeyLabel(a).localeCompare(formatMicronutrientKeyLabel(b)));

    const logMicroGridRows: { key: keyof Micronutrients; label: string; icon: string }[] = [
      ...logMicroHighlights,
      ...extraMicroKeys.map((key) => ({
        key,
        label: formatMicronutrientKeyLabel(key),
        icon: '•',
      })),
    ];

    const bumpLogServingSize = (delta: number) => {
      const cur = parseFloat(mealInput.baseServingSize || '1') || 1;
      const next = Math.max(0.25, Math.round((cur + delta) * 100) / 100);
      const nextStr = Number.isInteger(next) ? String(next) : String(next);
      updateLogFoodPortion({ baseServingSize: nextStr });
    };

    const bumpLogServings = (delta: number) => {
      const cur = parseFloat(mealInput.servings || '1') || 1;
      const next = Math.max(0.25, Math.round((cur + delta) * 100) / 100);
      const nextStr = Number.isInteger(next) ? String(next) : String(next);
      updateLogFoodPortion({ servings: nextStr });
    };

    const baseLogSize = parseFloat(mealInput.baseServingSize || '1') || 1;
    const logServingsCount = parseFloat(mealInput.servings || '1') || 1;
    const totalLogAmount = baseLogSize * logServingsCount;
    const totalLogAmountStr =
      Math.abs(totalLogAmount - Math.round(totalLogAmount)) < 0.001
        ? String(Math.round(totalLogAmount))
        : totalLogAmount.toFixed(1);
    const totalMealWeightLabel = `${totalLogAmountStr} ${unitShort[mealInput.servingUnit] ?? mealInput.servingUnit}`;

    const openLogFood = () => {
      setLogFoodSlot(defaultSlotNow());
      setShowLogFoodModal(true);
    };

    const submitEatingOutCoach = async () => {
      if (!isPremium) {
        presentUpgrade();
        return;
      }
      if (!isGeminiApiKeyConfigured()) {
        setEatingOutCoachError(getGeminiSetupHint());
        return;
      }
      const q = eatingOutQuery.trim();
      if (!q) {
        Alert.alert('Add a question', 'Name a restaurant or describe where you are eating.');
        return;
      }
      setEatingOutCoachLoading(true);
      setEatingOutCoachError(null);
      setEatingOutCoachPayload(null);
      try {
        const { getEatingOutCoachResponse } = await import('./src/services/geminiService');
        const remCal = Math.max(0, remaining.calories);
        const dailyCal = Math.max(1, nutritionGoals.calories);
        const suggestSideVariations = remCal >= 400 || remCal / dailyCal >= 0.22;
        const payload = await getEatingOutCoachResponse(q, {
          remainingCalories: remaining.calories,
          remainingProtein: remaining.protein,
          remainingCarbs: remaining.carbs,
          remainingFat: remaining.fat,
          dailyGoalCalories: nutritionGoals.calories,
          dailyGoalProtein: nutritionGoals.protein,
          dailyGoalCarbs: nutritionGoals.carbs,
          dailyGoalFat: nutritionGoals.fat,
          suggestSideVariations,
        });
        setEatingOutCoachPayload(payload);
        const entry: EatingOutCoachHistoryEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          query: q,
          payload,
          savedAt: new Date().toISOString(),
        };
        setEatingOutCoachHistory((prev) => {
          const next = [entry, ...prev].slice(0, EATING_OUT_COACH_HISTORY_MAX);
          AsyncStorage.setItem(EATING_OUT_COACH_HISTORY_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      } catch (e) {
        if (e instanceof PremiumRequiredError) {
          presentUpgrade();
          return;
        }
        const msg = e instanceof Error ? e.message : String(e);
        setEatingOutCoachError(msg);
        Alert.alert('Coach unavailable', msg);
      } finally {
        setEatingOutCoachLoading(false);
      }
    };

    const applyEatingOutPickToLogFood = (pick: EatingOutCoachSuggestion) => {
      const p =
        pick.protein_g != null && Number.isFinite(pick.protein_g) ? Math.round(pick.protein_g * 10) / 10 : 0;
      const c = pick.carbs_g != null && Number.isFinite(pick.carbs_g) ? Math.round(pick.carbs_g * 10) / 10 : 0;
      const f = pick.fat_g != null && Number.isFinite(pick.fat_g) ? Math.round(pick.fat_g * 10) / 10 : 0;
      if (p <= 0 && c <= 0 && f <= 0) {
        Alert.alert(
          'No macros on this pick',
          'This suggestion does not include usable protein, carbs, or fat numbers. Log food manually or choose another option.'
        );
        return;
      }
      const name = formatEatingOutCoachLogName(pick, eatingOutQuery);
      const calFromMacros = Math.round(p * 4 + c * 4 + f * 9);
      const cal =
        pick.calories != null && Number.isFinite(pick.calories) && pick.calories > 0
          ? Math.round(pick.calories)
          : calFromMacros;

      if (logFoodNameBlurTimerRef.current) {
        clearTimeout(logFoodNameBlurTimerRef.current);
        logFoodNameBlurTimerRef.current = null;
      }
      Keyboard.dismiss();
      setLogFoodNameInputFocused(false);
      setLogFoodSuppressInlineSuggest(true);
      setPortionInputMode('precise');
      setNaturalFraction(1);
      logFoodMacrosPerWholeRef.current = null;
      setMealNameInput(name);
      const coachInput = {
        name,
        calories: String(cal),
        protein: String(p),
        carbs: String(c),
        fat: String(f),
        time: new Date().toLocaleTimeString(),
        servings: '1',
        servingUnit: 'piece' as LogFoodServingUnit,
        servingWeight: '1',
        baseServingSize: '1',
        micronutrients: undefined as Micronutrients | undefined,
        nutritionScanNote:
          'From Food coach (approximate). Adjust Serving size or Total servings if you only ate part of this meal.',
      };
      setMealInput(coachInput);
      setBaseMacros({ protein: String(p), carbs: String(c), fat: String(f) });
      assignLogFoodPreciseBasis(coachInput);
      handleLogFoodItemsChange(logFoodItemsFromEatingOutPick(pick, name));
      setShowMicronutrients(false);
      setShowEatingOutCoachModal(false);
      setShowLogFoodModal(true);
      setLogFoodSlot(defaultSlotNow());
      setNutritionLoggingModeWithPersist('precision');
      requestAnimationFrame(() => scrollLogFoodToNutrition());
    };

    const runOptimizeDay = () => {
      const lines: string[] = [];
      if (todayTotals.protein < nutritionGoals.protein * 0.75) {
        lines.push(
          `You still have about ${remaining.protein}g of protein left toward your goal — add lean protein at your next eating window.`
        );
      }
      if (todayTotals.calories < nutritionGoals.calories * 0.45 && new Date().getHours() >= 14) {
        lines.push('Calories are under target so far — a balanced snack can help if you are hungry.');
      }
      if (todayTotals.calories > nutritionGoals.calories) {
        lines.push('You are over today\'s calorie target. Lighter, whole-food choices this evening can help balance the week.');
      }
      if (lines.length === 0) {
        lines.push('You are in a solid range for today. Keep protein steady, stay hydrated, and favor whole foods when you can.');
      }
      Alert.alert('\u2728 Optimize my day', lines.join('\n\n'));
    };

    const openAdjustMacroGoals = () => {
      setEditGoals({
        protein: nutritionGoals.protein.toString(),
        carbs: nutritionGoals.carbs.toString(),
        fat: nutritionGoals.fat.toString(),
        water: nutritionGoals.water.toString(),
      });
      setShowAdjustGoalsModal(true);
    };

    let nutritionHistBuckets: NutritionHistBucket[] = [];
    let nutritionHistTotals: number[] = [];
    let nutritionHistMaxCal = 1;
    if (nutritionHistExpanded) {
      nutritionHistBuckets =
        nutritionHistMode === 'weeks'
          ? buildNutritionWeekBuckets(new Date(), nutritionHistWeeks)
          : buildNutritionMonthBuckets(new Date(), nutritionHistMonths);
      nutritionHistTotals = nutritionHistBuckets.map((b) => sumMealCaloriesInRange(meals, b.start, b.end));
      nutritionHistMaxCal = Math.max(1, ...nutritionHistTotals);
    }

    return (
      <>
        <View style={[styles.tabContent, styles.nuRoot]}>
          <ScrollView
            style={styles.nutritionContentScroll}
            contentContainerStyle={styles.nuScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.nuCard}>
              <Text style={styles.nuCardHeading}>Calories</Text>
              <View style={styles.nuCalorieTextCol}>
                <Text style={styles.nuCalorieBig}>
                  {Math.round(todayTotals.calories).toLocaleString()} / {nutritionGoals.calories.toLocaleString()}{' '}
                  <Text style={styles.nuCalorieUnit}>kcal</Text>
                </Text>
                <View style={styles.nuBarTrack}>
                  <View style={[styles.nuBarFill, { width: `${calPct}%`, backgroundColor: '#00ff88' }]} />
                </View>
              </View>
            </View>

            <View style={styles.nuCard}>
              <View style={styles.nuMacroCardTop}>
                <Text style={styles.nuCardHeading}>Macros</Text>
                <TouchableOpacity style={styles.nuMacroAdjustBtn} onPress={openAdjustMacroGoals} activeOpacity={0.85}>
                  <Text style={styles.nuMacroAdjustBtnText}>Adjust Macros</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.nuMacroLine}>
                <View style={styles.nuMacroLineTop}>
                  <Text style={styles.nuMacroName}>Protein</Text>
                  <Text style={styles.nuMacroAmount}>
                    {Math.round(todayTotals.protein)}g / {nutritionGoals.protein}g
                  </Text>
                  <Text style={styles.nuMacroPct}>{Math.round(proteinPct)}%</Text>
                </View>
                <View style={styles.nuBarTrack}>
                  <View style={[styles.nuBarFill, { width: `${proteinPct}%`, backgroundColor: '#00ff88' }]} />
                </View>
              </View>
              <View style={styles.nuMacroLine}>
                <View style={styles.nuMacroLineTop}>
                  <Text style={styles.nuMacroName}>Carbs</Text>
                  <Text style={styles.nuMacroAmount}>
                    {Math.round(todayTotals.carbs)}g / {nutritionGoals.carbs}g
                  </Text>
                  <Text style={styles.nuMacroPct}>{Math.round(carbsPct)}%</Text>
                </View>
                <View style={styles.nuBarTrack}>
                  <View style={[styles.nuBarFill, { width: `${carbsPct}%`, backgroundColor: '#4dabf7' }]} />
                </View>
              </View>
              <View style={styles.nuMacroLine}>
                <View style={styles.nuMacroLineTop}>
                  <Text style={styles.nuMacroName}>Fats</Text>
                  <Text style={styles.nuMacroAmount}>
                    {Math.round(todayTotals.fat)}g / {nutritionGoals.fat}g
                  </Text>
                  <Text style={styles.nuMacroPct}>{Math.round(fatPct)}%</Text>
                </View>
                <View style={styles.nuBarTrack}>
                  <View style={[styles.nuBarFill, { width: `${fatPct}%`, backgroundColor: '#ff922b' }]} />
                </View>
              </View>
              <View style={styles.nuMacroFoot}>
                <Text style={styles.nuDetailsText}>
                  Remaining today: {remaining.calories} kcal · {remaining.protein}g protein · {remaining.carbs}g carbs ·{' '}
                  {remaining.fat}g fat
                </Text>
                <Text style={styles.nuDetailsTextMuted}>Water goal: {nutritionGoals.water} oz</Text>
              </View>
            </View>

            <View style={styles.nuQuickRow}>
              <TouchableOpacity
                style={[styles.nuQuickTile, styles.nuLogFoodCta]}
                ref={nutritionLogFoodRef}
                onPress={() => {
                  openLogFood();
                  fireTourTargetIfNeeded(TOUR_TARGET_IDS.nutritionLogFood);
                }}
                activeOpacity={0.88}
                nativeID={TOUR_TARGET_IDS.nutritionLogFood}
              >
                <Text style={[styles.nuQuickIcon, styles.nuLogFoodCtaIcon]}>+</Text>
                <Text style={[styles.nuQuickLabel, styles.nuLogFoodCtaLabel]}>Log Food</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.nuQuickTile,
                  styles.nuQuickPurple,
                  nutritionHistExpanded && styles.nuQuickTileActiveHist,
                ]}
                onPress={() => setNutritionHistExpanded((v) => !v)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ expanded: nutritionHistExpanded }}
                accessibilityLabel="Calorie history chart"
              >
                <Text style={styles.nuQuickIcon}>📊</Text>
                <Text style={styles.nuQuickLabel}>
                  Calorie{'\n'}history
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.nuQuickTile,
                  styles.nuQuickBlue,
                  showEatingOutCoachModal && styles.nuQuickTileActiveCoach,
                ]}
                onPress={openFoodCoach}
                activeOpacity={0.85}
              >
                <Text style={styles.nuQuickIcon}>🍽</Text>
                <Text style={styles.nuQuickLabel}>
                  Food{'\n'}coach
                </Text>
                {!isPremium ? (
                  <Text style={styles.nuPremiumPill}>Premium</Text>
                ) : null}
              </TouchableOpacity>
            </View>

            {nutritionHistExpanded ? (
              <View style={styles.nuCard}>
                <Text style={[styles.nuDetailsTextMuted, { marginBottom: 8 }]}>
                  Logged meals only · weeks Mon–Sun · swipe chart if crowded
                </Text>
                <View style={styles.nuHistModeRow}>
                  {(['weeks', 'months'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.nuHistChip, nutritionHistMode === m && styles.nuHistChipOn]}
                      onPress={() => setNutritionHistMode(m)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.nuHistChipText, nutritionHistMode === m && styles.nuHistChipTextOn]}>
                        {m === 'weeks' ? 'Weeks' : 'Months'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.nuHistSpanRow}>
                  {nutritionHistMode === 'weeks'
                    ? ([4, 8, 12] as const).map((n) => (
                        <TouchableOpacity
                          key={n}
                          style={[styles.nuHistSpanChip, nutritionHistWeeks === n && styles.nuHistSpanChipOn]}
                          onPress={() => setNutritionHistWeeks(n)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.nuHistSpanText, nutritionHistWeeks === n && styles.nuHistSpanTextOn]}>{n} wk</Text>
                        </TouchableOpacity>
                      ))
                    : ([3, 6, 12] as const).map((n) => (
                        <TouchableOpacity
                          key={n}
                          style={[styles.nuHistSpanChip, nutritionHistMonths === n && styles.nuHistSpanChipOn]}
                          onPress={() => setNutritionHistMonths(n)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.nuHistSpanText, nutritionHistMonths === n && styles.nuHistSpanTextOn]}>{n} mo</Text>
                        </TouchableOpacity>
                      ))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nuHistChartScroll}>
                  {nutritionHistBuckets.map((b, idx) => {
                    const v = nutritionHistTotals[idx] ?? 0;
                    const pct = Math.min(100, Math.round((v / nutritionHistMaxCal) * 100));
                    return (
                      <View key={`${b.start.getTime()}-${b.end.getTime()}`} style={styles.nuHistBarCol}>
                        <Text style={styles.nuHistBarValue} numberOfLines={1}>
                          {v > 0 ? Math.round(v).toLocaleString() : '—'}
                        </Text>
                        <View style={styles.nuHistBarTrack}>
                          <View style={[styles.nuHistBarFill, { height: `${Math.max(pct, v > 0 ? 6 : 2)}%` }]} />
                        </View>
                        <Text style={styles.nuHistBarLabel} numberOfLines={2}>
                          {b.label}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {eatingOutCoachHistory.length > 0 ? (
              <TouchableOpacity
                style={styles.eatingOutHistoryBar}
                onPress={() => setShowEatingOutHistoryModal(true)}
                activeOpacity={0.88}
                accessibilityLabel="View saved food coach results"
              >
                <Text style={styles.eatingOutHistoryBarIcon}>📋</Text>
                <View style={styles.eatingOutHistoryBarTextCol}>
                  <Text style={styles.eatingOutHistoryBarTitle}>Saved coach results</Text>
                  <Text style={styles.eatingOutHistoryBarSub} numberOfLines={1}>
                    Tap to open — last: {eatingOutCoachHistory[0].query.trim().slice(0, 48)}
                    {eatingOutCoachHistory[0].query.trim().length > 48 ? '…' : ''}
                  </Text>
                </View>
                <View style={styles.eatingOutHistoryBarBadge}>
                  <Text style={styles.eatingOutHistoryBarBadgeText}>{eatingOutCoachHistory.length}</Text>
                </View>
                <Text style={styles.nuChevron}>›</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.nuSectionTitle}>Today's Meals</Text>
            {mealSlotRows.map((row) => {
              const t = slotTotals(row.id);
              const has = t.cal > 0 || t.p > 0 || t.c > 0 || t.f > 0;
              return (
                <TouchableOpacity
                  key={row.id}
                  style={styles.nuMealSlotRow}
                  onPress={() => setMealSlotSheet(row.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.nuMealSlotMid}>
                    <Text style={styles.nuMealSlotTitle}>{row.label}</Text>
                    <Text style={styles.nuMealSlotSub}>
                      {has
                        ? `${Math.round(t.cal).toLocaleString()} kcal · ${Math.round(t.p)}g P · ${Math.round(t.c)}g C · ${Math.round(t.f)}g F`
                        : '-- kcal · --g P · --g C · --g F'}
                    </Text>
                  </View>
                  <Text style={styles.nuChevron}>›</Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={styles.nuOptimizeBtn} onPress={runOptimizeDay} activeOpacity={0.85}>
              <Text style={styles.nuOptimizeBtnText}>🧠 Optimize My Day</Text>
            </TouchableOpacity>
            <Text style={styles.nuOptimizeHint}>Get AI suggestions to improve your nutrition</Text>
          </ScrollView>
        </View>

        <Modal
          visible={showLogFoodModal && !showBarcodeScanner}
          transparent
          animationType="none"
          onRequestClose={() => setShowLogFoodModal(false)}
        >
          <View style={styles.logFoodOverlay}>
            <Pressable
              style={styles.logFoodBackdrop}
              onPress={tapOutsideToDismissKeyboard}
              accessibilityLabel="Dismiss keyboard"
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.logFoodKeyboardWrap}
              pointerEvents="box-none"
            >
              <View style={[styles.nuModalCard, styles.logFoodModalCard]} pointerEvents="box-none">
                  <View style={styles.logFoodModalHeader}>
                    {logFoodSavedPickerOpen ? (
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          setLogFoodSavedPickerOpen(false);
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                      >
                        <Text style={[styles.nuModalClose, styles.nuModalNavArrow]}>←</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.logFoodTitle}>Log Food</Text>
                    )}
                    <TouchableOpacity onPress={() => setShowLogFoodModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                      <Text style={styles.nuModalClose}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  {logFoodSavedPickerOpen ? (
                    <Text style={[styles.logFoodPanelTitle, { marginBottom: 14 }]}>Saved meals</Text>
                  ) : null}

                  <ScrollView
                    ref={logFoodScrollRef}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                    bounces={Platform.OS === 'ios'}
                  >
                    {logFoodSavedPickerOpen ? (
                      <>
                        <Text style={styles.nuDetailsTextMuted}>
                          Tap a meal to log it for {mealSlotRows.find((r) => r.id === logFoodSlot)?.label ?? 'this meal'}.
                        </Text>
                        <View style={styles.searchInputContainer}>
                          <TextInput
                            style={styles.searchInput}
                            placeholder="Search saved meals…"
                            value={savedMealsSearchQuery}
                            onChangeText={setSavedMealsSearchQuery}
                            placeholderTextColor={AppTheme.textFaint}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="off"
                            spellCheck={false}
                            textContentType="none"
                            clearButtonMode="while-editing"
                          />
                        </View>
                        {filteredSavedMealsForPicker.length === 0 ? (
                          <Text style={styles.nuDetailsText}>
                            {savedMeals.length === 0
                              ? 'No saved meals yet. Anything you add to your log is saved here automatically (by meal name). You can also use “Save as favorite” below the form.'
                              : 'No matches. Try a different search.'}
                          </Text>
                        ) : (
                          filteredSavedMealsForPicker
                            .sort((a, b) => b.timesUsed - a.timesUsed)
                            .map((meal) => (
                              <TouchableOpacity
                                key={meal.id}
                                style={styles.mealItem}
                                onPress={() => handleUseSavedMeal(meal, logFoodSlot).catch(console.error)}
                                activeOpacity={0.85}
                              >
                                <Text style={styles.mealName}>{meal.name}</Text>
                                <Text style={styles.mealMacro}>
                                  {meal.calories} cal · {meal.protein}g P · {meal.carbs}g C · {meal.fat}g F
                                </Text>
                              </TouchableOpacity>
                            ))
                        )}
                      </>
                    ) : (
                      <>
                    {!logFoodSavedPickerOpen ? (
                      <View style={styles.logFoodLoggingModeRow}>
                        <TouchableOpacity
                          style={[
                            styles.logFoodModeChip,
                            nutritionLoggingMode === 'precision' && styles.logFoodModeChipOn,
                          ]}
                          ref={logFoodModePrecisionRef}
                          nativeID={TOUR_TARGET_IDS.logFoodModePrecision}
                          onPress={() => {
                            setNutritionLoggingModeWithPersist('precision');
                            fireTourTargetIfNeeded(TOUR_TARGET_IDS.logFoodModePrecision);
                          }}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.logFoodModeChipText,
                              nutritionLoggingMode === 'precision' && styles.logFoodModeChipTextOn,
                            ]}
                          >
                            Precision
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.logFoodModeChip,
                            nutritionLoggingMode === 'ai' && styles.logFoodModeChipOn,
                          ]}
                          ref={logFoodModeAiRef}
                          nativeID={TOUR_TARGET_IDS.logFoodModeAi}
                          onPress={() => {
                            setNutritionLoggingModeWithPersist('ai');
                            fireTourTargetIfNeeded(TOUR_TARGET_IDS.logFoodModeAi);
                          }}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.logFoodModeChipText,
                              nutritionLoggingMode === 'ai' && styles.logFoodModeChipTextOn,
                            ]}
                          >
                            Quick (AI)
                          </Text>
                          {!isPremium ? <Text style={styles.nuPremiumPill}>Premium</Text> : null}
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {nutritionLoggingMode === 'ai' ? (
                      <View style={styles.logFoodPanel}>
                        <Text style={styles.logFoodPanelTitle}>Describe what you ate</Text>
                        <Text style={styles.nuDetailsTextMuted}>
                          Describe a restaurant meal, a home plate, or single whole foods — AI estimates macros for you.
                        </Text>
                        <TextInput
                          style={styles.logFoodAiQueryInput}
                          ref={logFoodAiInputRef}
                          nativeID={TOUR_TARGET_IDS.logFoodAiInput}
                          placeholder={'e.g. "plate of rice with ground beef and eggs" or "2 eggs and a banana"'}
                          placeholderTextColor={AppTheme.textFaint}
                          value={aiMealQuery}
                          onChangeText={(text) => {
                            setAiMealQuery(text);
                            setAiMealError(null);
                          }}
                          multiline
                          numberOfLines={3}
                          autoCapitalize="sentences"
                          autoCorrect
                          spellCheck
                          textContentType="none"
                        />
                        {!isGeminiApiKeyConfigured() ? (
                          <Text style={[styles.nuDetailsTextMuted, { marginTop: 10 }]}>
                            {getGeminiSetupHint()}
                          </Text>
                        ) : null}
                        <TouchableOpacity
                          style={[
                            styles.logFoodAddBtn,
                            styles.logFoodAiEstimateBtn,
                            (aiMealLoading || !isGeminiApiKeyConfigured()) && styles.eatingOutCoachBtnDisabled,
                          ]}
                          onPress={() => submitAiMealEstimate().catch(console.error)}
                          disabled={aiMealLoading || !isGeminiApiKeyConfigured()}
                          activeOpacity={0.88}
                        >
                          {aiMealLoading ? (
                            <ActivityIndicator color={AppTheme.textPrimary} />
                          ) : (
                            <Text style={styles.logFoodAddBtnText}>[  ESTIMATE MACROS  ]</Text>
                          )}
                        </TouchableOpacity>
                        {aiMealError ? (
                          <Text style={styles.eatingOutCoachErrorText}>{aiMealError}</Text>
                        ) : null}
                        {aiMealEstimate && aiMealEstimate.protein_g + aiMealEstimate.carbs_g + aiMealEstimate.fat_g > 0 ? (
                          <View style={styles.logFoodAiEstimateCard}>
                            <Text style={styles.logFoodAiEstimateTitle}>
                              {formatAiMealLogName(aiMealEstimate, aiMealQuery)}
                            </Text>
                            <Text style={styles.logFoodAiEstimateMacros}>
                              {Math.round(aiMealEstimate.calories)} kcal · {aiMealEstimate.protein_g}g P ·{' '}
                              {aiMealEstimate.carbs_g}g C · {aiMealEstimate.fat_g}g F
                            </Text>
                            {aiMealEstimate.assumptions ? (
                              <Text style={styles.logFoodAiEstimateAssumptions}>{aiMealEstimate.assumptions}</Text>
                            ) : null}
                            <Text style={styles.logFoodAiEstimateHint}>
                              Item breakdown is below — edit amounts and macros before adding to your log.
                            </Text>
                          </View>
                        ) : null}
                        {renderLogFoodMealTimeSlots()}
                      </View>
                    ) : (
                    <View style={styles.logFoodPanel}>
                      <Text style={styles.logFoodPanelTitle}>Meal name</Text>
                      <TextInput
                        style={styles.logFoodNameInput}
                        ref={logFoodMealNameRef}
                        nativeID={TOUR_TARGET_IDS.logFoodMealName}
                        placeholder="Tap to see your foods, or type to search"
                        placeholderTextColor={AppTheme.textFaint}
                        value={mealNameInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="off"
                        spellCheck={false}
                        textContentType="none"
                        clearButtonMode="while-editing"
                        onFocus={() => {
                          if (logFoodNameBlurTimerRef.current) {
                            clearTimeout(logFoodNameBlurTimerRef.current);
                            logFoodNameBlurTimerRef.current = null;
                          }
                          setLogFoodNameInputFocused(true);
                          setLogFoodSuppressInlineSuggest(false);
                        }}
                        onBlur={() => {
                          logFoodNameBlurTimerRef.current = setTimeout(() => {
                            setLogFoodNameInputFocused(false);
                            logFoodNameBlurTimerRef.current = null;
                          }, 180);
                        }}
                        onChangeText={(text) => {
                          setLogFoodSuppressInlineSuggest(false);
                          setMealNameInput(text);
                        }}
                      />
                      {logFoodSuppressInlineSuggest ? (
                        <Text style={styles.logFoodAppliedFromSearchHint}>
                          Nutrition data filled from your pick — scroll down to review or edit, then use Add to log.
                        </Text>
                      ) : null}
                      {renderLogFoodNameSuggestions()}
                      {mealInput.nutritionScanNote ? (
                        <Text style={styles.logFoodScanNote}>{mealInput.nutritionScanNote}</Text>
                      ) : null}
                      <View style={[styles.logFoodTopActions, { marginTop: 12 }]}>
                        <TouchableOpacity
                          style={styles.logFoodScanBtn}
                          onPress={() => setShowBarcodeScanner(true)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.logFoodBarcodeIcon}>▌▌▌</Text>
                          <Text style={styles.logFoodScanBtnText}>Scan label</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.logFoodSavedBtn}
                          onPress={() => {
                            Keyboard.dismiss();
                            setLogFoodSavedPickerOpen(true);
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.logFoodSavedStar}>★</Text>
                          <Text style={styles.logFoodSavedBtnText}>Saved meals</Text>
                        </TouchableOpacity>
                      </View>
                      {renderLogFoodMealTimeSlots()}
                    </View>
                    )}

                    {nutritionLoggingMode === 'ai' && mealNameInput.trim().length > 0 ? (
                      <View style={styles.logFoodPanel}>
                        <Text style={styles.logFoodPanelTitle}>Meal name (editable)</Text>
                        <TextInput
                          style={styles.logFoodNameInput}
                          value={mealNameInput}
                          onChangeText={setMealNameInput}
                          autoCapitalize="sentences"
                          autoCorrect={false}
                          spellCheck={false}
                        />
                      </View>
                    ) : null}

                    {logFoodItems.length > 0 ? (
                      <LogFoodItemBreakdown items={logFoodItems} onChange={handleLogFoodItemsChange} />
                    ) : null}

                    <View
                      onLayout={(e) => {
                        logFoodNutritionSectionY.current = e.nativeEvent.layout.y;
                      }}
                    >
                    <View style={styles.logFoodPanel}>
                      <Text style={styles.logFoodPanelTitle}>Nutrition data</Text>
                      {mealInput.nutritionScanNote ? (
                        <Text style={styles.logFoodScanNote}>{mealInput.nutritionScanNote}</Text>
                      ) : null}
                      {showLogFoodItemCalories ? (
                        <View style={styles.logFoodItemCalorieBlock}>
                          <Text style={styles.nuCardHeading}>Calories</Text>
                          <View style={styles.nuCalorieTextCol}>
                            <Text style={styles.nuCalorieBig}>
                              {Math.round(logFoodItemCalories).toLocaleString()}{' '}
                              <Text style={styles.nuCalorieUnit}>kcal</Text>
                            </Text>
                          </View>
                        </View>
                      ) : null}
                      <View style={styles.logFoodMacroRow}>
                        <View style={styles.logFoodMacroCol}>
                          <Text style={styles.logFoodMacroLabel}>Protein (g)</Text>
                          <TextInput
                            style={[styles.logFoodMacroInput, styles.logFoodMacroInputProtein]}
                            placeholder="0"
                            placeholderTextColor={AppTheme.textFaint}
                            keyboardType="decimal-pad"
                            value={mealInput.protein}
                            onChangeText={(text) => updateLogFoodNutritionMacro('protein', text)}
                          />
                        </View>
                        <View style={styles.logFoodMacroCol}>
                          <Text style={styles.logFoodMacroLabel}>Carbs (g)</Text>
                          <TextInput
                            style={[styles.logFoodMacroInput, styles.logFoodMacroInputCarbs]}
                            placeholder="0"
                            placeholderTextColor={AppTheme.textFaint}
                            keyboardType="decimal-pad"
                            value={mealInput.carbs}
                            onChangeText={(text) => updateLogFoodNutritionMacro('carbs', text)}
                          />
                        </View>
                        <View style={styles.logFoodMacroCol}>
                          <Text style={styles.logFoodMacroLabel}>Fat (g)</Text>
                          <TextInput
                            style={[styles.logFoodMacroInput, styles.logFoodMacroInputFat]}
                            placeholder="0"
                            placeholderTextColor={AppTheme.textFaint}
                            keyboardType="decimal-pad"
                            value={mealInput.fat}
                            onChangeText={(text) => updateLogFoodNutritionMacro('fat', text)}
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.logFoodMicroAccordion, showMicronutrients && styles.logFoodMicroAccordionOn]}
                        onPress={() => setShowMicronutrients(!showMicronutrients)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: showMicronutrients }}
                        accessibilityLabel={
                          showMicronutrients
                            ? 'Hide vitamins, minerals, and full nutrition'
                            : 'Show vitamins, minerals, and full nutrition'
                        }
                      >
                        <Text style={styles.logFoodMicroAccordionChevron}>{showMicronutrients ? '▼' : '▶'}</Text>
                        <View style={styles.logFoodMicroAccordionTextCol}>
                          <Text style={styles.logFoodMicroAccordionTitle}>Vitamins, minerals & full nutrition</Text>
                          <Text style={styles.logFoodMicroAccordionSub} numberOfLines={2}>
                            {showMicronutrients
                              ? 'Tap to collapse'
                              : logFoodFormHasMicronutrients(mealInput.micronutrients)
                                ? 'Micronutrients loaded — tap to expand or edit portion'
                                : 'Optional detail — expand to view vitamins & minerals'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {showMicronutrients ? (
                        <>
                          <Text style={styles.logFoodMicroSectionTitle}>Micronutrients & minerals</Text>
                          <View style={styles.logFoodMicroGrid}>
                            {logMicroGridRows.map(({ key, label, icon }) => {
                              const raw = mealInput.micronutrients?.[key];
                              const has = raw !== undefined && raw !== null;
                              const unit = getMicronutrientUnit(String(key));
                              const displayVal = has && typeof raw === 'number' ? roundScaledMicro(raw) : raw;
                              return (
                                <View key={String(key)} style={styles.logFoodMicroTile}>
                                  <Text style={styles.logFoodMicroIcon}>{icon}</Text>
                                  <Text style={styles.logFoodMicroName}>{label}</Text>
                                  <Text style={[styles.logFoodMicroVal, !has && styles.logFoodMicroValEmpty]}>
                                    {has ? `${displayVal} ${unit}` : '—'}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                          <View style={styles.micronutrientsContainer}>
                            {mealInput.micronutrients && Object.keys(mealInput.micronutrients).length > 0 ? (
                              <View style={styles.micronutrientsList}>
                                {Object.entries(mealInput.micronutrients).map(([key, value]) => {
                                  if (value === undefined || value === null) return null;
                                  const displayValue = roundScaledMicro(
                                    typeof value === 'number' ? value : parseFloat(String(value)) || 0
                                  );
                                  const displayName = key
                                    .replace(/([A-Z])/g, ' $1')
                                    .replace(/^./, (str) => str.toUpperCase())
                                    .trim();
                                  const unit = getMicronutrientUnit(key);
                                  return (
                                    <View key={key} style={styles.micronutrientItem}>
                                      <Text style={styles.micronutrientLabel}>{displayName}</Text>
                                      <Text style={styles.micronutrientValue}>
                                        {displayValue} {unit}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                            ) : (
                              <Text style={styles.micronutrientsEmptyText}>
                                No micronutrient data yet — pick a USDA food or scan a label.
                              </Text>
                            )}
                          </View>
                        </>
                      ) : null}
                    </View>
                    </View>

                    <View style={styles.logFoodPanel}>
                      <Text style={styles.logFoodPanelTitle}>Serving size</Text>
                      <View style={styles.logFoodModeRow}>
                        <TouchableOpacity
                          style={[styles.logFoodModePill, portionInputMode === 'precise' && styles.logFoodModePillOn]}
                          onPress={() => {
                            if (portionInputMode === 'simple') exitLogFoodSimpleMode();
                            setPortionInputMode('precise');
                          }}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityState={{ selected: portionInputMode === 'precise' }}
                        >
                          <Text
                            style={[
                              styles.logFoodModePillText,
                              portionInputMode === 'precise' && styles.logFoodModePillTextOn,
                            ]}
                          >
                            Precise
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.logFoodModePill, portionInputMode === 'simple' && styles.logFoodModePillOn]}
                          onPress={() => {
                            if (portionInputMode !== 'simple') enterLogFoodSimpleMode();
                          }}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityState={{ selected: portionInputMode === 'simple' }}
                        >
                          <Text
                            style={[
                              styles.logFoodModePillText,
                              portionInputMode === 'simple' && styles.logFoodModePillTextOn,
                            ]}
                          >
                            Simple
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {portionInputMode === 'simple' ? (
                        <>
                          <Text style={styles.logFoodModeHint}>
                            Amounts scale from one whole ({inferDisplayWholeName(mealNameInput)}). Switch to Precise for
                            grams, cups, or liquids.
                          </Text>
                          <SimplePortionControl
                            fraction={naturalFraction}
                            onFractionChange={applyLogFoodSimpleFraction}
                            wholeName={inferDisplayWholeName(mealNameInput)}
                            visible
                          />
                        </>
                      ) : (
                        <ServingTypeWheelPicker
                          value={mealInput.servingUnit as LogFoodServingUnit}
                          onChange={(unit) => {
                            if (mealInput.servingUnit === unit) return;
                            updateLogFoodPortion(
                              { servingUnit: unit },
                              { convertUnitFrom: mealInput.servingUnit as LogFoodServingUnit }
                            );
                          }}
                        />
                      )}

                      <View style={styles.logFoodStepperRow}>
                        <Text style={styles.logFoodStepperLabel}>Serving size</Text>
                        <View style={styles.logFoodStepper}>
                          <TouchableOpacity style={styles.logFoodStepBtn} onPress={() => bumpLogServingSize(-0.25)} accessibilityLabel="Decrease serving size">
                            <Text style={styles.logFoodStepBtnText}>−</Text>
                          </TouchableOpacity>
                          <TextInput
                            style={styles.logFoodStepperInput}
                            placeholder="1"
                            placeholderTextColor={AppTheme.textFaint}
                            keyboardType="decimal-pad"
                            value={mealInput.baseServingSize}
                            onChangeText={(text) => updateLogFoodPortion({ baseServingSize: text })}
                          />
                          <TouchableOpacity style={styles.logFoodStepBtn} onPress={() => bumpLogServingSize(0.25)} accessibilityLabel="Increase serving size">
                            <Text style={styles.logFoodStepBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.logFoodStepperRow}>
                        <Text style={styles.logFoodStepperLabel}>Total servings</Text>
                        <View style={styles.logFoodStepper}>
                          <TouchableOpacity style={styles.logFoodStepBtn} onPress={() => bumpLogServings(-0.25)} accessibilityLabel="Decrease servings">
                            <Text style={styles.logFoodStepBtnText}>−</Text>
                          </TouchableOpacity>
                          <TextInput
                            style={styles.logFoodStepperInput}
                            placeholder="1"
                            placeholderTextColor={AppTheme.textFaint}
                            keyboardType="decimal-pad"
                            value={mealInput.servings}
                            onChangeText={(text) => updateLogFoodPortion({ servings: text })}
                          />
                          <TouchableOpacity style={styles.logFoodStepBtn} onPress={() => bumpLogServings(0.25)} accessibilityLabel="Increase servings">
                            <Text style={styles.logFoodStepBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.logFoodTotalWeightRow}>
                        <Text style={styles.logFoodTotalWeightLabel}>Total meal weight (calculated)</Text>
                        <Text style={styles.logFoodTotalWeightValue}>{totalMealWeightLabel}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.logFoodAddBtn}
                      onPress={() => handleMealSubmit().catch(console.error)}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.logFoodAddBtnText}>
                        {logFoodEditingMealId ? '[  SAVE CHANGES  ]' : '[  + ADD TO LOG  ]'}
                      </Text>
                    </TouchableOpacity>

                    {logFoodEditingMealId ? (
                      <TouchableOpacity
                        style={styles.logFoodDeleteLoggedBtn}
                        onPress={() => {
                          const id = logFoodEditingMealId;
                          if (!id) return;
                          Alert.alert('Remove from log?', 'This deletes this meal entry. You can log it again anytime.', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => {
                                void (async () => {
                                  await deleteMeal(id);
                                  resetLogFoodForm();
                                  setShowLogFoodModal(false);
                                })();
                              },
                            },
                          ]);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.logFoodDeleteLoggedBtnText}>Delete from log</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      style={styles.nuModalSecondary}
                      onPress={() => handleSaveMeal().catch(console.error)}
                      disabled={!mealNameInput.trim()}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.nuModalSecondaryText, !mealNameInput.trim() && { opacity: 0.4 }]}>
                        Save as favorite (needs name)
                      </Text>
                    </TouchableOpacity>
                      </>
                    )}
                  </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <Modal
          visible={showEatingOutCoachModal}
          transparent
          animationType="none"
          onRequestClose={() => setShowEatingOutCoachModal(false)}
        >
          <View style={styles.logFoodOverlay}>
            <Pressable
              style={styles.logFoodBackdrop}
              onPress={tapOutsideToDismissKeyboard}
              accessibilityLabel="Dismiss keyboard"
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.logFoodKeyboardWrap}
              pointerEvents="box-none"
              keyboardVerticalOffset={Platform.OS === 'ios' ? 72 : 0}
            >
              <View style={[styles.nuModalCard, styles.logFoodModalCard]} pointerEvents="box-none">
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  automaticallyAdjustKeyboardInsets
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 12 }}
                >
                  <View style={styles.logFoodModalHeader}>
                    <Text style={styles.logFoodTitle}>Food coach</Text>
                    <TouchableOpacity
                      onPress={() => setShowEatingOutCoachModal(false)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Text style={styles.nuModalClose}>Done</Text>
                    </TouchableOpacity>
                  </View>

                  {!isGeminiApiKeyConfigured() ? (
                    <View style={[styles.logFoodPanel, styles.foodCoachKeyMissingPanel]}>
                      <Text style={styles.logFoodPanelTitle}>Gemini not configured</Text>
                      <Text style={[styles.nuDetailsText, { marginTop: 8 }]}>
                        {getGeminiSetupHint()}
                      </Text>
                      <Text style={[styles.nuDetailsTextMuted, { marginTop: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                        EXPO_PUBLIC_GEMINI_PROXY_URL=http://localhost:8080
                      </Text>
                      <Text style={[styles.nuDetailsTextMuted, { marginTop: 10 }]}>
                        Run <Text style={{ fontWeight: '600' }}>npm run gemini-proxy:sync</Text> then{' '}
                        <Text style={{ fontWeight: '600' }}>npm run gemini-proxy</Text>. Restart Metro with{' '}
                        <Text style={{ fontWeight: '600' }}>npx expo start --clear</Text>. Dev fallback: keep{' '}
                        <Text style={{ fontWeight: '600' }}>EXPO_PUBLIC_GEMINI_API_KEY</Text> in .env.local.
                      </Text>
                    </View>
                  ) : null}

                  {renderLogFoodStyleNutritionBlock(remaining, { panelTitle: 'Macro budget (today)' })}

                  <View style={styles.logFoodPanel}>
                    <Text style={styles.logFoodPanelTitle}>Restaurant or meal</Text>
                    <TextInput
                      style={[
                        styles.logFoodNameInput,
                        { marginTop: 0, minHeight: 96, maxHeight: 168, textAlignVertical: 'top' },
                      ]}
                      placeholder="Example: Dinner at Olive Garden — what should I order?"
                      placeholderTextColor={AppTheme.textFaint}
                      value={eatingOutQuery}
                      onChangeText={setEatingOutQuery}
                      autoCorrect={false}
                      autoComplete="off"
                      spellCheck={false}
                      textContentType="none"
                      multiline
                      editable={!eatingOutCoachLoading && isGeminiApiKeyConfigured()}
                      scrollEnabled
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.logFoodAddBtn,
                      (eatingOutCoachLoading || !isGeminiApiKeyConfigured()) && styles.eatingOutCoachBtnDisabled,
                    ]}
                    onPress={() => submitEatingOutCoach().catch(console.error)}
                    disabled={eatingOutCoachLoading || !isGeminiApiKeyConfigured()}
                    activeOpacity={0.88}
                  >
                    {eatingOutCoachLoading ? (
                      <ActivityIndicator color={AppTheme.accentDark} />
                    ) : (
                      <Text style={styles.logFoodAddBtnText}>[  + GET SUGGESTIONS  ]</Text>
                    )}
                  </TouchableOpacity>

                  {eatingOutCoachError ? (
                    <Text style={styles.eatingOutCoachErrorText}>{eatingOutCoachError}</Text>
                  ) : null}

                  {eatingOutCoachPayload ? (
                    <View style={styles.logFoodPanel}>
                      <Text style={styles.logFoodPanelTitle}>Suggestions</Text>
                      {eatingOutCoachPayload.summary ? (
                        <Text style={[styles.nuDetailsText, { marginBottom: 12 }]} selectable>
                          {eatingOutCoachPayload.summary}
                        </Text>
                      ) : null}
                      {eatingOutCoachPayload.parseWarning ? (
                        <Text style={[styles.nuDetailsTextMuted, { marginBottom: 8 }]}>{eatingOutCoachPayload.parseWarning}</Text>
                      ) : null}
                      {eatingOutCoachPayload.suggestions.map((pick) => (
                        <View key={`${pick.rank}-${pick.meal}`} style={styles.eatingOutCoachPickCard}>
                          <Text style={styles.eatingOutCoachPickRank}>#{pick.rank}</Text>
                          <Text style={styles.eatingOutCoachPickTitle} selectable>
                            {pick.meal}
                          </Text>
                          <Text style={styles.eatingOutCoachPickMacros} selectable>
                            {formatEatingOutCoachMacroStrip(pick)}
                          </Text>
                          {pick.description ? (
                            <Text style={styles.eatingOutCoachPickBody} selectable>
                              {pick.description}
                            </Text>
                          ) : null}
                          {pick.pro_hack ? (
                            <View style={styles.eatingOutCoachProHack}>
                              <Text style={styles.eatingOutCoachProHackLabel}>Pro hack</Text>
                              <Text style={styles.eatingOutCoachProHackText} selectable>
                                {pick.pro_hack}
                              </Text>
                            </View>
                          ) : null}
                          {pick.side_variations.length > 0 ? (
                            <View style={styles.eatingOutCoachSides}>
                              <Text style={styles.eatingOutCoachSidesTitle}>Variety within your macros</Text>
                              {pick.side_variations.map((line, i) => (
                                <Text key={i} style={styles.eatingOutCoachSideLine} selectable>
                                  • {line}
                                </Text>
                              ))}
                            </View>
                          ) : null}
                          <TouchableOpacity
                            style={styles.eatingOutCoachLogBtn}
                            onPress={() => applyEatingOutPickToLogFood(pick)}
                            activeOpacity={0.88}
                            accessibilityLabel={`Add ${pick.meal} to log food`}
                          >
                            <Text style={styles.eatingOutCoachLogBtnText}>Add to Log food</Text>
                            <Text style={styles.eatingOutCoachLogBtnHint}>Tap to open Log food — adjust servings if you ate a portion</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                      {eatingOutCoachPayload.rawFallback &&
                      (eatingOutCoachPayload.suggestions.length === 0 || eatingOutCoachPayload.parseWarning) ? (
                        <Text style={[styles.nuDetailsText, { marginTop: 10, fontSize: 12 }]} selectable>
                          {eatingOutCoachPayload.rawFallback}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <Text
                    style={[styles.nuOptimizeHint, { marginTop: eatingOutCoachPayload?.suggestions?.length ? 6 : 14 }]}
                  >
                    Menu data is approximate (typical items), not live nutrition labels. Adjust for your body and any medical guidance you follow.
                  </Text>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <Modal
          visible={showEatingOutHistoryModal}
          transparent
          animationType="none"
          onRequestClose={() => setShowEatingOutHistoryModal(false)}
        >
          <View style={styles.nuModalOverlay}>
            <View style={[styles.nuModalCard, styles.eatingOutHistoryModalCard]}>
              <View style={styles.eatingOutHistoryModalHeader}>
                <Text style={styles.nuModalTitle}>Past inquiries</Text>
                <View style={styles.eatingOutHistoryModalHeaderActions}>
                  {eatingOutCoachHistory.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          'Clear history?',
                          'Remove all saved food coach results from this device.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Clear',
                              style: 'destructive',
                              onPress: () => {
                                setEatingOutCoachHistory([]);
                                AsyncStorage.removeItem(EATING_OUT_COACH_HISTORY_KEY).catch(() => {});
                                setShowEatingOutHistoryModal(false);
                              },
                            },
                          ]
                        );
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.eatingOutHistoryClearText}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => setShowEatingOutHistoryModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.nuModalClose}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.eatingOutHistoryModalHint}>
                Results stay on your phone so you can reopen them if the connection drops.
              </Text>
              <ScrollView style={styles.eatingOutHistoryScroll} keyboardShouldPersistTaps="handled">
                {eatingOutCoachHistory.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.eatingOutHistoryRow}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (!isPremium) {
                        presentUpgrade();
                        return;
                      }
                      setEatingOutQuery(item.query);
                      setEatingOutCoachPayload(item.payload);
                      setEatingOutCoachError(null);
                      setShowEatingOutHistoryModal(false);
                      setShowEatingOutCoachModal(true);
                    }}
                  >
                    <Text style={styles.eatingOutHistoryRowTime}>{formatEatingOutHistoryStamp(item.savedAt)}</Text>
                    <Text style={styles.eatingOutHistoryRowQuery} numberOfLines={3}>
                      {item.query}
                    </Text>
                    <Text style={styles.eatingOutHistoryRowMeta}>
                      {item.payload.suggestions.length} suggestion{item.payload.suggestions.length === 1 ? '' : 's'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={showAdjustGoalsModal} transparent animationType="none" onRequestClose={() => setShowAdjustGoalsModal(false)}>
          <View style={styles.nuModalOverlay}>
            <View style={[styles.nuModalCard, { maxHeight: '88%' }]}>
              <Text style={styles.nuModalTitle}>Adjust macro goals</Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.editGoalsForm}>
                  <View style={styles.editGoalRow}>
                    <Text style={styles.editGoalLabel}>Protein (g)</Text>
                    <TextInput
                      style={styles.editGoalInput}
                      value={editGoals.protein}
                      onChangeText={(text) => setEditGoals((prev) => ({ ...prev, protein: text }))}
                      keyboardType="numeric"
                      placeholder="150"
                    />
                  </View>
                  <View style={styles.editGoalRow}>
                    <Text style={styles.editGoalLabel}>Carbs (g)</Text>
                    <TextInput
                      style={styles.editGoalInput}
                      value={editGoals.carbs}
                      onChangeText={(text) => setEditGoals((prev) => ({ ...prev, carbs: text }))}
                      keyboardType="numeric"
                      placeholder="250"
                    />
                  </View>
                  <View style={styles.editGoalRow}>
                    <Text style={styles.editGoalLabel}>Fat (g)</Text>
                    <TextInput
                      style={styles.editGoalInput}
                      value={editGoals.fat}
                      onChangeText={(text) => setEditGoals((prev) => ({ ...prev, fat: text }))}
                      keyboardType="numeric"
                      placeholder="80"
                    />
                  </View>
                  <View style={styles.editGoalRow}>
                    <Text style={styles.editGoalLabel}>Water (oz)</Text>
                    <TextInput
                      style={styles.editGoalInput}
                      value={editGoals.water}
                      onChangeText={(text) => setEditGoals((prev) => ({ ...prev, water: text }))}
                      keyboardType="numeric"
                      placeholder="64"
                    />
                  </View>
                  {editGoals.protein && editGoals.carbs && editGoals.fat && (
                    <View style={styles.calculatedCaloriesGoal}>
                      <Text style={styles.calculatedCaloriesGoalText}>
                        Calculated daily calories:{' '}
                        {calculateCaloriesFromMacros(
                          parseInt(editGoals.protein, 10) || 0,
                          parseInt(editGoals.carbs, 10) || 0,
                          parseInt(editGoals.fat, 10) || 0
                        )}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
              <View style={styles.nuModalBtnRow}>
                <TouchableOpacity
                  style={[styles.nuModalGhost, { flex: 1 }]}
                  onPress={() => {
                    handleCancelEdit();
                    setShowAdjustGoalsModal(false);
                  }}
                >
                  <Text style={styles.nuModalGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nuModalPrimary, { flex: 1, marginTop: 0 }]}
                  onPress={async () => {
                    await handleSaveGoals();
                    setShowAdjustGoalsModal(false);
                  }}
                >
                  <Text style={styles.nuModalPrimaryText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={mealSlotSheet !== null}
          transparent
          animationType="none"
          onRequestClose={() => {
            setMealSlotSheet(null);
          }}
        >
          <View style={styles.nuModalOverlay}>
            <View style={[styles.nuModalCard, { maxHeight: '88%' }]}>
              {mealSlotSheet
                ? (() => {
                    const list = todayMeals.filter((m) => inferMealSlot(m) === mealSlotSheet);
                    const t = list.reduce(
                      (a, m) => ({
                        cal: a.cal + (Number(m.calories) || 0),
                        p: a.p + (Number(m.protein) || 0),
                        c: a.c + (Number(m.carbs) || 0),
                        f: a.f + (Number(m.fat) || 0),
                      }),
                      { cal: 0, p: 0, c: 0, f: 0 }
                    );
                    const slotLabel = mealSlotRows.find((r) => r.id === mealSlotSheet)?.label ?? '';
                    return (
                      <>
                        <View style={styles.mealSlotSheetTopBar}>
                          <Text style={styles.mealSlotSheetTitle}>{slotLabel}</Text>
                          <TouchableOpacity
                            style={styles.mealSlotSheetCloseBtn}
                            onPress={() => {
                              setMealSlotSheet(null);
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text style={styles.nuModalClose}>Close</Text>
                          </TouchableOpacity>
                        </View>
                        {renderLogFoodStyleNutritionBlock(
                          { calories: t.cal, protein: t.p, carbs: t.c, fat: t.f },
                          { panelTitle: 'Meal total' }
                        )}
                      </>
                    );
                  })()
                : null}
              <ScrollView showsVerticalScrollIndicator={false} style={styles.mealSlotSheetScroll}>
                {mealSlotSheet &&
                  todayMeals
                    .filter((m) => inferMealSlot(m) === mealSlotSheet)
                    .map((meal) => {
                      const portionLine = formatMealPortionLine(meal);
                      return (
                        <View key={meal.id} style={styles.mealSlotItemRow}>
                          <TouchableOpacity
                            style={styles.mealSlotItemMainTap}
                            onPress={() => openMealInLogFoodForEdit(meal)}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={`View ${meal.name} nutrition`}
                          >
                            <View style={styles.mealSlotItemTextCol}>
                              <Text style={styles.mealSlotItemName}>{meal.name}</Text>
                              {portionLine ? (
                                <Text style={styles.mealSlotItemPortion}>{portionLine}</Text>
                              ) : null}
                            </View>
                            <Text style={styles.nuChevron}>›</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.mealCopyBtnCompact}
                            onPress={() => {
                              setMealSlotSheet(null);
                              startCopyMealToDay(meal);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel={`Copy ${meal.name} to another day`}
                          >
                            <Text style={styles.mealCopyBtnText}>Copy</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                {mealSlotSheet && todayMeals.filter((m) => inferMealSlot(m) === mealSlotSheet).length === 0 && (
                  <Text style={styles.nuDetailsTextMuted}>Nothing logged for this meal yet.</Text>
                )}
              </ScrollView>
              <TouchableOpacity
                style={[styles.nuModalPrimary, { marginTop: 12 }]}
                onPress={() => {
                  setMealSlotSheet(null);
                  setLogFoodEditingMealId(null);
                  setLogFoodSlot(mealSlotSheet || defaultSlotNow());
                  setShowLogFoodModal(true);
                }}
              >
                <Text style={styles.nuModalPrimaryText}>Add to this meal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
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

      const { isAnyExpoHealthMetricEnabled } = await import('./src/utils/healthDataPermissions');
      if (!(await isAnyExpoHealthMetricEnabled())) {
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
              Enable "Watch & Apple Health sync" in Settings → Settings → Permissions, then tap Refresh to load data from Apple Health and your wearable
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
                    Connect your Apple Watch or wearable and allow Apple Health access to see trends
                  </Text>
                </View>
              )}
          </>
        )}
      </ScrollView>
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
        planToEdit={planToEdit ?? undefined}
        onBack={() => {
          setShowBuildYourOwnScreen(false);
          setPlanToEdit(null);
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
        onEditPlan={(plan) => {
          setSelectedSavedPlan(null);
          setPlanToEdit(plan);
          setShowBuildYourOwnScreen(true);
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {activeTab === 'nutrition' ? 'Nutrition' : activeTab === 'history' ? 'History' : 'Workout'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.fitnessMainContent}>
        <TabSwipeNavigation
          tabs={['workouts', 'nutrition', 'history']}
          activeTab={activeTab}
          onTabChange={(tab) => updateFitnessTab(tab as FitnessMainTab)}
        >
          {activeTab === 'workouts' ? (
            renderWorkouts()
          ) : activeTab === 'nutrition' ? (
            renderNutrition()
          ) : (
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {activeTab === 'history' && renderHistory()}
            </ScrollView>
          )}
        </TabSwipeNavigation>
      </View>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        visible={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onManualEntry={() => setShowBarcodeScanner(false)}
        onFoodScanned={handleFoodScanned}
        onScanNotFound={handleBarcodeScanNotFound}
        onScanError={handleBarcodeScanError}
      />

      {/* notifications removed */}
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
    borderBottomColor: AppTheme.border,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: AppTheme.accent,
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
  fitnessMainContent: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  tabContent: {
    flex: 1,
  },
  workoutsContentScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  workoutsContentContainer: {
    paddingBottom: 24,
  },
  nutritionContentScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  nutritionContentContainer: {
    paddingBottom: 24,
  },
  nuRoot: {
    backgroundColor: '#0f0f0f',
  },
  nuScrollContent: {
    paddingBottom: 28,
  },
  nuCard: {
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  nuCardHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  nuCalorieTextCol: {
    width: '100%',
  },
  nuCalorieBig: {
    fontSize: 19,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  nuCalorieUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  nuBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2a2a2a',
    overflow: 'hidden',
  },
  nuBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  nuMacroCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nuMacroAdjustBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(77, 171, 247, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(77, 171, 247, 0.45)',
  },
  nuMacroAdjustBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dbeafe',
    letterSpacing: 0.2,
  },
  nuMacroFoot: {
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2e2e2e',
  },
  nuMacroLine: {
    marginBottom: 10,
  },
  nuHistModeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  nuHistChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.borderMuted,
    alignItems: 'center',
  },
  nuHistChipOn: {
    borderColor: 'rgba(0, 255, 136, 0.55)',
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
  },
  nuHistChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppTheme.textMuted,
  },
  nuHistChipTextOn: {
    color: AppTheme.accent,
  },
  nuHistSpanRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  nuHistSpanChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.borderMuted,
  },
  nuHistSpanChipOn: {
    borderColor: 'rgba(77, 171, 247, 0.55)',
    backgroundColor: 'rgba(77, 171, 247, 0.14)',
  },
  nuHistSpanText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppTheme.textMuted,
  },
  nuHistSpanTextOn: {
    color: '#7ec8ff',
  },
  nuHistChartScroll: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 4,
    paddingRight: 8,
  },
  nuHistBarCol: {
    width: 40,
    alignItems: 'center',
    marginRight: 6,
  },
  nuHistBarValue: {
    fontSize: 10,
    fontWeight: '700',
    color: AppTheme.textSecondary,
    marginBottom: 4,
    maxWidth: 52,
    textAlign: 'center',
  },
  nuHistBarTrack: {
    height: 88,
    width: 20,
    borderRadius: 5,
    backgroundColor: AppTheme.inputBg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  nuHistBarFill: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: AppTheme.accent,
    minHeight: 2,
  },
  nuHistBarLabel: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: '700',
    color: AppTheme.textMuted,
    textAlign: 'center',
    lineHeight: 11,
    maxWidth: 52,
  },
  nuMacroLineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  nuMacroName: {
    flex: 1,
    fontSize: 13,
    color: '#e5e5e5',
    fontWeight: '600',
  },
  nuMacroAmount: {
    fontSize: 12,
    color: '#9ca3af',
    marginRight: 6,
  },
  nuMacroPct: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    width: 32,
    textAlign: 'right',
  },
  nuDetailsText: {
    fontSize: 12,
    color: '#d1d5db',
    lineHeight: 17,
    marginBottom: 4,
  },
  nuDetailsTextMuted: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 15,
  },
  nuQuickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 6,
  },
  nuQuickTile: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  nuQuickGreen: {
    backgroundColor: 'rgba(0, 255, 136, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.45)',
  },
  /** Solid accent — matches workout primary CTA (`nuOptimizeBtn` scale) for Log Food. */
  nuLogFoodCta: {
    backgroundColor: '#00ff88',
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#00ff88',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
    }),
  },
  nuLogFoodCtaIcon: {
    color: '#0a0a0a',
    fontSize: 20,
    fontWeight: '800',
  },
  nuLogFoodCtaLabel: {
    color: '#0a0a0a',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  nuQuickBlue: {
    backgroundColor: 'rgba(77, 171, 247, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(77, 171, 247, 0.45)',
  },
  nuQuickPurple: {
    backgroundColor: 'rgba(180, 130, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(180, 130, 255, 0.45)',
  },
  nuQuickAmber: {
    backgroundColor: 'rgba(251, 191, 36, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.42)',
  },
  nuQuickTileActiveTemplates: {
    borderColor: 'rgba(251, 191, 36, 0.75)',
    borderWidth: 2,
    backgroundColor: 'rgba(251, 191, 36, 0.22)',
  },
  nuQuickTileActivePurple: {
    borderColor: 'rgba(180, 130, 255, 0.75)',
    borderWidth: 2,
    backgroundColor: 'rgba(180, 130, 255, 0.28)',
  },
  woQuickTilesWrap: {
    marginBottom: 10,
  },
  woQuickRowLast: {
    marginBottom: 10,
  },
  woStartBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  woStartBtnIconNu: {
    fontSize: 14,
    color: '#0a0a0a',
    fontWeight: '900',
  },
  woPlanSectionSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
    textAlign: 'left',
  },
  nuQuickTileActiveHist: {
    borderColor: 'rgba(0, 255, 136, 0.55)',
    borderWidth: 2,
    backgroundColor: 'rgba(180, 130, 255, 0.28)',
  },
  nuQuickTileActiveCoach: {
    borderColor: 'rgba(77, 171, 247, 0.85)',
    borderWidth: 2,
    backgroundColor: 'rgba(77, 171, 247, 0.32)',
  },
  nuQuickIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  nuQuickLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f3f4f6',
    textAlign: 'center',
  },
  nuPremiumPill: {
    marginTop: 4,
    fontSize: 8,
    fontWeight: '800',
    color: AppTheme.accent,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  eatingOutCoachBtnDisabled: {
    opacity: 0.65,
  },
  eatingOutHistoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusRow,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.28)',
  },
  eatingOutHistoryBarIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  eatingOutHistoryBarTextCol: {
    flex: 1,
    minWidth: 0,
  },
  eatingOutHistoryBarTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: AppTheme.accent,
    letterSpacing: 0.2,
  },
  eatingOutHistoryBarSub: {
    fontSize: 11,
    color: AppTheme.textMuted,
    marginTop: 2,
  },
  eatingOutHistoryBarBadge: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 255, 136, 0.18)',
    marginRight: 6,
  },
  eatingOutHistoryBarBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: AppTheme.accent,
    textAlign: 'center',
  },
  eatingOutHistoryModalCard: {
    maxHeight: '82%',
    width: '100%',
  },
  eatingOutHistoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 12,
  },
  eatingOutHistoryModalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  eatingOutHistoryClearText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f87171',
  },
  eatingOutHistoryModalHint: {
    fontSize: 12,
    color: AppTheme.textMuted,
    lineHeight: 17,
    marginBottom: 12,
  },
  eatingOutHistoryScroll: {
    maxHeight: 420,
  },
  eatingOutHistoryRow: {
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.borderMuted,
    paddingVertical: 14,
    paddingHorizontal: 2,
  },
  eatingOutHistoryRowTime: {
    fontSize: 12,
    fontWeight: '700',
    color: AppTheme.accent,
  },
  eatingOutHistoryRowQuery: {
    fontSize: 15,
    fontWeight: '600',
    color: AppTheme.textPrimary,
    marginTop: 6,
    lineHeight: 21,
  },
  eatingOutHistoryRowMeta: {
    fontSize: 12,
    color: AppTheme.textMuted,
    marginTop: 8,
  },
  foodCoachKeyMissingPanel: {
    borderColor: AppTheme.accent,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 212, 170, 0.08)',
  },
  eatingOutCoachErrorText: {
    marginTop: 10,
    fontSize: 13,
    color: '#f87171',
    lineHeight: 18,
  },
  eatingOutCoachPickCard: {
    backgroundColor: AppTheme.inputBg,
    borderRadius: AppTheme.radiusRow,
    borderWidth: 1,
    borderColor: AppTheme.borderMuted,
    padding: 14,
    marginBottom: 12,
  },
  eatingOutCoachPickRank: {
    fontSize: 11,
    fontWeight: '800',
    color: AppTheme.accent,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  eatingOutCoachPickTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: AppTheme.textPrimary,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  eatingOutCoachPickMacros: {
    fontSize: 14,
    fontWeight: '700',
    color: AppTheme.textSecondary,
    marginBottom: 10,
    lineHeight: 20,
  },
  eatingOutCoachPickBody: {
    fontSize: 14,
    color: AppTheme.textSecondary,
    lineHeight: 21,
    marginBottom: 10,
  },
  eatingOutCoachProHack: {
    backgroundColor: 'rgba(0, 255, 136, 0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.22)',
    padding: 10,
    marginBottom: 10,
  },
  eatingOutCoachProHackLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: AppTheme.accent,
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  eatingOutCoachProHackText: {
    fontSize: 13,
    color: AppTheme.textPrimary,
    lineHeight: 19,
  },
  eatingOutCoachSides: {
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
  },
  eatingOutCoachSidesTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: AppTheme.textMuted,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  eatingOutCoachSideLine: {
    fontSize: 13,
    color: AppTheme.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  eatingOutCoachLogBtn: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: AppTheme.radiusButton,
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.38)',
    alignItems: 'center',
  },
  eatingOutCoachLogBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: AppTheme.accent,
    letterSpacing: 0.35,
  },
  eatingOutCoachLogBtnHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: AppTheme.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
  nuSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  nuMealSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  nuMealSlotMid: {
    flex: 1,
  },
  nuMealSlotTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  nuMealSlotSub: {
    fontSize: 12,
    color: '#9ca3af',
  },
  nuChevron: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '300',
  },
  nuOptimizeBtn: {
    backgroundColor: '#00ff88',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  nuOptimizeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  nuOptimizeHint: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  woStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 2,
  },
  woStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  woStatIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  woStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f3f4f6',
  },
  woStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  woLogPastLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4dabf7',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 0,
  },
  woPreviousButton: {
    backgroundColor: '#243024',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00ff88',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  woPreviousButtonText: {
    color: '#00ff88',
    fontSize: 15,
    fontWeight: '700',
  },
  woExpandBlock: {
    marginBottom: 10,
  },
  woListCard: {
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    paddingVertical: 4,
    marginBottom: 10,
  },
  woListEmpty: {
    fontSize: 12,
    color: '#6b7280',
    paddingHorizontal: 12,
    paddingVertical: 12,
    lineHeight: 17,
  },
  woPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  woPlanIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  woPlanMid: {
    flex: 1,
  },
  woPlanTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  woMoreHint: {
    fontSize: 13,
    color: '#6b7280',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: '600',
  },
  woProgScrollContent: {
    paddingRight: 16,
    paddingBottom: 4,
  },
  woProgCard: {
    width: 200,
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    padding: 12,
    marginRight: 10,
  },
  woProgTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    minHeight: 36,
  },
  woProgTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2a2a2a',
    overflow: 'hidden',
    marginBottom: 10,
  },
  woProgFill: {
    height: '100%',
    borderRadius: 3,
  },
  woProgMeta: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 4,
  },
  woProgLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00ff88',
  },
  woRecentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  woRecentIcon: {
    fontSize: 14,
    fontWeight: '800',
    color: '#00ff88',
    width: 24,
  },
  woRecentIconSkip: {
    color: '#f87171',
  },
  woRecentText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  woRecentTextMuted: {
    color: '#9ca3af',
  },
  woOptimizeBtn: {
    backgroundColor: '#14532d',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.35)',
  },
  woOptimizeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e8ffef',
  },
  nuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  nuModalAvoid: {
    maxHeight: '92%',
  },
  nuModalCard: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  nuModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nuModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  nuModalClose: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00ff88',
  },
  nuModalNavArrow: {
    fontSize: 22,
    lineHeight: 26,
  },
  nuModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  nuModalMiniBtn: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  nuModalMiniBtnText: {
    color: '#00ff88',
    fontWeight: '700',
    fontSize: 14,
  },
  nuModalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 6,
    marginTop: 10,
  },
  nuModalInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  nuSlotChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  nuSlotChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  nuSlotChipOn: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderColor: '#00ff88',
  },
  nuSlotChipText: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '600',
  },
  nuSlotChipTextOn: {
    color: '#00ff88',
  },
  nuUnitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  nuModalRow2: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  nuModalPrimary: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  nuModalPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  nuModalSecondary: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  nuModalSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00ff88',
  },
  nuModalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  nuModalGhost: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  nuModalGhostText: {
    color: '#e5e5e5',
    fontWeight: '600',
    fontSize: 15,
  },
  logFoodOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  logFoodBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  logFoodKeyboardWrap: {
    width: '100%',
    maxHeight: '94%',
    zIndex: 1,
  },
  logFoodModalCard: {
    backgroundColor: AppTheme.bgElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: AppTheme.border,
    paddingBottom: 28,
    maxHeight: '94%',
  },
  logFoodModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logFoodTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: AppTheme.textPrimary,
    letterSpacing: 0.3,
  },
  logFoodTopActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  logFoodSubPanelTitle: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    color: AppTheme.textMuted,
    letterSpacing: 0.3,
  },
  logFoodMealSlotList: {
    gap: 8,
    marginBottom: 4,
  },
  logFoodMealSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  logFoodMealSlotRowOn: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
  },
  logFoodMealSlotRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: AppTheme.textSecondary,
  },
  logFoodMealSlotRowLabelOn: {
    color: AppTheme.accent,
  },
  logFoodScanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: AppTheme.radiusButton,
    borderWidth: 2,
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0, 255, 136, 0.06)',
  },
  logFoodBarcodeIcon: {
    fontSize: 14,
    color: AppTheme.accent,
    letterSpacing: 1,
    fontWeight: '700',
  },
  logFoodScanBtnText: {
    color: AppTheme.accent,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.6,
  },
  logFoodSavedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: AppTheme.radiusButton,
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.borderMuted,
  },
  logFoodSavedStar: {
    fontSize: 16,
    color: AppTheme.textSecondary,
  },
  logFoodSavedBtnText: {
    color: AppTheme.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  logFoodSuggestPanel: {
    marginTop: 12,
    maxHeight: 400,
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 0,
  },
  logFoodSuggestScroll: {
    maxHeight: 360,
  },
  logFoodSuggestScrollContent: {
    paddingBottom: 6,
  },
  logFoodSuggestHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: AppTheme.textSecondary,
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 2,
  },
  logFoodSuggestHeaderUsda: {
    fontSize: 13,
    fontWeight: '700',
    color: AppTheme.textSecondary,
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 8,
  },
  logFoodSuggestRow: {
    backgroundColor: AppTheme.inputBg,
    borderRadius: AppTheme.radiusRow,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  logFoodSuggestTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppTheme.textPrimary,
  },
  logFoodSuggestSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textMuted,
  },
  logFoodSuggestLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    marginBottom: 4,
  },
  logFoodSuggestMuted: {
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textMuted,
    paddingVertical: 8,
  },
  logFoodSuggestError: {
    fontSize: 12,
    lineHeight: 17,
    color: '#f87171',
    paddingVertical: 8,
    marginBottom: 4,
  },
  logFoodPanel: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 14,
    marginBottom: 12,
  },
  logFoodPanelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppTheme.textSecondary,
    marginBottom: 10,
    letterSpacing: 0.4,
  },
  logFoodItemCalorieBlock: {
    marginBottom: 14,
  },
  logFoodMealChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: AppTheme.radiusPill,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  logFoodMealChipOn: {
    backgroundColor: 'rgba(0, 255, 136, 0.18)',
    borderColor: AppTheme.accent,
    borderWidth: 2,
  },
  logFoodMealChipText: {
    fontSize: 13,
    color: AppTheme.textMuted,
    fontWeight: '600',
  },
  logFoodMealChipTextOn: {
    color: AppTheme.accent,
  },
  logFoodLoggingModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  logFoodModeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: AppTheme.radiusRow,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  logFoodModeChipOn: {
    backgroundColor: 'rgba(0, 255, 136, 0.14)',
    borderColor: AppTheme.accent,
  },
  logFoodModeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppTheme.textMuted,
  },
  logFoodModeChipTextOn: {
    color: AppTheme.accent,
  },
  logFoodAiQueryInput: {
    marginTop: 10,
    minHeight: 88,
    textAlignVertical: 'top',
    backgroundColor: AppTheme.inputBg,
    borderRadius: AppTheme.radiusRow,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: AppTheme.textPrimary,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  logFoodAiEstimateBtn: {
    marginTop: 14,
    marginBottom: 4,
  },
  logFoodAiEstimateCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: AppTheme.radiusRow,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  logFoodAiEstimateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    marginBottom: 6,
  },
  logFoodAiEstimateMacros: {
    fontSize: 14,
    fontWeight: '600',
    color: AppTheme.accent,
    marginBottom: 8,
  },
  logFoodAiEstimateAssumptions: {
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textMuted,
    marginBottom: 8,
  },
  logFoodAiEstimateItems: {
    marginBottom: 8,
  },
  logFoodAiEstimateItemLine: {
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textSecondary,
  },
  logFoodAiEstimateHint: {
    fontSize: 11,
    lineHeight: 16,
    color: AppTheme.textFaint,
  },
  logFoodNameInput: {
    marginTop: 12,
    backgroundColor: AppTheme.inputBg,
    borderRadius: AppTheme.radiusRow,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: AppTheme.textPrimary,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  logFoodAppliedFromSearchHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: AppTheme.accent,
  },
  logFoodScanNote: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textMuted,
  },
  logFoodMacroRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  logFoodMacroCol: {
    flex: 1,
  },
  logFoodMacroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: AppTheme.textMuted,
    marginBottom: 6,
  },
  logFoodMacroInput: {
    backgroundColor: 'transparent',
    borderBottomWidth: 3,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    textAlign: 'center',
  },
  logFoodMacroInputProtein: {
    borderBottomColor: AppTheme.accent,
  },
  logFoodMacroInputCarbs: {
    borderBottomColor: '#4dabf7',
  },
  logFoodMacroInputFat: {
    borderBottomColor: '#ff922b',
  },
  logFoodMicroSectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    color: AppTheme.textMuted,
    letterSpacing: 0.3,
  },
  logFoodMicroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  logFoodMicroTile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: AppTheme.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logFoodMicroIcon: {
    fontSize: 18,
  },
  logFoodMicroName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: AppTheme.textSecondary,
  },
  logFoodMicroVal: {
    fontSize: 11,
    fontWeight: '700',
    color: AppTheme.accent,
  },
  logFoodMicroValEmpty: {
    color: AppTheme.textFaint,
    fontWeight: '600',
  },
  logFoodMicroToggle: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  logFoodMicroToggleOn: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
  },
  logFoodMicroToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppTheme.textMuted,
    textAlign: 'center',
  },
  logFoodMicroToggleTextOn: {
    color: AppTheme.accent,
  },
  logFoodMicroAccordion: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  logFoodMicroAccordionOn: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0, 255, 136, 0.06)',
  },
  logFoodMicroAccordionChevron: {
    fontSize: 13,
    fontWeight: '700',
    color: AppTheme.textMuted,
    minWidth: 18,
  },
  logFoodMicroAccordionTextCol: {
    flex: 1,
    minWidth: 0,
  },
  logFoodMicroAccordionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppTheme.textPrimary,
  },
  logFoodMicroAccordionSub: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '500',
    color: AppTheme.textMuted,
    lineHeight: 15,
  },
  logFoodUnitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 14,
  },
  logFoodModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  logFoodModePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: AppTheme.radiusPill,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  logFoodModePillOn: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0, 255, 136, 0.14)',
    borderWidth: 2,
  },
  logFoodModePillText: {
    fontSize: 13,
    fontWeight: '800',
    color: AppTheme.textMuted,
  },
  logFoodModePillTextOn: {
    color: AppTheme.accent,
  },
  logFoodModeHint: {
    fontSize: 12,
    color: AppTheme.textMuted,
    lineHeight: 17,
    marginBottom: 4,
  },
  logFoodUnitPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: AppTheme.radiusPill,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  logFoodUnitPillOn: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderColor: AppTheme.accent,
    borderWidth: 2,
  },
  logFoodUnitPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppTheme.textMuted,
  },
  logFoodUnitPillTextOn: {
    color: AppTheme.accent,
  },
  logFoodStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  logFoodStepperLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textSecondary,
    flex: 1,
  },
  logFoodStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logFoodStepBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logFoodStepBtnText: {
    fontSize: 22,
    fontWeight: '500',
    color: AppTheme.textPrimary,
    marginTop: -2,
  },
  logFoodStepperInput: {
    minWidth: 56,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    fontSize: 16,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    textAlign: 'center',
  },
  logFoodTotalWeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: AppTheme.borderMuted,
    marginTop: 4,
  },
  logFoodTotalWeightLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: AppTheme.textMuted,
    paddingRight: 8,
  },
  logFoodTotalWeightValue: {
    fontSize: 14,
    fontWeight: '800',
    color: AppTheme.accent,
  },
  logFoodAddBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
    shadowColor: AppTheme.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  },
  logFoodAddBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: AppTheme.accentDark,
    letterSpacing: 0.5,
  },
  logFoodDeleteLoggedBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 4,
  },
  logFoodDeleteLoggedBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f87171',
  },
  workoutBottomDock: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 6,
  },
  buildYourOwnDockButton: {
    backgroundColor: '#333',
    borderColor: '#00ff88',
  },
  buildYourOwnDockButtonText: {
    color: '#00ff88',
    fontWeight: '700',
  },
  logPastDockButton: {
    backgroundColor: '#2a2a2a',
    borderColor: '#00ff88',
  },
  logPastDockButtonText: {
    color: '#00ff88',
    fontWeight: '700',
  },
  nutritionBottomDock: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 6,
  },
  dockEqualButton: {
    flex: 1,
    minHeight: 40,
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  dockEqualButtonActive: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  dockEqualButtonPrimary: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  dockEqualButtonDisabled: {
    opacity: 0.45,
  },
  dockEqualButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#aaa',
    textAlign: 'center',
  },
  dockEqualButtonTextActive: {
    color: '#1a1a1a',
    fontWeight: '700',
  },
  dockEqualButtonTextDark: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
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
    gap: 6,
    marginBottom: 0,
    alignItems: 'stretch',
  },
  startWorkoutButton: {
    flex: 1,
    minHeight: 40,
    backgroundColor: '#00ff88',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildYourOwnButton: {
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: '#00ff88',
  },
  startWorkoutButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  buildYourOwnButtonText: {
    color: '#00ff88',
  },
  logPastWorkoutButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: '#00ff88',
  },
  logPastWorkoutButtonText: {
    color: '#00ff88',
  },
  workoutPrograms: {
    marginBottom: 10,
  },
  categoryTabsContainer: {
    marginBottom: 10,
  },
  categoryTabsScroll: {
    marginHorizontal: -16,
  },
  categoryTab: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryTabActive: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  categoryTabTextActive: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  programCard: {
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  programTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
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
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 6,
  },
  programDuration: {
    fontSize: 11,
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
    marginBottom: 8,
  },
  macroLabel: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
    flex: 1,
  },
  macroInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#fff',
    width: 92,
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
    marginTop: 4,
    alignItems: 'center',
  },
  unitPickerWrapper: {
    height: 120,
    width: 100,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  unitPickerScrollView: {
    height: 120,
  },
  unitPickerContentContainer: {
    paddingVertical: 40,
    paddingHorizontal: 8,
  },
  unitPickerItem: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unitPickerItemSelected: {
    backgroundColor: 'transparent',
  },
  unitPickerItemText: {
    fontSize: 13,
    color: 'rgba(0, 255, 136, 0.4)',
    fontWeight: '500',
  },
  unitPickerItemTextSelected: {
    color: '#00ff88',
    fontWeight: '600',
    fontSize: 13,
  },
  unitPickerSelectionIndicator: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    height: 40,
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
    height: 40,
    backgroundColor: '#2a2a2a',
    opacity: 0.6,
    zIndex: 1,
  },
  unitPickerOverlayBottom: {
    top: 'auto',
    bottom: 0,
  },
  unitPickerScrollIndicator: {
    position: 'absolute',
    top: 2,
    left: 0,
    right: 0,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  unitPickerScrollIndicatorBottom: {
    top: 'auto',
    bottom: 2,
  },
  unitPickerScrollIndicatorText: {
    fontSize: 12,
    color: 'rgba(0, 255, 136, 0.6)',
    fontWeight: 'bold',
  },
  unitLabel: {
    fontSize: 12,
    color: '#888',
    marginLeft: 6,
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
  calendarDayCopyMode: {
    borderWidth: 1,
    borderColor: 'rgba(126, 182, 255, 0.45)',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  calendarDayCopySource: {
    borderColor: 'rgba(255, 184, 77, 0.7)',
    backgroundColor: 'rgba(255, 184, 77, 0.12)',
  },
  copyModeBanner: {
    backgroundColor: 'rgba(126, 182, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(126, 182, 255, 0.35)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    gap: 6,
  },
  copyModeBannerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  copyModeBannerSub: {
    color: '#bbb',
    fontSize: 13,
    lineHeight: 18,
  },
  copyModeCancelBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
  copyModeCancelText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
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
    gap: 10,
  },
  dayDetailBubbleHeaderTap: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copyAllMealsBtn: {
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.45)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  copyAllMealsBtnText: {
    color: '#00ff88',
    fontSize: 12,
    fontWeight: '700',
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
  dayDetailItemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dayDetailItemTextCol: {
    flex: 1,
    minWidth: 0,
  },
  mealCopyBtn: {
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.45)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mealCopyBtnCompact: {
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.45)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  mealCopyBtnText: {
    color: '#00ff88',
    fontSize: 12,
    fontWeight: '700',
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
    padding: 14,
    marginBottom: 14,
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
    padding: 10,
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 3,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 3,
  },
  macroMiniRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  macroMiniBox: {
    flex: 1,
    backgroundColor: '#2e2e2e',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#444',
  },
  macroMiniBoxRemaining: {
    borderColor: '#4a4a4a',
  },
  macroMiniLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 1,
  },
  macroMiniValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  remainingText: {
    fontSize: 11,
    fontWeight: '600',
  },
  todayProgressTitle: {
    fontSize: 20,
    marginBottom: 10,
  },
  mealSection: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 12,
    marginBottom: 12,
  },
  mealSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  micronutrientsTabContainer: {
    marginTop: 8,
    marginBottom: 6,
  },
  micronutrientsTabButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  micronutrientsTabButtonActive: {
    backgroundColor: '#3a3a3a',
    borderColor: '#4ECDC4',
  },
  micronutrientsTabText: {
    color: '#888',
    fontSize: 12,
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
    padding: 8,
    marginBottom: 8,
    maxHeight: 180,
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
    marginTop: 8,
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
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  calculatedCaloriesText: {
    color: '#4ECDC4',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  perServingText: {
    color: '#aaa',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
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
    marginBottom: 8,
  },
  mealNameInputContainer: {
    position: 'relative',
    width: '100%',
  },
  mealInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    paddingRight: 40,
    fontSize: 13,
    color: '#fff',
    marginBottom: 8,
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
    backgroundColor: AppTheme.inputBg,
    borderRadius: AppTheme.radiusRow,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
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
    fontSize: 15,
    fontWeight: '700',
    color: AppTheme.textPrimary,
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
    color: AppTheme.textMuted,
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
    lineHeight: 17,
    color: AppTheme.textSecondary,
    marginRight: 10,
    marginBottom: 5,
  },
  mealSlotSheetTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  mealSlotSheetScroll: {
    flexGrow: 0,
    marginBottom: 4,
  },
  mealSlotSheetTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: AppTheme.textPrimary,
    lineHeight: 26,
  },
  mealSlotSheetCloseBtn: {
    flexShrink: 0,
  },
  mealSlotItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    paddingVertical: 6,
    paddingLeft: 14,
    paddingRight: 8,
    marginBottom: 8,
    gap: 8,
  },
  mealSlotItemMainTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    minWidth: 0,
  },
  mealSlotItemTextCol: {
    flex: 1,
    minWidth: 0,
  },
  mealSlotItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: AppTheme.textPrimary,
  },
  mealSlotItemPortion: {
    fontSize: 12,
    fontWeight: '600',
    color: AppTheme.textMuted,
    marginTop: 3,
  },
  mealSlotMacroValue: {
    borderBottomWidth: 3,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    textAlign: 'center',
  },
  mealSlotNutritionCard: {
    maxHeight: '82%',
    width: '100%',
    maxWidth: 400,
  },
  mealSlotNutritionSub: {
    fontSize: 12,
    color: AppTheme.textMuted,
    marginBottom: 12,
  },
  mealSlotNutritionCalBox: {
    backgroundColor: AppTheme.inputBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  mealSlotNutritionCalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: AppTheme.textMuted,
    marginBottom: 4,
  },
  mealSlotNutritionCalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: AppTheme.textPrimary,
  },
  mealSlotNutritionMacroRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  mealSlotNutritionMacroCol: {
    flex: 1,
    backgroundColor: AppTheme.inputBg,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    alignItems: 'center',
  },
  mealSlotNutritionMacroLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: AppTheme.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  mealSlotNutritionMacroValue: {
    fontSize: 16,
    fontWeight: '800',
    color: AppTheme.textPrimary,
  },
  mealSlotNutritionPortion: {
    fontSize: 12,
    color: AppTheme.textSecondary,
    marginBottom: 10,
  },
  mealSlotNutritionMicroScroll: {
    maxHeight: 160,
    marginBottom: 12,
  },
  mealSlotNutritionMicroTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: AppTheme.textMuted,
    marginBottom: 8,
  },
  mealSlotNutritionMicroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.borderMuted,
  },
  mealSlotNutritionMicroLabel: {
    flex: 1,
    fontSize: 12,
    color: AppTheme.textSecondary,
    marginRight: 8,
  },
  mealSlotNutritionMicroVal: {
    fontSize: 12,
    fontWeight: '700',
    color: AppTheme.accent,
  },
  mealSlotNutritionActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  mealSlotNutritionEditBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(78, 205, 196, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.5)',
    alignItems: 'center',
  },
  mealSlotNutritionEditBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#a5f3fc',
  },
  mealSlotNutritionDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
    alignItems: 'center',
  },
  mealSlotNutritionDeleteBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fca5a5',
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
  weightModalCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  weightModalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  weightModalIntro: {
    color: '#a1a1aa',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
    textAlign: 'center',
  },
  weightModalLabel: {
    color: '#e5e5e5',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  weightModalHint: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  weightModalInput: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 58,
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    fontVariant: ['tabular-nums'],
  },
  weightModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  weightModalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    minHeight: 54,
    borderRadius: 12,
  },
  weightModalBtnCancel: {
    backgroundColor: '#3a3a3a',
  },
  weightModalBtnSave: {
    backgroundColor: '#00ff88',
  },
  weightModalBtnTextCancel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  weightModalBtnTextSave: {
    color: '#1a1a1a',
    fontSize: 17,
    fontWeight: '700',
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
  editMealDeleteBtn: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 6,
  },
  editMealDeleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f87171',
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
  // Workout Plan Styles
  workoutPlanTabsContainer: {
    flexDirection: 'row',
    marginBottom: 10,
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
  historyChartsSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    marginBottom: 6,
  },
  historyChartsSectionHint: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginBottom: 16,
  },
  historyChartSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 14,
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
    marginBottom: 2,
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
    alignItems: 'flex-start',
  },
  weightGraphYAxis: {
    width: 48,
    justifyContent: 'space-between',
    paddingRight: 10,
    flexShrink: 0,
  },
  weightGraphYLabel: {
    color: '#a1a1aa',
    fontSize: 11,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  weightGraphMain: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  weightGraphSvg: {
    position: 'relative',
    marginBottom: 10,
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 8,
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
  weightGraphXAxisRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: 22,
    paddingHorizontal: 4,
    gap: 6,
  },
  weightGraphXLabelStart: {
    flex: 1,
    color: '#a1a1aa',
    fontSize: 11,
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  weightGraphXLabelCenter: {
    flex: 1,
    color: '#a1a1aa',
    fontSize: 11,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  weightGraphXLabelEnd: {
    flex: 1,
    color: '#a1a1aa',
    fontSize: 11,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  weightGraphXLabelSpacer: {
    flex: 1,
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
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  weightGraphStatLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 5,
  },
  weightGraphStatValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    maxWidth: '100%',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  // notifications removed
});



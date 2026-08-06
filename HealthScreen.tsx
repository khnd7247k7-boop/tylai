import React, { useState, useEffect, useCallback, useMemo, useDeferredValue, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  AppState,
  useWindowDimensions,
  Modal,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AppTextInput as TextInput } from './src/components/AppTextInput';
import { StatusBar } from 'expo-status-bar';
import Svg, {
  Polyline,
  Line,
  Circle,
  Rect,
  Defs,
  LinearGradient,
  Stop,
  Path,
  Text as SvgText,
} from 'react-native-svg';
import { AppTheme } from './src/theme/appVisualTheme';
import { loadUserData, saveUserData } from './src/utils/userStorage';
import { notifyUserDataReady } from './src/utils/userDataEvents';
import HistoryLineChart from './src/components/HistoryLineChart';
import {
  sessionsToPeakSetWeightPoints,
  sessionsToVolumePoints,
  sessionsToPrimaryLiftPoints,
  weightEntriesToPoints,
  type WeightEntry,
} from './src/utils/workoutHistoryChartData';
import { realizedE1RM, setVolumeLoad } from './src/utils/strengthMetrics';
import {
  PRIORITY_TRACKABLE_LIFTS,
  DEFAULT_TRACKED_LIFT_ID,
  encodeCustomLiftId,
  filterStrengthNamesForPicker,
  getTrackableLiftById,
  loadTrackedLiftId,
  saveTrackedLiftId,
} from './src/constants/trackableLifts';
import { useKeyboardInsets, KeyboardModalFrame, dismissKeyboard } from './src/keyboard';
import HealthService from './src/services/HealthService';
import HealthSyncSettingsSection from './src/components/HealthSyncSettingsSection';
import ProgressPhotoSettingsSection from './src/components/ProgressPhotoSettingsSection';
import type { WorkoutSession } from './data/workoutPrograms';

interface Meal {
  id: string;
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
  date: string;
}

interface NutritionGoals {
  protein: number;
  calories: number;
  carbs?: number;
  fat?: number;
}

/** Distinct colors for macro bars and matching target lines */
const MACRO_COLORS = {
  protein: '#00ff88',
  carbs: '#FFB84D',
  fat: '#7EB6FF',
} as const;

interface HealthScreenProps {
  onBack: () => void;
  /** When set, opens Trends with this chart expanded (e.g. from Nutrition → Calorie history menu). */
  initialTrendGraph?: TrendGraphId;
}

export type TrendGraphId =
  | 'e1rm'
  | 'liftVolume'
  | 'nutrition'
  | 'bodyWeight'
  | 'sessionPeak'
  | 'trainingVolume'
  | 'primaryLift';

const TREND_GRAPH_TOGGLES: { id: TrendGraphId; label: string; hint: string }[] = [
  { id: 'e1rm', label: 'Realized e1RM', hint: 'Weekly max estimated 1RM for a selected lift' },
  { id: 'liftVolume', label: 'Lift volume load', hint: 'Weekly volume for a selected lift' },
  { id: 'nutrition', label: 'Nutrition consistency', hint: 'Daily protein, carbs, and fat vs goals' },
  { id: 'bodyWeight', label: 'Body weight', hint: 'Scale weight over time' },
  { id: 'sessionPeak', label: 'Session peak weight', hint: 'Heaviest completed set each workout' },
  { id: 'trainingVolume', label: 'Training volume', hint: 'Weight × reps per session' },
  { id: 'primaryLift', label: 'Primary lift progress', hint: 'Trend for your most-logged exercise' },
];

const SCROLL_H_PAD = 40; // ScrollView paddingHorizontal 20 * 2
const CARD_H_PAD = 32; // card padding 16 * 2
const PLOT_H = 112;

/** Up to 4 distinct Y-axis tick values, evenly spaced, rounded (avoids label pile-up). */
function buildEvenYTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [Math.round(min)];
  const raw: number[] = [];
  for (let i = 0; i < count; i++) {
    raw.push(min + (i / (count - 1)) * (max - min));
  }
  const rounded = raw.map((t) => Math.round(t / 5) * 5);
  const uniq = [...new Set(rounded)].sort((a, b) => a - b);
  if (uniq.length >= 2) return uniq.slice(0, count);
  return [Math.floor(min / 10) * 10, Math.ceil(max / 10) * 10];
}

function buildMacroYTicks(maxVal: number): number[] {
  if (maxVal <= 0) return [0];
  const step = Math.max(25, Math.ceil(maxVal / 3 / 25) * 25);
  const ticks: number[] = [];
  for (let v = 0; v <= maxVal && ticks.length < 4; v += step) {
    ticks.push(Math.round(v));
  }
  const last = ticks[ticks.length - 1];
  if (last < maxVal && ticks.length < 4) {
    ticks.push(Math.round(maxVal));
  }
  return [...new Set(ticks)].sort((a, b) => a - b).slice(0, 4);
}

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseSessionDate(iso: string): Date {
  const d = new Date(iso);
  d.setHours(12, 0, 0, 0);
  return d;
}

/** Monday–Sunday for the week containing `weekOffset` (0 = current week). */
function getWeekMonday(weekOffset: number): Date {
  const now = new Date();
  const base = new Date(now);
  base.setDate(base.getDate() + weekOffset * 7);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function weekDayKeys(monday: Date): string[] {
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    keys.push(localDateKey(d));
  }
  return keys;
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString('en-US', opts)} - ${sunday.toLocaleDateString('en-US', opts)}`;
}

function isBenchName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('bench');
}

function isSquatName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('squat') && !n.includes('split');
}

function isDeadliftName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('deadlift') || n.includes('romanian deadlift');
}

/** Best realized e1RM (Brzycki × RPE/10) for that lift on each calendar day. */
function dailyRealizedE1RMMax(
  sessions: WorkoutSession[],
  dayKeys: string[],
  matcher: (name: string) => boolean
): number[] {
  return dayKeys.map((key) => {
    let best = 0;
    for (const s of sessions) {
      if (!s.completed) continue;
      const dk = localDateKey(parseSessionDate(s.date));
      if (dk !== key) continue;
      for (const ex of s.exercises || []) {
        if (!matcher(ex.name)) continue;
        for (const set of ex.sets || []) {
          if (!set.completed || set.weight <= 0 || set.reps <= 0) continue;
          const v = realizedE1RM(set.weight, set.reps, set.rpe);
          if (v > best) best = v;
        }
      }
    }
    return best;
  });
}

/** Σ(weight × reps) for completed sets of that lift per day. */
function dailyVolumeLoad(
  sessions: WorkoutSession[],
  dayKeys: string[],
  matcher: (name: string) => boolean
): number[] {
  return dayKeys.map((key) => {
    let sum = 0;
    for (const s of sessions) {
      if (!s.completed) continue;
      const dk = localDateKey(parseSessionDate(s.date));
      if (dk !== key) continue;
      for (const ex of s.exercises || []) {
        if (!matcher(ex.name)) continue;
        for (const set of ex.sets || []) {
          if (!set.completed || set.weight <= 0 || set.reps <= 0) continue;
          sum += setVolumeLoad(set.weight, set.reps);
        }
      }
    }
    return sum;
  });
}

function average(nums: number[]): number {
  const f = nums.filter((n) => n > 0);
  if (f.length === 0) return 0;
  return f.reduce((a, b) => a + b, 0) / f.length;
}

function macroByDay(
  meals: Meal[],
  dayKeys: string[],
  field: 'protein' | 'carbs' | 'fat'
): number[] {
  return dayKeys.map((key) => {
    let sum = 0;
    for (const m of meals) {
      try {
        const dk = localDateKey(new Date(m.date));
        if (dk === key) {
          if (field === 'protein') sum += m.protein || 0;
          else if (field === 'carbs') sum += m.carbs ?? 0;
          else sum += m.fat ?? 0;
        }
      } catch {
        /* ignore */
      }
    }
    return sum;
  });
}

export default function HealthScreen({ onBack, initialTrendGraph }: HealthScreenProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const nutritionGraphY = useRef(0);
  const chartLayout = useMemo(() => {
    const chartW = Math.max(200, windowWidth - SCROLL_H_PAD - CARD_H_PAD);
    const left = 46;
    const right = 8;
    const top = 6;
    const bottom = 30;
    const innerW = chartW - left - right;
    const innerH = PLOT_H;
    const svgH = top + innerH + bottom;
    return { chartW, left, right, top, bottom, innerW, innerH, svgH };
  }, [windowWidth]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [proteinGoal, setProteinGoal] = useState(180);
  const [carbsGoal, setCarbsGoal] = useState(250);
  const [fatGoal, setFatGoal] = useState(70);
  const [loading, setLoading] = useState(true);
  const [healthSyncEnabled, setHealthSyncEnabled] = useState(true);
  const [trackedLiftId, setTrackedLiftId] = useState(DEFAULT_TRACKED_LIFT_ID);
  const [showLiftPicker, setShowLiftPicker] = useState(false);
  const [liftSearchQuery, setLiftSearchQuery] = useState('');
  const deferredLiftSearchQuery = useDeferredValue(liftSearchQuery);
  const [activeGraphs, setActiveGraphs] = useState<Set<TrendGraphId>>(new Set());
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightDateInput, setWeightDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [weightSyncing, setWeightSyncing] = useState(false);
  const { keyboardHeight } = useKeyboardInsets();

  const selectedLift = useMemo(() => getTrackableLiftById(trackedLiftId), [trackedLiftId]);

  const monday = useMemo(() => getWeekMonday(weekOffset), [weekOffset]);
  const dayKeys = useMemo(() => weekDayKeys(monday), [monday]);
  const rangeLabel = useMemo(() => formatWeekRange(monday), [monday]);
  const shortDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const appSettings = await loadUserData<{ healthDataSyncEnabled?: boolean }>('appSettings');
      setHealthSyncEnabled(appSettings?.healthDataSyncEnabled !== false);

      const hist = await loadUserData<WorkoutSession[]>('workoutHistory');
      setSessions(Array.isArray(hist) ? hist.filter((s) => s.completed) : []);

      const mealData = await loadUserData<Meal[]>('meals');
      setMeals(Array.isArray(mealData) ? mealData : []);

      const goals = await loadUserData<NutritionGoals>('nutritionGoals');
      if (goals?.protein && goals.protein > 0) {
        setProteinGoal(Math.round(goals.protein));
      }
      if (goals?.carbs && goals.carbs > 0) {
        setCarbsGoal(Math.round(goals.carbs));
      }
      if (goals?.fat && goals.fat > 0) {
        setFatGoal(Math.round(goals.fat));
      }

      const parsedWeight = await loadUserData<WeightEntry[]>('weightEntries');
      if (Array.isArray(parsedWeight)) {
        setWeightEntries(
          [...parsedWeight].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        );
      } else {
        setWeightEntries([]);
      }

      if (Platform.OS === 'ios' && appSettings?.healthDataSyncEnabled !== false) {
        const syncResult = await HealthService.syncBodyWeightFromAppleHealth(90);
        if (syncResult.added > 0) {
          setWeightEntries(
            [...syncResult.merged].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
          );
        }
      }
    } catch (e) {
      console.error('HealthScreen loadData:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadTrackedLiftId().then(setTrackedLiftId);
  }, []);

  useEffect(() => {
    if (showLiftPicker) setLiftSearchQuery('');
  }, [showLiftPicker]);

  useEffect(() => {
    if (showWeightModal) {
      setWeightInput('');
      setWeightDateInput(new Date().toISOString().split('T')[0]);
    }
  }, [showWeightModal]);

  useEffect(() => {
    if (!initialTrendGraph || loading) return;
    setActiveGraphs(new Set([initialTrendGraph]));
    if (initialTrendGraph !== 'nutrition') return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, nutritionGraphY.current - 12), animated: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [initialTrendGraph, loading]);

  const toggleTrendGraph = (id: TrendGraphId) => {
    setActiveGraphs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSyncWeightFromHealth = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'Apple Health only',
        'Smart scale sync is available on iPhone when weights are shared to Apple Health. You can still log weight manually with + Add weight.'
      );
      return;
    }
    setWeightSyncing(true);
    try {
      const result = await HealthService.syncBodyWeightFromAppleHealth(90);
      if (result.added > 0) {
        setWeightEntries(
          [...result.merged].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )
        );
        Alert.alert(
          'Weight synced',
          `Imported ${result.added} new weigh-in${result.added === 1 ? '' : 's'} from Apple Health.`
        );
      } else if (result.imported > 0) {
        Alert.alert(
          'Already up to date',
          'Apple Health has weight data, but those days are already logged in the app.'
        );
      } else {
        Alert.alert(
          'No weight in Apple Health',
          'Connect a smart scale (Withings, Eufy, etc.) to Apple Health, or log weight manually with + Add weight.'
        );
      }
    } catch (e) {
      console.warn('HealthScreen weight sync:', e);
      Alert.alert('Sync failed', 'Could not read weight from Apple Health. Try again or log manually.');
    } finally {
      setWeightSyncing(false);
    }
  };

  const handleAddWeight = async () => {
    const raw = weightInput.trim().replace(/,/g, '.');
    const weight = parseFloat(raw);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 999) {
      Alert.alert(
        'Check your weight',
        'Enter your weight in pounds as a number (for example 175 or 175.5).'
      );
      return;
    }

    const dateStr = weightDateInput.trim();
    const isoLike = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!isoLike) {
      Alert.alert(
        'Check the date',
        'Use Year-Month-Day with four digits for the year, for example 2026-04-01.'
      );
      return;
    }
    const y = Number(isoLike[1]);
    const mo = Number(isoLike[2]);
    const d = Number(isoLike[3]);
    const noonLocal = new Date(y, mo - 1, d, 12, 0, 0, 0);
    if (
      noonLocal.getFullYear() !== y ||
      noonLocal.getMonth() !== mo - 1 ||
      noonLocal.getDate() !== d
    ) {
      Alert.alert('Check the date', 'That calendar date is not valid. Example: 2026-04-01.');
      return;
    }

    const newEntry: WeightEntry = {
      id: Date.now().toString(),
      date: noonLocal.toISOString(),
      weight,
    };

    const existingIndex = weightEntries.findIndex(
      (e) => new Date(e.date).toDateString() === noonLocal.toDateString()
    );

    let updatedEntries: WeightEntry[];
    if (existingIndex >= 0) {
      updatedEntries = [...weightEntries];
      updatedEntries[existingIndex] = newEntry;
    } else {
      updatedEntries = [newEntry, ...weightEntries];
    }

    updatedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setWeightEntries(updatedEntries);
    await saveUserData('weightEntries', updatedEntries);
    setShowWeightModal(false);
    notifyUserDataReady();
  };

  const primaryLiftSeries = useMemo(
    () => sessionsToPrimaryLiftPoints(sessions),
    [sessions]
  );

  const liftPickerKeyboardHeight = showLiftPicker ? keyboardHeight : 0;

  const priorityLiftNameLower = useMemo(
    () => new Set(PRIORITY_TRACKABLE_LIFTS.map((l) => l.label.trim().toLowerCase())),
    []
  );

  const liftSearchResults = useMemo(
    () => filterStrengthNamesForPicker(deferredLiftSearchQuery, priorityLiftNameLower),
    [deferredLiftSearchQuery, priorityLiftNameLower]
  );

  const closeLiftPicker = useCallback(() => {
    dismissKeyboard();
    setShowLiftPicker(false);
  }, []);

  const liftSheetMaxHeight = useMemo(() => {
    if (liftPickerKeyboardHeight > 0) {
      return Math.max(
        220,
        Math.min(windowHeight * 0.72, windowHeight - liftPickerKeyboardHeight - 24)
      );
    }
    return windowHeight * 0.72;
  }, [windowHeight, liftPickerKeyboardHeight]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  const realizedE1Series = useMemo(
    () => dailyRealizedE1RMMax(sessions, dayKeys, selectedLift.match),
    [sessions, dayKeys, selectedLift]
  );

  const volumeSeries = useMemo(
    () => dailyVolumeLoad(sessions, dayKeys, selectedLift.match),
    [sessions, dayKeys, selectedLift]
  );

  const prevMonday = useMemo(() => {
    const p = new Date(monday);
    p.setDate(p.getDate() - 7);
    return p;
  }, [monday]);
  const prevDayKeys = useMemo(() => weekDayKeys(prevMonday), [prevMonday]);

  const realizedE1PrevWeek = useMemo(
    () => dailyRealizedE1RMMax(sessions, prevDayKeys, selectedLift.match),
    [sessions, prevDayKeys, selectedLift]
  );

  const volumePrevWeek = useMemo(
    () => dailyVolumeLoad(sessions, prevDayKeys, selectedLift.match),
    [sessions, prevDayKeys, selectedLift]
  );

  const weeklyAvgRealizedE1 = average(realizedE1Series);
  const prevWeeklyAvgRealizedE1 = average(realizedE1PrevWeek);

  const weeklyAvgVolume = average(volumeSeries);
  const prevWeeklyAvgVolume = average(volumePrevWeek);

  const strengthDeltaPct = useMemo(() => {
    if (prevWeeklyAvgRealizedE1 <= 0 && weeklyAvgRealizedE1 <= 0) return 0;
    if (prevWeeklyAvgRealizedE1 <= 0) return weeklyAvgRealizedE1 > 0 ? 100 : 0;
    return ((weeklyAvgRealizedE1 - prevWeeklyAvgRealizedE1) / prevWeeklyAvgRealizedE1) * 100;
  }, [weeklyAvgRealizedE1, prevWeeklyAvgRealizedE1]);

  const volumeDeltaPct = useMemo(() => {
    if (prevWeeklyAvgVolume <= 0 && weeklyAvgVolume <= 0) return 0;
    if (prevWeeklyAvgVolume <= 0) return weeklyAvgVolume > 0 ? 100 : 0;
    return ((weeklyAvgVolume - prevWeeklyAvgVolume) / prevWeeklyAvgVolume) * 100;
  }, [weeklyAvgVolume, prevWeeklyAvgVolume]);

  /** Rolling ~28d: average of daily max realized e1RM for selected lift */
  const monthlyAvgRealizedE1 = useMemo(() => {
    const match = selectedLift.match;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    const dayMap = new Map<string, number>();
    for (const s of sessions) {
      if (!s.completed) continue;
      const d = parseSessionDate(s.date);
      if (d < cutoff) continue;
      const key = localDateKey(d);
      let best = dayMap.get(key) || 0;
      for (const ex of s.exercises || []) {
        if (!match(ex.name)) continue;
        for (const set of ex.sets || []) {
          if (!set.completed || set.weight <= 0 || set.reps <= 0) continue;
          const v = realizedE1RM(set.weight, set.reps, set.rpe);
          if (v > best) best = v;
        }
      }
      if (best > 0) dayMap.set(key, best);
    }
    const vals = [...dayMap.values()];
    if (vals.length === 0) return weeklyAvgRealizedE1 || 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [sessions, weeklyAvgRealizedE1, selectedLift]);

  /** Rolling ~28d: average daily volume load for selected lift */
  const monthlyAvgVolume = useMemo(() => {
    const match = selectedLift.match;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    const dayMap = new Map<string, number>();
    for (const s of sessions) {
      if (!s.completed) continue;
      const d = parseSessionDate(s.date);
      if (d < cutoff) continue;
      const key = localDateKey(d);
      let sum = dayMap.get(key) || 0;
      for (const ex of s.exercises || []) {
        if (!match(ex.name)) continue;
        for (const set of ex.sets || []) {
          if (!set.completed || set.weight <= 0 || set.reps <= 0) continue;
          sum += setVolumeLoad(set.weight, set.reps);
        }
      }
      dayMap.set(key, sum);
    }
    const vals = [...dayMap.values()].filter((v) => v > 0);
    if (vals.length === 0) return weeklyAvgVolume || 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [sessions, weeklyAvgVolume, selectedLift]);

  const proteinSeries = useMemo(() => macroByDay(meals, dayKeys, 'protein'), [meals, dayKeys]);
  const carbsSeries = useMemo(() => macroByDay(meals, dayKeys, 'carbs'), [meals, dayKeys]);
  const fatSeries = useMemo(() => macroByDay(meals, dayKeys, 'fat'), [meals, dayKeys]);

  const topGains = useMemo(() => {
    const lifts = [
      { label: 'Bench', icon: '🏋', match: isBenchName },
      { label: 'Deadlift', icon: '🏋‍♂️', match: isDeadliftName },
      { label: 'Squat', icon: '💪', match: isSquatName },
    ] as const;
    return lifts.map(({ label, icon, match }) => {
      const thisW = average(dailyRealizedE1RMMax(sessions, dayKeys, match));
      const prevW = average(dailyRealizedE1RMMax(sessions, prevDayKeys, match));
      let pct = 0;
      if (prevW > 0) pct = ((thisW - prevW) / prevW) * 100;
      else if (thisW > 0) pct = 2.1;
      return { label, icon, pct };
    });
  }, [sessions, dayKeys, prevDayKeys]);

  const e1ChartYRange = useMemo(() => {
    const vals = [...realizedE1Series, monthlyAvgRealizedE1].filter((v) => v > 0);
    if (vals.length === 0) return { min: 45, max: 225 };
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const pad = Math.max(5, (maxV - minV) * 0.15);
    return {
      min: Math.max(0, Math.floor((minV - pad) / 5) * 5),
      max: Math.ceil((maxV + pad) / 5) * 5,
    };
  }, [realizedE1Series, monthlyAvgRealizedE1]);

  const volumeChartYRange = useMemo(() => {
    const vals = [...volumeSeries, monthlyAvgVolume].filter((v) => v > 0);
    if (vals.length === 0) return { min: 0, max: 5000 };
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const pad = Math.max(100, (maxV - minV) * 0.12);
    return {
      min: 0,
      max: Math.ceil((maxV + pad) / 100) * 100,
    };
  }, [volumeSeries, monthlyAvgVolume]);

  const linePoints = useMemo(() => {
    const { min, max } = e1ChartYRange;
    const span = max - min || 1;
    const { left, top, innerW, innerH } = chartLayout;
    const col = innerW / 7;
    return realizedE1Series.map((v, i) => {
      const x = left + (i + 0.5) * col;
      const y =
        v <= 0
          ? top + innerH
          : top + innerH - ((v - min) / span) * innerH;
      return { x, y, v };
    });
  }, [realizedE1Series, e1ChartYRange, chartLayout]);

  const linePathD = useMemo(() => {
    const { top, innerH } = chartLayout;
    if (linePoints.length === 0) return '';
    const first = linePoints[0];
    const baseY = top + innerH;
    let d = `M ${first.x} ${baseY} L ${first.x} ${first.y}`;
    for (let i = 1; i < linePoints.length; i++) {
      d += ` L ${linePoints[i].x} ${linePoints[i].y}`;
    }
    const last = linePoints[linePoints.length - 1];
    d += ` L ${last.x} ${baseY} Z`;
    return d;
  }, [linePoints, chartLayout]);

  const polylinePts = useMemo(() => {
    return linePoints.map((p) => `${p.x},${p.y}`).join(' ');
  }, [linePoints]);

  const monthlyLineY = useMemo(() => {
    const { min, max } = e1ChartYRange;
    const span = max - min || 1;
    const { top, innerH } = chartLayout;
    return top + innerH - ((monthlyAvgRealizedE1 - min) / span) * innerH;
  }, [e1ChartYRange, monthlyAvgRealizedE1, chartLayout]);

  const yTicks = useMemo(() => {
    const { min, max } = e1ChartYRange;
    return buildEvenYTicks(min, max, 4);
  }, [e1ChartYRange]);

  const volumeLinePoints = useMemo(() => {
    const { min, max } = volumeChartYRange;
    const span = max - min || 1;
    const { left, top, innerW, innerH } = chartLayout;
    const col = innerW / 7;
    return volumeSeries.map((v, i) => {
      const x = left + (i + 0.5) * col;
      const y =
        v <= 0
          ? top + innerH
          : top + innerH - ((v - min) / span) * innerH;
      return { x, y, v };
    });
  }, [volumeSeries, volumeChartYRange, chartLayout]);

  const volumeLinePathD = useMemo(() => {
    const { top, innerH } = chartLayout;
    if (volumeLinePoints.length === 0) return '';
    const first = volumeLinePoints[0];
    const baseY = top + innerH;
    let d = `M ${first.x} ${baseY} L ${first.x} ${first.y}`;
    for (let i = 1; i < volumeLinePoints.length; i++) {
      d += ` L ${volumeLinePoints[i].x} ${volumeLinePoints[i].y}`;
    }
    const last = volumeLinePoints[volumeLinePoints.length - 1];
    d += ` L ${last.x} ${baseY} Z`;
    return d;
  }, [volumeLinePoints, chartLayout]);

  const volumePolylinePts = useMemo(() => {
    return volumeLinePoints.map((p) => `${p.x},${p.y}`).join(' ');
  }, [volumeLinePoints]);

  const volumeMonthlyLineY = useMemo(() => {
    const { min, max } = volumeChartYRange;
    const span = max - min || 1;
    const { top, innerH } = chartLayout;
    return top + innerH - ((monthlyAvgVolume - min) / span) * innerH;
  }, [volumeChartYRange, monthlyAvgVolume, chartLayout]);

  const volumeYTicks = useMemo(() => {
    const { min, max } = volumeChartYRange;
    return buildMacroYTicks(max);
  }, [volumeChartYRange]);

  const macroMax = useMemo(() => {
    const m = Math.max(
      proteinGoal * 1.1,
      carbsGoal * 1.1,
      fatGoal * 1.1,
      ...proteinSeries,
      ...carbsSeries,
      ...fatSeries,
      50
    );
    return Math.ceil(m / 10) * 10;
  }, [proteinSeries, carbsSeries, fatSeries, proteinGoal, carbsGoal, fatGoal]);

  const macroYTicks = useMemo(() => buildMacroYTicks(macroMax), [macroMax]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Health & Trends</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView ref={scrollRef} style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.graphPickerTitle}>Charts</Text>
        <Text style={styles.graphPickerHint}>Tap a chart to expand it below that row.</Text>

        {TREND_GRAPH_TOGGLES.map((item) => {
          const active = activeGraphs.has(item.id);
          const isWeekly =
            item.id === 'e1rm' || item.id === 'liftVolume' || item.id === 'nutrition';
          return (
            <View
              key={item.id}
              style={styles.graphToggleGroup}
              onLayout={
                item.id === 'nutrition'
                  ? (e) => {
                      nutritionGraphY.current = e.nativeEvent.layout.y;
                    }
                  : undefined
              }
            >
              <TouchableOpacity
                style={[styles.graphToggleBtn, active && styles.graphToggleBtnActive]}
                onPress={() => toggleTrendGraph(item.id)}
                activeOpacity={0.85}
              >
                <View style={styles.graphToggleTextCol}>
                  <Text style={[styles.graphToggleLabel, active && styles.graphToggleLabelActive]}>
                    {item.label}
                  </Text>
                  <Text style={styles.graphToggleHint}>{item.hint}</Text>
                </View>
                <Text style={[styles.graphToggleChevron, active && styles.graphToggleChevronActive]}>
                  {active ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>
              {active && isWeekly ? (
              <View style={[styles.weekRow, styles.weekRowInScroll]}>
                <TouchableOpacity
                  onPress={() => setWeekOffset((w) => w - 1)}
                  style={styles.weekChevron}
                  hitSlop={10}
                >
                  <Text style={styles.weekChevronText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.weekRangeText}>{rangeLabel}</Text>
                <TouchableOpacity
                  onPress={() => setWeekOffset((w) => Math.min(0, w + 1))}
                  style={[styles.weekChevron, weekOffset >= 0 && styles.weekChevronDisabled]}
                  disabled={weekOffset >= 0}
                  hitSlop={10}
                >
                  <Text style={[styles.weekChevronText, weekOffset >= 0 && styles.weekChevronTextDisabled]}>›</Text>
                </TouchableOpacity>
              </View>
              ) : null}
              {active && item.id === 'e1rm' ? (
    <View style={styles.card}>
              <Text style={styles.cardTitle}>{selectedLift.label} — Realized e1RM</Text>
              <TouchableOpacity
                style={styles.changeExerciseBtn}
                onPress={() => setShowLiftPicker(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.changeExerciseBtnText}>Change exercise</Text>
                <Text style={styles.changeExerciseBtnChevron}>▾</Text>
              </TouchableOpacity>
              <Text style={styles.cardSubtext}>
                Brzycki: e1RM = weight × 36/(37 − reps). Realized = e1RM × (RPE/10); missing RPE uses 10
                (max effort).
              </Text>
              {loading ? (
                <Text style={styles.muted}>Loading…</Text>
              ) : (
                <>
                  <Text style={styles.chartAxisTitle}>lb (estimated 1RM)</Text>
                  <Svg width={chartLayout.chartW} height={chartLayout.svgH}>
                    <Defs>
                      <LinearGradient id="strengthFill" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={AppTheme.accent} stopOpacity="0.35" />
                        <Stop offset="1" stopColor={AppTheme.accent} stopOpacity="0.02" />
                      </LinearGradient>
                    </Defs>
                    {linePathD ? <Path d={linePathD} fill="url(#strengthFill)" /> : null}
                    {monthlyAvgRealizedE1 > 0 ? (
                      <Line
                        x1={chartLayout.left}
                        x2={chartLayout.chartW - chartLayout.right}
                        y1={monthlyLineY}
                        y2={monthlyLineY}
                        stroke="#5B9FFF"
                        strokeWidth={2}
                      />
                    ) : null}
                    {yTicks.map((tick) => {
                      const { min, max } = e1ChartYRange;
                      const span = max - min || 1;
                      const y =
                        chartLayout.top +
                        chartLayout.innerH -
                        ((tick - min) / span) * chartLayout.innerH;
                      return (
                        <SvgText
                          key={`s-${tick}`}
                          x={chartLayout.left - 4}
                          y={y + 3}
                          fill={AppTheme.textMuted}
                          fontSize={9}
                          textAnchor="end"
                        >
                          {tick}
                        </SvgText>
                      );
                    })}
                    <Polyline
                      points={polylinePts}
                      fill="none"
                      stroke={AppTheme.accent}
                      strokeWidth={2.5}
                    />
                    {linePoints.map((p, i) => (
                      <Circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={3.5}
                        fill={AppTheme.accent}
                        stroke="#0d0d0d"
                        strokeWidth={1}
                      />
                    ))}
                    {shortDayLabels.map((label, i) => {
                      const cx = chartLayout.left + (i + 0.5) * (chartLayout.innerW / 7);
                      return (
                        <SvgText
                          key={label + i}
                          x={cx}
                          y={chartLayout.top + chartLayout.innerH + 14}
                          fill={AppTheme.textMuted}
                          fontSize={9}
                          textAnchor="middle"
                        >
                          {label}
                        </SvgText>
                      );
                    })}
                  </Svg>
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: AppTheme.accent }]} />
                      <Text style={styles.legendText}>Daily max realized e1RM</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendLine, { backgroundColor: '#5B9FFF' }]} />
                      <Text style={styles.legendText}>28-day avg baseline</Text>
                    </View>
                  </View>
                  <Text style={styles.summaryLine}>
                    Avg. realized e1RM:{' '}
                    <Text style={styles.summaryPct}>
                      {strengthDeltaPct >= 0 ? '+' : ''}
                      {strengthDeltaPct.toFixed(1)}%
                    </Text>
                    {' '}vs prior week
                  </Text>
                </>
              )}
            </View>
              ) : null}
              {active && item.id === 'liftVolume' ? (
    <View style={styles.card}>
              <Text style={styles.cardTitle}>{selectedLift.label} — Volume load</Text>
              <TouchableOpacity
                style={styles.changeExerciseBtn}
                onPress={() => setShowLiftPicker(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.changeExerciseBtnText}>Change exercise</Text>
                <Text style={styles.changeExerciseBtnChevron}>▾</Text>
              </TouchableOpacity>
              <Text style={styles.cardSubtext}>
                Σ (weight × reps) for completed sets matching this exercise each day.
              </Text>
              {loading ? (
                <Text style={styles.muted}>Loading…</Text>
              ) : (
                <>
                  <Text style={styles.chartAxisTitle}>Volume (lb × reps)</Text>
                  <Svg width={chartLayout.chartW} height={chartLayout.svgH}>
                    <Defs>
                      <LinearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#5FD9A8" stopOpacity="0.3" />
                        <Stop offset="1" stopColor="#5FD9A8" stopOpacity="0.02" />
                      </LinearGradient>
                    </Defs>
                    {volumeLinePathD ? <Path d={volumeLinePathD} fill="url(#volumeFill)" /> : null}
                    {monthlyAvgVolume > 0 ? (
                      <Line
                        x1={chartLayout.left}
                        x2={chartLayout.chartW - chartLayout.right}
                        y1={volumeMonthlyLineY}
                        y2={volumeMonthlyLineY}
                        stroke="#5B9FFF"
                        strokeWidth={2}
                      />
                    ) : null}
                    {volumeYTicks.map((tick) => {
                      const { min, max } = volumeChartYRange;
                      const span = max - min || 1;
                      const y =
                        chartLayout.top +
                        chartLayout.innerH -
                        ((tick - min) / span) * chartLayout.innerH;
                      return (
                        <SvgText
                          key={`v-${tick}`}
                          x={chartLayout.left - 4}
                          y={y + 3}
                          fill={AppTheme.textMuted}
                          fontSize={8}
                          textAnchor="end"
                        >
                          {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : `${tick}`}
                        </SvgText>
                      );
                    })}
                    <Polyline
                      points={volumePolylinePts}
                      fill="none"
                      stroke="#5FD9A8"
                      strokeWidth={2.5}
                    />
                    {volumeLinePoints.map((p, i) => (
                      <Circle
                        key={`vp-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r={3.5}
                        fill="#5FD9A8"
                        stroke="#0d0d0d"
                        strokeWidth={1}
                      />
                    ))}
                    {shortDayLabels.map((label, i) => {
                      const cx = chartLayout.left + (i + 0.5) * (chartLayout.innerW / 7);
                      return (
                        <SvgText
                          key={`vl${label}`}
                          x={cx}
                          y={chartLayout.top + chartLayout.innerH + 14}
                          fill={AppTheme.textMuted}
                          fontSize={9}
                          textAnchor="middle"
                        >
                          {label}
                        </SvgText>
                      );
                    })}
                  </Svg>
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#5FD9A8' }]} />
                      <Text style={styles.legendText}>Daily volume</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendLine, { backgroundColor: '#5B9FFF' }]} />
                      <Text style={styles.legendText}>28-day avg baseline</Text>
                    </View>
                  </View>
                  <Text style={styles.summaryLine}>
                    Avg. volume:{' '}
                    <Text style={styles.summaryPct}>
                      {volumeDeltaPct >= 0 ? '+' : ''}
                      {volumeDeltaPct.toFixed(1)}%
                    </Text>
                    {' '}vs prior week
                  </Text>
                </>
              )}
            </View>
              ) : null}
              {active && item.id === 'nutrition' ? (
    <View style={styles.card}>
              <Text style={styles.cardTitle}>Nutrition Consistency</Text>
              {loading ? (
                <Text style={styles.muted}>Loading…</Text>
              ) : (
                <>
                  <Text style={styles.chartAxisTitle}>Macros (g)</Text>
                  <Svg width={chartLayout.chartW} height={chartLayout.svgH}>
                    {[
                      { goal: proteinGoal, color: MACRO_COLORS.protein },
                      { goal: carbsGoal, color: MACRO_COLORS.carbs },
                      { goal: fatGoal, color: MACRO_COLORS.fat },
                    ].map(({ goal, color }, li) => {
                      const gy =
                        chartLayout.top +
                        chartLayout.innerH -
                        (goal / macroMax) * chartLayout.innerH;
                      return (
                        <Line
                          key={`goal-${li}`}
                          x1={chartLayout.left}
                          x2={chartLayout.chartW - chartLayout.right}
                          y1={gy}
                          y2={gy}
                          stroke={color}
                          strokeWidth={1.5}
                          strokeDasharray="6 5"
                          strokeOpacity={0.85}
                        />
                      );
                    })}
                    {proteinSeries.map((_, dayIdx) => {
                      const cellW = chartLayout.innerW / 7;
                      const pad = cellW * 0.05;
                      const groupW = cellW - pad * 2;
                      const gap = 2;
                      const barW = Math.max(2, (groupW - gap * 2) / 3);
                      const groupLeft = chartLayout.left + dayIdx * cellW + pad;
                      const vals = [
                        { g: proteinSeries[dayIdx], color: MACRO_COLORS.protein },
                        { g: carbsSeries[dayIdx], color: MACRO_COLORS.carbs },
                        { g: fatSeries[dayIdx], color: MACRO_COLORS.fat },
                      ];
                      return (
                        <React.Fragment key={`day-${dayIdx}`}>
                          {vals.map((row, mi) => {
                            const h = Math.max(0, (row.g / macroMax) * chartLayout.innerH);
                            const x = groupLeft + mi * (barW + gap);
                            const y = chartLayout.top + chartLayout.innerH - h;
                            return (
                              <Rect
                                key={`b-${dayIdx}-${mi}`}
                                x={x}
                                y={y}
                                width={barW}
                                height={h || 0.5}
                                fill={row.color}
                                rx={2}
                              />
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    {macroYTicks.map((tick) => {
                      const y =
                        chartLayout.top +
                        chartLayout.innerH -
                        (tick / macroMax) * chartLayout.innerH;
                      return (
                        <SvgText
                          key={`m-${tick}`}
                          x={chartLayout.left - 4}
                          y={y + 3}
                          fill={AppTheme.textMuted}
                          fontSize={9}
                          textAnchor="end"
                        >
                          {tick}
                        </SvgText>
                      );
                    })}
                    {shortDayLabels.map((label, i) => {
                      const cx = chartLayout.left + (i + 0.5) * (chartLayout.innerW / 7);
                      return (
                        <SvgText
                          key={`pl${label}`}
                          x={cx}
                          y={chartLayout.top + chartLayout.innerH + 14}
                          fill={AppTheme.textMuted}
                          fontSize={9}
                          textAnchor="middle"
                        >
                          {label}
                        </SvgText>
                      );
                    })}
                  </Svg>
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendSquare, { backgroundColor: MACRO_COLORS.protein }]} />
                      <Text style={styles.legendText}>Protein ({proteinGoal}g)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendSquare, { backgroundColor: MACRO_COLORS.carbs }]} />
                      <Text style={styles.legendText}>Carbs ({carbsGoal}g)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendSquare, { backgroundColor: MACRO_COLORS.fat }]} />
                      <Text style={styles.legendText}>Fat ({fatGoal}g)</Text>
                    </View>
                  </View>
                  <Text style={styles.legendHint}>Dashed lines = daily targets</Text>
                </>
              )}
            </View>
              ) : null}
              {active && item.id === 'bodyWeight' ? (
    <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Body weight</Text>
                  <View style={styles.weightActionsRow}>
                    {Platform.OS === 'ios' ? (
                      <TouchableOpacity
                        style={[styles.syncWeightBtn, weightSyncing && styles.syncWeightBtnDisabled]}
                        onPress={() => handleSyncWeightFromHealth().catch(console.error)}
                        disabled={weightSyncing}
                      >
                        <Text style={styles.syncWeightBtnText}>
                          {weightSyncing ? 'Syncing…' : 'Sync Health'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={styles.addWeightBtn} onPress={() => setShowWeightModal(true)}>
                      <Text style={styles.addWeightBtnText}>+ Add weight</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.cardSubtext}>
                  {Platform.OS === 'ios'
                    ? 'Sync from Apple Health (smart scales like Withings) or log manually.'
                    : 'Log weigh-ins manually to see your trend over time.'}
                </Text>
                <HistoryLineChart
                  series={weightEntriesToPoints(weightEntries).slice(-30)}
                  options={{
                    emptyTitle: 'No body weight yet',
                    emptySub: 'Tap + Add weight to see your trend over time.',
                    lineColor: '#4dabf7',
                    yDecimals: 1,
                    statUnit: ' lbs',
                  }}
                />
              </View>
              ) : null}
              {active && item.id === 'sessionPeak' ? (
    <View style={styles.card}>
                <Text style={styles.cardTitle}>Session peak weight</Text>
                <Text style={styles.cardSubtext}>Heaviest completed set each workout.</Text>
                <HistoryLineChart
                  series={sessionsToPeakSetWeightPoints(sessions)}
                  options={{
                    emptyTitle: 'No strength data yet',
                    emptySub: 'Complete workouts and log weights on your sets to see peak load per session.',
                    lineColor: AppTheme.accent,
                    yDecimals: 0,
                    statUnit: ' lbs',
                  }}
                />
              </View>
              ) : null}
              {active && item.id === 'trainingVolume' ? (
    <View style={styles.card}>
                <Text style={styles.cardTitle}>Training volume</Text>
                <Text style={styles.cardSubtext}>
                  Sum of weight × reps on completed sets per workout.
                </Text>
                <HistoryLineChart
                  series={sessionsToVolumePoints(sessions)}
                  options={{
                    emptyTitle: 'No volume data yet',
                    emptySub: 'Finish sessions with logged sets (weight × reps) to plot training volume.',
                    lineColor: '#b482ff',
                    yDecimals: 0,
                    statUnit: ' lb·reps',
                    yAxisCompact: true,
                  }}
                />
              </View>
              ) : null}
              {active && item.id === 'primaryLift' ? (
    <View style={styles.card}>
                <Text style={styles.cardTitle}>Primary lift progress</Text>
                <Text style={styles.cardSubtext}>
                  {primaryLiftSeries.liftName
                    ? primaryLiftSeries.liftName
                    : 'Your most-logged exercise (after 2+ sessions)'}
                </Text>
                <HistoryLineChart
                  series={primaryLiftSeries.points}
                  options={{
                    emptyTitle: 'Not enough lift history',
                    emptySub:
                      'Log the same exercise with weights across multiple completed workouts to see a trend.',
                    lineColor: '#ff922b',
                    yDecimals: 0,
                    statUnit: ' lbs',
                  }}
                />
              </View>
              ) : null}
            </View>
          );
        })}

        {/* Top gains */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Gains</Text>
          {topGains.map((row) => (
            <View key={row.label} style={styles.gainRow}>
              <Text style={styles.gainIcon}>{row.icon}</Text>
              <Text style={styles.gainLabel}>{row.label}</Text>
              <Text style={styles.gainPct}>
                {row.pct >= 0 ? '+' : ''}
                {row.pct.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>

        {healthSyncEnabled ? (
          <TouchableOpacity style={styles.refreshBtn} onPress={loadData} disabled={loading}>
            <Text style={styles.refreshBtnText}>{loading ? 'Refreshing…' : '↻ Refresh data'}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.card}>
          <HealthSyncSettingsSection onSyncEnabledChange={setHealthSyncEnabled} />
        </View>

        <View style={styles.card}>
          <ProgressPhotoSettingsSection />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal
        visible={showWeightModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWeightModal(false)}
      >
        <View style={styles.weightModalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.weightModalCenter}
          >
            <View style={styles.weightModalCard}>
              <Text style={styles.weightModalTitle}>Log body weight</Text>
              <Text style={styles.weightModalIntro}>
                Enter what the scale shows in pounds, and the date you stepped on it. On iPhone you
                can also sync from Apple Health if your scale shares weight there.
              </Text>
              <Text style={styles.weightModalLabel}>Weight (pounds)</Text>
              <TextInput
                style={styles.weightModalInput}
                placeholder="e.g. 182.4"
                placeholderTextColor={AppTheme.textMuted}
                keyboardType="decimal-pad"
                value={weightInput}
                onChangeText={setWeightInput}
              />
              <Text style={styles.weightModalLabel}>Weigh-in date</Text>
              <Text style={styles.weightModalHint}>Format: YYYY-MM-DD</Text>
              <TextInput
                style={styles.weightModalInput}
                placeholder={new Date().toISOString().split('T')[0]}
                placeholderTextColor={AppTheme.textMuted}
                value={weightDateInput}
                onChangeText={setWeightDateInput}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
              <View style={styles.weightModalActions}>
                <TouchableOpacity
                  style={[styles.weightModalBtn, styles.weightModalBtnCancel]}
                  onPress={() => setShowWeightModal(false)}
                >
                  <Text style={styles.weightModalBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.weightModalBtn, styles.weightModalBtnSave]}
                  onPress={() => handleAddWeight().catch(console.error)}
                >
                  <Text style={styles.weightModalBtnTextSave}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={showLiftPicker}
        transparent
        animationType="none"
        onRequestClose={closeLiftPicker}
      >
        <KeyboardModalFrame justifyContent="flex-end" style={styles.liftModalRoot}>
          <TouchableOpacity
            style={styles.liftModalBackdrop}
            activeOpacity={1}
            onPress={closeLiftPicker}
          />
          <View
            style={[
              styles.liftModalSheet,
              {
                maxHeight: liftSheetMaxHeight,
              },
            ]}
          >
            <FlatList
              data={liftSearchQuery.trim() ? liftSearchResults : []}
              keyExtractor={(name) => name}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <>
                  <Text style={styles.liftModalTitle}>Track 1RM and volume for</Text>
                  <Text style={styles.liftModalHint}>Applies to Realized e1RM and Lift volume load charts.</Text>

                  <Text style={styles.liftModalSection}>Common lifts</Text>
                  {PRIORITY_TRACKABLE_LIFTS.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.liftOption,
                        item.id === trackedLiftId && styles.liftOptionSelected,
                      ]}
                      onPress={async () => {
                        setTrackedLiftId(item.id);
                        await saveTrackedLiftId(item.id);
                        closeLiftPicker();
                      }}
                    >
                      <Text style={styles.liftOptionText}>{item.label}</Text>
                      {item.id === trackedLiftId ? <Text style={styles.liftCheck}>✓</Text> : null}
                    </TouchableOpacity>
                  ))}

                  <Text style={styles.liftModalSection}>Search exercises</Text>
                  <TextInput
                    style={styles.liftSearchInput}
                    value={liftSearchQuery}
                    onChangeText={setLiftSearchQuery}
                    placeholder="Type a name (e.g. pull-up, curl)"
                    placeholderTextColor={AppTheme.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    spellCheck={false}
                    textContentType="none"
                    clearButtonMode="while-editing"
                  />
                  {!liftSearchQuery.trim() ? (
                    <Text style={styles.liftSearchHint}>Search the exercise library to chart any strength movement.</Text>
                  ) : liftSearchResults.length === 0 ? (
                    <Text style={styles.liftSearchHint}>No matches. Try a shorter word.</Text>
                  ) : (
                    <Text style={styles.liftSearchHint}>Tap a result below.</Text>
                  )}
                </>
              }
              renderItem={({ item: name }) => {
                const id = encodeCustomLiftId(name);
                const selected = id === trackedLiftId;
                return (
                  <TouchableOpacity
                    style={[styles.liftOption, selected && styles.liftOptionSelected]}
                    onPress={async () => {
                      setTrackedLiftId(id);
                      await saveTrackedLiftId(id);
                      closeLiftPicker();
                    }}
                  >
                    <Text style={styles.liftOptionText}>{name}</Text>
                    {selected ? <Text style={styles.liftCheck}>✓</Text> : null}
                  </TouchableOpacity>
                );
              }}
              ListFooterComponent={
                <TouchableOpacity
                  style={styles.liftModalCancel}
                  onPress={closeLiftPicker}
                >
                  <Text style={styles.liftModalCancelText}>Cancel</Text>
                </TouchableOpacity>
              }
            />
          </View>
        </KeyboardModalFrame>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  backButton: {
    width: 44,
    paddingVertical: 4,
  },
  backArrow: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerRight: {
    width: 44,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  weekChevron: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: 8,
  },
  weekChevronDisabled: {
    opacity: 0.35,
  },
  weekChevronText: {
    fontSize: 28,
    color: AppTheme.accent,
    fontWeight: '300',
    lineHeight: 32,
  },
  weekChevronTextDisabled: {
    color: AppTheme.textMuted,
  },
  weekRangeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    minWidth: 160,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusRow,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  cardSubtext: {
    fontSize: 11,
    lineHeight: 16,
    color: AppTheme.textMuted,
    marginBottom: 8,
  },
  chartAxisTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: AppTheme.textMuted,
    marginBottom: 4,
  },
  muted: {
    color: AppTheme.textMuted,
    fontSize: 14,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLine: {
    width: 14,
    height: 3,
    borderRadius: 1,
  },
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: AppTheme.textSecondary,
    marginLeft: 8,
  },
  legendHint: {
    fontSize: 11,
    color: AppTheme.textMuted,
    marginTop: 6,
  },
  summaryLine: {
    fontSize: 13,
    color: AppTheme.textSecondary,
    marginTop: 4,
  },
  summaryPct: {
    color: AppTheme.accent,
    fontWeight: '700',
  },
  gainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.border,
  },
  gainIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  gainLabel: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  gainPct: {
    fontSize: 16,
    fontWeight: '700',
    color: AppTheme.accent,
  },
  refreshBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  refreshBtnText: {
    color: AppTheme.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: AppTheme.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  changeExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'flex-start',
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: AppTheme.bgScreen,
    borderWidth: 1,
    borderColor: AppTheme.border,
    maxWidth: '100%',
  },
  changeExerciseBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.accent,
    flexShrink: 1,
  },
  changeExerciseBtnChevron: {
    fontSize: 12,
    color: AppTheme.textMuted,
    marginLeft: 8,
  },
  liftModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  liftModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  liftModalSheet: {
    backgroundColor: AppTheme.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  liftModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  liftModalHint: {
    fontSize: 12,
    color: AppTheme.textMuted,
    marginBottom: 12,
  },
  liftModalSection: {
    fontSize: 12,
    fontWeight: '700',
    color: AppTheme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 8,
  },
  liftSearchInput: {
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#fff',
    backgroundColor: AppTheme.bgScreen,
    marginBottom: 8,
  },
  liftSearchHint: {
    fontSize: 13,
    color: AppTheme.textMuted,
    marginBottom: 8,
    lineHeight: 18,
  },
  liftOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.border,
  },
  liftOptionSelected: {
    backgroundColor: 'rgba(0,255,136,0.08)',
    marginHorizontal: -4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  liftOptionText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  liftCheck: {
    fontSize: 16,
    color: AppTheme.accent,
    fontWeight: '700',
  },
  liftModalCancel: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  liftModalCancelText: {
    fontSize: 16,
    color: AppTheme.textMuted,
    fontWeight: '600',
  },
  graphPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  graphPickerHint: {
    fontSize: 13,
    color: AppTheme.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  graphToggleGroup: {
    marginBottom: 4,
  },
  graphToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusRow,
    borderWidth: 1,
    borderColor: AppTheme.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  graphToggleBtnActive: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  graphToggleTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  graphToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  graphToggleLabelActive: {
    color: AppTheme.accent,
  },
  graphToggleHint: {
    fontSize: 12,
    color: AppTheme.textMuted,
    lineHeight: 16,
  },
  graphToggleChevron: {
    fontSize: 14,
    color: AppTheme.textMuted,
  },
  graphToggleChevronActive: {
    color: AppTheme.accent,
  },
  weekRowInScroll: {
    marginTop: 4,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  weightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  syncWeightBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppTheme.accent,
  },
  syncWeightBtnDisabled: {
    opacity: 0.6,
  },
  syncWeightBtnText: {
    color: AppTheme.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  addWeightBtn: {
    backgroundColor: AppTheme.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addWeightBtnText: {
    color: AppTheme.accentDark,
    fontSize: 13,
    fontWeight: '700',
  },
  weightModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  weightModalCenter: {
    width: '100%',
  },
  weightModalCard: {
    backgroundColor: AppTheme.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  weightModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  weightModalIntro: {
    fontSize: 14,
    color: AppTheme.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  weightModalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textSecondary,
    marginBottom: 6,
  },
  weightModalHint: {
    fontSize: 12,
    color: AppTheme.textMuted,
    marginBottom: 8,
  },
  weightModalInput: {
    backgroundColor: AppTheme.bgScreen,
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 14,
  },
  weightModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  weightModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  weightModalBtnCancel: {
    backgroundColor: AppTheme.bgScreen,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  weightModalBtnSave: {
    backgroundColor: AppTheme.accent,
  },
  weightModalBtnTextCancel: {
    color: AppTheme.textSecondary,
    fontWeight: '600',
  },
  weightModalBtnTextSave: {
    color: AppTheme.accentDark,
    fontWeight: '700',
  },
});

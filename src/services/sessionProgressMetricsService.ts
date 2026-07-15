/**
 * Builds progress metrics for a photo session date from existing user data.
 * Fields without data return status: 'pending' | 'unavailable' so the UI stays ready.
 */

import type { WorkoutSession } from '../../data/workoutPrograms';
import type { LoggedMeal } from '../utils/loggedMeals';
import type { WeightEntry } from '../utils/workoutHistoryChartData';
import type { PhotoSession } from '../types/progressPhotos';
import type { SessionProgressMetrics, MetricValue } from '../types/sessionProgressMetrics';
import { realizedE1RM } from '../utils/strengthMetrics';

export interface SessionMetricsInput {
  session: PhotoSession;
  previousSession?: PhotoSession | null;
  weightEntries: WeightEntry[];
  meals: LoggedMeal[];
  workoutHistory: WorkoutSession[];
  moodEntries: Array<{ date?: string; sleepQuality?: number }>;
  /** Optional future measurement logs keyed by date. */
  measurementEntries?: Array<{ date: string; waistIn?: number; chestIn?: number; hipsIn?: number }>;
}

function toDayKey(raw: string | undefined | null): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayWeight(entries: WeightEntry[], dateKey: string): number | null {
  const sameDay = entries
    .filter((e) => toDayKey(e.date) === dateKey && Number.isFinite(e.weight) && e.weight > 0)
    .map((e) => e.weight);
  if (!sameDay.length) {
    // Nearest within ±3 days for sparse scale logs.
    const target = new Date(`${dateKey}T12:00:00`).getTime();
    let best: { w: number; dist: number } | null = null;
    for (const e of entries) {
      const k = toDayKey(e.date);
      if (!k || !(e.weight > 0)) continue;
      const dist = Math.abs(new Date(`${k}T12:00:00`).getTime() - target);
      if (dist > 3 * 86400000) continue;
      if (!best || dist < best.dist) best = { w: e.weight, dist };
    }
    return best?.w ?? null;
  }
  return sameDay.reduce((a, b) => a + b, 0) / sameDay.length;
}

function dayMeals(
  meals: LoggedMeal[],
  dateKey: string
): { calories: number; protein: number; logged: boolean } {
  let calories = 0;
  let protein = 0;
  let logged = false;
  for (const m of meals) {
    if (toDayKey(m.date) !== dateKey) continue;
    logged = true;
    calories += m.calories || 0;
    protein += m.protein || 0;
  }
  return { calories, protein, logged };
}

function dayWorkouts(history: WorkoutSession[], dateKey: string) {
  const sessions = history.filter((s) => s.completed && toDayKey(s.date) === dateKey);
  let totalSets = 0;
  let totalVolume = 0;
  let topLiftName: string | null = null;
  let topLiftWeight = 0;
  let peakE1rm = 0;

  for (const s of sessions) {
    for (const ex of s.exercises || []) {
      for (const st of ex.sets || []) {
        if (!st.completed) continue;
        totalSets += 1;
        const w = Math.max(0, st.weight || 0);
        const r = Math.max(0, st.reps || 0);
        totalVolume += w * r;
        if (w > topLiftWeight) {
          topLiftWeight = w;
          topLiftName = ex.name || null;
        }
        peakE1rm = Math.max(peakE1rm, realizedE1RM(w, r, st.rpe));
      }
    }
  }

  return {
    completedSessions: sessions.length,
    totalSets,
    totalVolume,
    topLiftName,
    topLiftWeight: topLiftWeight > 0 ? topLiftWeight : null,
    peakE1rm: peakE1rm > 0 ? peakE1rm : null,
  };
}

function dayRecovery(
  moods: Array<{ date?: string; sleepQuality?: number }>,
  dateKey: string
): number | null {
  const vals = moods
    .filter((m) => toDayKey(m.date) === dateKey && typeof m.sleepQuality === 'number')
    .map((m) => m.sleepQuality as number);
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg * 10);
}

function metric(
  label: string,
  value: number | null,
  opts: {
    unit?: string;
    prev?: number | null;
    pending?: boolean;
    emptyHint?: string;
  } = {}
): MetricValue {
  if (opts.pending) {
    return {
      label,
      value: null,
      unit: opts.unit,
      status: 'pending',
      emptyHint: opts.emptyHint ?? 'Coming soon',
      delta: null,
    };
  }
  if (value == null || !Number.isFinite(value)) {
    return {
      label,
      value: null,
      unit: opts.unit,
      status: 'unavailable',
      emptyHint: opts.emptyHint ?? 'No data for this day',
      delta: null,
    };
  }
  const prev = opts.prev;
  const delta =
    prev != null && Number.isFinite(prev) ? Math.round((value - prev) * 10) / 10 : null;
  return {
    label,
    value,
    unit: opts.unit,
    status: 'available',
    delta,
  };
}

export function buildSessionProgressMetrics(input: SessionMetricsInput): SessionProgressMetrics {
  const { session, previousSession, weightEntries, meals, workoutHistory, moodEntries } = input;
  const date = session.date;
  const prevDate = previousSession?.date ?? null;

  const weight = dayWeight(weightEntries, date);
  const prevWeight = prevDate ? dayWeight(weightEntries, prevDate) : null;

  const mealDay = dayMeals(meals, date);
  const prevMeal = prevDate ? dayMeals(meals, prevDate) : null;

  const workout = dayWorkouts(workoutHistory, date);
  const prevWorkout = prevDate ? dayWorkouts(workoutHistory, prevDate) : null;

  const recovery = dayRecovery(moodEntries, date);
  const prevRecovery = prevDate ? dayRecovery(moodEntries, prevDate) : null;

  const measurementLog = (input.measurementEntries ?? []).find(
    (m) => toDayKey(m.date) === date
  );
  const prevMeasurement = prevDate
    ? (input.measurementEntries ?? []).find((m) => toDayKey(m.date) === prevDate)
    : null;
  const waist = measurementLog?.waistIn ?? null;
  const prevWaist = prevMeasurement?.waistIn ?? null;

  const metaWeight =
    typeof session.metadata?.weight === 'number' ? (session.metadata.weight as number) : null;

  return {
    sessionId: session.id,
    date,
    weight: metric('Weight', metaWeight ?? weight, {
      unit: 'lb',
      prev: prevWeight,
      emptyHint: 'Log weight to sync with this day',
    }),
    measurements: metric('Waist', waist, {
      unit: 'in',
      prev: prevWaist,
      pending: !input.measurementEntries?.length && waist == null,
      emptyHint: 'Measurements will appear when logging is added',
    }),
    strength: metric('Est. peak strength', workout.peakE1rm, {
      unit: 'lb',
      prev: prevWorkout?.peakE1rm ?? null,
      emptyHint: 'Complete a workout this day to see strength',
    }),
    calories: metric('Calories', mealDay.logged ? mealDay.calories : null, {
      unit: 'kcal',
      prev: prevMeal?.logged ? prevMeal.calories : null,
      emptyHint: 'Log meals on this day',
    }),
    protein: metric('Protein', mealDay.logged ? mealDay.protein : null, {
      unit: 'g',
      prev: prevMeal?.logged ? prevMeal.protein : null,
      emptyHint: 'Log meals on this day',
    }),
    recovery: metric('Recovery', recovery, {
      unit: '/100',
      prev: prevRecovery,
      emptyHint: 'Log sleep/mood to track recovery',
    }),
    workoutSummary: {
      completedSessions: workout.completedSessions,
      totalSets: workout.totalSets,
      totalVolume: workout.totalVolume,
      topLiftName: workout.topLiftName,
      topLiftWeight: workout.topLiftWeight,
    },
    coachNotes: null,
    aiInsightsPlaceholder: 'AI insights for this session will appear here in a future update.',
  };
}

export function buildMetricsBySessionId(
  sessions: PhotoSession[],
  data: Omit<SessionMetricsInput, 'session' | 'previousSession'>
): Map<string, SessionProgressMetrics> {
  const map = new Map<string, SessionProgressMetrics>();
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < sorted.length; i++) {
    const session = sorted[i];
    map.set(
      session.id,
      buildSessionProgressMetrics({
        session,
        previousSession: i > 0 ? sorted[i - 1] : null,
        ...data,
      })
    );
  }
  return map;
}

export function findComparisonSessions(
  sessions: PhotoSession[],
  range: 'beginning' | '30d' | '60d' | '90d'
): { before: PhotoSession; after: PhotoSession } | null {
  if (sessions.length < 2) return null;
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const after = sorted[sorted.length - 1];
  if (range === 'beginning') {
    return { before: sorted[0], after };
  }
  const days = range === '30d' ? 30 : range === '60d' ? 60 : 90;
  const afterMs = new Date(`${after.date}T12:00:00`).getTime();
  const target = afterMs - days * 86400000;
  let before = sorted[0];
  let bestDist = Infinity;
  for (const s of sorted.slice(0, -1)) {
    const ms = new Date(`${s.date}T12:00:00`).getTime();
    const dist = Math.abs(ms - target);
    if (dist < bestDist) {
      bestDist = dist;
      before = s;
    }
  }
  return { before, after };
}

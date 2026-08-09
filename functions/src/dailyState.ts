/**
 * Build UserDailyState from Firestore users/{uid}/appData/* documents.
 */
import type { Firestore } from 'firebase-admin/firestore';
import {
  mapProactiveToTone,
  type NotificationCategory,
  type ProactiveCoachingLevel,
  type UserDailyState,
} from './types';

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function localParts(timezone: string, now = new Date()): { dateKey: string; hour: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const hourRaw = Number(get('hour'));
    return {
      dateKey: `${get('year')}-${get('month')}-${get('day')}`,
      hour: Number.isFinite(hourRaw) ? hourRaw % 24 : now.getHours(),
    };
  } catch {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return { dateKey: `${y}-${m}-${d}`, hour: now.getHours() };
  }
}

function dateKeyFromIso(iso: string, timezone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return localParts(timezone, d).dateKey;
}

function mondayKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

async function readAppData(db: Firestore, uid: string, key: string): Promise<unknown> {
  const snap = await db.doc(`users/${uid}/appData/${key}`).get();
  if (!snap.exists) return null;
  const data = snap.data() as { value?: unknown } | undefined;
  return data?.value ?? data ?? null;
}

export async function buildUserDailyState(
  db: Firestore,
  uid: string,
  timezone: string,
  historyMeta: {
    notificationsToday: number;
    recentTypes: NotificationCategory[];
    ignoredCategories: NotificationCategory[];
  }
): Promise<UserDailyState> {
  const { dateKey, hour } = localParts(timezone);
  const weekStart = mondayKey(dateKey);

  const [
    coachingProfile,
    workoutHistoryRaw,
    mealsRaw,
    nutritionGoalsRaw,
    milestonesRaw,
    weightEntriesRaw,
    moodEntriesRaw,
    activePlansRaw,
    savedPlansRaw,
  ] = await Promise.all([
    readAppData(db, uid, 'coachingProfile'),
    readAppData(db, uid, 'workoutHistory'),
    readAppData(db, uid, 'meals'),
    readAppData(db, uid, 'nutritionGoals'),
    readAppData(db, uid, 'userMilestones'),
    readAppData(db, uid, 'weightEntries'),
    readAppData(db, uid, 'moodEntries'),
    readAppData(db, uid, 'activeWorkoutPlans'),
    readAppData(db, uid, 'savedWorkoutPlans'),
  ]);

  const profile = (coachingProfile && typeof coachingProfile === 'object'
    ? coachingProfile
    : {}) as Record<string, unknown>;
  const nutritionPrefs = (profile.nutritionPreferencesProfile ||
    profile.nutritionPreferences ||
    {}) as Record<string, unknown>;
  const proactive = (nutritionPrefs.proactiveCoaching as ProactiveCoachingLevel | null) ?? null;

  const training = (profile.trainingProfile || profile.training || {}) as Record<string, unknown>;
  const daysPerWeek = Number(training.daysPerWeek ?? training.trainingDaysPerWeek ?? 3) || 3;
  const primaryGoal =
    (typeof profile.primaryGoal === 'string' && profile.primaryGoal) ||
    (typeof (profile.goals as { primary?: string } | undefined)?.primary === 'string'
      ? (profile.goals as { primary: string }).primary
      : null);
  const experienceLevel =
    typeof training.experienceLevel === 'string'
      ? training.experienceLevel
      : typeof profile.experienceLevel === 'string'
        ? profile.experienceLevel
        : null;

  const sessions = asArray<{
    date?: string;
    completed?: boolean;
    programName?: string;
  }>(workoutHistoryRaw).filter((s) => s && s.completed !== false);

  const completedToday = sessions.some((s) => {
    const k = s.date ? dateKeyFromIso(String(s.date), timezone) : '';
    return k === dateKey;
  });

  const weeklyCompleted = sessions.filter((s) => {
    const k = s.date ? dateKeyFromIso(String(s.date), timezone) : '';
    return k >= weekStart && k <= dateKey;
  }).length;

  // Streak: consecutive calendar days with a completed session ending today or yesterday
  let streak = 0;
  {
    const daySet = new Set(
      sessions
        .map((s) => (s.date ? dateKeyFromIso(String(s.date), timezone) : ''))
        .filter(Boolean)
    );
    const cursor = new Date(
      Number(dateKey.slice(0, 4)),
      Number(dateKey.slice(5, 7)) - 1,
      Number(dateKey.slice(8, 10))
    );
    if (!daySet.has(dateKey)) cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 60; i++) {
      const k = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (!daySet.has(k)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const milestones = (milestonesRaw && typeof milestonesRaw === 'object'
    ? milestonesRaw
    : {}) as Record<string, unknown>;
  const currentStreak = Math.max(
    streak,
    Number(milestones.workoutStreakDays ?? milestones.loggerOpenStreakDays ?? 0) || 0
  );

  // Missed: target days this week minus completed (rough adherence gap)
  const weekdayIndex = (() => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  })();
  const daysElapsedThisWeek = weekdayIndex === 0 ? 7 : weekdayIndex; // Mon=1..Sun=7 approx
  const expectedSoFar = Math.min(
    daysPerWeek,
    Math.max(1, Math.round((daysPerWeek * Math.min(daysElapsedThisWeek, 7)) / 7))
  );
  const recentMissedWorkouts = Math.max(0, expectedSoFar - weeklyCompleted);

  const activeIds = asArray<string>(activePlansRaw);
  const savedPlans = asArray<{ id?: string; name?: string; weeklyPlan?: { weekDays?: unknown[] } }>(
    savedPlansRaw
  );
  const activePlan =
    activeIds.map((id) => savedPlans.find((p) => p.id === id)).find(Boolean) || savedPlans[0] || null;
  const hasStructuredDays = Boolean(activePlan?.weeklyPlan?.weekDays?.length);
  const scheduledToday = Boolean(activePlan) && hasStructuredDays && !completedToday;
  const todayLabel = activePlan?.name ? String(activePlan.name) : null;

  const goals = (nutritionGoalsRaw && typeof nutritionGoalsRaw === 'object'
    ? nutritionGoalsRaw
    : {}) as Record<string, number>;
  const calorieTarget = Number(goals.calories ?? 2200) || 2200;
  const proteinTarget = Number(goals.protein ?? 150) || 150;

  const meals = asArray<{ date?: string; calories?: number; protein?: number }>(mealsRaw);
  const todaysMeals = meals.filter((m) => {
    const k = m.date ? dateKeyFromIso(String(m.date), timezone) : '';
    return k === dateKey;
  });
  const caloriesLogged = todaysMeals.reduce((a, m) => a + (Number(m.calories) || 0), 0);
  const proteinLogged = todaysMeals.reduce((a, m) => a + (Number(m.protein) || 0), 0);
  const proteinRemaining = Math.max(0, proteinTarget - proteinLogged);
  const caloriesRemaining = Math.max(0, calorieTarget - caloriesLogged);

  const weights = asArray<{ date?: string; weight?: number }>(weightEntriesRaw)
    .map((w) => ({
      date: w.date ? dateKeyFromIso(String(w.date), timezone) : '',
      weight: Number(w.weight),
    }))
    .filter((w) => w.date && Number.isFinite(w.weight))
    .sort((a, b) => a.date.localeCompare(b.date));
  let weightTrendLabel: string | null = null;
  if (weights.length >= 2) {
    const recent = weights.slice(-4);
    const delta = recent[recent.length - 1].weight - recent[0].weight;
    if (Math.abs(delta) >= 1.5) {
      weightTrendLabel = delta < 0 ? `down ${Math.abs(delta).toFixed(1)} lb recently` : `up ${delta.toFixed(1)} lb recently`;
    } else {
      weightTrendLabel = 'stable recently';
    }
  }

  const moods = asArray<{ date?: string; sleepQuality?: number }>(moodEntriesRaw);
  const recentSleep = moods
    .filter((m) => typeof m.sleepQuality === 'number')
    .slice(-5)
    .map((m) => Number(m.sleepQuality));
  const recentSleepQualityAvg =
    recentSleep.length > 0
      ? recentSleep.reduce((a, b) => a + b, 0) / recentSleep.length
      : null;

  return {
    userId: uid,
    localDateKey: dateKey,
    localHour: hour,
    coachingTone: mapProactiveToTone(proactive),
    proactiveCoaching: proactive,
    profile: {
      primaryGoal,
      experienceLevel,
      daysPerWeek,
    },
    training: {
      scheduledToday,
      completedToday,
      todayLabel,
      weeklyCompleted,
      weeklyTarget: daysPerWeek,
      recentMissedWorkouts,
      currentStreak,
      totalCompletedSessions: sessions.length,
    },
    nutrition: {
      caloriesLogged,
      proteinLogged,
      calorieTarget,
      proteinTarget,
      caloriesRemaining,
      proteinRemaining,
      proteinGapSignificant: proteinRemaining >= 25 && caloriesRemaining >= 150,
      loggingToday: todaysMeals.length > 0,
    },
    progress: { weightTrendLabel },
    recovery: { recentSleepQualityAvg },
    notificationHistory: historyMeta,
  };
}

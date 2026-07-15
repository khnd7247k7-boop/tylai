/**
 * Overall Progress Score — computes category + overall scores from real user data.
 */

import type { WorkoutSession } from '../../data/workoutPrograms';
import type { LoggedMeal } from '../utils/loggedMeals';
import type { WeightEntry } from '../utils/workoutHistoryChartData';
import type { UserMilestones } from '../types/userMilestones';
import type { NutritionGoals } from '../types/nutritionGoals';
import type { CoachingProfile, PrimaryGoal } from '../types/coachingProfile';
import { DEFAULT_USER_MILESTONES } from '../types/userMilestones';
import { DEFAULT_NUTRITION_GOALS } from '../types/nutritionGoals';
import { computeRecoveryScore } from './GoalDrivenCoaching';
import { realizedE1RM } from '../utils/strengthMetrics';
import {
  PROGRESS_SCORE_WEIGHTS,
  PROGRESS_CATEGORY_LABELS,
  type ProgressCategoryId,
} from '../constants/progressScoreWeights';

export interface MoodEntryLite {
  date?: string;
  sleepQuality?: number;
}

export interface CompletedTaskLite {
  category?: string;
  completed?: boolean;
  date?: string;
}

export interface DatedEntryLite {
  date?: string;
}

export interface ProgressScoreInput {
  workoutHistory: WorkoutSession[];
  meals: LoggedMeal[];
  nutritionGoals: NutritionGoals | null;
  weightEntries: WeightEntry[];
  milestones: UserMilestones;
  completedTasks: CompletedTaskLite[];
  moodEntries: MoodEntryLite[];
  reflectionEntries: DatedEntryLite[];
  gratitudeEntries: DatedEntryLite[];
  coachingProfile: CoachingProfile | null;
  daysPerWeek: number;
  /** Anchor date for "this week" (defaults to now). */
  referenceDate?: Date;
}

export interface CategoryScore {
  id: ProgressCategoryId;
  label: string;
  score: number;
  explanation: string;
}

export interface ProgressTrend {
  direction: 'up' | 'down' | 'flat';
  delta: number;
  label: string;
}

export interface ProgressScoreResult {
  overall: number;
  overallTagline: string;
  categories: CategoryScore[];
  trend: ProgressTrend;
  coachSummary: {
    headline: string;
    body: string;
  };
}

interface WeekScores {
  overall: number;
  categories: Record<ProgressCategoryId, number>;
}

function clampScore(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)));
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return end;
}

function inWeek(dateStr: string, weekStart: Date): boolean {
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return false;
  return dt >= weekStart && dt < weekEnd(weekStart);
}

function sessionsInWeek(sessions: WorkoutSession[], weekStart: Date): WorkoutSession[] {
  return sessions.filter((s) => s.completed && inWeek(s.date, weekStart));
}

function workoutStreakDays(sessions: WorkoutSession[]): number {
  const keys = new Set(
    sessions.filter((s) => s.completed).map((s) => localDateKey(new Date(s.date)))
  );
  let check = new Date();
  check.setHours(0, 0, 0, 0);
  if (!keys.has(localDateKey(check))) check.setDate(check.getDate() - 1);
  let streak = 0;
  while (keys.has(localDateKey(check))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

function aggregateMealsByDay(
  meals: LoggedMeal[],
  weekStart: Date
): Map<string, { cal: number; p: number; c: number; f: number }> {
  const byDay = new Map<string, { cal: number; p: number; c: number; f: number }>();
  for (const meal of meals) {
    if (!inWeek(meal.date, weekStart)) continue;
    const key = localDateKey(new Date(meal.date));
    const cur = byDay.get(key) ?? { cal: 0, p: 0, c: 0, f: 0 };
    cur.cal += meal.calories || 0;
    cur.p += meal.protein || 0;
    cur.c += meal.carbs || 0;
    cur.f += meal.fat || 0;
    byDay.set(key, cur);
  }
  return byDay;
}

function setCompletionRate(sessions: WorkoutSession[]): number | null {
  let planned = 0;
  let done = 0;
  for (const s of sessions) {
    for (const ex of s.exercises || []) {
      for (const st of ex.sets || []) {
        planned += 1;
        if (st.completed) done += 1;
      }
    }
  }
  return planned > 0 ? Math.round((done / planned) * 100) : null;
}

function peakSessionE1RM(session: WorkoutSession): number {
  let peak = 0;
  for (const ex of session.exercises || []) {
    for (const st of ex.sets || []) {
      if (!st.completed || st.weight <= 0 || st.reps <= 0) continue;
      peak = Math.max(peak, realizedE1RM(st.weight, st.reps, st.rpe));
    }
  }
  return peak;
}

function averageWeightInWeek(entries: WeightEntry[], weekStart: Date): number | null {
  const vals = entries
    .filter((e) => inWeek(e.date, weekStart))
    .map((e) => e.weight)
    .filter((w) => Number.isFinite(w) && w > 0);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function computeTrainingScore(
  input: ProgressScoreInput,
  weekStart: Date
): { score: number; explanation: string } {
  const weekSessions = sessionsInWeek(input.workoutHistory, weekStart);
  const scheduled = Math.min(7, Math.max(1, input.daysPerWeek));
  const completed = weekSessions.length;
  const completionRate = Math.min(100, Math.round((completed / scheduled) * 100));
  const setRate = setCompletionRate(weekSessions) ?? completionRate;
  const streak = workoutStreakDays(input.workoutHistory);
  const streakScore = Math.min(100, Math.round((streak / 7) * 100));

  const score = clampScore(completionRate * 0.55 + setRate * 0.25 + streakScore * 0.2);

  let explanation: string;
  if (completionRate >= 95) {
    explanation = "You've completed nearly every scheduled workout.";
  } else if (completionRate >= 75) {
    explanation = `You've completed ${completed} of ${scheduled} scheduled workouts this week.`;
  } else if (completed === 0) {
    explanation = 'No workouts completed yet this week — start with your next scheduled session.';
  } else {
    explanation = `Workout completion is at ${completionRate}% — aim to hit your ${scheduled}-day plan.`;
  }

  return { score, explanation };
}

function computeNutritionScore(
  input: ProgressScoreInput,
  weekStart: Date
): { score: number; explanation: string } {
  const goals = input.nutritionGoals ?? DEFAULT_NUTRITION_GOALS;
  const byDay = aggregateMealsByDay(input.meals, weekStart);
  const loggingDays = byDay.size;

  if (loggingDays === 0) {
    return {
      score: 45,
      explanation: 'Start logging meals to track nutrition progress.',
    };
  }

  let calHits = 0;
  let proteinHits = 0;
  let macroHits = 0;

  for (const day of byDay.values()) {
    const calRatio = day.cal / Math.max(1, goals.calories);
    if (calRatio >= 0.75 && calRatio <= 1.15) calHits += 1;

    const proteinRatio = goals.protein > 0 ? day.p / goals.protein : 1;
    if (proteinRatio >= 0.8) proteinHits += 1;

    const carbsRatio = goals.carbs > 0 ? day.c / goals.carbs : 1;
    const fatRatio = goals.fat > 0 ? day.f / goals.fat : 1;
    if (
      calRatio >= 0.8 &&
      calRatio <= 1.2 &&
      proteinRatio >= 0.7 &&
      carbsRatio >= 0.65 &&
      carbsRatio <= 1.35 &&
      fatRatio >= 0.65 &&
      fatRatio <= 1.35
    ) {
      macroHits += 1;
    }
  }

  const calScore = (calHits / loggingDays) * 100;
  const proteinScore = (proteinHits / loggingDays) * 100;
  const macroScore = (macroHits / loggingDays) * 100;
  const loggingScore = (loggingDays / 7) * 100;

  const score = clampScore(
    calScore * 0.35 + proteinScore * 0.3 + macroScore * 0.15 + loggingScore * 0.2
  );

  let explanation: string;
  if (score >= 85) {
    explanation = "You've stayed close to your calorie and protein targets.";
  } else if (proteinScore < 60) {
    explanation = 'Focus on hitting your daily protein goal more consistently.';
  } else if (loggingScore < 70) {
    explanation = `You've logged meals on ${loggingDays} of 7 days — more consistent logging will improve your score.`;
  } else {
    explanation = 'Calorie intake has been slightly off target on some days this week.';
  }

  return { score, explanation };
}

function computeRecoveryScoreDetailed(
  input: ProgressScoreInput,
  weekStart: Date
): { score: number; explanation: string } {
  const weekMood = input.moodEntries.filter((m) => m.date && inWeek(m.date, weekStart));
  const sleepVals = weekMood
    .map((m) => m.sleepQuality)
    .filter((s): s is number => typeof s === 'number' && s > 0);
  const avgSleep = sleepVals.length
    ? sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length
    : null;
  const sleepScore = avgSleep !== null ? clampScore(avgSleep * 10) : null;

  const mindsetCheckIns = input.completedTasks.filter(
    (t) => t.completed && t.category === 'mindset' && (!t.date || inWeek(t.date, weekStart))
  ).length;
  const checkInScore = clampScore((mindsetCheckIns / 7) * 100);

  const weekTrainingDays = sessionsInWeek(input.workoutHistory, weekStart).length;
  const scheduled = Math.max(1, input.daysPerWeek);
  const restScore =
    weekTrainingDays <= scheduled + 1
      ? 100
      : clampScore(100 - (weekTrainingDays - scheduled - 1) * 18);

  const onboardingRecovery = input.coachingProfile
    ? computeRecoveryScore(input.coachingProfile)
    : 65;

  const sleepComponent = sleepScore ?? onboardingRecovery;
  const score = clampScore(sleepComponent * 0.45 + checkInScore * 0.25 + restScore * 0.3);

  let explanation: string;
  if (avgSleep !== null && avgSleep < 6.5) {
    explanation = `Recovery has been slightly below ideal — average sleep quality was ${avgSleep.toFixed(1)}/10.`;
  } else if (score >= 80) {
    explanation = 'Sleep and recovery habits are supporting your training well.';
  } else if (checkInScore < 50) {
    explanation = 'Complete more daily check-ins to track recovery and stress.';
  } else {
    explanation = 'Recovery is moderate — prioritize sleep and rest days this week.';
  }

  return { score, explanation };
}

function computeBodyProgressScore(
  input: ProgressScoreInput,
  weekStart: Date
): { score: number; explanation: string } {
  const goal: PrimaryGoal = input.coachingProfile?.goalProfile?.primaryGoal ?? 'general_fitness';
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const thisWeight = averageWeightInWeek(input.weightEntries, weekStart);
  const lastWeight = averageWeightInWeek(input.weightEntries, prevWeekStart);
  const weightDelta =
    thisWeight !== null && lastWeight !== null && lastWeight > 0
      ? ((thisWeight - lastWeight) / lastWeight) * 100
      : null;

  const thisSessions = sessionsInWeek(input.workoutHistory, weekStart);
  const lastSessions = sessionsInWeek(input.workoutHistory, prevWeekStart);
  const thisPeak = thisSessions.reduce((m, s) => Math.max(m, peakSessionE1RM(s)), 0);
  const lastPeak = lastSessions.reduce((m, s) => Math.max(m, peakSessionE1RM(s)), 0);
  const strengthUp = thisPeak > 0 && lastPeak > 0 && thisPeak > lastPeak * 1.02;

  let score = 60;
  let explanation = 'Keep logging weight and workouts to measure body progress.';

  if (goal === 'fat_loss') {
    if (weightDelta !== null) {
      if (weightDelta <= -0.3 && weightDelta >= -1.5) score = 92;
      else if (weightDelta < 0) score = 78;
      else if (weightDelta <= 0.3) score = 62;
      else score = 42;
    }
    explanation =
      weightDelta !== null && weightDelta < 0
        ? 'Weight and measurements are moving toward your fat-loss goal.'
        : 'Weight trend is flat or up — tighten nutrition consistency for fat loss.';
  } else if (goal === 'muscle_gain') {
    if (strengthUp && weightDelta !== null && weightDelta >= 0 && weightDelta <= 0.75) score = 90;
    else if (strengthUp) score = 82;
    else if (weightDelta !== null && weightDelta > 0) score = 70;
    else score = 58;
    explanation = strengthUp
      ? 'Strength is increasing and weight is trending appropriately for muscle gain.'
      : 'Prioritize progressive overload and sufficient calories for muscle gain.';
  } else {
    if (weightDelta !== null && Math.abs(weightDelta) <= 0.4) score = 88;
    else if (strengthUp) score = 82;
    else if (weightDelta !== null) score = 68;
    explanation =
      weightDelta !== null && Math.abs(weightDelta) <= 0.5
        ? 'Weight and measurements are stable while habits stay consistent.'
        : 'Body metrics are shifting — stay consistent with your maintenance plan.';
  }

  return { score: clampScore(score), explanation };
}

function computeConsistencyScore(
  input: ProgressScoreInput,
  weekStart: Date
): { score: number; explanation: string } {
  const mealDays = aggregateMealsByDay(input.meals, weekStart).size;
  const workoutDays = new Set(
    sessionsInWeek(input.workoutHistory, weekStart).map((s) => localDateKey(new Date(s.date)))
  ).size;
  const moodDays = new Set(
    input.moodEntries
      .filter((m) => m.date && inWeek(m.date, weekStart))
      .map((m) => localDateKey(new Date(m.date!)))
  ).size;
  const reflectionDays = new Set(
    input.reflectionEntries
      .filter((r) => r.date && inWeek(r.date, weekStart))
      .map((r) => localDateKey(new Date(r.date!)))
  ).size;
  const gratitudeDays = new Set(
    input.gratitudeEntries
      .filter((g) => g.date && inWeek(g.date, weekStart))
      .map((g) => localDateKey(new Date(g.date!)))
  ).size;

  const nutritionLogging = (mealDays / 7) * 100;
  const workoutLogging = (workoutDays / 7) * 100;
  const checkIns = (Math.min(7, moodDays + reflectionDays + gratitudeDays) / 7) * 100;
  const streakScore = Math.min(
    100,
    Math.round((input.milestones.workout_logger_open_streak / 14) * 100)
  );
  const milestoneBlend = input.milestones.consistency_score || 0;

  const score = clampScore(
    nutritionLogging * 0.25 +
      workoutLogging * 0.25 +
      checkIns * 0.2 +
      streakScore * 0.15 +
      milestoneBlend * 0.15
  );

  let explanation: string;
  if (score >= 90) {
    explanation = "You've shown excellent adherence to your plan.";
  } else if (mealDays < 4) {
    explanation = 'Log meals and workouts more regularly to build consistency.';
  } else {
    explanation = 'Your logging habits are improving — keep building daily momentum.';
  }

  return { score, explanation };
}

function computeWeekScores(input: ProgressScoreInput, weekStart: Date): WeekScores {
  const training = computeTrainingScore(input, weekStart);
  const nutrition = computeNutritionScore(input, weekStart);
  const recovery = computeRecoveryScoreDetailed(input, weekStart);
  const bodyProgress = computeBodyProgressScore(input, weekStart);
  const consistency = computeConsistencyScore(input, weekStart);

  const categories: Record<ProgressCategoryId, number> = {
    training: training.score,
    nutrition: nutrition.score,
    recovery: recovery.score,
    bodyProgress: bodyProgress.score,
    consistency: consistency.score,
  };

  const overall = clampScore(
    categories.training * PROGRESS_SCORE_WEIGHTS.training +
      categories.nutrition * PROGRESS_SCORE_WEIGHTS.nutrition +
      categories.recovery * PROGRESS_SCORE_WEIGHTS.recovery +
      categories.bodyProgress * PROGRESS_SCORE_WEIGHTS.bodyProgress +
      categories.consistency * PROGRESS_SCORE_WEIGHTS.consistency
  );

  return { overall, categories };
}

function buildCategoryList(input: ProgressScoreInput, weekStart: Date): CategoryScore[] {
  const training = computeTrainingScore(input, weekStart);
  const nutrition = computeNutritionScore(input, weekStart);
  const recovery = computeRecoveryScoreDetailed(input, weekStart);
  const bodyProgress = computeBodyProgressScore(input, weekStart);
  const consistency = computeConsistencyScore(input, weekStart);

  const entries: Array<{ id: ProgressCategoryId; score: number; explanation: string }> = [
    { id: 'training', ...training },
    { id: 'nutrition', ...nutrition },
    { id: 'recovery', ...recovery },
    { id: 'bodyProgress', ...bodyProgress },
    { id: 'consistency', ...consistency },
  ];

  return entries.map((e) => ({
    id: e.id,
    label: PROGRESS_CATEGORY_LABELS[e.id],
    score: e.score,
    explanation: e.explanation,
  }));
}

function overallTagline(overall: number): string {
  if (overall >= 90) return "You're making excellent progress. Keep doing what you're doing.";
  if (overall >= 75) return "You're making solid progress. Stay consistent with your plan.";
  if (overall >= 60) return "You're building momentum. Focus on your weakest category this week.";
  if (overall >= 40) return 'Progress is starting — small daily wins will move the needle.';
  return "Let's reset this week — pick one habit to nail every day.";
}

function buildTrend(thisWeek: number, lastWeek: number): ProgressTrend {
  const delta = thisWeek - lastWeek;
  if (Math.abs(delta) < 1) {
    return { direction: 'flat', delta: 0, label: '→ No change' };
  }
  if (delta > 0) {
    return { direction: 'up', delta, label: `↑ +${delta} This Week` };
  }
  return { direction: 'down', delta, label: `↓ ${delta} This Week` };
}

function buildCoachSummary(
  overall: number,
  categories: CategoryScore[],
  input: ProgressScoreInput,
  weekStart: Date
): { headline: string; body: string } {
  const byId = Object.fromEntries(categories.map((c) => [c.id, c])) as Record<
    ProgressCategoryId,
    CategoryScore
  >;

  const headline =
    overall >= 85
      ? 'Excellent progress this week.'
      : overall >= 70
        ? "You're making steady progress."
        : overall >= 55
          ? 'Room to grow this week.'
          : "Let's build momentum together.";

  const parts: string[] = [];

  if (byId.training.score >= 85) {
    parts.push('You completed nearly every scheduled workout.');
  } else if (byId.training.score < 65) {
    parts.push('Prioritize completing your scheduled workouts.');
  }

  if (byId.nutrition.score >= 80) {
    parts.push('Nutrition stayed close to your calorie and protein targets most days.');
  } else if (byId.nutrition.score < 65) {
    parts.push('Focus on protein intake and logging meals consistently.');
  }

  if (byId.recovery.score < 72) {
    const weekMood = input.moodEntries.filter((m) => m.date && inWeek(m.date, weekStart));
    const sleepVals = weekMood
      .map((m) => m.sleepQuality)
      .filter((s): s is number => typeof s === 'number' && s > 0);
    if (sleepVals.length) {
      const avg = sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length;
      parts.push(
        `Recovery dipped slightly because your average sleep quality was ${avg.toFixed(1)}/10 — prioritize getting to bed earlier this week.`
      );
    } else {
      parts.push('Recovery could improve — aim for consistent sleep and rest days.');
    }
  }

  if (byId.consistency.score >= 88) {
    parts.push('Your consistency has improved significantly.');
  }

  if (byId.bodyProgress.score >= 80) {
    parts.push('Body metrics are moving in the right direction for your goal.');
  }

  if (parts.length === 0) {
    parts.push('Keep logging workouts and meals so your coach can give sharper guidance.');
  }

  return { headline, body: parts.join(' ') };
}

export function computeProgressScores(input: ProgressScoreInput): ProgressScoreResult {
  const ref = input.referenceDate ?? new Date();
  const thisWeekStart = mondayStart(ref);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const thisWeek = computeWeekScores(input, thisWeekStart);
  const lastWeek = computeWeekScores(input, lastWeekStart);
  const categories = buildCategoryList(input, thisWeekStart);

  const overall = thisWeek.overall;
  const trend = buildTrend(thisWeek.overall, lastWeek.overall);
  const coachSummary = buildCoachSummary(overall, categories, input, thisWeekStart);

  return {
    overall,
    overallTagline: overallTagline(overall),
    categories,
    trend,
    coachSummary,
  };
}

export function buildDefaultProgressScoreInput(
  partial?: Partial<ProgressScoreInput>
): ProgressScoreInput {
  return {
    workoutHistory: [],
    meals: [],
    nutritionGoals: null,
    weightEntries: [],
    milestones: DEFAULT_USER_MILESTONES,
    completedTasks: [],
    moodEntries: [],
    reflectionEntries: [],
    gratitudeEntries: [],
    coachingProfile: null,
    daysPerWeek: 3,
    ...partial,
  };
}

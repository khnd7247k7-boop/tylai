/**
 * TYL AI Coaching Engine — unified adherence, assessment, and adaptive decision logic.
 * Philosophy: the best plan is the one the user will follow while still progressing.
 */

import { loadUserData } from '../utils/userStorage';
import { loadPersistedNutritionGoals } from '../utils/nutritionGoalsStorage';
import type { LoggedMeal } from '../utils/loggedMeals';
import type { WorkoutSession } from '../../data/workoutPrograms';
import type { UserMilestones } from '../types/userMilestones';
import { DEFAULT_USER_MILESTONES } from '../types/userMilestones';
import UserProfileService, { type UserProfileData } from './UserProfileService';
import { loadCoachingProfile } from './CoachingProfileService';
import { parseWeightToKg } from '../utils/bodyMetricsParse';
import {
  buildGoalAdaptationSummary,
  buildWorkoutGenerationModifiers,
  computeRecoveryScore,
  resolveProgressionLever,
  type ProgressionLever,
} from './GoalDrivenCoaching';
import {
  evaluateNutritionAdaptation,
  type NutritionAdaptationResult,
} from './NutritionAdaptationService';
import {
  PRIMARY_GOAL_LABELS,
  type CoachingProfile,
  type ChallengeDial,
  type PrimaryGoal,
} from '../types/coachingProfile';

export type CoachingFramework =
  | 'general_fitness'
  | 'fat_loss'
  | 'hypertrophy'
  | 'strength'
  | 'powerlifting'
  | 'bodybuilding'
  | 'calisthenics'
  | 'athletic_performance'
  | 'beginner_transformation'
  | 'endurance'
  | 'flexibility'
  | 'specialized';

export type AdaptiveAction =
  | 'maintain'
  | 'progress'
  | 'regress'
  | 'deload'
  | 'simplify'
  | 'intensify';

export type AdherenceRiskCause =
  | 'none'
  | 'low_motivation'
  | 'time_constraints'
  | 'poor_recovery'
  | 'excessive_difficulty'
  | 'unrealistic_expectations'
  | 'unknown';

export interface AdherenceScore {
  overall: number;
  workoutCompletionRate: number;
  nutritionCompliance: number;
  checkInFrequency: number;
  loggerStreakScore: number;
  riskLevel: 'low' | 'moderate' | 'high';
  likelyCause: AdherenceRiskCause;
  trend: 'improving' | 'stable' | 'declining';
}

export interface CoachingContextSnapshot {
  assessment: {
    primaryGoal: string | null;
    secondaryGoals: string[];
    experienceLevel: string | null;
    trainingDaysPerWeek: number | null;
    sessionLengthMinutes: number | null;
    equipment: string | null;
    injuriesOrLimitations: string | null;
    activityLevel: string | null;
    challengeDial: string | null;
    sleepQuality: string | null;
    stressLevel: string | null;
    onboardingComplete: boolean;
    ageYears: number | null;
    sex: string | null;
    heightCm: number | null;
    weightKg: number | null;
    calorieGoal: number | null;
    bmr: number | null;
    tdee: number | null;
    proteinGoal: number | null;
  };
  coachingFramework: CoachingFramework;
  specializedFocus: string[];
  adherence: AdherenceScore;
  adaptiveRecommendation: AdaptiveAction;
  progressionAllowed: boolean;
  identityCoachingNote: string;
  recentPerformance: {
    completedSessionsLast30Days: number;
    averageCompletionRatePct: number | null;
    workoutStreakDays: number;
  };
  goalAdaptation: {
    progressionLever: ProgressionLever;
    primaryFocus: string;
    workoutModifiersSummary: string;
    coachingNote: string;
    recoveryScore: number;
    nutrition: NutritionAdaptationResult | null;
  };
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

function averageSetCompletionRate(sessions: WorkoutSession[]): number | null {
  const recent = sessions.filter((s) => s.completed).slice(0, 8);
  if (!recent.length) return null;
  let planned = 0;
  let done = 0;
  for (const s of recent) {
    for (const ex of s.exercises || []) {
      for (const st of ex.sets || []) {
        planned += 1;
        if (st.completed) done += 1;
      }
    }
  }
  return planned > 0 ? Math.round((done / planned) * 100) : null;
}

function nutritionComplianceScore(meals: LoggedMeal[], calorieGoal: number): number {
  const last7 = new Date();
  last7.setDate(last7.getDate() - 7);
  const byDay = new Map<string, number>();
  for (const m of meals) {
    const dt = new Date(m.date);
    if (dt < last7) continue;
    const key = localDateKey(dt);
    byDay.set(key, (byDay.get(key) || 0) + (m.calories || 0));
  }
  if (byDay.size === 0) return 50;
  let compliant = 0;
  for (const cal of byDay.values()) {
    const pct = cal / Math.max(1, calorieGoal);
    if (pct >= 0.7 && pct <= 1.25) compliant += 1;
  }
  return Math.round((compliant / byDay.size) * 100);
}

function checkInScore(completedTasks: Array<{ category?: string; completed?: boolean }>): number {
  const last14 = new Date();
  last14.setDate(last14.getDate() - 14);
  const mindset = completedTasks.filter(
    (t) => t.completed && t.category === 'mindset'
  );
  if (!mindset.length) return 40;
  return Math.min(100, mindset.length * 25);
}

/** Map structured onboarding goal → coaching framework (preferred over text parsing). */
export function primaryGoalToFramework(goal: PrimaryGoal): CoachingFramework {
  switch (goal) {
    case 'fat_loss':
      return 'fat_loss';
    case 'muscle_gain':
      return 'hypertrophy';
    case 'strength_powerlifting':
      return 'powerlifting';
    case 'calisthenics':
      return 'calisthenics';
    case 'athletic_performance':
      return 'athletic_performance';
    case 'general_fitness':
    default:
      return 'general_fitness';
  }
}

export function detectCoachingFrameworkFromProfile(
  coaching: CoachingProfile | null,
  profile: UserProfileData | null
): CoachingFramework {
  if (coaching?.goalProfile?.primaryGoal) {
    return primaryGoalToFramework(coaching.goalProfile.primaryGoal);
  }
  return detectCoachingFramework(profile);
}

export function detectSpecializedFocusFromProfile(
  coaching: CoachingProfile | null,
  profile: UserProfileData | null
): string[] {
  const out = detectSpecializedFocus(profile);
  const secondary = coaching?.goalProfile?.secondaryGoal?.toLowerCase() ?? '';
  if (secondary.includes('pull-up') || secondary.includes('pullup')) {
    if (!out.includes('pullup_progression')) out.push('pullup_progression');
  }
  if (secondary.includes('posture') || secondary.includes('mobility')) {
    if (!out.includes('mobility_posture')) out.push('mobility_posture');
  }
  if (coaching?.goalProfile?.primaryGoal === 'calisthenics' && !out.includes('pullup_progression')) {
    out.push('pullup_progression');
  }
  return out;
}

export function resolveTrainingDaysPerWeek(
  coaching: CoachingProfile | null,
  profile: UserProfileData | null
): number {
  const fromProfile = coaching?.scheduleProfile?.daysPerWeek ?? profile?.daysPerWeek;
  if (typeof fromProfile === 'number' && fromProfile >= 1 && fromProfile <= 7) {
    return fromProfile;
  }
  return 3;
}

export function detectCoachingFramework(profile: UserProfileData | null): CoachingFramework {
  const text = [
    profile?.primaryGoals,
    ...(profile?.secondaryGoals || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(powerlift|meet prep|peaking|1rm|squat bench dead)/i.test(text)) return 'powerlifting';
  if (/(calisthenic|pull.?up|muscle.?up|handstand|front lever|planche|human flag)/i.test(text))
    return 'calisthenics';
  if (/(bodybuild|contest prep|offseason|hypertrophy|muscle gain|build muscle)/i.test(text))
    return profile && /cut/i.test(text) ? 'bodybuilding' : 'hypertrophy';
  if (/(fat loss|lose weight|cut|lean|100 lb)/i.test(text)) return 'fat_loss';
  if (/(beginner|first time|walking plan|habit|inactive|sedentary)/i.test(text))
    return 'beginner_transformation';
  if (/(athletic|speed|power|sport|conditioning|agility)/i.test(text)) return 'athletic_performance';
  if (/(strength|stronger|lift more)/i.test(text)) return 'strength';
  if (/(endurance|5k|marathon|cardio|running)/i.test(text)) return 'endurance';
  if (/(flex|mobility|posture|yoga)/i.test(text)) return 'flexibility';
  if (/(general fitness|health|active|weight management)/i.test(text)) return 'general_fitness';
  return 'general_fitness';
}

export function detectSpecializedFocus(profile: UserProfileData | null): string[] {
  const text = [profile?.primaryGoals, ...(profile?.secondaryGoals || [])].join(' ').toLowerCase();
  const out: string[] = [];
  if (/abs|core|six.?pack/i.test(text)) out.push('core_development');
  if (/push.?up/i.test(text)) out.push('pushup_progression');
  if (/first pull.?up|pull.?up/i.test(text)) out.push('pullup_progression');
  if (/5k|run/i.test(text)) out.push('running_endurance');
  if (/mobility|posture/i.test(text)) out.push('mobility_posture');
  return out;
}

export function diagnoseAdherenceRisk(
  adherence: Omit<AdherenceScore, 'likelyCause' | 'riskLevel'>,
  completionRate: number | null,
  profile: UserProfileData | null
): AdherenceRiskCause {
  if (adherence.overall >= 70) return 'none';
  if (completionRate !== null && completionRate < 65) return 'excessive_difficulty';
  if (adherence.nutritionCompliance < 50 && adherence.workoutCompletionRate < 50) return 'low_motivation';
  const days = profile?.daysPerWeek ?? 3;
  const expected = days * 4;
  const last30 = adherence.workoutCompletionRate;
  if (last30 < 40 && days >= 5) return 'unrealistic_expectations';
  if (adherence.checkInFrequency < 40) return 'time_constraints';
  return 'unknown';
}

export function computeAdherenceScore(
  milestones: UserMilestones,
  history: WorkoutSession[],
  meals: LoggedMeal[],
  calorieGoal: number,
  completedTasks: Array<{ category?: string; completed?: boolean }>,
  daysPerWeek: number = 3,
  profile: UserProfileData | null = null
): AdherenceScore {
  const last30 = new Date();
  last30.setDate(last30.getDate() - 30);
  const recentSessions = history.filter((s) => s.completed && new Date(s.date) >= last30);
  const safeDays = Math.min(7, Math.max(1, daysPerWeek));
  const expectedSessions = Math.round((30 / 7) * safeDays);
  const workoutCompletionRate = Math.min(
    100,
    Math.round((recentSessions.length / Math.max(1, expectedSessions)) * 100)
  );
  const loggerStreakScore = Math.min(100, Math.round((milestones.workout_logger_open_streak / 14) * 100));
  const nutritionCompliance = nutritionComplianceScore(meals, calorieGoal);
  const checkInFrequency = checkInScore(completedTasks);

  const overall = Math.round(
    workoutCompletionRate * 0.4 +
      nutritionCompliance * 0.2 +
      checkInFrequency * 0.15 +
      loggerStreakScore * 0.15 +
      Math.min(100, milestones.consistency_score) * 0.1
  );

  const base = {
    overall,
    workoutCompletionRate,
    nutritionCompliance,
    checkInFrequency,
    loggerStreakScore,
    trend: 'stable' as const,
  };

  const completionRate = averageSetCompletionRate(history);
  const likelyCause = diagnoseAdherenceRisk(base, completionRate, profile);
  const riskLevel: AdherenceScore['riskLevel'] =
    overall >= 70 ? 'low' : overall >= 45 ? 'moderate' : 'high';

  return { ...base, likelyCause, riskLevel };
}

export function determineAdaptiveAction(
  adherence: AdherenceScore,
  completionRate: number | null,
  recoveryAdequate: boolean,
  progressionLever?: ProgressionLever
): AdaptiveAction {
  if (adherence.riskLevel === 'high' || adherence.overall < 45) {
    if (adherence.likelyCause === 'excessive_difficulty') return 'simplify';
    if (adherence.likelyCause === 'poor_recovery') return 'deload';
    return 'simplify';
  }

  if (progressionLever === 'nutrition' && adherence.nutritionCompliance < 60) {
    return 'maintain';
  }

  if (
    adherence.overall >= 75 &&
    (completionRate === null || completionRate >= 85) &&
    recoveryAdequate
  ) {
    return 'progress';
  }
  if (completionRate !== null && completionRate >= 95 && adherence.overall >= 80) return 'intensify';
  if (completionRate !== null && completionRate < 70) return 'regress';
  return 'maintain';
}

/** Progression is earned — only when adherence and recovery support it. */
export function canEarnProgression(adherence: AdherenceScore, completionRate: number | null): boolean {
  if (adherence.overall < 60) return false;
  if (adherence.riskLevel === 'high') return false;
  if (completionRate !== null && completionRate < 75) return false;
  return true;
}

export async function buildCoachingContextSnapshot(): Promise<CoachingContextSnapshot> {
  const [profile, coachingRaw, history, meals, milestonesRaw, completedTasks, goals] =
    await Promise.all([
    UserProfileService.getUserProfileData(),
    loadCoachingProfile(),
    loadUserData<WorkoutSession[]>('workoutHistory'),
    loadUserData<LoggedMeal[]>('meals'),
    loadUserData<UserMilestones>('userMilestones'),
    loadUserData<Array<{ category?: string; completed?: boolean }>>('completedTasks'),
    loadPersistedNutritionGoals(),
  ]);

  const coaching: CoachingProfile | null =
    coachingRaw?.goalProfile?.primaryGoal ? coachingRaw : null;

  const trainingDaysPerWeek = resolveTrainingDaysPerWeek(coaching, profile);

  const milestones = milestonesRaw
    ? { ...DEFAULT_USER_MILESTONES, ...milestonesRaw }
    : { ...DEFAULT_USER_MILESTONES };
  const hist = history || [];
  const allMeals = meals || [];
  const tasks = completedTasks || [];
  const calorieGoal = goals?.calories ?? 2200;

  const last30 = new Date();
  last30.setDate(last30.getDate() - 30);
  const recentSessions = hist.filter((s) => s.completed && new Date(s.date) >= last30);
  const completionRate = averageSetCompletionRate(hist);

  const adherence = computeAdherenceScore(
    milestones,
    hist,
    allMeals,
    calorieGoal,
    tasks,
    trainingDaysPerWeek,
    profile
  );

  const recoveryScore = coaching ? computeRecoveryScore(coaching) : 55;
  const milestoneRecovery = milestones.recovery_pro_awarded_at.some((iso) => {
    const d = new Date(iso);
    const weekStart = mondayStart(new Date());
    return d >= weekStart;
  });
  const recoveryAdequate = recoveryScore >= 55 || milestoneRecovery;

  const progressionLever = resolveProgressionLever(coaching?.goalProfile.primaryGoal ?? null);
  const adaptiveRecommendation = determineAdaptiveAction(
    adherence,
    completionRate,
    recoveryAdequate,
    progressionLever
  );
  const progressionAllowed = canEarnProgression(adherence, completionRate);
  const framework = detectCoachingFrameworkFromProfile(coaching, profile);
  const specializedFocus = detectSpecializedFocusFromProfile(coaching, profile);
  const modifiers = coaching ? buildWorkoutGenerationModifiers(coaching) : null;
  const goalAdaptationBase = buildGoalAdaptationSummary(coaching, modifiers ?? undefined);
  const nutritionAdaptation = await evaluateNutritionAdaptation(
    coaching,
    allMeals,
    adherence.nutritionCompliance
  );

  const injuries = [profile?.injuries, profile?.limitations].filter(Boolean).join('; ') || null;

  const primaryGoalLabel = coaching?.goalProfile.primaryGoal
    ? PRIMARY_GOAL_LABELS[coaching.goalProfile.primaryGoal]
    : profile?.primaryGoals || null;

  return {
    assessment: {
      primaryGoal: primaryGoalLabel,
      secondaryGoals: coaching?.goalProfile.secondaryGoal
        ? [coaching.goalProfile.secondaryGoal, ...(profile?.secondaryGoals || [])]
        : profile?.secondaryGoals || [],
      experienceLevel:
        coaching?.experienceProfile.level || profile?.trainingExperience || null,
      trainingDaysPerWeek:
        coaching?.scheduleProfile.daysPerWeek ?? profile?.daysPerWeek ?? null,
      sessionLengthMinutes:
        coaching?.scheduleProfile.sessionLengthMinutes ??
        profile?.preferredWorkoutLength ??
        null,
      equipment: coaching?.equipmentProfile.access
        ? coaching.equipmentProfile.access.replace(/_/g, ' ')
        : profile?.equipmentAvailability || null,
      injuriesOrLimitations:
        coaching?.constraintProfile.hasInjuries
          ? [coaching.constraintProfile.injuryDetails, coaching.constraintProfile.movementsToAvoid]
              .filter(Boolean)
              .join('; ') || injuries
          : injuries,
      activityLevel: coaching?.recoveryProfile.dailyActivityLevel
        ? coaching.recoveryProfile.dailyActivityLevel
        : profile?.activityLevel || null,
      challengeDial: coaching?.adherenceProfile.challengeDial ?? null,
      sleepQuality: coaching?.recoveryProfile.sleepQuality ?? null,
      stressLevel: coaching?.recoveryProfile.stressLevel ?? null,
      onboardingComplete: Boolean(coaching?.completedAt),
      ageYears: coaching?.nutritionBodyProfile?.ageYears ?? null,
      sex: coaching?.nutritionBodyProfile?.sex ?? profile?.sex ?? null,
      heightCm: coaching?.nutritionBodyProfile?.heightCm ?? null,
      weightKg:
        coaching?.nutritionBodyProfile?.weightKg ?? parseWeightToKg(profile?.weight) ?? null,
      calorieGoal: goals?.calories ?? null,
      bmr: goals?.bmr ?? null,
      tdee: goals?.tdee ?? null,
      proteinGoal: goals?.protein ?? null,
    },
    coachingFramework: framework,
    specializedFocus,
    adherence,
    adaptiveRecommendation,
    progressionAllowed,
    identityCoachingNote:
      'Reinforce identity-based change: help the user become someone who trains consistently, not just someone chasing short-term motivation.',
    recentPerformance: {
      completedSessionsLast30Days: recentSessions.length,
      averageCompletionRatePct: completionRate,
      workoutStreakDays: workoutStreakDays(hist),
    },
    goalAdaptation: {
      ...goalAdaptationBase,
      recoveryScore,
      nutrition: nutritionAdaptation,
    },
  };
}

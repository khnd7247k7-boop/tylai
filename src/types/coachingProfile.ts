/** Unified coaching profile — single source of truth from onboarding wizard. */

export type PrimaryGoal =
  | 'fat_loss'
  | 'muscle_gain'
  | 'strength_powerlifting'
  | 'calisthenics'
  | 'general_fitness'
  | 'athletic_performance';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'competitive';

export type TimelineOption = 'none' | '3_months' | '6_months' | 'event_date';

export type BestTimeOfDay = 'morning' | 'midday' | 'evening' | 'flexible';

export type EquipmentAccess = 'full_gym' | 'home_gym' | 'minimal' | 'bodyweight';

export type TrainingStylePreference = 'machines' | 'free_weights' | 'mix' | 'bodyweight';

export type RecoveryLevel = 'low' | 'medium' | 'high';

export type DailyActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';

export type ChallengeDial = 'easy' | 'balanced' | 'maximum';

export interface GoalProfile {
  primaryGoal: PrimaryGoal | null;
  secondaryGoal?: string;
  motivation?: string;
  timeline: TimelineOption;
  eventDate?: string;
}

export interface ScheduleProfile {
  daysPerWeek: number | null;
  sessionLengthMinutes: number | null;
  bestTimeOfDay: BestTimeOfDay | null;
}

export interface ExperienceProfile {
  level: ExperienceLevel | null;
  /** Set when answers suggest the user may be overestimating ability */
  overestimateRisk?: boolean;
}

export interface EquipmentProfile {
  access: EquipmentAccess | null;
}

export interface PreferenceProfile {
  likedExercises?: string;
  dislikedExercises?: string;
  trainingStyle: TrainingStylePreference | null;
}

export interface RecoveryProfile {
  sleepQuality: RecoveryLevel | null;
  stressLevel: RecoveryLevel | null;
  dailyActivityLevel: DailyActivityLevel | null;
}

export interface ConstraintProfile {
  hasInjuries: boolean | null;
  injuryDetails?: string;
  movementsToAvoid?: string;
}

export interface AdherenceProfile {
  challengeDial: ChallengeDial | null;
  baselineConsistency?: number;
}

export type SexForBmr = 'male' | 'female';

export interface NutritionBodyProfile {
  sex: SexForBmr | null;
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
  ageDisplay?: string;
  heightDisplay?: string;
  weightDisplay?: string;
  unitPreference: 'imperial' | 'metric';
}

export interface CoachingProfile {
  version: 1;
  completedAt?: string;
  /** Draft resume — 0–10 while in progress */
  onboardingStep?: number;
  goalProfile: GoalProfile;
  scheduleProfile: ScheduleProfile;
  experienceProfile: ExperienceProfile;
  equipmentProfile: EquipmentProfile;
  preferenceProfile: PreferenceProfile;
  recoveryProfile: RecoveryProfile;
  constraintProfile: ConstraintProfile;
  adherenceProfile: AdherenceProfile;
  nutritionBodyProfile: NutritionBodyProfile;
}

export const PRIMARY_GOAL_LABELS: Record<PrimaryGoal, string> = {
  fat_loss: 'Fat loss',
  muscle_gain: 'Muscle gain',
  strength_powerlifting: 'Strength (powerlifting)',
  calisthenics: 'Calisthenics skills',
  general_fitness: 'General fitness',
  athletic_performance: 'Athletic performance',
};

export const ONBOARDING_TOTAL_STEPS = 11;

export function createEmptyCoachingProfile(): CoachingProfile {
  return {
    version: 1,
    onboardingStep: 0,
    goalProfile: {
      primaryGoal: null,
      timeline: 'none',
    },
    scheduleProfile: {
      daysPerWeek: null,
      sessionLengthMinutes: null,
      bestTimeOfDay: null,
    },
    experienceProfile: { level: null },
    equipmentProfile: { access: null },
    preferenceProfile: { trainingStyle: null },
    recoveryProfile: {
      sleepQuality: null,
      stressLevel: null,
      dailyActivityLevel: null,
    },
    constraintProfile: { hasInjuries: null },
    adherenceProfile: { challengeDial: null },
    nutritionBodyProfile: {
      sex: null,
      ageYears: null,
      heightCm: null,
      weightKg: null,
      unitPreference: 'imperial',
    },
  };
}

export function isCoachingProfileComplete(profile: CoachingProfile): boolean {
  const body = profile.nutritionBodyProfile;
  const hasNutrition = Boolean(body?.sex && body?.ageYears && body?.heightCm && body?.weightKg);
  const coreComplete = Boolean(
    profile.goalProfile.primaryGoal &&
      profile.scheduleProfile.daysPerWeek &&
      profile.scheduleProfile.sessionLengthMinutes &&
      profile.scheduleProfile.bestTimeOfDay &&
      profile.experienceProfile.level &&
      profile.equipmentProfile.access &&
      profile.preferenceProfile.trainingStyle &&
      profile.recoveryProfile.sleepQuality &&
      profile.recoveryProfile.stressLevel &&
      profile.recoveryProfile.dailyActivityLevel &&
      profile.constraintProfile.hasInjuries !== null &&
      profile.adherenceProfile.challengeDial
  );

  if (!coreComplete) return false;
  if (profile.completedAt && !hasNutrition) return true;
  return Boolean(profile.completedAt && hasNutrition);
}

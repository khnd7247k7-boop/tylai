import { loadUserData, saveUserData, getUserStorageKey } from '../utils/userStorage';
import { notifyUserDataReady } from '../utils/userDataEvents';
import {
  type CoachingProfile,
  type ExperienceLevel,
  type PrimaryGoal,
  type NutritionBodyProfile,
  createEmptyCoachingProfile,
  isCoachingProfileComplete,
  PRIMARY_GOAL_LABELS,
} from '../types/coachingProfile';
import { injuriesMentionBack } from '../utils/workoutQuestionnaireParse';
import {
  buildWorkoutGenerationModifiers,
  resolveEffectiveTrainingDays,
  computeOverestimateRisk,
  type WorkoutGenerationModifiers,
} from './GoalDrivenCoaching';
import { deriveNutritionTargetsFromProfile, isNutritionBodyProfileComplete, normalizeNutritionBodyDraft } from '../utils/nutritionTargets';
import { formatHeightDisplay, formatWeightDisplay } from '../utils/bodyMetricsParse';
import { savePersistedNutritionGoals } from '../utils/nutritionGoalsStorage';
import {
  formatNutritionSuggestionSummary,
  offerNutritionGoalsUpdate,
} from './NutritionSuggestionService';

const COACHING_PROFILE_KEY = 'coachingProfile';
const ONBOARDING_COMPLETED_KEY = 'onboardingProfileCompleted';
const PENDING_FIRST_PLAN_KEY = 'pendingFirstWorkoutPlan';
const NUTRITION_BODY_PROMPT_DISMISSED_KEY = 'nutritionBodyProfilePromptDismissed';

function goalToLegacyFitnessGoal(goal: PrimaryGoal): string {
  return PRIMARY_GOAL_LABELS[goal];
}

function goalToWorkoutGeneratorGoal(goal: PrimaryGoal): string {
  switch (goal) {
    case 'fat_loss':
      return 'weight_loss';
    case 'muscle_gain':
      return 'muscle_gain';
    case 'strength_powerlifting':
      return 'strength';
    case 'calisthenics':
      return 'strength';
    case 'athletic_performance':
      return 'strength';
    case 'general_fitness':
    default:
      return 'strength';
  }
}

function equipmentToLegacy(access: CoachingProfile['equipmentProfile']['access']): string {
  switch (access) {
    case 'full_gym':
      return 'Full gym with weights and machines';
    case 'home_gym':
      return 'Home gym with dumbbells and bench';
    case 'minimal':
      return 'Minimal equipment — resistance bands and dumbbells';
    case 'bodyweight':
      return 'Bodyweight only, no equipment';
    default:
      return '';
  }
}

function activityToLegacy(level: CoachingProfile['recoveryProfile']['dailyActivityLevel']): string {
  switch (level) {
    case 'sedentary':
      return 'Sedentary desk job, mostly sitting';
    case 'light':
      return 'Light daily activity';
    case 'moderate':
      return 'Moderate daily activity on feet';
    case 'active':
      return 'Very active job or lifestyle';
    default:
      return '';
  }
}

function experienceToLegacy(level: ExperienceLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/** Flag when answers suggest the user may be overreaching ability. */
export { computeOverestimateRisk } from './GoalDrivenCoaching';

export async function loadCoachingProfile(): Promise<CoachingProfile> {
  const raw = await loadUserData<CoachingProfile>(COACHING_PROFILE_KEY);
  if (!raw || raw.version !== 1) return createEmptyCoachingProfile();
  return {
    ...createEmptyCoachingProfile(),
    ...raw,
    goalProfile: { ...createEmptyCoachingProfile().goalProfile, ...raw.goalProfile },
    scheduleProfile: { ...createEmptyCoachingProfile().scheduleProfile, ...raw.scheduleProfile },
    experienceProfile: { ...createEmptyCoachingProfile().experienceProfile, ...raw.experienceProfile },
    equipmentProfile: { ...createEmptyCoachingProfile().equipmentProfile, ...raw.equipmentProfile },
    preferenceProfile: { ...createEmptyCoachingProfile().preferenceProfile, ...raw.preferenceProfile },
    recoveryProfile: { ...createEmptyCoachingProfile().recoveryProfile, ...raw.recoveryProfile },
    constraintProfile: { ...createEmptyCoachingProfile().constraintProfile, ...raw.constraintProfile },
    adherenceProfile: { ...createEmptyCoachingProfile().adherenceProfile, ...raw.adherenceProfile },
    nutritionBodyProfile: {
      ...createEmptyCoachingProfile().nutritionBodyProfile,
      ...raw.nutritionBodyProfile,
    },
  };
}

export async function saveCoachingProfileDraft(profile: CoachingProfile, step: number): Promise<void> {
  await saveUserData(COACHING_PROFILE_KEY, { ...profile, onboardingStep: step });
}

/** Flatten coaching profile into legacy userProfile for backward-compatible reads. */
export async function syncCoachingProfileToUserProfile(profile: CoachingProfile): Promise<void> {
  const existing = (await loadUserData<Record<string, unknown>>('userProfile')) || {};
  const goal = profile.goalProfile.primaryGoal;
  const secondary: string[] = [];
  if (profile.goalProfile.secondaryGoal?.trim()) {
    secondary.push(profile.goalProfile.secondaryGoal.trim());
  }
  if (goal === 'calisthenics') secondary.push('calisthenics');
  if (goal === 'athletic_performance') secondary.push('athleticism');

  const injuries = [
    profile.constraintProfile.injuryDetails,
    profile.constraintProfile.movementsToAvoid,
  ]
    .filter(Boolean)
    .join('; ');

  await saveUserData('userProfile', {
    ...existing,
    fitnessGoal: goal ? goalToLegacyFitnessGoal(goal) : existing.fitnessGoal,
    secondaryGoals: secondary.length ? secondary : existing.secondaryGoals,
    experienceLevel: profile.experienceProfile.level
      ? experienceToLegacy(profile.experienceProfile.level)
      : existing.experienceLevel,
    daysPerWeek: profile.scheduleProfile.daysPerWeek ?? existing.daysPerWeek,
    preferredWorkoutLength:
      profile.scheduleProfile.sessionLengthMinutes ?? existing.preferredWorkoutLength,
    equipmentAvailability: profile.equipmentProfile.access
      ? equipmentToLegacy(profile.equipmentProfile.access)
      : existing.equipmentAvailability,
    activityLevel: profile.recoveryProfile.dailyActivityLevel
      ? activityToLegacy(profile.recoveryProfile.dailyActivityLevel)
      : existing.activityLevel,
    injuries: injuries || existing.injuries,
    limitations: profile.constraintProfile.movementsToAvoid || existing.limitations,
    coachingProfile: profile,
    challengeDial: profile.adherenceProfile.challengeDial,
    onboardingMotivation: profile.goalProfile.motivation,
    onboardingTimeline: profile.goalProfile.timeline,
    preferredWorkoutTime: profile.scheduleProfile.bestTimeOfDay,
    likedExercises: profile.preferenceProfile.likedExercises,
    dislikedExercises: profile.preferenceProfile.dislikedExercises,
    trainingStylePreference: profile.preferenceProfile.trainingStyle,
    sleepQuality: profile.recoveryProfile.sleepQuality,
    stressLevel: profile.recoveryProfile.stressLevel,
    age: profile.nutritionBodyProfile.ageYears
      ? String(profile.nutritionBodyProfile.ageYears)
      : existing.age,
    sex: profile.nutritionBodyProfile.sex ?? existing.sex,
    height:
      profile.nutritionBodyProfile.heightDisplay ||
      (profile.nutritionBodyProfile.heightCm
        ? formatHeightDisplay(
            profile.nutritionBodyProfile.heightCm,
            profile.nutritionBodyProfile.unitPreference
          )
        : existing.height),
    weight:
      profile.nutritionBodyProfile.weightDisplay ||
      (profile.nutritionBodyProfile.weightKg
        ? formatWeightDisplay(
            profile.nutritionBodyProfile.weightKg,
            profile.nutritionBodyProfile.unitPreference
          )
        : existing.weight),
  });
}

function buildFinalizedCoachingProfile(
  profile: CoachingProfile,
  existingCompletedAt?: string
): CoachingProfile {
  const overestimateRisk = computeOverestimateRisk(profile);
  return {
    ...profile,
    version: profile.version ?? 1,
    completedAt: existingCompletedAt ?? new Date().toISOString(),
    onboardingStep: undefined,
    preferenceProfile: {
      ...profile.preferenceProfile,
      trainingStyle: profile.preferenceProfile.trainingStyle ?? 'mix',
    },
    experienceProfile: {
      ...profile.experienceProfile,
      overestimateRisk,
    },
    adherenceProfile: {
      ...profile.adherenceProfile,
      baselineConsistency: profile.adherenceProfile.challengeDial === 'easy' ? 70 : 55,
      challengeDial: profile.adherenceProfile.challengeDial ?? 'balanced',
    },
  };
}

async function persistWeightFromProfile(profile: CoachingProfile): Promise<void> {
  if (!profile.nutritionBodyProfile.weightKg) return;
  const lbs = Math.round(profile.nutritionBodyProfile.weightKg / 0.45359237);
  const today = new Date().toISOString().slice(0, 10);
  const existing = (await loadUserData<{ date: string; weight: number }[]>('weightEntries')) ?? [];
  const withoutToday = existing.filter((e) => e.date !== today);
  await saveUserData('weightEntries', [{ date: today, weight: lbs }, ...withoutToday]);
}

/** Re-run the onboarding questionnaire after initial setup (goals, schedule, body stats, etc.). */
export async function updateCoachingProfileFromQuestionnaire(profile: CoachingProfile): Promise<void> {
  const userKey = await getUserStorageKey(COACHING_PROFILE_KEY);
  if (!userKey) {
    throw new Error('Not signed in. Close the app, sign in again, then save your changes.');
  }

  const existing = await loadCoachingProfile();
  const finalized = buildFinalizedCoachingProfile(profile, existing.completedAt);
  await saveUserData(COACHING_PROFILE_KEY, finalized);
  await syncCoachingProfileToUserProfile(finalized);

  const nutritionTargets = deriveNutritionTargetsFromProfile(finalized);
  if (nutritionTargets) {
    const summary = formatNutritionSuggestionSummary(nutritionTargets.goals);
    await offerNutritionGoalsUpdate({
      source: 'profile_update',
      reason: `Based on your updated questionnaire, your coach estimates ${summary}.`,
      suggestedGoals: nutritionTargets.goals,
      meta: nutritionTargets.meta,
    });
    await saveUserData('nutritionTargetsMeta', nutritionTargets.meta);
  }

  await persistWeightFromProfile(finalized);
  await saveUserData(ONBOARDING_COMPLETED_KEY, true);
  notifyUserDataReady();
}

export async function completeOnboarding(profile: CoachingProfile): Promise<void> {
  const userKey = await getUserStorageKey(COACHING_PROFILE_KEY);
  if (!userKey) {
    throw new Error('Not signed in. Close the app, sign in again, then finish onboarding.');
  }

  const finalized = buildFinalizedCoachingProfile(profile);
  await saveUserData(COACHING_PROFILE_KEY, finalized);
  await syncCoachingProfileToUserProfile(finalized);

  const nutritionTargets = deriveNutritionTargetsFromProfile(finalized);
  if (nutritionTargets) {
    await savePersistedNutritionGoals({
      ...nutritionTargets.goals,
      derivedFrom: 'onboarding',
    });
    await saveUserData('nutritionTargetsMeta', nutritionTargets.meta);
  }

  await persistWeightFromProfile(finalized);
  await saveUserData(ONBOARDING_COMPLETED_KEY, true);
  await saveUserData(PENDING_FIRST_PLAN_KEY, true);
}

export async function shouldShowOnboardingWizard(): Promise<boolean> {
  const completed = await loadUserData<boolean>(ONBOARDING_COMPLETED_KEY);
  if (completed === true) return false;
  const profile = await loadCoachingProfile();
  return !isCoachingProfileComplete(profile);
}

export async function isOnboardingComplete(): Promise<boolean> {
  const completed = await loadUserData<boolean>(ONBOARDING_COMPLETED_KEY);
  if (completed === true) return true;
  const profile = await loadCoachingProfile();
  return isCoachingProfileComplete(profile);
}

export async function isPendingFirstWorkoutPlan(): Promise<boolean> {
  const pending = await loadUserData<boolean>(PENDING_FIRST_PLAN_KEY);
  return pending === true;
}

export async function clearPendingFirstWorkoutPlan(): Promise<void> {
  await saveUserData(PENDING_FIRST_PLAN_KEY, false);
}

/** Legacy users who finished onboarding before nutrition body fields were required. */
export async function shouldShowNutritionBodyProfilePrompt(): Promise<boolean> {
  const dismissed = await loadUserData<boolean>(NUTRITION_BODY_PROMPT_DISMISSED_KEY);
  if (dismissed === true) return false;
  const completed = await isOnboardingComplete();
  if (!completed) return false;
  const profile = await loadCoachingProfile();
  return !isNutritionBodyProfileComplete(profile);
}

export async function dismissNutritionBodyProfilePrompt(): Promise<void> {
  await saveUserData(NUTRITION_BODY_PROMPT_DISMISSED_KEY, true);
}

export async function saveNutritionBodyProfile(body: NutritionBodyProfile): Promise<void> {
  const normalized = normalizeNutritionBodyDraft(body);
  if (!normalized) {
    throw new Error('Incomplete nutrition body profile');
  }

  const profile = await loadCoachingProfile();
  const updated: CoachingProfile = {
    ...profile,
    nutritionBodyProfile: normalized,
  };
  await saveUserData(COACHING_PROFILE_KEY, updated);
  await syncCoachingProfileToUserProfile(updated);

  const nutritionTargets = deriveNutritionTargetsFromProfile(updated);
  if (nutritionTargets) {
    const summary = formatNutritionSuggestionSummary(nutritionTargets.goals);
    await offerNutritionGoalsUpdate({
      source: 'profile_update',
      reason: `Based on your updated body stats, your coach estimates ${summary}.`,
      suggestedGoals: nutritionTargets.goals,
      meta: nutritionTargets.meta,
    });
  }

  if (normalized.weightKg) {
    const lbs = Math.round(normalized.weightKg / 0.45359237);
    const today = new Date().toISOString().slice(0, 10);
    const existing = (await loadUserData<{ date: string; weight: number }[]>('weightEntries')) ?? [];
    const withoutToday = existing.filter((e) => e.date !== today);
    await saveUserData('weightEntries', [
      { id: `profile-${today}`, date: today, weight: lbs },
      ...withoutToday,
    ]);
  }

  await saveUserData(NUTRITION_BODY_PROMPT_DISMISSED_KEY, true);
}

/** @deprecated Prefer isPendingFirstWorkoutPlan — pending clears when the user saves a plan. */
export async function consumePendingFirstWorkoutPlan(): Promise<boolean> {
  return isPendingFirstWorkoutPlan();
}

export interface WorkoutGenerationInput {
  goal: string;
  level: string;
  days: number;
  excludedExercises: string[];
  secondaryGoals: string[];
  preferredLength: number;
  challengeDial: string;
  primaryGoal: PrimaryGoal | null;
  modifiers: WorkoutGenerationModifiers;
  missingFields: string[];
}

export function buildWorkoutGenerationInput(profile: CoachingProfile): WorkoutGenerationInput {
  const missingFields: string[] = [];
  const goal = profile.goalProfile.primaryGoal;
  const level = profile.experienceProfile.level;
  const days = profile.scheduleProfile.daysPerWeek;
  const length = profile.scheduleProfile.sessionLengthMinutes;

  if (!goal) missingFields.push('primary goal');
  if (!level) missingFields.push('experience level');
  if (!days) missingFields.push('training days per week');
  if (!length) missingFields.push('session length');

  const secondaryGoals: string[] = [];
  if (profile.goalProfile.secondaryGoal?.trim()) {
    secondaryGoals.push(profile.goalProfile.secondaryGoal.trim());
  }
  if (goal === 'calisthenics') secondaryGoals.push('calisthenics');
  if (goal === 'athletic_performance') secondaryGoals.push('athleticism');

  const excludedExercises: string[] = [];
  const injuryText = [
    profile.constraintProfile.injuryDetails,
    profile.constraintProfile.movementsToAvoid,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (injuryText.includes('knee')) {
    excludedExercises.push('Squat', 'Squats', 'Lunges', 'Leg Press');
  }
  if (injuriesMentionBack(injuryText)) {
    excludedExercises.push('Deadlift', 'Deadlifts', 'Romanian Deadlift', 'Good Mornings');
  }
  if (injuryText.includes('shoulder')) {
    excludedExercises.push('Overhead Press', 'Shoulder Press', 'Lateral Raises');
  }

  if (profile.preferenceProfile.dislikedExercises?.trim()) {
    profile.preferenceProfile.dislikedExercises
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((ex) => excludedExercises.push(ex));
  }

  let generatorLevel: string = level ?? 'beginner';
  if (level === 'competitive') generatorLevel = 'advanced';

  const generatorDays = resolveEffectiveTrainingDays(profile);
  const modifiers = buildWorkoutGenerationModifiers(profile);

  return {
    goal: goal ? goalToWorkoutGeneratorGoal(goal) : 'strength',
    level: generatorLevel,
    days: generatorDays,
    excludedExercises,
    secondaryGoals,
    preferredLength: length ?? 45,
    challengeDial: profile.adherenceProfile.challengeDial ?? 'balanced',
    primaryGoal: goal,
    modifiers,
    missingFields,
  };
}

export default {
  loadCoachingProfile,
  saveCoachingProfileDraft,
  completeOnboarding,
  shouldShowOnboardingWizard,
  isOnboardingComplete,
  consumePendingFirstWorkoutPlan,
  isPendingFirstWorkoutPlan,
  clearPendingFirstWorkoutPlan,
  buildWorkoutGenerationInput,
  syncCoachingProfileToUserProfile,
  shouldShowNutritionBodyProfilePrompt,
  dismissNutritionBodyProfilePrompt,
  saveNutritionBodyProfile,
  updateCoachingProfileFromQuestionnaire,
};

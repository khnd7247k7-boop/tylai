import type { CoachingProfile } from '../types/coachingProfile';
import { ONBOARDING_TOTAL_STEPS } from '../types/coachingProfile';
import { getInitialNutritionSetupIssues } from '../types/nutritionQuestionnaire';
import { getNutritionBodyValidationIssues } from './nutritionTargets';
import { isTrainingScheduleConfigured } from './trainingSchedule';

export function getOnboardingContinueIssues(step: number, profile: CoachingProfile): string[] {
  switch (step) {
    case 0:
      return profile.goalProfile.primaryGoal ? [] : ['Select your primary goal'];
    case 1:
      return [];
    case 2:
      return profile.experienceProfile.level ? [] : ['Select your experience level'];
    case 3: {
      const issues: string[] = [];
      if (!profile.scheduleProfile.daysPerWeek) issues.push('Days per week you can train');
      if (!profile.scheduleProfile.sessionLengthMinutes) issues.push('Session length (minutes)');
      if (!profile.scheduleProfile.bestTimeOfDay) issues.push('Best time of day to train');
      if (!profile.scheduleProfile.scheduleMode) issues.push('Weekly split or flexible schedule');
      if (!isTrainingScheduleConfigured(profile.scheduleProfile)) {
        if (profile.scheduleProfile.scheduleMode === 'weekly_split') {
          issues.push(
            `Select ${profile.scheduleProfile.daysPerWeek ?? ''} training day(s) on the calendar`
          );
        }
      }
      return issues;
    }
    case 4:
      return profile.equipmentProfile.access ? [] : ['Equipment you can use'];
    case 5:
      return [];
    case 6: {
      const issues: string[] = [];
      if (!profile.recoveryProfile.sleepQuality) issues.push('Sleep quality');
      if (!profile.recoveryProfile.stressLevel) issues.push('Stress level');
      if (!profile.recoveryProfile.dailyActivityLevel) issues.push('Daily activity outside the gym');
      return issues;
    }
    case 7:
      return profile.constraintProfile.hasInjuries !== null
        ? []
        : ['Whether you have injuries or movement constraints'];
    case 8:
      return profile.adherenceProfile.challengeDial ? [] : ['How hard we should push on a realistic week'];
    case 9:
      return getNutritionBodyValidationIssues(profile.nutritionBodyProfile);
    case 10:
      return getInitialNutritionSetupIssues(profile.nutritionPreferencesProfile);
    case 11:
      return [];
    default:
      return [];
  }
}

/** All required onboarding answers before finishing setup (steps 0–10). */
export function getCoachingProfileCompletionIssues(profile: CoachingProfile): string[] {
  const issues: string[] = [];
  for (let step = 0; step < ONBOARDING_TOTAL_STEPS - 1; step += 1) {
    issues.push(...getOnboardingContinueIssues(step, profile));
  }
  return issues;
}

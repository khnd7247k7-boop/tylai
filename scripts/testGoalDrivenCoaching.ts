/**
 * Goal-driven coaching unit checks.
 * Run: npx tsx scripts/testGoalDrivenCoaching.ts
 */
import { createEmptyCoachingProfile } from '../src/types/coachingProfile';
import {
  buildWorkoutGenerationModifiers,
  resolveEffectiveTrainingDays,
  resolveProgressionLever,
  nextCalisthenicsProgression,
} from '../src/services/GoalDrivenCoaching';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = createEmptyCoachingProfile();
base.goalProfile.primaryGoal = 'fat_loss';
base.scheduleProfile.daysPerWeek = 4;
base.adherenceProfile.challengeDial = 'easy';
base.recoveryProfile.sleepQuality = 'high';
base.recoveryProfile.stressLevel = 'low';

// Easy dial must NOT force 4 days — user chose 4
assert(resolveEffectiveTrainingDays(base) === 4, '4 training days preserved for easy dial');

base.experienceProfile.level = 'beginner';
base.scheduleProfile.daysPerWeek = 6;
base.adherenceProfile.challengeDial = 'maximum';
base.experienceProfile.overestimateRisk = true;
base.recoveryProfile.sleepQuality = 'low';
base.recoveryProfile.stressLevel = 'high';
assert(
  resolveEffectiveTrainingDays(base) < 6,
  'Overreach + poor recovery may trim frequency'
);

assert(resolveProgressionLever('calisthenics') === 'exercise_difficulty');
assert(resolveProgressionLever('strength_powerlifting') === 'load');
assert(resolveProgressionLever('fat_loss') === 'nutrition');

const calMods = buildWorkoutGenerationModifiers({
  ...base,
  goalProfile: { ...base.goalProfile, primaryGoal: 'calisthenics' },
  adherenceProfile: { challengeDial: 'maximum' },
  experienceProfile: { level: 'intermediate' },
});
assert(calMods.difficultyBias >= 1, 'Calisthenics + max dial biases harder movements');

const fatMods = buildWorkoutGenerationModifiers({
  ...base,
  goalProfile: { ...base.goalProfile, primaryGoal: 'fat_loss' },
  adherenceProfile: { challengeDial: 'balanced' },
});
assert(fatMods.progressionLever === 'nutrition');

assert(
  nextCalisthenicsProgression('Push-ups') === 'Diamond Push-ups',
  'Push-up progression chain'
);

console.log('testGoalDrivenCoaching: all passed');

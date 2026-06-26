/**
 * Goal-driven coaching — intensity and progression levers per individual.
 * Challenge dial adjusts difficulty/volume/recovery bias, NOT training frequency alone.
 */

import type {
  ChallengeDial,
  CoachingProfile,
  PrimaryGoal,
  RecoveryLevel,
} from '../types/coachingProfile';

export type ProgressionLever =
  | 'load'
  | 'exercise_difficulty'
  | 'volume'
  | 'nutrition'
  | 'reps_endurance'
  | 'balanced';

export interface WorkoutGenerationModifiers {
  primaryGoal: PrimaryGoal;
  progressionLever: ProgressionLever;
  challengeDial: ChallengeDial;
  /** Scales working sets (not training days). */
  intensityMultiplier: number;
  /** Shifts exercise difficulty filter: -1 easier … +1 harder */
  difficultyBias: number;
  /** Added to base working sets (capped elsewhere at 4). */
  setBonus: number;
  repAdjust: number;
  restAdjustSec: number;
  recoveryScore: number;
  coachingNote: string;
}

export interface GoalAdaptationSummary {
  progressionLever: ProgressionLever;
  primaryFocus: string;
  workoutModifiersSummary: string;
  coachingNote: string;
}

/** Bodyweight progressions — harder variant when load progression isn't available. */
export const CALISTHENICS_PROGRESSION: Record<string, string> = {
  'knee push-ups': 'Push-ups',
  'incline push-ups': 'Push-ups',
  'wall push-ups': 'Push-ups',
  'push-ups': 'Diamond Push-ups',
  'diamond push-ups': 'Archer Push-ups',
  'archer push-ups': 'Handstand Push-ups',
  'pike push-ups': 'Handstand Push-ups',
  'assisted pull-ups': 'Pull-ups',
  'band-assisted pull-ups': 'Pull-ups',
  'pull-ups': 'Chin-ups',
  'chin-ups': 'Weighted Pull-ups',
  'bodyweight squats': 'Bulgarian Split Squats',
  'squats': 'Bulgarian Split Squats',
  'lunges': 'Walking Lunges',
  'glute bridge (bodyweight)': 'Single-Leg Glute Bridge',
  'plank': 'Side Plank',
  'assisted dips': 'Dips',
  'dips': 'Ring Dips',
};

function recoveryLevelScore(level: RecoveryLevel | null, invert = false): number {
  const raw =
    level === 'high' ? 85 : level === 'medium' ? 65 : level === 'low' ? 40 : 60;
  return invert ? 100 - raw + 40 : raw;
}

/** 0–100 from onboarding sleep/stress (not milestone badges). */
export function computeRecoveryScore(profile: CoachingProfile): number {
  const sleep = recoveryLevelScore(profile.recoveryProfile.sleepQuality);
  const stress = recoveryLevelScore(profile.recoveryProfile.stressLevel, true);
  return Math.round(Math.min(100, Math.max(0, sleep * 0.55 + stress * 0.45)));
}

export function resolveProgressionLever(goal: PrimaryGoal | null): ProgressionLever {
  switch (goal) {
    case 'calisthenics':
      return 'exercise_difficulty';
    case 'strength_powerlifting':
      return 'load';
    case 'muscle_gain':
      return 'volume';
    case 'fat_loss':
      return 'nutrition';
    case 'general_fitness':
      return 'balanced';
    case 'athletic_performance':
      return 'reps_endurance';
    default:
      return 'balanced';
  }
}

/** Flag when schedule + experience + challenge dial may be unrealistic for a beginner. */
export function computeOverestimateRisk(profile: CoachingProfile): boolean {
  const exp = profile.experienceProfile.level;
  const days = profile.scheduleProfile.daysPerWeek ?? 0;
  const dial = profile.adherenceProfile.challengeDial;
  if (exp !== 'beginner') return false;
  if (days >= 6) return true;
  if (dial === 'maximum' && days >= 5) return true;
  return false;
}

function primaryFocusLabel(goal: PrimaryGoal | null, lever: ProgressionLever): string {
  switch (goal) {
    case 'calisthenics':
      return 'Harder movement progressions (e.g. push-up → diamond → archer)';
    case 'strength_powerlifting':
      return 'Heavier loads with solid rep quality';
    case 'muscle_gain':
      return 'Progressive volume, then load when sets are capped';
    case 'fat_loss':
      return 'Nutrition consistency and a slight deficit when progress stalls';
    case 'general_fitness':
      return 'Balanced training with nutrition to stay lean and capable';
    case 'athletic_performance':
      return 'Power, speed, and sport-specific conditioning';
    default:
      if (lever === 'nutrition') return 'Nutrition and recovery before adding gym stress';
      return 'Sustainable consistency first, then smart progression';
  }
}

/**
 * Training days come from the user's schedule — not from "easy" label.
 * Only trim frequency when recovery + experience suggest overload risk.
 */
export function resolveEffectiveTrainingDays(profile: CoachingProfile): number {
  const requested = profile.scheduleProfile.daysPerWeek ?? 3;
  const recovery = computeRecoveryScore(profile);
  const overreach = computeOverestimateRisk(profile);

  if (overreach && recovery < 50 && profile.adherenceProfile.challengeDial === 'easy') {
    return Math.max(2, requested - 1);
  }
  if (overreach && recovery < 35) {
    return Math.max(2, requested - 1);
  }
  return requested;
}

export function buildWorkoutGenerationModifiers(profile: CoachingProfile): WorkoutGenerationModifiers {
  const primaryGoal = profile.goalProfile.primaryGoal ?? 'general_fitness';
  const dial = profile.adherenceProfile.challengeDial ?? 'balanced';
  const lever = resolveProgressionLever(profile.goalProfile.primaryGoal);
  const recoveryScore = computeRecoveryScore(profile);
  const level = profile.experienceProfile.level ?? 'beginner';

  let intensityMultiplier = 1;
  let difficultyBias = 0;
  let setBonus = 0;
  let repAdjust = 0;
  let restAdjustSec = 0;

  switch (dial) {
    case 'easy':
      intensityMultiplier = 0.9;
      difficultyBias = -1;
      repAdjust = 1;
      restAdjustSec = 15;
      break;
    case 'maximum':
      intensityMultiplier = 1.08;
      difficultyBias = 1;
      setBonus = level === 'beginner' ? 0 : 1;
      repAdjust = -1;
      restAdjustSec = -15;
      break;
    default:
      break;
  }

  if (recoveryScore < 45) {
    intensityMultiplier *= 0.92;
    setBonus = Math.max(0, setBonus - 1);
    restAdjustSec += 20;
  } else if (recoveryScore >= 75 && dial === 'maximum') {
    setBonus = Math.min(1, setBonus + 1);
  }

  if (profile.experienceProfile.overestimateRisk) {
    difficultyBias = Math.min(difficultyBias, 0);
    intensityMultiplier = Math.min(intensityMultiplier, 1);
  }

  if (lever === 'load') {
    repAdjust -= 1;
  } else if (lever === 'volume') {
    setBonus = Math.min(1, setBonus + 1);
  } else if (lever === 'nutrition') {
    intensityMultiplier = Math.min(intensityMultiplier, 1);
    repAdjust += 1;
  } else if (lever === 'exercise_difficulty') {
    difficultyBias = Math.max(difficultyBias, dial === 'easy' ? 0 : 1);
  }

  const coachingNote = [
    primaryFocusLabel(primaryGoal, lever),
    dial === 'easy'
      ? 'Challenge dial: gentler exercise selection and more rest — same schedule you chose.'
      : dial === 'maximum'
        ? 'Challenge dial: harder variants and tighter sets — still your chosen days/week.'
        : 'Challenge dial: balanced progression for your goal.',
    recoveryScore < 50 ? 'Recovery signals suggest holding volume steady this week.' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    primaryGoal,
    progressionLever: lever,
    challengeDial: dial,
    intensityMultiplier,
    difficultyBias,
    setBonus,
    repAdjust,
    restAdjustSec,
    recoveryScore,
    coachingNote,
  };
}

export function buildGoalAdaptationSummary(
  profile: CoachingProfile | null,
  modifiers?: WorkoutGenerationModifiers
): GoalAdaptationSummary {
  const mods = modifiers ?? (profile ? buildWorkoutGenerationModifiers(profile) : null);
  const lever = mods?.progressionLever ?? 'balanced';
  const goal = profile?.goalProfile.primaryGoal ?? null;

  return {
    progressionLever: lever,
    primaryFocus: primaryFocusLabel(goal, lever),
    workoutModifiersSummary: mods
      ? `Intensity ×${mods.intensityMultiplier.toFixed(2)}, recovery ${mods.recoveryScore}/100, dial ${mods.challengeDial}`
      : 'Complete onboarding for personalized coaching.',
    coachingNote: mods?.coachingNote ?? 'Finish onboarding so your coach can adapt to your goals.',
  };
}

/** Next harder bodyweight exercise for plan adaptation (case-insensitive name match). */
export function nextCalisthenicsProgression(exerciseName: string): string | null {
  const key = exerciseName.trim().toLowerCase();
  return CALISTHENICS_PROGRESSION[key] ?? null;
}

/** Shift allowed difficulties based on goal + dial + experience. */
export function allowedDifficulties(
  level: string,
  difficultyBias: number
): Set<'beginner' | 'intermediate' | 'advanced'> {
  const out = new Set<'beginner' | 'intermediate' | 'advanced'>();
  if (level === 'beginner') {
    out.add('beginner');
    if (difficultyBias >= 0) out.add('intermediate');
    if (difficultyBias >= 1) out.add('advanced');
  } else if (level === 'intermediate') {
    out.add('beginner');
    out.add('intermediate');
    if (difficultyBias >= 0) out.add('advanced');
  } else {
    out.add('intermediate');
    out.add('advanced');
    if (difficultyBias < 0) out.add('beginner');
  }
  return out;
}

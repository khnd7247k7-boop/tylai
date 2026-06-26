import type {
  CoachingProfile,
  DailyActivityLevel,
  NutritionBodyProfile,
  PrimaryGoal,
  SexForBmr,
} from '../types/coachingProfile';
import type { NutritionGoals } from '../types/nutritionGoals';
import { DEFAULT_NUTRITION_GOALS } from '../types/nutritionGoals';
import { parseAgeYears, parseHeightToCm, parseWeightToKg, formatHeightDisplay, formatWeightDisplay } from './bodyMetricsParse';

export interface NutritionTargetsMeta {
  bmr: number;
  tdee: number;
  calorieStrategy: 'deficit' | 'maintain' | 'surplus';
  activityMultiplier: number;
  derivedAt: string;
}

export interface DerivedNutritionTargets {
  goals: NutritionGoals;
  meta: NutritionTargetsMeta;
}

const ACTIVITY_MULTIPLIERS: Record<DailyActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

/** Mifflin–St Jeor BMR (kcal/day). */
export function calculateBmrKgCm(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: SexForBmr
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

export function activityMultiplier(level: DailyActivityLevel | null | undefined): number {
  if (!level) return ACTIVITY_MULTIPLIERS.moderate;
  return ACTIVITY_MULTIPLIERS[level];
}

export function calorieStrategyForGoal(goal: PrimaryGoal | null): NutritionTargetsMeta['calorieStrategy'] {
  switch (goal) {
    case 'fat_loss':
      return 'deficit';
    case 'muscle_gain':
      return 'surplus';
    default:
      return 'maintain';
  }
}

function calorieAdjustment(goal: PrimaryGoal | null, tdee: number): number {
  switch (goal) {
    case 'fat_loss':
      return -Math.min(500, Math.round(tdee * 0.2));
    case 'muscle_gain':
      return Math.min(350, Math.max(200, Math.round(tdee * 0.1)));
    default:
      return 0;
  }
}

function proteinGrams(goal: PrimaryGoal | null, weightKg: number): number {
  const perKg =
    goal === 'muscle_gain' ? 2.2 : goal === 'fat_loss' ? 2.0 : goal === 'strength_powerlifting' ? 2.0 : 1.8;
  return Math.max(80, Math.round(weightKg * perKg));
}

function splitMacros(calories: number, proteinG: number): Pick<NutritionGoals, 'carbs' | 'fat'> {
  const proteinCals = proteinG * 4;
  const fatCals = Math.round(calories * 0.28);
  const fat = Math.max(35, Math.round(fatCals / 9));
  const carbs = Math.max(50, Math.round((calories - proteinCals - fat * 9) / 4));
  return { carbs, fat };
}

export function resolveNutritionBodyMetrics(profile: CoachingProfile): {
  sex: SexForBmr;
  ageYears: number;
  heightCm: number;
  weightKg: number;
} | null {
  const body = profile.nutritionBodyProfile;
  if (!body) return null;

  const sex = body.sex;
  const ageYears =
    parseAgeYears(body.ageDisplay) ??
    (typeof body.ageYears === 'number' && body.ageYears >= 13 ? body.ageYears : null);
  const heightCm = parseHeightToCm(body.heightDisplay) ?? body.heightCm ?? null;
  const weightKg =
    parseWeightToKg(body.weightDisplay, body.unitPreference) ?? body.weightKg ?? null;

  if (!sex || ageYears == null || heightCm == null || weightKg == null) return null;
  if (weightKg < 35 || weightKg > 250 || heightCm < 120 || heightCm > 230) return null;

  return { sex, ageYears, heightCm, weightKg };
}

export function deriveNutritionTargetsFromProfile(profile: CoachingProfile): DerivedNutritionTargets | null {
  const metrics = resolveNutritionBodyMetrics(profile);
  if (!metrics) return null;

  const { sex, ageYears, heightCm, weightKg } = metrics;
  const bmr = calculateBmrKgCm(weightKg, heightCm, ageYears, sex);
  const multiplier = activityMultiplier(profile.recoveryProfile.dailyActivityLevel);
  const tdee = Math.round(bmr * multiplier);
  const strategy = calorieStrategyForGoal(profile.goalProfile.primaryGoal);
  const targetCalories = Math.max(
    Math.round(bmr * 1.1),
    tdee + calorieAdjustment(profile.goalProfile.primaryGoal, tdee)
  );
  const protein = proteinGrams(profile.goalProfile.primaryGoal, weightKg);
  const { carbs, fat } = splitMacros(targetCalories, protein);

  return {
    goals: {
      calories: targetCalories,
      protein,
      carbs,
      fat,
      water: 64,
      bmr,
      tdee,
      derivedFrom: 'onboarding',
    },
    meta: {
      bmr,
      tdee,
      calorieStrategy: strategy,
      activityMultiplier: multiplier,
      derivedAt: new Date().toISOString(),
    },
  };
}

export function deriveNutritionTargetsOrDefault(profile: CoachingProfile): DerivedNutritionTargets {
  return (
    deriveNutritionTargetsFromProfile(profile) ?? {
      goals: { ...DEFAULT_NUTRITION_GOALS },
      meta: {
        bmr: 0,
        tdee: DEFAULT_NUTRITION_GOALS.calories,
        calorieStrategy: 'maintain',
        activityMultiplier: 1.55,
        derivedAt: new Date().toISOString(),
      },
    }
  );
}

export function normalizeNutritionBodyDraft(body: NutritionBodyProfile): NutritionBodyProfile | null {
  const ageYears =
    parseAgeYears(body.ageDisplay) ??
    (typeof body.ageYears === 'number' && body.ageYears >= 13 ? body.ageYears : null);
  const heightCm = parseHeightToCm(body.heightDisplay) ?? body.heightCm ?? null;
  const weightKg =
    parseWeightToKg(body.weightDisplay, body.unitPreference) ?? body.weightKg ?? null;
  if (!body.sex || ageYears == null || heightCm == null || weightKg == null) return null;

  return {
    ...body,
    ageYears,
    heightCm,
    weightKg,
    ageDisplay: body.ageDisplay?.trim() || (ageYears != null ? String(ageYears) : undefined),
    heightDisplay:
      body.heightDisplay?.trim() ||
      formatHeightDisplay(heightCm, body.unitPreference ?? 'imperial'),
    weightDisplay:
      body.weightDisplay?.trim() ||
      formatWeightDisplay(weightKg, body.unitPreference ?? 'imperial'),
  };
}

export function isNutritionBodyProfileComplete(profile: CoachingProfile): boolean {
  return normalizeNutritionBodyDraft(profile.nutritionBodyProfile) !== null;
}

export function getNutritionBodyValidationIssues(body: NutritionBodyProfile): string[] {
  const issues: string[] = [];
  if (!body.sex) issues.push('Select biological sex');
  const ageYears =
    parseAgeYears(body.ageDisplay) ??
    (typeof body.ageYears === 'number' && body.ageYears >= 13 ? body.ageYears : null);
  if (ageYears == null) issues.push('Enter age (13–100)');
  const heightCm = parseHeightToCm(body.heightDisplay) ?? body.heightCm ?? null;
  if (heightCm == null) {
    issues.push(
      body.unitPreference === 'metric'
        ? 'Enter height (e.g. 175 cm)'
        : 'Enter height (e.g. 5\'10", 5 ft 10 in, or 510)'
    );
  }
  const weightKg =
    parseWeightToKg(body.weightDisplay, body.unitPreference) ?? body.weightKg ?? null;
  if (weightKg == null) {
    issues.push(
      body.unitPreference === 'metric'
        ? 'Enter weight (e.g. 78 kg)'
        : 'Enter weight (e.g. 172 lbs)'
    );
  }
  return issues;
}

/** Nutrition setup questionnaires — initial (30–60s) and advanced meal-plan flow. */

export type FoodAllergy =
  | 'none'
  | 'peanuts'
  | 'tree_nuts'
  | 'dairy'
  | 'eggs'
  | 'soy'
  | 'wheat'
  | 'fish'
  | 'shellfish'
  | 'sesame'
  | 'other';

export type FoodIntolerance =
  | 'none'
  | 'lactose'
  | 'gluten'
  | 'caffeine'
  | 'alcohol'
  | 'other';

export type NutritionPrimaryGoal =
  | 'lose_fat'
  | 'build_muscle'
  | 'maintain_weight'
  | 'improve_health'
  | 'athletic_performance'
  | 'increase_energy';

export type EatingStyle =
  | 'no_restrictions'
  | 'vegetarian'
  | 'vegan'
  | 'keto'
  | 'paleo'
  | 'mediterranean'
  | 'low_carb'
  | 'flexible_dieting'
  | 'other';

export type NutritionHelpMode =
  | 'meal_plans'
  | 'meal_suggestions'
  | 'track_macros'
  | 'answer_questions'
  | 'everything';

export type ProactiveCoachingLevel = 'yes' | 'occasionally' | 'only_if_ask';

export type JobActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type SnackFrequency = 'none' | 'once' | 'twice' | 'three_plus';

export type CookingSkill = 'beginner' | 'intermediate' | 'advanced';

export type CookingTimeAvailable = 'under_15' | '15_30' | '30_60' | 'over_60';

export type GroceryBudget = 'budget' | 'moderate' | 'premium';

export type AlcoholConsumption = 'none' | 'occasional' | 'moderate' | 'frequent';

export type CaffeineIntake = 'none' | 'low' | 'moderate' | 'high';

export type SupplementType =
  | 'protein_powder'
  | 'creatine'
  | 'fish_oil'
  | 'multivitamin'
  | 'vitamin_d'
  | 'magnesium'
  | 'electrolytes'
  | 'other';

export type MedicalCondition =
  | 'blood_pressure'
  | 'diabetes'
  | 'pcos'
  | 'ibs'
  | 'other';

export type NutritionChallenge =
  | 'lack_of_time'
  | 'cost'
  | 'cravings'
  | 'emotional_eating'
  | 'portion_control'
  | 'family_meals'
  | 'traveling'
  | 'busy_schedule'
  | 'eating_out'
  | 'nighttime_snacking'
  | 'dont_know_what_to_cook';

export type TrackingAccuracy = 'exact_macros' | 'fairly_accurate' | 'simple_portions' | 'intuitive' | 'ai_decide';

export const FOOD_ALLERGY_LABELS: Record<FoodAllergy, string> = {
  none: 'None',
  peanuts: 'Peanuts',
  tree_nuts: 'Tree Nuts',
  dairy: 'Dairy',
  eggs: 'Eggs',
  soy: 'Soy',
  wheat: 'Wheat',
  fish: 'Fish',
  shellfish: 'Shellfish',
  sesame: 'Sesame',
  other: 'Other',
};

export const FOOD_INTOLERANCE_LABELS: Record<FoodIntolerance, string> = {
  none: 'None',
  lactose: 'Lactose',
  gluten: 'Gluten',
  caffeine: 'Caffeine',
  alcohol: 'Alcohol',
  other: 'Other',
};

export const NUTRITION_PRIMARY_GOAL_LABELS: Record<NutritionPrimaryGoal, string> = {
  lose_fat: 'Lose Fat',
  build_muscle: 'Build Muscle',
  maintain_weight: 'Maintain Weight',
  improve_health: 'Improve Overall Health',
  athletic_performance: 'Increase Athletic Performance',
  increase_energy: 'Increase Energy',
};

export const EATING_STYLE_LABELS: Record<EatingStyle, string> = {
  no_restrictions: 'No Restrictions',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  keto: 'Keto',
  paleo: 'Paleo',
  mediterranean: 'Mediterranean',
  low_carb: 'Low Carb',
  flexible_dieting: 'Flexible Dieting',
  other: 'Other',
};

export const NUTRITION_HELP_MODE_LABELS: Record<NutritionHelpMode, string> = {
  meal_plans: 'Build complete meal plans',
  meal_suggestions: 'Give meal suggestions',
  track_macros: 'Help track macros',
  answer_questions: 'Answer nutrition questions',
  everything: 'A little bit of everything',
};

export const PROACTIVE_COACHING_LABELS: Record<ProactiveCoachingLevel, string> = {
  yes: 'Yes, coach me.',
  occasionally: 'Occasionally.',
  only_if_ask: 'Only if I ask.',
};

export const JOB_ACTIVITY_LABELS: Record<JobActivityLevel, string> = {
  sedentary: 'Mostly sitting / desk job',
  light: 'Light activity on feet',
  moderate: 'Moderate physical work',
  active: 'Very active job',
  very_active: 'Labor-intensive / on feet all day',
};

export const SNACK_FREQUENCY_LABELS: Record<SnackFrequency, string> = {
  none: 'No snacks',
  once: '1 snack per day',
  twice: '2 snacks per day',
  three_plus: '3+ snacks per day',
};

export const COOKING_SKILL_LABELS: Record<CookingSkill, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const COOKING_TIME_LABELS: Record<CookingTimeAvailable, string> = {
  under_15: 'Under 15 minutes',
  '15_30': '15–30 minutes',
  '30_60': '30–60 minutes',
  over_60: 'Over 60 minutes',
};

export const GROCERY_BUDGET_LABELS: Record<GroceryBudget, string> = {
  budget: 'Budget-conscious',
  moderate: 'Moderate',
  premium: 'Premium / no strict limit',
};

export const ALCOHOL_LABELS: Record<AlcoholConsumption, string> = {
  none: 'None',
  occasional: 'Occasional',
  moderate: 'Moderate',
  frequent: 'Frequent',
};

export const CAFFEINE_LABELS: Record<CaffeineIntake, string> = {
  none: 'None',
  low: 'Low (1 cup/day)',
  moderate: 'Moderate (2–3 cups/day)',
  high: 'High (4+ cups/day)',
};

export const SUPPLEMENT_LABELS: Record<SupplementType, string> = {
  protein_powder: 'Protein Powder',
  creatine: 'Creatine',
  fish_oil: 'Fish Oil',
  multivitamin: 'Multivitamin',
  vitamin_d: 'Vitamin D',
  magnesium: 'Magnesium',
  electrolytes: 'Electrolytes',
  other: 'Other',
};

export const MEDICAL_CONDITION_LABELS: Record<MedicalCondition, string> = {
  blood_pressure: 'Blood Pressure',
  diabetes: 'Diabetes',
  pcos: 'PCOS',
  ibs: 'IBS',
  other: 'Other',
};

export const NUTRITION_CHALLENGE_LABELS: Record<NutritionChallenge, string> = {
  lack_of_time: 'Lack of Time',
  cost: 'Cost',
  cravings: 'Cravings',
  emotional_eating: 'Emotional Eating',
  portion_control: 'Portion Control',
  family_meals: 'Family Meals',
  traveling: 'Traveling',
  busy_schedule: 'Busy Schedule',
  eating_out: 'Eating Out',
  nighttime_snacking: 'Nighttime Snacking',
  dont_know_what_to_cook: "Don't Know What to Cook",
};

export const TRACKING_ACCURACY_LABELS: Record<TrackingAccuracy, string> = {
  exact_macros: 'Exact Macros',
  fairly_accurate: 'Fairly Accurate',
  simple_portions: 'Simple Portions',
  intuitive: 'Intuitive Eating',
  ai_decide: 'Let the AI Decide',
};

export interface AdvancedNutritionProfile {
  goalWeightDisplay?: string;
  targetDate?: string;
  estimatedBodyFat?: string;
  jobActivityLevel: JobActivityLevel | null;
  weeklyExerciseFrequency?: string;
  dailyStepCount?: string;
  cardioFrequency?: string;
  favoriteFoods?: string;
  foodsToAvoid?: string;
  mealsPerDay: number | null;
  snackFrequency: SnackFrequency | null;
  mealTiming?: string;
  cookingSkill: CookingSkill | null;
  cookingTimeAvailable: CookingTimeAvailable | null;
  groceryBudget: GroceryBudget | null;
  groceryStores?: string;
  wakeTime?: string;
  bedTime?: string;
  waterIntake?: string;
  alcoholConsumption: AlcoholConsumption | null;
  caffeineIntake: CaffeineIntake | null;
  supplements: SupplementType[];
  supplementsOther?: string;
  medicalConditions: MedicalCondition[];
  medicalConditionsOther?: string;
  currentMedications?: string;
  digestiveIssues?: string;
  biggestChallenges: NutritionChallenge[];
  trackingAccuracy: TrackingAccuracy | null;
  additionalCoachingNotes?: string;
  completedAt?: string;
}

export interface NutritionPreferencesProfile {
  allergies: FoodAllergy[];
  allergyOther?: string;
  intolerances: FoodIntolerance[];
  intoleranceOther?: string;
  primaryGoal: NutritionPrimaryGoal | null;
  eatingStyle: EatingStyle | null;
  eatingStyleOther?: string;
  helpMode: NutritionHelpMode | null;
  avoidRecommendations?: string;
  proactiveCoaching: ProactiveCoachingLevel | null;
  advancedProfile?: AdvancedNutritionProfile;
}

/** @deprecated Legacy fields — migrated on load */
export interface LegacyNutritionPreferencesFields {
  hasFoodAllergies?: boolean | null;
  foodAllergies?: string;
  hasFoodIntolerances?: boolean | null;
  foodIntolerances?: string;
  wantsMealPlan?: boolean | null;
  guidanceOptions?: string[];
}

export function createEmptyAdvancedNutritionProfile(): AdvancedNutritionProfile {
  return {
    jobActivityLevel: null,
    mealsPerDay: null,
    snackFrequency: null,
    cookingSkill: null,
    cookingTimeAvailable: null,
    groceryBudget: null,
    alcoholConsumption: null,
    caffeineIntake: null,
    supplements: [],
    medicalConditions: [],
    biggestChallenges: [],
    trackingAccuracy: null,
  };
}

export function createEmptyNutritionPreferencesProfile(): NutritionPreferencesProfile {
  return {
    allergies: [],
    intolerances: [],
    primaryGoal: null,
    eatingStyle: null,
    helpMode: null,
    proactiveCoaching: null,
  };
}

export function migrateNutritionPreferencesProfile(
  raw: Partial<NutritionPreferencesProfile & LegacyNutritionPreferencesFields> | undefined
): NutritionPreferencesProfile {
  const empty = createEmptyNutritionPreferencesProfile();
  if (!raw) return empty;

  if (raw.primaryGoal || raw.allergies?.length || raw.helpMode) {
    return {
      ...empty,
      ...raw,
      allergies: raw.allergies ?? [],
      intolerances: raw.intolerances ?? [],
      advancedProfile: raw.advancedProfile
        ? { ...createEmptyAdvancedNutritionProfile(), ...raw.advancedProfile }
        : undefined,
    };
  }

  const allergies: FoodAllergy[] = [];
  if (raw.hasFoodAllergies === false) allergies.push('none');
  else if (raw.hasFoodAllergies === true) allergies.push('other');

  const intolerances: FoodIntolerance[] = [];
  if (raw.hasFoodIntolerances === false) intolerances.push('none');
  else if (raw.hasFoodIntolerances === true) intolerances.push('other');

  let helpMode: NutritionHelpMode | null = null;
  if (raw.wantsMealPlan === true) helpMode = 'meal_plans';
  else if (raw.wantsMealPlan === false && raw.guidanceOptions?.length) helpMode = 'everything';

  return {
    ...empty,
    allergies,
    allergyOther: raw.foodAllergies,
    intolerances,
    intoleranceOther: raw.foodIntolerances,
    helpMode,
  };
}

export function toggleMultiSelectWithNone<T extends string>(
  current: T[],
  option: T,
  noneValue: T
): T[] {
  if (option === noneValue) return [noneValue];
  const withoutNone = current.filter((v) => v !== noneValue);
  if (withoutNone.includes(option)) {
    const next = withoutNone.filter((v) => v !== option);
    return next.length === 0 ? [noneValue] : next;
  }
  return [...withoutNone, option];
}

export function toggleMultiSelectMax<T extends string>(current: T[], option: T, max: number): T[] {
  if (current.includes(option)) return current.filter((v) => v !== option);
  if (current.length >= max) return current;
  return [...current, option];
}

export function isInitialNutritionSetupComplete(prefs: NutritionPreferencesProfile): boolean {
  return getInitialNutritionSetupIssues(prefs).length === 0;
}

export function getInitialNutritionSetupIssues(prefs: NutritionPreferencesProfile): string[] {
  const issues: string[] = [];
  if (prefs.allergies.length === 0) issues.push('Food allergies (choose None if you have none)');
  if (prefs.intolerances.length === 0) issues.push('Food intolerances (choose None if you have none)');
  if (!prefs.primaryGoal) issues.push('Nutrition goal');
  if (!prefs.eatingStyle) issues.push('Eating style');
  if (!prefs.helpMode) issues.push('How you want nutrition help');
  if (!prefs.proactiveCoaching) issues.push('Proactive coaching preference');
  return issues;
}

export function shouldLaunchAdvancedNutritionQuestionnaire(prefs: NutritionPreferencesProfile): boolean {
  return prefs.helpMode === 'meal_plans';
}

export function isAdvancedNutritionSetupComplete(advanced: AdvancedNutritionProfile): boolean {
  return getAdvancedNutritionSetupIssues(advanced).length === 0;
}

export function getAdvancedNutritionSetupIssues(advanced: AdvancedNutritionProfile): string[] {
  const issues: string[] = [];
  if (!advanced.jobActivityLevel) issues.push('Job activity level');
  if (advanced.mealsPerDay == null) issues.push('Meals per day');
  if (!advanced.snackFrequency) issues.push('Snack frequency');
  if (!advanced.cookingSkill) issues.push('Cooking skill');
  if (!advanced.cookingTimeAvailable) issues.push('Cooking time available');
  if (!advanced.groceryBudget) issues.push('Grocery budget');
  if (!advanced.alcoholConsumption) issues.push('Alcohol consumption');
  if (!advanced.caffeineIntake) issues.push('Caffeine intake');
  if (!advanced.trackingAccuracy) issues.push('Tracking accuracy preference');
  return issues;
}

export function formatNutritionPreferencesSummary(prefs: NutritionPreferencesProfile): string[] {
  const lines: string[] = [];
  if (prefs.allergies.length) {
    const allergyText = prefs.allergies
      .filter((a) => a !== 'none')
      .map((a) => (a === 'other' ? prefs.allergyOther || 'Other' : FOOD_ALLERGY_LABELS[a]))
      .join(', ');
    lines.push(`Allergies: ${prefs.allergies.includes('none') ? 'None' : allergyText || 'Yes'}`);
  }
  if (prefs.intolerances.length) {
    const intoleranceText = prefs.intolerances
      .filter((i) => i !== 'none')
      .map((i) => (i === 'other' ? prefs.intoleranceOther || 'Other' : FOOD_INTOLERANCE_LABELS[i]))
      .join(', ');
    lines.push(`Intolerances: ${prefs.intolerances.includes('none') ? 'None' : intoleranceText || 'Yes'}`);
  }
  if (prefs.primaryGoal) lines.push(`Nutrition goal: ${NUTRITION_PRIMARY_GOAL_LABELS[prefs.primaryGoal]}`);
  if (prefs.eatingStyle) {
    lines.push(
      `Eating style: ${
        prefs.eatingStyle === 'other'
          ? prefs.eatingStyleOther || 'Other'
          : EATING_STYLE_LABELS[prefs.eatingStyle]
      }`
    );
  }
  if (prefs.helpMode) lines.push(`Help mode: ${NUTRITION_HELP_MODE_LABELS[prefs.helpMode]}`);
  if (prefs.proactiveCoaching) {
    lines.push(`Proactive coaching: ${PROACTIVE_COACHING_LABELS[prefs.proactiveCoaching]}`);
  }
  return lines;
}

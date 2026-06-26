import { loadUserData, saveUserData } from './userStorage';
import {
  DEFAULT_NUTRITION_GOALS,
  normalizeNutritionGoals,
  type NutritionGoals,
} from '../types/nutritionGoals';

/** Load macro goals for the signed-in user (primary key, then profile backup). */
export async function loadPersistedNutritionGoals(): Promise<NutritionGoals | null> {
  const direct = normalizeNutritionGoals(await loadUserData('nutritionGoals'));
  if (direct) return direct;

  const profile = await loadUserData<{ nutritionGoals?: unknown }>('userProfile');
  const fromProfile = normalizeNutritionGoals(profile?.nutritionGoals);
  if (fromProfile) {
    // Repair primary key if profile still has goals after a crash or UID migration.
    await saveUserData('nutritionGoals', fromProfile);
    return fromProfile;
  }

  return null;
}

/** Save macro goals to dedicated storage and embed in userProfile for redundancy. */
export async function savePersistedNutritionGoals(goals: NutritionGoals): Promise<void> {
  const normalized = normalizeNutritionGoals(goals) ?? DEFAULT_NUTRITION_GOALS;
  await saveUserData('nutritionGoals', normalized);
  const profile = (await loadUserData<Record<string, unknown>>('userProfile')) ?? {};
  await saveUserData('userProfile', { ...profile, nutritionGoals: normalized });
}

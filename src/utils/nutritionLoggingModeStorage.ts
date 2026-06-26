import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NutritionLoggingMode } from '../types/nutritionLogging';

const STORAGE_KEY = 'nutritionLoggingMode.v1';

export async function loadNutritionLoggingMode(): Promise<NutritionLoggingMode> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw === 'ai' ? 'ai' : 'precision';
  } catch {
    return 'precision';
  }
}

export async function saveNutritionLoggingMode(mode: NutritionLoggingMode): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Non-blocking — default precision on next launch.
  }
}

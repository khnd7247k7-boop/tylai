import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../firebaseConfig';

const AUTH_WAIT_MS = 8000;

/**
 * Get the current user's ID for storage key prefixing
 * Returns null if no user is logged in
 */
export const getCurrentUserId = (): string | null => {
  const user = auth.currentUser;
  return user?.uid || null;
};

async function waitForCurrentUserId(timeoutMs = AUTH_WAIT_MS): Promise<string | null> {
  const immediate = getCurrentUserId();
  if (immediate) return immediate;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const uid = getCurrentUserId();
    if (uid) return uid;
  }
  return null;
}

/**
 * Generate a user-specific storage key
 * @param baseKey The base storage key (e.g., 'meals', 'workoutHistory')
 * @returns A key prefixed with the user ID, or null if no user after a short wait
 */
export const getUserStorageKey = async (baseKey: string): Promise<string | null> => {
  const userId = await waitForCurrentUserId();
  if (!userId) return null;
  return `user_${userId}_${baseKey}`;
};

/** Sync variant when auth is guaranteed (e.g. inside onAuthStateChanged). */
export const getUserStorageKeySync = (baseKey: string): string | null => {
  const userId = getCurrentUserId();
  if (!userId) return null;
  return `user_${userId}_${baseKey}`;
};

/**
 * Save data with user-specific key
 */
export const saveUserData = async <T>(baseKey: string, data: T): Promise<void> => {
  const key = await getUserStorageKey(baseKey);
  if (!key) {
    console.warn(`[userStorage] Could not save "${baseKey}" — no authenticated user`);
    return;
  }
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
    // Cross-device sync for selected keys (saved workouts, etc.)
    try {
      const { isCloudSyncedKey, pushUserDataToCloud } = await import('../services/userCloudSync');
      if (isCloudSyncedKey(baseKey)) {
        void pushUserDataToCloud(baseKey, data);
      }
    } catch (syncError) {
      console.warn(`[userStorage] cloud sync skipped for ${baseKey}`, syncError);
    }
  } catch (error) {
    console.error(`Error saving user data for key ${baseKey}:`, error);
    throw error;
  }
};

/**
 * Load data with user-specific key
 */
export const loadUserData = async <T>(baseKey: string): Promise<T | null> => {
  const key = await getUserStorageKey(baseKey);
  if (!key) return null;
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error loading user data for key ${baseKey}:`, error);
    return null;
  }
};

/**
 * Remove data for current user
 */
export const removeUserData = async (baseKey: string): Promise<void> => {
  const key = await getUserStorageKey(baseKey);
  if (!key) return;
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing user data for key ${baseKey}:`, error);
  }
};

/**
 * Clear all data for current user
 * Call this on logout
 */
export const clearAllUserData = async (): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) return;

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const userKeys = allKeys.filter(key => key.startsWith(`user_${userId}_`));
    if (userKeys.length > 0) {
      await AsyncStorage.multiRemove(userKeys);
    }
  } catch (error) {
    console.error('Error clearing user data:', error);
  }
};

/**
 * Get all stored keys for debugging
 * This helps check what data exists
 */
export const getAllStoredKeys = async (): Promise<string[]> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return [...keys];
  } catch (error) {
    console.error('Error getting all keys:', error);
    return [];
  }
};

/** Base keys used with user_{uid}_{baseKey} — keep in sync with app data categories. */
const USER_DATA_BASE_KEYS = [
  'workoutHistory',
  'meals',
  'savedMeals',
  'nutritionGoals',
  'savedWorkoutPlans',
  'activeWorkoutPlans',
  'moodEntries',
  'emotionalExercises',
  'breathingExercises',
  'visualizationExercises',
  'mindfulnessExercises',
  'dailyMentalProgress',
  'gratitudeEntries',
  'affirmationEntries',
  'reflectionEntries',
  'dashboardTasks',
  'dailyCheckIn',
  'userProfile',
  'appSettings',
  'aiInsights',
  'aiRecommendations',
  'lastAISync',
  'healthPermissionsRequested',
  'userMilestones',
  'smallWinsNotificationMeta',
  'onboardingMedicalDisclaimerAccepted',
  'onboardingGuideCompleted',
  'onboardingGuideDismissed',
  'onboardingProfileCompleted',
  'coachingProfile',
  'pendingFirstWorkoutPlan',
  'planAdaptationState',
  'nutritionAdaptationState',
  'interfaceSettings',
  'userPreferences',
  'customExerciseLibrary_v1',
  'progressPhotoSessions',
  'progressPhotoSettings',
  'weightEntries',
] as const;

function parseUserStorageKey(key: string): { userId: string; baseKey: string } | null {
  if (!key.startsWith('user_')) return null;
  for (const baseKey of USER_DATA_BASE_KEYS) {
    const suffix = `_${baseKey}`;
    if (key.endsWith(suffix) && key.length > 5 + suffix.length) {
      return { userId: key.slice(5, -suffix.length), baseKey };
    }
  }
  return null;
}

/** Firebase UIDs that still have saved data on this device. */
export async function getUserIdsWithStoredData(): Promise<string[]> {
  const keys = await getAllStoredKeys();
  const uids = new Set<string>();
  for (const k of keys) {
    const parsed = parseUserStorageKey(k);
    if (parsed) uids.add(parsed.userId);
  }
  return [...uids];
}

/** Copy all user_* keys from one Firebase UID to another (does not delete source). */
export async function migrateUserDataBetweenUids(fromUid: string, toUid: string): Promise<number> {
  if (!fromUid || !toUid || fromUid === toUid) return 0;
  const keys = await getAllStoredKeys();
  let copied = 0;
  for (const k of keys) {
    const parsed = parseUserStorageKey(k);
    if (!parsed || parsed.userId !== fromUid) continue;
    const destKey = `user_${toUid}_${parsed.baseKey}`;
    const existing = await AsyncStorage.getItem(destKey);
    if (existing != null) continue;
    const data = await AsyncStorage.getItem(k);
    if (data != null) {
      await AsyncStorage.setItem(destKey, data);
      copied += 1;
    }
  }
  return copied;
}

/** Early builds saved some keys without a user_ prefix. */
export async function migrateLegacyUnprefixedKeysToCurrentUser(): Promise<number> {
  const userId = getCurrentUserId();
  if (!userId) return 0;
  let copied = 0;
  for (const baseKey of USER_DATA_BASE_KEYS) {
    const legacy = await AsyncStorage.getItem(baseKey);
    if (legacy == null) continue;
    const destKey = `user_${userId}_${baseKey}`;
    const existing = await AsyncStorage.getItem(destKey);
    if (existing != null) continue;
    await AsyncStorage.setItem(destKey, legacy);
    copied += 1;
  }
  return copied;
}

/**
 * If exactly one other UID has data on this device, copy any missing keys to the signed-in user.
 * Also runs when the current user already has some categories (fills gaps like savedMeals).
 */
export async function tryRecoverOrphanedUserDataOnDevice(): Promise<{
  recovered: boolean;
  keysCopied: number;
  fromUid?: string;
}> {
  const currentUid = getCurrentUserId();
  if (!currentUid) return { recovered: false, keysCopied: 0 };

  let keysCopied = await migrateLegacyUnprefixedKeysToCurrentUser();

  const uids = await getUserIdsWithStoredData();
  const others = uids.filter((id) => id !== currentUid);
  if (others.length !== 1) {
    if (others.length > 1) {
      console.warn(
        '[userStorage] Multiple local data sets for different accounts; cannot auto-merge:',
        others.map((id) => id.slice(0, 8) + '…')
      );
    }
    return { recovered: keysCopied > 0, keysCopied };
  }

  const fromUid = others[0];
  keysCopied += await migrateUserDataBetweenUids(fromUid, currentUid);
  return { recovered: keysCopied > 0, keysCopied, fromUid };
}

/**
 * Check if user profile exists and get email (if stored)
 * Note: Passwords are NEVER stored for security reasons
 */
export const getStoredUserEmail = async (): Promise<string | null> => {
  try {
    // Try to get email from userProfile (if user was logged in before)
    // This only works if user saved their profile in Settings
    const profile = await loadUserData<any>('userProfile');
    return profile?.email || null;
  } catch (error) {
    console.error('Error getting stored email:', error);
    return null;
  }
};

/**
 * Get all stored credentials and user data summary
 * Returns what data is stored (passwords are NEVER stored)
 */
export const getStoredCredentialsSummary = async (): Promise<{
  email: string | null;
  name: string | null;
  hasProfile: boolean;
  profileData: any;
  allStoredKeys: string[];
}> => {
  try {
    const profile = await loadUserData<any>('userProfile');
    const allKeys = await getAllStoredKeys();
    
    return {
      email: profile?.email || null,
      name: profile?.name || null,
      hasProfile: !!profile,
      profileData: profile || null,
      allStoredKeys: allKeys,
    };
  } catch (error) {
    console.error('Error getting stored credentials summary:', error);
    return {
      email: null,
      name: null,
      hasProfile: false,
      profileData: null,
      allStoredKeys: [],
    };
  }
};

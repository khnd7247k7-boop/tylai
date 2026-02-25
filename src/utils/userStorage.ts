import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../firebaseConfig';

/**
 * Get the current user's ID for storage key prefixing
 * Returns null if no user is logged in
 */
export const getCurrentUserId = (): string | null => {
  const user = auth.currentUser;
  return user?.uid || null;
};

/**
 * Generate a user-specific storage key
 * @param baseKey The base storage key (e.g., 'meals', 'workoutHistory')
 * @returns A key prefixed with the user ID, or just the base key if no user
 */
export const getUserStorageKey = (baseKey: string): string => {
  const userId = getCurrentUserId();
  if (!userId) {
    // Fallback for non-authenticated users (shouldn't happen in production)
    console.warn(`No user ID found for key: ${baseKey}`);
    return baseKey;
  }
  return `user_${userId}_${baseKey}`;
};

/**
 * Save data with user-specific key
 */
export const saveUserData = async <T>(baseKey: string, data: T): Promise<void> => {
  const key = getUserStorageKey(baseKey);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving user data for key ${baseKey}:`, error);
    throw error;
  }
};

/**
 * Load data with user-specific key
 */
export const loadUserData = async <T>(baseKey: string): Promise<T | null> => {
  const key = getUserStorageKey(baseKey);
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
  const key = getUserStorageKey(baseKey);
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
    return await AsyncStorage.getAllKeys();
  } catch (error) {
    console.error('Error getting all keys:', error);
    return [];
  }
};

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

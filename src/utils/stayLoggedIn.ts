import AsyncStorage from '@react-native-async-storage/async-storage';

/** User preference: keep Firebase session across app restarts (stored device-wide). */
export const STAY_LOGGED_IN_STORAGE_KEY = 'stayLoggedInPreference';

/** Default true so existing users keep current behavior after this feature ships. */
export async function getStayLoggedInPreference(): Promise<boolean> {
  const v = await AsyncStorage.getItem(STAY_LOGGED_IN_STORAGE_KEY);
  if (v === null) return true;
  return v === 'true';
}

export async function setStayLoggedInPreference(value: boolean): Promise<void> {
  await AsyncStorage.setItem(STAY_LOGGED_IN_STORAGE_KEY, value ? 'true' : 'false');
}

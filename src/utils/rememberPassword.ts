import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REMEMBER_PASSWORD_PREF_KEY = 'rememberPasswordForLogin';
const SAVED_LOGIN_CREDENTIALS_KEY = 'tylai_saved_login_credentials';

export type SavedLoginCredentials = {
  email: string;
  password: string;
};

async function canUseSecureStore(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getRememberPasswordPreference(): Promise<boolean> {
  const v = await AsyncStorage.getItem(REMEMBER_PASSWORD_PREF_KEY);
  return v === 'true';
}

export async function setRememberPasswordPreference(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(REMEMBER_PASSWORD_PREF_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    await clearSavedLoginCredentials();
  }
}

export async function saveLoginCredentials(
  email: string,
  password: string
): Promise<void> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) return;

  const payload = JSON.stringify({ email: trimmedEmail, password });
  if (await canUseSecureStore()) {
    await SecureStore.setItemAsync(SAVED_LOGIN_CREDENTIALS_KEY, payload, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } else {
    // Web / unavailable: do not persist passwords in plain AsyncStorage
    console.warn('[rememberPassword] Secure storage unavailable; password not saved');
  }
  await setRememberPasswordPreference(true);
}

export async function loadSavedLoginCredentials(): Promise<SavedLoginCredentials | null> {
  const enabled = await getRememberPasswordPreference();
  if (!enabled) return null;

  try {
    let raw: string | null = null;
    if (await canUseSecureStore()) {
      raw = await SecureStore.getItemAsync(SAVED_LOGIN_CREDENTIALS_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedLoginCredentials;
    if (!parsed?.email || typeof parsed.password !== 'string') return null;
    return { email: parsed.email, password: parsed.password };
  } catch (e) {
    console.warn('[rememberPassword] Could not load saved credentials', e);
    return null;
  }
}

export async function clearSavedLoginCredentials(): Promise<void> {
  try {
    if (await canUseSecureStore()) {
      await SecureStore.deleteItemAsync(SAVED_LOGIN_CREDENTIALS_KEY);
    }
  } catch {
    /* best-effort */
  }
}

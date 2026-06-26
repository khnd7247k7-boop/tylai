import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadUserData, saveUserData } from './src/utils/userStorage';
import { subscribeUserDataReady } from './src/utils/userDataEvents';

export type UserPreferences = {
  showPredictiveWeight: boolean;
  enableMacroPreview: boolean;
  autoRestTimer: boolean;
};

type UserSettingsContextValue = UserPreferences & {
  setPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  togglePreference: (key: keyof UserPreferences) => void;
  isReady: boolean;
};

const LEGACY_STORAGE_KEY = 'userPreferences.v1';
const USER_DATA_KEY = 'userPreferences';

const DEFAULT_PREFERENCES: UserPreferences = {
  showPredictiveWeight: true,
  enableMacroPreview: true,
  autoRestTimer: true,
};

const UserSettingsContext = createContext<UserSettingsContextValue | null>(null);

function normalizePreferences(raw: Partial<UserPreferences> | null | undefined): UserPreferences {
  return {
    showPredictiveWeight: raw?.showPredictiveWeight ?? DEFAULT_PREFERENCES.showPredictiveWeight,
    enableMacroPreview: raw?.enableMacroPreview ?? DEFAULT_PREFERENCES.enableMacroPreview,
    autoRestTimer: raw?.autoRestTimer ?? DEFAULT_PREFERENCES.autoRestTimer,
  };
}

async function loadPreferencesForCurrentUser(): Promise<UserPreferences> {
  const scoped = await loadUserData<Partial<UserPreferences>>(USER_DATA_KEY);
  if (scoped) return normalizePreferences(scoped);

  try {
    const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const parsed = normalizePreferences(JSON.parse(legacyRaw) as Partial<UserPreferences>);
      await saveUserData(USER_DATA_KEY, parsed);
      return parsed;
    }
  } catch {
    /* ignore legacy read errors */
  }

  return DEFAULT_PREFERENCES;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isReady, setIsReady] = useState(false);

  const reloadPreferences = useCallback(async () => {
    try {
      const next = await loadPreferencesForCurrentUser();
      setPreferences(next);
    } catch {
      setPreferences(DEFAULT_PREFERENCES);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    void reloadPreferences();
    return subscribeUserDataReady(() => {
      void reloadPreferences();
    });
  }, [reloadPreferences]);

  const persist = useCallback(async (next: UserPreferences) => {
    setPreferences(next);
    try {
      await saveUserData(USER_DATA_KEY, next);
    } catch {
      // Persistence should not block local UI state updates.
    }
  }, []);

  const setPreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      const next = { ...preferences, [key]: value };
      void persist(next);
    },
    [persist, preferences]
  );

  const togglePreference = useCallback(
    (key: keyof UserPreferences) => {
      const next = { ...preferences, [key]: !preferences[key] };
      void persist(next);
    },
    [persist, preferences]
  );

  const value = useMemo<UserSettingsContextValue>(
    () => ({
      ...preferences,
      setPreference,
      togglePreference,
      isReady,
    }),
    [isReady, preferences, setPreference, togglePreference]
  );

  return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>;
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error('useUserSettings must be used inside SettingsProvider.');
  }
  return context;
}

import { useCallback, useEffect, useState } from 'react';
import {
  isExerciseRestAutoApply,
  loadExerciseRestPreferences,
  normalizeExerciseRestKey,
  resolveExerciseRestSeconds,
  saveExerciseRestPreferences,
  type ExerciseRestPreferenceMap,
} from '../utils/exerciseRestTimer';
import { subscribeUserDataReady } from '../utils/userDataEvents';

export function useExerciseRestPreferences() {
  const [prefs, setPrefs] = useState<ExerciseRestPreferenceMap>({});

  const reload = useCallback(async () => {
    try {
      setPrefs(await loadExerciseRestPreferences());
    } catch {
      setPrefs({});
    }
  }, []);

  useEffect(() => {
    void reload();
    return subscribeUserDataReady(() => {
      void reload();
    });
  }, [reload]);

  const resolveRestSeconds = useCallback(
    (exerciseName: string, fallbackSeconds: number) =>
      resolveExerciseRestSeconds(prefs, exerciseName, fallbackSeconds),
    [prefs]
  );

  const isAutoApply = useCallback(
    (exerciseName: string) => isExerciseRestAutoApply(prefs, exerciseName),
    [prefs]
  );

  const setExerciseRest = useCallback(
    async (exerciseName: string, seconds: number, autoApply: boolean) => {
      const key = normalizeExerciseRestKey(exerciseName);
      if (!key) return;
      setPrefs((prev) => {
        const next = { ...prev };
        if (!autoApply) {
          delete next[key];
        } else {
          next[key] = {
            seconds: Math.max(15, Math.round(seconds)),
            autoApply: true,
          };
        }
        void saveExerciseRestPreferences(next);
        return next;
      });
    },
    []
  );

  return {
    prefs,
    resolveRestSeconds,
    isAutoApply,
    setExerciseRest,
  };
}

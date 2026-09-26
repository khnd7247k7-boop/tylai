import { useEffect, useMemo, useState } from 'react';
import { loadCoachingProfile } from '../services/CoachingProfileService';
import { loadUserData } from '../utils/userStorage';
import { subscribeUserDataReady } from '../utils/userDataEvents';
import {
  recoverySignalsFromSessions,
  restContextFromCoachingProfile,
  type SmartRestContext,
} from '../utils/smartExerciseRest';

export function useSmartRestContext(overrides: SmartRestContext = {}): SmartRestContext {
  const [fromProfile, setFromProfile] = useState<SmartRestContext>({});
  const [fromHistory, setFromHistory] = useState<SmartRestContext>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [profile, history] = await Promise.all([
          loadCoachingProfile(),
          loadUserData<Array<{ sorenessLevel?: number | null; energyLevel?: number | null }>>(
            'workoutHistory'
          ),
        ]);
        if (cancelled) return;
        setFromProfile(restContextFromCoachingProfile(profile));
        setFromHistory(recoverySignalsFromSessions(history));
      } catch {
        if (!cancelled) {
          setFromProfile({});
          setFromHistory({});
        }
      }
    };
    void load();
    return subscribeUserDataReady(() => {
      void load();
    });
  }, []);

  return useMemo(() => {
    const compact = (ctx: SmartRestContext) =>
      Object.fromEntries(
        Object.entries(ctx).filter(([, value]) => value != null && value !== '')
      ) as SmartRestContext;
    return {
      ...compact(overrides),
      ...compact(fromProfile),
      ...compact(fromHistory),
    };
  }, [
    fromProfile,
    fromHistory,
    overrides.goal,
    overrides.level,
    overrides.recoveryScore,
    overrides.restAdjustSec,
    overrides.challengeDial,
    overrides.dailyActivityLevel,
    overrides.sorenessLevel,
    overrides.energyLevel,
  ]);
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { loadUserData } from '../utils/userStorage';
import SmallWinCelebrationModal from '../components/SmallWinCelebrationModal';
import type { SmallWinPayload } from '../types/userMilestones';
import type { WorkoutSession } from '../../data/workoutPrograms';
import * as SmallWinsEngine from '../services/SmallWinsEngine';
import { cancelMicroGoalNudge, scheduleMicroGoalNudgeIfNeeded } from '../utils/smallWinNotifications';

type ProfileLite = { name?: string; fitnessGoal?: string };

async function loadProfileLite(): Promise<{ name: string; goal: string }> {
  const p = await loadUserData<ProfileLite>('userProfile');
  return {
    name: (p?.name || '').trim() || 'there',
    goal: (p?.fitnessGoal || '').trim() || 'building lasting health and strength',
  };
}

interface SmallWinsContextValue {
  onWorkoutLoggerOpened: () => Promise<void>;
  onWorkoutSessionSaved: (session: WorkoutSession) => Promise<void>;
  onSleepHoursLogged: (hours: number) => Promise<void>;
  onMobilityOnRestDay: (exerciseTitle: string) => Promise<void>;
}

const SmallWinsContext = createContext<SmallWinsContextValue | null>(null);

export function useSmallWins(): SmallWinsContextValue {
  const ctx = useContext(SmallWinsContext);
  if (!ctx) {
    return {
      onWorkoutLoggerOpened: async () => {},
      onWorkoutSessionSaved: async () => {},
      onSleepHoursLogged: async () => {},
      onMobilityOnRestDay: async () => {},
    };
  }
  return ctx;
}

export function SmallWinsProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<SmallWinPayload[]>([]);
  const enqueue = useCallback((wins: SmallWinPayload[]) => {
    if (!wins.length) return;
    setQueue((q) => [...q, ...wins]);
  }, []);

  const dismiss = useCallback(() => {
    setQueue(([_, ...rest]) => rest);
  }, []);

  const [userGoal, setUserGoal] = useState('');
  const [authReady, setAuthReady] = useState(() => !!auth?.currentUser);

  useEffect(() => {
    if (!auth || (auth as { _isMock?: boolean })._isMock) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(!!user);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    loadProfileLite().then(({ goal }) => setUserGoal(goal));
  }, [authReady]);

  const refreshDroughtNudge = useCallback(async () => {
    if (!auth?.currentUser) return;
    const days = await SmallWinsEngine.getLastSmallWinAgeDays();
    await scheduleMicroGoalNudgeIfNeeded(days);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    refreshDroughtNudge();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && auth?.currentUser) refreshDroughtNudge();
    });
    return () => sub.remove();
  }, [authReady, refreshDroughtNudge]);

  const onWorkoutLoggerOpened = useCallback(async () => {
    const { name, goal } = await loadProfileLite();
    setUserGoal(goal);
    const wins = await SmallWinsEngine.onWorkoutLoggerOpened(name, goal);
    enqueue(wins);
    if (wins.length) await cancelMicroGoalNudge();
  }, [enqueue]);

  const onWorkoutSessionSaved = useCallback(
    async (session: WorkoutSession) => {
      const { name, goal } = await loadProfileLite();
      setUserGoal(goal);
      const wins = await SmallWinsEngine.onWorkoutSessionSaved(session, name, goal);
      enqueue(wins);
      if (wins.length) await cancelMicroGoalNudge();
      await refreshDroughtNudge();
    },
    [enqueue, refreshDroughtNudge]
  );

  const onSleepHoursLogged = useCallback(
    async (hours: number) => {
      const { name, goal } = await loadProfileLite();
      setUserGoal(goal);
      const wins = await SmallWinsEngine.onSleepHoursLogged(hours, name, goal);
      enqueue(wins);
      if (wins.length) await cancelMicroGoalNudge();
      await refreshDroughtNudge();
    },
    [enqueue, refreshDroughtNudge]
  );

  const onMobilityOnRestDay = useCallback(
    async (exerciseTitle: string) => {
      const { name, goal } = await loadProfileLite();
      setUserGoal(goal);
      const wins = await SmallWinsEngine.onMobilityOnRestDay(name, goal, exerciseTitle);
      enqueue(wins);
      if (wins.length) await cancelMicroGoalNudge();
      await refreshDroughtNudge();
    },
    [enqueue, refreshDroughtNudge]
  );

  const value = useMemo<SmallWinsContextValue>(
    () => ({
      onWorkoutLoggerOpened,
      onWorkoutSessionSaved,
      onSleepHoursLogged,
      onMobilityOnRestDay,
    }),
    [onWorkoutLoggerOpened, onWorkoutSessionSaved, onSleepHoursLogged, onMobilityOnRestDay]
  );

  const current = queue[0] ?? null;
  const visible = queue.length > 0;

  return (
    <SmallWinsContext.Provider value={value}>
      {children}
      <SmallWinCelebrationModal visible={visible} payload={current} userGoal={userGoal} onDismiss={dismiss} />
    </SmallWinsContext.Provider>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  type AppStateStatus,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  cancelRestCompleteNotification,
  scheduleRestCompleteNotification,
} from './src/utils/restTimerNotifications';
import { useUserSettings } from './SettingsProvider';

type WorkoutSessionProps = {
  sessionKey: string;
  exerciseName: string;
  currentWeight: number;
  currentReps: number;
  targetWeight: number;
  targetReps: number;
  priorWeight: number;
  priorReps: number;
  showPredictiveWeight: boolean;
  autoRestTimer: boolean;
  onWeightChange: (nextWeight: number) => void;
  onRepsChange: (nextReps: number) => void;
  onLogSet: () => boolean;
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DEFAULT_REST_SECONDS = 120;

function remainingFromEndsAt(endsAtMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
}

export default function WorkoutSession({
  sessionKey,
  exerciseName,
  currentWeight,
  currentReps,
  targetWeight,
  targetReps,
  priorWeight,
  priorReps,
  showPredictiveWeight,
  autoRestTimer,
  onWeightChange,
  onRepsChange,
  onLogSet,
}: WorkoutSessionProps) {
  const { restTimerAlert } = useUserSettings();
  const [isLogged, setIsLogged] = useState(false);
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);
  const endsAtRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const endRest = useCallback(() => {
    clearTick();
    endsAtRef.current = 0;
    if (AppState.currentState === 'active') {
      void cancelRestCompleteNotification();
    }
    setIsLogged(false);
    setRestSeconds(DEFAULT_REST_SECONDS);
  }, [clearTick]);

  const syncRest = useCallback(() => {
    if (!endsAtRef.current) return;
    const left = remainingFromEndsAt(endsAtRef.current);
    setRestSeconds(left);
    if (left <= 0) endRest();
  }, [endRest]);

  useEffect(() => {
    if (!isLogged || !autoRestTimer || !endsAtRef.current) {
      clearTick();
      return;
    }

    clearTick();
    intervalRef.current = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      syncRest();
    }, 250);

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') syncRest();
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      clearTick();
      sub.remove();
    };
  }, [isLogged, autoRestTimer, clearTick, syncRest]);

  useEffect(() => {
    // Reset when user advances to a new set/exercise.
    clearTick();
    void cancelRestCompleteNotification();
    endsAtRef.current = 0;
    setIsLogged(false);
    setRestSeconds(DEFAULT_REST_SECONDS);
  }, [sessionKey, clearTick]);

  useEffect(() => {
    return () => {
      clearTick();
      void cancelRestCompleteNotification();
    };
  }, [clearTick]);

  const restLabel = useMemo(() => {
    const mins = Math.floor(restSeconds / 60);
    const secs = restSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [restSeconds]);

  const hit = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleLog = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    hit();
    const didLog = onLogSet();
    if (!didLog) return;
    setIsLogged(true);
    if (autoRestTimer) {
      const endsAt = Date.now() + DEFAULT_REST_SECONDS * 1000;
      endsAtRef.current = endsAt;
      setRestSeconds(DEFAULT_REST_SECONDS);
      if (restTimerAlert) {
        void scheduleRestCompleteNotification(endsAt);
      } else {
        void cancelRestCompleteNotification();
      }
    } else {
      endsAtRef.current = 0;
      setRestSeconds(DEFAULT_REST_SECONDS);
    }
  };

  return (
    <View style={styles.card}>
      {showPredictiveWeight ? (
        <View style={styles.targetCard}>
          <Text style={styles.targetLabel}>TARGET: {exerciseName.toUpperCase()}</Text>
          <Text style={styles.targetStat}>WEIGHT: {targetWeight} lbs</Text>
          <Text style={styles.targetStat}>REPS: {targetReps}</Text>
          <Text style={styles.targetCaption}>
            based on previous performance of {priorWeight} lbs x {priorReps} reps
          </Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Counter label="Weight" value={currentWeight} onChange={onWeightChange} hit={hit} />
        <Counter label="Reps" value={currentReps} onChange={onRepsChange} hit={hit} />
      </View>

      <Pressable
        style={[styles.logButton, isLogged && styles.logButtonDone]}
        onPressIn={hit}
        onPress={handleLog}
      >
        <Text style={styles.logButtonText}>{isLogged ? '✓ Logged' : 'Log Set'}</Text>
      </Pressable>

      {isLogged && autoRestTimer ? (
        <View style={styles.restWrap}>
          <Text style={styles.restLabel}>Rest Timer</Text>
          <Text style={styles.restClock}>{restLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Counter({
  label,
  value,
  onChange,
  hit,
}: {
  label: string;
  value: number;
  onChange: (nextValue: number) => void;
  hit: () => void;
}) {
  return (
    <View style={styles.counter}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.counterControls}>
        <Pressable
          style={styles.bump}
          onPressIn={hit}
          onPress={() => onChange(Math.max(0, value - 1))}
        >
          <Text style={styles.bumpText}>-</Text>
        </Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable style={styles.bump} onPressIn={hit} onPress={() => onChange(value + 1)}>
          <Text style={styles.bumpText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 14,
    gap: 12,
  },
  targetCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  targetLabel: { color: '#fff', fontSize: 12, letterSpacing: 0.6, fontWeight: '700' },
  targetStat: { color: '#fff', marginTop: 4, fontSize: 16, fontWeight: '700' },
  targetCaption: { color: '#a1a1a1', marginTop: 6, fontSize: 12 },
  row: { flexDirection: 'row', gap: 10 },
  counter: { flex: 1, backgroundColor: '#121212', borderRadius: 12, padding: 10 },
  counterLabel: { color: '#bbb', fontSize: 12, marginBottom: 8 },
  counterControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  bump: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: '#2b2b2b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bumpText: { color: '#fff', fontSize: 24, lineHeight: 26 },
  logButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButtonDone: { backgroundColor: '#36b668' },
  logButtonText: { color: '#0f2517', fontSize: 16, fontWeight: '700' },
  restWrap: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 12,
    borderColor: '#214430',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restLabel: { color: '#9ad9b0', fontWeight: '600' },
  restClock: { color: '#4ADE80', fontSize: 18, fontWeight: '700' },
});

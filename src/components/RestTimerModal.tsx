import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  AppState,
  type AppStateStatus,
} from 'react-native';
import {
  cancelRestCompleteNotification,
  rescheduleRestCompleteNotification,
  scheduleRestCompleteNotification,
} from '../utils/restTimerNotifications';
import { useUserSettings } from '../../SettingsProvider';
import RestDurationPicker from './RestDurationPicker';
import { formatRestClock } from '../utils/exerciseRestTimer';

export const REST_TIMER_ENABLED_STORAGE_KEY = 'restTimerEnabled';

interface RestTimerModalProps {
  visible: boolean;
  seconds: number;
  onDismiss: () => void;
  exerciseName?: string;
  applyToExercise?: boolean;
  suggestedSeconds?: number;
  suggestionHint?: string;
  onApplyToExerciseChange?: (apply: boolean) => void;
  onDurationChange?: (seconds: number) => void;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function remainingFromEndsAt(endsAtMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
}

export default function RestTimerModal({
  visible,
  seconds: initialSeconds,
  onDismiss,
  exerciseName,
  applyToExercise = false,
  suggestedSeconds,
  suggestionHint,
  onApplyToExerciseChange,
  onDurationChange,
}: RestTimerModalProps) {
  const { restTimerAlert } = useUserSettings();
  const [remaining, setRemaining] = useState(initialSeconds);
  const [selectedSeconds, setSelectedSeconds] = useState(initialSeconds);
  const endsAtRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  const restTimerAlertRef = useRef(restTimerAlert);
  onDismissRef.current = onDismiss;
  restTimerAlertRef.current = restTimerAlert;

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const finish = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    clearTick();
    // Still in foreground — cancel so we don't double-alert; background cases keep the notif.
    if (AppState.currentState === 'active') {
      await cancelRestCompleteNotification();
    }
    onDismissRef.current();
  }, [clearTick]);

  const syncFromWallClock = useCallback(() => {
    if (!endsAtRef.current) return;
    const left = remainingFromEndsAt(endsAtRef.current);
    setRemaining(left);
    if (left <= 0) {
      void finish();
    }
  }, [finish]);

  useEffect(() => {
    if (!visible) {
      clearTick();
      void cancelRestCompleteNotification();
      completedRef.current = false;
      endsAtRef.current = 0;
      return;
    }

    completedRef.current = false;
    setSelectedSeconds(initialSeconds);
    const endsAt = Date.now() + Math.max(1, initialSeconds) * 1000;
    endsAtRef.current = endsAt;
    setRemaining(remainingFromEndsAt(endsAt));
    if (restTimerAlertRef.current) {
      void scheduleRestCompleteNotification(endsAt);
    } else {
      void cancelRestCompleteNotification();
    }

    clearTick();
    intervalRef.current = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      syncFromWallClock();
    }, 250);

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        syncFromWallClock();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      clearTick();
      sub.remove();
      // Leaving mid-rest (navigate away / unmount): drop the pending alert.
      if (!completedRef.current) {
        void cancelRestCompleteNotification();
      }
    };
  }, [visible, initialSeconds, clearTick, syncFromWallClock]);

  const handleSkip = () => {
    completedRef.current = true;
    clearTick();
    void cancelRestCompleteNotification();
    onDismiss();
  };

  const addTime = () => {
    if (completedRef.current) return;
    const base = Math.max(endsAtRef.current, Date.now());
    const nextEnds = base + 15_000;
    endsAtRef.current = nextEnds;
    setRemaining(remainingFromEndsAt(nextEnds));
    if (restTimerAlertRef.current) {
      void rescheduleRestCompleteNotification(nextEnds);
    } else {
      void cancelRestCompleteNotification();
    }
  };

  const retargetDuration = (seconds: number) => {
    if (completedRef.current) return;
    setSelectedSeconds(seconds);
    const endsAt = Date.now() + Math.max(1, seconds) * 1000;
    endsAtRef.current = endsAt;
    setRemaining(remainingFromEndsAt(endsAt));
    if (restTimerAlertRef.current) {
      void scheduleRestCompleteNotification(endsAt);
    } else {
      void cancelRestCompleteNotification();
    }
    onDurationChange?.(seconds);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleSkip}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.cardContent}
          >
            <Text style={styles.title}>Rest timer</Text>
            {exerciseName ? (
              <Text style={styles.exerciseName} numberOfLines={1}>
                {exerciseName}
              </Text>
            ) : null}
            <Text style={styles.timer}>{formatTime(remaining)}</Text>
            <Text style={styles.presetHint}>Choose a rest time</Text>
            {suggestionHint ? <Text style={styles.suggestionHint}>{suggestionHint}</Text> : null}
            <View style={styles.pickerWrap}>
              <RestDurationPicker
                valueSeconds={selectedSeconds}
                suggestedSeconds={suggestedSeconds}
                onChange={retargetDuration}
              />
            </View>
            {exerciseName && onApplyToExerciseChange ? (
              <View style={styles.applyRow}>
                <View style={styles.applyCopy}>
                  <Text style={styles.applyLabel}>
                    Always use {formatRestClock(selectedSeconds)} for this exercise
                  </Text>
                  <Text style={styles.applyHint}>
                    After every {exerciseName} set, start this rest automatically
                  </Text>
                </View>
                <Switch
                  value={applyToExercise}
                  onValueChange={onApplyToExerciseChange}
                  trackColor={{ false: '#444', true: '#006644' }}
                  thumbColor={applyToExercise ? '#00ff88' : '#888'}
                  accessibilityLabel={`Always use this rest time for ${exerciseName}`}
                />
              </View>
            ) : null}
            <TouchableOpacity style={styles.secondaryBtn} onPress={addTime} accessibilityRole="button">
              <Text style={styles.secondaryBtnText}>+15 sec</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSkip} accessibilityRole="button">
              <Text style={styles.primaryBtnText}>Skip</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#333',
    width: '100%',
    maxWidth: 360,
    maxHeight: '88%',
  },
  cardContent: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
    textAlign: 'center',
  },
  timer: {
    fontSize: 48,
    fontWeight: '700',
    color: '#00ff88',
    marginBottom: 12,
  },
  presetHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 6,
  },
  suggestionHint: {
    fontSize: 12,
    color: '#9ad9b0',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 10,
  },
  pickerWrap: {
    width: '100%',
    marginBottom: 12,
  },
  applyRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
  },
  applyCopy: {
    flex: 1,
  },
  applyLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  applyHint: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
  },
  secondaryBtn: {
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  secondaryBtnText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderWidth: 1,
    borderColor: '#444',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  type AppStateStatus,
} from 'react-native';
import {
  cancelRestCompleteNotification,
  rescheduleRestCompleteNotification,
  scheduleRestCompleteNotification,
} from '../utils/restTimerNotifications';
import { useUserSettings } from '../../SettingsProvider';

export const REST_TIMER_ENABLED_STORAGE_KEY = 'restTimerEnabled';

interface RestTimerModalProps {
  visible: boolean;
  seconds: number;
  onDismiss: () => void;
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
}: RestTimerModalProps) {
  const { restTimerAlert } = useUserSettings();
  const [remaining, setRemaining] = useState(initialSeconds);
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

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleSkip}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Rest timer</Text>
          <Text style={styles.timer}>{formatTime(remaining)}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={addTime} accessibilityRole="button">
            <Text style={styles.secondaryBtnText}>+15 sec</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSkip} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>Skip</Text>
          </TouchableOpacity>
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
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    minWidth: 260,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 12,
  },
  timer: {
    fontSize: 48,
    fontWeight: '700',
    color: '#00ff88',
    marginBottom: 20,
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

import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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

export default function RestTimerModal({ visible, seconds: initialSeconds, onDismiss }: RestTimerModalProps) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!visible) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    setRemaining(initialSeconds);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onDismissRef.current();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible, initialSeconds]);

  const handleSkip = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    onDismiss();
  };

  const addTime = () => {
    setRemaining((r) => r + 15);
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

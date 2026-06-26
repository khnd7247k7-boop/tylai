import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { SmallWinPayload } from '../types/userMilestones';
import { AppTheme } from '../theme/appVisualTheme';

interface Props {
  visible: boolean;
  payload: SmallWinPayload | null;
  userGoal: string;
  onDismiss: () => void;
}

export default function SmallWinCelebrationModal({ visible, payload, userGoal, onDismiss }: Props) {
  if (!payload) return null;
  const goalLine =
    userGoal.trim().length > 0
      ? `This is a key step toward your goal of ${userGoal.trim()}.`
      : 'This is a key step toward your fitness goals.';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>{payload.emoji}</Text>
          <Text style={styles.headline}>{payload.headline}</Text>
          <Text style={styles.body}>{payload.actionLine}</Text>
          <Text style={styles.goal}>{goalLine}</Text>
          <View style={styles.scienceBox}>
            <Text style={styles.scienceLabel}>Why it matters</Text>
            <Text style={styles.science}>{payload.whyItMatters}</Text>
          </View>
          <View style={styles.twinBox}>
            <Text style={styles.twinLabel}>Competence</Text>
            <Text style={styles.twinText}>
              This reflects skills and choices you controlled in training—not luck.
            </Text>
            <Text style={[styles.twinLabel, { marginTop: 10 }]}>Autonomy</Text>
            <Text style={styles.twinText}>
              You decided to show up. Next session, adjust volume or intensity however fits your week.
            </Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={onDismiss} accessibilityRole="button">
            <Text style={styles.buttonText}>Keep going</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: AppTheme.bgElevated,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  emoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 12,
  },
  headline: {
    color: AppTheme.accent,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    color: AppTheme.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 10,
  },
  goal: {
    color: AppTheme.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  scienceBox: {
    backgroundColor: AppTheme.bgScreen,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  scienceLabel: {
    color: AppTheme.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  science: {
    color: AppTheme.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  twinBox: {
    marginBottom: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.bgScreen,
  },
  twinLabel: {
    color: AppTheme.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  twinText: {
    color: AppTheme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    backgroundColor: AppTheme.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '700',
  },
});

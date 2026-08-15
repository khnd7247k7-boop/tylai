/**
 * Finish-workout prompt: same Track Cardio form as Log Workout.
 */
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { CardioLog } from '../../../data/workoutPrograms';
import TrackCardioSection, { type WorkoutCardioSummary } from './TrackCardioSection';
import { DiscomfortReportCTA } from '../movement/DiscomfortAssessmentFlow';

type Props = {
  visible: boolean;
  value: CardioLog | null;
  onChange: (next: CardioLog | null) => void;
  windowStart: Date;
  windowEnd: Date;
  workoutSummary?: WorkoutCardioSummary | null;
  onSkip: () => void;
  onSave: () => void;
  /** Close the sheet without finishing the workout. */
  onDismiss?: () => void;
  /** Post-workout movement feedback entry. */
  onReportDiscomfort?: () => void;
};

export default function TrackCardioPromptModal({
  visible,
  value,
  onChange,
  windowStart,
  windowEnd,
  workoutSummary,
  onSkip,
  onSave,
  onDismiss,
  onReportDiscomfort,
}: Props): React.ReactElement {
  const closeSheet = onDismiss ?? onSkip;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeSheet}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={closeSheet} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Add cardio?</Text>
          <Text style={styles.subtitle}>
            Log a run, walk, or bike before you finish — same form as Log Workout.
          </Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
            contentContainerStyle={styles.scroll}
          >
            <TrackCardioSection
              compact
              value={value}
              onChange={onChange}
              windowStart={windowStart}
              windowEnd={windowEnd}
              workoutSummary={workoutSummary}
            />
            {onReportDiscomfort ? (
              <DiscomfortReportCTA
                compact
                label="Something doesn't feel right?"
                onPress={onReportDiscomfort}
              />
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.85}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={onSave} activeOpacity={0.85}>
              <Text style={styles.saveText}>{value ? 'Save with cardio' : 'Finish workout'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    backgroundColor: '#2a2a2a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  scrollView: {
    maxHeight: 420,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  scroll: { paddingBottom: 8 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  skipBtn: {
    flex: 1,
    backgroundColor: '#243024',
    borderWidth: 1,
    borderColor: '#00ff88',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipText: { color: '#00ff88', fontSize: 15, fontWeight: '800' },
  saveBtn: {
    flex: 1.3,
    backgroundColor: '#00ff88',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveText: { color: '#1a1a1a', fontSize: 15, fontWeight: '800' },
});

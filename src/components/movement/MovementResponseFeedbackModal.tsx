/**
 * Quick Movement Intelligence response feedback.
 * "How did that movement feel today?" — a few seconds after a modified workout.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppTextInput as TextInput } from '../AppTextInput';
import { AppTheme } from '../../theme/appVisualTheme';
import type { PostWorkoutMovementOutcome, TrainingConstraint } from '../../types/movementIntelligence';
import {
  loadFeedbackCandidates,
  submitMovementResponseFeedback,
} from '../../services/MovementFeedbackLoopService';
import { showAppNotification } from '../../utils/appNotificationBridge';

type Props = {
  visible: boolean;
  /** Prefill when opened for a known exercise. */
  exerciseName?: string | null;
  workoutSessionId?: string | null;
  onClose: () => void;
  /** Called after save or skip so the finish flow can continue. */
  onDone: () => void;
};

const OUTCOMES: Array<{ value: PostWorkoutMovementOutcome; label: string }> = [
  { value: 'better', label: 'Better' },
  { value: 'same', label: 'About the same' },
  { value: 'worse', label: 'Worse' },
];

export default function MovementResponseFeedbackModal({
  visible,
  exerciseName,
  workoutSessionId,
  onClose,
  onDone,
}: Props): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<TrainingConstraint[]>([]);
  const [selectedConstraintId, setSelectedConstraintId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<PostWorkoutMovementOutcome | null>(null);
  const [severity, setSeverity] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) return;
    setOutcome(null);
    setSeverity(null);
    setNotes('');
    setLoading(true);
    void (async () => {
      try {
        const list = await loadFeedbackCandidates();
        setCandidates(list);
        const pref = exerciseName?.trim().toLowerCase();
        const match = pref
          ? list.find((c) => c.exercise?.toLowerCase() === pref) ??
            list.find((c) =>
              (c.preferredVariations ?? []).some((v) => v.toLowerCase() === pref)
            )
          : null;
        setSelectedConstraintId(match?.id ?? list[0]?.id ?? null);
      } catch (e) {
        console.warn('[MovementResponseFeedbackModal] load failed', e);
        setCandidates([]);
        setSelectedConstraintId(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, exerciseName]);

  const selected = useMemo(
    () => candidates.find((c) => c.id === selectedConstraintId) ?? null,
    [candidates, selectedConstraintId]
  );

  const titleExercise =
    selected?.preferredVariations?.[0] ||
    selected?.exercise ||
    exerciseName?.trim() ||
    'that movement';

  const finish = async () => {
    if (!outcome) return;
    setSaving(true);
    try {
      const result = await submitMovementResponseFeedback({
        outcome,
        discomfortSeverity: severity ?? undefined,
        exercise: selected?.exercise || exerciseName?.trim() || undefined,
        movementPattern: selected?.movementPattern,
        constraintId: selected?.id,
        modificationUsed: selected?.modificationUsed,
        notes: notes.trim() || undefined,
        workoutSessionId: workoutSessionId ?? undefined,
      });
      showAppNotification({
        title: 'Thanks',
        lines: [result.userMessage],
        type: result.suggestProfessionalEvaluation ? 'info' : 'success',
        durationMs: result.suggestProfessionalEvaluation ? 6500 : 3800,
      });
      onDone();
    } catch (e) {
      console.warn('[MovementResponseFeedbackModal] save failed', e);
      showAppNotification({
        title: 'Could not save',
        lines: ['Please try again in a moment.'],
        type: 'error',
        durationMs: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    onDone();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>How did that movement feel today?</Text>
          <Text style={styles.subtitle}>
            Quick check on <Text style={styles.em}>{titleExercise}</Text> so TYL can adjust
            wisely — no diagnosis, just better training.
          </Text>

          {loading ? (
            <ActivityIndicator color={AppTheme.accent} style={{ marginVertical: 20 }} />
          ) : (
            <>
              {candidates.length > 1 ? (
                <View style={styles.chipWrap}>
                  {candidates.slice(0, 4).map((c) => {
                    const label = c.preferredVariations?.[0] || c.exercise || 'Movement';
                    const on = c.id === selectedConstraintId;
                    return (
                      <Pressable
                        key={c.id}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => setSelectedConstraintId(c.id)}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.outcomeRow}>
                {OUTCOMES.map((o) => {
                  const on = outcome === o.value;
                  return (
                    <TouchableOpacity
                      key={o.value}
                      style={[styles.outcomeBtn, on && styles.outcomeBtnOn]}
                      onPress={() => setOutcome(o.value)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.outcomeText, on && styles.outcomeTextOn]}>
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>Discomfort 0–10 (optional)</Text>
              <View style={styles.severityRow}>
                {Array.from({ length: 11 }, (_, n) => n).map((n) => {
                  const on = severity === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[styles.sevChip, on && styles.sevChipOn]}
                      onPress={() => setSeverity(n)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.sevText, on && styles.sevTextOn]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={styles.notes}
                placeholder="Optional note"
                placeholderTextColor={AppTheme.textFaint}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.skipBtn} onPress={skip} activeOpacity={0.85}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (!outcome || saving) && styles.saveBtnDisabled]}
              onPress={() => void finish()}
              disabled={!outcome || saving}
              activeOpacity={0.85}
            >
              <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
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
    marginBottom: 14,
  },
  em: { color: '#e5e5e5', fontWeight: '700' },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#3a3a3a',
    maxWidth: '100%',
  },
  chipOn: { backgroundColor: AppTheme.accent },
  chipText: { color: '#ddd', fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: '#04140a' },
  outcomeRow: { gap: 8, marginBottom: 14 },
  outcomeBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#3a3a3a',
    alignItems: 'center',
  },
  outcomeBtnOn: { backgroundColor: '#22c55e' },
  outcomeText: { color: '#eee', fontWeight: '700', fontSize: 15 },
  outcomeTextOn: { color: '#04140a' },
  severityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  sevChip: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3a3a',
  },
  sevChipOn: { backgroundColor: AppTheme.accent },
  sevText: { color: '#ccc', fontWeight: '700', fontSize: 13 },
  sevTextOn: { color: '#04140a' },
  notes: {
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: '#1f1f1f',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 10 },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#3a3a3a',
    alignItems: 'center',
  },
  skipText: { color: '#ddd', fontWeight: '700', fontSize: 15 },
  saveBtn: {
    flex: 1.4,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { color: '#04140a', fontWeight: '800', fontSize: 15 },
});

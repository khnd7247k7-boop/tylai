/**
 * Conversational Movement Discomfort Assessment.
 * Coach tone, one question per screen, saves DiscomfortReport + MovementProfile.
 * Does not diagnose or change workouts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppTextInput as TextInput } from '../AppTextInput';
import { AppTheme } from '../../theme/appVisualTheme';
import { showAppNotification } from '../../utils/appNotificationBridge';
import {
  DISCOMFORT_BODY_AREA_OPTIONS,
  DISCOMFORT_FREQUENCY_OPTIONS,
  DISCOMFORT_MODIFICATION_OPTIONS,
  DISCOMFORT_PHASE_OPTIONS,
  DISCOMFORT_SENSATION_OPTIONS,
  DISCOMFORT_SIDE_OPTIONS,
  DISCOMFORT_TREND_OPTIONS,
  humanModificationLabels,
  labelForOption,
  modificationResponseFromSelections,
  onsetFromMovementPhase,
} from '../../utils/discomfortAssessmentOptions';
import { submitDiscomfortAssessment } from '../../services/MovementIntelligenceService';
import { evaluateDiscomfortSafety } from '../../utils/movementSafetyEvaluation';
import type {
  BodyArea,
  BodySide,
  DiscomfortFrequency,
  DiscomfortTrend,
  MovementPhase,
  SensationType,
} from '../../types/movementIntelligence';

type StepId =
  | 'intro'
  | 'bodyArea'
  | 'side'
  | 'sensation'
  | 'severity'
  | 'phase'
  | 'frequency'
  | 'modifications'
  | 'trend'
  | 'summary';

const STEPS: StepId[] = [
  'intro',
  'bodyArea',
  'side',
  'sensation',
  'severity',
  'phase',
  'frequency',
  'modifications',
  'trend',
  'summary',
];

export type DiscomfortAssessmentFlowProps = {
  visible: boolean;
  onClose: () => void;
  /** Prefill when opened from a specific exercise. */
  exerciseName?: string | null;
  /** Optional workout session id for future linking. */
  workoutSessionId?: string | null;
  onCompleted?: () => void;
};

export default function DiscomfortAssessmentFlow({
  visible,
  onClose,
  exerciseName,
  onCompleted,
}: DiscomfortAssessmentFlowProps): React.ReactElement {
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const [bodyArea, setBodyArea] = useState<BodyArea | null>(null);
  const [bodyAreaOther, setBodyAreaOther] = useState('');
  const [side, setSide] = useState<BodySide | null>(null);
  const [sensation, setSensation] = useState<SensationType | null>(null);
  const [sensationOther, setSensationOther] = useState('');
  const [severity, setSeverity] = useState<number | null>(null);
  const [phase, setPhase] = useState<MovementPhase | null>(null);
  const [frequency, setFrequency] = useState<DiscomfortFrequency | null>(null);
  const [modifications, setModifications] = useState<string[]>([]);
  const [trend, setTrend] = useState<DiscomfortTrend | null>(null);

  const step = STEPS[stepIndex] ?? 'intro';
  const progress = (stepIndex + 1) / STEPS.length;

  useEffect(() => {
    if (!visible) return;
    setStepIndex(0);
    setSaving(false);
    setBodyArea(null);
    setBodyAreaOther('');
    setSide(null);
    setSensation(null);
    setSensationOther('');
    setSeverity(null);
    setPhase(null);
    setFrequency(null);
    setModifications([]);
    setTrend(null);
  }, [visible, exerciseName]);

  const canContinue = useMemo(() => {
    switch (step) {
      case 'intro':
        return true;
      case 'bodyArea':
        return Boolean(bodyArea) && (bodyArea !== 'other' || bodyAreaOther.trim().length > 0);
      case 'side':
        return Boolean(side);
      case 'sensation':
        return Boolean(sensation) && (sensation !== 'other' || sensationOther.trim().length > 0);
      case 'severity':
        return severity != null;
      case 'phase':
        return Boolean(phase);
      case 'frequency':
        return Boolean(frequency);
      case 'modifications':
        return modifications.length > 0;
      case 'trend':
        return Boolean(trend);
      case 'summary':
        return !saving;
      default:
        return false;
    }
  }, [
    step,
    bodyArea,
    bodyAreaOther,
    side,
    sensation,
    sensationOther,
    severity,
    phase,
    frequency,
    modifications,
    trend,
    saving,
  ]);

  const toggleModification = (value: string) => {
    setModifications((prev) => {
      if (value === 'havent_tried' || value === 'nothing_helps') {
        return prev.includes(value) ? [] : [value];
      }
      const withoutExclusive = prev.filter((v) => v !== 'havent_tried' && v !== 'nothing_helps');
      return withoutExclusive.includes(value)
        ? withoutExclusive.filter((v) => v !== value)
        : [...withoutExclusive, value];
    });
  };

  const goBack = () => {
    if (stepIndex <= 0) {
      onClose();
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const previewSafety = useMemo(() => {
    if (!bodyArea || !side || !sensation || severity == null || !frequency || !trend) {
      return null;
    }
    return evaluateDiscomfortSafety({
      report: {
        id: 'preview',
        severity,
        sensation,
        trend,
        frequency,
        modificationsAttempted: humanModificationLabels(modifications),
        modificationResponse: modificationResponseFromSelections(modifications),
      },
    });
  }, [bodyArea, side, sensation, severity, frequency, trend, modifications]);

  const finish = async () => {
    if (!bodyArea || !side || !sensation || severity == null || !phase || !frequency || !trend) {
      return;
    }
    setSaving(true);
    try {
      const { safety } = await submitDiscomfortAssessment({
        bodyArea,
        bodyAreaOther: bodyArea === 'other' ? bodyAreaOther.trim() : undefined,
        side,
        sensation,
        sensationOther: sensation === 'other' ? sensationOther.trim() : undefined,
        severity,
        movementPhase: phase,
        onset: onsetFromMovementPhase(phase),
        frequency,
        modificationsAttempted: humanModificationLabels(modifications),
        modificationResponse: modificationResponseFromSelections(modifications),
        trend,
        exercise: exerciseName?.trim() || undefined,
      });
      showAppNotification({
        title: 'Got it',
        lines: [safety.userMessage],
        type: safety.status === 'professional_evaluation' ? 'info' : 'success',
        durationMs: safety.status === 'professional_evaluation' ? 6500 : 4200,
      });
      onCompleted?.();
      onClose();
    } catch (e) {
      console.warn('[DiscomfortAssessmentFlow] save failed', e);
      showAppNotification({
        title: 'Could not save',
        lines: ['Please try again in a moment.'],
        type: 'error',
        durationMs: 3200,
      });
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (!canContinue) return;
    if (step === 'summary') {
      void finish();
      return;
    }
    if (step === 'trend') {
      setStepIndex(STEPS.indexOf('summary'));
      return;
    }
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  };

  const titleForStep = (): string => {
    switch (step) {
      case 'intro':
        return "Let's check in";
      case 'bodyArea':
        return 'Where do you feel it?';
      case 'side':
        return 'Which side?';
      case 'sensation':
        return 'What does it feel like?';
      case 'severity':
        return 'How uncomfortable is it?';
      case 'phase':
        return 'When do you notice it?';
      case 'frequency':
        return 'How often does it happen?';
      case 'modifications':
        return 'Does changing the movement help?';
      case 'trend':
        return 'Is it changing over time?';
      case 'summary':
        return 'All set';
      default:
        return '';
    }
  };

  const subtitleForStep = (): string => {
    switch (step) {
      case 'intro':
        return exerciseName?.trim()
          ? `Let's understand how your body is responding to ${exerciseName.trim()}.`
          : "Let's understand how your body is responding to this movement.";
      case 'severity':
        return '0 is nothing · 10 is the worst you can imagine';
      case 'modifications':
        return 'Select anything you’ve tried — or that you haven’t tried yet.';
      case 'summary':
        return "Your answers will help TYL adjust your training. We won't diagnose anything.";
      default:
        return 'Your answers will help TYL adjust your training.';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={goBack}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} hitSlop={12} accessibilityRole="button">
            <Text style={styles.headerBtn}>{stepIndex === 0 ? 'Close' : 'Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Movement check-in</Text>
          <View style={{ width: 56 }} />
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {stepIndex + 1} of {STEPS.length}
        </Text>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.question}>{titleForStep()}</Text>
          <Text style={styles.subtitle}>{subtitleForStep()}</Text>

          {step === 'intro' ? (
            <View style={styles.introCard}>
              <Text style={styles.introText}>
                This is a quick check-in — not a medical questionnaire. Tell us what you’re feeling
                so we can keep training smarter for your body.
              </Text>
              {exerciseName?.trim() ? (
                <Text style={styles.exerciseChip}>Exercise: {exerciseName.trim()}</Text>
              ) : null}
            </View>
          ) : null}

          {step === 'bodyArea' ? (
            <>
              <OptionGrid
                options={DISCOMFORT_BODY_AREA_OPTIONS}
                selected={bodyArea}
                onSelect={setBodyArea}
              />
              {bodyArea === 'other' ? (
                <TextInput
                  style={styles.input}
                  placeholder="Where exactly?"
                  placeholderTextColor={AppTheme.textFaint}
                  value={bodyAreaOther}
                  onChangeText={setBodyAreaOther}
                  autoCapitalize="sentences"
                />
              ) : null}
            </>
          ) : null}

          {step === 'side' ? (
            <OptionGrid options={DISCOMFORT_SIDE_OPTIONS} selected={side} onSelect={setSide} />
          ) : null}

          {step === 'sensation' ? (
            <>
              <OptionGrid
                options={DISCOMFORT_SENSATION_OPTIONS}
                selected={sensation}
                onSelect={setSensation}
              />
              {sensation === 'other' ? (
                <TextInput
                  style={styles.input}
                  placeholder="Describe the feeling"
                  placeholderTextColor={AppTheme.textFaint}
                  value={sensationOther}
                  onChangeText={setSensationOther}
                  autoCapitalize="sentences"
                />
              ) : null}
            </>
          ) : null}

          {step === 'severity' ? (
            <View style={styles.severityWrap}>
              <Text style={styles.severityValue}>{severity ?? '—'}</Text>
              <View style={styles.severityRow}>
                {Array.from({ length: 11 }, (_, n) => n).map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.severityChip, severity === n && styles.severityChipOn]}
                    onPress={() => setSeverity(n)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.severityChipText, severity === n && styles.severityChipTextOn]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {step === 'phase' ? (
            <OptionGrid options={DISCOMFORT_PHASE_OPTIONS} selected={phase} onSelect={setPhase} />
          ) : null}

          {step === 'frequency' ? (
            <OptionGrid
              options={DISCOMFORT_FREQUENCY_OPTIONS}
              selected={frequency}
              onSelect={setFrequency}
            />
          ) : null}

          {step === 'modifications' ? (
            <View style={styles.chipWrap}>
              {DISCOMFORT_MODIFICATION_OPTIONS.map((opt) => {
                const on = modifications.includes(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => toggleModification(opt.value)}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {step === 'trend' ? (
            <OptionGrid options={DISCOMFORT_TREND_OPTIONS} selected={trend} onSelect={setTrend} />
          ) : null}

          {step === 'summary' ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLead}>
                {previewSafety?.userMessage ??
                  "Got it. I'll use this information to adjust your training and monitor how this movement responds."}
              </Text>
              <SummaryRow
                label="Where"
                value={
                  bodyArea === 'other'
                    ? bodyAreaOther.trim()
                    : labelForOption(DISCOMFORT_BODY_AREA_OPTIONS, bodyArea ?? undefined)
                }
              />
              <SummaryRow label="Side" value={labelForOption(DISCOMFORT_SIDE_OPTIONS, side ?? undefined)} />
              <SummaryRow
                label="Feeling"
                value={
                  sensation === 'other'
                    ? sensationOther.trim()
                    : labelForOption(DISCOMFORT_SENSATION_OPTIONS, sensation ?? undefined)
                }
              />
              <SummaryRow label="Intensity" value={severity != null ? `${severity} / 10` : '—'} />
              <SummaryRow
                label="When"
                value={labelForOption(DISCOMFORT_PHASE_OPTIONS, phase ?? undefined)}
              />
              <SummaryRow
                label="How often"
                value={labelForOption(DISCOMFORT_FREQUENCY_OPTIONS, frequency ?? undefined)}
              />
              <SummaryRow label="Tried" value={humanModificationLabels(modifications).join(', ')} />
              <SummaryRow
                label="Trend"
                value={labelForOption(DISCOMFORT_TREND_OPTIONS, trend ?? undefined)}
              />
              {exerciseName?.trim() ? (
                <SummaryRow label="Exercise" value={exerciseName.trim()} />
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
            onPress={goNext}
            disabled={!canContinue}
            activeOpacity={0.88}
          >
            {saving ? (
              <ActivityIndicator color={AppTheme.accentDark} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {step === 'intro' ? 'Start check-in' : step === 'summary' ? 'Save check-in' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function OptionGrid<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (v: T) => void;
}): React.ReactElement {
  return (
    <View style={styles.chipWrap}>
      {options.map((opt) => {
        const on = selected === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => onSelect(opt.value)}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value || '—'}</Text>
    </View>
  );
}

/** Compact CTA used at workout / progress entry points. */
export function DiscomfortReportCTA({
  label = "Something doesn't feel right?",
  onPress,
  compact = false,
}: {
  label?: string;
  onPress: () => void;
  compact?: boolean;
}): React.ReactElement {
  return (
    <TouchableOpacity
      style={[styles.cta, compact && styles.ctaCompact]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.ctaText, compact && styles.ctaTextCompact]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppTheme.bgScreen },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBtn: { color: AppTheme.accent, fontSize: 16, fontWeight: '600', width: 56 },
  headerTitle: { color: AppTheme.textPrimary, fontSize: 16, fontWeight: '700' },
  progressTrack: {
    height: 4,
    marginHorizontal: 16,
    borderRadius: 999,
    backgroundColor: AppTheme.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: AppTheme.accent },
  progressLabel: {
    color: AppTheme.textFaint,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginHorizontal: 16,
  },
  body: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  question: {
    color: AppTheme.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 8,
  },
  subtitle: {
    color: AppTheme.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  introCard: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 16,
    gap: 12,
  },
  introText: { color: AppTheme.textSecondary, fontSize: 15, lineHeight: 22 },
  exerciseChip: {
    alignSelf: 'flex-start',
    color: AppTheme.accent,
    fontWeight: '700',
    fontSize: 13,
    backgroundColor: 'rgba(0,255,136,0.1)',
    borderRadius: AppTheme.radiusPill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: AppTheme.radiusPill,
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  chipOn: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0,255,136,0.12)',
  },
  chipText: { color: AppTheme.textSecondary, fontWeight: '600', fontSize: 14 },
  chipTextOn: { color: AppTheme.accent },
  input: {
    marginTop: 14,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    borderRadius: AppTheme.radiusButton,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: AppTheme.textPrimary,
    fontSize: 15,
  },
  severityWrap: { alignItems: 'center', gap: 16 },
  severityValue: {
    color: AppTheme.accent,
    fontSize: 48,
    fontWeight: '800',
  },
  severityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  severityChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  severityChipOn: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0,255,136,0.15)',
  },
  severityChipText: { color: AppTheme.textMuted, fontWeight: '700' },
  severityChipTextOn: { color: AppTheme.accent },
  summaryCard: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 16,
    gap: 10,
  },
  summaryLead: {
    color: AppTheme.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.border,
  },
  summaryLabel: { color: AppTheme.textMuted, fontSize: 13, fontWeight: '600', width: 88 },
  summaryValue: {
    color: AppTheme.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
  },
  primaryBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: AppTheme.radiusButton,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: AppTheme.accentDark, fontSize: 16, fontWeight: '800' },
  cta: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: AppTheme.radiusButton,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.35)',
    backgroundColor: 'rgba(0,255,136,0.06)',
    alignItems: 'center',
  },
  ctaCompact: {
    marginTop: 8,
    paddingVertical: 10,
  },
  ctaText: { color: AppTheme.accent, fontWeight: '700', fontSize: 14 },
  ctaTextCompact: { fontSize: 13 },
});

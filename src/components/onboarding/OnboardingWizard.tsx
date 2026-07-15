import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { AppTextInput as TextInput } from '../AppTextInput';
import { AppTheme } from '../../theme/appVisualTheme';
import {
  type CoachingProfile,
  type PrimaryGoal,
  type ExperienceLevel,
  type TimelineOption,
  type BestTimeOfDay,
  type EquipmentAccess,
  type TrainingStylePreference,
  type RecoveryLevel,
  type DailyActivityLevel,
  type ChallengeDial,
  type SexForBmr,
  PRIMARY_GOAL_LABELS,
  ONBOARDING_TOTAL_STEPS,
  createEmptyCoachingProfile,
  isNutritionPreferencesAnswered,
  formatNutritionPreferencesSummary,
} from '../../types/coachingProfile';
import InitialNutritionSetupForm from './InitialNutritionSetupForm';
import {
  loadCoachingProfile,
  saveCoachingProfileDraft,
  completeOnboarding,
  updateCoachingProfileFromQuestionnaire,
  computeOverestimateRisk,
} from '../../services/CoachingProfileService';
import {
  deriveNutritionTargetsFromProfile,
  normalizeNutritionBodyDraft,
} from '../../utils/nutritionTargets';
import { parseAgeYears, parseHeightToCm, parseWeightToKg } from '../../utils/bodyMetricsParse';
import { getOnboardingContinueIssues, getCoachingProfileCompletionIssues } from '../../utils/onboardingContinueHints';
import { ContinueRequirementHint } from './nutritionQuestionnaireUi';
import TrainingScheduleFields from '../TrainingScheduleFields';
import { scheduleSummaryLine, isTrainingScheduleConfigured } from '../../utils/trainingSchedule';

type Props = {
  visible: boolean;
  onComplete: () => void;
  /** When set, user is revising answers from Settings — no first-plan redirect. */
  mode?: 'onboarding' | 'edit';
  onCancel?: () => void;
};

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CoachPrompt({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.promptBlock}>
      <Text style={styles.coachLabel}>Your coach</Text>
      <Text style={styles.promptTitle}>{title}</Text>
      {subtitle ? <Text style={styles.promptSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export default function OnboardingWizard({
  visible,
  onComplete,
  mode = 'onboarding',
  onCancel,
}: Props) {
  const isEditMode = mode === 'edit';
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<CoachingProfile>(createEmptyCoachingProfile());
  const [editMode, setEditMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!visible) {
      setHydrated(false);
      setEditMode(false);
      return;
    }
    void (async () => {
      const saved = await loadCoachingProfile();
      setProfile(saved);
      if (isEditMode) {
        setStep(0);
      } else if (typeof saved.onboardingStep === 'number' && saved.onboardingStep >= 0) {
        setStep(Math.min(saved.onboardingStep, ONBOARDING_TOTAL_STEPS - 1));
      } else {
        setStep(0);
      }
      setHydrated(true);
    })();
  }, [visible, isEditMode]);

  useEffect(() => {
    if (!visible || !hydrated) return;
    const timer = setTimeout(() => {
      void saveCoachingProfileDraft(profile, step);
    }, 350);
    return () => clearTimeout(timer);
  }, [profile, step, visible, hydrated]);

  const persist = useCallback(
    async (next: CoachingProfile, nextStep: number) => {
      setProfile(next);
      await saveCoachingProfileDraft(next, nextStep);
    },
    []
  );

  const goNext = useCallback(async () => {
    let nextProfile = profile;
    if (step === 9) {
      const normalized = normalizeNutritionBodyDraft(profile.nutritionBodyProfile);
      if (!normalized) return;
      nextProfile = { ...profile, nutritionBodyProfile: normalized };
      setProfile(nextProfile);
    }
    const nextStep = Math.min(step + 1, ONBOARDING_TOTAL_STEPS - 1);
    await persist(nextProfile, nextStep);
    setStep(nextStep);
  }, [persist, profile, step]);

  const goBack = useCallback(() => {
    setStep((s) => {
      const prev = Math.max(0, s - 1);
      void saveCoachingProfileDraft(profile, prev);
      return prev;
    });
  }, [profile]);

  const finish = useCallback(async () => {
    if (finishing) return;

    const completionIssues = getCoachingProfileCompletionIssues(profile);
    if (completionIssues.length > 0) {
      Alert.alert(
        'Almost there',
        `Complete these before we build your plan:\n\n${completionIssues.map((i) => `• ${i}`).join('\n')}`
      );
      return;
    }

    setFinishing(true);
    try {
      if (isEditMode) {
        await updateCoachingProfileFromQuestionnaire(profile);
      } else {
        await completeOnboarding(profile);
      }
      onComplete();
    } catch (e) {
      console.error('[OnboardingWizard] finish failed', e);
      const detail =
        e instanceof Error && e.message ? e.message : 'Unknown error while saving.';
      Alert.alert(
        'Could not save your answers',
        `${detail}\n\nIf this keeps happening, force-quit the app, sign in again, and retry.`
      );
    } finally {
      setFinishing(false);
    }
  }, [finishing, isEditMode, onComplete, profile]);

  const nutritionPreview = useMemo(() => {
    const draft = normalizeNutritionBodyDraft(profile.nutritionBodyProfile);
    if (!draft) return null;
    return deriveNutritionTargetsFromProfile({
      ...profile,
      nutritionBodyProfile: draft,
    });
  }, [profile]);

  const continueIssues = useMemo(() => getOnboardingContinueIssues(step, profile), [step, profile]);

  if (!visible) return null;

  const progress = ((step + 1) / ONBOARDING_TOTAL_STEPS) * 100;
  const overestimate = computeOverestimateRisk(profile);

  const canContinue = ((): boolean => {
    switch (step) {
      case 0:
        return profile.goalProfile.primaryGoal !== null;
      case 1:
        return true;
      case 2:
        return profile.experienceProfile.level !== null;
      case 3:
        return (
          profile.scheduleProfile.daysPerWeek !== null &&
          profile.scheduleProfile.sessionLengthMinutes !== null &&
          profile.scheduleProfile.bestTimeOfDay !== null &&
          profile.scheduleProfile.scheduleMode !== null &&
          isTrainingScheduleConfigured(profile.scheduleProfile)
        );
      case 4:
        return profile.equipmentProfile.access !== null;
      case 5:
        return true;
      case 6:
        return (
          profile.recoveryProfile.sleepQuality !== null &&
          profile.recoveryProfile.stressLevel !== null &&
          profile.recoveryProfile.dailyActivityLevel !== null
        );
      case 7:
        return profile.constraintProfile.hasInjuries !== null;
      case 8:
        return profile.adherenceProfile.challengeDial !== null;
      case 9:
        return normalizeNutritionBodyDraft(profile.nutritionBodyProfile) !== null;
      case 10:
        return isNutritionPreferencesAnswered(profile.nutritionPreferencesProfile);
      case 11:
        return true;
      default:
        return false;
    }
  })();

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <CoachPrompt
              title="What are you working toward right now?"
              subtitle="Pick the goal that matters most — we'll personalize everything around it."
            />
            <Text style={styles.requiredNote}>Required — choose one option below.</Text>
            <View style={styles.chipGrid}>
              {(Object.keys(PRIMARY_GOAL_LABELS) as PrimaryGoal[]).map((g) => (
                <OptionChip
                  key={g}
                  label={PRIMARY_GOAL_LABELS[g]}
                  selected={profile.goalProfile.primaryGoal === g}
                  onPress={() =>
                    setProfile((p) => ({
                      ...p,
                      goalProfile: { ...p.goalProfile, primaryGoal: g },
                    }))
                  }
                />
              ))}
            </View>
          </>
        );

      case 1:
        return (
          <>
            <CoachPrompt
              title="Why does this matter to you?"
              subtitle="Optional — it helps me coach you through the hard days."
            />
            <TextInput
              style={styles.textArea}
              placeholder="e.g. I want energy for my kids, or I'm training for a wedding..."
              placeholderTextColor={AppTheme.textFaint}
              value={profile.goalProfile.motivation ?? ''}
              onChangeText={(t) =>
                setProfile((p) => ({
                  ...p,
                  goalProfile: { ...p.goalProfile, motivation: t },
                }))
              }
              multiline
            />
            <Text style={styles.fieldLabel}>Do you have a timeline?</Text>
            <View style={styles.chipGrid}>
              {(
                [
                  ['none', 'No deadline'],
                  ['3_months', '3 months'],
                  ['6_months', '6 months'],
                  ['event_date', 'Specific event'],
                ] as const
              ).map(([val, label]) => (
                <OptionChip
                  key={val}
                  label={label}
                  selected={profile.goalProfile.timeline === val}
                  onPress={() =>
                    setProfile((p) => ({
                      ...p,
                      goalProfile: { ...p.goalProfile, timeline: val as TimelineOption },
                    }))
                  }
                />
              ))}
            </View>
            {profile.goalProfile.timeline === 'event_date' ? (
              <TextInput
                style={styles.input}
                placeholder="Event date or description (optional)"
                placeholderTextColor={AppTheme.textFaint}
                value={profile.goalProfile.eventDate ?? ''}
                onChangeText={(t) =>
                  setProfile((p) => ({
                    ...p,
                    goalProfile: { ...p.goalProfile, eventDate: t },
                  }))
                }
              />
            ) : null}
            <Text style={styles.fieldLabel}>Secondary goal (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Better posture, first pull-up..."
              placeholderTextColor={AppTheme.textFaint}
              value={profile.goalProfile.secondaryGoal ?? ''}
              onChangeText={(t) =>
                setProfile((p) => ({
                  ...p,
                  goalProfile: { ...p.goalProfile, secondaryGoal: t },
                }))
              }
            />
          </>
        );

      case 2:
        return (
          <>
            <CoachPrompt
              title="Where are you starting from?"
              subtitle="Be honest — the best plan is one matched to your real level."
            />
            <Text style={styles.requiredNote}>Required — choose one experience level.</Text>
            <View style={styles.chipGrid}>
              {(
                [
                  ['beginner', 'Beginner'],
                  ['intermediate', 'Intermediate'],
                  ['advanced', 'Advanced'],
                  ['competitive', 'Competitive athlete'],
                ] as const
              ).map(([val, label]) => (
                <OptionChip
                  key={val}
                  label={label}
                  selected={profile.experienceProfile.level === val}
                  onPress={() =>
                    setProfile((p) => ({
                      ...p,
                      experienceProfile: { ...p.experienceProfile, level: val as ExperienceLevel },
                    }))
                  }
                />
              ))}
            </View>
          </>
        );

      case 3:
        return (
          <>
            <CoachPrompt
              title="Let's talk about your real schedule."
              subtitle="Consistency beats perfection — pick the days and style you can actually follow."
            />
            <Text style={styles.requiredNote}>Required — days, schedule type, session length, and best time.</Text>
            <TrainingScheduleFields
              schedule={profile.scheduleProfile}
              onChange={(scheduleProfile) =>
                setProfile((p) => ({ ...p, scheduleProfile }))
              }
            />
            <Text style={styles.fieldLabel}>Session length (minutes)</Text>
            <View style={styles.chipRow}>
              {[20, 30, 45, 60, 75].map((m) => (
                <OptionChip
                  key={m}
                  label={String(m)}
                  selected={profile.scheduleProfile.sessionLengthMinutes === m}
                  onPress={() =>
                    setProfile((p) => ({
                      ...p,
                      scheduleProfile: { ...p.scheduleProfile, sessionLengthMinutes: m },
                    }))
                  }
                />
              ))}
            </View>
            <Text style={styles.fieldLabel}>Best time of day</Text>
            <View style={styles.chipGrid}>
              {(
                [
                  ['morning', 'Morning'],
                  ['midday', 'Midday'],
                  ['evening', 'Evening'],
                  ['flexible', 'Flexible'],
                ] as const
              ).map(([val, label]) => (
                <OptionChip
                  key={val}
                  label={label}
                  selected={profile.scheduleProfile.bestTimeOfDay === val}
                  onPress={() =>
                    setProfile((p) => ({
                      ...p,
                      scheduleProfile: { ...p.scheduleProfile, bestTimeOfDay: val as BestTimeOfDay },
                    }))
                  }
                />
              ))}
            </View>
          </>
        );

      case 4:
        return (
          <>
            <CoachPrompt title="What equipment can you use?" />
            <Text style={styles.requiredNote}>Required — choose one option.</Text>
            <View style={styles.chipGrid}>
              {(
                [
                  ['full_gym', 'Full gym'],
                  ['home_gym', 'Home gym'],
                  ['minimal', 'Minimal equipment'],
                  ['bodyweight', 'Bodyweight only'],
                ] as const
              ).map(([val, label]) => (
                <OptionChip
                  key={val}
                  label={label}
                  selected={profile.equipmentProfile.access === val}
                  onPress={() =>
                    setProfile((p) => ({
                      ...p,
                      equipmentProfile: { ...p.equipmentProfile, access: val as EquipmentAccess },
                    }))
                  }
                />
              ))}
            </View>
          </>
        );

      case 5:
        return (
          <>
            <CoachPrompt
              title="Any training preferences?"
              subtitle="Optional details help me pick exercises you'll actually enjoy."
            />
            <Text style={styles.fieldLabel}>Training style</Text>
            <View style={styles.chipGrid}>
              {(
                [
                  ['machines', 'Machines'],
                  ['free_weights', 'Free weights'],
                  ['mix', 'Mix of styles'],
                  ['bodyweight', 'Bodyweight'],
                ] as const
              ).map(([val, label]) => (
                <OptionChip
                  key={val}
                  label={label}
                  selected={profile.preferenceProfile.trainingStyle === val}
                  onPress={() =>
                    setProfile((p) => ({
                      ...p,
                      preferenceProfile: {
                        ...p.preferenceProfile,
                        trainingStyle: val as TrainingStylePreference,
                      },
                    }))
                  }
                />
              ))}
            </View>
            <Text style={styles.fieldLabel}>Exercises you enjoy (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. squats, rowing..."
              placeholderTextColor={AppTheme.textFaint}
              value={profile.preferenceProfile.likedExercises ?? ''}
              onChangeText={(t) =>
                setProfile((p) => ({
                  ...p,
                  preferenceProfile: { ...p.preferenceProfile, likedExercises: t },
                }))
              }
            />
            <Text style={styles.fieldLabel}>Exercises you dislike (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. burpees, running..."
              placeholderTextColor={AppTheme.textFaint}
              value={profile.preferenceProfile.dislikedExercises ?? ''}
              onChangeText={(t) =>
                setProfile((p) => ({
                  ...p,
                  preferenceProfile: { ...p.preferenceProfile, dislikedExercises: t },
                }))
              }
            />
          </>
        );

      case 6:
        return (
          <>
            <CoachPrompt title="How's recovery looking outside the gym?" />
            <Text style={styles.requiredNote}>Required — answer all three questions below.</Text>
            <Text style={styles.fieldLabel}>Sleep quality</Text>
            <View style={styles.chipRow}>
              {(['low', 'medium', 'high'] as RecoveryLevel[]).map((v) => (
                <OptionChip
                  key={v}
                  label={v.charAt(0).toUpperCase() + v.slice(1)}
                  selected={profile.recoveryProfile.sleepQuality === v}
                  onPress={() =>
                    setProfile((p) => ({
                      ...p,
                      recoveryProfile: { ...p.recoveryProfile, sleepQuality: v },
                    }))
                  }
                />
              ))}
            </View>
            <Text style={styles.fieldLabel}>Stress level</Text>
            <View style={styles.chipRow}>
              {(['low', 'medium', 'high'] as RecoveryLevel[]).map((v) => (
                <OptionChip
                  key={v}
                  label={v.charAt(0).toUpperCase() + v.slice(1)}
                  selected={profile.recoveryProfile.stressLevel === v}
                  onPress={() =>
                    setProfile((p) => ({
                      ...p,
                      recoveryProfile: { ...p.recoveryProfile, stressLevel: v },
                    }))
                  }
                />
              ))}
            </View>
            <Text style={styles.fieldLabel}>Daily activity</Text>
            <View style={styles.chipGrid}>
              {(
                [
                  ['sedentary', 'Mostly sedentary'],
                  ['light', 'Light activity'],
                  ['moderate', 'Moderate'],
                  ['active', 'Very active'],
                ] as const
              ).map(([val, label]) => (
                <OptionChip
                  key={val}
                  label={label}
                  selected={profile.recoveryProfile.dailyActivityLevel === val}
                  onPress={() =>
                    setProfile((p) => ({
                      ...p,
                      recoveryProfile: {
                        ...p.recoveryProfile,
                        dailyActivityLevel: val as DailyActivityLevel,
                      },
                    }))
                  }
                />
              ))}
            </View>
          </>
        );

      case 7:
        return (
          <>
            <CoachPrompt title="Any injuries or movements to avoid?" />
            <Text style={styles.requiredNote}>Required — tap No injuries or Yes, I have constraints.</Text>
            <View style={styles.chipRow}>
              <OptionChip
                label="No injuries"
                selected={profile.constraintProfile.hasInjuries === false}
                onPress={() =>
                  setProfile((p) => ({
                    ...p,
                    constraintProfile: {
                      ...p.constraintProfile,
                      hasInjuries: false,
                      injuryDetails: '',
                    },
                  }))
                }
              />
              <OptionChip
                label="Yes, I have constraints"
                selected={profile.constraintProfile.hasInjuries === true}
                onPress={() =>
                  setProfile((p) => ({
                    ...p,
                    constraintProfile: { ...p.constraintProfile, hasInjuries: true },
                  }))
                }
              />
            </View>
            {profile.constraintProfile.hasInjuries ? (
              <>
                <TextInput
                  style={styles.textArea}
                  placeholder="Describe injuries or limitations..."
                  placeholderTextColor={AppTheme.textFaint}
                  value={profile.constraintProfile.injuryDetails ?? ''}
                  onChangeText={(t) =>
                    setProfile((p) => ({
                      ...p,
                      constraintProfile: { ...p.constraintProfile, injuryDetails: t },
                    }))
                  }
                  multiline
                />
                <TextInput
                  style={styles.input}
                  placeholder="Movements to avoid (optional)"
                  placeholderTextColor={AppTheme.textFaint}
                  value={profile.constraintProfile.movementsToAvoid ?? ''}
                  onChangeText={(t) =>
                    setProfile((p) => ({
                      ...p,
                      constraintProfile: { ...p.constraintProfile, movementsToAvoid: t },
                    }))
                  }
                />
              </>
            ) : null}
          </>
        );

      case 8:
        return (
          <>
            <CoachPrompt
              title="On a realistic week, how hard should we push?"
              subtitle="This sets your Challenge Dial — we can adjust it anytime."
            />
            <Text style={styles.requiredNote}>Required — choose one challenge level.</Text>
            <View style={styles.chipGrid}>
              {(
                [
                  ['easy', 'Easy to follow'],
                  ['balanced', 'Balance challenge & consistency'],
                  ['maximum', 'Maximum results'],
                ] as const
              ).map(([val, label]) => (
                <OptionChip
                  key={val}
                  label={label}
                  selected={profile.adherenceProfile.challengeDial === val}
                  onPress={() =>
                    setProfile((p) => ({
                      ...p,
                      adherenceProfile: {
                        ...p.adherenceProfile,
                        challengeDial: val as ChallengeDial,
                      },
                    }))
                  }
                />
              ))}
            </View>
            {overestimate ? (
              <Text style={styles.warning}>
                Heads up: as a beginner, a lighter schedule may work better long-term. We can
                ramp up as you build consistency.
              </Text>
            ) : null}
          </>
        );

      case 9:
        return (
          <>
            <CoachPrompt
              title="Nutrition basics"
              subtitle="We use this to estimate your metabolism and set a starting calorie target. Your coach adapts as you log food and track progress."
            />
            <Text style={styles.requiredNote}>Required — sex, age, height, and weight below.</Text>
            <Text style={styles.fieldLabel}>Biological sex (for BMR estimate)</Text>
            <View style={styles.chipRow}>
              {(
                [
                  ['male', 'Male'],
                  ['female', 'Female'],
                ] as const
              ).map(([val, label]) => (
                <OptionChip
                  key={val}
                  label={label}
                  selected={profile.nutritionBodyProfile.sex === val}
                  onPress={() =>
                    setProfile((p) => ({
                      ...p,
                      nutritionBodyProfile: { ...p.nutritionBodyProfile, sex: val as SexForBmr },
                    }))
                  }
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Units</Text>
            <View style={styles.chipRow}>
              <OptionChip
                label="US (lbs, ft/in)"
                selected={profile.nutritionBodyProfile.unitPreference === 'imperial'}
                onPress={() =>
                  setProfile((p) => ({
                    ...p,
                    nutritionBodyProfile: {
                      ...p.nutritionBodyProfile,
                      unitPreference: 'imperial',
                      weightKg: parseWeightToKg(p.nutritionBodyProfile.weightDisplay, 'imperial'),
                    },
                  }))
                }
              />
              <OptionChip
                label="Metric (kg, cm)"
                selected={profile.nutritionBodyProfile.unitPreference === 'metric'}
                onPress={() =>
                  setProfile((p) => ({
                    ...p,
                    nutritionBodyProfile: {
                      ...p.nutritionBodyProfile,
                      unitPreference: 'metric',
                      weightKg: parseWeightToKg(p.nutritionBodyProfile.weightDisplay, 'metric'),
                    },
                  }))
                }
              />
            </View>

            <Text style={styles.fieldLabel}>Age</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 32"
              placeholderTextColor={AppTheme.textFaint}
              keyboardType="number-pad"
              value={profile.nutritionBodyProfile.ageDisplay ?? ''}
              onChangeText={(t) => {
                const digits = t.replace(/[^\d]/g, '');
                const age = parseAgeYears(digits);
                setProfile((p) => ({
                  ...p,
                  nutritionBodyProfile: {
                    ...p.nutritionBodyProfile,
                    ageDisplay: digits,
                    ageYears: age,
                  },
                }));
              }}
            />

            <Text style={styles.fieldLabel}>Height</Text>
            <TextInput
              style={styles.input}
              placeholder={
                profile.nutritionBodyProfile.unitPreference === 'metric'
                  ? 'e.g. 175 cm'
                  : "e.g. 5'10\" or 5 ft 10 in"
              }
              placeholderTextColor={AppTheme.textFaint}
              value={profile.nutritionBodyProfile.heightDisplay ?? ''}
              onChangeText={(t) =>
                setProfile((p) => ({
                  ...p,
                  nutritionBodyProfile: {
                    ...p.nutritionBodyProfile,
                    heightDisplay: t,
                    heightCm: parseHeightToCm(t),
                  },
                }))
              }
            />

            <Text style={styles.fieldLabel}>Current weight</Text>
            <TextInput
              style={styles.input}
              placeholder={
                profile.nutritionBodyProfile.unitPreference === 'metric'
                  ? 'e.g. 78 kg'
                  : 'e.g. 172 lbs'
              }
              placeholderTextColor={AppTheme.textFaint}
              keyboardType="decimal-pad"
              value={profile.nutritionBodyProfile.weightDisplay ?? ''}
              onChangeText={(t) =>
                setProfile((p) => ({
                  ...p,
                  nutritionBodyProfile: {
                    ...p.nutritionBodyProfile,
                    weightDisplay: t,
                    weightKg: parseWeightToKg(t, p.nutritionBodyProfile.unitPreference),
                  },
                }))
              }
            />

            {nutritionPreview ? (
              <View style={styles.nutritionPreviewCard}>
                <Text style={styles.nutritionPreviewTitle}>Starting nutrition targets</Text>
                <Text style={styles.nutritionPreviewLine}>
                  BMR ~{nutritionPreview.meta.bmr} kcal · maintenance ~{nutritionPreview.meta.tdee}{' '}
                  kcal
                </Text>
                <Text style={styles.nutritionPreviewLine}>
                  Daily target:{' '}
                  <Text style={styles.nutritionPreviewHighlight}>
                    {nutritionPreview.goals.calories} kcal
                  </Text>{' '}
                  · {nutritionPreview.goals.protein}g protein · {nutritionPreview.goals.carbs}g carbs
                  · {nutritionPreview.goals.fat}g fat
                </Text>
                <Text style={styles.nutritionPreviewHint}>
                  These update automatically when your food logs and weight trends show a plateau or
                  progress stall.
                </Text>
              </View>
            ) : null}
          </>
        );

      case 10:
        return (
          <>
            <CoachPrompt
              title="Nutrition setup"
              subtitle="About 30–60 seconds — allergies, goals, and how you want nutrition coaching."
            />
            <Text style={styles.requiredNote}>Required — answer every question in this section.</Text>
            <InitialNutritionSetupForm
              value={profile.nutritionPreferencesProfile}
              onChange={(nutritionPreferencesProfile) =>
                setProfile((p) => ({ ...p, nutritionPreferencesProfile }))
              }
            />
          </>
        );

      case 11:
        return (
          <>
            <CoachPrompt
              title="Does this look right?"
              subtitle="This is the foundation for your training plan."
            />
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Goal: </Text>
                {profile.goalProfile.primaryGoal
                  ? PRIMARY_GOAL_LABELS[profile.goalProfile.primaryGoal]
                  : '—'}
              </Text>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Schedule: </Text>
                {scheduleSummaryLine(profile.scheduleProfile)}
              </Text>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Experience: </Text>
                {profile.experienceProfile.level ?? '—'}
              </Text>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Equipment: </Text>
                {profile.equipmentProfile.access?.replace('_', ' ') ?? '—'}
              </Text>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Challenge dial: </Text>
                {profile.adherenceProfile.challengeDial ?? '—'}
              </Text>
              {nutritionPreview ? (
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>Nutrition target: </Text>
                  {nutritionPreview.goals.calories} kcal/day · {nutritionPreview.goals.protein}g
                  protein
                </Text>
              ) : null}
              {formatNutritionPreferencesSummary(profile.nutritionPreferencesProfile).map((line) => (
                <Text key={line} style={styles.summaryLine}>
                  {line}
                </Text>
              ))}
              {profile.constraintProfile.hasInjuries ? (
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>Constraints: </Text>
                  {profile.constraintProfile.injuryDetails || 'Yes'}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => setEditMode((e) => !e)} style={styles.editLink}>
              <Text style={styles.editLinkText}>
                {editMode ? 'Done editing' : 'Edit answers'}
              </Text>
            </TouchableOpacity>
            {editMode ? (
              <Text style={styles.promptSubtitle}>Use Back to jump to any step and update.</Text>
            ) : null}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <SafeAreaView style={styles.safe}>
        {!hydrated ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={AppTheme.accent} />
            <Text style={styles.loadingText}>Loading your answers…</Text>
          </View>
        ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.brand}>TYL AI</Text>
            <Text style={styles.stepLabel}>
              {isEditMode ? 'Update your plan' : 'Your coach setup'} · Step {step + 1} of{' '}
              {ONBOARDING_TOTAL_STEPS}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {renderStep()}
          </ScrollView>

          <View style={styles.footer}>
            {!canContinue ? <ContinueRequirementHint issues={continueIssues} /> : null}
            <View style={styles.footerRow}>
              {step > 0 ? (
                <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>
              ) : isEditMode && onCancel ? (
                <TouchableOpacity style={styles.backBtn} onPress={onCancel}>
                  <Text style={styles.backBtnText}>Cancel</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.footerSpacer} />
              )}
              {step < ONBOARDING_TOTAL_STEPS - 1 ? (
                <TouchableOpacity
                  style={[styles.nextBtn, !canContinue && styles.nextBtnDisabled]}
                  onPress={() => void goNext()}
                  disabled={!canContinue}
                >
                  <Text style={styles.nextBtnText}>Continue</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.nextBtn, finishing && styles.nextBtnDisabled]}
                  onPress={() => void finish()}
                  disabled={finishing}
                >
                  {finishing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.nextBtnText}>
                      {isEditMode ? 'Save changes' : 'Build my plan'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
            {(step === 1 || step === 5) && step < ONBOARDING_TOTAL_STEPS - 1 ? (
              <TouchableOpacity onPress={() => void goNext()} style={styles.skipBtn}>
                <Text style={styles.skipBtnText}>Skip optional fields</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200010,
    elevation: 200010,
    backgroundColor: AppTheme.bgScreen,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: AppTheme.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  brand: {
    color: AppTheme.accent,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
    marginBottom: 8,
  },
  stepLabel: {
    color: AppTheme.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  progressTrack: {
    height: 4,
    backgroundColor: AppTheme.inputBg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: AppTheme.accent,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  coachLabel: {
    color: AppTheme.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  promptBlock: { marginBottom: 24 },
  promptTitle: {
    color: AppTheme.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 8,
  },
  promptSubtitle: {
    color: AppTheme.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  requiredNote: {
    color: AppTheme.textFaint,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -12,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: AppTheme.radiusButton,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    backgroundColor: AppTheme.card,
  },
  chipSelected: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0,255,136,0.12)',
  },
  chipText: {
    color: AppTheme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: { color: AppTheme.accent },
  fieldLabel: {
    color: AppTheme.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 8,
  },
  input: {
    backgroundColor: AppTheme.inputBg,
    borderRadius: AppTheme.radiusButton,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    color: AppTheme.textPrimary,
    padding: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  textArea: {
    backgroundColor: AppTheme.inputBg,
    borderRadius: AppTheme.radiusButton,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    color: AppTheme.textPrimary,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  warning: {
    color: '#fbbf24',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 16,
  },
  summaryCard: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    padding: 18,
    borderWidth: 1,
    borderColor: AppTheme.border,
    gap: 10,
  },
  summaryLine: { color: AppTheme.textSecondary, fontSize: 15, lineHeight: 22 },
  summaryLabel: { color: AppTheme.textPrimary, fontWeight: '700' },
  editLink: { marginTop: 16 },
  editLinkText: { color: AppTheme.accent, fontWeight: '700', fontSize: 14 },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerSpacer: { flex: 1 },
  backBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: AppTheme.radiusButton,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  backBtnText: { color: AppTheme.textSecondary, fontWeight: '700' },
  nextBtn: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: AppTheme.radiusButton,
    backgroundColor: AppTheme.accent,
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { color: AppTheme.accentDark, fontWeight: '800', fontSize: 16 },
  skipBtn: { alignItems: 'center', marginTop: 12 },
  skipBtnText: { color: AppTheme.textFaint, fontSize: 13, fontWeight: '600' },
  nutritionPreviewCard: {
    marginTop: 20,
    backgroundColor: 'rgba(0,255,136,0.08)',
    borderRadius: AppTheme.radiusCard,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.25)',
    gap: 8,
  },
  nutritionPreviewTitle: {
    color: AppTheme.accent,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  nutritionPreviewLine: {
    color: AppTheme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  nutritionPreviewHighlight: {
    color: AppTheme.textPrimary,
    fontWeight: '800',
  },
  nutritionPreviewHint: {
    color: AppTheme.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});

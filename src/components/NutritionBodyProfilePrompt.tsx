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
import { AppTextInput as TextInput } from './AppTextInput';
import { AppTheme } from '../theme/appVisualTheme';
import {
  type NutritionBodyProfile,
  type SexForBmr,
  type CoachingProfile,
  createEmptyCoachingProfile,
} from '../types/coachingProfile';
import {
  loadCoachingProfile,
  dismissNutritionBodyProfilePrompt,
  saveNutritionBodyProfile,
} from '../services/CoachingProfileService';
import { deriveNutritionTargetsFromProfile, normalizeNutritionBodyDraft, getNutritionBodyValidationIssues } from '../utils/nutritionTargets';
import { parseAgeYears, parseHeightToCm, parseWeightToKg } from '../utils/bodyMetricsParse';

type Props = {
  visible: boolean;
  onComplete: () => void;
  onDismiss: () => void;
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
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * One-time prompt for users who finished onboarding before nutrition body fields were added.
 */
export default function NutritionBodyProfilePrompt({ visible, onComplete, onDismiss }: Props) {
  const [body, setBody] = useState<NutritionBodyProfile>(
    createEmptyCoachingProfile().nutritionBodyProfile
  );
  const [baseProfile, setBaseProfile] = useState<CoachingProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const profile = await loadCoachingProfile();
        if (!cancelled) {
          setBaseProfile(profile);
          const bodyProfile = profile.nutritionBodyProfile;
          setBody({
            ...createEmptyCoachingProfile().nutritionBodyProfile,
            ...bodyProfile,
            ageDisplay:
              bodyProfile.ageDisplay ??
              (bodyProfile.ageYears != null ? String(bodyProfile.ageYears) : undefined),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const nutritionPreview = useMemo(() => {
    const normalized = normalizeNutritionBodyDraft(body);
    if (!normalized || !baseProfile) return null;
    return deriveNutritionTargetsFromProfile({
      ...baseProfile,
      nutritionBodyProfile: normalized,
    });
  }, [body, baseProfile]);

  const validationIssues = useMemo(() => getNutritionBodyValidationIssues(body), [body]);

  const handleSave = useCallback(async () => {
    const issues = getNutritionBodyValidationIssues(body);
    if (issues.length > 0) {
      Alert.alert('Almost there', issues.join('\n'));
      return;
    }
    const normalized = normalizeNutritionBodyDraft(body);
    if (!normalized) {
      Alert.alert('Almost there', 'Please fill in sex, age, height, and weight to continue.');
      return;
    }
    setSaving(true);
    try {
      await saveNutritionBodyProfile(normalized);
      onComplete();
    } catch (e) {
      Alert.alert('Could not save', 'Please check your entries and try again.');
      console.warn('[NutritionBodyProfilePrompt] save failed', e);
    } finally {
      setSaving(false);
    }
  }, [body, onComplete]);

  const handleDismiss = useCallback(async () => {
    try {
      await dismissNutritionBodyProfilePrompt();
    } catch {
      /* best-effort */
    }
    onDismiss();
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityRole="alert">
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.card}>
            <Text style={styles.title}>Personalize your nutrition</Text>
            <Text style={styles.intro}>
              We added smarter calorie and macro targets based on your body stats. Add age, height,
              sex, and weight so your coach can estimate metabolism and adapt as you log food and
              track progress.
            </Text>

            {loading ? (
              <ActivityIndicator color={AppTheme.accent} style={styles.loader} />
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
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
                      selected={body.sex === val}
                      onPress={() => setBody((prev) => ({ ...prev, sex: val as SexForBmr }))}
                    />
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Units</Text>
                <View style={styles.chipRow}>
                  <OptionChip
                    label="US (lbs, ft/in)"
                    selected={body.unitPreference === 'imperial'}
                    onPress={() =>
                      setBody((prev) => ({
                        ...prev,
                        unitPreference: 'imperial',
                        weightKg: parseWeightToKg(prev.weightDisplay, 'imperial'),
                      }))
                    }
                  />
                  <OptionChip
                    label="Metric (kg, cm)"
                    selected={body.unitPreference === 'metric'}
                    onPress={() =>
                      setBody((prev) => ({
                        ...prev,
                        unitPreference: 'metric',
                        weightKg: parseWeightToKg(prev.weightDisplay, 'metric'),
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
                  value={body.ageDisplay ?? ''}
                  onChangeText={(t) => {
                    const digits = t.replace(/[^\d]/g, '');
                    const age = parseAgeYears(digits);
                    setBody((prev) => ({
                      ...prev,
                      ageDisplay: digits,
                      ageYears: age,
                    }));
                  }}
                />

                <Text style={styles.fieldLabel}>Height</Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    body.unitPreference === 'metric'
                      ? 'e.g. 175 cm'
                      : "e.g. 5'10\" or 5 ft 10 in"
                  }
                  placeholderTextColor={AppTheme.textFaint}
                  value={body.heightDisplay ?? ''}
                  onChangeText={(t) =>
                    setBody((prev) => ({
                      ...prev,
                      heightDisplay: t,
                      heightCm: parseHeightToCm(t),
                    }))
                  }
                />

                <Text style={styles.fieldLabel}>Current weight</Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    body.unitPreference === 'metric' ? 'e.g. 78 kg' : 'e.g. 172 lbs'
                  }
                  placeholderTextColor={AppTheme.textFaint}
                  keyboardType="decimal-pad"
                  value={body.weightDisplay ?? ''}
                  onChangeText={(t) =>
                    setBody((prev) => ({
                      ...prev,
                      weightDisplay: t,
                      weightKg: parseWeightToKg(t, prev.unitPreference),
                    }))
                  }
                />

                {validationIssues.length > 0 ? (
                  <View style={styles.validationCard}>
                    <Text style={styles.validationTitle}>Still needed:</Text>
                    {validationIssues.map((issue) => (
                      <Text key={issue} style={styles.validationLine}>
                        • {issue}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {nutritionPreview ? (
                  <View style={styles.previewCard}>
                    <Text style={styles.previewTitle}>Starting nutrition targets</Text>
                    <Text style={styles.previewLine}>
                      BMR ~{nutritionPreview.meta.bmr} kcal · maintenance ~{nutritionPreview.meta.tdee}{' '}
                      kcal
                    </Text>
                    <Text style={styles.previewLine}>
                      Daily goal ~{nutritionPreview.goals.calories} kcal ·{' '}
                      {Math.round(nutritionPreview.goals.protein)}g protein
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            )}

            <View style={styles.actionsWrap}>
              {!saving && validationIssues.length > 0 ? (
                <View style={styles.actionsHint}>
                  <Text style={styles.validationTitle}>To save, complete:</Text>
                  {validationIssues.map((issue) => (
                    <Text key={issue} style={styles.validationLine}>
                      • {issue}
                    </Text>
                  ))}
                </View>
              ) : null}
              <View style={styles.actions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => handleDismiss().catch(console.error)}
                disabled={saving}
              >
                <Text style={styles.secondaryBtnText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (saving || validationIssues.length > 0) && styles.primaryBtnDisabled,
                ]}
                onPress={() => handleSave().catch(console.error)}
                disabled={saving || validationIssues.length > 0}
              >
                {saving ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <Text style={styles.primaryBtnText}>Save & continue</Text>
                )}
              </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 199500,
    elevation: 199500,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    padding: 16,
  },
  safe: { flex: 1, justifyContent: 'center' },
  flex: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    padding: 20,
    maxHeight: '92%',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  intro: {
    color: '#bbb',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  loader: { marginVertical: 24 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 8 },
  fieldLabel: {
    color: AppTheme.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: '#222',
  },
  chipSelected: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(77, 171, 247, 0.15)',
  },
  chipText: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: AppTheme.accent },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  previewCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(77, 171, 247, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(77, 171, 247, 0.25)',
  },
  previewTitle: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 6,
  },
  previewLine: {
    color: '#bbb',
    fontSize: 13,
    lineHeight: 19,
  },
  validationCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 180, 77, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 180, 77, 0.35)',
  },
  validationTitle: {
    color: '#FFB84D',
    fontWeight: '700',
    marginBottom: 4,
    fontSize: 13,
  },
  validationLine: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 18,
  },
  actionsWrap: {
    marginTop: 16,
    gap: 10,
  },
  actionsHint: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 180, 77, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 180, 77, 0.35)',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#ccc',
    fontWeight: '600',
    fontSize: 15,
  },
  primaryBtn: {
    flex: 1.4,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: AppTheme.accent,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: {
    color: '#111',
    fontWeight: '800',
    fontSize: 15,
  },
});

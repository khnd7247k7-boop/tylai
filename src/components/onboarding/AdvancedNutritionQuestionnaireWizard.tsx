import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import {
  type AdvancedNutritionProfile,
  createEmptyAdvancedNutritionProfile,
  isAdvancedNutritionSetupComplete,
  getAdvancedNutritionSetupIssues,
} from '../../types/nutritionQuestionnaire';
import { formatWeightDisplay } from '../../utils/bodyMetricsParse';
import { loadCoachingProfile, saveAdvancedNutritionProfile } from '../../services/CoachingProfileService';
import AdvancedNutritionQuestionnaireForm from './AdvancedNutritionQuestionnaireForm';
import { ContinueRequirementHint } from './nutritionQuestionnaireUi';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function AdvancedNutritionQuestionnaireWizard({ visible, onClose, onSaved }: Props) {
  const [advanced, setAdvanced] = useState<AdvancedNutritionProfile>(createEmptyAdvancedNutritionProfile());
  const [currentWeightHint, setCurrentWeightHint] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const profile = await loadCoachingProfile();
      if (cancelled) return;
      const body = profile.nutritionBodyProfile;
      if (body.weightDisplay) {
        setCurrentWeightHint(body.weightDisplay);
      } else if (body.weightKg) {
        setCurrentWeightHint(formatWeightDisplay(body.weightKg, body.unitPreference));
      } else {
        setCurrentWeightHint(undefined);
      }
      setAdvanced({
        ...createEmptyAdvancedNutritionProfile(),
        ...profile.nutritionPreferencesProfile.advancedProfile,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const canSave = useMemo(() => isAdvancedNutritionSetupComplete(advanced), [advanced]);
  const continueIssues = useMemo(() => getAdvancedNutritionSetupIssues(advanced), [advanced]);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await saveAdvancedNutritionProfile({
        ...advanced,
        completedAt: new Date().toISOString(),
      });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.cancel}>Skip for now</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Meal plan setup</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave || saving || loading}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#5a8fd4" />
            ) : (
              <Text style={[styles.save, (!canSave || loading) && styles.saveDisabled]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#5a8fd4" />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.lead}>
              You chose complete meal plans — answer each required question below so we can build plans
              that fit your life.
            </Text>
            <AdvancedNutritionQuestionnaireForm
              value={advanced}
              onChange={setAdvanced}
              currentWeightHint={currentWeightHint}
            />
          </ScrollView>
        )}

        {!loading && !canSave ? (
          <View style={styles.footerHint}>
            <ContinueRequirementHint issues={continueIssues} />
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  cancel: {
    color: '#aaa',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  save: {
    color: '#5a8fd4',
    fontSize: 16,
    fontWeight: '600',
  },
  saveDisabled: {
    opacity: 0.4,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },
  lead: {
    color: '#aaa',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  footerHint: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
  },
});

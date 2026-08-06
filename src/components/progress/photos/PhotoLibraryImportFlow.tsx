/**
 * Import front / side / back progress photos from the device library.
 * Uses each photo's EXIF / library timestamp so the session lands on the
 * correct day in the progress timeline (not necessarily today).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { PermissionStatus } from 'expo-image-picker';
import { AppTheme } from '../../../theme/appVisualTheme';
import {
  PHOTO_POSES,
  PHOTO_POSE_INSTRUCTIONS,
  PHOTO_POSE_LABELS,
  type PhotoPose,
} from '../../../types/progressPhotos';
import {
  formatDisplayDate,
  getSessionForDate,
} from '../../../services/PhotoService';
import {
  resolveAssetCaptureDate,
  resolveSessionDateFromCaptures,
  uniqueCaptureDateKeys,
  type ResolvedPhotoCaptureTime,
} from '../../../utils/progressPhotoCaptureDate';

export type LibraryImportResult = {
  captures: Record<PhotoPose, string>;
  date: string;
  timestamp: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onComplete: (result: LibraryImportResult) => Promise<void>;
};

type PosePick = {
  uri: string;
  resolved: ResolvedPhotoCaptureTime;
};

function waitForModalDismiss(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, Platform.OS === 'ios' ? 450 : 80);
    });
  });
}

export default function PhotoLibraryImportFlow({
  visible,
  onClose,
  onComplete,
}: Props): React.ReactElement {
  const [stepIndex, setStepIndex] = useState(0);
  const [picks, setPicks] = useState<Partial<Record<PhotoPose, PosePick>>>({});
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Hide this RN Modal while the system photo picker is open (iOS presentation). */
  const [suppressModal, setSuppressModal] = useState(false);

  const currentPose = PHOTO_POSES[stepIndex];

  useEffect(() => {
    if (!visible) return;
    setStepIndex(0);
    setPicks({});
    setPicking(false);
    setSaving(false);
    setSuppressModal(false);
  }, [visible]);

  const pickedCount = useMemo(
    () => PHOTO_POSES.filter((p) => Boolean(picks[p])).length,
    [picks]
  );

  const ensureLibraryPermission = async (): Promise<boolean> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync(false);
    const ok =
      perm.granted ||
      perm.status === PermissionStatus.GRANTED ||
      perm.accessPrivileges === 'limited' ||
      perm.accessPrivileges === 'all';
    if (!ok) {
      Alert.alert(
        'Photo access needed',
        'Allow photo library access to upload past progress photos.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
    return ok;
  };

  const finalizeImport = useCallback(
    async (allPicks: Record<PhotoPose, PosePick>) => {
      const resolvedList = PHOTO_POSES.map((p) => allPicks[p].resolved);
      const sessionTime = resolveSessionDateFromCaptures(resolvedList);
      const dayKeys = uniqueCaptureDateKeys(resolvedList);
      const displayDate = formatDisplayDate(sessionTime.dateKey);
      const usedFallback = resolvedList.every((r) => r.source === 'fallback');

      const existing = await getSessionForDate(sessionTime.dateKey);
      const replaceNote = existing
        ? '\n\nThis will replace the progress photos already saved for that day.'
        : '';

      const multiDayNote =
        dayKeys.length > 1
          ? `\n\nThese photos look like they were taken on different days. We'll place the session on ${displayDate} (earliest photo).`
          : '';

      const stampNote = usedFallback
        ? '\n\nWe could not read a date from these photos, so they will be filed as today. You can still continue.'
        : `\n\nPlaced from the photo timestamp${
            sessionTime.source === 'exif' ? ' (EXIF)' : ''
          }.`;

      Alert.alert(
        'Add to timeline?',
        `Front, side, and back will be saved for ${displayDate}.${stampNote}${multiDayNote}${replaceNote}`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setStepIndex(PHOTO_POSES.length - 1);
            },
          },
          {
            text: existing ? 'Replace' : 'Save',
            onPress: async () => {
              setSaving(true);
              try {
                await onComplete({
                  captures: {
                    front: allPicks.front.uri,
                    side: allPicks.side.uri,
                    back: allPicks.back.uri,
                  },
                  date: sessionTime.dateKey,
                  timestamp: sessionTime.timestampIso,
                });
                onClose();
              } catch (e) {
                console.warn('[PhotoLibraryImportFlow] save failed', e);
                Alert.alert('Save failed', 'Could not import those photos. Please try again.');
              } finally {
                setSaving(false);
              }
            },
          },
        ]
      );
    },
    [onClose, onComplete]
  );

  const pickForCurrentPose = useCallback(async () => {
    if (picking || saving) return;
    setPicking(true);
    try {
      if (!(await ensureLibraryPermission())) return;

      setSuppressModal(true);
      await waitForModalDismiss();

      let asset: ImagePicker.ImagePickerAsset | undefined;
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 1,
          allowsEditing: false,
          allowsMultipleSelection: false,
          selectionLimit: 1,
          exif: true,
          ...(Platform.OS === 'android' ? { defaultTab: 'photos' as const } : {}),
        });

        asset = !result.canceled ? result.assets?.[0] : undefined;
        if (!asset?.uri && Platform.OS === 'android') {
          const pending = await ImagePicker.getPendingResultAsync();
          if (pending && 'assets' in pending) {
            asset = pending.assets?.[0];
          }
        }
      } finally {
        setSuppressModal(false);
      }

      if (!asset?.uri) return;

      const resolved = await resolveAssetCaptureDate(asset);
      const nextPicks = {
        ...picks,
        [currentPose]: { uri: asset.uri, resolved },
      } as Partial<Record<PhotoPose, PosePick>>;
      setPicks(nextPicks);

      if (stepIndex < PHOTO_POSES.length - 1) {
        setStepIndex(stepIndex + 1);
        return;
      }

      if (nextPicks.front && nextPicks.side && nextPicks.back) {
        await finalizeImport(nextPicks as Record<PhotoPose, PosePick>);
      }
    } catch (e) {
      setSuppressModal(false);
      console.warn('[PhotoLibraryImportFlow]', e);
      Alert.alert('Could not open photos', 'Try again, or take photos in-app instead.');
    } finally {
      setPicking(false);
    }
  }, [currentPose, finalizeImport, picking, picks, saving, stepIndex]);

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    } else {
      onClose();
    }
  };

  if (!visible) {
    return <></>;
  }

  return (
    <Modal
      visible={visible && !suppressModal}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />

        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn} hitSlop={12}>
            <Text style={styles.headerBtnText}>{stepIndex > 0 ? '‹ Back' : 'Cancel'}</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.stepLabel}>
              Step {stepIndex + 1} of {PHOTO_POSES.length}
            </Text>
            <Text style={styles.poseTitle}>{PHOTO_POSE_LABELS[currentPose]}</Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.body}>
          <Text style={styles.hero}>Upload from your camera roll</Text>
          <Text style={styles.bodyText}>
            Choose the {PHOTO_POSE_LABELS[currentPose].toLowerCase()} photo you already took.
            We read the photo&apos;s timestamp so it lands on the right day in your timeline.
          </Text>
          <Text style={styles.instruction}>{PHOTO_POSE_INSTRUCTIONS[currentPose]}</Text>

          {picks[currentPose]?.uri ? (
            <Image source={{ uri: picks[currentPose]!.uri }} style={styles.preview} />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Text style={styles.previewPlaceholderText}>No photo selected yet</Text>
            </View>
          )}

          {picks[currentPose]?.resolved ? (
            <Text style={styles.stampHint}>
              Detected: {formatDisplayDate(picks[currentPose]!.resolved.dateKey)}
              {picks[currentPose]!.resolved.source === 'fallback' ? ' (no date found)' : ''}
            </Text>
          ) : null}
        </View>

        <View style={styles.dots}>
          {PHOTO_POSES.map((pose, i) => (
            <View
              key={pose}
              style={[
                styles.dot,
                i === stepIndex && styles.dotActive,
                picks[pose] && styles.dotDone,
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, (picking || saving) && styles.primaryBtnDisabled]}
            onPress={pickForCurrentPose}
            disabled={picking || saving}
            activeOpacity={0.85}
          >
            {picking || saving ? (
              <ActivityIndicator color={AppTheme.accentDark} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {picks[currentPose]
                  ? stepIndex === PHOTO_POSES.length - 1 && pickedCount === PHOTO_POSES.length
                    ? 'Choose different photo'
                    : 'Replace photo'
                  : `Choose ${PHOTO_POSE_LABELS[currentPose].toLowerCase()} photo`}
              </Text>
            )}
          </TouchableOpacity>

          {picks[currentPose] && stepIndex < PHOTO_POSES.length - 1 ? (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setStepIndex(stepIndex + 1)}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Next pose</Text>
            </TouchableOpacity>
          ) : null}

          {picks.front && picks.side && picks.back && stepIndex === PHOTO_POSES.length - 1 ? (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => finalizeImport(picks as Record<PhotoPose, PosePick>)}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Review & save</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: { minWidth: 72 },
  headerBtnText: {
    color: AppTheme.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  headerCenter: { alignItems: 'center' },
  stepLabel: {
    color: AppTheme.textFaint,
    fontSize: 12,
    fontWeight: '600',
  },
  poseTitle: {
    color: AppTheme.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  hero: {
    color: AppTheme.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  bodyText: {
    color: AppTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  instruction: {
    color: AppTheme.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  preview: {
    width: '100%',
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#000',
  },
  previewPlaceholder: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlaceholderText: {
    color: AppTheme.textFaint,
    fontSize: 14,
  },
  stampHint: {
    marginTop: 10,
    color: AppTheme.accent,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppTheme.border,
  },
  dotActive: {
    backgroundColor: AppTheme.textMuted,
    transform: [{ scale: 1.15 }],
  },
  dotDone: {
    backgroundColor: AppTheme.accent,
  },
  actions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: AppTheme.radiusPill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    color: AppTheme.accentDark,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    borderRadius: AppTheme.radiusPill,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.card,
  },
  secondaryBtnText: {
    color: AppTheme.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});

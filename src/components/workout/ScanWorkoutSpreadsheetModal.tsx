/**
 * Capture / upload a workout spreadsheet photo → vision parse → Review & Edit → apply.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { PermissionStatus } from 'expo-image-picker';
import { AppTextInput as TextInput } from '../AppTextInput';
import { AppTheme } from '../../theme/appVisualTheme';
import { useSubscription } from '../../context/SubscriptionContext';
import { PremiumRequiredError } from '../../utils/subscription';
import { compressImageForVision } from '../../utils/compressImageForVision';
import { parseWorkoutSpreadsheetImage } from '../../services/workoutSpreadsheetParseService';
import { matchedRoutineToEditableProgram } from '../../utils/parsedWorkoutToPlan';
import type {
  ExerciseMatchConfidence,
  MatchedSpreadsheetExercise,
  MatchedSpreadsheetRoutine,
} from '../../types/workoutSpreadsheetParse';
import type { EditableSavedProgram } from '../../utils/customWorkoutPlan';
import ExerciseNamePickerModal from './ExerciseNamePickerModal';
import { getExerciseData } from '../../data/exerciseDatabase';

type Phase = 'capture' | 'camera' | 'analyzing' | 'review';

/** Prefer in-modal expo-camera — UIImagePicker over RN Modal often fails on iOS. */
let CameraView: React.ComponentType<any> | null = null;
let CameraModule: { requestCameraPermissionsAsync: () => Promise<{ status: string }> } | null =
  null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExpoCamera = require('expo-camera');
    CameraView = ExpoCamera.CameraView ?? null;
    CameraModule = ExpoCamera.Camera ?? null;
  } catch {
    CameraView = null;
    CameraModule = null;
  }
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Apply parsed program into Build Your Own Workout state. */
  onApply: (program: EditableSavedProgram) => void;
};

function confidenceLabel(c: ExerciseMatchConfidence): string {
  if (c === 'high') return 'Matched';
  if (c === 'medium') return 'Likely match';
  return 'Unmapped';
}

function confidenceColor(c: ExerciseMatchConfidence): string {
  if (c === 'high') return AppTheme.accent;
  if (c === 'medium') return '#FBBF24';
  return '#F87171';
}

function cloneRoutine(r: MatchedSpreadsheetRoutine): MatchedSpreadsheetRoutine {
  return {
    name: r.name,
    notes: r.notes,
    days: r.days.map((d) => ({
      name: d.name,
      exercises: d.exercises.map((e) => ({ ...e })),
    })),
  };
}

export default function ScanWorkoutSpreadsheetModal({
  visible,
  onClose,
  onApply,
}: Props): React.ReactElement {
  const { isPremium, presentUpgrade } = useSubscription();
  const cameraRef = useRef<{ takePictureAsync: (opts?: object) => Promise<{ uri: string }> }>(
    null
  );
  const [phase, setPhase] = useState<Phase>('capture');
  const [statusLine, setStatusLine] = useState(
    'Photograph a spreadsheet, printed plan, or handwritten workout log.'
  );
  const [routine, setRoutine] = useState<MatchedSpreadsheetRoutine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<{ dayIndex: number; exIndex: number } | null>(
    null
  );
  /** Hide this RN Modal before system ImagePicker so iOS can present the camera/library. */
  const [suppressModal, setSuppressModal] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPhase('capture');
    setRoutine(null);
    setError(null);
    setPickerTarget(null);
    setSuppressModal(false);
    setCapturing(false);
    setStatusLine('Photograph a spreadsheet, printed plan, or handwritten workout log.');
  }, [visible]);

  const waitForModalDismiss = () =>
    new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        setTimeout(resolve, Platform.OS === 'ios' ? 450 : 80);
      });
    });

  const unmappedCount = useMemo(() => {
    if (!routine) return 0;
    return routine.days.reduce(
      (n, d) => n + d.exercises.filter((e) => e.matchConfidence === 'unmapped').length,
      0
    );
  }, [routine]);

  const runParse = useCallback(
    async (uri: string) => {
      if (!isPremium) {
        presentUpgrade();
        return;
      }
      setError(null);
      setPhase('analyzing');
      setStatusLine('Reading your program…');
      try {
        const compressed = await compressImageForVision(uri);
        const matched = await parseWorkoutSpreadsheetImage({
          base64: compressed.base64,
          mimeType: compressed.mimeType,
        });
        setRoutine(cloneRoutine(matched));
        setPhase('review');
        setStatusLine('Review exercises, then save into your builder.');
      } catch (e) {
        if (e instanceof PremiumRequiredError) {
          presentUpgrade();
          setPhase('capture');
          return;
        }
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setPhase('capture');
        setStatusLine(
          'Could not read that photo. Use bright, even light and fill the frame with the writing.'
        );
      }
    },
    [isPremium, presentUpgrade]
  );

  const pickFromLibrary = useCallback(async () => {
    if (!isPremium) {
      presentUpgrade();
      return;
    }

    // Dismiss our RN Modal first — the system photo library often fails to present on top of it (iOS).
    setSuppressModal(true);
    await waitForModalDismiss();

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync(false);
      const hasLibraryAccess =
        perm.granted ||
        perm.status === PermissionStatus.GRANTED ||
        perm.accessPrivileges === 'limited' ||
        perm.accessPrivileges === 'all';

      if (!hasLibraryAccess) {
        setSuppressModal(false);
        Alert.alert(
          'Photo access needed',
          'Allow photo library access so you can pick a spreadsheet or handwritten workout photo from your camera roll.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      // Opens the device Photos / gallery picker (current library contents).
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
        allowsMultipleSelection: false,
        selectionLimit: 1,
        ...(Platform.OS === 'android' ? { defaultTab: 'photos' as const } : {}),
      });

      setSuppressModal(false);

      let uri = !result.canceled ? result.assets?.[0]?.uri : undefined;

      // Android can destroy the activity while the picker is open — recover the selection.
      if (!uri && Platform.OS === 'android') {
        const pending = await ImagePicker.getPendingResultAsync();
        if (pending && 'assets' in pending && pending.assets?.[0]?.uri) {
          uri = pending.assets[0].uri;
        }
      }

      if (!uri) return;
      await runParse(uri);
    } catch (e) {
      setSuppressModal(false);
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || 'Could not open the photo library.');
      setPhase('capture');
    }
  }, [isPremium, presentUpgrade, runParse]);

  const takePhotoViaImagePicker = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Camera access needed',
        'Allow camera access to photograph spreadsheets or handwritten workout logs.'
      );
      return;
    }

    setSuppressModal(true);
    await waitForModalDismiss();
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });
      setSuppressModal(false);
      if (result.canceled || !result.assets?.[0]?.uri) return;
      await runParse(result.assets[0].uri);
    } catch (e) {
      setSuppressModal(false);
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || 'Could not open the camera.');
      setPhase('capture');
    }
  }, [runParse]);

  const takePhoto = useCallback(async () => {
    if (!isPremium) {
      presentUpgrade();
      return;
    }

    // In-modal camera (same approach as progress photos) — reliable on device.
    if (CameraView && CameraModule) {
      const { status } = await CameraModule.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera access needed',
          'Allow camera access to photograph spreadsheets or handwritten workout logs.'
        );
        return;
      }
      setError(null);
      setPhase('camera');
      return;
    }

    await takePhotoViaImagePicker();
  }, [isPremium, presentUpgrade, takePhotoViaImagePicker]);

  const captureFromInlineCamera = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: Platform.OS === 'android',
      });
      if (!photo?.uri) throw new Error('No photo URI returned');
      await runParse(photo.uri);
    } catch (e) {
      console.warn('[ScanWorkout] capture failed', e);
      Alert.alert('Capture failed', 'Could not take the photo. Please try again.');
      setPhase('capture');
    } finally {
      setCapturing(false);
    }
  }, [capturing, runParse]);

  const updateProgramName = (name: string) => {
    setRoutine((prev) => (prev ? { ...prev, name } : prev));
  };

  const updateDayName = (dayIndex: number, name: string) => {
    setRoutine((prev) => {
      if (!prev) return prev;
      const days = [...prev.days];
      days[dayIndex] = { ...days[dayIndex], name };
      return { ...prev, days };
    });
  };

  const updateExercise = (
    dayIndex: number,
    exIndex: number,
    patch: Partial<MatchedSpreadsheetExercise>
  ) => {
    setRoutine((prev) => {
      if (!prev) return prev;
      const days = [...prev.days];
      const exercises = [...days[dayIndex].exercises];
      exercises[exIndex] = { ...exercises[exIndex], ...patch };
      days[dayIndex] = { ...days[dayIndex], exercises };
      return { ...prev, days };
    });
  };

  /** Apply a corrected exercise name (catalog pick or custom). */
  const applyExerciseName = (dayIndex: number, exIndex: number, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const inCatalog = Boolean(getExerciseData(trimmed));
    updateExercise(dayIndex, exIndex, {
      matchedName: trimmed,
      matchConfidence: inCatalog ? 'high' : 'unmapped',
      matchScore: inCatalog ? 1 : 0,
    });
  };

  const removeExercise = (dayIndex: number, exIndex: number) => {
    setRoutine((prev) => {
      if (!prev) return prev;
      const days = [...prev.days];
      const exercises = days[dayIndex].exercises.filter((_, i) => i !== exIndex);
      days[dayIndex] = { ...days[dayIndex], exercises };
      return { ...prev, days: days.filter((d) => d.exercises.length > 0) };
    });
  };

  const handleSaveRoutine = () => {
    if (!routine || !routine.days.some((d) => d.exercises.length > 0)) {
      Alert.alert('Nothing to save', 'Add at least one exercise before saving.');
      return;
    }
    const program = matchedRoutineToEditableProgram(routine);
    onApply(program);
    onClose();
  };

  return (
    <Modal
      visible={visible && !suppressModal}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => {
              if (phase === 'camera') {
                setPhase('capture');
                return;
              }
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={phase === 'camera' ? 'Cancel camera' : 'Close'}
          >
            <Text style={styles.headerBtnText}>{phase === 'camera' ? 'Back' : 'Close'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Workout</Text>
          <View style={styles.headerBtn} />
        </View>

        {phase === 'analyzing' ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={AppTheme.accent} />
            <Text style={styles.status}>{statusLine}</Text>
          </View>
        ) : null}

        {phase === 'camera' && CameraView ? (
          <View style={styles.cameraBody}>
            <View style={styles.cameraPreviewWrap}>
              <CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" />
              <View style={styles.cameraGuide} pointerEvents="none">
                <Text style={styles.cameraGuideText}>
                  Fill the frame with the spreadsheet or handwritten log. Use bright, even light.
                </Text>
              </View>
            </View>
            <View style={styles.cameraActions}>
              <TouchableOpacity
                style={[styles.captureShutter, capturing && styles.captureShutterDisabled]}
                onPress={captureFromInlineCamera}
                disabled={capturing}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Take photo"
              >
                {capturing ? (
                  <ActivityIndicator color={AppTheme.accentDark} />
                ) : (
                  <View style={styles.captureShutterInner} />
                )}
              </TouchableOpacity>
              <Text style={styles.cameraHint}>Tap to capture</Text>
            </View>
          </View>
        ) : null}

        {phase === 'capture' ? (
          <View style={styles.captureBody}>
            <Text style={styles.heroTitle}>Photo → workout</Text>
            <Text style={styles.heroBody}>
              Snap a spreadsheet, whiteboard, printed plan, or handwritten pen-and-paper log. We read the
              writing, extract exercises, sets, and reps, and drop them into Build Your Own Workout.
            </Text>
            {!isPremium ? (
              <View style={styles.premiumCard}>
                <Text style={styles.premiumBadge}>PREMIUM</Text>
                <Text style={styles.premiumBody}>
                  Spreadsheet scanning uses AI vision and is included with TYL Premium.
                </Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={presentUpgrade} activeOpacity={0.88}>
                  <Text style={styles.primaryBtnText}>View Premium</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.captureActions}>
                <TouchableOpacity style={styles.primaryBtn} onPress={takePhoto} activeOpacity={0.88}>
                  <Text style={styles.primaryBtnText}>Take photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={pickFromLibrary} activeOpacity={0.88}>
                  <Text style={styles.secondaryBtnText}>Choose from library</Text>
                </TouchableOpacity>
              </View>
            )}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Text style={styles.hint}>{statusLine}</Text>
          </View>
        ) : null}

        {phase === 'review' && routine ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.reviewContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sectionLabel}>Program name</Text>
              <TextInput
                style={styles.input}
                value={routine.name}
                onChangeText={updateProgramName}
                placeholder="Program name"
                placeholderTextColor={AppTheme.textFaint}
                autoCapitalize="words"
              />

              {unmappedCount > 0 ? (
                <Text style={styles.warnBanner}>
                  {unmappedCount} exercise{unmappedCount === 1 ? '' : 's'} could not be matched — tap
                  Change or a suggestion chip to fix.
                </Text>
              ) : (
                <Text style={styles.okBanner}>
                  All exercises matched. Tap Change on any row if a name looks wrong.
                </Text>
              )}

              {routine.days.map((day, dayIndex) => (
                <View key={`day-${dayIndex}`} style={styles.dayCard}>
                  <Text style={styles.sectionLabel}>Day {dayIndex + 1}</Text>
                  <TextInput
                    style={styles.input}
                    value={day.name}
                    onChangeText={(t) => updateDayName(dayIndex, t)}
                    placeholder="Day name"
                    placeholderTextColor={AppTheme.textFaint}
                    autoCapitalize="words"
                  />

                  {day.exercises.map((ex, exIndex) => {
                    const altSuggestions = (ex.suggestions ?? [])
                      .filter(
                        (n) => n.trim() && n.toLowerCase() !== ex.matchedName.toLowerCase()
                      )
                      .slice(0, 3);
                    const needsAttention = ex.matchConfidence !== 'high';

                    return (
                      <View
                        key={`ex-${dayIndex}-${exIndex}`}
                        style={[styles.exCard, needsAttention && styles.exCardWarn]}
                      >
                        <View style={styles.exHeader}>
                          <View
                            style={[
                              styles.confPill,
                              { borderColor: confidenceColor(ex.matchConfidence) },
                            ]}
                          >
                            <Text
                              style={[
                                styles.confPillText,
                                { color: confidenceColor(ex.matchConfidence) },
                              ]}
                            >
                              {confidenceLabel(ex.matchConfidence)}
                            </Text>
                          </View>
                          <Pressable onPress={() => removeExercise(dayIndex, exIndex)} hitSlop={8}>
                            <Text style={styles.removeText}>Remove</Text>
                          </Pressable>
                        </View>

                        {ex.name.trim() &&
                        ex.name.trim().toLowerCase() !== ex.matchedName.trim().toLowerCase() ? (
                          <Text style={styles.rawName} numberOfLines={2}>
                            From photo: {ex.name}
                          </Text>
                        ) : null}

                        <Text style={styles.fieldLabel}>Exercise</Text>
                        <TouchableOpacity
                          style={styles.nameRow}
                          onPress={() => setPickerTarget({ dayIndex, exIndex })}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={`Change exercise ${ex.matchedName}`}
                        >
                          <Text style={styles.nameRowText} numberOfLines={2}>
                            {ex.matchedName || 'Tap to choose exercise'}
                          </Text>
                          <Text style={styles.changeLink}>Change</Text>
                        </TouchableOpacity>

                        {altSuggestions.length > 0 ? (
                          <View style={styles.suggestBlock}>
                            <Text style={styles.suggestLabel}>
                              {needsAttention ? 'Did you mean…' : 'Other matches'}
                            </Text>
                            <View style={styles.suggestRow}>
                              {altSuggestions.map((name) => (
                                <Pressable
                                  key={name}
                                  style={styles.suggestChip}
                                  onPress={() => applyExerciseName(dayIndex, exIndex, name)}
                                >
                                  <Text style={styles.suggestChipText} numberOfLines={1}>
                                    {name}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        ) : null}

                        <View style={styles.row}>
                          <View style={styles.col}>
                            <Text style={styles.fieldLabel}>Sets</Text>
                            <TextInput
                              style={styles.input}
                              value={ex.sets != null ? String(ex.sets) : ''}
                              onChangeText={(t) => {
                                const n = parseInt(t.replace(/[^\d]/g, ''), 10);
                                updateExercise(dayIndex, exIndex, {
                                  sets: Number.isFinite(n) ? n : null,
                                });
                              }}
                              keyboardType="number-pad"
                              placeholder="3"
                              placeholderTextColor={AppTheme.textFaint}
                            />
                          </View>
                          <View style={styles.col}>
                            <Text style={styles.fieldLabel}>Reps</Text>
                            <TextInput
                              style={styles.input}
                              value={ex.reps ?? ''}
                              onChangeText={(t) =>
                                updateExercise(dayIndex, exIndex, { reps: t || null })
                              }
                              placeholder="8-12"
                              placeholderTextColor={AppTheme.textFaint}
                            />
                          </View>
                        </View>

                        <View style={styles.row}>
                          <View style={styles.col}>
                            <Text style={styles.fieldLabel}>Weight</Text>
                            <TextInput
                              style={styles.input}
                              value={ex.weight != null ? String(ex.weight) : ''}
                              onChangeText={(t) => {
                                const n = parseFloat(t.replace(/[^\d.]/g, ''));
                                updateExercise(dayIndex, exIndex, {
                                  weight: Number.isFinite(n) ? n : null,
                                });
                              }}
                              keyboardType="decimal-pad"
                              placeholder="—"
                              placeholderTextColor={AppTheme.textFaint}
                            />
                          </View>
                          <View style={styles.col}>
                            <Text style={styles.fieldLabel}>Rest (sec)</Text>
                            <TextInput
                              style={styles.input}
                              value={ex.restSeconds != null ? String(ex.restSeconds) : ''}
                              onChangeText={(t) => {
                                const n = parseInt(t.replace(/[^\d]/g, ''), 10);
                                updateExercise(dayIndex, exIndex, {
                                  restSeconds: Number.isFinite(n) ? n : null,
                                });
                              }}
                              keyboardType="number-pad"
                              placeholder="60"
                              placeholderTextColor={AppTheme.textFaint}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}

              <TouchableOpacity
                style={[styles.secondaryBtn, styles.retakeBtn]}
                onPress={() => {
                  setRoutine(null);
                  setError(null);
                  setPhase('capture');
                  setStatusLine(
                    'Photograph a spreadsheet, printed plan, or handwritten workout log.'
                  );
                }}
              >
                <Text style={styles.secondaryBtnText}>Scan another photo</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveRoutine} activeOpacity={0.88}>
                <Text style={styles.primaryBtnText}>Save Routine</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : null}

        {pickerTarget && routine?.days[pickerTarget.dayIndex]?.exercises[pickerTarget.exIndex] ? (
          <ExerciseNamePickerModal
            visible
            rawName={routine.days[pickerTarget.dayIndex].exercises[pickerTarget.exIndex].name}
            currentName={
              routine.days[pickerTarget.dayIndex].exercises[pickerTarget.exIndex].matchedName
            }
            suggestions={
              routine.days[pickerTarget.dayIndex].exercises[pickerTarget.exIndex].suggestions
            }
            onClose={() => setPickerTarget(null)}
            onSelect={(name) => {
              applyExerciseName(pickerTarget.dayIndex, pickerTarget.exIndex, name);
              setPickerTarget(null);
            }}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  headerBtn: { minWidth: 64 },
  headerBtnText: { color: AppTheme.accent, fontSize: 16, fontWeight: '600' },
  headerTitle: {
    color: AppTheme.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  status: {
    color: AppTheme.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  captureBody: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  heroTitle: {
    color: AppTheme.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 10,
  },
  heroBody: {
    color: AppTheme.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  captureActions: { gap: 12 },
  cameraBody: {
    flex: 1,
  },
  cameraPreviewWrap: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraGuide: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cameraGuideText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  cameraActions: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  captureShutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: AppTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  captureShutterDisabled: {
    opacity: 0.7,
  },
  captureShutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: AppTheme.accentDark,
  },
  cameraHint: {
    color: AppTheme.textMuted,
    fontSize: 13,
  },
  premiumCard: {
    backgroundColor: AppTheme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 16,
    marginBottom: 16,
  },
  premiumBadge: {
    alignSelf: 'flex-start',
    color: AppTheme.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  premiumBody: {
    color: AppTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  primaryBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: AppTheme.radiusButton,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: AppTheme.accentDark,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    borderRadius: AppTheme.radiusButton,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.card,
  },
  secondaryBtnText: {
    color: AppTheme.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    color: '#F87171',
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    color: AppTheme.textFaint,
    fontSize: 13,
    marginTop: 20,
    lineHeight: 18,
  },
  reviewContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionLabel: {
    color: AppTheme.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: AppTheme.textPrimary,
    fontSize: 15,
    marginBottom: 8,
  },
  warnBanner: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderRadius: 10,
    padding: 12,
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
    marginVertical: 8,
  },
  okBanner: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 10,
    padding: 12,
    color: AppTheme.accent,
    fontSize: 13,
    marginVertical: 8,
  },
  dayCard: {
    marginTop: 12,
    marginBottom: 8,
  },
  exCard: {
    backgroundColor: AppTheme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 12,
    marginTop: 10,
  },
  exCardWarn: {
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  exHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  confPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  removeText: {
    color: AppTheme.textFaint,
    fontSize: 13,
    fontWeight: '600',
  },
  rawName: {
    color: AppTheme.textFaint,
    fontSize: 12,
    marginBottom: 6,
  },
  fieldLabel: {
    color: AppTheme.textFaint,
    fontSize: 12,
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  nameRowText: {
    flex: 1,
    color: AppTheme.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  changeLink: {
    color: AppTheme.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  suggestBlock: {
    marginBottom: 10,
  },
  suggestLabel: {
    color: AppTheme.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  suggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestChip: {
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: '#121212',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  suggestChipText: {
    color: AppTheme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: { flex: 1 },
  retakeBtn: { marginTop: 16 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
    backgroundColor: AppTheme.bgElevated,
  },
});

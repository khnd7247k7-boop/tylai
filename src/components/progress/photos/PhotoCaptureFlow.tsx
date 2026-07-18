import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppTheme } from '../../../theme/appVisualTheme';
import {
  PHOTO_POSES,
  PHOTO_POSE_INSTRUCTIONS,
  PHOTO_POSE_LABELS,
  type PhotoPose,
} from '../../../types/progressPhotos';

type CameraFacing = 'front' | 'back';

/** Front/side body shots: rear camera. Back pose: selfie camera. */
function defaultFacingForPose(pose: PhotoPose): CameraFacing {
  return pose === 'back' ? 'front' : 'back';
}

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

interface PhotoCaptureFlowProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (captures: Record<PhotoPose, string>) => Promise<void>;
  /** When set, pre-fill retake flow for an existing session date. */
  retake?: boolean;
}

export default function PhotoCaptureFlow({
  visible,
  onClose,
  onComplete,
  retake = false,
}: PhotoCaptureFlowProps): React.ReactElement {
  const cameraRef = useRef<{ takePictureAsync: (opts?: object) => Promise<{ uri: string }> }>(
    null
  );
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [captures, setCaptures] = useState<Partial<Record<PhotoPose, string>>>({});
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>(() =>
    defaultFacingForPose(PHOTO_POSES[0])
  );

  const currentPose = PHOTO_POSES[stepIndex];

  useEffect(() => {
    if (!visible) return;

    setStepIndex(0);
    setCaptures({});
    setCapturing(false);
    setSaving(false);
    setCameraFacing(defaultFacingForPose(PHOTO_POSES[0]));

    const requestPermission = async () => {
      if (!CameraModule) {
        setHasPermission(false);
        return;
      }
      const { status } = await CameraModule.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    requestPermission();
  }, [visible, retake]);

  // Apply pose defaults when the step changes (keep manual flips until then).
  useEffect(() => {
    if (!visible) return;
    setCameraFacing(defaultFacingForPose(currentPose));
  }, [currentPose, visible]);

  const flipCamera = () => {
    setCameraFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  };

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.72,
        skipProcessing: Platform.OS === 'android',
      });
      if (!photo?.uri) throw new Error('No photo URI returned');

      const nextCaptures = { ...captures, [currentPose]: photo.uri };
      setCaptures(nextCaptures);

      if (stepIndex < PHOTO_POSES.length - 1) {
        setStepIndex(stepIndex + 1);
      } else {
        setSaving(true);
        await onComplete(nextCaptures as Record<PhotoPose, string>);
        onClose();
      }
    } catch (e) {
      Alert.alert('Capture failed', 'Could not take the photo. Please try again.');
      console.warn('[PhotoCaptureFlow]', e);
    } finally {
      setCapturing(false);
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    } else {
      onClose();
    }
  };

  const cameraReady = Boolean(CameraView && hasPermission);

  if (!visible) {
    return <></>;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
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

        <View style={styles.previewWrap}>
          {!CameraView || hasPermission === false ? (
            <View style={styles.permissionBlock}>
              <Text style={styles.permissionTitle}>Camera access needed</Text>
              <Text style={styles.permissionBody}>
                {Platform.OS === 'web'
                  ? 'Progress photos are available in the iOS and Android app.'
                  : 'Enable camera permission in Settings to capture progress photos.'}
              </Text>
            </View>
          ) : hasPermission === null ? (
            <ActivityIndicator size="large" color={AppTheme.accent} />
          ) : (
            <>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing={cameraFacing}
                mirror={cameraFacing === 'front'}
              />
              <TouchableOpacity
                style={styles.flipOverlayBtn}
                onPress={flipCamera}
                disabled={capturing || saving}
                accessibilityRole="button"
                accessibilityLabel={
                  cameraFacing === 'back' ? 'Switch to front camera' : 'Switch to rear camera'
                }
                hitSlop={8}
                activeOpacity={0.85}
              >
                <Text style={styles.flipOverlayIcon}>⟳</Text>
                <Text style={styles.flipOverlayLabel}>
                  {cameraFacing === 'back' ? 'Front' : 'Rear'}
                </Text>
              </TouchableOpacity>
              <View style={styles.guideFooter} pointerEvents="none">
                <Text style={styles.instruction}>{PHOTO_POSE_INSTRUCTIONS[currentPose]}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.dots}>
          {PHOTO_POSES.map((pose, i) => (
            <View
              key={pose}
              style={[
                styles.dot,
                i === stepIndex && styles.dotActive,
                captures[pose] && styles.dotDone,
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.flipSideBtn, !cameraReady && styles.captureBtnDisabled]}
              onPress={flipCamera}
              disabled={!cameraReady || capturing || saving}
              accessibilityRole="button"
              accessibilityLabel="Switch camera"
              activeOpacity={0.85}
            >
              <Text style={styles.flipSideIcon}>⟳</Text>
              <Text style={styles.flipSideLabel}>Flip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.captureBtn, (capturing || saving) && styles.captureBtnDisabled]}
              onPress={handleCapture}
              disabled={!hasPermission || capturing || saving || !CameraView}
              activeOpacity={0.85}
            >
              {capturing || saving ? (
                <ActivityIndicator color={AppTheme.accentDark} />
              ) : (
                <View style={styles.captureInner} />
              )}
            </TouchableOpacity>

            {/* Spacer so the shutter stays centered */}
            <View style={styles.flipSideBtn} />
          </View>
          <Text style={styles.captureHint}>
            {saving
              ? 'Saving session…'
              : `Capture ${PHOTO_POSE_LABELS[currentPose]} · ${
                  cameraFacing === 'back' ? 'rear camera' : 'front camera'
                }`}
          </Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 72,
  },
  headerBtnText: {
    color: AppTheme.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  stepLabel: {
    fontSize: 12,
    color: AppTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  poseTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    marginTop: 2,
  },
  previewWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: AppTheme.radiusCard,
    overflow: 'hidden',
    backgroundColor: AppTheme.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  flipOverlayBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipOverlayIcon: {
    color: AppTheme.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  flipOverlayLabel: {
    color: AppTheme.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  guideFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  instruction: {
    fontSize: 14,
    lineHeight: 20,
    color: AppTheme.textPrimary,
    textAlign: 'center',
  },
  permissionBlock: {
    padding: 24,
    alignItems: 'center',
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    marginBottom: 8,
  },
  permissionBody: {
    fontSize: 14,
    lineHeight: 20,
    color: AppTheme.textMuted,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppTheme.border,
  },
  dotActive: {
    backgroundColor: AppTheme.accent,
    width: 20,
  },
  dotDone: {
    backgroundColor: AppTheme.accent,
    opacity: 0.5,
  },
  actions: {
    alignItems: 'center',
    paddingBottom: 28,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  actionsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  flipSideBtn: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipSideIcon: {
    color: AppTheme.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  flipSideLabel: {
    color: AppTheme.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: AppTheme.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AppTheme.textPrimary,
  },
  captureHint: {
    fontSize: 13,
    color: AppTheme.textMuted,
    textAlign: 'center',
  },
});

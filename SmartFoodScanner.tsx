import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppTheme } from './src/theme/appVisualTheme';
import type { ScannedFood } from './src/utils/foodDatabase';
import type { FoodProduct, FoodProductMatchCandidate, SmartScanResult } from './src/types/foodProduct';
import {
  foodProductToScannedFood,
  identifyByBarcode,
  identifyFromPackageImage,
} from './src/services/foodScanner';
import { useToast } from './src/components/ToastProvider';
import { useSubscription } from './src/context/SubscriptionContext';

let CameraView: React.ComponentType<any> | null = null;
let CameraModule: { requestCameraPermissionsAsync: () => Promise<{ status: string }> } | null = null;

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
  onManualEntry?: () => void;
  onFoodScanned: (food: ScannedFood) => void;
  onScanNotFound?: (barcode?: string) => void;
  onScanError?: (message: string) => void;
};

type Phase = 'camera' | 'analyzing' | 'candidates';

export default function SmartFoodScanner({
  visible,
  onClose,
  onManualEntry,
  onFoodScanned,
  onScanNotFound,
  onScanError,
}: Props): React.ReactElement {
  const cameraRef = useRef<{
    takePictureAsync: (opts?: object) => Promise<{ uri: string; base64?: string }>;
  } | null>(null);
  const { showNotification } = useToast();
  const { isPremium, presentUpgrade } = useSubscription();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>('camera');
  const [statusLine, setStatusLine] = useState('Point at a barcode, Nutrition Facts, or package');
  const [barcodeLocked, setBarcodeLocked] = useState(false);
  const [lastBarcode, setLastBarcode] = useState<string | undefined>();
  const [candidates, setCandidates] = useState<FoodProductMatchCandidate[]>([]);
  const [partial, setPartial] = useState<FoodProduct | undefined>();

  useEffect(() => {
    if (!visible) return;
    setPhase('camera');
    setBarcodeLocked(false);
    setLastBarcode(undefined);
    setCandidates([]);
    setPartial(undefined);
    setStatusLine('Point at a barcode, Nutrition Facts, or package');

    (async () => {
      if (!CameraModule) {
        setHasPermission(false);
        return;
      }
      const { status } = await CameraModule.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, [visible]);

  const deliverProduct = useCallback(
    (product: FoodProduct) => {
      onFoodScanned(foodProductToScannedFood(product));
    },
    [onFoodScanned]
  );

  const handleResult = useCallback(
    (result: SmartScanResult) => {
      if (result.status === 'matched') {
        deliverProduct(result.product);
        return;
      }
      if (result.status === 'needs_confirmation') {
        deliverProduct(result.product);
        return;
      }
      if (result.status === 'candidates') {
        setCandidates(result.candidates);
        setPartial(result.partial);
        setPhase('candidates');
        setStatusLine('Choose the matching product');
        return;
      }
      if (onScanNotFound) {
        onScanNotFound(result.barcode);
      } else {
        onClose();
        showNotification({
          title: 'Could not identify',
          lines: [result.message],
          type: 'warning',
          durationMs: 4500,
        });
      }
      setPhase('camera');
      setBarcodeLocked(false);
    },
    [deliverProduct, onClose, onScanNotFound, showNotification]
  );

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!visible || phase !== 'camera' || barcodeLocked) return;
    const barcode = String(data).replace(/\s/g, '').trim();
    if (!barcode) return;

    setBarcodeLocked(true);
    setLastBarcode(barcode);
    setPhase('analyzing');
    setStatusLine('Barcode found — looking up…');

    try {
      const result = await identifyByBarcode(barcode);
      if (result.status === 'matched' && result.autoPopulate) {
        handleResult(result);
        return;
      }
      // Low confidence / miss — stay in camera and ask user to capture package/label.
      setPhase('camera');
      setStatusLine(
        result.status === 'not_found'
          ? 'Barcode not in database — capture the label or package'
          : 'Confirm with a package photo, or capture Nutrition Facts'
      );
      setBarcodeLocked(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lookup failed';
      setPhase('camera');
      setBarcodeLocked(false);
      setStatusLine('Barcode lookup failed — try capturing the package');
      if (onScanError) onScanError(msg);
    }
  };

  const captureAndAnalyze = async () => {
    if (!cameraRef.current || phase === 'analyzing') return;

    if (!isPremium) {
      presentUpgrade();
      showNotification({
        title: 'Premium for Smart Scan',
        lines: [
          'Barcode lookup works on Basic. Package and Nutrition Facts scanning needs Premium.',
        ],
        type: 'info',
        durationMs: 4000,
      });
      return;
    }

    setPhase('analyzing');
    setStatusLine('Analyzing package…');
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
        skipProcessing: Platform.OS === 'android',
      });
      if (!photo?.base64) {
        throw new Error('Could not capture image.');
      }
      const result = await identifyFromPackageImage({
        base64: photo.base64,
        mimeType: 'image/jpeg',
        barcodeHint: lastBarcode,
      });
      handleResult(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Analysis failed';
      setPhase('camera');
      setBarcodeLocked(false);
      setStatusLine('Could not analyze — try again or enter manually');
      if (onScanError) {
        onScanError(msg);
      } else {
        showNotification({
          title: 'Scan failed',
          lines: [msg],
          type: 'error',
          durationMs: 4500,
        });
      }
    }
  };

  const pickCandidate = (product: FoodProduct) => {
    deliverProduct(product);
  };

  if (!visible) return <></>;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (phase === 'candidates') {
                setPhase('camera');
                setBarcodeLocked(false);
                setStatusLine('Point at a barcode, Nutrition Facts, or package');
                return;
              }
              onClose();
            }}
            hitSlop={12}
          >
            <Text style={styles.headerBtn}>{phase === 'candidates' ? '‹ Back' : 'Cancel'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Scan Food</Text>
          <TouchableOpacity
            onPress={() => {
              if (onManualEntry) onManualEntry();
              else onClose();
            }}
            hitSlop={12}
          >
            <Text style={styles.headerBtn}>Manual</Text>
          </TouchableOpacity>
        </View>

        {phase === 'candidates' ? (
          <ScrollView style={styles.candidateList} contentContainerStyle={styles.candidateContent}>
            <Text style={styles.candidateHint}>
              Multiple possible matches — pick the correct product. Nothing is saved until you confirm in Log
              Food.
            </Text>
            {candidates.map((c) => (
              <TouchableOpacity
                key={c.product.id}
                style={styles.candidateRow}
                onPress={() => pickCandidate(c.product)}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.candidateName}>{c.product.productName}</Text>
                  {c.product.brand ? <Text style={styles.candidateBrand}>{c.product.brand}</Text> : null}
                  <Text style={styles.candidateMacros}>
                    {Math.round(c.product.calories)} kcal · P {c.product.protein}g · C{' '}
                    {c.product.carbohydrates}g · F {c.product.fat}g
                  </Text>
                  <Text style={styles.candidateReason}>{c.reason}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {partial ? (
              <TouchableOpacity
                style={[styles.candidateRow, styles.partialRow]}
                onPress={() => pickCandidate(partial)}
                activeOpacity={0.85}
              >
                <Text style={styles.candidateName}>Use extracted label values</Text>
                <Text style={styles.candidateMacros}>
                  {Math.round(partial.calories)} kcal · confidence {Math.round(partial.confidence * 100)}%
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        ) : (
          <>
            <View style={styles.previewWrap}>
              {!CameraView || hasPermission === false ? (
                <View style={styles.permissionBlock}>
                  <Text style={styles.permissionTitle}>Camera access needed</Text>
                  <Text style={styles.permissionBody}>
                    {Platform.OS === 'web'
                      ? 'Smart Food Scanner is available in the iOS and Android app.'
                      : 'Enable camera permission in Settings to scan food.'}
                  </Text>
                </View>
              ) : hasPermission === null ? (
                <ActivityIndicator size="large" color={AppTheme.accent} />
              ) : (
                <CameraView
                  ref={cameraRef}
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
                  }}
                  onBarcodeScanned={
                    phase === 'camera' && !barcodeLocked ? handleBarCodeScanned : undefined
                  }
                />
              )}
              {phase === 'analyzing' ? (
                <View style={styles.analyzingOverlay}>
                  <ActivityIndicator size="large" color={AppTheme.accent} />
                  <Text style={styles.analyzingText}>{statusLine}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.status}>{statusLine}</Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.captureBtn, phase === 'analyzing' && styles.captureDisabled]}
                onPress={() => void captureAndAnalyze()}
                disabled={phase === 'analyzing' || !hasPermission || !CameraView}
                activeOpacity={0.85}
              >
                <View style={styles.captureInner} />
              </TouchableOpacity>
              <Text style={styles.captureHint}>
                Tap to scan Nutrition Facts or the whole package
              </Text>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppTheme.bgScreen },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: { color: AppTheme.accent, fontSize: 16, fontWeight: '600', minWidth: 64 },
  title: { color: AppTheme.textPrimary, fontSize: 17, fontWeight: '700' },
  previewWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: AppTheme.radiusCard,
    overflow: 'hidden',
    backgroundColor: AppTheme.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: { ...StyleSheet.absoluteFillObject },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  analyzingText: {
    color: AppTheme.textPrimary,
    marginTop: 14,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  status: {
    color: AppTheme.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: { alignItems: 'center', paddingVertical: 22 },
  captureBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: AppTheme.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureDisabled: { opacity: 0.5 },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: AppTheme.accent,
  },
  captureHint: {
    marginTop: 10,
    color: AppTheme.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  permissionBlock: { padding: 24, alignItems: 'center' },
  permissionTitle: {
    color: AppTheme.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  permissionBody: { color: AppTheme.textMuted, textAlign: 'center', lineHeight: 20 },
  candidateList: { flex: 1 },
  candidateContent: { padding: 16, paddingBottom: 40 },
  candidateHint: {
    color: AppTheme.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  candidateRow: {
    backgroundColor: AppTheme.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  partialRow: { borderColor: AppTheme.accent },
  candidateName: { color: AppTheme.textPrimary, fontSize: 16, fontWeight: '700' },
  candidateBrand: { color: AppTheme.textMuted, marginTop: 2, fontSize: 13 },
  candidateMacros: { color: AppTheme.textPrimary, marginTop: 8, fontSize: 13 },
  candidateReason: { color: AppTheme.accent, marginTop: 4, fontSize: 12, fontWeight: '600' },
});

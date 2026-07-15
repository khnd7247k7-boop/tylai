import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
// UPC lookup: Nutritionix /v2/search/item when EXPO_PUBLIC_NUTRITIONIX_* are set, else Open Food Facts + USDA FDC gap fill (see src/services/NutritionService.ts).
import { lookupFoodByBarcode, isScannedFoodUsable, ScannedFood } from './src/utils/foodDatabase';
import { useToast } from './src/components/ToastProvider';

// ScannedFood type imported from foodDatabase

// Lazy-load camera module to avoid breaking web build where expo-camera
// may not be available or fully supported.
let CameraView: any = null;
let CameraModule: any = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExpoCamera = require('expo-camera');
    // expo-camera v17+: CameraView is the preview component; `Camera` is permissions API only (not a component).
    CameraView = ExpoCamera.CameraView ?? null;
    CameraModule = ExpoCamera.Camera ?? null;
  } catch (error) {
    console.warn('Camera module not available:', error);
    CameraView = null;
    CameraModule = null;
  }
}

interface BarcodeScannerProps {
  visible: boolean;
  /** Close scanner only (e.g. cancel). */
  onClose: () => void;
  /** Open manual / label entry flow (e.g. Log Food). Optional — if omitted, “Add Manually” calls onClose. */
  onManualEntry?: () => void;
  onFoodScanned: (food: ScannedFood) => void;
  /** Barcode was read but no usable nutrition data exists in our databases. */
  onScanNotFound?: (barcode: string) => void;
  /** Network or lookup error. */
  onScanError?: (barcode: string) => void;
}

export default function BarcodeScanner({
  visible,
  onClose,
  onManualEntry,
  onFoodScanned,
  onScanNotFound,
  onScanError,
}: BarcodeScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { showNotification } = useToast();

  const notifyScanNotFound = (barcode: string) => {
    if (onScanNotFound) {
      onScanNotFound(barcode);
      return;
    }
    onClose();
    showNotification({
      title: 'Product not in database',
      lines: [
        `No nutrition data was found for barcode ${barcode}.`,
        'Search by food name or enter macros manually from the package label.',
      ],
      type: 'warning',
      durationMs: 4500,
    });
  };

  const notifyScanError = (barcode: string) => {
    if (onScanError) {
      onScanError(barcode);
      return;
    }
    onClose();
    showNotification({
      title: 'Barcode lookup failed',
      lines: [
        'Could not look up this barcode. Check your connection and try again, or add the food manually.',
      ],
      type: 'error',
      durationMs: 4500,
    });
  };

  useEffect(() => {
    const getCameraPermissions = async () => {
      if (!CameraModule) {
        setHasPermission(false);
        return;
      }
      const { status } = await CameraModule.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    if (visible) {
      setScanned(false);
      setIsLoading(false);
      getCameraPermissions();
    }
  }, [visible]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setIsLoading(true);
    const barcode = String(data).replace(/\s/g, '').trim();
    try {
      const foodData = await lookupFoodByBarcode(barcode);
      if (foodData && isScannedFoodUsable(foodData)) {
        onClose();
        onFoodScanned(foodData);
        return;
      }
      setScanned(false);
      notifyScanNotFound(barcode);
    } catch (error) {
      console.error('Error looking up food:', error);
      setScanned(false);
      notifyScanError(barcode);
    } finally {
      setIsLoading(false);
    }
  };

  // Lookup now handled by src/utils/foodDatabase

  const resetScanner = () => {
    setScanned(false);
  };

  if (!visible) return null;

  // Web fallback: barcode scanning not supported yet, show friendly message
  const modalPresentation =
    Platform.OS === 'ios' ? ('fullScreen' as const) : undefined;

  if (Platform.OS === 'web') {
    return (
      <Modal visible={visible} animationType="none">
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Barcode scanning isn&apos;t supported in the web version yet. Please use the mobile app to scan barcodes, or add foods manually.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.permissionButtonText}>←</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="none" presentationStyle={modalPresentation}>
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>Requesting camera permission...</Text>
            <ActivityIndicator size="large" color="#4ECDC4" />
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="none" presentationStyle={modalPresentation}>
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>Camera permission is required to scan barcodes</Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.permissionButtonText}>←</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  if (!CameraView) {
    return (
      <Modal visible={visible} animationType="none" presentationStyle={modalPresentation}>
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Barcode scanning is not available in this build (camera module missing). Add foods manually or use a dev
              client build with expo-camera installed.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.permissionButtonText}>←</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle={modalPresentation}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Barcode</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.scannerContainer}>
          <CameraView
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            style={styles.scanner}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
            }}
          />

          {/* Scanner overlay — do not intercept touches (camera must keep receiving frames). */}
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.scanArea} pointerEvents="none">
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#4ECDC4" />
              <Text style={styles.loadingText}>Looking up food information...</Text>
            </View>
          )}
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            Position the barcode within the frame to scan
          </Text>
          <Text style={styles.instructionSubtext}>
            Make sure the barcode is well-lit and clearly visible
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.resetButton} onPress={resetScanner}>
            <Text style={styles.resetButtonText}>Scan Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => {
              if (onManualEntry) onManualEntry();
              else onClose();
            }}
          >
            <Text style={styles.manualButtonText}>Add Manually</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    backgroundColor: '#ff4444',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 50,
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
    margin: 20,
    borderRadius: 15,
    overflow: 'hidden',
  },
  scanner: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 150,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#4ECDC4',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  instructions: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  instructionSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  resetButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  manualButton: {
    backgroundColor: '#666',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  permissionText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
  },
  permissionButtonText: {
    color: '#1a1a1a',
    fontSize: 22,
    fontWeight: 'bold',
  },
});

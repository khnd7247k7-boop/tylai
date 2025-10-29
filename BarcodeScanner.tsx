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
} from 'react-native';
import { Camera } from 'expo-camera';
import { BarCodeScanner } from 'expo-barcode-scanner';

interface ScannedFood {
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  barcode: string;
}

interface BarcodeScannerProps {
  visible: boolean;
  onClose: () => void;
  onFoodScanned: (food: ScannedFood) => void;
}

export default function BarcodeScanner({ visible, onClose, onFoodScanned }: BarcodeScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    if (visible) {
      getCameraPermissions();
    }
  }, [visible]);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    setIsLoading(true);

    try {
      // Simulate API call to food database
      // In a real app, you would call an API like Open Food Facts or USDA Food Database
      const foodData = await lookupFoodByBarcode(data);
      
      if (foodData) {
        onFoodScanned(foodData);
        onClose();
      } else {
        Alert.alert(
          'Food Not Found',
          'This barcode was not found in our database. You can still add the food manually.',
          [
            { text: 'OK', onPress: () => setScanned(false) },
            { text: 'Add Manually', onPress: () => onClose() }
          ]
        );
      }
    } catch (error) {
      console.error('Error looking up food:', error);
      Alert.alert(
        'Error',
        'Failed to look up food information. Please try again or add manually.',
        [
          { text: 'OK', onPress: () => setScanned(false) }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Mock function to simulate food database lookup
  // In a real app, this would call an actual API
  const lookupFoodByBarcode = async (barcode: string): Promise<ScannedFood | null> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock food database - in reality, you'd use Open Food Facts API or similar
    const mockFoodDatabase: { [key: string]: ScannedFood } = {
      '1234567890123': {
        name: 'Protein Bar',
        brand: 'Quest',
        calories: 200,
        protein: 20,
        carbs: 15,
        fat: 8,
        servingSize: '1 bar (60g)',
        barcode: '1234567890123'
      },
      '2345678901234': {
        name: 'Greek Yogurt',
        brand: 'Chobani',
        calories: 150,
        protein: 15,
        carbs: 12,
        fat: 5,
        servingSize: '1 container (170g)',
        barcode: '2345678901234'
      },
      '3456789012345': {
        name: 'Almonds',
        brand: 'Blue Diamond',
        calories: 160,
        protein: 6,
        carbs: 6,
        fat: 14,
        servingSize: '1 oz (28g)',
        barcode: '3456789012345'
      },
      '4567890123456': {
        name: 'Banana',
        brand: 'Fresh',
        calories: 105,
        protein: 1,
        carbs: 27,
        fat: 0,
        servingSize: '1 medium (118g)',
        barcode: '4567890123456'
      },
      '5678901234567': {
        name: 'Chicken Breast',
        brand: 'Tyson',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        servingSize: '4 oz (113g)',
        barcode: '5678901234567'
      }
    };

    return mockFoodDatabase[barcode] || null;
  };

  const resetScanner = () => {
    setScanned(false);
  };

  if (!visible) return null;

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide">
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
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>Camera permission is required to scan barcodes</Text>
            <TouchableOpacity style={styles.permissionButton} onPress={onClose}>
              <Text style={styles.permissionButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Barcode</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.scannerContainer}>
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
            style={styles.scanner}
            barCodeTypes={[BarCodeScanner.Constants.BarCodeType.ean13, BarCodeScanner.Constants.BarCodeType.ean8]}
          />
          
          {/* Scanner overlay */}
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
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
          <TouchableOpacity style={styles.manualButton} onPress={onClose}>
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
    fontSize: 16,
    fontWeight: 'bold',
  },
});

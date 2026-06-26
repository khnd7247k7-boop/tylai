import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppTheme } from '../theme/appVisualTheme';
import { MEDICAL_DISCLAIMER_SHORT } from '../constants/complianceDisclosures';
import { saveUserData } from '../utils/userStorage';

export const MEDICAL_DISCLAIMER_DEVICE_KEY = 'tylai_medicalDisclaimerAccepted';

type Props = {
  visible: boolean;
  onAccepted: () => void;
};

/**
 * Full-screen gate (not RN Modal) so taps work reliably with GestureHandlerRootView + tab bar z-index.
 */
export default function MedicalDisclaimerGate({ visible, onAccepted }: Props) {
  const handleAccept = useCallback(async () => {
    try {
      await saveUserData('onboardingMedicalDisclaimerAccepted', true);
    } catch (e) {
      console.warn('[MedicalDisclaimer] Could not persist per-user acceptance', e);
    }
    try {
      await AsyncStorage.setItem(MEDICAL_DISCLAIMER_DEVICE_KEY, 'true');
    } catch {
      /* best-effort */
    }
    onAccepted();
  }, [onAccepted]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityRole="alert">
      <View style={styles.card}>
        <Text style={styles.title}>Before you continue</Text>
        <Text style={styles.body}>{MEDICAL_DISCLAIMER_SHORT}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="I understand, continue"
          onPress={handleAccept}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>I understand — continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200000,
    elevation: 200000,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  body: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  button: {
    backgroundColor: AppTheme.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '800',
  },
});

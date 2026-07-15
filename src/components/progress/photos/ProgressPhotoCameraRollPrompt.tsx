import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { AppTheme } from '../../../theme/appVisualTheme';

interface ProgressPhotoCameraRollPromptProps {
  visible: boolean;
  onSaveToCameraRoll: () => void;
  onKeepInAppOnly: () => void;
}

export default function ProgressPhotoCameraRollPrompt({
  visible,
  onSaveToCameraRoll,
  onKeepInAppOnly,
}: ProgressPhotoCameraRollPromptProps): React.ReactElement {
  if (Platform.OS === 'web') {
    return <></>;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepInAppOnly}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>📸</Text>
          <Text style={styles.title}>Save progress photos to your camera roll?</Text>
          <Text style={styles.body}>
            When enabled, every front, side, and back photo you take in Progress Photos will also
            be saved to your device photo library. You can change this anytime in Health & Trends.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onSaveToCameraRoll}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Save to Camera Roll</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onKeepInAppOnly}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Keep in App Only</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: AppTheme.overlay,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 24,
  },
  emoji: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: AppTheme.textMuted,
    textAlign: 'center',
    marginBottom: 22,
  },
  primaryBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: AppTheme.radiusButton,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: AppTheme.accentDark,
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: AppTheme.textMuted,
  },
});

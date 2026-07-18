import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet, Alert, Platform, Linking } from 'react-native';
import { AppTheme } from '../theme/appVisualTheme';
import {
  loadProgressPhotoSettings,
  setSaveToCameraRoll,
} from '../utils/progressPhotoSettings';
import {
  isMediaLibraryAvailable,
  mediaLibraryUnavailableMessage,
  requestCameraRollPermission,
} from '../services/PhotoCameraRollService';

export default function ProgressPhotoSettingsSection(): React.ReactElement {
  const [saveToCameraRoll, setSaveToCameraRollState] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const settings = await loadProgressPhotoSettings();
    setSaveToCameraRollState(settings.saveToCameraRoll);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggle = async (enabled: boolean) => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert(
          'Not available on web',
          'Saving progress photos to your camera roll is only available in the iOS and Android app.'
        );
        return;
      }

      if (!isMediaLibraryAvailable()) {
        Alert.alert('Camera roll unavailable', mediaLibraryUnavailableMessage());
        return;
      }

      if (enabled) {
        const granted = await requestCameraRollPermission();
        if (!granted) {
          Alert.alert(
            'Photo library access needed',
            'Allow photo library access in Settings to save progress photos to your camera roll.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          return;
        }
      }

      const next = await setSaveToCameraRoll(enabled);
      setSaveToCameraRollState(next.saveToCameraRoll);
    } catch (error) {
      console.warn('[ProgressPhotoSettings] toggle failed', error);
      Alert.alert(
        'Could not update setting',
        'Photo library permission failed. Check Settings → TYLAI → Photos, then try again.'
      );
    }
  };

  const nativeAvailable = isMediaLibraryAvailable();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Progress photos</Text>
      <Text style={styles.intro}>
        Control whether weekly progress photos taken in the Progress tab are also copied to your
        device camera roll.
      </Text>

      <View style={styles.settingRow}>
        <View style={styles.settingLabelContainer}>
          <Text style={styles.settingLabel}>Save to camera roll</Text>
          <Text style={styles.settingDescription}>
            When on, front, side, and back photos from each progress session are saved to your
            photo library after capture.
          </Text>
        </View>
        <Switch
          value={saveToCameraRoll}
          disabled={loading || Platform.OS === 'web' || !nativeAvailable}
          onValueChange={handleToggle}
          trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
          thumbColor={saveToCameraRoll ? '#fff' : '#888'}
        />
      </View>
      {!nativeAvailable && Platform.OS !== 'web' ? (
        <Text style={styles.unavailableNote}>{mediaLibraryUnavailableMessage()}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    marginBottom: 8,
  },
  intro: {
    fontSize: 14,
    color: AppTheme.textMuted,
    lineHeight: 20,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: AppTheme.textPrimary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: AppTheme.textMuted,
    lineHeight: 18,
  },
  unavailableNote: {
    fontSize: 12,
    color: AppTheme.textMuted,
    lineHeight: 17,
    marginTop: 4,
  },
});

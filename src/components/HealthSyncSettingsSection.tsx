import React, { useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, Alert, Platform, Linking, StyleSheet } from 'react-native';
import { AppTheme } from '../theme/appVisualTheme';
import { loadUserData, saveUserData } from '../utils/userStorage';
import {
  DEFAULT_HEALTH_DATA_PERMISSIONS,
  EXPO_HEALTH_METRIC_KEYS,
  HEALTH_METRIC_ORDER,
  HEALTH_METRIC_COPY,
  loadHealthDataPermissions,
  saveHealthDataPermissions,
  type HealthDataPermissions,
  type HealthMetricKey,
} from '../utils/healthDataPermissions';

type AppSettingsSlice = {
  healthDataSyncEnabled: boolean;
};

export default function HealthSyncSettingsSection({
  onSyncEnabledChange,
}: {
  onSyncEnabledChange?: (enabled: boolean) => void;
}) {
  const [healthDataSyncEnabled, setHealthDataSyncEnabled] = useState(true);
  const [healthDataPerms, setHealthDataPerms] = useState<HealthDataPermissions>(
    DEFAULT_HEALTH_DATA_PERMISSIONS
  );

  useEffect(() => {
    void (async () => {
      const savedSettings = await loadUserData<AppSettingsSlice>('appSettings');
      setHealthDataSyncEnabled(savedSettings?.healthDataSyncEnabled !== false);
      setHealthDataPerms(await loadHealthDataPermissions());
    })();
  }, []);

  const persistSyncEnabled = async (value: boolean) => {
    const savedSettings = (await loadUserData<Record<string, unknown>>('appSettings')) ?? {};
    const next = { ...savedSettings, healthDataSyncEnabled: value };
    await saveUserData('appSettings', next);
    setHealthDataSyncEnabled(value);
    onSyncEnabledChange?.(value);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Apple Health sync</Text>
      <Text style={styles.intro}>
        Connect Apple Health, your Apple Watch, and other apps that write health data. Choose which
        metrics TYL may read for charts and trends.
      </Text>

      <View style={styles.settingRow}>
        <View style={styles.settingLabelContainer}>
          <Text style={styles.settingLabel}>Watch & Apple Health sync</Text>
          <Text style={styles.settingDescription}>
            On iPhone, allow the app to read metrics from Apple Health. On Android, similar data may
            come from Google Fit.
          </Text>
        </View>
        <Switch
          value={healthDataSyncEnabled}
          onValueChange={async (value) => {
            await persistSyncEnabled(value);
            if (value) {
              try {
                const HealthService = await import('../services/HealthService');
                const hasPermissions = await HealthService.default.requestPermissions();
                if (hasPermissions) {
                  Alert.alert(
                    'Apple Health connected',
                    'Allow the categories you want in the system sheet. TYLAI will then appear under Health → Sharing → Apps. Open Trends and tap Refresh to load data.',
                    [{ text: 'OK' }]
                  );
                } else {
                  Alert.alert(
                    'Could not open Apple Health',
                    'HealthKit needs a device build (TestFlight or App Store), not Expo Go.',
                    [{ text: 'OK' }]
                  );
                }
              } catch (error) {
                console.error('Error requesting health permissions:', error);
              }
            } else {
              Alert.alert(
                'Sync disabled',
                'The app will no longer read workout or activity metrics from Apple Health.',
                [{ text: 'OK' }]
              );
            }
          }}
          trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
          thumbColor={healthDataSyncEnabled ? '#fff' : '#888'}
        />
      </View>

      {Platform.OS === 'ios' && (
        <>
          <TouchableOpacity
            style={styles.secondaryActionButton}
            onPress={async () => {
              try {
                const HealthService = await import('../services/HealthService');
                const ok = await HealthService.default.requestPermissions();
                if (ok) {
                  Alert.alert(
                    'Request sent',
                    'If this is the first time, iOS shows the Health permission sheet.',
                    [{ text: 'OK' }]
                  );
                } else {
                  Alert.alert(
                    'Apple Health unavailable',
                    'Use a TestFlight or App Store build on a physical iPhone.',
                    [{ text: 'OK' }]
                  );
                }
              } catch (e) {
                console.warn('Connect Apple Health failed:', e);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryActionButtonText}>Connect Apple Health</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryActionButton}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryActionButtonText}>Open iPhone Settings</Text>
          </TouchableOpacity>
        </>
      )}

      {HEALTH_METRIC_ORDER.map((key: HealthMetricKey) => {
        const copy = HEALTH_METRIC_COPY[key];
        const isExpoMetric = (EXPO_HEALTH_METRIC_KEYS as readonly HealthMetricKey[]).includes(key);
        return (
          <View key={key} style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Text style={styles.settingLabel}>{copy.title}</Text>
              <Text style={styles.settingDescription}>{copy.description}</Text>
              {!isExpoMetric && (
                <Text style={styles.settingDescriptionMuted}>
                  Not used by in-app Fitness charts in this build; your choice is saved for privacy.
                </Text>
              )}
            </View>
            <Switch
              value={healthDataPerms[key]}
              disabled={!healthDataSyncEnabled}
              onValueChange={async (value) => {
                const next: HealthDataPermissions = { ...healthDataPerms, [key]: value };
                setHealthDataPerms(next);
                await saveHealthDataPermissions(next);
                if (value && healthDataSyncEnabled && isExpoMetric) {
                  try {
                    const HealthService = (await import('../services/HealthService')).default;
                    await HealthService.requestPermissions();
                  } catch (e) {
                    console.warn('Health permission request after category enable:', e);
                  }
                }
              }}
              trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
              thumbColor={healthDataPerms[key] ? '#fff' : '#888'}
            />
          </View>
        );
      })}
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
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.borderMuted,
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
  settingDescriptionMuted: {
    fontSize: 12,
    color: AppTheme.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  secondaryActionButton: {
    backgroundColor: AppTheme.bgElevated,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: AppTheme.borderMuted,
  },
  secondaryActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: AppTheme.accent,
  },
});

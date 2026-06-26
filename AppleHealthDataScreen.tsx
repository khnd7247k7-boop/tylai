import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppTheme } from './src/theme/appVisualTheme';

type AppleHealthDataScreenProps = {
  onBack: () => void;
};

/**
 * Placeholder for Apple Health fields beyond the Trends tab (sleep stages, HRV, etc.).
 * Dashboard “Apple Health” tile opens here instead of Health trends.
 */
export default function AppleHealthDataScreen({ onBack }: AppleHealthDataScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Apple Health</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.placeholderTitle}>Health data</Text>
        <Text style={styles.placeholderBody}>
          This screen is ready for additional HealthKit fields (for example resting heart rate, sleep stages, HRV,
          respiratory rate, blood oxygen). Charts stay under the Trends entry from the dashboard.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  backText: {
    color: AppTheme.accent,
    fontSize: 22,
    fontWeight: '600',
  },
  title: {
    color: AppTheme.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 48,
  },
  body: {
    padding: 20,
    paddingBottom: 40,
  },
  placeholderTitle: {
    color: AppTheme.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  placeholderBody: {
    color: AppTheme.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
});

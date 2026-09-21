import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppTheme } from './src/theme/appVisualTheme';

export type LogWorkoutMenuMode = 'daily' | 'past' | 'cardio';

type Option = {
  mode: LogWorkoutMenuMode;
  emoji: string;
  title: string;
  subtitle: string;
  accent: string;
  border: string;
};

const OPTIONS: Option[] = [
  {
    mode: 'daily',
    emoji: '💪',
    title: 'Daily workout',
    subtitle: 'Log what you lifted today — sets, weight, and reps.',
    accent: '#00ff88',
    border: 'rgba(0, 255, 136, 0.35)',
  },
  {
    mode: 'cardio',
    emoji: '🏃',
    title: 'Cardio',
    subtitle: 'Run, walk, bike, or any cardio — duration and optional watch sync.',
    accent: '#60a5fa',
    border: 'rgba(96, 165, 250, 0.35)',
  },
  {
    mode: 'past',
    emoji: '📅',
    title: 'Past workout',
    subtitle: 'Backdate a strength session from another day.',
    accent: '#c084fc',
    border: 'rgba(192, 132, 252, 0.35)',
  },
];

type Props = {
  onBack: () => void;
  onSelect: (mode: LogWorkoutMenuMode) => void;
};

export default function LogWorkoutMenuScreen({ onBack, onSelect }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log Workout</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>
          Pick the type of session you want to log. You can add cardio to strength workouts later if
          you need both.
        </Text>

        <View style={styles.options}>
          {OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.mode}
              style={[styles.optionCard, { borderColor: option.border }]}
              onPress={() => onSelect(option.mode)}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={option.title}
            >
              <View style={[styles.optionIconWrap, { backgroundColor: `${option.accent}18` }]}>
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
              </View>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, { color: option.accent }]}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>
              <Text style={styles.optionChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: AppTheme.accent,
    fontSize: 22,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppTheme.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  lead: {
    color: AppTheme.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  options: {
    gap: 14,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  optionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionEmoji: {
    fontSize: 26,
  },
  optionCopy: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  optionSubtitle: {
    color: AppTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  optionChevron: {
    color: AppTheme.textFaint,
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
});

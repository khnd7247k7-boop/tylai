import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppTheme } from '../../theme/appVisualTheme';
import {
  dailyHealthHasActivity,
  formatDistanceMiles,
  type DailyHealthSummary,
} from '../../services/dailyHealthSummaryService';

interface DailyHealthMetricsCardProps {
  summary: DailyHealthSummary | undefined;
  loading?: boolean;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function DailyHealthMetricsCard({
  summary,
  loading = false,
}: DailyHealthMetricsCardProps): React.ReactElement {
  if (loading && !dailyHealthHasActivity(summary)) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Apple Watch & Health</Text>
        <Text style={styles.muted}>Loading steps and workouts…</Text>
      </View>
    );
  }

  if (!dailyHealthHasActivity(summary)) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Apple Watch & Health</Text>
        <Text style={styles.muted}>
          No Health data for this day. Wear your watch or allow Apple Health in Settings to see
          steps and workouts here.
        </Text>
      </View>
    );
  }

  const distance = formatDistanceMiles(summary!.distanceM);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Apple Watch & Health</Text>
      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{summary!.steps.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Steps</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {summary!.activeCalories > 0 ? summary!.activeCalories.toLocaleString() : '—'}
          </Text>
          <Text style={styles.statLabel}>Active kcal</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {summary!.avgHeartRate != null ? `${summary!.avgHeartRate}` : '—'}
          </Text>
          <Text style={styles.statLabel}>Avg HR</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{distance || '—'}</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
      </View>

      {summary!.workouts.length > 0 ? (
        <View style={styles.workoutList}>
          <Text style={styles.workoutHeading}>
            Watch workouts ({summary!.workouts.length})
          </Text>
          {summary!.workouts.map((w) => (
            <View key={w.uuid} style={styles.workoutRow}>
              <Text style={styles.workoutName}>{w.activityLabel}</Text>
              <Text style={styles.workoutMeta}>
                {formatTime(w.startMs)} • {Math.round(w.durationMin)} min
                {w.calories ? ` • ${Math.round(w.calories)} kcal` : ''}
                {w.distanceM ? ` • ${formatDistanceMiles(w.distanceM)}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>No discrete Watch workouts recorded this day.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 14,
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    marginBottom: 10,
  },
  muted: {
    fontSize: 13,
    color: AppTheme.textMuted,
    lineHeight: 18,
  },
  statRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  stat: {
    flex: 1,
    alignItems: 'flex-start',
    paddingRight: 6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: AppTheme.accent,
  },
  statLabel: {
    fontSize: 11,
    color: AppTheme.textMuted,
    marginTop: 2,
  },
  workoutList: {
    marginTop: 4,
    gap: 8,
  },
  workoutHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: AppTheme.textSecondary,
    marginBottom: 4,
  },
  workoutRow: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
  },
  workoutName: {
    fontSize: 14,
    fontWeight: '600',
    color: AppTheme.textPrimary,
  },
  workoutMeta: {
    fontSize: 12,
    color: AppTheme.textMuted,
    marginTop: 2,
  },
});

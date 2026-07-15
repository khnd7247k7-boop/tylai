import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import type { SessionProgressMetrics, MetricValue } from '../../../types/sessionProgressMetrics';
import { useAnimatedNumber } from '../../../hooks/useAnimatedNumber';
import { AppTheme } from '../../../theme/appVisualTheme';

interface AnimatedSessionStatsProps {
  metrics: SessionProgressMetrics | null;
}

function TrendLine({ delta }: { delta: number | null | undefined }): React.ReactElement {
  if (delta == null || Math.abs(delta) < 0.05) {
    return <Text style={[styles.delta, styles.deltaFlat]}>—</Text>;
  }
  const down = delta < 0;
  return (
    <Text style={[styles.delta, down ? styles.deltaDown : styles.deltaUp]}>
      {down ? '↓' : '↑'} {Math.abs(delta)}
    </Text>
  );
}

function PrimaryStatCard({
  metric,
  decimals = 1,
}: {
  metric: MetricValue;
  decimals?: number;
}): React.ReactElement {
  const animated = useAnimatedNumber(
    metric.status === 'available' ? metric.value : null,
    { decimals }
  );
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    lift.setValue(8);
    Animated.spring(lift, {
      toValue: 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [lift, metric.value, metric.status]);

  const display =
    metric.status !== 'available' || animated == null
      ? '—'
      : decimals > 0
        ? animated.toFixed(decimals)
        : String(Math.round(animated));

  return (
    <Animated.View style={[styles.statCard, { transform: [{ translateY: lift }] }]}>
      <Text style={styles.statLabel}>{metric.label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.statValue} numberOfLines={1}>
          {display}
        </Text>
        {metric.unit && metric.status === 'available' ? (
          <Text style={styles.statUnit}>{metric.unit}</Text>
        ) : null}
      </View>
      {metric.status === 'available' ? (
        <TrendLine delta={metric.delta} />
      ) : (
        <Text style={styles.pending} numberOfLines={2}>
          {metric.emptyHint ?? 'Pending'}
        </Text>
      )}
    </Animated.View>
  );
}

/** Synced metric strip — morphs with the shared Progress timeline. */
export default function AnimatedSessionStats({
  metrics,
}: AnimatedSessionStatsProps): React.ReactElement | null {
  if (!metrics) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.caption}>Synced to this week</Text>
      <View style={styles.row}>
        <PrimaryStatCard metric={{ ...metrics.weight, label: 'Weight' }} decimals={1} />
        <PrimaryStatCard
          metric={{ ...metrics.measurements, label: 'Waist' }}
          decimals={1}
        />
        <PrimaryStatCard metric={{ ...metrics.recovery, label: 'Recovery' }} decimals={0} />
      </View>
      <View style={[styles.row, styles.rowSecond]}>
        <PrimaryStatCard metric={{ ...metrics.strength, label: 'Strength' }} decimals={0} />
        <PrimaryStatCard metric={{ ...metrics.calories, label: 'Calories' }} decimals={0} />
        <PrimaryStatCard metric={{ ...metrics.protein, label: 'Protein' }} decimals={0} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  caption: {
    fontSize: 12,
    color: AppTheme.textFaint,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  row: { flexDirection: 'row', gap: 8 },
  rowSecond: { marginTop: 8 },
  statCard: {
    flex: 1,
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusRow,
    borderWidth: 1,
    borderColor: AppTheme.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  statLabel: {
    fontSize: 11,
    color: AppTheme.textMuted,
    fontWeight: '600',
    marginBottom: 6,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: AppTheme.textPrimary,
  },
  statUnit: { fontSize: 11, color: AppTheme.textMuted },
  delta: { fontSize: 11, fontWeight: '700', marginTop: 6 },
  deltaUp: { color: AppTheme.accent },
  deltaDown: { color: '#7dd3fc' },
  deltaFlat: { color: AppTheme.textFaint, fontWeight: '500' },
  pending: { fontSize: 10, color: AppTheme.textFaint, marginTop: 6, lineHeight: 13 },
});

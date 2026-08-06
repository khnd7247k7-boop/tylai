import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import type { SessionProgressMetrics, MetricValue } from '../../types/sessionProgressMetrics';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { AppTheme } from '../../theme/appVisualTheme';

interface ProgressWeekVitalsProps {
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

function Vital({
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
    lift.setValue(6);
    Animated.spring(lift, {
      toValue: 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 5,
    }).start();
  }, [lift, metric.value, metric.status, metric.label]);

  const display =
    metric.status !== 'available' || animated == null
      ? '—'
      : decimals > 0
        ? animated.toFixed(decimals)
        : String(Math.round(animated));

  return (
    <Animated.View style={[styles.cell, { transform: [{ translateY: lift }] }]}>
      <Text style={styles.label}>{metric.label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value} numberOfLines={1}>
          {display}
        </Text>
        {metric.unit && metric.status === 'available' ? (
          <Text style={styles.unit}>{metric.unit}</Text>
        ) : null}
      </View>
      {metric.status === 'available' ? (
        <TrendLine delta={metric.delta} />
      ) : (
        <Text style={styles.pending} numberOfLines={2}>
          {metric.emptyHint ?? '—'}
        </Text>
      )}
    </Animated.View>
  );
}

function toBench(metrics: SessionProgressMetrics): MetricValue {
  const lift = metrics.workoutSummary.topLiftWeight;
  const name = metrics.workoutSummary.topLiftName;
  if (lift != null && lift > 0) {
    return {
      label: name && /bench/i.test(name) ? 'Bench' : name ? name.split(' ')[0] : 'Bench',
      value: lift,
      unit: 'lb',
      status: 'available',
      delta: metrics.strength.delta,
    };
  }
  return {
    ...metrics.strength,
    label: 'Bench',
    emptyHint: metrics.strength.emptyHint ?? 'Log a press this week',
  };
}

/** Page-level vitals for the focused week — part of the journey frame, not a photo gadget. */
export default function ProgressWeekVitals({
  metrics,
}: ProgressWeekVitalsProps): React.ReactElement | null {
  if (!metrics) return null;

  const extras = (metrics.extraMeasurements ?? []).filter(
    (m) => m.status === 'available' && m.value != null
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        <Vital metric={{ ...metrics.weight, label: 'Weight' }} decimals={1} />
        <Vital metric={{ ...metrics.measurements, label: 'Waist', unit: '"' }} decimals={1} />
        <Vital metric={toBench(metrics)} decimals={0} />
        <Vital metric={{ ...metrics.recovery, label: 'Recovery' }} decimals={0} />
        {extras.map((m) => (
          <Vital key={`${m.label}-${m.unit ?? ''}`} metric={m} decimals={1} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusRow,
    borderWidth: 1,
    borderColor: AppTheme.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
    minWidth: '46%',
  },
  label: {
    fontSize: 11,
    color: AppTheme.textMuted,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: AppTheme.textPrimary,
  },
  unit: { fontSize: 13, color: AppTheme.textMuted, fontWeight: '600' },
  delta: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  deltaUp: { color: AppTheme.accent },
  deltaDown: { color: '#7dd3fc' },
  deltaFlat: { color: AppTheme.textFaint, fontWeight: '500' },
  pending: { fontSize: 11, color: AppTheme.textFaint, marginTop: 6, lineHeight: 14 },
});

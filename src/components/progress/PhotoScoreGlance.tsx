import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { ProgressScoreResult } from '../../services/progressScoreService';
import { scoreColor } from '../../utils/progressScoreColors';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { AppTheme } from '../../theme/appVisualTheme';

interface PhotoScoreGlanceProps {
  result: ProgressScoreResult;
  weekLabel: string;
}

/**
 * Compact week score that rides with the progress photo —
 * so scrubbing the timeline keeps score and picture in the same frame.
 */
export default function PhotoScoreGlance({
  result,
  weekLabel,
}: PhotoScoreGlanceProps): React.ReactElement {
  const animatedScore = useAnimatedNumber(result.overall, { decimals: 0 });
  const lift = useRef(new Animated.Value(0)).current;
  const color = scoreColor(result.overall);

  useEffect(() => {
    lift.setValue(5);
    Animated.spring(lift, {
      toValue: 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [lift, result.overall, weekLabel]);

  const trendArrow =
    result.trend.direction === 'up' ? '↑' : result.trend.direction === 'down' ? '↓' : '→';
  const trendColor =
    result.trend.direction === 'up'
      ? AppTheme.accent
      : result.trend.direction === 'down'
        ? '#fb923c'
        : AppTheme.textMuted;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: lift }] }]}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Week score</Text>
        <Text style={styles.weekLabel} numberOfLines={1}>
          {weekLabel}
        </Text>
        <Text style={styles.tagline} numberOfLines={2}>
          {result.overallTagline}
        </Text>
      </View>
      <View style={styles.scoreBlock}>
        <Text style={[styles.score, { color }]}>
          {animatedScore == null ? result.overall : Math.round(animatedScore)}
        </Text>
        <Text style={[styles.trend, { color: trendColor }]}>
          {trendArrow} {result.trend.delta === 0 ? 'flat' : Math.abs(result.trend.delta)}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
    paddingVertical: 4,
  },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: AppTheme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  weekLabel: {
    color: AppTheme.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  tagline: {
    color: AppTheme.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  scoreBlock: { alignItems: 'flex-end' },
  score: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
    fontVariant: ['tabular-nums'],
  },
  trend: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});

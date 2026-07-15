import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import type { ProgressTrend } from '../../services/progressScoreService';
import { AppTheme } from '../../theme/appVisualTheme';

interface TrendIndicatorProps {
  trend: ProgressTrend;
  animate?: boolean;
}

export default function TrendIndicator({
  trend,
  animate = true,
}: TrendIndicatorProps): React.ReactElement {
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 600,
      delay: 900,
      useNativeDriver: true,
    }).start();
  }, [animate, opacity, trend.label]);

  const color =
    trend.direction === 'up'
      ? AppTheme.accent
      : AppTheme.textMuted;

  return (
    <Animated.Text style={[styles.trend, { color, opacity }]}>
      {trend.label}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  trend: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
});

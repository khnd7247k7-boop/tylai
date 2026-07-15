import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { CategoryScore } from '../../services/progressScoreService';
import { scoreColor, scoreIndicatorEmoji } from '../../utils/progressScoreColors';
import { AppTheme } from '../../theme/appVisualTheme';

interface ProgressCategoryProps {
  category: CategoryScore;
  animate?: boolean;
  animationDelay?: number;
}

export default function ProgressCategory({
  category,
  animate = true,
  animationDelay = 0,
}: ProgressCategoryProps): React.ReactElement {
  const barWidth = useRef(new Animated.Value(0)).current;
  const color = scoreColor(category.score);

  useEffect(() => {
    if (!animate) {
      barWidth.setValue(category.score);
      return;
    }
    Animated.timing(barWidth, {
      toValue: category.score,
      duration: 650,
      delay: animationDelay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animate, animationDelay, barWidth, category.score]);

  const widthInterp = barWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.label}>{category.label}</Text>
        <Text style={styles.indicator}>
          {scoreIndicatorEmoji(category.score)} {category.score}
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: color, width: widthInterp },
          ]}
        />
      </View>
      <Text style={styles.explanation}>{category.explanation}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: AppTheme.textPrimary,
  },
  indicator: {
    fontSize: 14,
    fontWeight: '700',
    color: AppTheme.textSecondary,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: AppTheme.border,
    overflow: 'hidden',
    marginBottom: 6,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  explanation: {
    fontSize: 13,
    lineHeight: 18,
    color: AppTheme.textMuted,
  },
});

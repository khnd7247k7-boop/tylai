import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { scoreColor } from '../../utils/progressScoreColors';
import { AppTheme } from '../../theme/appVisualTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  animate?: boolean;
}

export default function ProgressScoreRing({
  score,
  size = 132,
  strokeWidth = 10,
  animate = true,
}: ProgressScoreRingProps): React.ReactElement {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score);

  useEffect(() => {
    if (!animate) {
      setDisplayScore(score);
      progress.setValue(score);
      return;
    }
    const scoreListener = progress.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });
    Animated.timing(progress, {
      toValue: score,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => progress.removeListener(scoreListener);
  }, [animate, progress, score]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  const color = scoreColor(score);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={AppTheme.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.score, { color }]}>{displayScore}</Text>
        <Text style={styles.denominator}>/ 100</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
  },
  denominator: {
    fontSize: 13,
    color: AppTheme.textMuted,
    marginTop: -2,
  },
});

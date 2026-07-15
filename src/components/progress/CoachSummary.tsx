import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { AppTheme } from '../../theme/appVisualTheme';

interface CoachSummaryProps {
  headline: string;
  body: string;
}

export default function CoachSummary({
  headline,
  body,
}: CoachSummaryProps): React.ReactElement {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0.35);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [body, headline, opacity]);

  return (
    <Animated.View style={[styles.wrap, { opacity }]}>
      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.body}>{body}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
  },
  headline: {
    fontSize: 16,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: AppTheme.textMuted,
  },
});

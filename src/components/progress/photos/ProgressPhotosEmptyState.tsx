import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { AppTheme } from '../../../theme/appVisualTheme';
import FadeInCard from './FadeInCard';

interface ProgressPhotosEmptyStateProps {
  onTakePhotos: () => void;
}

export default function ProgressPhotosEmptyState({
  onTakePhotos,
}: ProgressPhotosEmptyStateProps): React.ReactElement {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <FadeInCard style={styles.card} delay={120}>
      <View style={styles.illustration}>
        <Animated.View style={[styles.orbit, { opacity: pulse }]} />
        <View style={styles.figure} />
        <View style={[styles.figure, styles.figureSide]} />
        <View style={styles.rail}>
          <View style={styles.railDot} />
          <View style={styles.railDot} />
          <View style={[styles.railDot, styles.railDotActive]} />
        </View>
      </View>
      <Text style={styles.title}>Add photos to the journey</Text>
      <Text style={styles.body}>
        Weekly front / side / back shots are a solid baseline to see change. Want to track faster?
        You can take progress photos any day — including every day.
      </Text>
      <TouchableOpacity style={styles.cta} onPress={onTakePhotos} activeOpacity={0.85}>
        <Text style={styles.ctaText}>Take photos</Text>
      </TouchableOpacity>
    </FadeInCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  illustration: {
    width: '100%',
    height: 140,
    borderRadius: AppTheme.radiusCard,
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.border,
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbit: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.35)',
  },
  figure: {
    width: 48,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(0,255,136,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.45)',
  },
  figureSide: {
    position: 'absolute',
    right: 56,
    width: 36,
    height: 58,
    opacity: 0.45,
  },
  rail: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  railDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppTheme.border,
  },
  railDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: AppTheme.accent,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: AppTheme.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: AppTheme.textMuted,
    marginBottom: 20,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: AppTheme.accent,
    borderRadius: AppTheme.radiusPill,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: AppTheme.accentDark,
  },
});

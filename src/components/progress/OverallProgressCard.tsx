import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ProgressScoreResult } from '../../services/progressScoreService';
import { AppTheme } from '../../theme/appVisualTheme';
import ProgressScoreRing from './ProgressScoreRing';
import TrendIndicator from './TrendIndicator';
import ProgressCategory from './ProgressCategory';
import CoachSummary from './CoachSummary';

interface OverallProgressCardProps {
  result: ProgressScoreResult;
  animate?: boolean;
  /**
   * journey: week snapshot in the living timeline (score + coach).
   * full: include category breakdown.
   */
  variant?: 'journey' | 'full';
  weekLabel?: string;
}

export default function OverallProgressCard({
  result,
  animate = true,
  variant = 'full',
  weekLabel,
}: OverallProgressCardProps): React.ReactElement {
  const isFirstPaint = useRef(true);
  const stagger = isFirstPaint.current;
  if (isFirstPaint.current) isFirstPaint.current = false;
  const journey = variant === 'journey';

  return (
    <View style={styles.card}>
      {weekLabel ? <Text style={styles.weekLabel}>{weekLabel}</Text> : null}
      {!journey ? <Text style={styles.sectionTitle}>Overall Progress</Text> : null}

      <View style={styles.hero}>
        <ProgressScoreRing score={result.overall} animate={animate} />
        <TrendIndicator trend={result.trend} animate={animate} />
        <Text style={styles.tagline}>{result.overallTagline}</Text>
      </View>

      {journey ? (
        <View style={styles.categories}>
          <Text style={styles.sectionTitle}>This week by area</Text>
          {result.categories.map((category, index) => (
            <ProgressCategory
              key={category.id}
              category={category}
              animate={animate}
              animationDelay={animate && stagger ? 200 + index * 60 : 0}
            />
          ))}
        </View>
      ) : null}

      <CoachSummary
        headline={result.coachSummary.headline}
        body={result.coachSummary.body}
      />

      {!journey ? (
        <View style={styles.categories}>
          {result.categories.map((category, index) => (
            <ProgressCategory
              key={category.id}
              category={category}
              animate={animate}
              animationDelay={animate && stagger ? 400 + index * 80 : 0}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 20,
    marginBottom: 16,
  },
  weekLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: AppTheme.textPrimary,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    lineHeight: 20,
    color: AppTheme.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  categories: {
    marginTop: 18,
  },
});

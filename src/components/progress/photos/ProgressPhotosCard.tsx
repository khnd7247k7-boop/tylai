import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AppTheme } from '../../../theme/appVisualTheme';
import type { ProgressPhotoStats } from '../../../types/progressPhotos';
import {
  formatRelativePhotoAge,
  formatNextPhotoLabel,
  getRetakeButtonLabel,
} from '../../../services/PhotoService';
import FadeInCard from './FadeInCard';

interface ProgressPhotosCardProps {
  stats: ProgressPhotoStats;
  onPrimaryAction: () => void;
  onRetake?: () => void;
  animate?: boolean;
}

function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}): React.ReactElement {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, accent && styles.tileValueAccent]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function ProgressPhotosCard({
  stats,
  onPrimaryAction,
  onRetake,
  animate = true,
}: ProgressPhotosCardProps): React.ReactElement {
  const showRetake = stats.hasSessionToday && onRetake;

  return (
    <FadeInCard style={styles.card} delay={animate ? 80 : 0}>
      <Text style={styles.title}>Progress Photos</Text>
      <Text style={styles.subtitle}>Your visual transformation, week by week</Text>

      <View style={styles.tiles}>
        <SummaryTile label="Last Photo" value={formatRelativePhotoAge(stats.lastPhotoDate)} />
        <SummaryTile
          label="Photo Streak"
          value={stats.weeklyStreak > 0 ? `${stats.weeklyStreak} Week Streak` : 'Start streak'}
          accent={stats.weeklyStreak > 0}
        />
        <SummaryTile label="Next Photo" value={formatNextPhotoLabel(stats.nextRecommendedDate)} />
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={onPrimaryAction} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>{stats.buttonLabel}</Text>
      </TouchableOpacity>

      {showRetake ? (
        <TouchableOpacity style={styles.secondaryBtn} onPress={onRetake} activeOpacity={0.85}>
          <Text style={styles.secondaryBtnText}>{getRetakeButtonLabel()}</Text>
        </TouchableOpacity>
      ) : null}
    </FadeInCard>
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
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: AppTheme.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: AppTheme.textMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  tiles: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tile: {
    flex: 1,
    backgroundColor: AppTheme.bgElevated,
    borderRadius: AppTheme.radiusRow,
    borderWidth: 1,
    borderColor: AppTheme.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 72,
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 10,
    color: AppTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tileValue: {
    fontSize: 13,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    lineHeight: 17,
  },
  tileValueAccent: {
    color: AppTheme.accent,
  },
  primaryBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: AppTheme.radiusPill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: AppTheme.accentDark,
  },
  secondaryBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppTheme.textMuted,
  },
});

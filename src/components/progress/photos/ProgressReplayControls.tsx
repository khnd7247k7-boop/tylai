import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AppTheme } from '../../../theme/appVisualTheme';

interface ProgressReplayControlsProps {
  isPlaying: boolean;
  disabled?: boolean;
  onToggle: () => void;
  progressLabel?: string;
}

/** Compact play control that sits above the timeline scrubber. */
export default function ProgressReplayControls({
  isPlaying,
  disabled,
  onToggle,
  progressLabel,
}: ProgressReplayControlsProps): React.ReactElement {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.btn, disabled && styles.btnDisabled, isPlaying && styles.btnActive]}
        onPress={onToggle}
        disabled={disabled}
        activeOpacity={0.8}
      >
        {isPlaying ? (
          <ActivityIndicator size="small" color={AppTheme.accent} />
        ) : (
          <Text style={styles.btnIcon}>▶</Text>
        )}
        <Text style={[styles.btnText, isPlaying && styles.btnTextActive]}>
          {isPlaying ? 'Playing journey' : 'Replay'}
        </Text>
      </TouchableOpacity>
      {isPlaying && progressLabel ? (
        <Text style={styles.progressLabel}>{progressLabel}</Text>
      ) : (
        <Text style={styles.hint}>Watch weeks transform the dashboard</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AppTheme.bgElevated,
    borderRadius: AppTheme.radiusPill,
    borderWidth: 1,
    borderColor: AppTheme.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  btnActive: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0,255,136,0.1)',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnIcon: {
    fontSize: 10,
    color: AppTheme.accent,
    fontWeight: '800',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppTheme.textSecondary,
  },
  btnTextActive: {
    color: AppTheme.accent,
  },
  progressLabel: {
    flex: 1,
    fontSize: 12,
    color: AppTheme.accent,
    fontWeight: '600',
  },
  hint: {
    flex: 1,
    fontSize: 12,
    color: AppTheme.textFaint,
  },
});

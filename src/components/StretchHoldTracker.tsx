import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  type StretchProtocol,
  formatStretchProtocolLabel,
  formatStretchRoundLabel,
} from '../utils/stretchLogging';
import { AppTheme } from '../theme/appVisualTheme';

type StretchHoldTrackerProps = {
  protocol: StretchProtocol;
  roundIndex: number;
  completed: boolean;
  onComplete: () => void;
  onEdit?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
};

/**
 * Stretch / mobility logging — timed holds or work/rest intervals,
 * not weight × reps. Primary action is Complete.
 */
export default function StretchHoldTracker({
  protocol,
  roundIndex,
  completed,
  onComplete,
  onEdit,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: StretchHoldTrackerProps): React.ReactElement {
  const primarySeconds =
    protocol.kind === 'hold' ? protocol.holdSeconds : protocol.workSeconds;

  return (
    <View style={[styles.card, completed && styles.cardDone]}>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {protocol.kind === 'hold' ? 'Stretch hold' : 'Stretch interval'}
          </Text>
        </View>
        {protocol.rounds > 1 ? (
          <Text style={styles.roundMeta}>
            {roundIndex + 1} / {protocol.rounds}
          </Text>
        ) : null}
      </View>

      <Text style={styles.protocolHero}>{formatStretchProtocolLabel(protocol)}</Text>
      <Text style={styles.roundDetail}>{formatStretchRoundLabel(protocol, roundIndex)}</Text>

      <View style={styles.timerVisual}>
        {protocol.kind === 'hold' ? (
          <>
            <Text style={styles.timerNumber}>{primarySeconds}</Text>
            <Text style={styles.timerUnit}>sec hold</Text>
            {protocol.perSide ? <Text style={styles.timerSide}>each side</Text> : null}
          </>
        ) : (
          <View style={styles.intervalRow}>
            <View style={styles.intervalChip}>
              <Text style={styles.intervalValue}>{protocol.workSeconds}s</Text>
              <Text style={styles.intervalLabel}>on</Text>
            </View>
            <Text style={styles.intervalSlash}>/</Text>
            <View style={styles.intervalChip}>
              <Text style={styles.intervalValue}>{protocol.restSeconds}s</Text>
              <Text style={styles.intervalLabel}>off</Text>
            </View>
          </View>
        )}
      </View>

      <Text style={styles.coachHint}>
        {protocol.kind === 'hold'
          ? 'Ease into the stretch — breathe steadily, no forcing. Tap Complete when the hold is done.'
          : 'Move through the “on” window, then relax for the “off” window. Repeat for each round.'}
      </Text>

      {(canGoPrevious || canGoNext) && protocol.rounds > 1 ? (
        <View style={styles.roundNav}>
          <Pressable
            style={[styles.roundNavBtn, !canGoPrevious && styles.roundNavDisabled]}
            onPress={onPrevious}
            disabled={!canGoPrevious}
          >
            <Text style={styles.roundNavText}>← Prev</Text>
          </Pressable>
          <Pressable
            style={[styles.roundNavBtn, !canGoNext && styles.roundNavDisabled]}
            onPress={onNext}
            disabled={!canGoNext}
          >
            <Text style={styles.roundNavText}>Next →</Text>
          </Pressable>
        </View>
      ) : null}

      {!completed ? (
        <TouchableOpacity
          style={styles.completeBtn}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onComplete();
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.completeBtnText}>
            {protocol.rounds > 1 && roundIndex < protocol.rounds - 1
              ? 'Complete'
              : 'Complete stretch'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.doneRow}>
          <View style={styles.donePill}>
            <Text style={styles.doneText}>✓ Complete</Text>
          </View>
          {onEdit ? (
            <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
              <Text style={styles.editText}>Undo</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(0,255,136,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.22)',
    padding: 18,
    marginTop: 12,
  },
  cardDone: {
    borderColor: 'rgba(0,255,136,0.45)',
    backgroundColor: 'rgba(0,255,136,0.1)',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,255,136,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.35)',
  },
  badgeText: {
    color: AppTheme.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  roundMeta: {
    color: AppTheme.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  protocolHero: {
    color: AppTheme.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  roundDetail: {
    color: AppTheme.textMuted,
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  timerVisual: {
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  timerNumber: {
    color: AppTheme.accent,
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 52,
  },
  timerUnit: {
    color: AppTheme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  timerSide: {
    color: AppTheme.textFaint,
    fontSize: 12,
    marginTop: 4,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  intervalChip: {
    alignItems: 'center',
    minWidth: 72,
  },
  intervalValue: {
    color: AppTheme.accent,
    fontSize: 32,
    fontWeight: '800',
  },
  intervalLabel: {
    color: AppTheme.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  intervalSlash: {
    color: AppTheme.textFaint,
    fontSize: 24,
    fontWeight: '700',
  },
  coachHint: {
    color: AppTheme.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  roundNav: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  roundNavBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  roundNavDisabled: { opacity: 0.35 },
  roundNavText: { color: AppTheme.textSecondary, fontWeight: '600', fontSize: 13 },
  completeBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  completeBtnText: {
    color: AppTheme.accentDark,
    fontSize: 17,
    fontWeight: '800',
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  donePill: {
    flex: 1,
    backgroundColor: 'rgba(0,255,136,0.18)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.4)',
  },
  doneText: {
    color: AppTheme.accent,
    fontSize: 16,
    fontWeight: '800',
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  editText: {
    color: AppTheme.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
});

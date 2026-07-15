import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { WarmupLogItem } from '../utils/workoutWarmupLogging';
import {
  formatStretchProtocolLabel,
  getStretchProtocol,
  isStretchLoggingExercise,
} from '../utils/stretchLogging';
import { AppTheme } from '../theme/appVisualTheme';

type WarmupBlockSessionProps = {
  items: WarmupLogItem[];
  blockComplete: boolean;
  blockLabel?: 'Warm-up' | 'Cool-down';
  onToggleItem: (itemId: string) => void;
  onCompleteAll: () => void;
};

function itemHint(item: WarmupLogItem): string | null {
  const protocol = getStretchProtocol({
    name: item.name,
    sets: 1,
    reps: item.reps,
    durationSeconds: item.durationSeconds,
    category: 'flexibility',
  });
  if (protocol) return formatStretchProtocolLabel(protocol);
  if (item.repNote) return item.repNote;
  if (item.durationSeconds != null && item.durationSeconds > 0) {
    return `~${Math.round(item.durationSeconds / 60) || 1} min · slow and controlled`;
  }
  if (item.reps != null && item.reps > 0) return `${item.reps} controlled reps`;
  return null;
}

export default function WarmupBlockSession({
  items,
  blockComplete,
  blockLabel = 'Warm-up',
  onToggleItem,
  onCompleteAll,
}: WarmupBlockSessionProps): React.ReactElement {
  const doneCount = items.filter((i) => i.completed).length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>
        Prep movement — holds and easy drills, not loaded sets. Mark each one complete when
        finished.
      </Text>
      <Text style={styles.progress}>
        {doneCount} of {items.length} movements
        {blockComplete ? ' · complete' : ''}
      </Text>

      {items.map((item) => {
        const stretch = isStretchLoggingExercise({
          name: item.name,
          reps: item.reps,
          durationSeconds: item.durationSeconds,
          category: 'flexibility',
        });
        const hint = itemHint(item);

        return (
          <View
            key={item.id}
            style={[
              styles.row,
              stretch && styles.rowStretch,
              item.completed && styles.rowDone,
            ]}
          >
            <View style={styles.rowText}>
              {stretch ? (
                <View style={styles.stretchBadge}>
                  <Text style={styles.stretchBadgeText}>Stretch</Text>
                </View>
              ) : null}
              <Text style={[styles.itemName, item.completed && styles.itemNameDone]}>
                {item.name}
              </Text>
              {hint ? <Text style={styles.itemHint}>{hint}</Text> : null}
            </View>

            {!item.completed ? (
              <Pressable
                style={[styles.completeChip, stretch && styles.completeChipStretch]}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onToggleItem(item.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Complete ${item.name}`}
              >
                <Text style={[styles.completeChipText, stretch && styles.completeChipTextStretch]}>
                  Complete
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.doneChip}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onToggleItem(item.id);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: true }}
              >
                <Text style={styles.doneChipText}>✓</Text>
              </Pressable>
            )}
          </View>
        );
      })}

      {!blockComplete && (
        <Pressable
          style={styles.completeAllBtn}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onCompleteAll();
          }}
        >
          <Text style={styles.completeAllText}>Mark {blockLabel.toLowerCase()} complete</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
  },
  lead: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  progress: {
    color: '#00ff88',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rowStretch: {
    backgroundColor: 'rgba(0,255,136,0.06)',
    borderColor: 'rgba(0,255,136,0.22)',
  },
  rowDone: {
    borderColor: 'rgba(0,255,136,0.35)',
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  stretchBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(0,255,136,0.14)',
    marginBottom: 6,
  },
  stretchBadgeText: {
    color: AppTheme.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  rowText: {
    flex: 1,
  },
  itemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  itemNameDone: {
    color: '#b8f5d4',
  },
  itemHint: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  completeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  completeChipStretch: {
    backgroundColor: AppTheme.accent,
    borderColor: AppTheme.accent,
  },
  completeChipText: {
    color: AppTheme.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  completeChipTextStretch: {
    color: AppTheme.accentDark,
  },
  doneChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,255,136,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.45)',
  },
  doneChipText: {
    color: AppTheme.accent,
    fontSize: 16,
    fontWeight: '800',
  },
  completeAllBtn: {
    marginTop: 8,
    backgroundColor: '#006644',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  completeAllText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

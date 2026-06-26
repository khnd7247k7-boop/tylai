import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { WarmupLogItem } from '../utils/workoutWarmupLogging';

type WarmupBlockSessionProps = {
  items: WarmupLogItem[];
  blockComplete: boolean;
  onToggleItem: (itemId: string) => void;
  onCompleteAll: () => void;
};

export default function WarmupBlockSession({
  items,
  blockComplete,
  onToggleItem,
  onCompleteAll,
}: WarmupBlockSessionProps) {
  const doneCount = items.filter((i) => i.completed).length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>
        Go through each movement at an easy pace. Tap to check off — no weight or reps needed.
      </Text>
      <Text style={styles.progress}>
        {doneCount} of {items.length} movements
        {blockComplete ? ' · complete' : ''}
      </Text>

      {items.map((item) => (
        <Pressable
          key={item.id}
          style={[styles.row, item.completed && styles.rowDone]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggleItem(item.id);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.completed }}
        >
          <View style={[styles.check, item.completed && styles.checkDone]}>
            <Text style={styles.checkMark}>{item.completed ? '✓' : ''}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.itemName, item.completed && styles.itemNameDone]}>{item.name}</Text>
            {item.durationSeconds != null && item.durationSeconds > 0 ? (
              <Text style={styles.itemHint}>
                ~{Math.round(item.durationSeconds / 60) || 1} min · slow and controlled
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}

      {!blockComplete && (
        <Pressable
          style={styles.completeAllBtn}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onCompleteAll();
          }}
        >
          <Text style={styles.completeAllText}>Mark warm-up complete</Text>
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
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rowDone: {
    borderColor: 'rgba(0,255,136,0.35)',
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkDone: {
    borderColor: '#00ff88',
    backgroundColor: '#00ff88',
  },
  checkMark: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
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

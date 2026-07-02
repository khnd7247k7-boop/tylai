import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppTheme } from '../theme/appVisualTheme';
import type { PlanPhaseBlock } from '../utils/workoutPhaseDisplay';

type WorkoutPhaseStructureProps = {
  blocks: PlanPhaseBlock[];
  /** Map block item to tracking exercise index (main items only). Phase blocks use blockIndex. */
  resolveExerciseIndex: (blockTitle: PlanPhaseBlock['title'], itemIndex: number) => number | undefined;
  currentExerciseIndex?: number;
  getProgressLabel?: (exerciseIndex: number) => string | undefined;
  onSelectExercise: (exerciseIndex: number) => void;
  selectable?: boolean;
};

export default function WorkoutPhaseStructure({
  blocks,
  resolveExerciseIndex,
  currentExerciseIndex,
  getProgressLabel,
  onSelectExercise,
  selectable = true,
}: WorkoutPhaseStructureProps) {
  return (
    <View style={styles.wrap}>
      {blocks.map((block) => (
        <View key={block.title} style={styles.block}>
          <Text style={styles.blockTitle}>{block.title}</Text>
          {block.compact ? (
            <PhaseCompactList
              block={block}
              selectable={selectable}
              currentExerciseIndex={currentExerciseIndex}
              resolveExerciseIndex={resolveExerciseIndex}
              getProgressLabel={getProgressLabel}
              onSelectExercise={onSelectExercise}
            />
          ) : (
            block.items.map((item, itemIndex) => {
              const exerciseIndex = resolveExerciseIndex(block.title, itemIndex);
              const isActive = exerciseIndex != null && currentExerciseIndex === exerciseIndex;
              const progress = exerciseIndex != null ? getProgressLabel?.(exerciseIndex) : undefined;
              const line =
                item.sets != null && item.reps != null && item.reps > 0
                  ? `${item.name} — ${item.sets}×${item.reps}`
                  : item.name;

              const content = (
                <View style={[styles.mainRow, isActive && styles.mainRowActive]}>
                  <Text style={[styles.mainLine, isActive && styles.mainLineActive]}>{line}</Text>
                  {progress ? <Text style={styles.progress}>{progress}</Text> : null}
                </View>
              );

              if (!selectable || exerciseIndex == null) {
                return (
                  <View key={`${item.name}-${itemIndex}`} style={styles.mainItem}>
                    {content}
                  </View>
                );
              }

              return (
                <Pressable
                  key={`${item.name}-${itemIndex}`}
                  onPress={() => onSelectExercise(exerciseIndex)}
                  style={styles.mainItem}
                >
                  {content}
                </Pressable>
              );
            })
          )}
        </View>
      ))}
    </View>
  );
}

function PhaseCompactList({
  block,
  selectable,
  currentExerciseIndex,
  resolveExerciseIndex,
  getProgressLabel,
  onSelectExercise,
}: {
  block: PlanPhaseBlock;
  selectable: boolean;
  currentExerciseIndex?: number;
  resolveExerciseIndex: WorkoutPhaseStructureProps['resolveExerciseIndex'];
  getProgressLabel?: WorkoutPhaseStructureProps['getProgressLabel'];
  onSelectExercise: (exerciseIndex: number) => void;
}) {
  const blockIndex = resolveExerciseIndex(block.title, 0);
  const isActive = blockIndex != null && currentExerciseIndex === blockIndex;
  const progress = blockIndex != null ? getProgressLabel?.(blockIndex) : undefined;
  const names = block.items.map((item) => item.name).join(' · ');

  const inner = (
    <View style={[styles.compactCard, isActive && styles.compactCardActive]}>
      <Text style={styles.compactList}>{names}</Text>
      {progress ? <Text style={styles.progress}>{progress}</Text> : null}
    </View>
  );

  if (!selectable || blockIndex == null) {
    return inner;
  }

  return <Pressable onPress={() => onSelectExercise(blockIndex)}>{inner}</Pressable>;
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  block: {
    marginBottom: 4,
  },
  blockTitle: {
    color: AppTheme.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  compactCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
  },
  compactCardActive: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  compactList: {
    color: AppTheme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  mainItem: {
    marginBottom: 6,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  mainRowActive: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  mainLine: {
    color: AppTheme.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  mainLineActive: {
    color: AppTheme.accent,
    fontWeight: '700',
  },
  progress: {
    color: AppTheme.textFaint,
    fontSize: 12,
    marginLeft: 8,
  },
});

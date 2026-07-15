import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function QuestionBlock({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function SelectChip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ChipGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

/** Shown when Continue / Save is disabled so users know what is still required. */
export function ContinueRequirementHint({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;
  return (
    <View style={styles.requirementCard} accessibilityRole="text">
      <Text style={styles.requirementTitle}>To continue, complete:</Text>
      {issues.map((issue) => (
        <Text key={issue} style={styles.requirementLine}>
          • {issue}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 22,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  hint: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 20,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
  },
  chipSelected: {
    backgroundColor: '#3d5a80',
    borderColor: '#5a8fd4',
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    color: '#ccc',
    fontSize: 14,
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  requirementCard: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  requirementTitle: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  requirementLine: {
    color: '#e5e7eb',
    fontSize: 13,
    lineHeight: 18,
  },
});

export const nutritionFormStyles = StyleSheet.create({
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#444',
    color: '#fff',
    padding: 12,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  textArea: {
    minHeight: 88,
  },
  sectionHeading: {
    color: '#5a8fd4',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

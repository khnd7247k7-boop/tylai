import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { REST_DURATION_PRESETS } from '../utils/exerciseRestTimer';

interface RestDurationPickerProps {
  valueSeconds: number;
  onChange: (seconds: number) => void;
  suggestedSeconds?: number;
}

export default function RestDurationPicker({
  valueSeconds,
  onChange,
  suggestedSeconds,
}: RestDurationPickerProps) {
  return (
    <View style={styles.wrap}>
      {REST_DURATION_PRESETS.map((preset) => {
        const selected = valueSeconds === preset.seconds;
        const suggested = !selected && suggestedSeconds === preset.seconds;
        return (
          <TouchableOpacity
            key={preset.seconds}
            style={[styles.chip, selected && styles.chipSelected, suggested && styles.chipSuggested]}
            onPress={() => onChange(preset.seconds)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={
              suggested ? `Suggested rest ${preset.label}` : `Rest ${preset.label}`
            }
          >
            <Text
              style={[
                styles.chipText,
                selected && styles.chipTextSelected,
                suggested && styles.chipTextSuggested,
              ]}
            >
              {preset.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
  },
  chipSelected: {
    backgroundColor: '#143d2a',
    borderColor: '#00ff88',
  },
  chipSuggested: {
    borderColor: '#6aae88',
    backgroundColor: '#1b2a22',
  },
  chipText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#00ff88',
  },
  chipTextSuggested: {
    color: '#9ad9b0',
  },
});

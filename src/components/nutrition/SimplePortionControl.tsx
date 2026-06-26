import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppTheme } from '../../theme/appVisualTheme';
import {
  NATURAL_FRACTION_FINE_STEP,
  NATURAL_FRACTION_PRESETS,
  clampNaturalFraction,
  formatHumanFraction,
} from '../../utils/wholeFoodPortions';

export type SimplePortionControlProps = {
  fraction: number;
  onFractionChange: (next: number) => void;
  wholeName: string;
  /** When false, control is hidden by parent; still safe to render null from parent. */
  visible?: boolean;
};

/**
 * Chips for common fractions + fine − / + (no extra native deps).
 */
export function SimplePortionControl({
  fraction,
  onFractionChange,
  wholeName,
  visible = true,
}: SimplePortionControlProps) {
  if (!visible) return null;
  const f = clampNaturalFraction(fraction);
  const label = formatHumanFraction(f, wholeName);

  const apply = (next: number) => onFractionChange(clampNaturalFraction(next));

  return (
    <View style={styles.wrap}>
      <Text style={styles.preview}>{label}</Text>
      <View style={styles.row}>
        {NATURAL_FRACTION_PRESETS.map((preset) => {
          const on = Math.abs(f - preset) < 0.02;
          return (
            <TouchableOpacity
              key={String(preset)}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => apply(preset)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={formatHumanFraction(preset, wholeName)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{fractionChipGlyph(preset)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.fineRow}>
        <Text style={styles.fineLabel}>Fine</Text>
        <TouchableOpacity
          style={styles.fineBtn}
          onPress={() => apply(f - NATURAL_FRACTION_FINE_STEP)}
          accessibilityLabel="Decrease portion slightly"
        >
          <Text style={styles.fineBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.fineValue}>{f.toFixed(2)}</Text>
        <TouchableOpacity
          style={styles.fineBtn}
          onPress={() => apply(f + NATURAL_FRACTION_FINE_STEP)}
          accessibilityLabel="Increase portion slightly"
        >
          <Text style={styles.fineBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function fractionChipGlyph(preset: number): string {
  if (Math.abs(preset - 0.25) < 0.02) return '¼';
  if (Math.abs(preset - 1 / 3) < 0.02) return '⅓';
  if (Math.abs(preset - 0.5) < 0.02) return '½';
  if (Math.abs(preset - 2 / 3) < 0.02) return '⅔';
  if (Math.abs(preset - 0.75) < 0.02) return '¾';
  if (Math.abs(preset - 1) < 0.02) return '1';
  return String(preset);
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: AppTheme.borderMuted,
  },
  preview: {
    fontSize: 14,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    minWidth: 44,
    alignItems: 'center',
  },
  chipOn: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '800',
    color: AppTheme.textSecondary,
  },
  chipTextOn: {
    color: AppTheme.accent,
  },
  fineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  fineLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: AppTheme.textMuted,
    marginRight: 4,
  },
  fineBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fineBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: AppTheme.textPrimary,
  },
  fineValue: {
    minWidth: 44,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: AppTheme.textSecondary,
  },
});

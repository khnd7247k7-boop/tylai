import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppTheme } from '../../theme/appVisualTheme';
import { ScrollWheelPicker } from '../ScrollWheelPicker';
import {
  LOG_FOOD_SERVING_UNIT_OPTIONS,
  type LogFoodServingUnit,
} from '../../utils/logFoodPortionScale';

/** Matches `logFoodStepBtn` (40) + gaps (12) + `logFoodStepperInput` minWidth (56) + second gap + btn. */
export const LOG_FOOD_STEPPER_CONTROL_WIDTH = 148;
const WHEEL_ITEM_HEIGHT = 30;
const WHEEL_PADDING_ITEMS = 1;
const WHEEL_VISIBLE_HEIGHT = WHEEL_ITEM_HEIGHT * (WHEEL_PADDING_ITEMS * 2 + 1);

interface ServingTypeWheelPickerProps {
  value: LogFoodServingUnit;
  onChange: (unit: LogFoodServingUnit) => void;
}

export function ServingTypeWheelPicker({ value, onChange }: ServingTypeWheelPickerProps) {
  const labels = useMemo(
    () => LOG_FOOD_SERVING_UNIT_OPTIONS.map((o) => o.label),
    []
  );
  const selectedIndex = useMemo(() => {
    const idx = LOG_FOOD_SERVING_UNIT_OPTIONS.findIndex((o) => o.unit === value);
    return idx >= 0 ? idx : 0;
  }, [value]);

  const handleSelect = useCallback(
    (index: number) => {
      const next = LOG_FOOD_SERVING_UNIT_OPTIONS[index]?.unit;
      if (next && next !== value) onChange(next);
    },
    [onChange, value]
  );

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Serving type</Text>
      <View style={styles.control}>
        <ScrollWheelPicker
          items={labels}
          selectedIndex={selectedIndex}
          onSelect={handleSelect}
          width={LOG_FOOD_STEPPER_CONTROL_WIDTH}
          itemHeight={WHEEL_ITEM_HEIGHT}
          paddingItems={WHEEL_PADDING_ITEMS}
          fontSize={16}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textSecondary,
    flex: 1,
  },
  control: {
    width: LOG_FOOD_STEPPER_CONTROL_WIDTH,
    height: WHEEL_VISIBLE_HEIGHT,
    borderRadius: 10,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    overflow: 'hidden',
  },
});

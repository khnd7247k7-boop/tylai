import React, { useEffect, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppTheme } from '../theme/appVisualTheme';

export const NUMERIC_INPUT_ACCESSORY_ID = 'tylNumericPadAccessory';

export type NumericAccessoryChain = {
  focusPrev?: () => void;
  focusNext?: () => void;
};

let chain: NumericAccessoryChain = {};
const listeners = new Set<() => void>();

export function setNumericAccessoryChain(next: NumericAccessoryChain): void {
  chain = next;
  listeners.forEach((listener) => listener());
}

/** iOS decimal/number pads have no Return key — this bar sits above the keyboard. */
export function NumericInputAccessory(): React.ReactElement | null {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (Platform.OS !== 'ios') return null;

  const prevDisabled = !chain.focusPrev;
  const nextDisabled = !chain.focusNext;

  return (
    <InputAccessoryView nativeID={NUMERIC_INPUT_ACCESSORY_ID} backgroundColor={AppTheme.card}>
      <View style={styles.bar}>
        <TouchableOpacity
          onPress={() => chain.focusPrev?.()}
          disabled={prevDisabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Previous field"
        >
          <Text style={[styles.nav, prevDisabled && styles.navDisabled]}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => chain.focusNext?.()}
          disabled={nextDisabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Next field"
        >
          <Text style={[styles.nav, nextDisabled && styles.navDisabled]}>Next</Text>
        </TouchableOpacity>
        <View style={styles.spacer} />
        <TouchableOpacity
          onPress={() => Keyboard.dismiss()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss keyboard"
        >
          <Text style={styles.done}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppTheme.border,
    backgroundColor: AppTheme.card,
    gap: 16,
  },
  nav: {
    fontSize: 16,
    fontWeight: '600',
    color: AppTheme.textPrimary,
  },
  navDisabled: {
    color: AppTheme.textFaint,
  },
  spacer: {
    flex: 1,
  },
  done: {
    fontSize: 16,
    fontWeight: '800',
    color: AppTheme.accent,
  },
});

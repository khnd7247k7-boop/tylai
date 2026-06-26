import React, { type ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Flex layout shell for forms. Intentionally does NOT wrap children in a Pressable —
 * that pattern steals long-press / selection gestures from TextInput and blocks copy-paste menus.
 * Use `tapOutsideToDismissKeyboard` on modal backdrops or ScrollView `keyboardDismissMode` instead.
 */
export function DismissKeyboardSurface({ children, style }: Props) {
  return <View style={[styles.fill, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

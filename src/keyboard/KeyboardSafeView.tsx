import React from 'react';
import { View, KeyboardAvoidingView, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** iOS only — offset for nav/status bars */
  keyboardVerticalOffset?: number;
};

/**
 * Full-screen (or flex) wrapper for forms: iOS uses KeyboardAvoidingView; Android relies on
 * `softwareKeyboardLayoutMode: resize` in app.json so the window shrinks.
 */
export function KeyboardSafeView({ children, style, keyboardVerticalOffset = 0 }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        behavior="padding"
        style={[styles.flex, style]}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }
  return <View style={[styles.flex, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

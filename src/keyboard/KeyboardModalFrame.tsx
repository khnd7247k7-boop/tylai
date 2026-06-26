import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useKeyboardInsets } from './KeyboardInsetsContext';

type Props = {
  children: React.ReactNode;
  /** Centered dialogs vs bottom sheets */
  justifyContent?: 'center' | 'flex-end';
  style?: StyleProp<ViewStyle>;
};

/**
 * Use as the root child of a `Modal` (flex:1). iOS: padding avoidance; Android: bottom inset
 * from global keyboard height because modals do not participate in window resize.
 */
export function KeyboardModalFrame({
  children,
  justifyContent = 'flex-end',
  style,
}: Props) {
  const { keyboardHeight } = useKeyboardInsets();

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        { justifyContent },
        Platform.OS === 'android' && keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : null,
        style,
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

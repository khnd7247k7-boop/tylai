import React from 'react';
import { View, StyleSheet } from 'react-native';

interface SmoothTransitionProps {
  children: React.ReactNode;
  isVisible?: boolean;
  /** @deprecated No animation — kept for call-site compatibility */
  duration?: number;
  /** @deprecated No animation — kept for call-site compatibility */
  direction?: 'slideInRight' | 'slideInLeft' | 'fadeIn' | 'scaleIn';
}

/**
 * Screen wrapper: renders children immediately (no slide/fade/scale).
 * Props `duration` / `direction` are ignored; App.tsx still passes them for readability.
 */
export default function SmoothTransition({ children }: SmoothTransitionProps) {
  return <View style={styles.fill}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

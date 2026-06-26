import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Wrapper for multi-tab screens (Fitness, Mental, Emotional, Spiritual).
 *
 * Previously this used a full-screen horizontal PanResponder to change tabs.
 * That stole gestures from nested horizontal ScrollViews, charts, sliders,
 * and diagonal vertical scrolls. Tab changes are via the tab bar only; inner
 * horizontal scroll views keep exclusive control of sideways movement.
 */
interface TabSwipeNavigationProps {
  children: React.ReactNode;
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function TabSwipeNavigation({
  children,
  tabs: _tabs,
  activeTab: _activeTab,
  onTabChange: _onTabChange,
}: TabSwipeNavigationProps) {
  return <View style={styles.fill}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

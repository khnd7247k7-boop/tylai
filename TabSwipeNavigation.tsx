import React, { useRef, useState } from 'react';
import { Animated, PanResponder, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

interface TabSwipeNavigationProps {
  children: React.ReactNode;
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function TabSwipeNavigation({
  children,
  tabs,
  activeTab,
  onTabChange,
}: TabSwipeNavigationProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isSwipeInProgress, setIsSwipeInProgress] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes when not scrolling vertically
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && 
               Math.abs(gestureState.dx) > 15 &&
               !isSwipeInProgress;
      },
      onPanResponderGrant: () => {
        setIsSwipeInProgress(true);
        translateX.setOffset(translateX._value);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Limit swipe distance
        const maxSwipe = screenWidth * 0.2;
        const clampedDx = Math.max(-maxSwipe, Math.min(maxSwipe, gestureState.dx));
        translateX.setValue(clampedDx);
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsSwipeInProgress(false);
        translateX.flattenOffset();
        
        const currentIndex = tabs.indexOf(activeTab);
        const swipeThreshold = screenWidth * 0.15;
        
        if (gestureState.dx > swipeThreshold && currentIndex > 0) {
          // Swipe right - go to previous tab
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const newTab = tabs[currentIndex - 1];
          onTabChange(newTab);
        } else if (gestureState.dx < -swipeThreshold && currentIndex < tabs.length - 1) {
          // Swipe left - go to next tab
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const newTab = tabs[currentIndex + 1];
          onTabChange(newTab);
        }
        
        // Snap back to original position
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={{
        flex: 1,
        transform: [{ translateX }],
      }}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

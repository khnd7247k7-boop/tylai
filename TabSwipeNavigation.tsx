import React, { useRef, useState } from 'react';
import { Animated, PanResponder, Dimensions, Platform } from 'react-native';

// Haptics wrapper: noop on web to avoid web bundle issues
let Haptics: any = {
  impactAsync: async () => {},
};

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Haptics = require('expo-haptics');
  } catch (error) {
    console.warn('Haptics module not available:', error);
  }
}

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
               translateX.setOffset((translateX as any)._value);
               translateX.setValue(0);
             },
      onPanResponderMove: (_, gestureState) => {
        // Limit swipe distance with smoother curve
        const maxSwipe = screenWidth * 0.25;
        const clampedDx = Math.max(-maxSwipe, Math.min(maxSwipe, gestureState.dx));
        
        // Apply smooth easing curve to the translation
        const progress = Math.abs(clampedDx) / maxSwipe;
        const easedProgress = 1 - Math.pow(1 - progress, 2); // Quadratic ease-out
        const finalDx = clampedDx * easedProgress;
        
        translateX.setValue(finalDx);
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
        
        // Snap back to original position with smoother spring
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 140,
          friction: 10,
          overshootClamping: true,
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

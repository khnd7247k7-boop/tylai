import React, { useRef } from 'react';
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

interface SwipeNavigationProps {
  children: React.ReactNode;
  onSwipeBack?: () => void;
  onSwipeForward?: () => void;
  swipeThreshold?: number;
  enableSwipeBack?: boolean;
  enableSwipeForward?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export default function SwipeNavigation({
  children,
  onSwipeBack,
  onSwipeForward,
  swipeThreshold = 100,
  enableSwipeBack = true,
  enableSwipeForward = false,
}: SwipeNavigationProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && 
               Math.abs(gestureState.dx) > 10;
      },
             onPanResponderGrant: () => {
               // Reset any ongoing animations
               translateX.setOffset((translateX as any)._value);
               translateX.setValue(0);
             },
      onPanResponderMove: (_, gestureState) => {
        // Only allow swiping in enabled directions
        if (gestureState.dx > 0 && !enableSwipeBack) return;
        if (gestureState.dx < 0 && !enableSwipeForward) return;
        
        // Limit the swipe distance with smoother curve
        const maxSwipe = screenWidth * 0.4;
        const clampedDx = Math.max(-maxSwipe, Math.min(maxSwipe, gestureState.dx));
        
        // Apply smooth easing curve to the translation
        const progress = Math.abs(clampedDx) / maxSwipe;
        const easedProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
        const finalDx = clampedDx * easedProgress;
        
        translateX.setValue(finalDx);
        
        // Smoother opacity effect - no white flash
        const opacityProgress = Math.abs(finalDx) / maxSwipe;
        opacity.setValue(1 - opacityProgress * 0.15); // Reduced opacity change
      },
      onPanResponderRelease: (_, gestureState) => {
        translateX.flattenOffset();
        
        // Determine if swipe threshold was met
        const shouldSwipeBack = gestureState.dx > swipeThreshold && enableSwipeBack;
        const shouldSwipeForward = gestureState.dx < -swipeThreshold && enableSwipeForward;
        
        if (shouldSwipeBack && onSwipeBack) {
          // Provide haptic feedback
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          
          // Animate out to the right
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: screenWidth,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onSwipeBack();
            // Reset values for next use
            translateX.setValue(0);
            opacity.setValue(1);
          });
        } else if (shouldSwipeForward && onSwipeForward) {
          // Provide haptic feedback
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          
          // Animate out to the left
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: -screenWidth,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onSwipeForward();
            // Reset values for next use
            translateX.setValue(0);
            opacity.setValue(1);
          });
        } else {
          // Snap back to original position with smoother spring
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 120,
              friction: 9,
              overshootClamping: true,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              useNativeDriver: true,
              tension: 120,
              friction: 9,
              overshootClamping: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={{
        flex: 1,
        transform: [{ translateX }],
        opacity,
      }}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

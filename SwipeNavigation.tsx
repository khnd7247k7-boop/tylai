import React, { useRef } from 'react';
import { Animated, PanResponder, Dimensions, Platform, View } from 'react-native';

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
const EDGE_SWIPE_ZONE_PX = 28;

type SwipeOpts = {
  enableSwipeBack: boolean;
  enableSwipeForward: boolean;
  swipeThreshold: number;
  onSwipeBack?: () => void;
  onSwipeForward?: () => void;
};

export default function SwipeNavigation({
  children,
  onSwipeBack,
  onSwipeForward,
  swipeThreshold = 100,
  enableSwipeBack = false,
  enableSwipeForward = false,
}: SwipeNavigationProps) {
  const gestureEnabled = enableSwipeBack || enableSwipeForward;
  const optsRef = useRef<SwipeOpts>({
    enableSwipeBack,
    enableSwipeForward,
    swipeThreshold,
    onSwipeBack,
    onSwipeForward,
  });
  optsRef.current = {
    enableSwipeBack,
    enableSwipeForward,
    swipeThreshold,
    onSwipeBack,
    onSwipeForward,
  };

  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { enableSwipeBack: backOn, enableSwipeForward: fwdOn } = optsRef.current;
        const isHorizontalSwipe =
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 10;
        if (!isHorizontalSwipe) return false;

        if (gestureState.dx > 0 && backOn) {
          return gestureState.x0 <= EDGE_SWIPE_ZONE_PX;
        }

        if (gestureState.dx < 0 && fwdOn) {
          return gestureState.x0 >= screenWidth - EDGE_SWIPE_ZONE_PX;
        }

        return false;
      },
      onPanResponderGrant: () => {
        translateX.setOffset((translateX as any)._value);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const { enableSwipeBack: backOn, enableSwipeForward: fwdOn } = optsRef.current;
        if (gestureState.dx > 0 && !backOn) return;
        if (gestureState.dx < 0 && !fwdOn) return;

        const maxSwipe = screenWidth * 0.4;
        const clampedDx = Math.max(-maxSwipe, Math.min(maxSwipe, gestureState.dx));

        const progress = Math.abs(clampedDx) / maxSwipe;
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const finalDx = clampedDx * easedProgress;

        translateX.setValue(finalDx);

        const opacityProgress = Math.abs(finalDx) / maxSwipe;
        opacity.setValue(1 - opacityProgress * 0.15);
      },
      onPanResponderRelease: (_, gestureState) => {
        translateX.flattenOffset();

        const o = optsRef.current;
        const shouldSwipeBack = gestureState.dx > o.swipeThreshold && o.enableSwipeBack;
        const shouldSwipeForward = gestureState.dx < -o.swipeThreshold && o.enableSwipeForward;

        if (shouldSwipeBack && o.onSwipeBack) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          translateX.setValue(screenWidth);
          opacity.setValue(0);
          o.onSwipeBack?.();
          translateX.setValue(0);
          opacity.setValue(1);
        } else if (shouldSwipeForward && o.onSwipeForward) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          translateX.setValue(-screenWidth);
          opacity.setValue(0);
          o.onSwipeForward?.();
          translateX.setValue(0);
          opacity.setValue(1);
        } else {
          translateX.setValue(0);
          opacity.setValue(1);
        }
      },
    })
  ).current;

  if (!gestureEnabled) {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

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

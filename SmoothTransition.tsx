import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

interface SmoothTransitionProps {
  children: React.ReactNode;
  isVisible: boolean;
  duration?: number;
  direction?: 'slideInRight' | 'slideInLeft' | 'fadeIn' | 'scaleIn';
}

export default function SmoothTransition({
  children,
  isVisible,
  duration = 300,
  direction = 'slideInRight',
}: SmoothTransitionProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      // Animate in
      Animated.parallel([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1), // iOS-style easing
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: duration * 0.8,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1), // iOS-style easing
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: duration * 0.7,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1), // iOS-style easing
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: duration * 0.5,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1), // iOS-style easing
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, duration]);

  const getTransform = () => {
    const { width: screenWidth } = require('react-native').Dimensions.get('window');
    
    switch (direction) {
      case 'slideInRight':
        return {
          transform: [
            {
              translateX: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [screenWidth, 0],
              }),
            },
          ],
        };
      case 'slideInLeft':
        return {
          transform: [
            {
              translateX: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [-screenWidth, 0],
              }),
            },
          ],
        };
      case 'scaleIn':
        return {
          transform: [
            {
              scale: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
        };
      case 'fadeIn':
      default:
        return {};
    }
  };

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          opacity,
        },
        getTransform(),
      ]}
    >
      {children}
    </Animated.View>
  );
}

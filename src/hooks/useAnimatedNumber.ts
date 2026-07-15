import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

/** Smoothly counts a displayed number toward `value` when it changes. */
export function useAnimatedNumber(
  value: number | null,
  options: { duration?: number; decimals?: number } = {}
): number | null {
  const duration = options.duration ?? 700;
  const decimals = options.decimals ?? 0;
  const progress = useRef(new Animated.Value(value ?? 0)).current;
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (value == null || !Number.isFinite(value)) {
      setDisplay(null);
      return;
    }
    const listener = progress.addListener(({ value: v }) => {
      const factor = 10 ** decimals;
      setDisplay(Math.round(v * factor) / factor);
    });
    Animated.timing(progress, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => progress.removeListener(listener);
  }, [decimals, duration, progress, value]);

  return display;
}

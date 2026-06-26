import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppTheme } from '../theme/appVisualTheme';

const DEFAULT_ITEM_HEIGHT = 44;
const DEFAULT_PADDING_ITEMS = 2;

function opacityForDistance(distance: number): number {
  if (distance <= 0) return 1;
  if (distance === 1) return 0.52;
  return 0.28;
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, index));
}

function indexFromOffset(y: number, itemHeight: number, length: number): number {
  return clampIndex(Math.round(y / itemHeight), length);
}

interface ScrollWheelPickerProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width?: number;
  itemHeight?: number;
  paddingItems?: number;
  fontSize?: number;
}

export function ScrollWheelPicker({
  items,
  selectedIndex,
  onSelect,
  width = 72,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  paddingItems = DEFAULT_PADDING_ITEMS,
  fontSize = 18,
}: ScrollWheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [focusedIndex, setFocusedIndex] = useState(() => clampIndex(selectedIndex, items.length));

  const interactingRef = useRef(false);
  const committedIndexRef = useRef(clampIndex(selectedIndex, items.length));
  const skipNextSyncRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      const clamped = clampIndex(index, items.length);
      scrollRef.current?.scrollTo({ y: clamped * itemHeight, animated });
      committedIndexRef.current = clamped;
      setFocusedIndex(clamped);
    },
    [itemHeight, items.length]
  );

  useEffect(() => {
    if (items.length === 0) return;
    if (interactingRef.current) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const clamped = clampIndex(selectedIndex, items.length);
    if (clamped === committedIndexRef.current) return;
    scrollToIndex(clamped, false);
  }, [items.length, selectedIndex, scrollToIndex]);

  const commitOffset = useCallback(
    (y: number) => {
      const clamped = indexFromOffset(y, itemHeight, items.length);
      const targetY = clamped * itemHeight;

      interactingRef.current = false;
      committedIndexRef.current = clamped;
      setFocusedIndex(clamped);

      if (Math.abs(y - targetY) > 0.5) {
        scrollRef.current?.scrollTo({ y: targetY, animated: false });
      }

      if (clamped !== selectedIndex) {
        skipNextSyncRef.current = true;
        onSelect(clamped);
      }
    },
    [itemHeight, items.length, onSelect, selectedIndex]
  );

  const scheduleCommit = useCallback(
    (y: number) => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        commitOffset(y);
      }, 32);
    },
    [commitOffset]
  );

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const clamped = indexFromOffset(event.nativeEvent.contentOffset.y, itemHeight, items.length);
    setFocusedIndex((prev) => (prev === clamped ? prev : clamped));
  };

  const onScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const vy = event.nativeEvent.velocity?.y ?? 0;
    if (Platform.OS === 'android' || Math.abs(vy) < 0.2) {
      scheduleCommit(event.nativeEvent.contentOffset.y);
    }
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scheduleCommit(event.nativeEvent.contentOffset.y);
  };

  if (items.length === 0) {
    return <View style={[styles.container, { width }]} />;
  }

  const wheelHeight = itemHeight * (paddingItems * 2 + 1);

  return (
    <View style={[styles.container, { width, height: wheelHeight }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        nestedScrollEnabled
        bounces={false}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingVertical: itemHeight * paddingItems }}
        onScrollBeginDrag={() => {
          interactingRef.current = true;
          if (settleTimerRef.current) {
            clearTimeout(settleTimerRef.current);
            settleTimerRef.current = null;
          }
        }}
        onScroll={onScroll}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {items.map((label, index) => {
          const distance = Math.abs(index - focusedIndex);
          const isSelected = distance === 0;
          return (
            <View key={`${label}-${index}`} style={[styles.item, { height: itemHeight }]}>
              <Text
                style={[
                  styles.itemText,
                  {
                    fontSize,
                    opacity: opacityForDistance(distance),
                    fontWeight: isSelected ? '700' : '500',
                    color: isSelected ? '#fff' : '#9ca3af',
                  },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.selectionBand,
          { top: itemHeight * paddingItems, height: itemHeight },
        ]}
        pointerEvents="none"
      />
      <View
        style={[styles.edgeFade, styles.edgeFadeTop, { height: itemHeight * paddingItems }]}
        pointerEvents="none"
      />
      <View
        style={[styles.edgeFade, styles.edgeFadeBottom, { height: itemHeight * paddingItems }]}
        pointerEvents="none"
      />
      {items.length > 1 && paddingItems > 0 ? (
        <View style={styles.chevronLayer} pointerEvents="none">
          <Text style={[styles.chevron, styles.chevronTop]}>▲</Text>
          <Text style={[styles.chevron, styles.chevronBottom]}>▼</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  itemText: {
    textAlign: 'center',
  },
  selectionBand: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.45)',
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    borderRadius: 6,
  },
  edgeFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: AppTheme.inputBg,
    opacity: 0.32,
    zIndex: 1,
  },
  chevronLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  edgeFadeTop: {
    top: 0,
  },
  edgeFadeBottom: {
    bottom: 0,
  },
  chevron: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: 'rgba(0, 255, 136, 0.55)',
    fontWeight: '700',
  },
  chevronTop: {
    top: Platform.OS === 'ios' ? 2 : 1,
  },
  chevronBottom: {
    bottom: Platform.OS === 'ios' ? 2 : 1,
  },
});

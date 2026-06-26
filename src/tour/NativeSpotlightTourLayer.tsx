import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import {
  expandNativeRect,
  NATIVE_OVERLAY_BG,
  NATIVE_POPOVER_WIDTH,
  NATIVE_VIEWPORT_MARGIN,
} from './nativeGeometry';
import type { HighlightRect, PopoverPosition } from './types';

const OVERLAY_Z = 200002;

function spotlightRadius(shape: 'rect' | 'circle', hole: HighlightRect): number {
  if (shape === 'circle') return Math.max(hole.width, hole.height) / 2;
  return 12;
}

type SpotlightPanelsProps = {
  rect: HighlightRect | null;
  padding: number;
  shape: 'rect' | 'circle';
};

function SpotlightPanels({ rect, padding, shape }: SpotlightPanelsProps) {
  const { width: vw, height: vh } = Dimensions.get('window');

  if (!rect) {
    return <View style={[styles.fullDim, { zIndex: OVERLAY_Z }]} pointerEvents="auto" />;
  }

  const hole = expandNativeRect(rect, padding);
  const radius = spotlightRadius(shape, hole);
  const centerX = hole.left + hole.width / 2;
  const centerY = hole.top + hole.height / 2;

  const ringStyle: ViewStyle =
    shape === 'circle'
      ? {
          top: centerY - radius,
          left: centerX - radius,
          width: radius * 2,
          height: radius * 2,
          borderRadius: radius,
        }
      : {
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          borderRadius: radius,
        };

  return (
    <>
      <View style={[styles.panel, { top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }]} />
      <View
        style={[
          styles.panel,
          { top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height },
        ]}
      />
      <View
        style={[
          styles.panel,
          {
            top: hole.top,
            left: hole.left + hole.width,
            width: Math.max(0, vw - hole.left - hole.width),
            height: hole.height,
          },
        ]}
      />
      <View
        style={[
          styles.panel,
          { top: hole.top + hole.height, left: 0, right: 0, height: Math.max(0, vh - hole.top - hole.height) },
        ]}
      />
      <View pointerEvents="none" style={[styles.spotlightRing, ringStyle, { zIndex: OVERLAY_Z + 1 }]} />
    </>
  );
}

type TourPopoverProps = {
  stepIndex: number;
  totalSteps: number;
  title: string;
  content: string;
  emoji?: string;
  popoverVariant: 'tooltip' | 'hero';
  position: PopoverPosition | null;
  isBlockedWaitingForInput: boolean;
  tapPrompt: string;
  showNext: boolean;
  showBack: boolean;
  isLast: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

function PopoverArrow({
  placement,
  offsetX,
  hero,
}: {
  placement: PopoverPosition['placement'];
  offsetX?: number;
  hero?: boolean;
}) {
  if (hero) return null;
  const arrowStyle =
    placement === 'bottom'
      ? styles.arrowBottom
      : placement === 'top'
        ? styles.arrowTop
        : placement === 'left'
          ? styles.arrowLeft
          : styles.arrowRight;
  return (
    <View
      style={[
        styles.arrowBase,
        arrowStyle,
        offsetX != null ? { left: offsetX - 8, alignSelf: 'flex-start' as const } : null,
      ]}
    />
  );
}

function TourPopover({
  stepIndex,
  totalSteps,
  title,
  content,
  emoji,
  popoverVariant,
  position,
  isBlockedWaitingForInput,
  tapPrompt,
  showNext,
  showBack,
  isLast,
  onNext,
  onBack,
  onSkip,
}: TourPopoverProps) {
  const { width: vw, height: vh } = Dimensions.get('window');
  const isHero = popoverVariant === 'hero';
  const basePos = position ?? {
    top: Math.max(NATIVE_VIEWPORT_MARGIN, vh / 2 - 150),
    left: Math.max(NATIVE_VIEWPORT_MARGIN, vw / 2 - NATIVE_POPOVER_WIDTH / 2),
    placement: 'bottom' as const,
  };
  const [pos, setPos] = useState(basePos);

  useEffect(() => {
    setPos(basePos);
  }, [basePos.top, basePos.left, basePos.placement, title, content, isBlockedWaitingForInput, showNext, showBack, popoverVariant]);

  const clampPopoverOnLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const margin = NATIVE_VIEWPORT_MARGIN;
    let nextTop = pos.top;
    let nextLeft = pos.left;

    if (pos.left + width > vw - margin) nextLeft = vw - margin - width;
    if (nextLeft < margin) nextLeft = margin;
    if (pos.top + height > vh - margin) nextTop = vh - margin - height;
    if (nextTop < margin) nextTop = margin;

    if (nextTop !== pos.top || nextLeft !== pos.left) {
      setPos((prev) => ({ ...prev, top: nextTop, left: nextLeft }));
    }
  };

  return (
    <View
      accessibilityRole="alert"
      accessibilityViewIsModal
      onLayout={clampPopoverOnLayout}
      style={[
        isHero ? styles.heroPopover : styles.popover,
        { top: pos.top, left: pos.left, zIndex: OVERLAY_Z + 2, maxWidth: vw - NATIVE_VIEWPORT_MARGIN * 2 },
      ]}
    >
      <PopoverArrow placement={pos.placement} offsetX={pos.arrowOffsetX} hero={isHero} />

      {isHero ? (
        <>
          {emoji ? <Text style={styles.heroEmoji}>{emoji}</Text> : null}
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroContent}>{content}</Text>
        </>
      ) : (
        <View style={styles.tooltipRow}>
          {emoji ? (
            <View style={styles.tooltipIconWrap}>
              <Text style={styles.tooltipIcon}>{emoji}</Text>
            </View>
          ) : null}
          <View style={styles.tooltipTextCol}>
            <Text style={styles.popoverTitle}>{title}</Text>
            <Text style={styles.popoverContent}>{content}</Text>
          </View>
        </View>
      )}

      {isBlockedWaitingForInput ? (
        <Text style={isHero ? styles.heroTapPrompt : styles.tapPrompt}>{tapPrompt}</Text>
      ) : null}

      {isHero && showNext ? (
        <View style={styles.heroFooter}>
          <Pressable accessibilityRole="button" onPress={onSkip} style={({ pressed }) => pressed && styles.btnPressed}>
            <Text style={styles.heroSkipText}>Skip tour</Text>
          </Pressable>
          <Text style={styles.heroStepText}>
            {stepIndex + 1} of {totalSteps}
          </Text>
          <Pressable accessibilityRole="button" onPress={onNext} style={({ pressed }) => [styles.heroDoneBtn, pressed && styles.btnPressed]}>
            <Text style={styles.heroDoneBtnText}>{isLast ? 'Done' : 'Next'}</Text>
          </Pressable>
        </View>
      ) : null}

      {!isHero && (showNext || showBack) ? (
        <View style={styles.navRow}>
          {showBack ? (
            <Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}>
              <Text style={styles.secondaryBtnText}>Back</Text>
            </Pressable>
          ) : null}
          {showNext ? (
            <Pressable accessibilityRole="button" onPress={onNext} style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed, !showBack && styles.primaryBtnFull]}>
              <Text style={styles.primaryBtnText}>{isLast ? 'Done' : 'Next'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!isHero ? (
        <View style={styles.footerRow}>
          <Text style={styles.stepLabel}>
            {stepIndex + 1} of {totalSteps}
          </Text>
          <Pressable accessibilityRole="button" onPress={onSkip} style={({ pressed }) => pressed && styles.btnPressed}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export type NativeSpotlightTourLayerProps = {
  active: boolean;
  stepIndex: number;
  totalSteps: number;
  title: string;
  content: string;
  emoji?: string;
  popoverVariant: 'tooltip' | 'hero';
  targetRect: HighlightRect | null;
  popoverPosition: PopoverPosition | null;
  spotlightPadding: number;
  spotlightShape: 'rect' | 'circle';
  tapPrompt: string;
  isBlockedWaitingForInput: boolean;
  showNext: boolean;
  showBack: boolean;
  isLast: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

export function NativeSpotlightTourLayer(props: NativeSpotlightTourLayerProps) {
  return (
    <Modal
      visible={props.active}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={props.onSkip}
    >
      <View style={styles.root} pointerEvents="box-none">
        <SpotlightPanels
          rect={props.targetRect}
          padding={props.spotlightPadding}
          shape={props.spotlightShape}
        />
        <TourPopover
          stepIndex={props.stepIndex}
          totalSteps={props.totalSteps}
          title={props.title}
          content={props.content}
          emoji={props.emoji}
          popoverVariant={props.popoverVariant}
          position={props.popoverPosition}
          isBlockedWaitingForInput={props.isBlockedWaitingForInput}
          tapPrompt={props.tapPrompt}
          showNext={props.showNext}
          showBack={props.showBack}
          isLast={props.isLast}
          onNext={props.onNext}
          onBack={props.onBack}
          onSkip={props.onSkip}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: OVERLAY_Z,
    elevation: OVERLAY_Z,
  },
  fullDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NATIVE_OVERLAY_BG,
  },
  panel: {
    position: 'absolute',
    backgroundColor: NATIVE_OVERLAY_BG,
    zIndex: OVERLAY_Z,
  },
  spotlightRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
  },
  popover: {
    position: 'absolute',
    width: NATIVE_POPOVER_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 16,
  },
  heroPopover: {
    position: 'absolute',
    width: NATIVE_POPOVER_WIDTH,
    backgroundColor: '#1a2744',
    borderRadius: 20,
    paddingTop: 24,
    paddingHorizontal: 22,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
  heroEmoji: {
    fontSize: 52,
    textAlign: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  heroContent: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
    textAlign: 'center',
  },
  heroTapPrompt: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 16,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroSkipText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
  },
  heroStepText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
  },
  heroDoneBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  heroDoneBtnText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tooltipIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipIcon: {
    fontSize: 22,
  },
  tooltipTextCol: {
    flex: 1,
    minWidth: 0,
  },
  popoverTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  popoverContent: {
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 19,
  },
  tapPrompt: {
    color: '#111827',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    lineHeight: 14,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnFull: {
    flex: 1,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtnText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  stepLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  skipText: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  btnPressed: {
    opacity: 0.85,
  },
  arrowBase: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  },
  arrowBottom: {
    top: -10,
    alignSelf: 'center',
    borderWidth: 10,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#ffffff',
    borderLeftColor: 'transparent',
  },
  arrowTop: {
    bottom: -10,
    alignSelf: 'center',
    borderWidth: 10,
    borderTopColor: '#ffffff',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  arrowLeft: {
    right: -10,
    top: '40%',
    borderWidth: 10,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#ffffff',
  },
  arrowRight: {
    left: -10,
    top: '40%',
    borderWidth: 10,
    borderTopColor: 'transparent',
    borderRightColor: '#ffffff',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
});

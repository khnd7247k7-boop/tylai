import { Dimensions } from 'react-native';
import type { HighlightRect, PopoverPosition, TourPlacement } from './types';
import {
  POPOVER_GAP,
  POPOVER_WIDTH,
  VIEWPORT_MARGIN,
  clampPopoverToViewport,
  computeArrowOffsetX,
  isTargetNearBottom,
  isTargetNearTop,
  popoverHeightForVariant,
  type PopoverVariant,
} from './popoverLayout';

export const NATIVE_POPOVER_WIDTH = POPOVER_WIDTH;
export const NATIVE_POPOVER_ESTIMATED_HEIGHT = POPOVER_WIDTH;
export const NATIVE_POPOVER_GAP = POPOVER_GAP;
export const NATIVE_VIEWPORT_MARGIN = VIEWPORT_MARGIN;
export const NATIVE_SPOTLIGHT_TRANSITION_MS = 350;
export const NATIVE_OVERLAY_BG = 'rgba(0,0,0,0.34)';

export function expandNativeRect(rect: HighlightRect, padding: number): HighlightRect {
  return {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function withArrowAnchor(
  clamped: { top: number; left: number },
  placement: Exclude<TourPlacement, 'auto'>,
  hole: HighlightRect
): PopoverPosition {
  const targetCenterX = hole.left + hole.width / 2;
  return {
    ...clamped,
    placement,
    arrowOffsetX: computeArrowOffsetX(clamped.left, NATIVE_POPOVER_WIDTH, targetCenterX),
  };
}

function heroNativeFallback(vw: number, vh: number): PopoverPosition {
  const height = popoverHeightForVariant('hero');
  const clamped = clampPopoverToViewport(
    vh * 0.38,
    vw / 2 - NATIVE_POPOVER_WIDTH / 2,
    vw,
    vh,
    NATIVE_POPOVER_WIDTH,
    height,
    NATIVE_VIEWPORT_MARGIN
  );
  return { ...clamped, placement: 'bottom' };
}

function positionForNativePlacement(
  hole: HighlightRect,
  placement: Exclude<TourPlacement, 'auto'>,
  popoverHeight: number
): { top: number; left: number } {
  switch (placement) {
    case 'top':
      return {
        top: hole.top - NATIVE_POPOVER_GAP - popoverHeight,
        left: hole.left + hole.width / 2 - NATIVE_POPOVER_WIDTH / 2,
      };
    case 'bottom':
      return {
        top: hole.top + hole.height + NATIVE_POPOVER_GAP,
        left: hole.left + hole.width / 2 - NATIVE_POPOVER_WIDTH / 2,
      };
    case 'left':
      return {
        top: hole.top + hole.height / 2 - popoverHeight / 2,
        left: hole.left - NATIVE_POPOVER_GAP - NATIVE_POPOVER_WIDTH,
      };
    case 'right':
      return {
        top: hole.top + hole.height / 2 - popoverHeight / 2,
        left: hole.left + hole.width + NATIVE_POPOVER_GAP,
      };
  }
}

function fitsNativeViewport(top: number, left: number, width: number, height: number): boolean {
  const { width: vw, height: vh } = Dimensions.get('window');
  return (
    top >= NATIVE_VIEWPORT_MARGIN &&
    left >= NATIVE_VIEWPORT_MARGIN &&
    top + height <= vh - NATIVE_VIEWPORT_MARGIN &&
    left + width <= vw - NATIVE_VIEWPORT_MARGIN
  );
}

export function computeNativePopoverPosition(
  target: HighlightRect | null,
  preferred: TourPlacement,
  padding: number,
  variant: PopoverVariant = 'tooltip'
): PopoverPosition | null {
  const { width: vw, height: vh } = Dimensions.get('window');
  const popoverHeight = popoverHeightForVariant(variant);

  if (!target || variant === 'hero') {
    return heroNativeFallback(vw, vh);
  }

  const hole = expandNativeRect(target, padding);
  const holeBottom = hole.top + hole.height;

  if (isTargetNearBottom(holeBottom, vh)) {
    const clamped = clampPopoverToViewport(
      hole.top - NATIVE_POPOVER_GAP - popoverHeight,
      hole.left + hole.width / 2 - NATIVE_POPOVER_WIDTH / 2,
      vw,
      vh,
      NATIVE_POPOVER_WIDTH,
      popoverHeight,
      NATIVE_VIEWPORT_MARGIN
    );
    return withArrowAnchor(clamped, 'top', hole);
  }

  if (isTargetNearTop(hole.top, vh)) {
    const clamped = clampPopoverToViewport(
      hole.top + hole.height + NATIVE_POPOVER_GAP,
      hole.left + hole.width / 2 - NATIVE_POPOVER_WIDTH / 2,
      vw,
      vh,
      NATIVE_POPOVER_WIDTH,
      popoverHeight,
      NATIVE_VIEWPORT_MARGIN
    );
    return withArrowAnchor(clamped, 'bottom', hole);
  }

  const order: Exclude<TourPlacement, 'auto'>[] =
    preferred === 'auto'
      ? ['bottom', 'top', 'right', 'left']
      : [preferred, 'bottom', 'top', 'right', 'left'];

  const seen = new Set<Exclude<TourPlacement, 'auto'>>();
  for (const placement of order) {
    if (seen.has(placement)) continue;
    seen.add(placement);
    const pos = positionForNativePlacement(hole, placement, popoverHeight);
    const clamped = clampPopoverToViewport(
      pos.top,
      pos.left,
      vw,
      vh,
      NATIVE_POPOVER_WIDTH,
      popoverHeight,
      NATIVE_VIEWPORT_MARGIN
    );
    if (fitsNativeViewport(clamped.top, clamped.left, NATIVE_POPOVER_WIDTH, popoverHeight)) {
      return withArrowAnchor(clamped, placement, hole);
    }
  }

  const fallbackPos = positionForNativePlacement(hole, 'bottom', popoverHeight);
  const clamped = clampPopoverToViewport(
    fallbackPos.top,
    fallbackPos.left,
    vw,
    vh,
    NATIVE_POPOVER_WIDTH,
    popoverHeight,
    NATIVE_VIEWPORT_MARGIN
  );
  return withArrowAnchor(clamped, 'bottom', hole);
}

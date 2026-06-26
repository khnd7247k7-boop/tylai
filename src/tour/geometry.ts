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

export const SPOTLIGHT_TRANSITION_MS = 350;

export {
  POPOVER_WIDTH,
  POPOVER_ESTIMATED_HEIGHT,
  POPOVER_GAP,
  VIEWPORT_MARGIN,
} from './popoverLayout';

export function expandRect(rect: HighlightRect, padding: number): HighlightRect {
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
    arrowOffsetX: computeArrowOffsetX(clamped.left, POPOVER_WIDTH, targetCenterX),
  };
}

function heroFallback(vw: number, vh: number): PopoverPosition {
  const height = popoverHeightForVariant('hero');
  const clamped = clampPopoverToViewport(
    vh * 0.38,
    vw / 2 - POPOVER_WIDTH / 2,
    vw,
    vh,
    POPOVER_WIDTH,
    height
  );
  return { ...clamped, placement: 'bottom' };
}

function positionForPlacement(
  hole: HighlightRect,
  placement: Exclude<TourPlacement, 'auto'>,
  popoverHeight: number
): { top: number; left: number } {
  switch (placement) {
    case 'top':
      return {
        top: hole.top - POPOVER_GAP - popoverHeight,
        left: hole.left + hole.width / 2 - POPOVER_WIDTH / 2,
      };
    case 'bottom':
      return {
        top: hole.top + hole.height + POPOVER_GAP,
        left: hole.left + hole.width / 2 - POPOVER_WIDTH / 2,
      };
    case 'left':
      return {
        top: hole.top + hole.height / 2 - popoverHeight / 2,
        left: hole.left - POPOVER_GAP - POPOVER_WIDTH,
      };
    case 'right':
      return {
        top: hole.top + hole.height / 2 - popoverHeight / 2,
        left: hole.left + hole.width + POPOVER_GAP,
      };
  }
}

function fitsViewport(top: number, left: number, width: number, height: number): boolean {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return (
    top >= VIEWPORT_MARGIN &&
    left >= VIEWPORT_MARGIN &&
    top + height <= vh - VIEWPORT_MARGIN &&
    left + width <= vw - VIEWPORT_MARGIN
  );
}

export function computePopoverPosition(
  target: HighlightRect | null,
  preferred: TourPlacement,
  padding: number,
  variant: PopoverVariant = 'tooltip'
): PopoverPosition | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const popoverHeight = popoverHeightForVariant(variant);

  if (!target || variant === 'hero') {
    return heroFallback(vw, vh);
  }

  const hole = expandRect(target, padding);
  const holeBottom = hole.top + hole.height;

  if (isTargetNearBottom(holeBottom, vh)) {
    const clamped = clampPopoverToViewport(
      hole.top - POPOVER_GAP - popoverHeight,
      hole.left + hole.width / 2 - POPOVER_WIDTH / 2,
      vw,
      vh,
      POPOVER_WIDTH,
      popoverHeight
    );
    return withArrowAnchor(clamped, 'top', hole);
  }

  if (isTargetNearTop(hole.top, vh)) {
    const clamped = clampPopoverToViewport(
      hole.top + hole.height + POPOVER_GAP,
      hole.left + hole.width / 2 - POPOVER_WIDTH / 2,
      vw,
      vh,
      POPOVER_WIDTH,
      popoverHeight
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
    const pos = positionForPlacement(hole, placement, popoverHeight);
    const clamped = clampPopoverToViewport(
      pos.top,
      pos.left,
      vw,
      vh,
      POPOVER_WIDTH,
      popoverHeight
    );
    if (fitsViewport(clamped.top, clamped.left, POPOVER_WIDTH, popoverHeight)) {
      return withArrowAnchor(clamped, placement, hole);
    }
  }

  const fallbackPos = positionForPlacement(hole, 'bottom', popoverHeight);
  const clamped = clampPopoverToViewport(
    fallbackPos.top,
    fallbackPos.left,
    vw,
    vh,
    POPOVER_WIDTH,
    popoverHeight
  );
  return withArrowAnchor(clamped, 'bottom', hole);
}

export function measureSelector(selector: string): HighlightRect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export function scrollTargetIntoView(selector: string): void {
  const el = document.querySelector(selector);
  el?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
}

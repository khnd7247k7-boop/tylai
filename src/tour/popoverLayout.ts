/** Shared tour overlay + popover layout constants. */
export const TOUR_OVERLAY_BG = 'rgba(0,0,0,0.34)';
export const TOUR_OVERLAY_BLUR = 'blur(5px)';

export const POPOVER_WIDTH = 320;
export const POPOVER_TOOLTIP_HEIGHT = 148;
export const POPOVER_HERO_HEIGHT = 300;
/** @deprecated Use POPOVER_TOOLTIP_HEIGHT or POPOVER_HERO_HEIGHT. */
export const POPOVER_ESTIMATED_HEIGHT = POPOVER_TOOLTIP_HEIGHT;
export const POPOVER_GAP = 10;
export const VIEWPORT_MARGIN = 16;

export type PopoverVariant = 'tooltip' | 'hero';

export function popoverHeightForVariant(variant: PopoverVariant): number {
  return variant === 'hero' ? POPOVER_HERO_HEIGHT : POPOVER_TOOLTIP_HEIGHT;
}

export function clampPopoverToViewport(
  top: number,
  left: number,
  viewportWidth: number,
  viewportHeight: number,
  width: number = POPOVER_WIDTH,
  height: number = POPOVER_TOOLTIP_HEIGHT,
  margin: number = VIEWPORT_MARGIN
): { top: number; left: number } {
  const maxLeft = Math.max(margin, viewportWidth - width - margin);
  const maxTop = Math.max(margin, viewportHeight - height - margin);
  return {
    top: Math.min(Math.max(top, margin), maxTop),
    left: Math.min(Math.max(left, margin), maxLeft),
  };
}

export function computeArrowOffsetX(
  popoverLeft: number,
  popoverWidth: number,
  targetCenterX: number
): number {
  return Math.min(popoverWidth - 18, Math.max(18, targetCenterX - popoverLeft));
}

/** True when the target sits in the bottom chrome (tab bar area). */
export function isTargetNearBottom(holeBottom: number, viewportHeight: number): boolean {
  return holeBottom > viewportHeight * 0.68;
}

/** True when the target sits under the top safe/header band. */
export function isTargetNearTop(holeTop: number, viewportHeight: number): boolean {
  return holeTop < viewportHeight * 0.22;
}

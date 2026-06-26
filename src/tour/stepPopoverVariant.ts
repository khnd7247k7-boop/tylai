import type { TourStep } from './types';
import type { PopoverVariant } from './popoverLayout';

export function stepPopoverVariant(step: TourStep | null | undefined): PopoverVariant {
  if (!step) return 'tooltip';
  if (step.popoverVariant) return step.popoverVariant;
  return step.targetSelector ? 'tooltip' : 'hero';
}

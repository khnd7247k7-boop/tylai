import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { createAppTourSteps } from './defaultTourSteps';
import { NativeSpotlightTourLayer } from './NativeSpotlightTourLayer';
import type { TourNavHandlers, TourStep } from './types';
import { useNativeAppTour } from './useNativeAppTour';
import { stepPopoverVariant } from './stepPopoverVariant';
import { markAppGuideCompleted, markAppGuideDismissed } from '../utils/appGuide';

type Props = {
  visible: boolean;
  onClose: () => void;
  nav: TourNavHandlers;
  steps?: TourStep[];
};

/** Native iOS/Android spotlight tour with enforced taps and screen navigation. */
export default function NativeSpotlightTour({ visible, onClose, nav, steps }: Props) {
  const tourSteps = useMemo(() => steps ?? createAppTourSteps(nav), [nav, steps]);
  const tour = useNativeAppTour(tourSteps);
  const tourStartedRef = useRef(false);

  useEffect(() => {
    if (visible && !tourStartedRef.current) {
      tourStartedRef.current = true;
      tour.start();
    }
    if (!visible) {
      tourStartedRef.current = false;
    }
  }, [visible, tour]);

  useEffect(() => {
    if (tour.phase === 'completed') {
      void markAppGuideCompleted().finally(onClose);
    }
    if (tour.phase === 'skipped') {
      void markAppGuideDismissed().finally(onClose);
    }
  }, [tour.phase, onClose]);

  const handleSkip = useCallback(() => {
    tour.skip();
  }, [tour]);

  const handleNext = useCallback(() => {
    if (tour.currentStepIndex >= tour.totalSteps - 1) {
      void markAppGuideCompleted().finally(onClose);
      return;
    }
    tour.next();
  }, [tour, onClose]);

  const step = tour.currentStep;
  const isLast = tour.currentStepIndex >= tour.totalSteps - 1;
  const showNext = Boolean(step && !step.requireActualClick);

  return (
    <NativeSpotlightTourLayer
      active={visible && tour.isActive && Boolean(step)}
      stepIndex={tour.currentStepIndex}
      totalSteps={tour.totalSteps}
      title={step?.title ?? ''}
      content={step?.content ?? ''}
      emoji={step?.emoji}
      popoverVariant={stepPopoverVariant(step)}
      targetRect={tour.targetRect}
      popoverPosition={tour.popoverPosition}
      spotlightPadding={step?.spotlightPadding ?? 8}
      spotlightShape={step?.spotlightShape ?? 'rect'}
      tapPrompt={step?.tapPrompt ?? 'Please tap the highlighted control to continue.'}
      isBlockedWaitingForInput={tour.isBlockedWaitingForInput}
      showNext={showNext}
      showBack={tour.currentStepIndex > 0 && !tour.isBlockedWaitingForInput}
      isLast={isLast}
      onNext={handleNext}
      onBack={tour.back}
      onSkip={handleSkip}
    />
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions } from 'react-native';
import {
  computeNativePopoverPosition,
  NATIVE_SPOTLIGHT_TRANSITION_MS,
} from './nativeGeometry';
import { measureTourTarget, scrollTourTargetIntoView, waitForTourTarget } from './tourTargetRegistry';
import {
  subscribeTourTargetActivation,
  tourTargetIdFromSelector,
} from './tourActivation';
import { stepPopoverVariant } from './stepPopoverVariant';
import { TOUR_MODAL_SETTLE_MS, TOUR_POST_CLICK_SETTLE_MS, TOUR_SCROLL_SETTLE_MS, TOUR_STEP_PREPARE_MS, tourPause } from './tourTiming';
import type { HighlightRect, PopoverPosition, TourPhase, TourStep, UseAppTourResult } from './types';

type GoToStepOptions = {
  afterTargetClick?: boolean;
};

export function useNativeAppTour(steps: TourStep[]): UseAppTourResult {
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const [phase, setPhase] = useState<TourPhase>('idle');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<HighlightRect | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);

  const listenerCleanupRef = useRef<(() => void) | null>(null);
  const advanceLockRef = useRef(false);

  const currentStep = phase === 'running' ? steps[currentStepIndex] ?? null : null;
  const totalSteps = steps.length;
  const isActive = phase === 'running';
  const isBlockedWaitingForInput = Boolean(isActive && currentStep?.requireActualClick);

  const clearListener = useCallback(() => {
    listenerCleanupRef.current?.();
    listenerCleanupRef.current = null;
  }, []);

  const syncLayoutForStep = useCallback(async (step: TourStep | null) => {
    const variant = stepPopoverVariant(step);

    if (!step?.targetSelector || variant === 'hero') {
      setTargetRect(null);
      setPopoverPosition(computeNativePopoverPosition(null, step?.placement ?? 'auto', 0, variant));
      return;
    }

    await tourPause(NATIVE_SPOTLIGHT_TRANSITION_MS / 2);

    const targetId = tourTargetIdFromSelector(step.targetSelector);
    if (!targetId) {
      setTargetRect(null);
      setPopoverPosition(computeNativePopoverPosition(null, step.placement, 0, variant));
      return;
    }

    if (step.scrollIntoView) {
      await scrollTourTargetIntoView(targetId);
      await tourPause(TOUR_SCROLL_SETTLE_MS);
    }

    let rect = await measureTourTarget(targetId);
    if (!rect) {
      rect = await waitForTourTarget(targetId);
    }
    if (!rect && step.scrollIntoView) {
      await tourPause(TOUR_MODAL_SETTLE_MS / 2);
      rect = await waitForTourTarget(targetId, 100, 25);
    }

    setTargetRect(rect);
    setPopoverPosition(
      computeNativePopoverPosition(rect, step.placement, step.spotlightPadding ?? 8, variant)
    );
  }, []);

  const goToStep = useCallback(
    async (index: number, options?: GoToStepOptions) => {
      const list = stepsRef.current;
      if (index >= list.length) {
        clearListener();
        setPhase('completed');
        return;
      }
      if (index < 0) return;

      clearListener();
      advanceLockRef.current = false;
      setCurrentStepIndex(index);
      const step = list[index];

      if (options?.afterTargetClick) {
        const prevStep = index > 0 ? list[index - 1] : null;
        if (prevStep?.afterClick) {
          try {
            await prevStep.afterClick();
          } catch (e) {
            console.warn('[NativeAppTour] afterClick failed', prevStep.id, e);
          }
        }
        await tourPause(TOUR_POST_CLICK_SETTLE_MS);
      } else if (step?.prepare) {
        try {
          await step.prepare();
        } catch (e) {
          console.warn('[NativeAppTour] prepare step failed', step.id, e);
        }
        await tourPause(step.settleMs ?? TOUR_STEP_PREPARE_MS);
      }

      await syncLayoutForStep(step);
    },
    [clearListener, syncLayoutForStep]
  );

  const start = useCallback(() => {
    clearListener();
    advanceLockRef.current = false;
    setPhase('running');
    setCurrentStepIndex(0);
    void goToStep(0);
  }, [clearListener, goToStep]);

  const skip = useCallback(() => {
    clearListener();
    setPhase('skipped');
  }, [clearListener]);

  const next = useCallback(() => {
    if (phase !== 'running') return;
    const step = stepsRef.current[currentStepIndex];
    if (step?.requireActualClick) return;
    void goToStep(currentStepIndex + 1);
  }, [currentStepIndex, goToStep, phase]);

  const back = useCallback(() => {
    if (phase !== 'running') return;
    void goToStep(currentStepIndex - 1);
  }, [currentStepIndex, goToStep]);

  useEffect(() => {
    if (phase !== 'running') {
      clearListener();
      return;
    }

    const step = stepsRef.current[currentStepIndex];
    if (!step?.requireActualClick || !step.targetSelector) {
      clearListener();
      return;
    }

    const expectedId = tourTargetIdFromSelector(step.targetSelector);
    if (!expectedId) {
      clearListener();
      return;
    }

    let cancelled = false;

    const unsubscribe = subscribeTourTargetActivation((targetId) => {
      if (cancelled || targetId !== expectedId || advanceLockRef.current) return;
      advanceLockRef.current = true;
      void goToStep(currentStepIndex + 1, { afterTargetClick: true });
    });

    listenerCleanupRef.current = unsubscribe;

    return () => {
      cancelled = true;
      clearListener();
    };
  }, [phase, currentStepIndex, clearListener, goToStep]);

  useEffect(() => {
    if (phase !== 'running') return;

    const remeasure = () => {
      const step = stepsRef.current[currentStepIndex];
      if (!step) return;
      const variant = stepPopoverVariant(step);
      if (!step.targetSelector || variant === 'hero') {
        setPopoverPosition(computeNativePopoverPosition(null, step.placement, 0, variant));
        return;
      }
      const targetId = tourTargetIdFromSelector(step.targetSelector);
      if (!targetId) return;
      void measureTourTarget(targetId).then((rect) => {
        setTargetRect(rect);
        setPopoverPosition(
          computeNativePopoverPosition(rect, step.placement, step.spotlightPadding ?? 8, variant)
        );
      });
    };

    const sub = Dimensions.addEventListener('change', remeasure);
    return () => sub.remove();
  }, [phase, currentStepIndex]);

  return {
    phase,
    isActive,
    currentStepIndex,
    currentStep,
    totalSteps,
    isBlockedWaitingForInput,
    targetRect,
    popoverPosition,
    start,
    skip,
    next,
    back,
  };
}

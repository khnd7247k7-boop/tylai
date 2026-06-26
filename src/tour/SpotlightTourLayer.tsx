import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { expandRect, POPOVER_WIDTH, SPOTLIGHT_TRANSITION_MS, VIEWPORT_MARGIN } from './geometry';
import { TOUR_OVERLAY_BG, TOUR_OVERLAY_BLUR } from './popoverLayout';
import type { HighlightRect, PopoverPosition } from './types';

const OVERLAY_Z = 200002;
const TRANSITION = `all ${SPOTLIGHT_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;

type SpotlightPanelsProps = {
  rect: HighlightRect | null;
  padding: number;
  shape: 'rect' | 'circle';
};

function spotlightRadius(shape: 'rect' | 'circle', hole: HighlightRect): number {
  if (shape === 'circle') {
    return Math.max(hole.width, hole.height) / 2;
  }
  return 12;
}

function SpotlightPanels({ rect, padding, shape }: SpotlightPanelsProps) {
  if (!rect) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: TOUR_OVERLAY_BG,
          backdropFilter: TOUR_OVERLAY_BLUR,
          WebkitBackdropFilter: TOUR_OVERLAY_BLUR,
          zIndex: OVERLAY_Z,
          pointerEvents: 'auto',
          transition: TRANSITION,
        }}
      />
    );
  }

  const hole = expandRect(rect, padding);
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const radius = spotlightRadius(shape, hole);
  const centerX = hole.left + hole.width / 2;
  const centerY = hole.top + hole.height / 2;

  const panelBase: React.CSSProperties = {
    position: 'fixed',
    backgroundColor: TOUR_OVERLAY_BG,
    backdropFilter: TOUR_OVERLAY_BLUR,
    WebkitBackdropFilter: TOUR_OVERLAY_BLUR,
    zIndex: OVERLAY_Z,
    pointerEvents: 'auto',
    transition: TRANSITION,
  };

  return (
    <>
      <div style={{ ...panelBase, top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }} />
      <div
        style={{
          ...panelBase,
          top: hole.top,
          left: 0,
          width: Math.max(0, hole.left),
          height: hole.height,
        }}
      />
      <div
        style={{
          ...panelBase,
          top: hole.top,
          left: hole.left + hole.width,
          width: Math.max(0, vw - hole.left - hole.width),
          height: hole.height,
        }}
      />
      <div
        style={{
          ...panelBase,
          top: hole.top + hole.height,
          left: 0,
          right: 0,
          height: Math.max(0, vh - hole.top - hole.height),
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: shape === 'circle' ? centerY - radius : hole.top,
          left: shape === 'circle' ? centerX - radius : hole.left,
          width: shape === 'circle' ? radius * 2 : hole.width,
          height: shape === 'circle' ? radius * 2 : hole.height,
          borderRadius: radius,
          boxShadow:
            '0 0 0 3px rgba(255,255,255,0.95), 0 0 32px rgba(255,255,255,0.55), 0 0 64px rgba(255,255,255,0.2)',
          zIndex: OVERLAY_Z + 1,
          pointerEvents: 'none',
          transition: TRANSITION,
        }}
      />
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
  color = '#ffffff',
}: {
  placement: Exclude<PopoverPosition['placement'], never>;
  offsetX?: number;
  color?: string;
}) {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  };
  const arrowLeft = offsetX != null ? offsetX : '50%';
  const arrowShift = offsetX != null ? -8 : -10;

  switch (placement) {
    case 'bottom':
      return (
        <div
          style={{
            ...base,
            top: -8,
            left: arrowLeft,
            marginLeft: arrowShift,
            borderWidth: '0 8px 8px 8px',
            borderColor: `transparent transparent ${color} transparent`,
          }}
        />
      );
    case 'top':
      return (
        <div
          style={{
            ...base,
            bottom: -8,
            left: arrowLeft,
            marginLeft: arrowShift,
            borderWidth: '8px 8px 0 8px',
            borderColor: `${color} transparent transparent transparent`,
          }}
        />
      );
    case 'left':
      return (
        <div
          style={{
            ...base,
            right: -8,
            top: '50%',
            marginTop: -8,
            borderWidth: '8px 0 8px 8px',
            borderColor: `transparent transparent transparent ${color}`,
          }}
        />
      );
    case 'right':
      return (
        <div
          style={{
            ...base,
            left: -8,
            top: '50%',
            marginTop: -8,
            borderWidth: '8px 8px 8px 0',
            borderColor: `transparent ${color} transparent transparent`,
          }}
        />
      );
  }
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
  const popoverRef = useRef<HTMLDivElement>(null);
  const isHero = popoverVariant === 'hero';
  const basePos = position ?? {
    top: Math.max(VIEWPORT_MARGIN, window.innerHeight / 2 - 150),
    left: Math.max(VIEWPORT_MARGIN, window.innerWidth / 2 - POPOVER_WIDTH / 2),
    placement: 'bottom' as const,
  };
  const [pos, setPos] = useState(basePos);

  useEffect(() => {
    setPos(basePos);
  }, [basePos.top, basePos.left, basePos.placement, title, content, isBlockedWaitingForInput, showNext, showBack, popoverVariant]);

  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el) return;

    const margin = VIEWPORT_MARGIN;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nextTop = pos.top;
    let nextLeft = pos.left;

    if (rect.right > vw - margin) nextLeft -= rect.right - (vw - margin);
    if (rect.left < margin) nextLeft += margin - rect.left;
    if (rect.bottom > vh - margin) nextTop -= rect.bottom - (vh - margin);
    if (rect.top < margin) nextTop += margin - rect.top;

    if (nextTop !== pos.top || nextLeft !== pos.left) {
      setPos((prev) => ({ ...prev, top: nextTop, left: nextLeft }));
    }
  }, [pos.top, pos.left, title, content, isBlockedWaitingForInput, showNext, showBack, tapPrompt, popoverVariant]);

  const heroBg = '#1a2744';
  const cardBg = isHero ? heroBg : '#ffffff';
  const titleColor = isHero ? '#ffffff' : '#111827';
  const bodyColor = isHero ? 'rgba(255,255,255,0.82)' : '#4b5563';

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-popover-title"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: POPOVER_WIDTH,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
        backgroundColor: cardBg,
        borderRadius: isHero ? 20 : 14,
        padding: isHero ? '24px 22px 18px' : '14px 16px 12px',
        zIndex: OVERLAY_Z + 2,
        boxShadow: isHero
          ? '0 20px 56px rgba(0,0,0,0.55)'
          : '0 12px 36px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.04)',
        transition: TRANSITION,
        pointerEvents: 'auto',
      }}
    >
      {!isHero ? (
        <PopoverArrow placement={pos.placement} offsetX={pos.arrowOffsetX} color="#ffffff" />
      ) : null}

      {isHero ? (
        <>
          {emoji ? (
            <div style={{ fontSize: 52, textAlign: 'center', marginBottom: 14, lineHeight: 1 }}>
              {emoji}
            </div>
          ) : null}
          <div id="tour-popover-title" style={{ color: titleColor, fontSize: 22, fontWeight: 800, marginBottom: 10, textAlign: 'center' }}>
            {title}
          </div>
          <p style={{ color: bodyColor, fontSize: 14, lineHeight: 1.55, margin: '0 0 20px', textAlign: 'center' }}>{content}</p>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {emoji ? (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              {emoji}
            </div>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="tour-popover-title" style={{ color: titleColor, fontSize: 16, fontWeight: 800, marginBottom: 4, lineHeight: 1.3 }}>
              {title}
            </div>
            <p style={{ color: bodyColor, fontSize: 13, lineHeight: 1.45, margin: 0 }}>{content}</p>
          </div>
        </div>
      )}

      {isBlockedWaitingForInput ? (
        <p
          style={{
            color: isHero ? 'rgba(255,255,255,0.9)' : '#111827',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            lineHeight: 1.4,
            margin: isHero ? '0 0 16px' : '10px 0 0',
            textTransform: 'uppercase',
            textAlign: isHero ? 'center' : 'left',
          }}
        >
          {tapPrompt}
        </p>
      ) : null}

      {isHero && (showNext || showBack) ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onSkip}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.65)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 0',
            }}
          >
            Skip tour
          </button>
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600 }}>
            {stepIndex + 1} of {totalSteps}
          </span>
          <button
            type="button"
            onClick={onNext}
            style={{
              backgroundColor: '#ffffff',
              color: '#111827',
              border: 'none',
              borderRadius: 999,
              padding: '10px 22px',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      ) : null}

      {!isHero && (showNext || showBack) ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          {showBack ? (
            <button type="button" onClick={onBack} style={{ flex: 1, backgroundColor: '#f3f4f6', color: '#111827', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Back
            </button>
          ) : null}
          {showNext ? (
            <button type="button" onClick={onNext} style={{ flex: 1, backgroundColor: '#111827', color: '#ffffff', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
              {isLast ? 'Done' : 'Next'}
            </button>
          ) : null}
        </div>
      ) : null}

      {!isHero ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
          <span style={{ color: '#9ca3af', fontSize: 10, fontWeight: 700, letterSpacing: 0.4 }}>
            {stepIndex + 1} of {totalSteps}
          </span>
          <button type="button" onClick={onSkip} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}>
            Skip
          </button>
        </div>
      ) : null}
    </div>
  );
}

export type SpotlightTourLayerProps = {
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

export function SpotlightTourLayer(props: SpotlightTourLayerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(typeof document !== 'undefined');
  }, []);

  if (!props.active || !mounted) return null;

  return createPortal(
    <>
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
    </>,
    document.body
  );
}

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface TourStep {
  id: string;
  /** CSS selector for the element to highlight (e.g. `#tour-start-today`). Omit for centered intro/outro steps. */
  targetSelector?: string;
  title: string;
  content: string;
  placement: TourPlacement;
  /** When true, Next is hidden and the tour waits for a real click on the target element. */
  requireActualClick: boolean;
  /** Extra padding around the spotlight cutout (px). Default 8. */
  spotlightPadding?: number;
  /** Rectangular cutout (default) or circular highlight for compact controls like tabs. */
  spotlightShape?: 'rect' | 'circle';
  /** Shown in caps when waiting for a tap on the highlighted control. */
  tapPrompt?: string;
  /** Runs before the step is shown — navigate to the right screen/tab and wait for targets. */
  prepare?: () => void | Promise<void>;
  /** Runs after the user taps this step's target, before advancing (e.g. close a modal). */
  afterClick?: () => void | Promise<void>;
  /** Scroll registered target into view before measuring (modal / long lists). */
  scrollIntoView?: boolean;
  /** Override default prepare pause (ms). */
  settleMs?: number;
  /** Compact white tooltip (default) or large hero card for intro/outro. */
  popoverVariant?: 'tooltip' | 'hero';
  /** Optional emoji shown in the card icon area. */
  emoji?: string;
}

export type TourNavHandlers = {
  ensureDashboard: () => void | Promise<void>;
  ensureWorkouts: () => void | Promise<void>;
  ensureNutrition: () => void | Promise<void>;
  ensureMore: () => void | Promise<void>;
  /** Open Log Food on Nutrition with optional logging mode (precision | ai). */
  ensureLogFoodOpen: (mode?: 'precision' | 'ai') => void | Promise<void>;
  /** Close the Log Food modal (e.g. before leaving Nutrition during the tour). */
  closeLogFood: () => void | Promise<void>;
  /** Workouts tab, all nested flows closed. */
  ensureWorkoutsHome: () => void | Promise<void>;
  /** Expand My Plans panel on Workouts. */
  ensureMyPlansOpen: () => void | Promise<void>;
  /** Open Build Your Own Workout full-screen builder. */
  ensureBuildWorkoutOpen: () => void | Promise<void>;
  /** Open AI Workout planner (WorkoutScreen). */
  ensureAiWorkoutOpen: () => void | Promise<void>;
  /** Open saved plan preview (first plan) when available. */
  ensurePlanPreviewOpen: () => void | Promise<void>;
  /** Close workout tour overlays (build / AI / plan preview). */
  closeWorkoutTour: () => void | Promise<void>;
  /** Close nested fitness modals / flows without changing tabs (e.g. after AI Workout tap). */
  dismissFitnessOverlays: () => void | Promise<void>;
};

/** App → FitnessScreen signal to open Log Food for the guided tour. */
export type TourLogFoodIntent = {
  id: number;
  open: boolean;
  mode?: 'precision' | 'ai';
};

/** App → FitnessScreen signal for workout tour navigation. */
export type TourFitnessIntent = {
  id: number;
  myPlansPanel?: boolean;
  buildWorkout?: boolean;
  aiWorkout?: boolean;
  planPreview?: boolean;
  closeAll?: boolean;
};

export type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type PopoverPosition = {
  top: number;
  left: number;
  placement: Exclude<TourPlacement, 'auto'>;
  /** Horizontal px from popover left edge to arrow center (tooltip steps). */
  arrowOffsetX?: number;
};

export type TourPhase = 'idle' | 'running' | 'completed' | 'skipped';

export interface UseAppTourResult {
  phase: TourPhase;
  isActive: boolean;
  currentStepIndex: number;
  currentStep: TourStep | null;
  totalSteps: number;
  isBlockedWaitingForInput: boolean;
  targetRect: HighlightRect | null;
  popoverPosition: PopoverPosition | null;
  start: () => void;
  skip: () => void;
  next: () => void;
  back: () => void;
}

/**
 * Warm-up rep targets for generated plans.
 * Based on common dynamic warm-up guidance: 8–12 controlled reps per movement,
 * 1 set, no added load (ACSM / NASM movement-prep style).
 */
export const WARMUP_REP_GUIDANCE = {
  default: 10,
  perSide: 10,
  slowFlow: 8,
  activation: 12,
  cns: 15,
} as const;

const PER_SIDE_WARMUP_NAMES = new Set([
  'Leg Swings',
  "World's Greatest Stretch",
  'Thoracic Rotations',
  'Walking Lunges with a Twist',
  'Lateral Lunges',
  'Shoulder External Rotations',
  'Hip Flexor Stretch',
]);

const SLOW_FLOW_WARMUP_NAMES = new Set(['Inchworms', "Child's Pose"]);

const ACTIVATION_WARMUP_NAMES = new Set([
  'Glute Bridge (Bodyweight)',
  'Scapular Push-ups',
  'Scapular Pull-ups',
  'Band Pull-Aparts',
  'Bird Dog',
  'Good Mornings (Bodyweight)',
]);

const CNS_WARMUP_NAMES = new Set(['High Knees', 'Lateral Pogos', 'Jumping Jacks']);

const STATIC_COOLDOWN_NAMES = new Set([
  'Hamstring Stretch',
  "Child's Pose",
  'Shoulder Stretch',
  'Hip Flexor Stretch',
  'Doorway Chest Stretch',
]);

export type WorkoutDisplayPhase = 'Warm-Up' | 'Main Workout' | 'Cooldown';

export type PlanPhaseItem = {
  name: string;
  sets?: number;
  reps?: number;
  /** Shown in plan footnotes for warm-up/cooldown prep (not in compact list). */
  repNote?: string;
};

export type PlanPhaseBlock = {
  title: WorkoutDisplayPhase;
  items: PlanPhaseItem[];
  /** Warm-up and cooldown render as name-only lists. */
  compact: boolean;
};

export function isStaticCooldownExercise(name: string): boolean {
  return STATIC_COOLDOWN_NAMES.has(name);
}

/** Rep target for a dynamic warm-up / activation drill. Static holds return null. */
export function getOptimalWarmupReps(exerciseName: string): number | null {
  if (isStaticCooldownExercise(exerciseName) && exerciseName !== "Child's Pose") {
    return null;
  }
  if (CNS_WARMUP_NAMES.has(exerciseName)) return WARMUP_REP_GUIDANCE.cns;
  if (PER_SIDE_WARMUP_NAMES.has(exerciseName)) return WARMUP_REP_GUIDANCE.perSide;
  if (SLOW_FLOW_WARMUP_NAMES.has(exerciseName)) return WARMUP_REP_GUIDANCE.slowFlow;
  if (ACTIVATION_WARMUP_NAMES.has(exerciseName)) return WARMUP_REP_GUIDANCE.activation;
  return WARMUP_REP_GUIDANCE.default;
}

export function formatWarmupRepNote(exerciseName: string): string | undefined {
  const reps = getOptimalWarmupReps(exerciseName);
  if (reps == null) return '30–45 sec hold';
  if (PER_SIDE_WARMUP_NAMES.has(exerciseName)) return `${reps}/side`;
  return `${reps} reps`;
}

export function resolveWorkoutDisplayPhase(
  phase?: string,
  exerciseName?: string
): WorkoutDisplayPhase {
  if (phase === 'Warm-Up') return 'Warm-Up';
  if (phase === 'Cooldown') return 'Cooldown';
  if (exerciseName && isStaticCooldownExercise(exerciseName)) return 'Cooldown';
  return 'Main Workout';
}

const DISPLAY_PHASE_ORDER: WorkoutDisplayPhase[] = ['Warm-Up', 'Main Workout', 'Cooldown'];

type RawPlanExercise = {
  name: string;
  sets: number;
  reps: number;
  phase?: string;
  durationSeconds?: number;
  isWarmupBlock?: boolean;
  isCooldownBlock?: boolean;
  warmupItems?: Array<{ name: string; reps?: number; durationSeconds?: number }>;
};

function pushItem(blocks: Map<WorkoutDisplayPhase, PlanPhaseItem[]>, phase: WorkoutDisplayPhase, item: PlanPhaseItem) {
  const list = blocks.get(phase) ?? [];
  list.push(item);
  blocks.set(phase, list);
}

/** Group generated / saved exercises into Warm-Up, Main Workout, and Cooldown blocks for plan preview. */
export function buildPlanPhaseBlocks(exercises: RawPlanExercise[]): PlanPhaseBlock[] {
  const blocks = new Map<WorkoutDisplayPhase, PlanPhaseItem[]>();

  for (const ex of exercises) {
    if (ex.isWarmupBlock && ex.warmupItems?.length) {
      for (const item of ex.warmupItems) {
        pushItem(blocks, 'Warm-Up', { name: item.name, repNote: formatWarmupRepNote(item.name) });
      }
      continue;
    }
    if (ex.isCooldownBlock && ex.warmupItems?.length) {
      for (const item of ex.warmupItems) {
        pushItem(blocks, 'Cooldown', { name: item.name, repNote: formatWarmupRepNote(item.name) });
      }
      continue;
    }

    const displayPhase = resolveWorkoutDisplayPhase(ex.phase, ex.name);
    if (displayPhase === 'Main Workout') {
      pushItem(blocks, 'Main Workout', {
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
      });
    } else {
      pushItem(blocks, displayPhase, {
        name: ex.name,
        repNote: formatWarmupRepNote(ex.name),
      });
    }
  }

  return DISPLAY_PHASE_ORDER.filter((title) => blocks.has(title)).map((title) => ({
    title,
    items: blocks.get(title)!,
    compact: title === 'Warm-Up' || title === 'Cooldown',
  }));
}

export function formatPlanPhaseBlockLines(block: PlanPhaseBlock): string[] {
  if (block.compact) {
    return block.items.map((item) => item.name);
  }
  return block.items.map((item) => {
    if (item.sets != null && item.reps != null && item.reps > 0) {
      return `${item.name} — ${item.sets}×${item.reps}`;
    }
    return item.name;
  });
}

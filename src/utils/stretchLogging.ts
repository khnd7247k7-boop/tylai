import { getExerciseData } from '../data/exerciseDatabase';
import {
  getOptimalWarmupReps,
  isStaticCooldownExercise,
} from './workoutPhaseDisplay';

const PER_SIDE_STRETCH_NAMES = new Set([
  'Leg Swings',
  "World's Greatest Stretch",
  'Thoracic Rotations',
  'Walking Lunges with a Twist',
  'Lateral Lunges',
  'Shoulder External Rotations',
  'Hip Flexor Stretch',
  'Quad Stretch',
  'Calf Stretch',
  'Shoulder Stretch',
  'Neck Stretch',
  'Doorway Chest Stretch',
]);

/** Soft pulsed stretches — work/rest intervals instead of one long hold. */
const INTERVAL_STRETCH_NAMES = new Set([
  "World's Greatest Stretch",
  'Cat-Cow',
  'Cat Cow',
  'Open Books',
  'Thread the Needle',
]);

export type StretchProtocol =
  | {
      kind: 'hold';
      holdSeconds: number;
      rounds: number;
      perSide: boolean;
    }
  | {
      kind: 'interval';
      workSeconds: number;
      restSeconds: number;
      rounds: number;
      perSide: boolean;
    };

export type StretchLikeExercise = {
  name: string;
  sets?: number;
  reps?: number;
  category?: string;
  durationSeconds?: number;
  movementPattern?: string;
};

export function isStretchLoggingExercise(ex: StretchLikeExercise): boolean {
  // Explicit timed holds from the workout builder take priority.
  if ((ex.durationSeconds ?? 0) > 0) return true;
  const catalog = getExerciseData(ex.name);
  if (catalog?.movementPattern === 'stretch') return true;
  if (catalog?.category === 'flexibility' && isStaticCooldownExercise(ex.name)) return true;
  if (ex.category === 'flexibility') {
    const pattern = ex.movementPattern ?? catalog?.movementPattern;
    if (pattern === 'stretch') return true;
    if (isStaticCooldownExercise(ex.name)) return true;
    if ((ex.durationSeconds ?? 0) > 0 && getOptimalWarmupReps(ex.name) == null) return true;
  }
  if (isStaticCooldownExercise(ex.name)) return true;
  if (INTERVAL_STRETCH_NAMES.has(ex.name)) return true;
  if (/\bstretch\b/i.test(ex.name)) return true;
  return false;
}

function resolveHoldSeconds(ex: StretchLikeExercise): number {
  if (ex.durationSeconds != null && ex.durationSeconds > 0) {
    return Math.round(ex.durationSeconds);
  }
  if (ex.reps != null && ex.reps >= 15 && ex.reps <= 90) return ex.reps;
  return 30;
}

export function getStretchProtocol(ex: StretchLikeExercise): StretchProtocol | null {
  if (!isStretchLoggingExercise(ex)) return null;

  const rounds = Math.max(1, ex.sets ?? 1);
  const holdSeconds = resolveHoldSeconds(ex);
  const perSide = PER_SIDE_STRETCH_NAMES.has(ex.name);

  if (INTERVAL_STRETCH_NAMES.has(ex.name) || (holdSeconds > 0 && holdSeconds <= 12 && rounds >= 2)) {
    const work = Math.min(Math.max(holdSeconds, 8), 15);
    return {
      kind: 'interval',
      workSeconds: work,
      restSeconds: 10,
      rounds,
      perSide,
    };
  }

  return {
    kind: 'hold',
    holdSeconds: holdSeconds >= 15 ? holdSeconds : 30,
    rounds,
    perSide,
  };
}

export function formatStretchProtocolLabel(protocol: StretchProtocol): string {
  if (protocol.kind === 'hold') {
    const side = protocol.perSide ? ' / side' : '';
    if (protocol.rounds <= 1) return `${protocol.holdSeconds}s hold${side}`;
    return `${protocol.holdSeconds}s hold${side} × ${protocol.rounds}`;
  }
  const side = protocol.perSide ? ' / side' : '';
  return `${protocol.workSeconds}s on / ${protocol.restSeconds}s off × ${protocol.rounds}${side}`;
}

export function formatStretchRoundLabel(
  protocol: StretchProtocol,
  roundIndex: number
): string {
  const n = roundIndex + 1;
  if (protocol.kind === 'hold') {
    if (protocol.rounds <= 1) {
      return protocol.perSide
        ? `${protocol.holdSeconds} second hold each side`
        : `${protocol.holdSeconds} second hold`;
    }
    return protocol.perSide
      ? `Hold ${n} of ${protocol.rounds} · ${protocol.holdSeconds}s each side`
      : `Hold ${n} of ${protocol.rounds} · ${protocol.holdSeconds}s`;
  }
  return protocol.perSide
    ? `Interval ${n} of ${protocol.rounds} · ${protocol.workSeconds}s on / ${protocol.restSeconds}s off each side`
    : `Interval ${n} of ${protocol.rounds} · ${protocol.workSeconds}s on / ${protocol.restSeconds}s off`;
}

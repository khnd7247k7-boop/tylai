/**
 * Labels + option lists for the conversational Discomfort Assessment UI.
 * Maps coach-friendly copy onto Movement Intelligence domain types.
 */

import type {
  BodyArea,
  BodySide,
  DiscomfortFrequency,
  DiscomfortOnset,
  DiscomfortTrend,
  ModificationResponse,
  MovementPhase,
  SensationType,
} from '../types/movementIntelligence';

export type AssessmentOption<T extends string> = {
  value: T;
  label: string;
};

export const DISCOMFORT_BODY_AREA_OPTIONS: AssessmentOption<BodyArea>[] = [
  { value: 'neck', label: 'Neck' },
  { value: 'shoulder', label: 'Shoulder' },
  { value: 'upper_back', label: 'Upper back' },
  { value: 'lower_back', label: 'Lower back' },
  { value: 'elbow', label: 'Elbow' },
  { value: 'wrist', label: 'Wrist / forearm' },
  { value: 'hip', label: 'Hip' },
  { value: 'knee', label: 'Knee' },
  { value: 'ankle', label: 'Ankle' },
  { value: 'foot', label: 'Foot' },
  { value: 'core', label: 'Core / abs' },
  { value: 'other', label: 'Somewhere else' },
];

export const DISCOMFORT_SIDE_OPTIONS: AssessmentOption<BodySide>[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'bilateral', label: 'Both' },
  { value: 'midline', label: 'Middle / center' },
];

export const DISCOMFORT_SENSATION_OPTIONS: AssessmentOption<SensationType>[] = [
  { value: 'dull', label: 'Dull / aching' },
  { value: 'sharp', label: 'Sharp' },
  { value: 'tightness', label: 'Tight' },
  { value: 'pinching', label: 'Pinching' },
  { value: 'burning', label: 'Burning' },
  { value: 'pressure', label: 'Pressure' },
  { value: 'weakness', label: 'Weakness' },
  { value: 'instability', label: 'Instability' },
  { value: 'stiffness', label: 'Stiffness' },
  { value: 'other', label: 'Other' },
];

export const DISCOMFORT_PHASE_OPTIONS: AssessmentOption<MovementPhase>[] = [
  { value: 'beginning', label: 'Beginning' },
  { value: 'eccentric', label: 'Lowering' },
  { value: 'bottom', label: 'Bottom / deepest position' },
  { value: 'concentric', label: 'Lifting' },
  { value: 'lockout', label: 'End of movement' },
  { value: 'after_exercise', label: 'After the exercise' },
  { value: 'later', label: 'Later in the day' },
  { value: 'next_day', label: 'Next day' },
];

export const DISCOMFORT_FREQUENCY_OPTIONS: AssessmentOption<DiscomfortFrequency>[] = [
  { value: 'one_time', label: 'Just this time' },
  { value: 'occasional', label: 'Now and then' },
  { value: 'frequent', label: 'Pretty often' },
  { value: 'every_session', label: 'Every time I train it' },
  { value: 'constant', label: 'Most of the time' },
];

/** Modification chips — stored as free-text on the report. */
export const DISCOMFORT_MODIFICATION_OPTIONS: AssessmentOption<string>[] = [
  { value: 'reducing_weight', label: 'Reducing weight' },
  { value: 'reducing_rom', label: 'Reducing range of motion' },
  { value: 'slowing_down', label: 'Slowing down' },
  { value: 'changing_stance', label: 'Changing stance' },
  { value: 'changing_grip', label: 'Changing grip' },
  { value: 'changing_technique', label: 'Changing technique' },
  { value: 'nothing_helps', label: 'Nothing helps' },
  { value: 'havent_tried', label: "Haven't tried" },
];

export const DISCOMFORT_TREND_OPTIONS: AssessmentOption<DiscomfortTrend>[] = [
  { value: 'improving', label: 'Improving' },
  { value: 'stable', label: 'Staying the same' },
  { value: 'worsening', label: 'Getting worse' },
];

export function labelForOption<T extends string>(
  options: AssessmentOption<T>[],
  value: T | undefined
): string {
  if (!value) return '';
  return options.find((o) => o.value === value)?.label ?? value;
}

export function onsetFromMovementPhase(phase: MovementPhase | undefined): DiscomfortOnset | undefined {
  if (!phase) return undefined;
  if (phase === 'after_exercise') return 'after_workout';
  if (phase === 'later') return 'later';
  if (phase === 'next_day') return 'next_day';
  if (phase === 'beginning') return 'during_set';
  return 'during_set';
}

export function modificationResponseFromSelections(
  selected: string[]
): ModificationResponse {
  if (!selected.length || selected.includes('havent_tried')) return 'unknown';
  if (selected.includes('nothing_helps')) return 'unchanged';
  // User indicated they changed something — treat as attempted with unknown result
  // unless they only picked helpful-sounding mods (still unknown without a follow-up).
  return 'unknown';
}

export function humanModificationLabels(selected: string[]): string[] {
  return selected
    .map((v) => DISCOMFORT_MODIFICATION_OPTIONS.find((o) => o.value === v)?.label ?? v)
    .filter(Boolean);
}

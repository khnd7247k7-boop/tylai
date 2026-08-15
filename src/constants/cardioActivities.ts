/** Common cardio types shown as chips on Track Cardio. */
export const CARDIO_ACTIVITIES = [
  'Running',
  'Walking',
  'Jogging',
  'Cycling',
  'Indoor Bike',
  'Swimming',
  'Rowing',
  'Elliptical',
  'Stair Climber',
  'Jump Rope',
  'HIIT',
  'Hiking',
  'Other',
] as const;

export type CardioActivityName = (typeof CARDIO_ACTIVITIES)[number];

const STRENGTH_LABELS = new Set([
  'strength',
  'traditional strength training',
  'functional strength training',
  'core training',
  'flexibility',
]);

export function isCardioWatchActivity(label: string): boolean {
  return !STRENGTH_LABELS.has(label.trim().toLowerCase());
}

export function normalizeCardioActivity(raw: string | null | undefined): string {
  const v = String(raw ?? '').trim();
  if (!v) return 'Cardio';
  const match = CARDIO_ACTIVITIES.find((a) => a.toLowerCase() === v.toLowerCase());
  return match ?? v;
}

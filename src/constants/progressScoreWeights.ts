/** Weighted blend for the overall progress score (must sum to 1). */
export const PROGRESS_SCORE_WEIGHTS = {
  training: 0.3,
  nutrition: 0.25,
  recovery: 0.15,
  bodyProgress: 0.2,
  consistency: 0.1,
} as const;

export type ProgressCategoryId = keyof typeof PROGRESS_SCORE_WEIGHTS;

export const PROGRESS_CATEGORY_LABELS: Record<ProgressCategoryId, string> = {
  training: 'Training',
  nutrition: 'Nutrition',
  recovery: 'Recovery',
  bodyProgress: 'Body Progress',
  consistency: 'Consistency',
};

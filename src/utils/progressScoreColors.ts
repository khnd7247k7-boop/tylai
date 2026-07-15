import { AppTheme } from '../theme/appVisualTheme';

/** Score tier color for rings, bars, and text accents. */
export function scoreColor(score: number): string {
  if (score >= 90) return AppTheme.accent;
  if (score >= 75) return '#4ade80';
  if (score >= 60) return '#fbbf24';
  if (score >= 40) return '#fb923c';
  return '#ef4444';
}

/** Emoji indicator shown beside each category score. */
export function scoreIndicatorEmoji(score: number): string {
  if (score >= 75) return '🟢';
  if (score >= 60) return '🟡';
  if (score >= 40) return '🟠';
  return '🔴';
}

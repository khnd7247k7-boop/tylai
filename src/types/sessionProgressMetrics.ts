/** Metrics snapshot keyed to a progress photo session date. */

export type MetricAvailability = 'available' | 'pending' | 'unavailable';

export interface MetricValue {
  value: number | null;
  unit?: string;
  label: string;
  /** Available now, reserved for later datasets, or no data for this day. */
  status: MetricAvailability;
  /** Week-over-week or previous-session delta when both sides exist. */
  delta?: number | null;
  /** Short human-readable status when value is null. */
  emptyHint?: string;
}

export interface SessionProgressMetrics {
  sessionId: string;
  date: string;
  weight: MetricValue;
  measurements: MetricValue;
  /** Chest, hips, and any user-added custom measurements for this day. */
  extraMeasurements?: MetricValue[];
  strength: MetricValue;
  calories: MetricValue;
  protein: MetricValue;
  recovery: MetricValue;
  workoutSummary: {
    completedSessions: number;
    totalSets: number;
    totalVolume: number;
    topLiftName: string | null;
    topLiftWeight: number | null;
  };
  coachNotes: string | null;
  aiInsightsPlaceholder: string;
}

export type ComparisonRange = '30d' | '60d' | '90d' | 'custom' | 'beginning';

export interface SessionComparisonPair {
  before: { sessionId: string; date: string };
  after: { sessionId: string; date: string };
  range: ComparisonRange;
}

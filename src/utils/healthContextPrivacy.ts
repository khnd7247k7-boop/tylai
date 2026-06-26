/**
 * Coach / AI payloads: keep only pre-aggregated fields (no raw timelines, no identifiers).
 * Aligns mindful minutes with the same “summary only” pattern as other HealthKit-backed stats.
 */
const COACH_SAFE_KEYS = new Set([
  'generatedAt',
  'appSnapshot',
  'wearableLast7Days',
  'mindful',
  'recoverySignals',
  'coachingContext',
]);

export function sanitizeCoachHealthContext(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of COACH_SAFE_KEYS) {
    if (key in raw) out[key] = raw[key];
  }
  return JSON.parse(JSON.stringify(out)) as Record<string, unknown>;
}

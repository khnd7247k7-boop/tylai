/**
 * Systemic tax: as age increases, heavy lifting imposes more systemic cost, so the
 * generator shifts from high volume toward quality, recovery, and frequency.
 *
 * Volume table (weekly sets per muscle group, growth-oriented band):
 * | Age        | Activity        | Weekly sets | Notes |
 * |------------|-----------------|------------:|-------|
 * | 18–30      | Sedentary       |     8–10    | Low work capacity; technique over junk volume |
 * | 18–30      | Active/Athlete  |    12–20    | Peak resilience; higher MRV tolerance |
 * | 31–50      | Sedentary       |      6–8    | Joint integrity; minimum effective dose |
 * | 31–50      | Active/Athlete  |    10–14    | Slight recovery shift; manage CNS fatigue |
 * | 51+        | Sedentary       |      4–6    | Sarcopenia prevention; favor frequency |
 * | 51+        | Active/Athlete  |     8–10    | Intensity OK; longer tendon recovery spacing |
 *
 * Core rules (enforced in computeSystemicVolumeContext + WorkoutScreen.enforceSystemicWeeklySetTargets):
 * - Inverted-U / MRV: gains scale with volume only to a ceiling; each full decade past 30 lowers
 *   that ceiling by ~10–15% (we use 12.5% per decade via PER_DECADE_MRV_FACTOR).
 * - Intensity vs volume: low activity and/or older users bias slightly heavier rep ranges (fewer reps)
 *   and lower per-session exercise count; active youth tolerate more volume.
 * - ≥2 exposures per week per trained muscle (when the user trains ≥2 days/week): spread sets across
 *   days instead of piling all weekly volume on one session (especially important when weekly sets are low).
 * - Deload: users over 40 or sedentary get a 50% weekly set reduction on every 5th calendar week
 *   (rolling week index) to limit overuse.
 */

export type ActivityTier = 'sedentary' | 'active';
export type AgeBracket = 'youth' | 'mid' | 'senior';

/** ~12.5% MRV reduction per full decade past 30 (within the 10–15% spec band). */
const PER_DECADE_MRV_FACTOR = 0.875;

export function parseAgeYears(ageStr: string | undefined): number | null {
  if (!ageStr?.trim()) return null;
  const m = ageStr.match(/(\d{1,3})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n < 14 || n > 100) return null;
  return n;
}

/** Classify free-text activity (questionnaire / profile). Defaults conservative. */
export function inferActivityTier(description: string): ActivityTier {
  const t = description.toLowerCase();
  if (!t.trim()) return 'sedentary';
  const activeHints =
    /\b(athlete|athletic|sport|sports|train|training|gym|lift|lifting|run|runner|running|crossfit|hiit|very active|highly active|on my feet|physical job|construction|warehouse|nurse|walk\s+\d|hike|hiking|swim|swimming|cycling|bike|competitive)\b/;
  const sedHints =
    /\b(desk|sedentary|sit|sitting|couch|office|remote|wfh|little activity|mostly sit|barely active|inactive)\b/;
  if (sedHints.test(t) && !activeHints.test(t)) return 'sedentary';
  if (activeHints.test(t)) return 'active';
  return 'sedentary';
}

export function getAgeBracket(age: number | null): AgeBracket {
  if (age == null) return 'mid';
  if (age <= 30) return 'youth';
  if (age <= 50) return 'mid'; // Mid-life 31–50 per spec; 50 stays mid, 51+ senior
  return 'senior';
}

/** Weekly sets per muscle group — growth-oriented band from product spec. */
export function tableWeeklySetRange(bracket: AgeBracket, tier: ActivityTier): { min: number; max: number } {
  if (bracket === 'youth') {
    return tier === 'active' ? { min: 12, max: 20 } : { min: 8, max: 10 };
  }
  if (bracket === 'mid') {
    return tier === 'active' ? { min: 10, max: 14 } : { min: 6, max: 8 };
  }
  return tier === 'active' ? { min: 8, max: 10 } : { min: 4, max: 6 };
}

/** Inverted-U / MRV: each full decade after 30 lowers recoverable volume ceiling (~10–15% per decade). */
export function mrvMultiplierForAge(age: number | null): number {
  if (age == null || age <= 30) return 1;
  const decades = Math.floor((age - 30) / 10);
  if (decades <= 0) return 1;
  return Math.pow(PER_DECADE_MRV_FACTOR, decades);
}

export function deloadProgramEligible(age: number | null, tier: ActivityTier): boolean {
  if (tier === 'sedentary') return true;
  if (age != null && age > 40) return true;
  return false;
}

/** Rolling 5-week cycle: week index 4 mod 5 ⇒ deload when eligible. */
export function isDeloadWeekNow(): boolean {
  const weekIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
  return weekIndex % 5 === 4;
}

export interface SystemicVolumeContext {
  age: number | null;
  bracket: AgeBracket;
  activityTier: ActivityTier;
  weeklySetsPerMuscleMin: number;
  weeklySetsPerMuscleMax: number;
  mrvMultiplier: number;
  deloadActive: boolean;
  /** Spread work across more sessions; lower junk volume per day */
  preferHighFrequencyLowSession: boolean;
  /** Slightly fewer exercises per day for older / low-activity users */
  sessionExercisePenalty: number;
  /** Sedentary / older: bias toward heavier-ish reps (intensity over volume) */
  strengthRepIntensityBias: number;
}

export function computeSystemicVolumeContext(params: {
  ageStr: string | undefined;
  activityDescription: string;
}): SystemicVolumeContext {
  const age = parseAgeYears(params.ageStr);
  const bracket = getAgeBracket(age);
  const activityTier = inferActivityTier(params.activityDescription || '');
  const table = tableWeeklySetRange(bracket, activityTier);
  const mrv = mrvMultiplierForAge(age);
  const deload =
    deloadProgramEligible(age, activityTier) && isDeloadWeekNow();

  let weeklyMin = Math.max(2, Math.round(table.min * mrv));
  let weeklyMax = Math.max(weeklyMin, Math.round(table.max * mrv));
  if (deload) {
    weeklyMin = Math.max(2, Math.round(weeklyMin * 0.5));
    weeklyMax = Math.max(weeklyMin, Math.round(weeklyMax * 0.5));
  }

  /** Favor full-body / upper–lower rotation so stimulus is spread (senior sedentary + mid sedentary MED). */
  const preferHighFrequencyLowSession =
    (bracket === 'senior' && activityTier === 'sedentary') ||
    (bracket === 'mid' && activityTier === 'sedentary');

  let sessionExercisePenalty = 0;
  if (bracket === 'senior') sessionExercisePenalty += 1;
  else if (bracket === 'mid' && activityTier === 'sedentary') sessionExercisePenalty += 1;

  /** Lower activity / older: prioritize intensity (slightly lower reps) over volume. */
  let strengthRepIntensityBias = 0;
  if (activityTier === 'sedentary' && (bracket === 'mid' || bracket === 'senior')) {
    strengthRepIntensityBias = 1;
  } else if (bracket === 'senior' && activityTier === 'active') {
    strengthRepIntensityBias = 1;
  }

  return {
    age,
    bracket,
    activityTier,
    weeklySetsPerMuscleMin: weeklyMin,
    weeklySetsPerMuscleMax: weeklyMax,
    mrvMultiplier: mrv,
    deloadActive: deload,
    preferHighFrequencyLowSession,
    sessionExercisePenalty,
    strengthRepIntensityBias,
  };
}

/** Prefer full-body / UL frequency when systemic tax favors many short exposures. */
export function adjustSplitFocusesForSystemicTax(
  focuses: string[],
  days: number,
  ctx: SystemicVolumeContext
): string[] {
  if (!ctx.preferHighFrequencyLowSession) return focuses;
  if (days === 3) return ['Full Body', 'Full Body', 'Full Body'];
  if (days === 4) return ['Upper Body', 'Lower Body', 'Upper Body', 'Lower Body'];
  if (days === 5) return ['Full Body', 'Upper Body', 'Lower Body', 'Upper Body', 'Lower Body'];
  return focuses;
}

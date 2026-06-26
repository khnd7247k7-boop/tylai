/**
 * Brzycki estimated 1RM and derived "realized" strength (RPE-adjusted e1RM).
 * e1RM = Weight × (36 / (37 − Reps)), valid for reps 1–36.
 */

/** Brzycki is valid for reps 1–36; outside that range we clamp reps into range. */
export function brzyckiE1RM(weightLb: number, reps: number): number {
  if (weightLb <= 0 || reps <= 0) return 0;
  const r = Math.min(36, Math.max(1, Math.round(reps)));
  if (r === 1) return weightLb;
  return weightLb * (36 / (37 - r));
}

/** RPE 1–10: realized strength = e1RM × (RPE/10). Missing RPE → 10 (max effort). */
export function rpeModifier(rpe: number | undefined): number {
  if (rpe == null || !Number.isFinite(rpe)) return 1;
  const r = Math.min(10, Math.max(1, rpe));
  return r / 10;
}

export function realizedE1RM(weightLb: number, reps: number, rpe?: number): number {
  return brzyckiE1RM(weightLb, reps) * rpeModifier(rpe);
}

export function setVolumeLoad(weightLb: number, reps: number): number {
  if (weightLb <= 0 || reps <= 0) return 0;
  return weightLb * reps;
}

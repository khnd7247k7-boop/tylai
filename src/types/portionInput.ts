/**
 * Portion entry modes for Log Food / FDC-backed items.
 *
 * - **precise**: User picks g, oz, cup, etc. and numeric serving size (existing behavior).
 * - **simple**: User picks a fraction of one “whole” reference; macros scale from a stored per-whole snapshot.
 */
export type PortionInputMode = 'precise' | 'simple';

/** One selectable “whole” reference built from FDC portions or heuristics. */
export interface NaturalPortionReference {
  /** Grams for exactly one logical whole (e.g. one medium banana). */
  referenceGrams: number;
  /** Short noun for UI, e.g. "banana", "egg". */
  displayWholeName: string;
  /** Optional FDC portion option key for traceability. */
  portionKey?: string;
}

/** Snapshot of nutrients for `fraction === 1` (one full whole). */
export interface MacroMicroSnapshot {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  /** Optional micronutrients per one whole (same shape as app Micronutrients). */
  micronutrients?: Record<string, number | undefined | null>;
}

/** Persistable hint on a meal row (optional future use). */
export interface PortionMetadata {
  mode: PortionInputMode;
  naturalFraction?: number;
  referenceGrams?: number | null;
  displayWholeName?: string | null;
}

import type { Food, FoodPortion } from '../types/fdcApi';

export type FdcPortionMode = 'grams' | 'measure';

/** One selectable common measure from `foodPortions`. */
export interface FdcPortionOption {
  key: string;
  label: string;
  /** Grams for one selection at quantity = 1. */
  gramWeight: number;
  raw: FoodPortion;
}

function portionLabel(p: FoodPortion, index: number): string {
  const bits: string[] = [];
  if (p.amount != null && Number.isFinite(p.amount) && p.amount !== 1) {
    bits.push(String(p.amount % 1 === 0 ? p.amount : Math.round(p.amount * 100) / 100));
  }
  if (p.modifier?.trim()) bits.push(p.modifier.trim());
  if (p.portionDescription?.trim()) bits.push(p.portionDescription.trim());
  if (p.measureUnit?.name?.trim() && p.measureUnit.name !== 'undetermined') {
    bits.push(p.measureUnit.name.trim());
  }
  const s = bits.join(' ').replace(/\s+/g, ' ').trim();
  return s.length > 0 ? s : `Portion ${index + 1}`;
}

/**
 * Build dropdown options from FDC `foodPortions` (modifier + gramWeight).
 */
export function buildPortionOptions(food: Food | null | undefined): FdcPortionOption[] {
  if (!food?.foodPortions?.length) return [];
  const out: FdcPortionOption[] = [];
  food.foodPortions.forEach((p, index) => {
    const gw =
      typeof p.gramWeight === 'number' && Number.isFinite(p.gramWeight) && p.gramWeight > 0
        ? p.gramWeight
        : null;
    if (gw == null) return;
    const key = `fdc-${p.id ?? index}-${gw}`;
    out.push({
      key,
      label: portionLabel(p, index),
      gramWeight: gw,
      raw: p,
    });
  });
  return out;
}

export function foodCategoryDescription(food: Food | null | undefined): string {
  const c = food?.foodCategory;
  if (!c) return '';
  if (typeof c === 'string') return c.trim();
  return String(c.description ?? c.code ?? '').trim();
}

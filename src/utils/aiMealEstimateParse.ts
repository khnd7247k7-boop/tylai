import type { AiMealEstimate, AiMealEstimateItem, MacroConfidence } from '../types/nutritionLogging';

function stripJsonFromModelText(raw: string): string {
  const t = raw.trim();
  return t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

function coerceMacroNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function normalizeMacroConfidence(v: unknown): MacroConfidence {
  const s = String(v ?? '').toLowerCase();
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  return 'medium';
}

function normalizeAiMealItem(raw: unknown, index: number): AiMealEstimateItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? o.item ?? `Item ${index + 1}`).trim();
  if (!name) return null;
  const amountRaw = o.amount ?? o.portion ?? o.serving ?? o.quantity_label;
  const amount =
    amountRaw != null && String(amountRaw).trim() ? String(amountRaw).trim() : undefined;
  return {
    name,
    amount,
    calories: coerceMacroNumber(o.calories),
    protein_g: coerceMacroNumber(o.protein_g ?? o.protein),
    carbs_g: coerceMacroNumber(o.carbs_g ?? o.carbs),
    fat_g: coerceMacroNumber(o.fat_g ?? o.fat),
  };
}

export function parseAiMealEstimatePayload(raw: string): AiMealEstimate {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      display_name: '',
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      confidence: 'low',
      assumptions: '',
      parseWarning: 'Empty AI response.',
      rawFallback: '',
    };
  }
  const t = stripJsonFromModelText(trimmed);
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  const slice = start >= 0 && end > start ? t.slice(start, end + 1) : t;
  try {
    const o = JSON.parse(slice) as Record<string, unknown>;
    const protein = coerceMacroNumber(o.protein_g ?? o.protein) ?? 0;
    const carbs = coerceMacroNumber(o.carbs_g ?? o.carbs) ?? 0;
    const fat = coerceMacroNumber(o.fat_g ?? o.fat) ?? 0;
    const calRaw = coerceMacroNumber(o.calories);
    const calFromMacros = Math.round(protein * 4 + carbs * 4 + fat * 9);
    const calories = calRaw != null && calRaw > 0 ? Math.round(calRaw) : calFromMacros;
    const itemsRaw = o.items;
    const items = Array.isArray(itemsRaw)
      ? itemsRaw
          .map((item, i) => normalizeAiMealItem(item, i))
          .filter((x): x is AiMealEstimateItem => x !== null)
      : undefined;
    const displayName = String(o.display_name ?? o.name ?? o.meal ?? 'Logged meal').trim() || 'Logged meal';
    return {
      display_name: displayName,
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      fiber_g: coerceMacroNumber(o.fiber_g ?? o.fiber),
      confidence: normalizeMacroConfidence(o.confidence),
      assumptions: String(o.assumptions ?? o.notes ?? '').trim(),
      items: items && items.length > 0 ? items : undefined,
    };
  } catch {
    return {
      display_name: '',
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      confidence: 'low',
      assumptions: '',
      parseWarning: 'Could not read structured estimate.',
      rawFallback: trimmed,
    };
  }
}

/**
 * Build / format compact calorie + macro previews for food search rows.
 */
import type { Food, FoodNutrient, FoodSearchHit, FoodSearchMacroPreview } from '../types/fdcApi';
import { extractMacrosPer100g } from './fdcNutrients';

function roundMacro(n: number | null | undefined, decimals = 0): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Parse FatSecret v1 `food_description` summary strings. */
export function parseFatSecretFoodDescription(
  description: string | null | undefined
): FoodSearchMacroPreview | null {
  const raw = String(description ?? '').trim();
  if (!raw) return null;

  // Common: "Per 100g - Calories: 52kcal | Fat: 0.20g | Carbs: 14.00g | Protein: 0.30g"
  // Also tolerate missing spaces / alternate separators.
  const match = raw.match(
    /Per\s+(.+?)\s*[-–—]\s*Calories:\s*([\d.]+)\s*kcal\s*[|]\s*Fat:\s*([\d.]+)\s*g\s*[|]\s*Carbs:\s*([\d.]+)\s*g\s*[|]\s*Protein:\s*([\d.]+)\s*g/i
  );
  if (!match) {
    // Looser fallback if FatSecret omits Fat/Carbs order or labels vary.
    const cal = raw.match(/Calories:\s*([\d.]+)\s*kcal/i);
    const fat = raw.match(/Fat:\s*([\d.]+)\s*g/i);
    const carbs = raw.match(/Carbs:\s*([\d.]+)\s*g/i);
    const protein = raw.match(/Protein:\s*([\d.]+)\s*g/i);
    const basis = raw.match(/^Per\s+(.+?)\s*[-–—]/i);
    if (!cal && !fat && !carbs && !protein) return null;
    return {
      calories: cal ? roundMacro(parseFloat(cal[1]), 0) : null,
      fatG: fat ? roundMacro(parseFloat(fat[1]), 1) : null,
      carbsG: carbs ? roundMacro(parseFloat(carbs[1]), 1) : null,
      proteinG: protein ? roundMacro(parseFloat(protein[1]), 1) : null,
      basisLabel: basis ? `Per ${basis[1].trim()}` : 'Per serving',
    };
  }

  const basis = match[1].trim();
  return {
    calories: roundMacro(parseFloat(match[2]), 0),
    fatG: roundMacro(parseFloat(match[3]), 1),
    carbsG: roundMacro(parseFloat(match[4]), 1),
    proteinG: roundMacro(parseFloat(match[5]), 1),
    basisLabel: /^per\s/i.test(basis) ? basis : `Per ${basis}`,
  };
}

export function previewFromUsdaSearchNutrients(
  nutrients: FoodNutrient[] | null | undefined
): FoodSearchMacroPreview | null {
  if (!nutrients?.length) return null;
  const m = extractMacrosPer100g({ foodNutrients: nutrients } as Pick<Food, 'foodNutrients'>);
  if (
    m.energyKcal == null &&
    m.proteinG == null &&
    m.carbsG == null &&
    m.fatG == null
  ) {
    return null;
  }
  return {
    calories: roundMacro(m.energyKcal, 0),
    proteinG: roundMacro(m.proteinG, 1),
    carbsG: roundMacro(m.carbsG, 1),
    fatG: roundMacro(m.fatG, 1),
    basisLabel: 'Per 100g',
  };
}

export function formatFoodSearchMacroPreview(preview: FoodSearchMacroPreview | null | undefined): string | null {
  if (!preview) return null;
  const bits: string[] = [];
  if (preview.calories != null) bits.push(`${Math.round(preview.calories)} cal`);
  if (preview.proteinG != null) bits.push(`${preview.proteinG}g P`);
  if (preview.carbsG != null) bits.push(`${preview.carbsG}g C`);
  if (preview.fatG != null) bits.push(`${preview.fatG}g F`);
  if (!bits.length) return null;
  return `${preview.basisLabel}: ${bits.join(' · ')}`;
}

export function formatFoodSearchHitMacroLine(hit: FoodSearchHit): string | null {
  return formatFoodSearchMacroPreview(hit.previewMacros);
}

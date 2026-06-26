/**
 * USDA FDC — re-exports for legacy imports.
 * Implementation: {@link ../api/usda}, {@link ../utils/fdcNutrients}.
 */
export { getUsdaFdcApiKey, searchFood, getFoodDetails, mapUsdaRequestError } from '../api/usda';
export { extractMacrosPer100g, scaleMacrosFrom100g, calculateNutrients, FDC_CORE_NUTRIENT_MAP } from '../utils/fdcNutrients';

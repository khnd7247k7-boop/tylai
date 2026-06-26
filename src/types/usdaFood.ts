/**
 * USDA FDC types — aliases for legacy imports (`Fdc*`).
 * Canonical definitions: {@link ./fdcApi}.
 */

export type {
  Food,
  FoodNutrient,
  FoodPortion,
  FoodSearchHit,
  FoodsSearchResponse,
  FoodMacrosPer100g,
  FoodCategoryRef,
  FoodMeasureUnit,
} from './fdcApi';

export type { Food as FdcFoodDetail } from './fdcApi';
export type { FoodNutrient as FdcFoodNutrient } from './fdcApi';
export type { FoodPortion as FdcFoodPortion } from './fdcApi';
export type { FoodSearchHit as FdcSearchFood } from './fdcApi';
export type { FoodsSearchResponse as FdcFoodsSearchResponse } from './fdcApi';
export type { FoodMacrosPer100g as FdcMacrosPer100g } from './fdcApi';

export type FdcDataType = 'Foundation' | 'SR Legacy' | string;

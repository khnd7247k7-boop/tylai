/**
 * USDA FoodData Central v1 — strict shapes used by {@link ../api/usda}.
 * @see https://fdc.nal.usda.gov/api-guide.html
 */

export interface FoodMeasureUnit {
  id?: number;
  name?: string;
  abbreviation?: string;
}

/** Portion row from GET /v1/food/{fdcId} (`foodPortions`). */
export interface FoodPortion {
  id?: number;
  value?: number;
  measureUnit?: FoodMeasureUnit;
  modifier?: string;
  gramWeight?: number;
  amount?: number;
  portionDescription?: string;
  sequenceNumber?: number;
}

export interface FoodNutrient {
  type?: string;
  id?: number;
  nutrient?: {
    id: number;
    number?: string;
    name?: string;
    rank?: number;
    unitName?: string;
  };
  /** Typical: amount per 100 g (Foundation / SR). */
  amount?: number;
  value?: number;
  nutrientId?: number;
}

export interface FoodCategoryRef {
  id?: number;
  code?: string;
  description?: string;
}

/** GET /v1/food/{fdcId} */
export interface Food {
  fdcId: number;
  description?: string;
  dataType?: string;
  foodClass?: string;
  foodCategory?: string | FoodCategoryRef;
  foodNutrients?: FoodNutrient[];
  foodPortions?: FoodPortion[];
}

/** Normalized POST /v1/foods/search hit. */
export interface FoodSearchHit {
  fdcId: number;
  /** Which catalog produced this hit. FatSecret ids are stored as negative `fdcId`. */
  source?: 'usda' | 'fatsecret';
  /** Positive FatSecret food_id when source is fatsecret. */
  fatSecretFoodId?: string;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  scientificName?: string;
  foodCategory?: string;
  foodNutrients?: FoodNutrient[];
  /** Optional calorie/macro snapshot for search-result previews (per serving or per 100 g). */
  previewMacros?: FoodSearchMacroPreview;
}

/** Compact macros shown under a food search result before the user opens details. */
export interface FoodSearchMacroPreview {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  /** e.g. "Per 100g" or "Per 1 serving" */
  basisLabel: string;
}

export interface FoodsSearchResponse {
  totalHits?: number;
  currentPage?: number;
  totalPages?: number;
  foods?: unknown[];
}

/** Core macros per 100 g (lab convention). */
export interface FoodMacrosPer100g {
  energyKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
}

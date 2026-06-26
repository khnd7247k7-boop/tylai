/** Row from foods + FTS join (search). */
export interface UsdaFoodSearchRow {
  fdc_id: number;
  description: string;
  bm25: number;
}

/** Single nutrient row (per 100 g reference in bundled sample DB). */
export interface UsdaNutrientRow {
  nutrient_id: number;
  nutrient_name: string;
  amount: number;
  unit_name: string;
}

/** food_portions row — grams scale with `amount` (reference count for the label). */
export interface UsdaFoodPortionRow {
  id: number;
  fdc_id: number;
  portion_description: string;
  gram_weight: number;
  amount: number;
}

export interface UsdaFoodDetail {
  food: { fdc_id: number; description: string };
  nutrients: UsdaNutrientRow[];
  portions: UsdaFoodPortionRow[];
}

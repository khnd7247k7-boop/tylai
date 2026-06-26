/** How the user prefers to log meals in Log Food. */
export type NutritionLoggingMode = 'precision' | 'ai';

export type MacroConfidence = 'high' | 'medium' | 'low';

export interface AiMealEstimateItem {
  name: string;
  /** Portion size, e.g. "1 cup", "6 oz", "2 large eggs". */
  amount?: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

/** Editable line item when logging a multi-component meal (AI / Food coach). */
export interface LogFoodItem {
  id: string;
  name: string;
  amount: string;
  /** Multiplier applied to base macros (e.g. 0.5 for half portion). */
  quantity: number;
  baseProtein: number;
  baseCarbs: number;
  baseFat: number;
}

/** Structured estimate from natural-language meal logging (AI mode). */
export interface AiMealEstimate {
  display_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number | null;
  confidence: MacroConfidence;
  assumptions: string;
  items?: AiMealEstimateItem[];
  parseWarning?: string;
  rawFallback?: string;
}

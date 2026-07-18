/** Standardized food identification result for Smart Food Scanner. */

export type FoodProductSource =
  | 'barcode'
  | 'ocr'
  | 'packageRecognition'
  | 'manual'
  | 'merged';

export type FoodProductServingUnit =
  | 'piece'
  | 'g'
  | 'oz'
  | 'fl_oz'
  | 'cup'
  | 'ml'
  | 'tbsp'
  | 'tsp';

export type FoodMicronutrients = {
  fiber?: number;
  sugar?: number;
  addedSugar?: number;
  sodium?: number;
  cholesterol?: number;
  saturatedFat?: number;
  transFat?: number;
  calcium?: number;
  iron?: number;
  potassium?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
  vitaminE?: number;
  vitaminK?: number;
  thiamin?: number;
  riboflavin?: number;
  niacin?: number;
  vitaminB6?: number;
  folate?: number;
  vitaminB12?: number;
  biotin?: number;
  pantothenicAcid?: number;
  phosphorus?: number;
  iodine?: number;
  magnesium?: number;
  zinc?: number;
  selenium?: number;
  copper?: number;
  manganese?: number;
  chromium?: number;
  molybdenum?: number;
  chloride?: number;
};

export type FoodProduct = {
  id: string;
  barcode?: string;
  brand?: string;
  productName: string;
  servingSize?: string;
  servingUnit?: FoodProductServingUnit;
  servingsPerContainer?: number;
  /** Grams (or ml≈g) for one label serving when known. */
  servingWeightGrams?: number;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  ingredients?: string;
  micronutrients?: FoodMicronutrients;
  source: FoodProductSource;
  /** 0–1 confidence from the identification method. */
  confidence: number;
  nutritionNote?: string;
};

export type FoodProductMatchCandidate = {
  product: FoodProduct;
  reason: string;
};

export type SmartScanResult =
  | {
      status: 'matched';
      product: FoodProduct;
      /** True when confidence is high enough to pre-fill without forcing a pick list. */
      autoPopulate: boolean;
    }
  | {
      status: 'candidates';
      candidates: FoodProductMatchCandidate[];
      /** Best-effort partial fill (e.g. OCR macros) when no DB match. */
      partial?: FoodProduct;
    }
  | {
      status: 'needs_confirmation';
      product: FoodProduct;
    }
  | {
      status: 'not_found';
      barcode?: string;
      message: string;
    };

/** Confidence thresholds — only auto-populate at or above these. */
export const FOOD_SCAN_CONFIDENCE = {
  barcode: 0.95,
  ocr: 0.9,
  packageRecognition: 0.85,
  semanticSearch: 0.8,
  /** Minimum to show as a selectable candidate. */
  candidateFloor: 0.55,
} as const;

import type { ScannedFood } from '../../utils/foodDatabase';
import type { FoodProduct, FoodProductServingUnit } from '../../types/foodProduct';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function scannedFoodToFoodProduct(
  food: ScannedFood,
  opts?: { confidence?: number; source?: FoodProduct['source'] }
): FoodProduct {
  const unit = (food.servingUnit as FoodProductServingUnit | undefined) ?? undefined;
  return {
    id: newId('fp'),
    barcode: food.barcode || undefined,
    brand: food.brand,
    productName: food.name,
    servingSize: food.servingSize,
    servingUnit: unit,
    servingWeightGrams: food.servingWeight ?? food.referenceGrams,
    calories: Number(food.calories) || 0,
    protein: Number(food.protein) || 0,
    carbohydrates: Number(food.carbs) || 0,
    fat: Number(food.fat) || 0,
    fiber: food.micronutrients?.fiber,
    sugar: food.micronutrients?.sugar,
    sodium: food.micronutrients?.sodium,
    micronutrients: food.micronutrients,
    source: opts?.source ?? 'barcode',
    confidence: opts?.confidence ?? 0.97,
    nutritionNote: food.nutritionNote,
  };
}

/** Adapter into the existing Log Food / handleFoodScanned pipeline. */
export function foodProductToScannedFood(product: FoodProduct): ScannedFood {
  return {
    name: [product.brand, product.productName].filter(Boolean).join(' ').trim() || product.productName,
    brand: product.brand,
    calories: product.calories,
    protein: product.protein,
    carbs: product.carbohydrates,
    fat: product.fat,
    servingSize: product.servingSize || '1 serving',
    barcode: product.barcode || '',
    micronutrients: {
      ...product.micronutrients,
      fiber: product.fiber ?? product.micronutrients?.fiber,
      sugar: product.sugar ?? product.micronutrients?.sugar,
      sodium: product.sodium ?? product.micronutrients?.sodium,
    },
    servingUnit: product.servingUnit,
    servingWeight: product.servingWeightGrams,
    baseServingSize: 1,
    referenceGrams: product.servingWeightGrams,
    nutritionNote: product.nutritionNote,
  };
}

export function mergeFoodProducts(primary: FoodProduct, secondary: FoodProduct): FoodProduct {
  const prefer = <T>(a: T | undefined, b: T | undefined): T | undefined =>
    a !== undefined && a !== null && a !== '' ? a : b;

  const confidence = Math.max(primary.confidence, secondary.confidence);
  return {
    id: primary.id || secondary.id || newId('fp'),
    barcode: prefer(primary.barcode, secondary.barcode),
    brand: prefer(primary.brand, secondary.brand),
    productName: prefer(primary.productName, secondary.productName) || 'Scanned food',
    servingSize: prefer(primary.servingSize, secondary.servingSize),
    servingUnit: prefer(primary.servingUnit, secondary.servingUnit),
    servingsPerContainer: prefer(primary.servingsPerContainer, secondary.servingsPerContainer),
    servingWeightGrams: prefer(primary.servingWeightGrams, secondary.servingWeightGrams),
    calories: primary.calories > 0 ? primary.calories : secondary.calories,
    protein: primary.protein > 0 ? primary.protein : secondary.protein,
    carbohydrates: primary.carbohydrates > 0 ? primary.carbohydrates : secondary.carbohydrates,
    fat: primary.fat > 0 ? primary.fat : secondary.fat,
    fiber: prefer(primary.fiber, secondary.fiber),
    sugar: prefer(primary.sugar, secondary.sugar),
    sodium: prefer(primary.sodium, secondary.sodium),
    ingredients: prefer(primary.ingredients, secondary.ingredients),
    micronutrients: { ...secondary.micronutrients, ...primary.micronutrients },
    source: 'merged',
    confidence,
    nutritionNote: [primary.nutritionNote, secondary.nutritionNote].filter(Boolean).join(' ') || undefined,
  };
}

export function hasUsableMacros(product: FoodProduct): boolean {
  return (
    (product.calories > 0 || product.protein > 0 || product.carbohydrates > 0 || product.fat > 0) &&
    Boolean(product.productName?.trim())
  );
}

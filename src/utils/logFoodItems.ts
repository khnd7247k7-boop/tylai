import type { AiMealEstimate, AiMealEstimateItem } from '../types/nutritionLogging';
import type { LogFoodItem } from '../types/nutritionLogging';
import type { EatingOutCoachSuggestion } from '../services/geminiService';

export function createLogFoodItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createLogFoodItem(
  partial: Partial<LogFoodItem> & Pick<LogFoodItem, 'name'>
): LogFoodItem {
  return {
    id: partial.id ?? createLogFoodItemId(),
    name: partial.name.trim(),
    amount: partial.amount?.trim() || '1 serving',
    quantity: partial.quantity != null && partial.quantity > 0 ? partial.quantity : 1,
    baseProtein: partial.baseProtein ?? 0,
    baseCarbs: partial.baseCarbs ?? 0,
    baseFat: partial.baseFat ?? 0,
  };
}

function splitNameAndAmount(name: string, amount?: string): { name: string; amount: string } {
  const explicit = amount?.trim();
  if (explicit) return { name: name.trim(), amount: explicit };

  const paren = name.trim().match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (paren) {
    return { name: paren[1].trim(), amount: paren[2].trim() };
  }
  return { name: name.trim(), amount: '1 serving' };
}

export function logFoodItemFromAiEstimate(item: AiMealEstimateItem): LogFoodItem {
  const { name, amount } = splitNameAndAmount(item.name, item.amount);
  return createLogFoodItem({
    name,
    amount,
    baseProtein: item.protein_g ?? 0,
    baseCarbs: item.carbs_g ?? 0,
    baseFat: item.fat_g ?? 0,
  });
}

export function logFoodItemsFromAiEstimate(estimate: AiMealEstimate): LogFoodItem[] {
  if (estimate.items?.length) {
    return estimate.items.map(logFoodItemFromAiEstimate);
  }
  return [
    createLogFoodItem({
      name: estimate.display_name.trim() || 'Logged meal',
      amount: '1 serving',
      baseProtein: estimate.protein_g,
      baseCarbs: estimate.carbs_g,
      baseFat: estimate.fat_g,
    }),
  ];
}

export function logFoodItemsFromEatingOutPick(
  pick: EatingOutCoachSuggestion,
  mealName: string
): LogFoodItem[] {
  const p = pick.protein_g ?? 0;
  const c = pick.carbs_g ?? 0;
  const f = pick.fat_g ?? 0;
  const amount =
    pick.description.match(/\b(\d+(?:\.\d+)?\s*(?:oz|g|cup|cups|serving|order|piece|pieces|bowl|plate)s?)\b/i)?.[1] ??
    '1 order';
  return [
    createLogFoodItem({
      name: mealName,
      amount,
      baseProtein: p,
      baseCarbs: c,
      baseFat: f,
    }),
  ];
}

export function scaledMacrosForLogFoodItem(item: LogFoodItem): {
  protein: number;
  carbs: number;
  fat: number;
} {
  const q = item.quantity > 0 ? item.quantity : 1;
  return {
    protein: Math.round(item.baseProtein * q * 10) / 10,
    carbs: Math.round(item.baseCarbs * q * 10) / 10,
    fat: Math.round(item.baseFat * q * 10) / 10,
  };
}

export function sumLogFoodItemMacros(items: LogFoodItem[]): {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
} {
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  for (const item of items) {
    const scaled = scaledMacrosForLogFoodItem(item);
    protein += scaled.protein;
    carbs += scaled.carbs;
    fat += scaled.fat;
  }
  protein = Math.round(protein * 10) / 10;
  carbs = Math.round(carbs * 10) / 10;
  fat = Math.round(fat * 10) / 10;
  return {
    protein,
    carbs,
    fat,
    calories: Math.round(protein * 4 + carbs * 4 + fat * 9),
  };
}

export function formatLogFoodItemsSummary(items: LogFoodItem[]): string | null {
  if (!items.length) return null;
  return items
    .map((item) => {
      const amt = item.amount.trim();
      const qty =
        item.quantity > 0 && Math.abs(item.quantity - 1) > 0.001 ? `${item.quantity}× ` : '';
      const portion = amt ? `${qty}${amt}` : qty.trim();
      return portion ? `${item.name} (${portion})` : item.name;
    })
    .join(' · ');
}

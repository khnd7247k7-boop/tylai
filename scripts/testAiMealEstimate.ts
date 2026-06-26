/**
 * Run: npx tsx scripts/testAiMealEstimate.ts
 */
import { parseAiMealEstimatePayload } from '../src/utils/aiMealEstimateParse';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const chipotle = parseAiMealEstimatePayload(`{
  "display_name": "Chipotle chicken bowl",
  "calories": 665,
  "protein_g": 42,
  "carbs_g": 68,
  "fat_g": 22,
  "confidence": "medium",
  "assumptions": "Standard bowl with white rice, black beans, chicken, mild salsa, lettuce.",
  "items": [
    { "name": "Chicken", "calories": 180, "protein_g": 32, "carbs_g": 0, "fat_g": 7 }
  ]
}`);

assert(chipotle.display_name === 'Chipotle chicken bowl', 'display_name');
assert(chipotle.calories === 665, 'calories');
assert(chipotle.protein_g === 42, 'protein');
assert(chipotle.confidence === 'medium', 'confidence');
assert(chipotle.items?.length === 1, 'items');

const homePlate = parseAiMealEstimatePayload(`{
  "display_name": "Rice with ground beef and eggs",
  "calories": 720,
  "protein_g": 38,
  "carbs_g": 62,
  "fat_g": 32,
  "confidence": "medium",
  "assumptions": "1 cup cooked white rice, 5 oz cooked lean ground beef, 2 large scrambled eggs.",
  "items": [
    { "name": "Cooked white rice", "amount": "1 cup cooked", "calories": 205, "protein_g": 4, "carbs_g": 45, "fat_g": 0.5 },
    { "name": "Ground beef", "amount": "5 oz cooked", "calories": 280, "protein_g": 26, "carbs_g": 0, "fat_g": 18 },
    { "name": "Eggs", "amount": "2 large", "calories": 235, "protein_g": 12, "carbs_g": 2, "fat_g": 16 }
  ]
}`);

assert(homePlate.display_name.includes('Rice'), 'home plate title');
assert(homePlate.items?.length === 3, 'home plate item breakdown');
assert(homePlate.items?.[2].amount === '2 large', 'home plate item amount');
assert(homePlate.protein_g === 38, 'home plate protein');

console.log('AI meal estimate parser tests passed.');

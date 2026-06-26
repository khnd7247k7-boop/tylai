import type { EatingOutCoachSuggestion } from '../services/geminiService';
import type { AiMealEstimate } from '../types/nutritionLogging';

function normalizeLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when the label is basically the user's search phrase, not a dish name. */
export function isFoodCoachQueryEcho(label: string, userQuery: string): boolean {
  const meal = normalizeLabel(label);
  const query = normalizeLabel(userQuery);
  if (!meal || !query) return false;
  if (meal === query) return true;
  if (query.includes(meal) && meal.length <= query.length * 0.92) return true;
  if (meal.includes(query) && query.length >= meal.length * 0.85) return true;
  return /^(option|pick|suggestion|choice)\s*\d+$/i.test(label.trim());
}

function isWeakMealLabel(label: string): boolean {
  const t = label.trim();
  if (!t) return true;
  if (/^(option|pick|suggestion|choice|meal|menu|high protein|logged meal)\s*\d*$/i.test(t)) return true;
  return t.length < 3;
}

/** Pull a short dish title from coach description prose when meal echoes the query. */
function dishNameFromDescription(description: string): string {
  const text = description.trim();
  if (!text) return '';

  const quoted = text.match(/["“]([^"”]{3,80})["”]/);
  if (quoted?.[1]) return quoted[1].trim();

  const firstSentence = text.split(/[.!?]/)[0]?.trim() ?? '';
  if (!firstSentence) return '';

  const withoutLead = firstSentence
    .replace(/^(the|this|try|order|get|choose)\s+/i, '')
    .replace(/^(a|an)\s+/i, '')
    .trim();

  if (withoutLead.length >= 3 && withoutLead.length <= 80) {
    return withoutLead;
  }
  return '';
}

/** Restaurant chain label from a search like "mo bettahs menu high protein". */
export function extractRestaurantLabelFromQuery(query: string): string {
  let q = query.trim();
  const prefixes = [
    /^what should i order at\s+/i,
    /^what can i (?:eat|order) at\s+/i,
    /^help me order at\s+/i,
    /^i(?:'m| am) (?:at|going to|eating at)\s+/i,
    /^at\s+/i,
    /^order(?:ing)? at\s+/i,
  ];
  for (const re of prefixes) {
    q = q.replace(re, '');
  }
  q = q.replace(/\?+$/, '').trim();
  q = q
    .replace(
      /\s+(?:for|with|tonight|today|lunch|dinner|breakfast|this week|menu|macros?).*$/i,
      ''
    )
    .trim();
  q = q
    .replace(
      /\s+(?:high[\s-]?protein|low[\s-]?carb|keto|macro[s]?|lean|healthy|under\s+\d+).*$/i,
      ''
    )
    .trim();
  q = q.replace(/\s+menu\s*$/i, '').trim();
  return q || query.trim();
}

function combineRestaurantAndDish(restaurant: string, dish: string): string {
  const r = restaurant.trim();
  const d = dish.trim();
  if (!d) return r.slice(0, 120);
  if (!r) return d.slice(0, 120);
  const rNorm = normalizeLabel(r);
  const dNorm = normalizeLabel(d);
  if (dNorm.includes(rNorm) || rNorm.includes(dNorm)) return d.slice(0, 120);
  return `${r} — ${d}`.slice(0, 120);
}

/** Name to store in the food log when the user picks a Food coach suggestion. */
export function formatEatingOutCoachLogName(
  pick: EatingOutCoachSuggestion,
  userQuery: string
): string {
  const query = userQuery.trim();
  let dish = pick.meal.trim();

  if (isFoodCoachQueryEcho(dish, query) || isWeakMealLabel(dish)) {
    const fromDescription = dishNameFromDescription(pick.description);
    if (fromDescription && !isFoodCoachQueryEcho(fromDescription, query)) {
      dish = fromDescription;
    }
  }

  if (isFoodCoachQueryEcho(dish, query) || isWeakMealLabel(dish)) {
    const hackLead = pick.pro_hack.split(/[.;]/)[0]?.trim() ?? '';
    if (hackLead && !isFoodCoachQueryEcho(hackLead, query) && hackLead.length <= 80) {
      dish = hackLead;
    }
  }

  if (isFoodCoachQueryEcho(dish, query) || isWeakMealLabel(dish)) {
    dish = `Menu pick #${pick.rank}`;
  }

  const restaurant = extractRestaurantLabelFromQuery(query);
  if (restaurant && !isFoodCoachQueryEcho(restaurant, query)) {
    return combineRestaurantAndDish(restaurant, dish);
  }
  return dish.slice(0, 120);
}

/** Name to store when AI mode estimates macros from a plain-language description. */
export function formatAiMealLogName(estimate: AiMealEstimate, userQuery: string): string {
  const query = userQuery.trim();
  const display = estimate.display_name.trim();

  if (display && !isFoodCoachQueryEcho(display, query) && !isWeakMealLabel(display)) {
    return display.slice(0, 120);
  }

  const itemNames = estimate.items?.map((item) => item.name.trim()).filter(Boolean) ?? [];
  if (itemNames.length === 1) return itemNames[0].slice(0, 120);
  if (itemNames.length > 1) return itemNames.join(', ').slice(0, 120);

  if (display) return display.slice(0, 120);
  return 'Logged meal';
}

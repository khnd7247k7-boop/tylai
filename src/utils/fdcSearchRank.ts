import type { FoodSearchHit } from '../types/fdcApi';

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** True if query is a 4-digit PLU-style code (produce lookup). */
export function isPluStyleQuery(query: string): boolean {
  return /^\d{4}$/.test(query.trim());
}

function rankScore(query: string, item: FoodSearchHit): number {
  const q = norm(query);
  if (!q) return 0;
  const desc = norm(item.description);
  const cat = norm(item.foodCategory ?? '');
  let score = 0;

  if (desc === q) score += 1000;
  else if (desc.startsWith(q)) score += 500;
  else if (desc.includes(` ${q} `) || desc.includes(` ${q},`) || desc.endsWith(` ${q}`)) score += 350;
  else if (desc.includes(q)) score += 200;

  const words = q.split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (w.length < 2) continue;
    if (desc.includes(w)) score += 40;
    if (cat.includes(w)) score += 15;
  }

  if (isPluStyleQuery(query)) {
    if (desc.includes(q)) score += 800;
    if (/\b(fruit|apple|banana|orange|grape|pear|plum|melon|berry|citrus)\b/i.test(desc)) score += 120;
    if (/\b(vegetable|lettuce|tomato|pepper|onion|carrot|broccoli|greens)\b/i.test(desc)) score += 120;
    if (/\bplu\b/i.test(desc)) score += 200;
  }

  const dt = norm(item.dataType ?? '');
  if (dt === 'foundation') score += 30;
  else if (dt.includes('sr legacy')) score += 20;

  return score;
}

/**
 * Client-side fuzzy ordering: exact / prefix matches first, then PLU heuristics.
 */
export function rankFoodSearchResults(query: string, items: FoodSearchHit[]): FoodSearchHit[] {
  const q = query.trim();
  if (!q) return [...items];
  return [...items].sort((a, b) => {
    const d = rankScore(q, b) - rankScore(q, a);
    if (d !== 0) return d;
    return a.description.localeCompare(b.description);
  });
}

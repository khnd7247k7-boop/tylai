import { exerciseDatabase, getExerciseData } from '../data/exerciseDatabase';
import type { ExerciseData } from '../data/exerciseDatabase';
import type {
  ExerciseMatchConfidence,
  MatchedSpreadsheetExercise,
  MatchedSpreadsheetRoutine,
  ParsedSpreadsheetExercise,
  ParsedSpreadsheetRoutine,
} from '../types/workoutSpreadsheetParse';

function normalizeExerciseName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dice coefficient on character bigrams — good for short exercise names. */
function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;

  const grams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };

  const A = grams(a);
  const B = grams(b);
  let overlap = 0;
  for (const [g, count] of A) {
    const other = B.get(g);
    if (other) overlap += Math.min(count, other);
  }
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return hit / Math.max(ta.size, tb.size);
}

function tokensOf(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean);
}

/**
 * True when raw is a more specific variant of candidate
 * (e.g. "dumbbell squats" vs "squats") — never collapse those.
 */
export function isMoreSpecificExerciseName(rawName: string, candidateName: string): boolean {
  const a = tokensOf(normalizeExerciseName(rawName));
  const b = tokensOf(normalizeExerciseName(candidateName));
  if (!a.length || !b.length || a.length <= b.length) return false;
  return b.every((t) => a.includes(t));
}

export function scoreExerciseNameMatch(rawName: string, candidateName: string): number {
  const a = normalizeExerciseName(rawName);
  const b = normalizeExerciseName(candidateName);
  if (!a || !b) return 0;
  if (a === b) return 1;

  // "Dumbbell Squats" contains "Squats" — that is NOT a near-exact match.
  if (isMoreSpecificExerciseName(a, b) || isMoreSpecificExerciseName(b, a)) {
    const tokens = tokenOverlap(a, b);
    const bigram = bigramSimilarity(a, b);
    // Cap below the auto-remap threshold so the plan keeps its wording.
    return Math.min(0.7, Math.max(bigram * 0.85, tokens * 0.85));
  }

  if (a.includes(b) || b.includes(a)) {
    return 0.92;
  }
  const bigram = bigramSimilarity(a, b);
  const tokens = tokenOverlap(a, b);
  return Math.max(bigram, tokens * 0.95, (bigram + tokens) / 2);
}

function confidenceFromScore(score: number): ExerciseMatchConfidence {
  if (score >= 0.86) return 'high';
  if (score >= 0.72) return 'medium';
  return 'unmapped';
}

export type ExerciseMatchResult = {
  matchedName: string;
  matchConfidence: ExerciseMatchConfidence;
  matchScore: number;
  catalogEntry: ExerciseData | null;
};

/**
 * Match a raw OCR/AI exercise name against the built-in catalog (+ optional user customs).
 */
export function matchExerciseName(
  rawName: string,
  extraCatalog: ExerciseData[] = []
): ExerciseMatchResult {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return { matchedName: '', matchConfidence: 'unmapped', matchScore: 0, catalogEntry: null };
  }

  const exact = getExerciseData(trimmed) ?? extraCatalog.find(
    (e) => e.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (exact) {
    return {
      matchedName: exact.name,
      matchConfidence: 'high',
      matchScore: 1,
      catalogEntry: exact,
    };
  }

  let best: { entry: ExerciseData; score: number } | null = null;
  const pool = [...exerciseDatabase, ...extraCatalog];
  for (const entry of pool) {
    const score = scoreExerciseNameMatch(trimmed, entry.name);
    if (!best || score > best.score) best = { entry, score };
  }

  if (!best || best.score < 0.72 || isMoreSpecificExerciseName(trimmed, best.entry.name)) {
    // Keep the plan's exact wording (e.g. "Dumbbell Squats") and add it as a custom later.
    return {
      matchedName: trimmed,
      matchConfidence: 'unmapped',
      matchScore: best?.score ?? 0,
      catalogEntry: null,
    };
  }

  return {
    matchedName: best.entry.name,
    matchConfidence: confidenceFromScore(best.score),
    matchScore: best.score,
    catalogEntry: best.entry,
  };
}

export function matchParsedExercise(
  exercise: ParsedSpreadsheetExercise,
  extraCatalog: ExerciseData[] = []
): MatchedSpreadsheetExercise {
  const match = matchExerciseName(exercise.name, extraCatalog);
  const suggestions = suggestExerciseNames(exercise.name, 6, extraCatalog)
    .map((s) => s.name)
    .filter((n) => n.toLowerCase() !== (match.matchedName || exercise.name).toLowerCase());
  return {
    ...exercise,
    matchedName: match.matchedName || exercise.name,
    matchConfidence: match.matchConfidence,
    matchScore: match.matchScore,
    suggestions,
  };
}

export function matchParsedRoutine(
  routine: ParsedSpreadsheetRoutine,
  extraCatalog: ExerciseData[] = []
): MatchedSpreadsheetRoutine {
  return {
    name: routine.name?.trim() || 'Scanned Program',
    notes: routine.notes,
    days: (routine.days ?? []).map((day) => ({
      name: day.name?.trim() || 'Workout',
      exercises: (day.exercises ?? []).map((ex) => matchParsedExercise(ex, extraCatalog)),
    })),
  };
}

export type ExerciseNameSuggestion = {
  name: string;
  score: number;
  matchConfidence: ExerciseMatchConfidence;
};

/**
 * Rank catalog names against a raw OCR/AI string for quick user corrections.
 */
export function suggestExerciseNames(
  rawName: string,
  limit = 8,
  extraCatalog: ExerciseData[] = []
): ExerciseNameSuggestion[] {
  const trimmed = rawName.trim();
  if (!trimmed || limit <= 0) return [];

  const pool = [...exerciseDatabase, ...extraCatalog];
  const scored: ExerciseNameSuggestion[] = [];
  for (const entry of pool) {
    const score = scoreExerciseNameMatch(trimmed, entry.name);
    if (score < 0.45) continue;
    scored.push({
      name: entry.name,
      score,
      matchConfidence: confidenceFromScore(score),
    });
  }
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: ExerciseNameSuggestion[] = [];
  for (const s of scored) {
    const key = s.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Filter the exercise catalog by a free-text query (substring / fuzzy).
 */
export function searchExerciseCatalog(
  query: string,
  limit = 40,
  extraCatalog: ExerciseData[] = []
): string[] {
  const q = query.trim().toLowerCase();
  const pool = [...exerciseDatabase, ...extraCatalog];
  if (!q) {
    return pool.slice(0, limit).map((e) => e.name);
  }

  const starts: string[] = [];
  const includes: string[] = [];
  const fuzzy: { name: string; score: number }[] = [];

  for (const entry of pool) {
    const name = entry.name;
    const lower = name.toLowerCase();
    if (lower.startsWith(q)) {
      starts.push(name);
      continue;
    }
    if (lower.includes(q)) {
      includes.push(name);
      continue;
    }
    const score = scoreExerciseNameMatch(q, name);
    if (score >= 0.55) fuzzy.push({ name, score });
  }

  fuzzy.sort((a, b) => b.score - a.score);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of [...starts, ...includes, ...fuzzy.map((f) => f.name)]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

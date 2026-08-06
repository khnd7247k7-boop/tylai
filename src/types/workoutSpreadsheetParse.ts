/** Structured output from AI spreadsheet vision + client matching. */

export type ParsedSpreadsheetExercise = {
  /** Raw name from the spreadsheet / OCR. */
  name: string;
  sets: number | null;
  /** Single target or range string e.g. "8-12". */
  reps: string | null;
  weight: number | null;
  /** Rest seconds when present. */
  restSeconds: number | null;
  rpe: number | null;
  rir: number | null;
  notes: string | null;
};

export type ParsedSpreadsheetDay = {
  /** Day / session title e.g. "Push Day A", "Monday". */
  name: string;
  exercises: ParsedSpreadsheetExercise[];
};

export type ParsedSpreadsheetRoutine = {
  /** Overall program / routine name. */
  name: string;
  days: ParsedSpreadsheetDay[];
  notes: string | null;
};

export type ExerciseMatchConfidence = 'high' | 'medium' | 'unmapped';

export type MatchedSpreadsheetExercise = ParsedSpreadsheetExercise & {
  /** Catalog name when matched; otherwise raw name. */
  matchedName: string;
  matchConfidence: ExerciseMatchConfidence;
  matchScore: number;
  /** Nearby catalog alternatives for one-tap correction. */
  suggestions?: string[];
};

export type MatchedSpreadsheetDay = {
  name: string;
  exercises: MatchedSpreadsheetExercise[];
};

export type MatchedSpreadsheetRoutine = {
  name: string;
  days: MatchedSpreadsheetDay[];
  notes: string | null;
};

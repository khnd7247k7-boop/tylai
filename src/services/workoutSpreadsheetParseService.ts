/**
 * Client helpers to call POST /api/workouts/parse-spreadsheet on gemini-proxy,
 * then match exercise names against the local catalog.
 */

import { assertPremiumGeminiAccess } from '../utils/subscription';
import { proxyJsonFetch } from './proxyClient';
import { loadUserCustomExercises } from '../utils/userCustomExercises';
import { matchParsedRoutine } from '../utils/exerciseNameMatch';
import type {
  MatchedSpreadsheetRoutine,
  ParsedSpreadsheetRoutine,
} from '../types/workoutSpreadsheetParse';

function asNumberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function asStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizeParsedRoutine(raw: unknown): ParsedSpreadsheetRoutine {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const daysRaw = Array.isArray(data.days) ? data.days : [];
  const days = daysRaw
    .map((d) => {
      if (!d || typeof d !== 'object') return null;
      const day = d as Record<string, unknown>;
      const exercisesRaw = Array.isArray(day.exercises) ? day.exercises : [];
      const exercises = exercisesRaw
        .map((e) => {
          if (!e || typeof e !== 'object') return null;
          const ex = e as Record<string, unknown>;
          const name = asStringOrNull(ex.name);
          if (!name) return null;
          return {
            name,
            sets: asNumberOrNull(ex.sets),
            reps: asStringOrNull(ex.reps) ?? (asNumberOrNull(ex.reps) != null ? String(asNumberOrNull(ex.reps)) : null),
            weight: asNumberOrNull(ex.weight),
            restSeconds: asNumberOrNull(ex.restSeconds ?? ex.rest),
            rpe: asNumberOrNull(ex.rpe),
            rir: asNumberOrNull(ex.rir),
            notes: asStringOrNull(ex.notes),
          };
        })
        .filter(Boolean) as ParsedSpreadsheetRoutine['days'][0]['exercises'];
      return {
        name: asStringOrNull(day.name) || 'Workout',
        exercises,
      };
    })
    .filter((d): d is ParsedSpreadsheetRoutine['days'][0] => !!d && d.exercises.length > 0);

  return {
    name: asStringOrNull(data.name) || 'Scanned Program',
    days,
    notes: asStringOrNull(data.notes),
  };
}

/**
 * Send a compressed workout spreadsheet photo to the vision API and return
 * catalog-matched structured routine data for the review UI.
 */
export async function parseWorkoutSpreadsheetImage(input: {
  base64: string;
  mimeType?: string;
}): Promise<MatchedSpreadsheetRoutine> {
  assertPremiumGeminiAccess();
  const data = input.base64.replace(/^data:[^;]+;base64,/, '').trim();
  if (!data) throw new Error('No image data to analyze.');

  const mimeType = input.mimeType?.trim() || 'image/jpeg';
  const body = await proxyJsonFetch<{
    routine?: unknown;
    error?: string;
  }>('/api/workouts/parse-spreadsheet', {
    method: 'POST',
    body: JSON.stringify({
      image: { mimeType, data },
    }),
  });

  const parsed = normalizeParsedRoutine(body.routine ?? body);
  if (!parsed.days.length) {
    throw new Error(
      'Could not find exercises in that photo. Try a clearer shot of the spreadsheet or handwritten log.'
    );
  }

  const userCustom = await loadUserCustomExercises();
  return matchParsedRoutine(parsed, userCustom);
}

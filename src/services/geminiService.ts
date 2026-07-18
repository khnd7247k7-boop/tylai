import {
  GoogleGenerativeAI,
  SchemaType,
  FunctionCallingMode,
  type Content,
  type Tool,
  type FunctionDeclaration,
} from '@google/generative-ai';
import { getProxyBaseUrl, proxyJsonFetch } from './proxyClient';
import { assertPremiumGeminiAccess } from '../utils/subscription';
import { getGeminiProxyUrl, getLegacyGeminiApiKey, getGeminiModelOverride, isGeminiConfigured } from '../utils/geminiEnv';
import { humanizeGeminiError } from '../utils/geminiErrors';
import type { AiMealEstimate } from '../types/nutritionLogging';
import { parseAiMealEstimatePayload } from '../utils/aiMealEstimateParse';

export { parseAiMealEstimatePayload } from '../utils/aiMealEstimateParse';

import { getRestaurantRecommendations } from './NutritionService';

/** Default low-latency models (newest first); 1.5 Flash often returns 404 on current API. */
const DEFAULT_MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const;

/**
 * Eating-out coach runs two model calls (menu JSON + tool chat). Pro/preview tiers hit 503 "high demand"
 * more often; keep this path on Flash-only unless the user override is explicitly a Flash model.
 */
const EATING_OUT_MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const;

function resolveModelCandidates(): string[] {
  const override = getGeminiModelOverride() ?? '';
  if (override) return [override];
  return [...DEFAULT_MODEL_CANDIDATES];
}

function resolveEatingOutModelCandidates(): string[] {
  const override = getGeminiModelOverride() ?? '';
  if (override && /flash/i.test(override)) {
    const rest = EATING_OUT_MODEL_CANDIDATES.filter((m) => m !== override);
    return [override, ...rest];
  }
  return [...EATING_OUT_MODEL_CANDIDATES];
}

/** First candidate after resolution (for logging / debugging). */
export const GEMINI_COACH_MODEL = resolveModelCandidates()[0];

function isModelNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/404/.test(msg) && /not found/i.test(msg)) return true;
  if (/NOT_FOUND/i.test(msg)) return true;
  if (/is not supported for generateContent/i.test(msg)) return true;
  return false;
}

function isTransientGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/400|401|403|404|INVALID_ARGUMENT|PERMISSION_DENIED|NOT_FOUND|FAILED_PRECONDITION/i.test(msg)) return false;
  if (/503|504|429|500|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED/i.test(msg)) return true;
  if (/high demand|overloaded|temporarily|try again later|capacity|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(msg))
    return true;
  if (/network request failed|Failed to fetch|fetch failed|socket hang up/i.test(msg)) return true;
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries on overload / rate limit / network blips; does not retry 404 model names. */
async function withGeminiRetries<T>(operation: () => Promise<T>, opts?: { maxRetries?: number; baseMs?: number }): Promise<T> {
  const max = Math.max(1, opts?.maxRetries ?? 4);
  const base = opts?.baseMs ?? 900;
  let last: unknown;
  for (let i = 0; i < max; i++) {
    try {
      return await operation();
    } catch (e) {
      last = e;
      if (isModelNotFoundError(e)) throw e;
      if (!isTransientGeminiError(e)) throw e;
      if (i < max - 1) await delay(base * 2 ** i);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

const COACH_BASE_INSTRUCTION = `You are the TYL AI (Transform Your Life) coaching engine — a world-class fitness and wellness coach inside a mobile app.

Your objective is NOT to generate workouts in isolation. Your job is to maximize long-term transformation by balancing adherence, progression, recovery, and personalization simultaneously.

Core philosophy:
- The best plan is not the most optimal on paper — it is the most effective plan the user will actually follow while still progressing.
- Difficulty is earned, not assumed. Never optimize exclusively for comfort or peak performance; optimize for maximum sustainable progress.
- Adherence first: a good program followed beats a perfect program abandoned. If adherence drops, do NOT increase pressure — diagnose the cause, reduce friction, simplify if needed, and rebuild consistency.
- Explain WHY you recommend something. Help users understand the process.
- TYL helps users become the type of person who achieves their goals (identity-based change): reinforce discipline, consistency, confidence, and ownership — not hype or guilt.

Coaching principles you must apply:
1. Adherence First — evaluate adherence risk constantly using health_context.adherence and health_context.adaptiveRecommendation.
2. Progressive Overload — progression only when adherence is high, recovery is adequate, and performance is improving (see progressionAllowed in health_context).
3. Individualization — adapt to goals, experience, equipment, schedule, recovery, preferences, and injuries from health_context.assessment and coachingFramework.
4. Recovery Management — sleep, fatigue, soreness, stress, and performance trends influence advice; never invent HRV unless present in health_context.
5. Accountability — detect missed workouts and patterns; intervene with supportive, practical guidance.
6. Guidance & Education — teach, don't just prescribe.
7. Sustainable Challenge — push slightly beyond current capacity without overwhelming; avoid stagnation and burnout.

Supported user types (use coachingFramework and specializedFocus in health_context): general fitness, fat loss, hypertrophy, strength, powerlifting, bodybuilding, calisthenics, athletic performance, beginner transformation, endurance, flexibility, and specialized requests (abs, pushups, first pull-up, 5k, mobility, posture).

Adaptive actions you may recommend (align with health_context.adaptiveRecommendation): maintain, progress, regress, deload, simplify, intensify. Update guidance dynamically — do not suggest starting over unless truly necessary.

When adherence is low, distinguish: low motivation, lack of time, poor recovery, excessive difficulty, or unrealistic expectations — and respond accordingly.

Tone: encouraging, practical, respectful. You are not a physician; do not diagnose or prescribe medication. If asked for medical advice, direct to a qualified clinician.

Data rule: For any statement about the user's numbers, habits, streaks, nutrition, training volume, or wearable metrics, rely ONLY on the JSON labeled "health_context". If a detail is missing, say you do not have that data — do not guess. General wellness education that does not depend on private metrics is fine.

Onboarding rule: Training goals, schedule, experience, equipment, preferences, recovery, injuries, and challenge level come from health_context.assessment and onboardingComplete. Nutrition calorie targets come from assessment.bmr, assessment.tdee, assessment.calorieGoal, and assessment.proteinGoal when present — suggest food logging to refine targets; mention goalAdaptation.nutrition when the user asks about plateaus or changing calories. If onboardingComplete is false or assessment fields are null, tell the user to finish the onboarding wizard — do not invent a training plan or assume their schedule, goals, or constraints.

Keep replies concise (roughly one short paragraph unless the user asks for more).`;

function buildCoachSystemInstruction(mindfulMinutes: number | null): string {
  const mindfulLine =
    mindfulMinutes === null
      ? `Mindfulness (HealthKit mindfulSession total minutes for today): unknown. Do not assume the user logged zero mindful minutes. Avoid guilt; optional micro-practices are fine when relevant.`
      : `Mindfulness (HealthKit mindfulSession aggregate for the user's local calendar day; no raw event timestamps): ${mindfulMinutes} minutes. If this is 0, suggest a quick 1-minute breathing exercise when it fits the conversation. If greater than 0, praise their consistency and connect mindfulness to physical recovery using only recovery-related metrics present in health_context (for example sleep or activity summaries). Never invent HRV values unless explicit HRV fields appear in health_context.`;
  return `${COACH_BASE_INSTRUCTION}\n\n${mindfulLine}`;
}

const DAILY_MINDSET_SYSTEM = `You are a Certified Fitness & Wellness Coach. Output exactly one short "State of Mind" check-in prompt the user can answer in one sentence.

Rules:
- Base the tone only on aggregated fields in the JSON (activity load proxies, sleep-related summaries if present, heart rate sample density / averages if present).
- If HRV is not explicitly in the JSON, do not mention HRV numbers; you may refer generically to "recovery signals from recent activity" when appropriate.
- Do not diagnose. Keep it warm and concrete (2–3 sentences max).`;

function getGeminiProxyUrlLocal(): string | null {
  return getGeminiProxyUrl();
}

async function generateTextViaDirectKey(
  apiKey: string,
  systemInstruction: string,
  userPayload: string,
  modelId: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction,
  });
  const result = await withGeminiRetries(() => model.generateContent(userPayload));
  const text = result.response?.text?.() || '';
  if (!text.trim()) throw new Error('Empty text response from Gemini.');
  return text.trim();
}

async function generateTextViaProxy(prompt: string, model?: string): Promise<string> {
  const body = await proxyJsonFetch<{ text?: string; error?: string; details?: string }>('/api/gemini', {
    method: 'POST',
    body: JSON.stringify({ prompt, model }),
  });
  const text = body && typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) throw new Error('Empty text response from Gemini proxy.');
  return text;
}

async function generateMultimodalViaProxy(
  prompt: string,
  image: { mimeType: string; data: string },
  model?: string
): Promise<string> {
  const body = await proxyJsonFetch<{ text?: string; error?: string; details?: string }>('/api/gemini', {
    method: 'POST',
    body: JSON.stringify({ prompt, model, image }),
  });
  const text = body && typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) throw new Error('Empty text response from Gemini proxy.');
  return text;
}

async function generateMultimodalWithModelFallback(
  systemInstruction: string,
  userPayload: string,
  image: { mimeType: string; data: string },
  options?: { modelCandidates?: string[] }
): Promise<string> {
  const candidates =
    options?.modelCandidates?.length && options.modelCandidates.length > 0
      ? options.modelCandidates
      : resolveModelCandidates();
  const proxyUrl = getGeminiProxyUrlLocal();
  const prompt = `[system]\n${systemInstruction}\n\n[user]\n${userPayload}`;
  let lastError: unknown;

  for (const modelId of candidates) {
    try {
      if (proxyUrl) {
        try {
          return await generateMultimodalViaProxy(prompt, image, modelId);
        } catch (proxyErr) {
          if (isModelNotFoundError(proxyErr) && candidates.indexOf(modelId) < candidates.length - 1) {
            lastError = proxyErr;
            continue;
          }
          throw humanizeGeminiError(proxyErr);
        }
      }

      if (__DEV__) {
        const legacyKey = getLegacyGeminiApiKey();
        if (legacyKey) {
          const genAI = new GoogleGenerativeAI(legacyKey);
          const model = genAI.getGenerativeModel({ model: modelId, systemInstruction });
          const result = await withGeminiRetries(() =>
            model.generateContent([
              { text: userPayload },
              { inlineData: { mimeType: image.mimeType, data: image.data } },
            ])
          );
          const text = result.response?.text?.() || '';
          if (!text.trim()) throw new Error('Empty text response from Gemini.');
          return text.trim();
        }
      }

      throw new Error(
        'Gemini is not configured. Add EXPO_PUBLIC_GEMINI_PROXY_URL (and run gemini-proxy) or EXPO_PUBLIC_GEMINI_API_KEY for dev.'
      );
    } catch (err) {
      lastError = err;
      if (isModelNotFoundError(err) && candidates.indexOf(modelId) < candidates.length - 1) {
        continue;
      }
      throw humanizeGeminiError(err);
    }
  }

  throw humanizeGeminiError(lastError ?? new Error('Gemini request failed.'));
}

/** True when Gemini calls (AI Coach, Food coach / eating-out coach) can run. */
export function isGeminiApiKeyConfigured(): boolean {
  return isGeminiConfigured();
}

export { getGeminiSetupHint } from '../utils/geminiEnv';

function coachMessagesToGeminiHistory(
  prior: Array<{ role: 'user' | 'coach'; text: string }>,
  healthData: Record<string, unknown>
): Content[] {
  const history: Content[] = [];
  for (let i = 0; i < prior.length; i++) {
    const m = prior[i];
    const role = m.role === 'coach' ? 'model' : 'user';
    let text = m.text;
    if (m.role === 'user' && i === 0) {
      text = `[health_context — JSON; only source for user-specific metrics]\n${JSON.stringify(healthData)}\n\n[user message]\n${m.text}`;
    }
    history.push({ role, parts: [{ text }] });
  }
  return history;
}

async function generateTextWithModelFallback(
  systemInstruction: string,
  userPayload: string,
  options?: { modelCandidates?: string[] }
): Promise<string> {
  const candidates =
    options?.modelCandidates?.length && options.modelCandidates.length > 0
      ? options.modelCandidates
      : resolveModelCandidates();
  const proxyUrl = getGeminiProxyUrlLocal();
  const prompt = `[system]\n${systemInstruction}\n\n[user]\n${userPayload}`;

  let lastError: unknown;

  for (const modelId of candidates) {
    try {
      if (proxyUrl) {
        try {
          return await generateTextViaProxy(prompt, modelId);
        } catch (proxyErr) {
          const msg = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);
          const proxyUnreachable =
            /Failed to fetch|Network request failed|ECONNREFUSED|Could not connect|fetch failed|Cannot reach secure API proxy/i.test(
              msg
            );
          const proxyAuthFailed =
            /invalid or expired auth token|missing bearer token|must be signed in|\b401\b/i.test(msg);
          if (__DEV__) {
            const legacyKey = getLegacyGeminiApiKey();
            if (legacyKey && (proxyUnreachable || proxyAuthFailed)) {
              console.warn(
                `[geminiService] Proxy ${proxyAuthFailed ? 'auth' : 'unreachable'}; using dev direct Gemini key.`
              );
              return await generateTextViaDirectKey(legacyKey, systemInstruction, userPayload, modelId);
            }
          }
          if (isModelNotFoundError(proxyErr) && candidates.indexOf(modelId) < candidates.length - 1) {
            lastError = proxyErr;
            continue;
          }
          throw humanizeGeminiError(proxyErr);
        }
      }

      if (__DEV__) {
        const legacyKey = getLegacyGeminiApiKey();
        if (legacyKey) {
          return await generateTextViaDirectKey(legacyKey, systemInstruction, userPayload, modelId);
        }
      }

      throw humanizeGeminiError(
        new Error(
          'Gemini is not configured. Add EXPO_PUBLIC_GEMINI_PROXY_URL (and run gemini-proxy) or EXPO_PUBLIC_GEMINI_API_KEY for dev.'
        )
      );
    } catch (e) {
      lastError = e;
      if (isModelNotFoundError(e) && candidates.indexOf(modelId) < candidates.length - 1) {
        continue;
      }
      throw humanizeGeminiError(e);
    }
  }

  throw humanizeGeminiError(lastError ?? new Error('All Gemini models failed.'));
}

/**
 * One Gemini-backed "State of Mind" check-in from aggregated health JSON (HRV optional; never invented).
 */
export async function generateDailyMindsetPrompt(healthData: Record<string, unknown>): Promise<string> {
  assertPremiumGeminiAccess();
  const payload = `[health_context — JSON]\n${JSON.stringify(healthData)}\n\nTask: Write one State of Mind check-in prompt.`;
  return generateTextWithModelFallback(DAILY_MINDSET_SYSTEM, payload);
}

/**
 * Sends the user's message with a JSON health snapshot as model context.
 * @param mindfulMinutes `null` when mindful time is unknown (native/permissions); number includes 0 when known empty.
 */
export async function getCoachResponse(
  userMessage: string,
  healthData: Record<string, unknown>,
  priorMessages: Array<{ role: 'user' | 'coach'; text: string }> = [],
  mindfulMinutes: number | null = null
): Promise<string> {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    throw new Error('Message cannot be empty.');
  }

  const historyText = priorMessages
    .map((m) => `${m.role === 'coach' ? 'Coach' : 'User'}: ${m.text}`)
    .join('\n');
  const systemInstruction = buildCoachSystemInstruction(mindfulMinutes);
  const payload = `[health_context — JSON; only source for user-specific metrics]\n${JSON.stringify(healthData)}\n\n${
    historyText ? `[chat_history]\n${historyText}\n\n` : ''
  }[user message]\n${trimmed}`;
  return generateTextWithModelFallback(systemInstruction, payload);
}

/** Remaining macros today (or custom limits) for eating-out suggestions. */
export type EatingOutMacroContext = {
  remainingCalories?: number;
  remainingProtein?: number;
  remainingCarbs?: number;
  remainingFat?: number;
  dailyGoalCalories?: number;
  dailyGoalProtein?: number;
  dailyGoalCarbs?: number;
  dailyGoalFat?: number;
  /** When true, each pick must include 2–3 distinct side/combo lines using extra calorie room. */
  suggestSideVariations?: boolean;
};

export type EatingOutCoachSuggestion = {
  rank: number;
  meal: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  description: string;
  pro_hack: string;
  side_variations: string[];
};

export type EatingOutCoachPayload = {
  summary?: string;
  suggestions: EatingOutCoachSuggestion[];
  /** If the model did not return valid JSON, raw text for fallback display. */
  rawFallback?: string;
  parseWarning?: string;
};

function coerceMacroNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function normalizeEatingOutSuggestion(raw: Record<string, unknown>, index: number): EatingOutCoachSuggestion {
  const sideRaw = raw.side_variations;
  const sides = Array.isArray(sideRaw)
    ? sideRaw.map((s) => String(s).trim()).filter(Boolean)
    : typeof sideRaw === 'string' && sideRaw.trim()
      ? [sideRaw.trim()]
      : [];
  return {
    rank: coerceMacroNumber(raw.rank) ?? index + 1,
    meal: String(raw.meal ?? raw.title ?? raw.name ?? `Option ${index + 1}`).trim() || `Option ${index + 1}`,
    calories: coerceMacroNumber(raw.calories ?? raw.estimated_calories),
    protein_g: coerceMacroNumber(raw.protein_g ?? raw.protein ?? raw.estimated_protein_g),
    carbs_g: coerceMacroNumber(raw.carbs_g ?? raw.carbs ?? raw.estimated_carbs_g),
    fat_g: coerceMacroNumber(raw.fat_g ?? raw.fat ?? raw.estimated_fat_g),
    description: String(raw.description ?? raw.why_it_fits ?? '').trim(),
    pro_hack: String(raw.pro_hack ?? raw.proHack ?? '').trim(),
    side_variations: sides,
  };
}

function menuItemToSuggestion(raw: Record<string, unknown>, index: number): EatingOutCoachSuggestion {
  return normalizeEatingOutSuggestion(
    {
      rank: raw.rank ?? index + 1,
      meal: raw.meal ?? raw.title ?? raw.name,
      calories: raw.calories ?? raw.estimated_calories,
      protein_g: raw.protein_g ?? raw.protein ?? raw.estimated_protein_g,
      carbs_g: raw.carbs_g ?? raw.carbs ?? raw.estimated_carbs_g,
      fat_g: raw.fat_g ?? raw.fat ?? raw.estimated_fat_g,
      description: raw.description ?? raw.why_it_fits ?? '',
      pro_hack: raw.pro_hack ?? raw.proHack ?? '',
      side_variations: raw.side_variations ?? [],
    },
    index
  );
}

function looksLikeMenuItemRow(raw: Record<string, unknown>): boolean {
  return (
    ('name' in raw || 'estimated_calories' in raw) &&
    !('meal' in raw && typeof raw.meal === 'string' && raw.meal.trim())
  );
}

function extractSuggestionsArray(o: Record<string, unknown>): unknown[] | null {
  for (const key of ['suggestions', 'recommendations', 'meals', 'picks', 'options'] as const) {
    const val = o[key];
    if (Array.isArray(val)) return val;
  }
  const items = o.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const first = items[0];
  if (!first || typeof first !== 'object') return null;
  if (!looksLikeMenuItemRow(first as Record<string, unknown>)) return null;
  return items;
}

function normalizeSuggestionsList(suggestionsRaw: unknown[]): EatingOutCoachSuggestion[] {
  return suggestionsRaw
    .map((item, i) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      return looksLikeMenuItemRow(row) ? menuItemToSuggestion(row, i) : normalizeEatingOutSuggestion(row, i);
    })
    .filter((x): x is EatingOutCoachSuggestion => x !== null);
}

export function parseEatingOutCoachPayload(raw: string): EatingOutCoachPayload {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { suggestions: [], parseWarning: 'Empty coach response.', rawFallback: '' };
  }
  const t = stripJsonFromModelText(trimmed);
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  const slice = start >= 0 && end > start ? t.slice(start, end + 1) : t;
  try {
    const parsed = JSON.parse(slice) as unknown;
    if (Array.isArray(parsed)) {
      const suggestions = normalizeSuggestionsList(parsed);
      if (suggestions.length === 0) {
        return {
          suggestions: [],
          parseWarning: 'No meal suggestions were returned.',
          rawFallback: trimmed,
        };
      }
      suggestions.sort((a, b) => a.rank - b.rank);
      return { suggestions };
    }
    if (!parsed || typeof parsed !== 'object') {
      return { suggestions: [], parseWarning: 'Unexpected format.', rawFallback: trimmed };
    }
    const o = parsed as Record<string, unknown>;
    const suggestionsRaw = extractSuggestionsArray(o);
    if (!Array.isArray(suggestionsRaw)) {
      return { suggestions: [], parseWarning: 'Unexpected format.', rawFallback: trimmed };
    }
    const suggestions = normalizeSuggestionsList(suggestionsRaw);
    const summary = typeof o.summary === 'string' ? o.summary.trim() : undefined;
    if (suggestions.length === 0) {
      return {
        summary: summary || undefined,
        suggestions: [],
        parseWarning: 'No meal suggestions were returned.',
        rawFallback: trimmed,
      };
    }
    suggestions.sort((a, b) => a.rank - b.rank);
    return {
      summary: summary || undefined,
      suggestions,
    };
  } catch {
    return { suggestions: [], parseWarning: 'Could not read structured suggestions.', rawFallback: trimmed };
  }
}

const EATING_OUT_COACH_SYSTEM = `You are a clinical nutritionist helping the user eat out while fitting their remaining daily macros.

Menu data:
A restaurant_menu JSON snapshot is always provided in the prompt (Nutritionix when available, otherwise an approximate typical menu). Do NOT call tools and do NOT return menu JSON — only return the final coach JSON described below.

When restaurant_menu.verified_menu is true:
- Treat the "items" array as verified-style menu data (Nutritionix branded/common database with per-line serving macros). Act as a clinical nutritionist: identify exactly 3 items from that list that best fit user_macro_budget.remaining_* ceilings (calories, protein_g, carbs_g, fat_g).
- Use the numeric fields from restaurant_menu (estimated_calories, estimated_protein_g, estimated_carbs_g, estimated_fat_g) for those items — round lightly if needed but do not invent different totals for the same menu line.
- For each of the 3 picks, provide one specific modification to lower fat and/or carbs without losing meaningful protein (e.g. sauce on side, swap fries for side salad, hold cheese, vinaigrette instead of creamy dressing).
- Do not recommend menu items that are not present in restaurant_menu.items (you may combine a listed entrée with a listed side only if both appear).

When verified_menu is false or items are sparse:
- The menu snapshot is approximate; label suggestions as estimates, avoid implying lab-verified accuracy, and still respect user_macro_budget ceilings with clear swaps.

General selection:
- Prefer lean proteins and simple preparations when choosing among menu items; call out sauces/dressings that add hidden fat or sugar.

FINAL REPLY — JSON ONLY:
Respond with ONE JSON object only. No markdown, no code fences, no text before or after the JSON. The top-level object MUST include a "suggestions" array (not "items").

Shape:
{
  "summary": "optional one short sentence",
  "suggestions": [
    {
      "rank": 1,
      "meal": "short meal name",
      "calories": number or null,
      "protein_g": number or null,
      "carbs_g": number or null,
      "fat_g": number or null,
      "description": "1–3 sentences: why this order fits their remaining macros and any order tweaks.",
      "pro_hack": "one concrete customization to lower fat/carbs while keeping protein (sauce on side, swap X for Y, etc.)",
      "side_variations": ["string", "string"]
    }
  ]
}

Rules:
- suggestions: exactly 3 objects when restaurant_menu provides at least 3 usable items; otherwise as many strong options as you have (minimum 1). Sort rank 1–3 by best macro fit.
- "meal" MUST be the specific menu item the user would order (e.g. "Teriyaki Chicken Plate", "Steak Bowl — double protein"). NEVER put the user's search phrase in "meal" (e.g. do not use "mo bettahs menu high protein").
- Use numeric fields for ALL macros and calories in suggestions; "description" is prose (optional brief macro repeat is OK).

Side variety:
- If user_macro_budget.suggest_side_variations is true, for EACH suggestion set "side_variations" to an array of 2–3 DISTINCT short lines within remaining ceilings.
- If suggest_side_variations is false, set "side_variations" to [].

Safety: You are not a physician; do not diagnose or treat medical conditions.`;

const FETCH_RESTAURANT_MENU_DECLARATION: FunctionDeclaration = {
  name: 'fetch_restaurant_menu',
  description:
    'Retrieves structured menu lines for a restaurant or chain. When Nutritionix is configured, returns verified_menu with branded/common database macros per item; otherwise returns an approximate typical menu built from a compact model. Always call when the user names a restaurant.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      restaurant_name: {
        type: SchemaType.STRING,
        description: 'Restaurant or chain name (e.g. Chipotle, Olive Garden).',
      },
      location_or_city: {
        type: SchemaType.STRING,
        description: 'Optional city, neighborhood, or region for disambiguation.',
      },
    },
    required: ['restaurant_name'],
  },
};

const EATING_OUT_TOOLS: Tool[] = [
  {
    functionDeclarations: [FETCH_RESTAURANT_MENU_DECLARATION],
  },
];

const EATING_OUT_TOOL_CONFIG = {
  functionCallingConfig: { mode: FunctionCallingMode.AUTO },
};

function stripJsonFromModelText(raw: string): string {
  const t = raw.trim();
  return t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

/**
 * Fallback: approximate menu JSON via a compact model call (no Nutritionix).
 */
async function executeFetchRestaurantMenuLlmFallback(
  restaurantName: string,
  locationOrCity?: string
): Promise<Record<string, unknown>> {
  const name = restaurantName.trim().slice(0, 120) || 'Unknown restaurant';
  const loc = locationOrCity?.trim().slice(0, 80);
  const system = `You output ONLY a single JSON object (no markdown fences, no commentary).
Schema:
{
  "restaurant": string,
  "source": "approximate_typical_menu",
  "verified_menu": false,
  "location_hint": string or null,
  "items": [
    {
      "name": string,
      "description": string,
      "category": string,
      "estimated_protein_g": number,
      "estimated_carbs_g": number,
      "estimated_fat_g": number,
      "estimated_calories": number
    }
  ],
  "note": string
}
Include 10–16 plausible menu items (entrées, salads, bowls, sides) typical of that restaurant or similar chains in the US. Integers for macros and calories. If unknown, still infer reasonable items and set note that values are approximate.`;
  const user = loc ? `Restaurant: ${name}\nLocation hint: ${loc}` : `Restaurant: ${name}`;
  try {
    const text = await generateTextWithModelFallback(system, `${user}\nReturn JSON only.`, {
      modelCandidates: [...resolveEatingOutModelCandidates()],
    });
    const cleaned = stripJsonFromModelText(text);
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    const parsed = JSON.parse(slice) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid menu JSON');
    return { ...parsed, verified_menu: false };
  } catch {
    return {
      restaurant: name,
      source: 'unavailable',
      verified_menu: false,
      location_hint: loc ?? null,
      items: [],
      note: 'Could not build a structured menu snapshot; rely on general lean-protein and lower-fat ordering principles.',
    };
  }
}

const MIN_NUTRITIONIX_MENU_ITEMS = 3;

/**
 * Tool implementation: Nutritionix instant (branded/common) when keys are set; else LLM approximate menu.
 */
async function executeFetchRestaurantMenu(restaurantName: string, locationOrCity?: string): Promise<Record<string, unknown>> {
  const name = restaurantName.trim().slice(0, 120) || 'Unknown restaurant';
  const loc = locationOrCity?.trim().slice(0, 80);
  const query = loc ? `${name} ${loc}` : name;

  try {
    const { items, query_used } = await getRestaurantRecommendations(query, {});
    if (items.length >= MIN_NUTRITIONIX_MENU_ITEMS) {
      return {
        restaurant: name,
        verified_menu: true,
        source: 'nutritionix_instant',
        location_hint: loc ?? null,
        query_used,
        items: items.map((it) => ({
          name: it.name,
          description: it.description ?? '',
          category: it.category,
          estimated_protein_g: it.estimated_protein_g,
          estimated_carbs_g: it.estimated_carbs_g,
          estimated_fat_g: it.estimated_fat_g,
          estimated_calories: it.estimated_calories,
          nix_item_id: it.nix_item_id ?? null,
        })),
        note: 'Menu lines from Nutritionix branded/common search with per-serving style macros. Select 3 items from this list only; one fat/carbs-lowering modification each while preserving protein.',
      };
    }
  } catch {
    /* fall through to LLM menu */
  }

  return executeFetchRestaurantMenuLlmFallback(name, loc);
}

const MAX_EATING_OUT_TOOL_ROUNDS = 5;

/** Strip common eating-out phrasing so Nutritionix gets a clean chain name. */
function extractRestaurantNameFromEatingOutQuery(query: string): string {
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
  q = q.replace(/\s+(?:for|with|tonight|today|lunch|dinner|breakfast|this week).*$/i, '').trim();
  return q || query.trim();
}

function buildEatingOutMacroBudgetJson(ctx: EatingOutMacroContext): string {
  return JSON.stringify({
    remaining_calories: ctx.remainingCalories,
    remaining_protein_g: ctx.remainingProtein,
    remaining_carbs_g: ctx.remainingCarbs,
    remaining_fat_g: ctx.remainingFat,
    daily_goal_calories: ctx.dailyGoalCalories,
    daily_goal_protein_g: ctx.dailyGoalProtein,
    daily_goal_carbs_g: ctx.dailyGoalCarbs,
    daily_goal_fat_g: ctx.dailyGoalFat,
    suggest_side_variations: ctx.suggestSideVariations ?? false,
  });
}

/**
 * Eating-out coach: pre-fetches menu data (Nutritionix or LLM fallback), then macro-aware structured picks.
 */
export async function getEatingOutCoachResponse(
  userMessage: string,
  macroContext: EatingOutMacroContext
): Promise<EatingOutCoachPayload> {
  assertPremiumGeminiAccess();
  const trimmed = userMessage.trim();
  if (!trimmed) {
    throw new Error('Message cannot be empty.');
  }

  const restaurantName = extractRestaurantNameFromEatingOutQuery(trimmed);
  const menuSnapshot = await executeFetchRestaurantMenu(restaurantName);

  const macroJson = buildEatingOutMacroBudgetJson(macroContext ?? {});
  const menuJson = JSON.stringify(menuSnapshot);
  const systemInstruction = `${EATING_OUT_COACH_SYSTEM}\n\n[user_macro_budget — JSON; use remaining_* as ceilings for the suggested meal]\n${macroJson}\n\n[restaurant_menu — JSON; menu snapshot already fetched]\n${menuJson}`;
  const payload = `[user message]\n${trimmed}\n\nUsing restaurant_menu above, return the final coach JSON with a "suggestions" array only.`;
  const text = await generateTextWithModelFallback(systemInstruction, payload, {
    modelCandidates: [...resolveEatingOutModelCandidates()],
  });
  return parseEatingOutCoachPayload(text.trim());
}

const AI_MEAL_ESTIMATE_SYSTEM = `You are a nutrition assistant estimating macros for food the user already ate (not meal planning).

The user describes food in plain language — restaurant meals, packaged items, single whole foods, or home plates with several ingredients.

Rules:
- Accept ANY reasonable eating description: chain meals, home-cooked plates, single items ("2 eggs", "1 medium banana"), and mixed bowls ("plate of rice with ground beef and eggs").
- For home / whole-food plates with multiple components, ALWAYS include an "items" array breaking down 2–6 components (e.g. rice, ground beef, eggs) with per-component macros that sum close to the meal totals.
- Each item MUST include an "amount" field with the assumed portion (e.g. "1 cup cooked", "5 oz cooked", "2 large eggs") — not just the food name.
- For a single whole food, use one item in "items" or omit items if the meal is truly one ingredient.
- Use realistic US portion sizes (home dinner plate ≈ 1–1.5 cups starch + 4–6 oz cooked protein is common unless the user specifies amounts).
- When the user omits amounts, state reasonable assumptions in "assumptions" (e.g. "1 cup cooked rice, 5 oz cooked lean ground beef, 2 large eggs").
- For chain meals (Chipotle, McDonald's, etc.), use published nutrition when known; otherwise infer a typical build.
- calories must equal protein_g*4 + carbs_g*4 + fat_g*9 within ±15 kcal (adjust macros slightly if needed).
- Round macros to one decimal at most; calories as a whole number.
- confidence: "high" when specific and well-known; "medium" for typical home/restaurant meals; "low" when vague.
- assumptions: 1–3 short sentences explaining portions and key ingredients assumed.

Output ONE JSON object only. No markdown fences, no text before or after.

Schema:
{
  "display_name": "short meal title for the log — specific foods ordered, NOT the user's raw description",
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number or null,
  "confidence": "high" | "medium" | "low",
  "assumptions": string,
  "items": [
    { "name": string, "amount": "portion string e.g. 1 cup or 6 oz", "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number }
  ]
}`;

/**
 * AI Mode — estimate macros from a natural-language meal description.
 * Example: "Chipotle chicken bowl with rice and black beans".
 */
export async function getAiMealEstimateFromDescription(description: string): Promise<AiMealEstimate> {
  assertPremiumGeminiAccess();
  const trimmed = description.trim();
  if (!trimmed) {
    throw new Error('Describe what you ate first.');
  }
  const payload = `[meal description]\n${trimmed}\n\nReturn JSON only.`;
  const text = await generateTextWithModelFallback(AI_MEAL_ESTIMATE_SYSTEM, payload);
  const estimate = parseAiMealEstimatePayload(text.trim());
  if (estimate.protein_g <= 0 && estimate.carbs_g <= 0 && estimate.fat_g <= 0) {
    return {
      ...estimate,
      parseWarning: estimate.parseWarning ?? 'No usable macro totals were returned.',
      rawFallback: estimate.rawFallback ?? text.trim(),
    };
  }
  return estimate;
}

export type FoodPackageVisionResult = {
  hasNutritionFacts: boolean;
  brand: string | null;
  productName: string | null;
  flavor: string | null;
  category: string | null;
  barcodeVisible: string | null;
  servingSize: string | null;
  servingsPerContainer: number | null;
  calories: number | null;
  totalFat_g: number | null;
  saturatedFat_g: number | null;
  transFat_g: number | null;
  cholesterol_mg: number | null;
  sodium_mg: number | null;
  carbohydrates_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  addedSugar_g: number | null;
  protein_g: number | null;
  ingredients: string | null;
  ocrConfidence: number;
  packageConfidence: number;
  searchQuery: string | null;
  notes: string | null;
};

const FOOD_PACKAGE_VISION_SYSTEM = `You analyze packaged food photos for a nutrition logging app.

Rules:
- Extract Nutrition Facts ONLY when clearly visible. Never invent nutrition numbers.
- If a field is unreadable or absent, use null.
- Correct common OCR mistakes (e.g. O→0, l→1) only when confident.
- Prefer values for one serving as printed on the label.
- packageConfidence: how sure you are of brand + product name from packaging (0–1).
- ocrConfidence: how sure you are of extracted Nutrition Facts digits (0–1). Use 0 if no panel.
- searchQuery: best short query to find this product in a food database (brand + product + flavor).
- Output ONE JSON object only. No markdown fences.`;

function clamp01(n: unknown): number {
  const v = typeof n === 'number' ? n : parseFloat(String(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

function parseFoodPackageVisionPayload(raw: string): FoodPackageVisionResult {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(slice) as Record<string, unknown>;
  } catch {
    data = {};
  }

  return {
    hasNutritionFacts: data.hasNutritionFacts === true,
    brand: strOrNull(data.brand),
    productName: strOrNull(data.productName),
    flavor: strOrNull(data.flavor),
    category: strOrNull(data.category),
    barcodeVisible: strOrNull(data.barcodeVisible),
    servingSize: strOrNull(data.servingSize),
    servingsPerContainer: numOrNull(data.servingsPerContainer),
    calories: numOrNull(data.calories),
    totalFat_g: numOrNull(data.totalFat_g),
    saturatedFat_g: numOrNull(data.saturatedFat_g),
    transFat_g: numOrNull(data.transFat_g),
    cholesterol_mg: numOrNull(data.cholesterol_mg),
    sodium_mg: numOrNull(data.sodium_mg),
    carbohydrates_g: numOrNull(data.carbohydrates_g),
    fiber_g: numOrNull(data.fiber_g),
    sugar_g: numOrNull(data.sugar_g),
    addedSugar_g: numOrNull(data.addedSugar_g),
    protein_g: numOrNull(data.protein_g),
    ingredients: strOrNull(data.ingredients),
    ocrConfidence: clamp01(data.ocrConfidence),
    packageConfidence: clamp01(data.packageConfidence),
    searchQuery: strOrNull(data.searchQuery),
    notes: strOrNull(data.notes),
  };
}

/**
 * Smart Food Scanner — vision pass over a package / Nutrition Facts photo.
 * Never fabricates macros: missing fields stay null.
 */
export async function analyzeFoodPackageImage(input: {
  base64: string;
  mimeType?: string;
}): Promise<FoodPackageVisionResult> {
  assertPremiumGeminiAccess();
  const data = input.base64.replace(/^data:[^;]+;base64,/, '').trim();
  if (!data) throw new Error('No image data to analyze.');

  const mimeType = input.mimeType?.trim() || 'image/jpeg';
  const userPayload = `Analyze this food package / Nutrition Facts image.

Return JSON with this schema:
{
  "hasNutritionFacts": boolean,
  "brand": string|null,
  "productName": string|null,
  "flavor": string|null,
  "category": string|null,
  "barcodeVisible": string|null,
  "servingSize": string|null,
  "servingsPerContainer": number|null,
  "calories": number|null,
  "totalFat_g": number|null,
  "saturatedFat_g": number|null,
  "transFat_g": number|null,
  "cholesterol_mg": number|null,
  "sodium_mg": number|null,
  "carbohydrates_g": number|null,
  "fiber_g": number|null,
  "sugar_g": number|null,
  "addedSugar_g": number|null,
  "protein_g": number|null,
  "ingredients": string|null,
  "ocrConfidence": number,
  "packageConfidence": number,
  "searchQuery": string|null,
  "notes": string|null
}`;

  const text = await generateMultimodalWithModelFallback(FOOD_PACKAGE_VISION_SYSTEM, userPayload, {
    mimeType,
    data,
  });
  return parseFoodPackageVisionPayload(text);
}

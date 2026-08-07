import 'dotenv/config';
console.log('[gemini-proxy] booting…');
import express from 'express';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const PORT = Number(process.env.PORT || 8080);
const GEMINI_KEY = String(process.env.GEMINI_KEY || '').trim();
const DEFAULT_MODEL = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
const FIREBASE_PROJECT_ID = String(process.env.FIREBASE_PROJECT_ID || '').trim();
const NUTRITIONIX_APP_ID = String(process.env.NUTRITIONIX_APP_ID || '').trim();
const NUTRITIONIX_API_KEY = String(process.env.NUTRITIONIX_API_KEY || '').trim();
const USDA_FDC_API_KEY = String(process.env.USDA_FDC_API_KEY || 'DEMO_KEY').trim();
const USING_DEMO_USDA_KEY = !process.env.USDA_FDC_API_KEY || USDA_FDC_API_KEY === 'DEMO_KEY';
const FATSECRET_CLIENT_ID = String(process.env.FATSECRET_CLIENT_ID || '').trim();
const FATSECRET_CLIENT_SECRET = String(process.env.FATSECRET_CLIENT_SECRET || '').trim();
/** OAuth2 scope: "basic" (default) or "premier" / "premier barcode" etc. */
const FATSECRET_SCOPE = String(process.env.FATSECRET_SCOPE || 'basic').trim() || 'basic';
const FATSECRET_CONFIGURED = Boolean(FATSECRET_CLIENT_ID && FATSECRET_CLIENT_SECRET);

/** @type {{ accessToken: string, expiresAtMs: number, scope: string } | null} */
let fatSecretTokenCache = null;

if (!GEMINI_KEY) {
  console.error('[gemini-proxy] Missing GEMINI_KEY in environment.');
  process.exit(1);
}
if (!FIREBASE_PROJECT_ID) {
  console.error('[gemini-proxy] Missing FIREBASE_PROJECT_ID in environment.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json({ limit: '4mb' }));

let jwks = null;
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
    );
  }
  return jwks;
}

async function verifyFirebaseIdToken(idToken) {
  const { payload } = await jwtVerify(idToken, getJwks(), {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  return payload;
}

async function requireAuth(req, res, next) {
  try {
    const authz = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
    if (!authz.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing bearer token.' });
    }
    const idToken = authz.slice('Bearer '.length).trim();
    if (!idToken) return res.status(401).json({ error: 'Missing bearer token.' });
    const payload = await verifyFirebaseIdToken(idToken);
    req.user = { uid: String(payload.sub || ''), email: typeof payload.email === 'string' ? payload.email : undefined };
    if (!req.user.uid) return res.status(401).json({ error: 'Invalid token subject.' });
    return next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(401).json({ error: 'Invalid or expired auth token.', details: message });
  }
}

async function proxyJson(url, init = {}) {
  const resp = await fetch(url, init);
  let body = null;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }
  if (!resp.ok) {
    const details =
      (body && typeof body.message === 'string' && body.message) ||
      (body && typeof body.error === 'string' && body.error) ||
      `HTTP ${resp.status}`;
    const err = new Error(details);
    err.statusCode = resp.status;
    throw err;
  }
  return body ?? {};
}

const geminiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Try again in a few minutes.',
  },
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'gemini-proxy' });
});

app.post('/api/gemini', requireAuth, geminiLimiter, async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const model = typeof req.body?.model === 'string' && req.body.model.trim() ? req.body.model.trim() : DEFAULT_MODEL;
    const image = req.body?.image;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing required field: prompt (string).' });
    }

    const modelClient = genAI.getGenerativeModel({ model });

    /** Optional multimodal payload: { mimeType, data } where data is base64 (no data: prefix). */
    let content;
    if (
      image &&
      typeof image === 'object' &&
      typeof image.data === 'string' &&
      image.data.trim() &&
      typeof image.mimeType === 'string' &&
      image.mimeType.trim()
    ) {
      const mimeType = String(image.mimeType).trim();
      const data = String(image.data).replace(/^data:[^;]+;base64,/, '').trim();
      if (!data) {
        return res.status(400).json({ error: 'image.data must be non-empty base64.' });
      }
      content = [
        { text: prompt },
        { inlineData: { mimeType, data } },
      ];
    } else {
      content = prompt;
    }

    const result = await modelClient.generateContent(content);
    const text = result.response?.text?.() || '';

    return res.json({ text, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (/PERMISSION_DENIED|403/i.test(message)) {
      return res.status(403).json({
        error: 'Gemini access denied. Check project API enablement, key restrictions, and billing.',
        details: message,
      });
    }

    if (/429|RESOURCE_EXHAUSTED/i.test(message)) {
      return res.status(429).json({ error: 'Gemini quota/rate limit reached.', details: message });
    }

    return res.status(500).json({ error: 'Gemini proxy request failed.', details: message });
  }
});

const WORKOUT_SPREADSHEET_SYSTEM = `You are a strength-training coach OCR engine.
Extract workout programs from photos of:
- Printed or digital spreadsheets / tables
- Whiteboards and gym boards
- Typed or printed workout plans
- Handwritten pen-and-paper logs, notebooks, journals, and scrap notes

Handwriting rules:
- Carefully read cursive and print handwriting, including messy gym-log shorthand.
- Expand common abbreviations when confident (e.g. BP→Bench Press, OHP→Overhead Press, SQ→Squat, DL→Deadlift, RDL→Romanian Deadlift, DB→Dumbbell, BB→Barbell, PU→Pull-up, BR→Bent Over Row, Lat PD→Lat Pulldown).
- If a handwritten name is ambiguous, keep the closest readable spelling; do not invent a different exercise.
- Crossed-out lines are ignored unless clearly replaced by a correction above/beside them.
- Dates, bodyweight, mood, or personal notes go in notes fields — not as exercises.
- Sets×reps shorthand like "3x10", "3x8-12", "4×5" maps to sets + reps.
- Load shorthand like "135", "135x5", "BW", "bodyweight" maps to weight when numeric; use null for bodyweight.
- RPE/RIR written as "@8", "RPE 8", "2 RIR" maps to rpe/rir.

General rules:
- Return ONLY valid JSON (no markdown). Never invent exercises that are not visible.
- If a cell/line is blank or unreadable, use null for that field.
- Prefer common English exercise names.
- Convert rest like "90s" or "1:30" to restSeconds as an integer (seconds).
- Rep ranges stay as strings (e.g. "8-12"). Single reps as a string number (e.g. "10").`;

const WORKOUT_SPREADSHEET_SCHEMA_HINT = `{
  "name": string,
  "notes": string|null,
  "days": [
    {
      "name": string,
      "exercises": [
        {
          "name": string,
          "sets": number|null,
          "reps": string|null,
          "weight": number|null,
          "restSeconds": number|null,
          "rpe": number|null,
          "rir": number|null,
          "notes": string|null
        }
      ]
    }
  ]
}`;

function extractJsonObject(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Vision parse: workout spreadsheet / program photo → structured routine JSON.
 * Auth: Firebase JWT (same as /api/gemini).
 */
app.post('/api/workouts/parse-spreadsheet', requireAuth, geminiLimiter, async (req, res) => {
  try {
    const image = req.body?.image;
    if (
      !image ||
      typeof image !== 'object' ||
      typeof image.data !== 'string' ||
      !image.data.trim() ||
      typeof image.mimeType !== 'string' ||
      !image.mimeType.trim()
    ) {
      return res.status(400).json({
        error: 'Missing image payload. Expected { image: { mimeType, data } } with base64 data.',
      });
    }

    const mimeType = String(image.mimeType).trim();
    const data = String(image.data).replace(/^data:[^;]+;base64,/, '').trim();
    if (!data) {
      return res.status(400).json({ error: 'image.data must be non-empty base64.' });
    }
    // ~3MB base64 ceiling after client compression
    if (data.length > 4_000_000) {
      return res.status(413).json({ error: 'Image too large. Compress and try again.' });
    }

    const model =
      typeof req.body?.model === 'string' && req.body.model.trim()
        ? req.body.model.trim()
        : DEFAULT_MODEL;

    const prompt = `[system]\n${WORKOUT_SPREADSHEET_SYSTEM}\n\n[user]\nExtract the workout program from this image (printed spreadsheet, whiteboard, OR handwritten pen-and-paper log).
Return JSON matching this schema exactly:
${WORKOUT_SPREADSHEET_SCHEMA_HINT}

Group rows into days/sessions when the page has multiple days, dated entries, or titled blocks.
If there is only one untitled list, use a single day named "Workout 1".
For multi-page style notes in one photo, include every readable session in days[].`;

    const modelClient = genAI.getGenerativeModel({
      model,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const result = await modelClient.generateContent([
      { text: prompt },
      { inlineData: { mimeType, data } },
    ]);
    const text = result.response?.text?.() || '';
    const routine = extractJsonObject(text);
    if (!routine || typeof routine !== 'object') {
      return res.status(502).json({
        error: 'Vision model returned unparseable JSON.',
        details: text.slice(0, 500),
      });
    }

    return res.json({ routine, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/PERMISSION_DENIED|403/i.test(message)) {
      return res.status(403).json({
        error: 'Gemini access denied. Check project API enablement, key restrictions, and billing.',
        details: message,
      });
    }
    if (/429|RESOURCE_EXHAUSTED/i.test(message)) {
      return res.status(429).json({ error: 'Gemini quota/rate limit reached.', details: message });
    }
    return res.status(500).json({
      error: 'Workout spreadsheet parse failed.',
      details: message,
    });
  }
});

app.get('/api/nutritionix/barcode', requireAuth, async (req, res) => {
  try {
    if (!NUTRITIONIX_APP_ID || !NUTRITIONIX_API_KEY) {
      return res.json({ foods: [] });
    }
    const upc = typeof req.query?.upc === 'string' ? req.query.upc.replace(/\D/g, '').trim() : '';
    if (!upc) return res.status(400).json({ error: 'Missing query param: upc' });
    const url = `https://trackapi.nutritionix.com/v2/search/item?upc=${encodeURIComponent(upc)}`;
    const data = await proxyJson(url, {
      headers: {
        'x-app-id': NUTRITIONIX_APP_ID,
        'x-app-key': NUTRITIONIX_API_KEY,
        Accept: 'application/json',
      },
    });
    return res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(502).json({ error: 'Nutritionix barcode proxy failed.', details: message });
  }
});

app.get('/api/nutritionix/instant', requireAuth, async (req, res) => {
  try {
    if (!NUTRITIONIX_APP_ID || !NUTRITIONIX_API_KEY) {
      return res.json({ common: [], branded: [] });
    }
    const query = typeof req.query?.query === 'string' ? req.query.query.trim() : '';
    if (!query) return res.status(400).json({ error: 'Missing query param: query' });
    const params = new URLSearchParams();
    params.set('query', query);
    params.set('detailed', String(req.query?.detailed ?? 'true'));
    params.set('branded', String(req.query?.branded ?? 'true'));
    params.set('common', String(req.query?.common ?? 'false'));
    const url = `https://trackapi.nutritionix.com/v2/search/instant?${params.toString()}`;
    const data = await proxyJson(url, {
      headers: {
        'x-app-id': NUTRITIONIX_APP_ID,
        'x-app-key': NUTRITIONIX_API_KEY,
        Accept: 'application/json',
      },
    });
    return res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(502).json({ error: 'Nutritionix instant proxy failed.', details: message });
  }
});

app.post('/api/usda/foods/search', requireAuth, async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(USDA_FDC_API_KEY)}`;
    const data = await proxyJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = error && typeof error.statusCode === 'number' ? error.statusCode : 502;
    if (statusCode === 429 || /429|rate limit/i.test(message)) {
      return res.status(429).json({
        error: 'USDA FoodData Central rate limit reached.',
        details: USING_DEMO_USDA_KEY
          ? 'Proxy is using DEMO_KEY. Add USDA_FDC_API_KEY to gemini-proxy/.env (free at fdc.nal.usda.gov/api-key-signup.html).'
          : message,
      });
    }
    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 502).json({
      error: 'USDA foods/search proxy failed.',
      details: message,
    });
  }
});

app.get('/api/usda/food/:fdcId', requireAuth, async (req, res) => {
  try {
    const fdcId = String(req.params.fdcId || '').trim();
    if (!/^\d+$/.test(fdcId)) return res.status(400).json({ error: 'Invalid fdcId.' });
    const url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${encodeURIComponent(USDA_FDC_API_KEY)}`;
    const data = await proxyJson(url, {
      headers: { Accept: 'application/json' },
    });
    return res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = error && typeof error.statusCode === 'number' ? error.statusCode : 502;
    if (statusCode === 429 || /429|rate limit/i.test(message)) {
      return res.status(429).json({
        error: 'USDA FoodData Central rate limit reached.',
        details: USING_DEMO_USDA_KEY
          ? 'Proxy is using DEMO_KEY. Add USDA_FDC_API_KEY to gemini-proxy/.env.'
          : message,
      });
    }
    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 502).json({
      error: 'USDA food detail proxy failed.',
      details: message,
    });
  }
});

async function getFatSecretAccessToken() {
  if (!FATSECRET_CONFIGURED) {
    const err = new Error('FatSecret credentials not configured on proxy.');
    err.statusCode = 503;
    throw err;
  }
  const now = Date.now();
  if (
    fatSecretTokenCache &&
    fatSecretTokenCache.scope === FATSECRET_SCOPE &&
    fatSecretTokenCache.expiresAtMs > now + 60_000
  ) {
    return fatSecretTokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: FATSECRET_SCOPE,
  });
  const basic = Buffer.from(`${FATSECRET_CLIENT_ID}:${FATSECRET_CLIENT_SECRET}`).toString('base64');
  const resp = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  let json = null;
  try {
    json = await resp.json();
  } catch {
    json = null;
  }
  if (!resp.ok || !json?.access_token) {
    const details =
      (json && typeof json.error_description === 'string' && json.error_description) ||
      (json && typeof json.error === 'string' && json.error) ||
      `HTTP ${resp.status}`;
    const err = new Error(details);
    err.statusCode = resp.status >= 400 && resp.status < 600 ? resp.status : 502;
    throw err;
  }
  const expiresInSec = Number(json.expires_in);
  const ttlMs = Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec * 1000 : 3600_000;
  fatSecretTokenCache = {
    accessToken: String(json.access_token),
    expiresAtMs: now + ttlMs,
    scope: FATSECRET_SCOPE,
  };
  return fatSecretTokenCache.accessToken;
}

async function fatSecretGet(pathWithQuery) {
  const token = await getFatSecretAccessToken();
  const url = pathWithQuery.startsWith('http')
    ? pathWithQuery
    : `https://platform.fatsecret.com/rest/${pathWithQuery.replace(/^\//, '')}`;
  const data = await proxyJson(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  // FatSecret often returns HTTP 200 with { error: { code, message } }.
  if (data && typeof data === 'object' && data.error) {
    const errObj = data.error;
    const code = errObj && typeof errObj === 'object' ? errObj.code : undefined;
    const message =
      (errObj && typeof errObj === 'object' && typeof errObj.message === 'string' && errObj.message) ||
      (typeof errObj === 'string' ? errObj : 'FatSecret API error');
    const err = new Error(code != null ? `FatSecret error ${code}: ${message}` : message);
    err.statusCode = code === 21 ? 403 : 502;
    throw err;
  }
  return data;
}

app.get('/api/fatsecret/status', requireAuth, (_req, res) => {
  res.json({
    configured: FATSECRET_CONFIGURED,
    scope: FATSECRET_SCOPE,
  });
});

/**
 * Primary food search (FatSecret). Basic scope uses search/v1; premier prefers search/v2 then falls back to v1.
 * Query: ?q=...&max_results=20&page_number=0
 */
app.get('/api/fatsecret/foods/search', requireAuth, async (req, res) => {
  try {
    if (!FATSECRET_CONFIGURED) {
      return res.status(503).json({
        error: 'FatSecret not configured.',
        details: 'Add FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET to the proxy environment.',
      });
    }
    const q = String(req.query?.q ?? req.query?.search_expression ?? '').trim();
    if (!q) return res.status(400).json({ error: 'Missing query parameter: q' });
    const maxResultsRaw = parseInt(String(req.query?.max_results ?? '20'), 10);
    const maxResults = Number.isFinite(maxResultsRaw)
      ? Math.min(50, Math.max(1, maxResultsRaw))
      : 20;
    const pageRaw = parseInt(String(req.query?.page_number ?? '0'), 10);
    const pageNumber = Number.isFinite(pageRaw) && pageRaw >= 0 ? pageRaw : 0;

    const params = new URLSearchParams({
      search_expression: q,
      max_results: String(maxResults),
      page_number: String(pageNumber),
      format: 'json',
    });

    const preferV2 = /\bpremier\b/i.test(FATSECRET_SCOPE);
    let data = null;
    let version = 'v1';
    if (preferV2) {
      try {
        data = await fatSecretGet(`foods/search/v2?${params.toString()}`);
        version = 'v2';
      } catch (v2Err) {
        console.warn(
          '[gemini-proxy] FatSecret search/v2 failed, falling back to v1:',
          v2Err instanceof Error ? v2Err.message : String(v2Err)
        );
      }
    }
    if (!data) {
      data = await fatSecretGet(`foods/search/v1?${params.toString()}`);
      version = 'v1';
    }
    return res.json({ ...data, _tyl: { version, scope: FATSECRET_SCOPE } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = error && typeof error.statusCode === 'number' ? error.statusCode : 502;
    if (statusCode === 401 || statusCode === 403) {
      fatSecretTokenCache = null;
    }
    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 502).json({
      error: 'FatSecret foods/search proxy failed.',
      details: message,
    });
  }
});

app.get('/api/fatsecret/food/:foodId', requireAuth, async (req, res) => {
  try {
    if (!FATSECRET_CONFIGURED) {
      return res.status(503).json({
        error: 'FatSecret not configured.',
        details: 'Add FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET to the proxy environment.',
      });
    }
    const foodId = String(req.params.foodId || '').trim();
    if (!/^\d+$/.test(foodId)) return res.status(400).json({ error: 'Invalid foodId.' });
    const params = new URLSearchParams({ food_id: foodId, format: 'json' });
    const data = await fatSecretGet(`food/v2?${params.toString()}`);
    return res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = error && typeof error.statusCode === 'number' ? error.statusCode : 502;
    if (statusCode === 401 || statusCode === 403) {
      fatSecretTokenCache = null;
    }
    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 502).json({
      error: 'FatSecret food detail proxy failed.',
      details: message,
    });
  }
});

function localLanIp() {
  try {
    const os = require('os');
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net && net.family === 'IPv4' && !net.internal) return net.address;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

app.listen(PORT, '0.0.0.0', () => {
  const lan = localLanIp();
  console.log(`[gemini-proxy] Listening on http://localhost:${PORT}`);
  if (lan) console.log(`[gemini-proxy] LAN (physical device): http://${lan}:${PORT}`);
  if (USING_DEMO_USDA_KEY) {
    console.warn('[gemini-proxy] USDA_FDC_API_KEY not set — using DEMO_KEY (low rate limits).');
  }
  if (!FATSECRET_CONFIGURED) {
    console.warn(
      '[gemini-proxy] FatSecret not configured — set FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET (food search falls back to USDA).'
    );
  } else {
    console.log(`[gemini-proxy] FatSecret configured (scope=${FATSECRET_SCOPE}).`);
  }
});

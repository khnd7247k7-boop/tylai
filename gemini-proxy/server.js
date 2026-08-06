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
});

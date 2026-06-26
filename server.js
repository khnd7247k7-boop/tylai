import 'dotenv/config';
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

app.use(express.json({ limit: '256kb' }));

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

    if (!prompt) {
      return res.status(400).json({ error: 'Missing required field: prompt (string).' });
    }

    const modelClient = genAI.getGenerativeModel({ model });
    const result = await modelClient.generateContent(prompt);
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
    return res.status(502).json({ error: 'USDA foods/search proxy failed.', details: message });
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
    return res.status(502).json({ error: 'USDA food detail proxy failed.', details: message });
  }
});

app.listen(PORT, () => {
  console.log(`[gemini-proxy] Listening on http://localhost:${PORT}`);
});

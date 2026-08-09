import type { User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getGeminiProxyUrl } from '../utils/geminiEnv';

const AUTH_WAIT_MS = 8000;

export function getProxyBaseUrl(): string | null {
  return getGeminiProxyUrl();
}

function isAuthErrorMessage(msg: string): boolean {
  return /invalid or expired auth token|missing bearer token|must be signed in|\b401\b/i.test(msg);
}

/** Wait briefly for Firebase Auth to finish restoring the session after app launch. */
async function waitForAuthUser(timeoutMs = AUTH_WAIT_MS): Promise<User> {
  const immediate = auth?.currentUser ?? null;
  if (immediate) return immediate;

  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      unsubscribe();
      reject(new Error('You must be signed in to use secure AI and nutrition services.'));
    }, timeoutMs);

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        clearTimeout(deadline);
        unsubscribe();
        resolve(user);
      }
    });
  });
}

async function getBearerToken(forceRefresh = false): Promise<string> {
  const user = await waitForAuthUser();
  if (typeof user.getIdToken !== 'function') {
    throw new Error('You must be signed in to use secure AI and nutrition services.');
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // After a cold-start network blip, force a refresh on retries.
      return await user.getIdToken(forceRefresh || attempt > 0);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const code =
        err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
      const isNetwork =
        code === 'auth/network-request-failed' || /network-request-failed|network error/i.test(msg);
      if (!isNetwork || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function parseProxyResponse<T>(resp: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }
  if (!resp.ok) {
    const errMsg =
      (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : null) || `HTTP ${resp.status}`;
    const details =
      body && typeof body === 'object' && 'details' in body && typeof (body as { details: unknown }).details === 'string'
        ? (body as { details: string }).details
        : '';
    const combined = details && !errMsg.includes(details) ? `${errMsg}: ${details}` : errMsg;
    throw new Error(combined);
  }
  return body as T;
}

export async function proxyJsonFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getProxyBaseUrl();
  if (!base) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_PROXY_URL. Run `npm run gemini-proxy:sync` and restart Metro.');
  }

  const doFetch = async (forceRefresh: boolean) => {
    const token = await getBearerToken(forceRefresh);
    const headers = new Headers(init.headers ?? {});
    headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type') && init.body != null) {
      headers.set('Content-Type', 'application/json');
    }
    let resp: Response;
    try {
      resp = await fetch(`${base}${path}`, { ...init, headers });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Cannot reach secure API proxy at ${base}. Start it with \`npm run gemini-proxy\`. ` +
          `On a physical device, run \`npm run gemini-proxy:sync\` so the URL uses your Mac LAN IP. (${msg})`
      );
    }
    return parseProxyResponse<T>(resp);
  };

  try {
    return await doFetch(false);
  } catch (firstErr) {
    const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    if (isAuthErrorMessage(msg)) {
      return doFetch(true);
    }
    throw firstErr;
  }
}

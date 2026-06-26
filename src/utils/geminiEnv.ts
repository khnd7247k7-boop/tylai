import Constants from 'expo-constants';

function fromExtra(key: string): string {
  const extra = (Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? null) as
    | Record<string, unknown>
    | null;
  const val = extra?.[key];
  return typeof val === 'string' ? val.trim() : '';
}

/** Static reads so Metro/Expo can inline EXPO_PUBLIC_* at build time. */
export function getGeminiProxyUrl(): string | null {
  const raw = (
    process.env.EXPO_PUBLIC_GEMINI_PROXY_URL ??
    fromExtra('EXPO_PUBLIC_GEMINI_PROXY_URL') ??
    ''
  ).trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

/** Legacy dev-only key (bundled in app — avoid in production). */
export function getLegacyGeminiApiKey(): string | null {
  const key = (
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ??
    fromExtra('EXPO_PUBLIC_GEMINI_API_KEY') ??
    ''
  ).trim();
  return key || null;
}

export function getGeminiModelOverride(): string | null {
  const model = (
    process.env.EXPO_PUBLIC_GEMINI_MODEL ??
    fromExtra('EXPO_PUBLIC_GEMINI_MODEL') ??
    ''
  ).trim();
  return model || null;
}

export type GeminiConfigMode = 'proxy' | 'dev_direct' | 'missing';

export function getGeminiConfigMode(): GeminiConfigMode {
  if (getGeminiProxyUrl()) return 'proxy';
  if (getLegacyGeminiApiKey()) return 'dev_direct';
  return 'missing';
}

export function isGeminiConfigured(): boolean {
  return getGeminiConfigMode() !== 'missing';
}

export function getGeminiSetupHint(): string {
  const mode = getGeminiConfigMode();
  if (mode === 'proxy') {
    const url = getGeminiProxyUrl();
    return (
      `Gemini + USDA search use the secure proxy at ${url}. ` +
      'Run `npm run gemini-proxy` on your Mac, stay signed in, and restart Metro with `npx expo start --clear`. ' +
      'On a physical iPhone, the proxy URL must be your Mac LAN IP (sync script sets this automatically).'
    );
  }
  if (mode === 'dev_direct') {
    return 'Using EXPO_PUBLIC_GEMINI_API_KEY in development. For production, use the gemini-proxy server.';
  }
  return (
    'Run `npm run gemini-proxy:sync` then `npm run gemini-proxy`, add keys to .env.local, ' +
    'and restart Metro with `npx expo start --clear`. Or set EXPO_PUBLIC_GEMINI_API_KEY for dev-only.'
  );
}

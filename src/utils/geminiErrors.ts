/** Turn raw Gemini / proxy errors into actionable user-facing messages. */
export function humanizeGeminiError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    /prepayment credits are depleted|resource_exhausted|exceeded your current quota|quota exceeded|rate limit reached/i.test(
      raw
    ) ||
    /\b429\b/.test(raw)
  ) {
    return new Error(
      'Gemini API credits or quota are used up. Open Google AI Studio (https://aistudio.google.com) → your project → Billing, add credits or enable billing, then try again.'
    );
  }

  if (/permission_denied|\b403\b|access denied/i.test(raw)) {
    return new Error(
      'Gemini API access denied. Check that your API key is valid, Generative Language API is enabled, and key restrictions allow this app.'
    );
  }

  if (/invalid or expired auth token|missing bearer token|\b401\b/i.test(raw)) {
    return new Error('Sign in again to use AI features. The secure proxy requires a valid Firebase session.');
  }

  if (/cannot reach secure api proxy|econnrefused|failed to fetch|network request failed/i.test(lower)) {
    return new Error(
      'Cannot reach the API proxy. Run `npm run gemini-proxy` on your Mac. On a physical device, run `npm run gemini-proxy:sync` so the URL uses your Mac LAN IP, then restart Expo.'
    );
  }

  if (/not found for api version|not supported for generatecontent|\b404\b.*model/i.test(lower)) {
    return new Error(`Gemini model unavailable (${raw}). Set EXPO_PUBLIC_GEMINI_MODEL to a supported Flash model.`);
  }

  if (/high demand|overloaded|503|unavailable/i.test(lower)) {
    return new Error('Gemini is temporarily overloaded. Wait a moment and try again.');
  }

  return err instanceof Error ? err : new Error(raw);
}

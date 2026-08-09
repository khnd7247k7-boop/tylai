/**
 * Optional Gemini rewrite — verified facts only, never invent stats.
 */
import type { CoachingTone, NotificationCandidate } from './types';

const TONE_LABEL: Record<CoachingTone, string> = {
  coach_me: 'Coach Me — proactive, supportive, motivational but not guilt-based',
  work_with_me: 'Work With Me — collaborative, invite the user to decide',
  analyze_me: 'Analyze Me — analytical, factual, avoid motivational fluff',
};

export async function maybeRewriteWithGemini(
  candidate: NotificationCandidate,
  tone: CoachingTone,
  opts: { apiKey: string; force: boolean }
): Promise<{ title: string; message: string; usedAi: boolean }> {
  const should =
    opts.force ||
    candidate.combined === true ||
    candidate.verifiedFacts.length >= 3;

  if (!should || !opts.apiKey) {
    return { title: candidate.title, message: candidate.message, usedAi: false };
  }

  const prompt = `You are TYL, a fitness coach writing one push notification.
Tone: ${TONE_LABEL[tone]}

STRICT RULES:
- Use ONLY the verified facts below. Do not invent numbers, medical claims, or unverified conclusions.
- Keep title ≤ 40 characters and body ≤ 160 characters.
- One notification only. Supportive, never guilt-based ("failed", "broke your streak").
- If an action is implied, keep it optional ("Want…?").

Verified facts:
${candidate.verifiedFacts.map((f) => `- ${f}`).join('\n')}

Draft title: ${candidate.title}
Draft body: ${candidate.message}

Respond with JSON only: {"title":"...","message":"..."}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 256 },
      }),
    });
    if (!res.ok) {
      console.warn('[gemini] rewrite failed', res.status);
      return { title: candidate.title, message: candidate.message, usedAi: false };
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return { title: candidate.title, message: candidate.message, usedAi: false };
    }
    const parsed = JSON.parse(match[0]) as { title?: string; message?: string };
    const title = String(parsed.title || candidate.title).trim().slice(0, 60);
    const message = String(parsed.message || candidate.message).trim().slice(0, 200);
    if (!title || !message) {
      return { title: candidate.title, message: candidate.message, usedAi: false };
    }
    return { title, message, usedAi: true };
  } catch (e) {
    console.warn('[gemini] rewrite error', e);
    return { title: candidate.title, message: candidate.message, usedAi: false };
  }
}

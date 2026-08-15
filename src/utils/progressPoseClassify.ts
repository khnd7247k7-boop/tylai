/**
 * Assign front / side / back for progress photos using Gemini vision when available,
 * with timestamp-order fallback.
 */
import type { PhotoPose } from '../types/progressPhotos';
import { PHOTO_POSES } from '../types/progressPhotos';
import { isGeminiConfigured } from '../utils/geminiEnv';
import { compressImageForVision } from './compressImageForVision';
import type { LibraryPhotoItem } from './progressPhotoImportGroups';
import { assignPosesForDay } from './progressPhotoImportGroups';

export type PoseAssignmentSource = 'vision' | 'timestamp';

export type PoseAssignmentResult = {
  poses: Partial<Record<PhotoPose, LibraryPhotoItem>>;
  source: PoseAssignmentSource;
};

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function parsePoseIndexMap(
  raw: Record<string, unknown> | null,
  photoCount: number
): Partial<Record<PhotoPose, number>> | null {
  if (!raw || photoCount <= 0) return null;
  const assignments =
    raw.assignments && typeof raw.assignments === 'object'
      ? (raw.assignments as Record<string, unknown>)
      : raw;
  const out: Partial<Record<PhotoPose, number>> = {};
  for (const pose of PHOTO_POSES) {
    const v = assignments[pose];
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
    if (!Number.isFinite(n) || n < 0 || n >= photoCount) continue;
    out[pose] = Math.trunc(n);
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Build unique pose→photo mapping from model indices; fill gaps from unused photos in time order.
 * Never reuses the same photo into a blank pose — missing poses stay empty.
 */
export function applyPoseIndexMap(
  photos: LibraryPhotoItem[],
  indexMap: Partial<Record<PhotoPose, number>> | null
): Partial<Record<PhotoPose, LibraryPhotoItem>> {
  const ordered = [...photos].sort((a, b) =>
    a.resolved.timestampIso.localeCompare(b.resolved.timestampIso)
  );
  if (!ordered.length) return {};

  const used = new Set<number>();
  const poses: Partial<Record<PhotoPose, LibraryPhotoItem>> = {};

  if (indexMap) {
    for (const pose of PHOTO_POSES) {
      const idx = indexMap[pose];
      if (idx == null || used.has(idx) || !ordered[idx]) continue;
      poses[pose] = ordered[idx];
      used.add(idx);
    }
  }

  for (const pose of PHOTO_POSES) {
    if (poses[pose]) continue;
    const nextIdx = ordered.findIndex((_, i) => !used.has(i));
    if (nextIdx < 0) break;
    poses[pose] = ordered[nextIdx];
    used.add(nextIdx);
  }
  return poses;
}

async function classifyDayPosesViaGemini(
  photos: LibraryPhotoItem[]
): Promise<Partial<Record<PhotoPose, number>> | null> {
  if (!isGeminiConfigured() || photos.length === 0) return null;

  const ordered = [...photos].sort((a, b) =>
    a.resolved.timestampIso.localeCompare(b.resolved.timestampIso)
  );
  // Cap how many we send — three is ideal; extras help if the first picks are wrong.
  const slice = ordered.slice(0, Math.min(5, ordered.length));

  const images: Array<{ mimeType: string; data: string }> = [];
  for (const photo of slice) {
    try {
      const compressed = await compressImageForVision(photo.uri, {
        maxWidth: 768,
        quality: 0.72,
      });
      images.push({ mimeType: compressed.mimeType, data: compressed.base64 });
    } catch (e) {
      console.warn('[progressPoseClassify] compress failed', e);
    }
  }
  if (!images.length) return null;

  const { classifyProgressPhotoPoses } = await import('../services/geminiService');
  const text = await classifyProgressPhotoPoses(images);
  return parsePoseIndexMap(extractJsonObject(text), slice.length);
}

/**
 * Prefer Gemini front/side/back classification; fall back to capture-time order.
 */
export async function assignPosesForDaySmart(
  photos: LibraryPhotoItem[]
): Promise<PoseAssignmentResult> {
  if (photos.length === 0) {
    return { poses: {}, source: 'timestamp' };
  }
  if (photos.length === 1) {
    return { poses: assignPosesForDay(photos), source: 'timestamp' };
  }

  try {
    const indexMap = await classifyDayPosesViaGemini(photos);
    if (indexMap && PHOTO_POSES.some((p) => indexMap[p] != null)) {
      return {
        poses: applyPoseIndexMap(photos, indexMap),
        source: 'vision',
      };
    }
  } catch (e) {
    console.warn('[progressPoseClassify] vision failed; using timestamp order', e);
  }

  return { poses: assignPosesForDay(photos), source: 'timestamp' };
}

/**
 * Re-group library items into day drafts using vision when possible.
 */
export async function groupPhotosIntoDayDraftsSmart(
  items: LibraryPhotoItem[]
): Promise<{ drafts: import('./progressPhotoImportGroups').DaySessionDraft[]; usedVision: boolean }> {
  const byDay = new Map<string, LibraryPhotoItem[]>();
  for (const item of items) {
    const key = item.resolved.dateKey;
    const list = byDay.get(key) ?? [];
    list.push(item);
    byDay.set(key, list);
  }

  let usedVision = false;
  const drafts: import('./progressPhotoImportGroups').DaySessionDraft[] = [];
  for (const [dateKey, dayPhotos] of byDay.entries()) {
    const ordered = [...dayPhotos].sort((a, b) =>
      a.resolved.timestampIso.localeCompare(b.resolved.timestampIso)
    );
    const assigned = await assignPosesForDaySmart(ordered);
    if (assigned.source === 'vision') usedVision = true;
    drafts.push({
      dateKey,
      timestampIso: ordered[0]?.resolved.timestampIso ?? new Date().toISOString(),
      poses: assigned.poses,
      photos: ordered,
    });
  }

  drafts.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return { drafts, usedVision };
}

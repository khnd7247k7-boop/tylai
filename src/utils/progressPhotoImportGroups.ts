/**
 * Group camera-roll progress photos into timeline sessions by capture date.
 * Up to 3 poses per day (front → side → back by timestamp order).
 */
import {
  PHOTO_POSES,
  type PhotoPose,
} from '../types/progressPhotos';
import type { ResolvedPhotoCaptureTime } from './progressPhotoCaptureDate';

export type LibraryPhotoItem = {
  uri: string;
  resolved: ResolvedPhotoCaptureTime;
};

export type DaySessionDraft = {
  dateKey: string;
  /** Earliest capture timestamp for that day (session stamp). */
  timestampIso: string;
  poses: Partial<Record<PhotoPose, LibraryPhotoItem>>;
  /** All photos that landed on this day (may be >3). */
  photos: LibraryPhotoItem[];
};

/**
 * Assign front/side/back from time-ordered photos for one day.
 * Extra photos beyond 3 are ignored for poses (still listed on the draft).
 * Missing poses stay empty — never reuse a photo into a blank slot.
 */
export function assignPosesForDay(photos: LibraryPhotoItem[]): Partial<Record<PhotoPose, LibraryPhotoItem>> {
  const ordered = [...photos].sort((a, b) =>
    a.resolved.timestampIso.localeCompare(b.resolved.timestampIso)
  );
  const poses: Partial<Record<PhotoPose, LibraryPhotoItem>> = {};
  if (ordered.length === 1) {
    poses.front = ordered[0];
    return poses;
  }
  if (ordered.length === 2) {
    // Two-shot days are almost always front + back (side skipped).
    poses.front = ordered[0];
    poses.back = ordered[1];
    return poses;
  }
  PHOTO_POSES.forEach((pose, i) => {
    if (ordered[i]) poses[pose] = ordered[i];
  });
  return poses;
}

/** Group photos by local capture date and build editable day drafts. */
export function groupPhotosIntoDayDrafts(items: LibraryPhotoItem[]): DaySessionDraft[] {
  const byDay = new Map<string, LibraryPhotoItem[]>();
  for (const item of items) {
    const key = item.resolved.dateKey;
    const list = byDay.get(key) ?? [];
    list.push(item);
    byDay.set(key, list);
  }

  const drafts: DaySessionDraft[] = [];
  for (const [dateKey, photos] of byDay.entries()) {
    const ordered = [...photos].sort((a, b) =>
      a.resolved.timestampIso.localeCompare(b.resolved.timestampIso)
    );
    drafts.push({
      dateKey,
      timestampIso: ordered[0]?.resolved.timestampIso ?? new Date().toISOString(),
      poses: assignPosesForDay(ordered),
      photos: ordered,
    });
  }

  return drafts.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function dayDraftHasAnyPose(draft: DaySessionDraft): boolean {
  return PHOTO_POSES.some((p) => Boolean(draft.poses[p]?.uri));
}

/** @deprecated Prefer dayDraftHasAnyPose — full three-pose days are no longer required. */
export function dayDraftIsComplete(draft: DaySessionDraft): boolean {
  return dayDraftHasAnyPose(draft);
}

export function capturesFromDayDraft(
  draft: DaySessionDraft
): Partial<Record<PhotoPose, string>> | null {
  const captures: Partial<Record<PhotoPose, string>> = {};
  for (const pose of PHOTO_POSES) {
    const uri = draft.poses[pose]?.uri;
    if (uri) captures[pose] = uri;
  }
  return Object.keys(captures).length > 0 ? captures : null;
}

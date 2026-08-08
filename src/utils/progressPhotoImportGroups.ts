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

const MAX_POSES = PHOTO_POSES.length;

/**
 * Assign front/side/back from time-ordered photos for one day.
 * Extra photos beyond 3 are ignored for poses (still listed on the draft).
 * If fewer than 3, missing poses reuse the last available so the session is complete.
 */
export function assignPosesForDay(photos: LibraryPhotoItem[]): Partial<Record<PhotoPose, LibraryPhotoItem>> {
  const ordered = [...photos].sort((a, b) =>
    a.resolved.timestampIso.localeCompare(b.resolved.timestampIso)
  );
  const poses: Partial<Record<PhotoPose, LibraryPhotoItem>> = {};
  PHOTO_POSES.forEach((pose, i) => {
    if (ordered[i]) poses[pose] = ordered[i];
  });
  const last = ordered[Math.min(ordered.length, MAX_POSES) - 1];
  if (last) {
    for (const pose of PHOTO_POSES) {
      if (!poses[pose]) poses[pose] = last;
    }
  }
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

export function dayDraftIsComplete(draft: DaySessionDraft): boolean {
  return PHOTO_POSES.every((p) => Boolean(draft.poses[p]?.uri));
}

export function capturesFromDayDraft(
  draft: DaySessionDraft
): Record<PhotoPose, string> | null {
  if (!dayDraftIsComplete(draft)) return null;
  return {
    front: draft.poses.front!.uri,
    side: draft.poses.side!.uri,
    back: draft.poses.back!.uri,
  };
}

/**
 * Progress photo persistence — session metadata in AsyncStorage, images on disk.
 *
 * Every capture creates (or replaces same-day) a session; older dates are never pruned.
 * Photo paths are stored relative to the app documents folder so they survive iOS
 * container UUID changes across app updates.
 */

import { Directory, File, Paths } from 'expo-file-system';
import { loadUserData, saveUserData } from '../utils/userStorage';
import { notifyUserDataReady } from '../utils/userDataEvents';
import { saveSessionPhotosIfEnabled } from './PhotoCameraRollService';
import type {
  PhotoPose,
  PhotoSession,
  PhotoSessionPhotos,
  ProgressPhotoStats,
  ProgressPhotoButtonState,
} from '../types/progressPhotos';
import { PHOTO_POSES } from '../types/progressPhotos';

const STORAGE_KEY = 'progressPhotoSessions';
const PHOTO_DIR = 'progress-photos';

/** Local calendar YYYY-MM-DD (not UTC). Used for timeline placement. */
export function toProgressPhotoLocalDateKey(d: Date = new Date()): string {
  return localDateKey(d);
}

function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

function mondayOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekKey(dateKey: string): string {
  return localDateKey(mondayOfWeek(parseDateKey(dateKey)));
}

/** Stable relative path written into AsyncStorage (not a full file:// URI). */
function relativePhotoPath(sessionId: string, pose: PhotoPose): string {
  return `${PHOTO_DIR}/${sessionId}/${pose}.jpg`;
}

function photoFile(sessionId: string, pose: PhotoPose): File {
  const dir = new Directory(Paths.document, PHOTO_DIR, sessionId);
  return new File(dir, `${pose}.jpg`);
}

function fileExists(uriOrPath: string): boolean {
  try {
    return new File(uriOrPath).exists;
  } catch {
    return false;
  }
}

/**
 * Resolve a stored path/URI to a loadable file:// URI for Image components.
 * Repairs absolute URIs that broke after an iOS app update (container path change).
 */
export function resolvePhotoUri(
  stored: string | null | undefined,
  sessionId: string,
  pose: PhotoPose
): string {
  const fallback = photoFile(sessionId, pose);
  if (fallback.exists) return fallback.uri;

  if (stored) {
    if (fileExists(stored)) return stored;

    // Absolute path with old container UUID — rebuild from relative suffix.
    const marker = `/${PHOTO_DIR}/`;
    const idx = stored.indexOf(marker);
    if (idx >= 0) {
      const relative = stored.slice(idx + 1); // progress-photos/...
      const parts = relative.split('/');
      if (parts.length >= 3) {
        const sid = parts[1];
        const poseFile = parts[2]?.replace(/\.jpg$/i, '') as PhotoPose;
        if (sid && PHOTO_POSES.includes(poseFile)) {
          const repaired = photoFile(sid, poseFile);
          if (repaired.exists) return repaired.uri;
        }
      }
    }

    // Relative path from storage
    if (stored.startsWith(PHOTO_DIR + '/')) {
      const parts = stored.split('/');
      const sid = parts[1];
      const poseFile = parts[2]?.replace(/\.jpg$/i, '') as PhotoPose;
      if (sid && PHOTO_POSES.includes(poseFile)) {
        const repaired = photoFile(sid, poseFile);
        if (repaired.exists) return repaired.uri;
      }
    }
  }

  // Last resort: return expected URI even if missing (Image will error quietly).
  return fallback.uri;
}

function hydrateSessionPhotos(session: PhotoSession): PhotoSessionPhotos {
  return {
    front: resolvePhotoUri(session.photos?.front, session.id, 'front'),
    side: resolvePhotoUri(session.photos?.side, session.id, 'side'),
    back: resolvePhotoUri(session.photos?.back, session.id, 'back'),
  };
}

function sessionHasAnyPhotoOnDisk(sessionId: string): boolean {
  return PHOTO_POSES.some((pose) => photoFile(sessionId, pose).exists);
}

async function persistPhoto(tempUri: string, sessionId: string, pose: PhotoPose): Promise<string> {
  const dir = new Directory(Paths.document, PHOTO_DIR, sessionId);
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${pose}.jpg`);
  const src = new File(tempUri);
  if (!src.exists) {
    throw new Error(`Captured photo not found: ${tempUri}`);
  }
  if (dest.exists) {
    try {
      dest.delete();
    } catch {
      // overwrite via copy if delete fails
    }
  }
  src.copy(dest);
  // Persist relative path so we can re-resolve after container moves.
  return relativePhotoPath(sessionId, pose);
}

async function deleteSessionFiles(sessionId: string): Promise<void> {
  const dir = new Directory(Paths.document, PHOTO_DIR, sessionId);
  if (dir.exists) {
    dir.delete();
  }
}

/** Discover on-disk session folders that may be missing from AsyncStorage. */
function recoverSessionsFromDisk(known: PhotoSession[]): PhotoSession[] {
  const knownIds = new Set(known.map((s) => s.id));
  const recovered: PhotoSession[] = [];
  try {
    const root = new Directory(Paths.document, PHOTO_DIR);
    if (!root.exists) return recovered;
    const entries = root.list();
    for (const entry of entries) {
      // Prefer directories named ps_*
      const uri = entry.uri ?? '';
      const name = uri.replace(/\/$/, '').split('/').pop() ?? '';
      const isDir =
        typeof (entry as Directory).list === 'function' ||
        (entry as { isDirectory?: boolean }).isDirectory === true ||
        !name.includes('.');
      if (!isDir || !name.startsWith('ps_') || knownIds.has(name)) continue;
      if (!sessionHasAnyPhotoOnDisk(name)) continue;
      const stampMs = Number(name.replace(/^ps_/, ''));
      const captured = Number.isFinite(stampMs) ? new Date(stampMs) : new Date();
      const date = localDateKey(captured);
      recovered.push({
        id: name,
        date,
        timestamp: captured.toISOString(),
        photos: {
          front: relativePhotoPath(name, 'front'),
          side: relativePhotoPath(name, 'side'),
          back: relativePhotoPath(name, 'back'),
        },
      });
    }
  } catch (error) {
    console.warn('[PhotoService] disk recovery failed', error);
  }
  return recovered;
}

function normalizeLoadedSessions(raw: PhotoSession[]): PhotoSession[] {
  const byId = new Map<string, PhotoSession>();
  for (const session of raw) {
    if (!session?.id || !session.date) continue;
    byId.set(session.id, {
      ...session,
      photos: {
        front: session.photos?.front ?? relativePhotoPath(session.id, 'front'),
        side: session.photos?.side ?? relativePhotoPath(session.id, 'side'),
        back: session.photos?.back ?? relativePhotoPath(session.id, 'back'),
      },
    });
  }

  for (const recovered of recoverSessionsFromDisk([...byId.values()])) {
    if (!byId.has(recovered.id)) byId.set(recovered.id, recovered);
  }

  return [...byId.values()]
    .map((session) => ({
      ...session,
      photos: hydrateSessionPhotos(session),
    }))
    .sort((a, b) => parseDateKey(a.date).getTime() - parseDateKey(b.date).getTime());
}

export async function loadPhotoSessions(): Promise<PhotoSession[]> {
  const raw = await loadUserData<PhotoSession[]>(STORAGE_KEY);
  const sessions = normalizeLoadedSessions(raw ?? []);

  // If we recovered sessions from disk that weren't in storage, persist them.
  const rawIds = new Set((raw ?? []).map((s) => s.id));
  const needsPersist = sessions.some((s) => !rawIds.has(s.id));
  if (needsPersist) {
    await saveUserData(
      STORAGE_KEY,
      sessions.map((s) => ({
        ...s,
        photos: {
          front: relativePhotoPath(s.id, 'front'),
          side: relativePhotoPath(s.id, 'side'),
          back: relativePhotoPath(s.id, 'back'),
        },
      }))
    );
  }

  return sessions;
}

async function writeSessions(sessions: PhotoSession[]): Promise<void> {
  // Always persist relative paths (not ephemeral absolute URIs).
  const toStore = sessions.map((s) => ({
    ...s,
    photos: {
      front: relativePhotoPath(s.id, 'front'),
      side: relativePhotoPath(s.id, 'side'),
      back: relativePhotoPath(s.id, 'back'),
    },
  }));
  await saveUserData(STORAGE_KEY, toStore);
  notifyUserDataReady();
}

export async function getSessionForDate(dateKey: string): Promise<PhotoSession | null> {
  const sessions = await loadPhotoSessions();
  return sessions.find((s) => s.date === dateKey) ?? null;
}

/**
 * Save a progress session for a given day (defaults to today).
 * Replaces only that day's session if one exists — all other dates stay stored.
 *
 * Pass `date` / `timestamp` when importing library photos so the session lands on
 * the photo's capture day in the timeline (not "today").
 */
export async function createSessionFromCaptures(
  captures: Record<PhotoPose, string>,
  opts?: { date?: string; timestamp?: string | Date }
): Promise<PhotoSession> {
  const stampDate =
    opts?.timestamp instanceof Date
      ? opts.timestamp
      : typeof opts?.timestamp === 'string'
        ? new Date(opts.timestamp)
        : new Date();
  const safeStamp = Number.isNaN(stampDate.getTime()) ? new Date() : stampDate;
  const date =
    typeof opts?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(opts.date)
      ? opts.date
      : localDateKey(safeStamp);
  const timestamp = safeStamp.toISOString();
  const id = `ps_${Date.now()}`;

  const photosRelative = {
    front: await persistPhoto(captures.front, id, 'front'),
    side: await persistPhoto(captures.side, id, 'side'),
    back: await persistPhoto(captures.back, id, 'back'),
  };

  const session: PhotoSession = {
    id,
    date,
    timestamp,
    photos: photosRelative,
    metadata: opts?.date || opts?.timestamp ? { importedFromLibrary: true } : undefined,
  };

  const existing = await loadUserData<PhotoSession[]>(STORAGE_KEY);
  const prior = Array.isArray(existing) ? existing : [];
  const replacedSameDay = prior.filter((s) => s.date === date);
  for (const old of replacedSameDay) {
    if (old.id !== id) await deleteSessionFiles(old.id);
  }

  const kept = prior.filter((s) => s.date !== date);
  kept.push(session);
  await writeSessions(kept);

  const absoluteUris = {
    front: resolvePhotoUri(photosRelative.front, id, 'front'),
    side: resolvePhotoUri(photosRelative.side, id, 'side'),
    back: resolvePhotoUri(photosRelative.back, id, 'back'),
  };
  await saveSessionPhotosIfEnabled([absoluteUris.front, absoluteUris.side, absoluteUris.back]);

  return {
    ...session,
    photos: absoluteUris,
  };
}

export async function deletePhotoSession(sessionId: string): Promise<void> {
  await deleteSessionFiles(sessionId);
  const sessions = await loadUserData<PhotoSession[]>(STORAGE_KEY);
  const next = (Array.isArray(sessions) ? sessions : []).filter((s) => s.id !== sessionId);
  await writeSessions(next);
}

export function computeWeeklyPhotoStreak(sessions: PhotoSession[]): number {
  if (!sessions.length) return 0;

  const weekSet = new Set(sessions.map((s) => weekKey(s.date)));
  let streak = 0;
  let cursor = mondayOfWeek(new Date());

  while (weekSet.has(localDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }

  return streak;
}

export function computePhotoStats(sessions: PhotoSession[]): ProgressPhotoStats {
  const today = localDateKey();
  const hasSessionToday = sessions.some((s) => s.date === today);
  const sorted = [...sessions].sort(
    (a, b) => parseDateKey(b.date).getTime() - parseDateKey(a.date).getTime()
  );
  const lastPhotoDate = sorted[0]?.date ?? null;
  const nextRecommendedDate = lastPhotoDate ? addDays(lastPhotoDate, 7) : today;
  const weeklyStreak = computeWeeklyPhotoStreak(sessions);

  let buttonState: ProgressPhotoButtonState = 'take';
  let buttonLabel = 'Take photos';

  if (hasSessionToday) {
    buttonState = 'retake';
    buttonLabel = 'Take new photos';
  } else if (lastPhotoDate && parseDateKey(nextRecommendedDate) <= parseDateKey(today)) {
    buttonState = 'take';
    buttonLabel = 'Take weekly photos';
  }

  return {
    lastPhotoDate,
    nextRecommendedDate,
    weeklyStreak,
    hasSessionToday,
    buttonState,
    buttonLabel,
  };
}

export function getRetakeButtonLabel(): string {
  return 'Retake today’s photos';
}

export function formatDisplayDate(dateKey: string | null): string {
  if (!dateKey) return '—';
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** e.g. "3 Days Ago", "Today", "—" */
export function formatRelativePhotoAge(dateKey: string | null, todayKey = localDateKey()): string {
  if (!dateKey) return '—';
  const a = parseDateKey(dateKey).getTime();
  const b = parseDateKey(todayKey).getTime();
  const days = Math.round((b - a) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 Day Ago';
  return `${days} Days Ago`;
}

/** e.g. "Tomorrow", "In 3 Days", "Due", "—" */
export function formatNextPhotoLabel(dateKey: string | null, todayKey = localDateKey()): string {
  if (!dateKey) return '—';
  const a = parseDateKey(todayKey).getTime();
  const b = parseDateKey(dateKey).getTime();
  const days = Math.round((b - a) / 86400000);
  if (days <= 0) return 'Due Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} Days`;
}

export function formatSessionDateTime(session: PhotoSession): string {
  const datePart = formatDisplayDate(session.date);
  if (!session.timestamp) return datePart;
  const captured = new Date(session.timestamp);
  if (Number.isNaN(captured.getTime())) return datePart;
  const timePart = captured.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
}

/** Compact stamp for photo overlays (bottom-left). */
export function formatSessionStamp(session: PhotoSession): string {
  if (session.timestamp) {
    const captured = new Date(session.timestamp);
    if (!Number.isNaN(captured.getTime())) {
      const datePart = captured.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      const timePart = captured.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
      return `${datePart} · ${timePart}`;
    }
  }
  return formatDisplayDate(session.date);
}

/** Timeline node label — dates so users can scroll back through history. */
export function formatTimelineLabel(
  session: PhotoSession,
  index: number,
  isToday: boolean
): string {
  if (isToday) return 'Today';
  const d = parseDateKey(session.date);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return `Week ${index + 1}`;
}

export function selectDefaultSession(
  sessions: PhotoSession[],
  preferredId?: string | null
): PhotoSession | null {
  if (!sessions.length) return null;
  if (preferredId) {
    const found = sessions.find((s) => s.id === preferredId);
    if (found) return found;
  }
  const today = localDateKey();
  const todaySession = sessions.find((s) => s.date === today);
  if (todaySession) return todaySession;
  return sessions[sessions.length - 1];
}

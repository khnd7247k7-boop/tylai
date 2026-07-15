/**
 * Progress photo persistence — session metadata in AsyncStorage, images on disk.
 */

import { Directory, File, Paths } from 'expo-file-system';
import { loadUserData, saveUserData } from '../utils/userStorage';
import { notifyUserDataReady } from '../utils/userDataEvents';
import { saveSessionPhotosIfEnabled } from './PhotoCameraRollService';
import type {
  PhotoPose,
  PhotoSession,
  ProgressPhotoStats,
  ProgressPhotoButtonState,
} from '../types/progressPhotos';

const STORAGE_KEY = 'progressPhotoSessions';
const PHOTO_DIR = 'progress-photos';

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

async function persistPhoto(tempUri: string, sessionId: string, pose: PhotoPose): Promise<string> {
  const dir = new Directory(Paths.document, PHOTO_DIR, sessionId);
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${pose}.jpg`);
  const src = new File(tempUri);
  if (!src.exists) {
    throw new Error(`Captured photo not found: ${tempUri}`);
  }
  src.copy(dest);
  return dest.uri;
}

async function deleteSessionFiles(sessionId: string): Promise<void> {
  const dir = new Directory(Paths.document, PHOTO_DIR, sessionId);
  if (dir.exists) {
    dir.delete();
  }
}

export async function loadPhotoSessions(): Promise<PhotoSession[]> {
  const raw = await loadUserData<PhotoSession[]>(STORAGE_KEY);
  if (!raw?.length) return [];
  return [...raw].sort(
    (a, b) => parseDateKey(a.date).getTime() - parseDateKey(b.date).getTime()
  );
}

async function writeSessions(sessions: PhotoSession[]): Promise<void> {
  await saveUserData(STORAGE_KEY, sessions);
  notifyUserDataReady();
}

export async function getSessionForDate(dateKey: string): Promise<PhotoSession | null> {
  const sessions = await loadPhotoSessions();
  return sessions.find((s) => s.date === dateKey) ?? null;
}

export async function createSessionFromCaptures(
  captures: Record<PhotoPose, string>
): Promise<PhotoSession> {
  const date = localDateKey();
  const existing = await getSessionForDate(date);
  if (existing) {
    await deletePhotoSession(existing.id);
  }

  const id = `ps_${Date.now()}`;
  const photos = {
    front: await persistPhoto(captures.front, id, 'front'),
    side: await persistPhoto(captures.side, id, 'side'),
    back: await persistPhoto(captures.back, id, 'back'),
  };

  const session: PhotoSession = {
    id,
    date,
    timestamp: new Date().toISOString(),
    photos,
  };

  const sessions = await loadPhotoSessions();
  sessions.push(session);
  await writeSessions(sessions);
  await saveSessionPhotosIfEnabled([photos.front, photos.side, photos.back]);
  return session;
}

export async function deletePhotoSession(sessionId: string): Promise<void> {
  await deleteSessionFiles(sessionId);
  const sessions = await loadPhotoSessions();
  await writeSessions(sessions.filter((s) => s.id !== sessionId));
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
  let buttonLabel = "Take Today's Photos";

  if (hasSessionToday) {
    buttonState = 'view';
    buttonLabel = "View Today's Photos";
  } else if (lastPhotoDate && parseDateKey(nextRecommendedDate) <= parseDateKey(today)) {
    buttonState = 'take';
    buttonLabel = "Take Today's Photos";
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
  return "Retake Today's Photos";
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

export function formatTimelineLabel(
  session: PhotoSession,
  index: number,
  isToday: boolean
): string {
  if (isToday) return 'Today';
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

/**
 * Cloud sync for cross-device user data (Firestore).
 * AsyncStorage remains the offline cache; Firestore is source of truth across devices.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, getUserStorageKey } from '../utils/userStorage';

/** Keys that should sync across devices for the same Firebase account. */
export const CLOUD_SYNCED_KEYS = [
  'savedWorkoutPlans',
  'activeWorkoutPlans',
] as const;

export type CloudSyncedKey = (typeof CLOUD_SYNCED_KEYS)[number];

export function isCloudSyncedKey(baseKey: string): baseKey is CloudSyncedKey {
  return (CLOUD_SYNCED_KEYS as readonly string[]).includes(baseKey);
}

async function getFirestoreContext(): Promise<{
  db: NonNullable<typeof import('../../firebaseConfig').db>;
  doc: typeof import('firebase/firestore').doc;
  getDoc: typeof import('firebase/firestore').getDoc;
  setDoc: typeof import('firebase/firestore').setDoc;
} | null> {
  try {
    const { db, auth } = await import('../../firebaseConfig');
    if (!db || auth?._isMock) return null;
    const { doc, getDoc, setDoc } = await import('firebase/firestore');
    return { db, doc, getDoc, setDoc };
  } catch (error) {
    console.warn('[cloudSync] Firestore unavailable', error);
    return null;
  }
}

function parseUpdatedAt(item: { updatedAt?: string; savedAt?: string } | null | undefined): number {
  if (!item) return 0;
  const raw = item.updatedAt || item.savedAt;
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

/** Merge plan arrays by id; newer updatedAt/savedAt wins. */
export function mergeByIdArrays<T extends { id?: string; updatedAt?: string; savedAt?: string }>(
  local: T[] | null | undefined,
  cloud: T[] | null | undefined
): T[] {
  const map = new Map<string, T>();
  for (const item of [...(cloud ?? []), ...(local ?? [])]) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' ? item.id : null;
    if (!id) continue;
    const existing = map.get(id);
    if (!existing || parseUpdatedAt(item) >= parseUpdatedAt(existing)) {
      map.set(id, item);
    }
  }
  return Array.from(map.values());
}

function mergeActivePlanIds(local: string[] | null | undefined, cloud: string[] | null | undefined): string[] {
  const set = new Set<string>();
  for (const id of [...(cloud ?? []), ...(local ?? [])]) {
    if (typeof id === 'string' && id.trim()) set.add(id);
  }
  return Array.from(set);
}

function mergeValueForKey(baseKey: CloudSyncedKey, local: unknown, cloud: unknown): unknown {
  if (baseKey === 'savedWorkoutPlans') {
    return mergeByIdArrays(
      Array.isArray(local) ? local : [],
      Array.isArray(cloud) ? cloud : []
    );
  }
  if (baseKey === 'activeWorkoutPlans') {
    return mergeActivePlanIds(
      Array.isArray(local) ? (local as string[]) : [],
      Array.isArray(cloud) ? (cloud as string[]) : []
    );
  }
  return local ?? cloud ?? null;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export async function pushUserDataToCloud(baseKey: string, data: unknown): Promise<void> {
  if (!isCloudSyncedKey(baseKey)) return;
  const ctx = await getFirestoreContext();
  const uid = getCurrentUserId();
  if (!ctx || !uid) return;

  try {
    const ref = ctx.doc(ctx.db, 'users', uid, 'appData', baseKey);
    await ctx.setDoc(
      ref,
      {
        value: data ?? null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn(`[cloudSync] push failed for ${baseKey}`, error);
  }
}

export async function pullUserDataFromCloud(baseKey: string): Promise<unknown | null> {
  if (!isCloudSyncedKey(baseKey)) return null;
  const ctx = await getFirestoreContext();
  const uid = getCurrentUserId();
  if (!ctx || !uid) return null;

  try {
    const ref = ctx.doc(ctx.db, 'users', uid, 'appData', baseKey);
    const snap = await ctx.getDoc(ref);
    if (!snap.exists()) return null;
    const payload = snap.data() as { value?: unknown };
    return payload?.value ?? null;
  } catch (error) {
    console.warn(`[cloudSync] pull failed for ${baseKey}`, error);
    return null;
  }
}

/**
 * Pull cloud copies, merge with local AsyncStorage, write both directions as needed.
 * Call after login so phone/simulator share saved workouts.
 */
export async function syncCloudSyncedKeysFromServer(): Promise<{ updatedKeys: string[] }> {
  const updatedKeys: string[] = [];
  const ctx = await getFirestoreContext();
  const uid = getCurrentUserId();
  if (!ctx || !uid) return { updatedKeys };

  for (const baseKey of CLOUD_SYNCED_KEYS) {
    try {
      const storageKey = await getUserStorageKey(baseKey);
      if (!storageKey) continue;

      let local: unknown = null;
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        local = raw ? JSON.parse(raw) : null;
      } catch {
        local = null;
      }

      const cloud = await pullUserDataFromCloud(baseKey);
      const merged = mergeValueForKey(baseKey, local, cloud);

      const localEmpty = local == null || (Array.isArray(local) && local.length === 0);
      const cloudEmpty = cloud == null || (Array.isArray(cloud) && cloud.length === 0);

      if (!valuesEqual(merged, local)) {
        await AsyncStorage.setItem(storageKey, JSON.stringify(merged));
        updatedKeys.push(baseKey);
      }

      if ((!cloudEmpty || !localEmpty) && !valuesEqual(merged, cloud)) {
        await pushUserDataToCloud(baseKey, merged);
      }
    } catch (error) {
      console.warn(`[cloudSync] sync failed for ${baseKey}`, error);
    }
  }

  return { updatedKeys };
}

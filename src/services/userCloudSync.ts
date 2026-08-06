/**
 * Cloud sync for durable user data (Firestore).
 * AsyncStorage remains the offline cache; Firestore backs up saves across
 * app updates, reinstalls, and devices for the same Firebase account.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DURABLE_USER_DATA_KEYS,
  isDurableUserDataKey,
  type DurableUserDataKey,
} from '../utils/durableUserDataKeys';
import { getCurrentUserId, getUserStorageKey } from '../utils/userStorage';

/** Keys that sync to Firestore — everything the user expects to keep. */
export const CLOUD_SYNCED_KEYS = DURABLE_USER_DATA_KEYS;

export type CloudSyncedKey = DurableUserDataKey;

export function isCloudSyncedKey(baseKey: string): baseKey is CloudSyncedKey {
  return isDurableUserDataKey(baseKey);
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

function parseUpdatedAt(item: { updatedAt?: string; savedAt?: string; date?: string } | null | undefined): number {
  if (!item) return 0;
  const raw = item.updatedAt || item.savedAt || item.date;
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

/** Merge plan/log arrays by id; newer updatedAt/savedAt/date wins. */
export function mergeByIdArrays<
  T extends { id?: string; updatedAt?: string; savedAt?: string; date?: string },
>(local: T[] | null | undefined, cloud: T[] | null | undefined): T[] {
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

function mergeStringIdLists(
  local: string[] | null | undefined,
  cloud: string[] | null | undefined
): string[] {
  // Prefer local order (primary active first) when local is non-empty.
  if (Array.isArray(local) && local.length > 0) {
    const set = new Set(local.filter((id) => typeof id === 'string' && id.trim()));
    for (const id of cloud ?? []) {
      if (typeof id === 'string' && id.trim()) set.add(id);
    }
    // Keep local order, then append any cloud-only ids
    const ordered = local.filter((id) => typeof id === 'string' && id.trim());
    for (const id of set) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    return ordered;
  }
  const set = new Set<string>();
  for (const id of [...(cloud ?? []), ...(local ?? [])]) {
    if (typeof id === 'string' && id.trim()) set.add(id);
  }
  return Array.from(set);
}

function parseDocUpdatedAt(raw: unknown): number {
  if (typeof raw !== 'string') return 0;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  if (typeof value === 'string') return value.length === 0;
  return false;
}

/**
 * Resolve local vs cloud for a key.
 * Prefer newer document stamp (LWW) so deletions and edits stick after updates.
 * When stamps tie or are missing, fall back to id-merge for arrays / non-empty preference.
 */
function mergeValueForKey(
  baseKey: CloudSyncedKey,
  local: unknown,
  cloud: unknown,
  localUpdatedAt: number,
  cloudUpdatedAt: number
): unknown {
  if (cloudUpdatedAt > localUpdatedAt && !isEmptyValue(cloud)) return cloud;
  if (localUpdatedAt > cloudUpdatedAt && !isEmptyValue(local)) return local;
  if (cloudUpdatedAt > localUpdatedAt) return cloud ?? local ?? null;
  if (localUpdatedAt > cloudUpdatedAt) return local ?? cloud ?? null;

  // Equal / missing timestamps
  if (baseKey === 'activeWorkoutPlans') {
    return mergeStringIdLists(
      Array.isArray(local) ? (local as string[]) : [],
      Array.isArray(cloud) ? (cloud as string[]) : []
    );
  }

  if (Array.isArray(local) || Array.isArray(cloud)) {
    const localArr = Array.isArray(local) ? local : [];
    const cloudArr = Array.isArray(cloud) ? cloud : [];
    const sample = localArr[0] ?? cloudArr[0];
    if (sample && typeof sample === 'object' && sample !== null && 'id' in sample) {
      return mergeByIdArrays(localArr as any[], cloudArr as any[]);
    }
    // Primitive arrays / unknown shape: prefer non-empty local, else cloud
    if (localArr.length > 0) return localArr;
    return cloudArr;
  }

  if (!isEmptyValue(local)) return local;
  if (!isEmptyValue(cloud)) return cloud;
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
    const updatedAt = new Date().toISOString();
    const ref = ctx.doc(ctx.db, 'users', uid, 'appData', baseKey);
    await ctx.setDoc(
      ref,
      {
        value: data ?? null,
        updatedAt,
      },
      { merge: true }
    );
    try {
      const storageKey = await getUserStorageKey(baseKey);
      if (storageKey) {
        await AsyncStorage.setItem(`${storageKey}__updatedAt`, updatedAt);
      }
    } catch {
      // non-fatal
    }
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
    const snap = await Promise.race([
      ctx.getDoc(ref),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`cloud pull timeout for ${baseKey}`)), 5000)
      ),
    ]);
    if (!snap.exists()) return null;
    const payload = snap.data() as { value?: unknown };
    return payload?.value ?? null;
  } catch (error) {
    console.warn(`[cloudSync] pull failed for ${baseKey}`, error);
    return null;
  }
}

async function syncOneKey(
  baseKey: CloudSyncedKey,
  ctx: NonNullable<Awaited<ReturnType<typeof getFirestoreContext>>>,
  uid: string
): Promise<boolean> {
  const storageKey = await getUserStorageKey(baseKey);
  if (!storageKey) return false;

  let local: unknown = null;
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    local = raw ? JSON.parse(raw) : null;
  } catch {
    local = null;
  }

  const metaKey = `${storageKey}__updatedAt`;
  let localUpdatedAt = 0;
  try {
    const metaRaw = await AsyncStorage.getItem(metaKey);
    localUpdatedAt = parseDocUpdatedAt(metaRaw);
  } catch {
    localUpdatedAt = 0;
  }

  const ref = ctx.doc(ctx.db, 'users', uid, 'appData', baseKey);
  let cloud: unknown = null;
  let cloudUpdatedAt = 0;
  try {
    const snap = await Promise.race([
      ctx.getDoc(ref),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`cloud pull timeout for ${baseKey}`)), 5000)
      ),
    ]);
    if (snap.exists()) {
      const payload = snap.data() as { value?: unknown; updatedAt?: string };
      cloud = payload?.value ?? null;
      cloudUpdatedAt = parseDocUpdatedAt(payload?.updatedAt);
    }
  } catch (error) {
    console.warn(`[cloudSync] pull failed for ${baseKey}`, error);
    return false;
  }

  const merged = mergeValueForKey(baseKey, local, cloud, localUpdatedAt, cloudUpdatedAt);

  const localEmpty = isEmptyValue(local);
  const cloudEmpty = isEmptyValue(cloud);
  let didUpdateLocal = false;

  if (!valuesEqual(merged, local)) {
    await AsyncStorage.setItem(storageKey, JSON.stringify(merged));
    const stamp =
      cloudUpdatedAt > localUpdatedAt && cloudUpdatedAt > 0
        ? new Date(cloudUpdatedAt).toISOString()
        : localUpdatedAt > 0
          ? new Date(localUpdatedAt).toISOString()
          : new Date().toISOString();
    await AsyncStorage.setItem(metaKey, stamp);
    didUpdateLocal = true;
  }

  if ((!cloudEmpty || !localEmpty) && !valuesEqual(merged, cloud)) {
    await pushUserDataToCloud(baseKey, merged);
  }

  return didUpdateLocal;
}

/**
 * Pull cloud copies, merge with local AsyncStorage, write both directions as needed.
 * Call after login so devices restore durable user saves after app updates / reinstalls.
 */
export async function syncCloudSyncedKeysFromServer(): Promise<{ updatedKeys: string[] }> {
  const updatedKeys: string[] = [];
  const ctx = await getFirestoreContext();
  const uid = getCurrentUserId();
  if (!ctx || !uid) return { updatedKeys };

  // Parallel batches keep boot sync under the initializer timeout.
  const BATCH = 6;
  for (let i = 0; i < CLOUD_SYNCED_KEYS.length; i += BATCH) {
    const slice = CLOUD_SYNCED_KEYS.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (baseKey) => {
        try {
          const updated = await syncOneKey(baseKey, ctx, uid);
          return updated ? baseKey : null;
        } catch (error) {
          console.warn(`[cloudSync] sync failed for ${baseKey}`, error);
          return null;
        }
      })
    );
    for (const key of results) {
      if (key) updatedKeys.push(key);
    }
  }

  return { updatedKeys };
}

/** Fire-and-forget full sync after boot so late keys still upload/download. */
export function scheduleBackgroundCloudSync(): void {
  setTimeout(() => {
    void syncCloudSyncedKeysFromServer()
      .then((r) => {
        if (r.updatedKeys.length > 0) {
          console.log(`[cloudSync] background synced: ${r.updatedKeys.join(', ')}`);
        }
      })
      .catch((e) => console.warn('[cloudSync] background sync failed', e));
  }, 2500);
}

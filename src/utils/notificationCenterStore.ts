import { loadUserData, saveUserData } from './userStorage';
import type { AppNotificationPayload } from './appNotificationBridge';

const STORAGE_KEY = 'notificationCenterDaily';
const MAX_ENTRIES_PER_DAY = 50;

export type NotificationCenterEntry = {
  id: string;
  title?: string;
  lines: string[];
  type: 'success' | 'error' | 'info' | 'warning';
  createdAt: string;
  read: boolean;
};

type DailyStore = {
  dateKey: string;
  entries: NotificationCenterEntry[];
};

const listeners = new Set<() => void>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

export function localNotificationDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function subscribeNotificationCenter(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function loadStore(): Promise<DailyStore> {
  const today = localNotificationDateKey();
  const raw = await loadUserData<DailyStore>(STORAGE_KEY);
  if (raw?.dateKey === today && Array.isArray(raw.entries)) {
    return raw;
  }
  return { dateKey: today, entries: [] };
}

async function saveStore(store: DailyStore): Promise<void> {
  await saveUserData(STORAGE_KEY, store);
  emitChange();
}

export async function recordNotificationCenterEntry(
  id: string,
  payload: AppNotificationPayload
): Promise<void> {
  const store = await loadStore();
  if (store.entries.some((entry) => entry.id === id)) return;

  const lines = [...(payload.lines ?? [])].filter(Boolean);
  const title = payload.title?.trim();
  if (lines.length === 0 && title) {
    lines.push(title);
  }

  store.entries.unshift({
    id,
    title,
    lines,
    type: payload.type ?? 'info',
    createdAt: new Date().toISOString(),
    read: false,
  });
  store.entries = store.entries.slice(0, MAX_ENTRIES_PER_DAY);
  await saveStore(store);
}

export async function fetchTodayNotificationCenterEntries(): Promise<NotificationCenterEntry[]> {
  const store = await loadStore();
  return store.entries;
}

export async function markNotificationCenterRead(entryId?: string): Promise<void> {
  const store = await loadStore();
  if (entryId) {
    store.entries = store.entries.map((entry) =>
      entry.id === entryId ? { ...entry, read: true } : entry
    );
  } else {
    store.entries = store.entries.map((entry) => ({ ...entry, read: true }));
  }
  await saveStore(store);
}

export function countUnreadNotifications(entries: NotificationCenterEntry[]): number {
  return entries.filter((entry) => !entry.read).length;
}

export function formatNotificationCenterTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

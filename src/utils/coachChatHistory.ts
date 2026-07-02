import { loadUserData, saveUserData } from './userStorage';

export type CoachHistoryEntry = {
  id: string;
  query: string;
  reply: string;
  createdAt: string;
};

const STORAGE_KEY = 'coachChatHistory';
const MAX_ENTRIES = 25;

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function loadCoachChatHistory(): Promise<CoachHistoryEntry[]> {
  const data = await loadUserData<CoachHistoryEntry[]>(STORAGE_KEY);
  if (!Array.isArray(data)) return [];
  return data.filter((e) => e?.query && e?.reply);
}

export async function appendCoachChatHistory(entry: CoachHistoryEntry): Promise<CoachHistoryEntry[]> {
  const existing = await loadCoachChatHistory();
  const next = [entry, ...existing.filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES);
  await saveUserData(STORAGE_KEY, next);
  return next;
}

export function formatCoachHistoryWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (localDateKey(d) === localDateKey(now)) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (localDateKey(d) === localDateKey(yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

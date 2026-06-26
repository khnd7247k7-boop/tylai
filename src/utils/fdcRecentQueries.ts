import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@fdc_recent_queries_v1';
const MAX = 10;

export async function loadRecentFoodQueries(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, MAX);
  } catch {
    return [];
  }
}

export async function rememberFoodQuery(query: string): Promise<void> {
  const q = query.trim();
  if (q.length < 2) return;
  try {
    const prev = await loadRecentFoodQueries();
    const next = [q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

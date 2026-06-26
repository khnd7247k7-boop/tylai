import type { WorkoutSession } from '../../data/workoutPrograms';

export type HistoryLinePoint = { date: string; value: number };

export type WeightEntry = {
  id: string;
  date: string;
  weight: number;
};

export function sessionsToPeakSetWeightPoints(sessions: WorkoutSession[]): HistoryLinePoint[] {
  const out: HistoryLinePoint[] = [];
  for (const s of sessions) {
    if (!s.completed) continue;
    let maxW = 0;
    for (const ex of s.exercises || []) {
      for (const st of ex.sets || []) {
        if (st.completed && typeof st.weight === 'number' && st.weight > maxW) maxW = st.weight;
      }
    }
    if (maxW > 0) out.push({ date: s.date, value: maxW });
  }
  return out
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-50);
}

export function sessionsToVolumePoints(sessions: WorkoutSession[]): HistoryLinePoint[] {
  const out: HistoryLinePoint[] = [];
  for (const s of sessions) {
    if (!s.completed) continue;
    let vol = 0;
    for (const ex of s.exercises || []) {
      for (const st of ex.sets || []) {
        if (st.completed && typeof st.reps === 'number' && typeof st.weight === 'number') {
          vol += Math.max(0, st.weight) * Math.max(0, st.reps);
        }
      }
    }
    if (vol > 0) out.push({ date: s.date, value: vol });
  }
  return out
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-50);
}

export function sessionsToPrimaryLiftPoints(
  sessions: WorkoutSession[]
): { liftName: string; points: HistoryLinePoint[] } {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    if (!s.completed) continue;
    for (const ex of s.exercises || []) {
      const raw = (ex.name || '').trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  let topKey = '';
  let topN = 0;
  for (const [k, n] of counts) {
    if (n > topN) {
      topN = n;
      topKey = k;
    }
  }
  if (topN < 2 || !topKey) return { liftName: '', points: [] };

  let displayName = topKey;
  for (const s of sessions) {
    const ex = s.exercises?.find((e) => (e.name || '').trim().toLowerCase() === topKey);
    if (ex?.name?.trim()) {
      displayName = ex.name.trim();
      break;
    }
  }

  const chronological = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const points: HistoryLinePoint[] = [];
  for (const s of chronological) {
    if (!s.completed) continue;
    const ex = s.exercises?.find((e) => (e.name || '').trim().toLowerCase() === topKey);
    if (!ex) continue;
    let maxW = 0;
    for (const st of ex.sets || []) {
      if (st.completed && typeof st.weight === 'number' && st.weight > maxW) maxW = st.weight;
    }
    if (maxW > 0) points.push({ date: s.date, value: maxW });
  }
  return { liftName: displayName, points: points.slice(-50) };
}

export function weightEntriesToPoints(entries: WeightEntry[]): HistoryLinePoint[] {
  return [...entries]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((e) => ({ date: e.date, value: e.weight }));
}

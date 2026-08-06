/**
 * Helpers for reading/writing workoutHistory with stable dedupe.
 */
import type { WorkoutSession } from '../../data/workoutPrograms';
import { loadUserData, saveUserData } from './userStorage';
import { notifyUserDataReady } from './userDataEvents';

export function dedupeWorkoutSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  const seen = new Set<string>();
  return sessions.filter((s) => {
    const id = String(s?.id ?? '');
    const date = String(s?.date ?? '');
    const k = `${id}|${date}`;
    if (!id && !date) return false;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Prepend a completed session to history, dedupe, and persist.
 * Callers should invoke notifyUserDataReady() after related side effects
 * (e.g. Small Wins / milestones) so Progress sees the latest data.
 */
export async function appendCompletedWorkoutSession(
  session: WorkoutSession,
  opts?: { notify?: boolean }
): Promise<WorkoutSession[]> {
  const existing = (await loadUserData<WorkoutSession[]>('workoutHistory')) || [];
  const withFlag: WorkoutSession = {
    ...session,
    completed: true,
  };
  const next = dedupeWorkoutSessions([withFlag, ...existing]);
  await saveUserData('workoutHistory', next);
  if (opts?.notify !== false) {
    notifyUserDataReady();
  }
  return next;
}

export async function loadDedupedWorkoutHistory(): Promise<WorkoutSession[]> {
  const raw = (await loadUserData<WorkoutSession[]>('workoutHistory')) || [];
  const deduped = dedupeWorkoutSessions(raw);
  if (deduped.length < raw.length) {
    await saveUserData('workoutHistory', deduped);
  }
  return deduped;
}

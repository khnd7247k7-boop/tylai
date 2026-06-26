import { loadUserData, saveUserData } from './userStorage';
import { notifyUserDataReady } from './userDataEvents';

type DailyMentalProgress = {
  date: string;
  completedExercises: number;
};

export type MindsetCompletedTask = {
  id: string;
  title: string;
  category: 'fitness' | 'mindset' | 'spiritual' | 'emotional';
  completedAt: string;
  completed: boolean;
};

export function todayDateString(): string {
  return new Date().toDateString();
}

/** True when the user finished at least one mental exercise today. */
export async function isMindsetCheckInDoneToday(): Promise<boolean> {
  const today = todayDateString();
  const mentalProgress = (await loadUserData<DailyMentalProgress[]>('dailyMentalProgress')) || [];
  if (mentalProgress.some((p) => p.date === today && p.completedExercises > 0)) {
    return true;
  }
  const tasks = (await loadUserData<MindsetCompletedTask[]>('completedTasks')) || [];
  return tasks.some(
    (t) =>
      t.category === 'mindset' &&
      t.completed &&
      new Date(t.completedAt).toDateString() === today
  );
}

/** Mark today's mindset check-in complete (called when a mental exercise is finished). */
export async function markMindsetCheckInComplete(taskTitle?: string): Promise<void> {
  const today = todayDateString();
  const tasks = (await loadUserData<MindsetCompletedTask[]>('completedTasks')) || [];
  const title = taskTitle?.trim() || 'Mental check-in';
  const mindsetIdx = tasks.findIndex((t) => t.category === 'mindset');
  const updated =
    mindsetIdx >= 0
      ? tasks.map((t, i) =>
          i === mindsetIdx
            ? { ...t, completed: true, completedAt: new Date().toISOString(), title }
            : t
        )
      : [
          ...tasks,
          {
            id: `mindset-${Date.now()}`,
            title,
            category: 'mindset' as const,
            completed: true,
            completedAt: new Date().toISOString(),
          },
        ];

  await saveUserData('completedTasks', updated);
  const lastReset = await loadUserData<string>('completedTasksLastReset');
  if (!lastReset) {
    await saveUserData('completedTasksLastReset', today);
  }
  notifyUserDataReady();
}

import type { ScheduleProfile } from '../types/coachingProfile';
import {
  createFlexibleTrainingDays,
  sortWeeklyTrainingDays,
  type CustomPlanScheduleMode,
} from './customWorkoutPlan';

export function isTrainingScheduleConfigured(schedule: ScheduleProfile): boolean {
  if (!schedule.daysPerWeek || !schedule.scheduleMode) return false;
  if (schedule.scheduleMode === 'flexible_days') return schedule.daysPerWeek >= 1;
  const selected = schedule.trainingDays ?? [];
  return selected.length === schedule.daysPerWeek;
}

export function resolveTrainingDaysForSchedule(schedule: ScheduleProfile): string[] {
  const n = schedule.daysPerWeek ?? 3;
  if (schedule.scheduleMode === 'flexible_days') {
    return createFlexibleTrainingDays(n);
  }
  return sortWeeklyTrainingDays(schedule.trainingDays ?? []);
}

export function scheduleSummaryLine(schedule: ScheduleProfile): string {
  const days = schedule.daysPerWeek ?? '—';
  const length = schedule.sessionLengthMinutes ?? '—';
  const time = schedule.bestTimeOfDay ?? '—';
  if (!schedule.scheduleMode) {
    return `${days} days × ${length} min (${time})`;
  }
  if (schedule.scheduleMode === 'flexible_days') {
    return `${days} flexible workouts × ${length} min (${time})`;
  }
  const names = resolveTrainingDaysForSchedule(schedule);
  return `${names.join(', ')} · ${length} min (${time})`;
}

export function applyDaysPerWeekChange(
  schedule: ScheduleProfile,
  daysPerWeek: number
): ScheduleProfile {
  const next: ScheduleProfile = { ...schedule, daysPerWeek };
  if (next.scheduleMode === 'flexible_days') {
    return { ...next, trainingDays: createFlexibleTrainingDays(daysPerWeek) };
  }
  if (next.scheduleMode === 'weekly_split' && next.trainingDays?.length) {
    const trimmed = sortWeeklyTrainingDays(next.trainingDays).slice(0, daysPerWeek);
    return { ...next, trainingDays: trimmed };
  }
  return next;
}

export function applyScheduleModeChange(
  schedule: ScheduleProfile,
  mode: CustomPlanScheduleMode
): ScheduleProfile {
  const n = schedule.daysPerWeek ?? 3;
  if (mode === 'flexible_days') {
    return {
      ...schedule,
      scheduleMode: mode,
      trainingDays: createFlexibleTrainingDays(n),
    };
  }
  return {
    ...schedule,
    scheduleMode: mode,
    trainingDays: schedule.trainingDays?.length ? sortWeeklyTrainingDays(schedule.trainingDays) : [],
  };
}

export function toggleWeeklyTrainingDay(
  schedule: ScheduleProfile,
  day: string
): ScheduleProfile {
  const limit = schedule.daysPerWeek ?? 0;
  const current = schedule.trainingDays ?? [];
  if (current.includes(day)) {
    return { ...schedule, trainingDays: current.filter((d) => d !== day) };
  }
  if (current.length >= limit) return schedule;
  return { ...schedule, trainingDays: sortWeeklyTrainingDays([...current, day]) };
}

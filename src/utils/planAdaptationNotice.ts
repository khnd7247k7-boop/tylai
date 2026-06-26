/**
 * Pending coach adaptation notice — shown next time the user opens a saved plan.
 */

import { loadUserData, saveUserData } from './userStorage';
import type { AdaptiveAction, PlanAdaptationChange } from '../services/planAdaptationLogic';

export interface PendingCoachAdaptationNotice {
  action: AdaptiveAction;
  adaptedAt: string;
  changes: PlanAdaptationChange[];
}

const ACTION_LABELS: Record<AdaptiveAction, string> = {
  maintain: 'Synced to your performance',
  progress: 'Progression',
  regress: 'Step back to rebuild consistency',
  deload: 'Recovery deload',
  simplify: 'Simplified volume',
  intensify: 'Intensified',
};

export function coachAdaptationAlertTitle(action: AdaptiveAction): string {
  return `Coach update: ${ACTION_LABELS[action] ?? action}`;
}

export function formatCoachAdaptationChangeLine(change: PlanAdaptationChange): string {
  if (change.reason.includes('→') && change.oldValue === change.newValue) {
    return `• ${change.reason}`;
  }
  const unit = change.field === 'weight' ? ' lb' : '';
  return `• ${change.exerciseName}: ${change.field} ${change.oldValue}${unit} → ${change.newValue}${unit}\n  ${change.reason}`;
}

export function formatCoachAdaptationAlertBody(
  action: AdaptiveAction,
  changes: PlanAdaptationChange[]
): string {
  if (!changes.length) {
    return 'Your plan was adjusted based on your last workout.';
  }
  const intro =
    action === 'maintain'
      ? 'Your plan was synced to match how you actually performed:'
      : 'Based on your last workout, your coach adjusted this plan:';
  return `${intro}\n\n${changes.map(formatCoachAdaptationChangeLine).join('\n')}`;
}

/** Read and clear pending notice so it only shows once on next plan open. */
export async function consumePendingCoachAdaptationNotice(
  planId: string
): Promise<PendingCoachAdaptationNotice | null> {
  const savedPlans = (await loadUserData<any[]>('savedWorkoutPlans')) || [];
  const idx = savedPlans.findIndex((p) => p.id === planId);
  if (idx < 0) return null;

  const notice = savedPlans[idx].pendingCoachAdaptationNotice as
    | PendingCoachAdaptationNotice
    | undefined;
  if (!notice?.changes?.length) return null;

  const copy: PendingCoachAdaptationNotice = {
    action: notice.action,
    adaptedAt: notice.adaptedAt,
    changes: [...notice.changes],
  };

  const { pendingCoachAdaptationNotice: _removed, ...rest } = savedPlans[idx];
  savedPlans[idx] = rest;
  await saveUserData('savedWorkoutPlans', savedPlans);
  return copy;
}

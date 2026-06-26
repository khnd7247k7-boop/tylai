/**
 * Applies CoachingEngine adaptive actions to active saved workout plans.
 * Smart progression: at set cap (typically 4), progress via weight/reps — not more sets.
 */

import { loadUserData, saveUserData } from '../utils/userStorage';
import type { WorkoutSession } from '../../data/workoutPrograms';
import { buildCoachingContextSnapshot } from './CoachingEngine';
import type { ChallengeDial } from '../types/coachingProfile';

export {
  SET_CAPS,
  applyAdaptiveActionToWeeklyPlan,
  type AdaptableExercise,
  type AdaptableWeeklyPlan,
  type PlanAdaptationChange,
  type PlanAdaptationResult,
  type AdaptiveAction,
} from './planAdaptationLogic';

import {
  applyAdaptiveActionToWeeklyPlan,
  type AdaptiveAction,
} from './planAdaptationLogic';

export interface AutoAdaptSummary {
  planId: string;
  planName: string;
  action: AdaptiveAction;
  changeCount: number;
  message: string;
}

function weekKeyNow(): string {
  const d = new Date();
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toISOString().slice(0, 10);
}

export async function autoAdaptActivePlans(options?: {
  triggerPlanId?: string;
  force?: boolean;
}): Promise<AutoAdaptSummary[]> {
  const [savedPlans, activeIds, history, coachingCtx] = await Promise.all([
    loadUserData<any[]>('savedWorkoutPlans'),
    loadUserData<string[]>('activeWorkoutPlans'),
    loadUserData<WorkoutSession[]>('workoutHistory'),
    buildCoachingContextSnapshot(),
  ]);

  if (!savedPlans?.length || !activeIds?.length || !history?.length) {
    return [];
  }

  const weekKey = weekKeyNow();
  const state =
    (await loadUserData<Record<string, { weekKey: string; action: AdaptiveAction }>>(
      'planAdaptationState'
    )) || {};

  const summaries: AutoAdaptSummary[] = [];
  const action = coachingCtx.adaptiveRecommendation;
  const challengeDial = (coachingCtx.assessment.challengeDial as ChallengeDial | null) ?? null;
  const progressionLever = coachingCtx.goalAdaptation.progressionLever;

  for (const planId of activeIds) {
    if (options?.triggerPlanId && planId !== options.triggerPlanId) continue;

    const prior = state[planId];
    if (!options?.force && prior?.weekKey === weekKey && prior?.action === action) {
      continue;
    }

    const idx = savedPlans.findIndex((p) => p.id === planId);
    if (idx < 0) continue;
    const plan = savedPlans[idx];
    if (!plan?.weeklyPlan?.weekDays?.length) continue;

    const result = applyAdaptiveActionToWeeklyPlan(plan.weeklyPlan, history || [], {
      adaptiveRecommendation: action,
      progressionAllowed: coachingCtx.progressionAllowed,
      challengeDial,
      progressionLever,
    });

    if (!result.applied) continue;

    savedPlans[idx] = {
      ...plan,
      weeklyPlan: result.plan,
      lastAutoAdaptedAt: new Date().toISOString(),
      lastAdaptiveAction: action,
      pendingCoachAdaptationNotice: {
        action,
        adaptedAt: new Date().toISOString(),
        changes: result.changes,
      },
    };
    state[planId] = { weekKey, action };

    const message =
      action === 'maintain'
        ? 'Plan synced to your recent performance.'
        : `Coach adjusted your plan (${action.replace('_', ' ')}): ${result.changes.length} update(s).`;

    summaries.push({
      planId,
      planName: plan.name || 'Workout plan',
      action,
      changeCount: result.changes.length,
      message,
    });
  }

  if (summaries.length > 0) {
    await saveUserData('savedWorkoutPlans', savedPlans);
    await saveUserData('planAdaptationState', state);
  }

  return summaries;
}

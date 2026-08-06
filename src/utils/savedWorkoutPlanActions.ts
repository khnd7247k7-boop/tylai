/**
 * Delete a saved workout plan from local + cloud storage and active list.
 * saveUserData awaits cloud push so a later sync merge cannot resurrect the plan.
 */
import { loadUserData, saveUserData } from './userStorage';

export async function deleteSavedWorkoutPlan(planId: string): Promise<void> {
  const savedPlans = (await loadUserData<any[]>('savedWorkoutPlans')) || [];
  const updatedPlans = savedPlans.filter((p) => p.id !== planId);
  await saveUserData('savedWorkoutPlans', updatedPlans);
  // Await cloud write so a concurrent login sync cannot resurrect the plan.
  try {
    const { pushUserDataToCloud } = await import('../services/userCloudSync');
    await pushUserDataToCloud('savedWorkoutPlans', updatedPlans);
  } catch (error) {
    console.warn('[savedWorkoutPlanActions] cloud delete push failed', error);
  }

  const activePlans = (await loadUserData<string[]>('activeWorkoutPlans')) || [];
  const updatedActive = activePlans.filter((id) => id !== planId);
  if (updatedActive.length !== activePlans.length) {
    await saveUserData('activeWorkoutPlans', updatedActive);
    try {
      const { pushUserDataToCloud } = await import('../services/userCloudSync');
      await pushUserDataToCloud('activeWorkoutPlans', updatedActive);
    } catch (error) {
      console.warn('[savedWorkoutPlanActions] cloud active push failed', error);
    }
  }
}

/** Put planId first in the active list so Start Workout / dashboard use it. */
export async function setPrimaryActiveWorkoutPlan(planId: string): Promise<string[]> {
  const active = (await loadUserData<string[]>('activeWorkoutPlans')) || [];
  const updated = [planId, ...active.filter((id) => id !== planId)];
  await saveUserData('activeWorkoutPlans', updated);
  return updated;
}

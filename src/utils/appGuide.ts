import { loadUserData, saveUserData } from './userStorage';

export async function shouldShowAppGuide(): Promise<boolean> {
  try {
    const completed = await loadUserData<boolean>('onboardingGuideCompleted');
    const dismissed = await loadUserData<boolean>('onboardingGuideDismissed');
    return completed !== true && dismissed !== true;
  } catch {
    return true;
  }
}

export async function markAppGuideCompleted(): Promise<void> {
  await saveUserData('onboardingGuideCompleted', true);
}

export async function markAppGuideDismissed(): Promise<void> {
  await saveUserData('onboardingGuideDismissed', true);
}

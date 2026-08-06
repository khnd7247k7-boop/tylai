import { loadUserData, saveUserData } from './userStorage';

/**
 * Product app-guide / spotlight tour is disabled until we ship an updated version.
 * Keep these helpers so a future guide can reuse the same completion flags.
 */
export async function shouldShowAppGuide(): Promise<boolean> {
  return false;
}

export async function markAppGuideCompleted(): Promise<void> {
  await saveUserData('onboardingGuideCompleted', true);
}

export async function markAppGuideDismissed(): Promise<void> {
  await saveUserData('onboardingGuideDismissed', true);
}

/** Optional: read prior completion if needed when reintroducing the guide. */
export async function hasCompletedOrDismissedAppGuide(): Promise<boolean> {
  try {
    const completed = await loadUserData<boolean>('onboardingGuideCompleted');
    const dismissed = await loadUserData<boolean>('onboardingGuideDismissed');
    return completed === true || dismissed === true;
  } catch {
    return false;
  }
}

import { loadUserData, saveUserData } from './userStorage';
import type { SubscriptionTier } from '../constants/featureTiers';
import Constants from 'expo-constants';
import { isTestFlightInstall } from './testFlightAccess';
import { checkStripePaidBetaAccess } from '../services/betaAccessService';
import { currentUserHasDeveloperPremiumAccess } from './developerPremiumAccess';

const STORAGE_KEY = 'subscriptionTier';

export class PremiumRequiredError extends Error {
  readonly code = 'PREMIUM_REQUIRED' as const;

  constructor(message = 'This feature requires TYL Premium.') {
    super(message);
    this.name = 'PremiumRequiredError';
  }
}

/** In-memory flag updated by SubscriptionProvider — safe for geminiService (non-React). */
let premiumAccessSync = false;

function envFlagTrue(raw: string | undefined): boolean {
  return raw === 'true' || raw === '1';
}

function readGrantPremiumFlag(): boolean {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GRANT_PREMIUM) {
    if (envFlagTrue(process.env.EXPO_PUBLIC_GRANT_PREMIUM)) return true;
  }
  const extra = (Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? null) as
    | Record<string, unknown>
    | null;
  const fromExtra = extra?.EXPO_PUBLIC_GRANT_PREMIUM;
  if (typeof fromExtra === 'string' && envFlagTrue(fromExtra.trim())) return true;
  return false;
}

export function setPremiumAccessSync(isPremium: boolean): void {
  premiumAccessSync = isPremium;
}

export function hasPremiumAccessSync(): boolean {
  return premiumAccessSync;
}

export function assertPremiumGeminiAccess(): void {
  if (!premiumAccessSync) {
    throw new PremiumRequiredError();
  }
}

export async function loadStoredSubscriptionTier(): Promise<SubscriptionTier> {
  try {
    const stored = await loadUserData<SubscriptionTier>(STORAGE_KEY);
    return stored === 'premium' ? 'premium' : 'basic';
  } catch {
    return 'basic';
  }
}

export async function saveSubscriptionTier(tier: SubscriptionTier): Promise<void> {
  await saveUserData(STORAGE_KEY, tier);
  setPremiumAccessSync(tier === 'premium');
}

export function isPremiumTier(tier: SubscriptionTier): boolean {
  return tier === 'premium';
}

/** Dev / TestFlight / internal override — not App Store IAP. */
export function envGrantsPremium(): boolean {
  return readGrantPremiumFlag();
}

/** True for TestFlight installs (sandbox receipt) so beta testers get Premium. */
export async function testFlightGrantsPremium(): Promise<boolean> {
  return isTestFlightInstall();
}

/**
 * Resolve tier from env override, TestFlight + Stripe, or local dev storage.
 * Clears cached premium when Stripe subscription is inactive.
 */
export async function resolveSubscriptionTier(): Promise<SubscriptionTier> {
  if (envGrantsPremium()) return 'premium';

  if (currentUserHasDeveloperPremiumAccess()) {
    await saveSubscriptionTier('premium');
    return 'premium';
  }

  if (await isTestFlightInstall()) {
    const paid = await checkStripePaidBetaAccess();
    if (paid) {
      await saveSubscriptionTier('premium');
      return 'premium';
    }
    await saveSubscriptionTier('basic');
    return 'basic';
  }

  return loadStoredSubscriptionTier();
}

/**
 * Premium for beta builds: env override, or TestFlight + Stripe payment when configured.
 * If no payment URL is set yet, all TestFlight installs get Premium (internal beta).
 */
export async function betaGrantsPremium(): Promise<boolean> {
  const tier = await resolveSubscriptionTier();
  return isPremiumTier(tier);
}

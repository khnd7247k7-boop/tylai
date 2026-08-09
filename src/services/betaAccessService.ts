import Constants from 'expo-constants';
import { Alert, Linking } from 'react-native';
import { auth } from '../../firebaseConfig';

function readEnvString(key: string): string {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return String(process.env[key]).trim();
  }
  const extra = (Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? null) as
    | Record<string, unknown>
    | null;
  const fromExtra = extra?.[key];
  return typeof fromExtra === 'string' ? fromExtra.trim() : '';
}

export function getBetaAccessApiUrl(): string {
  return (
    readEnvString('EXPO_PUBLIC_BETA_ACCESS_API_URL') ||
    'https://tyl-ai.com/api/beta-access'
  );
}

export function getBillingPortalApiUrl(): string {
  return (
    readEnvString('EXPO_PUBLIC_BILLING_PORTAL_API_URL') ||
    'https://tyl-ai.com/api/billing-portal'
  );
}

export function getBetaPaymentUrl(): string {
  return readEnvString('EXPO_PUBLIC_BETA_PAYMENT_URL') || 'https://tyl-ai.com/join.html#pricing';
}

/**
 * Stripe paid check for TestFlight premium.
 * Returns `null` when the check could not be verified (network/auth/API error) —
 * callers must not treat that as unpaid or they will strip premium temporarily.
 */
export async function checkStripePaidBetaAccess(): Promise<boolean | null> {
  const status = await fetchStripeSubscriptionStatus();
  if (!status.verified) return null;
  return status.paid;
}

export type StripeSubscriptionStatus = {
  /** False when the server response could not be trusted (do not downgrade on this). */
  verified: boolean;
  paid: boolean;
  active: boolean;
  plan: string | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
};

function unverifiedStatus(): StripeSubscriptionStatus {
  return {
    verified: false,
    paid: false,
    active: false,
    plan: null,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
  };
}

async function getIdTokenWithRetry(user: { getIdToken: (force?: boolean) => Promise<string> }): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await user.getIdToken(attempt > 0);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const code =
        err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
      const isNetwork =
        code === 'auth/network-request-failed' || /network-request-failed|network error/i.test(msg);
      if (!isNetwork || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchStripeSubscriptionStatus(): Promise<StripeSubscriptionStatus> {
  const user = auth?.currentUser;
  if (!user?.email || auth?._isMock) {
    // Auth not ready / signed out — NOT a verified unpaid result.
    // Treating this as unpaid was wiping Premium on cold start before Firebase restored.
    return unverifiedStatus();
  }

  try {
    // Simulator NetInfo often lies for a second after launch; give RN networking a beat.
    await new Promise((r) => setTimeout(r, 600));
    const idToken = await getIdTokenWithRetry(user);
    const res = await fetch(getBetaAccessApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) {
      console.warn('[betaAccess] status check failed', res.status);
      return unverifiedStatus();
    }

    const data = (await res.json()) as {
      paid?: boolean;
      active?: boolean;
      plan?: string | null;
      subscriptionStatus?: string | null;
      cancelAtPeriodEnd?: boolean;
    };

    return {
      verified: true,
      paid: data.paid === true,
      active: data.active === true,
      plan: data.plan ?? null,
      subscriptionStatus: data.subscriptionStatus ?? null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
    };
  } catch (error) {
    console.warn('[betaAccess] status check error', error);
    return unverifiedStatus();
  }
}

export async function openStripeBillingPortal(): Promise<boolean> {
  const user = auth?.currentUser;
  if (!user?.email || auth?._isMock) {
    Alert.alert('Sign in required', 'Sign in with the same email you used at Stripe checkout.');
    return false;
  }

  try {
    const idToken = await getIdTokenWithRetry(user);
    const res = await fetch(getBillingPortalApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

    if (!res.ok || !data.url) {
      Alert.alert(
        'Billing unavailable',
        data.error ||
          'We could not open billing management. Make sure you subscribed with this email, or contact support.'
      );
      return false;
    }

    await Linking.openURL(data.url);
    return true;
  } catch (error) {
    console.warn('[billing] portal open failed', error);
    Alert.alert('Billing unavailable', 'Could not open the billing page. Check your connection and try again.');
    return false;
  }
}

export function formatStripePlanLabel(plan: string | null): string | null {
  if (plan === 'yearly') return 'Yearly';
  if (plan === 'monthly') return 'Monthly';
  return null;
}

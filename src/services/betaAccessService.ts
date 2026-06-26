import Constants from 'expo-constants';
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

export function getBetaPaymentUrl(): string {
  return readEnvString('EXPO_PUBLIC_BETA_PAYMENT_URL') || 'https://tyl-ai.com/join.html#pricing';
}

/** True when this Firebase account email has an active Stripe beta payment. */
export async function checkStripePaidBetaAccess(): Promise<boolean> {
  const status = await fetchStripeSubscriptionStatus();
  return status.paid;
}

export type StripeSubscriptionStatus = {
  paid: boolean;
  active: boolean;
  plan: string | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
};

export async function fetchStripeSubscriptionStatus(): Promise<StripeSubscriptionStatus> {
  const empty: StripeSubscriptionStatus = {
    paid: false,
    active: false,
    plan: null,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
  };

  const user = auth?.currentUser;
  if (!user?.email || auth?._isMock) return empty;

  try {
    const idToken = await user.getIdToken();
    const res = await fetch(getBetaAccessApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) {
      console.warn('[betaAccess] status check failed', res.status);
      return empty;
    }

    const data = (await res.json()) as {
      paid?: boolean;
      active?: boolean;
      plan?: string | null;
      subscriptionStatus?: string | null;
      cancelAtPeriodEnd?: boolean;
    };

    return {
      paid: data.paid === true,
      active: data.active === true,
      plan: data.plan ?? null,
      subscriptionStatus: data.subscriptionStatus ?? null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
    };
  } catch (error) {
    console.warn('[betaAccess] status check error', error);
    return empty;
  }
}

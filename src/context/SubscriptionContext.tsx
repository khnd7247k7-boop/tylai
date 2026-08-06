import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import {
  BASIC_FEATURES,
  PREMIUM_FEATURES,
  type FeatureTierEntry,
  type SubscriptionTier,
} from '../constants/featureTiers';
import PremiumUpsellModal from '../components/PremiumUpsellModal';
import {
  isPremiumTier,
  loadStoredSubscriptionTier,
  resolveSubscriptionTier,
  saveSubscriptionTier,
  setPremiumAccessSync,
} from '../utils/subscription';
import {
  fetchStripeSubscriptionStatus,
  openStripeBillingPortal,
  type StripeSubscriptionStatus,
} from '../services/betaAccessService';

type SubscriptionContextValue = {
  tier: SubscriptionTier;
  isPremium: boolean;
  isLoading: boolean;
  basicFeatures: FeatureTierEntry[];
  premiumFeatures: FeatureTierEntry[];
  /** Opens the in-app upgrade sheet (RevenueCat / App Store later). */
  presentUpgrade: () => void;
  upgradeVisible: boolean;
  dismissUpgrade: () => void;
  /** Dev-only: simulate premium after purchase flow is wired. */
  setDevPremiumOverride: (enabled: boolean) => Promise<void>;
  restorePurchases: () => Promise<void>;
  stripeStatus: StripeSubscriptionStatus | null;
  manageBilling: () => Promise<boolean>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

const SIGNED_OUT_STRIPE: StripeSubscriptionStatus = {
  verified: true,
  paid: false,
  active: false,
  plan: null,
  subscriptionStatus: null,
  cancelAtPeriodEnd: false,
};

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<SubscriptionTier>('basic');
  const [isLoading, setIsLoading] = useState(true);
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeSubscriptionStatus | null>(null);
  /** Monotonic token — only the latest refresh may write React / sync state. */
  const refreshGenRef = useRef(0);

  const refreshTier = useCallback(async (opts?: { retryIfUnpaid?: boolean }) => {
    const gen = ++refreshGenRef.current;

    const resolveWithOptionalRetry = async (): Promise<SubscriptionTier> => {
      let resolved = await resolveSubscriptionTier();
      if (!opts?.retryIfUnpaid || isPremiumTier(resolved)) return resolved;

      // After returning from Stripe checkout, webhooks can lag a few seconds.
      const delaysMs = [1500, 3000, 5000];
      for (const delay of delaysMs) {
        await new Promise((r) => setTimeout(r, delay));
        if (gen !== refreshGenRef.current) return resolved;
        resolved = await resolveSubscriptionTier();
        if (isPremiumTier(resolved)) return resolved;
      }
      return resolved;
    };

    const resolved = await resolveWithOptionalRetry();
    if (gen !== refreshGenRef.current) return;

    setTier(resolved);
    setPremiumAccessSync(isPremiumTier(resolved));

    const status = await fetchStripeSubscriptionStatus();
    if (gen !== refreshGenRef.current) return;

    // Only apply verified Stripe payloads (never flash unpaid on network blips).
    if (status?.verified) {
      setStripeStatus(status);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applySignedOut = () => {
      setTier('basic');
      setPremiumAccessSync(false);
      setStripeStatus(SIGNED_OUT_STRIPE);
      setIsLoading(false);
    };

    const runForUser = async (user: User | null) => {
      if (cancelled) return;

      if (!user) {
        // Auth settled signed-out — only place we force verified unpaid / basic.
        refreshGenRef.current += 1;
        applySignedOut();
        return;
      }

      // One generation for hydrate + Stripe resolve so neither can race the other.
      const gen = ++refreshGenRef.current;

      try {
        // Instant unlock from last known tier while Stripe confirms.
        const cached = await loadStoredSubscriptionTier();
        if (cancelled || gen !== refreshGenRef.current) return;
        setTier(cached);
        setPremiumAccessSync(isPremiumTier(cached));

        const resolved = await resolveSubscriptionTier();
        if (cancelled || gen !== refreshGenRef.current) return;
        setTier(resolved);
        setPremiumAccessSync(isPremiumTier(resolved));

        const status = await fetchStripeSubscriptionStatus();
        if (cancelled || gen !== refreshGenRef.current) return;
        if (status?.verified) {
          setStripeStatus(status);
        }
      } catch (error) {
        console.warn('[Subscription] refresh after auth change failed', error);
      } finally {
        // Always clear loading for this auth cycle. A newer cycle will re-enter as needed.
        if (!cancelled) setIsLoading(false);
      }
    };

    if (!auth || auth._isMock) {
      void (async () => {
        try {
          await refreshTier();
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // Wait for first onAuthStateChanged — never Stripe-check before Firebase restores.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void runForUser(user);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refreshTier]);

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        if (!auth?.currentUser) return;
        refreshTier({ retryIfUnpaid: true }).catch((error) => {
          console.warn('[Subscription] refresh on foreground failed', error);
        });
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [refreshTier]);

  const isPremium = isPremiumTier(tier);

  const presentUpgrade = useCallback(() => setUpgradeVisible(true), []);
  const dismissUpgrade = useCallback(() => setUpgradeVisible(false), []);

  const setDevPremiumOverride = useCallback(async (enabled: boolean) => {
    const next: SubscriptionTier = enabled ? 'premium' : 'basic';
    await saveSubscriptionTier(next);
    setTier(next);
    setPremiumAccessSync(enabled);
  }, []);

  const restorePurchases = useCallback(async () => {
    if (!auth?.currentUser && !(auth as { _isMock?: boolean } | null)?._isMock) {
      return;
    }
    await refreshTier();
  }, [refreshTier]);

  const manageBilling = useCallback(async () => {
    return openStripeBillingPortal();
  }, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      tier,
      isPremium,
      isLoading,
      basicFeatures: BASIC_FEATURES,
      premiumFeatures: PREMIUM_FEATURES,
      presentUpgrade,
      upgradeVisible,
      dismissUpgrade,
      setDevPremiumOverride,
      restorePurchases,
      stripeStatus,
      manageBilling,
    }),
    [
      tier,
      isPremium,
      isLoading,
      presentUpgrade,
      upgradeVisible,
      dismissUpgrade,
      setDevPremiumOverride,
      restorePurchases,
      stripeStatus,
      manageBilling,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <PremiumUpsellModal visible={upgradeVisible} onClose={dismissUpgrade} />
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}

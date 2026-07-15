import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
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

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<SubscriptionTier>('basic');
  const [isLoading, setIsLoading] = useState(true);
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeSubscriptionStatus | null>(null);

  const refreshTier = useCallback(async () => {
    const resolved = await resolveSubscriptionTier();
    setTier(resolved);
    setPremiumAccessSync(isPremiumTier(resolved));
    const status = await fetchStripeSubscriptionStatus();
    setStripeStatus(status);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refreshTier();
      if (mounted) setIsLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refreshTier]);

  useEffect(() => {
    if (!auth || auth._isMock) return undefined;
    const unsubscribe = onAuthStateChanged(auth, () => {
      refreshTier().catch((error) => {
        console.warn('[Subscription] refresh after auth change failed', error);
      });
    });
    return unsubscribe;
  }, [refreshTier]);

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refreshTier().catch((error) => {
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
  }, []);

  const restorePurchases = useCallback(async () => {
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

/**
 * Network connectivity — loads NetInfo only when the native module exists (avoids
 * NativeEventEmitter crashes when RNCNetInfo is missing or the web shim is bundled).
 */

import { NativeModules, Platform } from 'react-native';
import { useState, useEffect } from 'react';

type NetInfoModule = typeof import('@react-native-community/netinfo');

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

const DEFAULT_ONLINE: NetworkState = {
  isConnected: true,
  isInternetReachable: true,
  type: 'unknown',
};

function isNetInfoNativeLinked(): boolean {
  return Platform.OS !== 'web' && NativeModules.RNCNetInfo != null;
}

let netInfoLoadPromise: Promise<NetInfoModule | null> | null = null;

async function loadNetInfo(): Promise<NetInfoModule | null> {
  if (!isNetInfoNativeLinked()) {
    return null;
  }
  if (!netInfoLoadPromise) {
    netInfoLoadPromise = import('@react-native-community/netinfo').catch((error) => {
      console.warn('[Network] NetInfo module failed to load:', error);
      return null;
    });
  }
  return netInfoLoadPromise;
}

function stateFromNetInfo(state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string;
}): NetworkState {
  return {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable,
    type: state.type,
  };
}

/**
 * Treat "reachability unknown" (`null`) as online-enough to attempt Firebase.
 * On iOS, NetInfo often reports `isInternetReachable: false` briefly (esp. Simulator)
 * while HTTPS still works — requiring `=== true` caused false "auth/network-request-failed".
 */
function isLikelyOnline(state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): boolean {
  if (state.isConnected === false) return false;
  // Connected Wi‑Fi/cellular with unknown or temporarily-false reachability: try anyway.
  if (state.isConnected === true) return true;
  // isConnected null/unknown — only bail when reachability is explicitly false.
  if (state.isInternetReachable === false) return false;
  return true;
}

export const checkNetworkConnection = async (): Promise<boolean> => {
  try {
    const NetInfo = await loadNetInfo();
    if (!NetInfo) return true;
    const state = await NetInfo.fetch();
    return isLikelyOnline(state);
  } catch (error) {
    console.error('[Network] Error checking connection:', error);
    return true;
  }
};

export const getNetworkState = async (): Promise<NetworkState> => {
  try {
    const NetInfo = await loadNetInfo();
    if (!NetInfo) return DEFAULT_ONLINE;
    const state = await NetInfo.fetch();
    return stateFromNetInfo(state);
  } catch (error) {
    console.error('[Network] Error getting network state:', error);
    return {
      isConnected: false,
      isInternetReachable: false,
      type: 'unknown',
    };
  }
};

export const useNetworkStatus = () => {
  const [networkState, setNetworkState] = useState<NetworkState>(DEFAULT_ONLINE);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const NetInfo = await loadNetInfo();
      if (cancelled) return;

      if (!NetInfo) {
        setNetworkState(DEFAULT_ONLINE);
        return;
      }

      try {
        const initial = await NetInfo.fetch();
        if (!cancelled) {
          setNetworkState(stateFromNetInfo(initial));
        }
      } catch (error) {
        console.warn('[Network] Initial fetch failed:', error);
      }

      try {
        unsubscribe = NetInfo.addEventListener((state) => {
          setNetworkState(stateFromNetInfo(state));
          console.log('[Network] Connection state changed:', {
            isConnected: state.isConnected,
            isInternetReachable: state.isInternetReachable,
            type: state.type,
          });
        });
      } catch (error) {
        console.warn('[Network] Could not subscribe to NetInfo events:', error);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return {
    ...networkState,
    isOnline: isLikelyOnline(networkState),
  };
};

export const waitForConnection = async (timeout: number = 10000): Promise<boolean> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const isConnected = await checkNetworkConnection();
    if (isConnected) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
};

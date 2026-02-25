/**
 * Network Connectivity Utilities
 * 
 * Provides network status checking and offline handling
 */

import NetInfo from '@react-native-community/netinfo';
import { useState, useEffect } from 'react';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

/**
 * Check if device is currently connected to the internet
 */
export const checkNetworkConnection = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable === true;
  } catch (error) {
    console.error('[Network] Error checking connection:', error);
    // Assume connected if check fails (graceful degradation)
    return true;
  }
};

/**
 * Get detailed network state
 */
export const getNetworkState = async (): Promise<NetworkState> => {
  try {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    };
  } catch (error) {
    console.error('[Network] Error getting network state:', error);
    return {
      isConnected: false,
      isInternetReachable: false,
      type: 'unknown',
    };
  }
};

/**
 * React hook to monitor network connectivity
 * Returns current network state and connection status
 */
export const useNetworkStatus = () => {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
  });

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then((state) => {
      setNetworkState({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkState({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
      
      console.log('[Network] Connection state changed:', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    ...networkState,
    isOnline: networkState.isConnected && networkState.isInternetReachable === true,
  };
};

/**
 * Wait for internet connection with timeout
 * Useful for operations that require internet (like Firebase Auth)
 */
export const waitForConnection = async (
  timeout: number = 10000
): Promise<boolean> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const isConnected = await checkNetworkConnection();
    if (isConnected) {
      return true;
    }
    // Wait 500ms before checking again
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  
  return false;
};







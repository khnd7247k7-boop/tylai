import Constants from 'expo-constants';

/** Expo Go store client: no project-specific native code and no optional native modules like expo-health. */
export function isRunningInExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

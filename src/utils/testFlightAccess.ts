import { NativeModules, Platform } from 'react-native';

type TestFlightBridgeModule = {
  isTestFlightInstall: () => Promise<boolean>;
};

export async function isTestFlightInstall(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const bridge = NativeModules.TestFlightBridge as TestFlightBridgeModule | undefined;
    if (!bridge?.isTestFlightInstall) return false;
    return await bridge.isTestFlightInstall();
  } catch {
    return false;
  }
}

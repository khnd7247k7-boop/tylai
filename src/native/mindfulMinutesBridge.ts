import { NativeModules, Platform } from 'react-native';
import { isRunningInExpoGo } from '../utils/expoGo';

type NativeBridge = {
  fetchMindfulMinutesForDate?: (dateMs: number) => Promise<number>;
};

/**
 * iOS only: reads aggregate mindful-session minutes for the local calendar day of `date`
 * via native HealthKit (no raw samples in JS).
 */
export async function fetchMindfulMinutesForDateNative(date: Date): Promise<number | null> {
  if (Platform.OS !== 'ios') return null;
  if (isRunningInExpoGo()) return null;
  const mod = NativeModules.MindfulMinutesBridge as NativeBridge | undefined;
  if (!mod?.fetchMindfulMinutesForDate) return null;
  try {
    const minutes = await mod.fetchMindfulMinutesForDate(date.getTime());
    if (typeof minutes !== 'number' || Number.isNaN(minutes)) return null;
    return Math.max(0, minutes);
  } catch {
    return null;
  }
}

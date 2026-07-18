import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { isRunningInExpoGo } from '../utils/expoGo';

type MediaLibraryApi = typeof import('expo-media-library');

let cachedApi: MediaLibraryApi | null | undefined;

/** True when the ExpoMediaLibrary native module is compiled into this app binary. */
export function isMediaLibraryAvailable(): boolean {
  if (Platform.OS === 'web' || isRunningInExpoGo()) return false;
  return requireOptionalNativeModule('ExpoMediaLibrary') != null;
}

async function getMediaLibraryApi(): Promise<MediaLibraryApi | null> {
  if (!isMediaLibraryAvailable()) return null;
  if (cachedApi !== undefined) return cachedApi;
  try {
    cachedApi = await import('expo-media-library');
    return cachedApi;
  } catch (error) {
    console.warn('[mediaLibraryBridge] JS module load failed', error);
    cachedApi = null;
    return null;
  }
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  const MediaLibrary = await getMediaLibraryApi();
  if (!MediaLibrary) return false;
  try {
    // writeOnly=true → only needs NSPhotoLibraryAddUsageDescription (save to camera roll).
    const existing = await MediaLibrary.getPermissionsAsync(true);
    if (existing.granted || existing.status === 'granted') return true;
    const requested = await MediaLibrary.requestPermissionsAsync(true);
    return Boolean(requested.granted || requested.status === 'granted');
  } catch (error) {
    console.warn('[mediaLibraryBridge] permission request failed', error);
    return false;
  }
}

export async function saveUrisToMediaLibrary(uris: string[]): Promise<boolean> {
  if (!uris.length) return false;
  const MediaLibrary = await getMediaLibraryApi();
  if (!MediaLibrary) return false;

  const granted = await requestMediaLibraryPermission();
  if (!granted) return false;

  try {
    for (const uri of uris) {
      if (!uri) continue;
      await MediaLibrary.saveToLibraryAsync(uri);
    }
    return true;
  } catch (error) {
    console.warn('[mediaLibraryBridge] save failed', error);
    return false;
  }
}

export function mediaLibraryUnavailableMessage(): string {
  if (isRunningInExpoGo()) {
    return 'Camera roll backup requires the TYLAI dev or TestFlight build, not Expo Go.';
  }
  return 'Camera roll backup needs a fresh native rebuild after updating the app. Run: npx expo run:ios';
}

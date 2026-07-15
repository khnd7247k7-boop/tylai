/**
 * Save progress photos to the device camera roll (optional user preference).
 */

import { Platform } from 'react-native';
import { loadProgressPhotoSettings } from '../utils/progressPhotoSettings';
import {
  isMediaLibraryAvailable,
  requestMediaLibraryPermission,
  saveUrisToMediaLibrary,
  mediaLibraryUnavailableMessage,
} from '../native/mediaLibraryBridge';

export { isMediaLibraryAvailable, mediaLibraryUnavailableMessage };

export async function requestCameraRollPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || !isMediaLibraryAvailable()) return false;
  return requestMediaLibraryPermission();
}

export async function savePhotosToCameraRoll(uris: string[]): Promise<void> {
  if (Platform.OS === 'web' || !uris.length || !isMediaLibraryAvailable()) return;
  await saveUrisToMediaLibrary(uris);
}

export async function saveSessionPhotosIfEnabled(photoUris: string[]): Promise<void> {
  const settings = await loadProgressPhotoSettings();
  if (!settings.saveToCameraRoll) return;
  await savePhotosToCameraRoll(photoUris);
}

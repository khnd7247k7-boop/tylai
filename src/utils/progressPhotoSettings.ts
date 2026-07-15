import { loadUserData, saveUserData } from './userStorage';

export interface ProgressPhotoSettings {
  /** When true, progress photos are copied to the device camera roll after capture. */
  saveToCameraRoll: boolean;
  /** Whether the first-open camera roll prompt has been shown for this user. */
  cameraRollPromptSeen: boolean;
}

export const DEFAULT_PROGRESS_PHOTO_SETTINGS: ProgressPhotoSettings = {
  saveToCameraRoll: false,
  cameraRollPromptSeen: false,
};

const STORAGE_KEY = 'progressPhotoSettings';

export async function loadProgressPhotoSettings(): Promise<ProgressPhotoSettings> {
  const raw = await loadUserData<Partial<ProgressPhotoSettings>>(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_PROGRESS_PHOTO_SETTINGS };
  return {
    saveToCameraRoll: raw.saveToCameraRoll === true,
    cameraRollPromptSeen: raw.cameraRollPromptSeen === true,
  };
}

export async function saveProgressPhotoSettings(
  settings: ProgressPhotoSettings
): Promise<void> {
  await saveUserData(STORAGE_KEY, settings);
}

export async function setSaveToCameraRoll(enabled: boolean): Promise<ProgressPhotoSettings> {
  const current = await loadProgressPhotoSettings();
  const next: ProgressPhotoSettings = {
    ...current,
    saveToCameraRoll: enabled,
    cameraRollPromptSeen: true,
  };
  await saveProgressPhotoSettings(next);
  return next;
}

export async function markCameraRollPromptSeen(
  saveToCameraRoll: boolean
): Promise<ProgressPhotoSettings> {
  const next: ProgressPhotoSettings = {
    saveToCameraRoll,
    cameraRollPromptSeen: true,
  };
  await saveProgressPhotoSettings(next);
  return next;
}

/** Pose captured in a weekly progress photo session. */
export type PhotoPose = 'front' | 'side' | 'back';

export const PHOTO_POSES: PhotoPose[] = ['front', 'side', 'back'];

/** Partial on purpose — users may skip side (or any pose). */
export interface PhotoSessionPhotos {
  front?: string;
  side?: string;
  back?: string;
}

/**
 * One progress photo session (typically one per week).
 * `metadata` reserved for future fields (weight, notes, body fat %, etc.).
 */
export interface PhotoSession {
  id: string;
  /** Local calendar date YYYY-MM-DD */
  date: string;
  /** ISO timestamp when the session was completed */
  timestamp: string;
  photos: PhotoSessionPhotos;
  metadata?: Record<string, unknown>;
}

export type ProgressPhotoButtonState = 'take' | 'view' | 'retake';

export interface ProgressPhotoStats {
  lastPhotoDate: string | null;
  nextRecommendedDate: string | null;
  weeklyStreak: number;
  hasSessionToday: boolean;
  buttonState: ProgressPhotoButtonState;
  buttonLabel: string;
}

export const PHOTO_POSE_LABELS: Record<PhotoPose, string> = {
  front: 'Front',
  side: 'Side',
  back: 'Back',
};

export const PHOTO_POSE_INSTRUCTIONS: Record<PhotoPose, string> = {
  front: 'Face the camera, arms relaxed at your sides, feet shoulder-width apart.',
  side: 'Turn 90° to your right. Keep arms slightly away from your body.',
  back: 'Turn away from the camera. Stand tall with arms at your sides.',
};

export function isPhotoUri(uri: string | null | undefined): uri is string {
  return typeof uri === 'string' && uri.trim().length > 0;
}

/** Poses that actually have a photo — never invent blank slots. */
export function availablePoses(
  photos: PhotoSessionPhotos | Partial<Record<PhotoPose, string>> | null | undefined
): PhotoPose[] {
  if (!photos) return [];
  return PHOTO_POSES.filter((pose) => isPhotoUri(photos[pose]));
}

export function firstAvailablePose(
  photos: PhotoSessionPhotos | Partial<Record<PhotoPose, string>> | null | undefined,
  preferred?: PhotoPose
): PhotoPose {
  const poses = availablePoses(photos);
  if (preferred && poses.includes(preferred)) return preferred;
  return poses[0] ?? 'front';
}

export function hasAnyProgressPhoto(
  photos: PhotoSessionPhotos | Partial<Record<PhotoPose, string>> | null | undefined
): boolean {
  return availablePoses(photos).length > 0;
}

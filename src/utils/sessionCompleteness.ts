import type { PhotoSession } from '../types/progressPhotos';
import type { SessionProgressMetrics } from '../types/sessionProgressMetrics';

export type CompletenessKey = 'photos' | 'weight' | 'measurements' | 'reflection' | 'recovery';

export interface SessionCompleteness {
  photos: boolean;
  weight: boolean;
  measurements: boolean;
  reflection: boolean;
  recovery: boolean;
  /** 0–1 fill for progress ring. */
  ratio: number;
  completedCount: number;
  total: number;
}

export function computeSessionCompleteness(
  session: PhotoSession,
  metrics: SessionProgressMetrics | null | undefined,
  opts?: { hasReflection?: boolean }
): SessionCompleteness {
  const photos = !!(session.photos?.front && session.photos?.side && session.photos?.back);
  const weight = metrics?.weight.status === 'available';
  const measurements = metrics?.measurements.status === 'available';
  const reflection = opts?.hasReflection === true;
  const recovery = metrics?.recovery.status === 'available';

  const flags = { photos, weight, measurements, reflection, recovery };
  const completedCount = Object.values(flags).filter(Boolean).length;
  const total = 5;
  return {
    ...flags,
    completedCount,
    total,
    ratio: completedCount / total,
  };
}

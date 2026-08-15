/**
 * Lightweight helpers for progress photo loading UX.
 * Compression at capture time remains quality-based in PhotoCaptureFlow;
 * this module centralizes future cache/compress hooks.
 */

const uriWarmCache = new Set<string>();

export function warmImageUri(uri: string | null | undefined): void {
  if (!uri || uriWarmCache.has(uri)) return;
  uriWarmCache.add(uri);
  // Prefetch is best-effort; RN Image.prefetch may fail for file:// on some platforms.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Image } = require('react-native');
    if (typeof Image.prefetch === 'function') {
      void Image.prefetch(uri).catch(() => undefined);
    }
  } catch {
    // ignore
  }
}

export function warmSessionPhotos(photos: {
  front?: string;
  side?: string;
  back?: string;
}): void {
  warmImageUri(photos.front);
  warmImageUri(photos.side);
  warmImageUri(photos.back);
}

/** Suggested JPEG quality for progress capture (already used by camera). */
export const PROGRESS_PHOTO_CAPTURE_QUALITY = 0.72;

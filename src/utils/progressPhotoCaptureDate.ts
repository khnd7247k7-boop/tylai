/**
 * Resolve when a progress photo was taken (EXIF → MediaLibrary → fallback)
 * so library imports land on the correct timeline day.
 */
import type { ImagePickerAsset } from 'expo-image-picker';
import { toProgressPhotoLocalDateKey } from '../services/PhotoService';

export type PhotoCaptureTimeSource = 'exif' | 'mediaLibrary' | 'fallback';

export type ResolvedPhotoCaptureTime = {
  dateKey: string;
  timestampIso: string;
  source: PhotoCaptureTimeSource;
};

function clampNotFuture(d: Date): Date {
  const now = new Date();
  return d.getTime() > now.getTime() ? now : d;
}

/** Parse EXIF DateTimeOriginal-style strings: "2024:08:05 14:30:00". */
export function parseExifDateTime(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(
    /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
  );
  if (match) {
    const [, y, mo, d, h, mi, s] = match;
    const date = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s)
    );
    return Number.isNaN(date.getTime()) ? null : clampNotFuture(date);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : clampNotFuture(parsed);
}

export function dateFromExif(exif: Record<string, unknown> | null | undefined): Date | null {
  if (!exif) return null;
  return (
    parseExifDateTime(exif.DateTimeOriginal) ||
    parseExifDateTime(exif.DateTimeDigitized) ||
    parseExifDateTime(exif.CreateDate) ||
    parseExifDateTime(exif.DateTime) ||
    null
  );
}

function toResolved(d: Date, source: PhotoCaptureTimeSource): ResolvedPhotoCaptureTime {
  const safe = clampNotFuture(d);
  return {
    dateKey: toProgressPhotoLocalDateKey(safe),
    timestampIso: safe.toISOString(),
    source,
  };
}

/**
 * Best-effort capture time for one library asset.
 * Prefer EXIF DateTimeOriginal; then MediaLibrary creationTime; else now.
 */
export async function resolveAssetCaptureDate(
  asset: Pick<ImagePickerAsset, 'uri' | 'assetId' | 'exif'>
): Promise<ResolvedPhotoCaptureTime> {
  const fromExif = dateFromExif(asset.exif ?? null);
  if (fromExif) return toResolved(fromExif, 'exif');

  if (asset.assetId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const MediaLibrary = require('expo-media-library') as {
        getAssetInfoAsync: (id: string) => Promise<{ creationTime?: number; modificationTime?: number }>;
      };
      const info = await MediaLibrary.getAssetInfoAsync(asset.assetId);
      const ms = info?.creationTime || info?.modificationTime;
      if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) {
        return toResolved(new Date(ms), 'mediaLibrary');
      }
    } catch {
      /* limited permission or missing native module */
    }
  }

  return toResolved(new Date(), 'fallback');
}

/**
 * Pick one session date from three pose timestamps.
 * Uses the earliest non-fallback capture time (falls back to "now" only if none found).
 */
export function resolveSessionDateFromCaptures(
  resolved: ResolvedPhotoCaptureTime[]
): ResolvedPhotoCaptureTime {
  if (!resolved.length) return toResolved(new Date(), 'fallback');
  const preferred = resolved.filter((r) => r.source !== 'fallback');
  const pool = preferred.length > 0 ? preferred : resolved;
  return [...pool].sort((a, b) => a.timestampIso.localeCompare(b.timestampIso))[0];
}

export function uniqueCaptureDateKeys(resolved: ResolvedPhotoCaptureTime[]): string[] {
  return [...new Set(resolved.map((r) => r.dateKey))];
}

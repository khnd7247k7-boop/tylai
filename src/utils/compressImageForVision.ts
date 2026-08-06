/**
 * Client-side downscale + JPEG compress before multimodal vision uploads.
 */
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export type CompressedVisionImage = {
  uri: string;
  base64: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
};

const DEFAULT_MAX_WIDTH = 1920;
const DEFAULT_QUALITY = 0.82;

/**
 * Resize so the longest edge is ≤ maxWidth, then JPEG-encode with base64.
 */
export async function compressImageForVision(
  uri: string,
  opts?: { maxWidth?: number; quality?: number }
): Promise<CompressedVisionImage> {
  const maxWidth = opts?.maxWidth ?? DEFAULT_MAX_WIDTH;
  const quality = opts?.quality ?? DEFAULT_QUALITY;

  const result = await manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    {
      compress: quality,
      format: SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!result.base64?.trim()) {
    throw new Error('Could not compress image for upload.');
  }

  return {
    uri: result.uri,
    base64: result.base64,
    mimeType: 'image/jpeg',
    width: result.width,
    height: result.height,
  };
}

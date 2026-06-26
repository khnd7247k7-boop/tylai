import type { View } from 'react-native';
import type { HighlightRect } from './types';

const registry = new Map<string, View>();
const scrollIntoViewHandlers = new Map<string, () => void | Promise<void>>();

export function registerTourTarget(id: string, node: View | null): void {
  if (node) registry.set(id, node);
  else registry.delete(id);
}

/** Optional scroll-into-view before measuring (e.g. targets inside Log Food modal). */
export function registerTourTargetScroll(id: string, handler: (() => void | Promise<void>) | null): void {
  if (handler) scrollIntoViewHandlers.set(id, handler);
  else scrollIntoViewHandlers.delete(id);
}

export async function scrollTourTargetIntoView(id: string): Promise<void> {
  const handler = scrollIntoViewHandlers.get(id);
  if (handler) await handler();
}

export function measureTourTarget(id: string): Promise<HighlightRect | null> {
  const node = registry.get(id);
  if (!node || typeof node.measureInWindow !== 'function') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) resolve(null);
      else resolve({ top: y, left: x, width, height });
    });
  });
}

export async function waitForTourTarget(
  id: string,
  pollMs = 100,
  maxAttempts = 55
): Promise<HighlightRect | null> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const rect = await measureTourTarget(id);
    if (rect) return rect;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return null;
}

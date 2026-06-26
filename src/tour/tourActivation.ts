type TourActivationListener = (targetId: string) => void;

const listeners = new Set<TourActivationListener>();

/** Strip `#` prefix from a tour selector to get the nativeID / target id. */
export function tourTargetIdFromSelector(selector?: string): string | null {
  if (!selector) return null;
  return selector.startsWith('#') ? selector.slice(1) : selector;
}

export function notifyTourTargetActivated(targetId: string): void {
  listeners.forEach((listener) => listener(targetId));
}

export function subscribeTourTargetActivation(listener: TourActivationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

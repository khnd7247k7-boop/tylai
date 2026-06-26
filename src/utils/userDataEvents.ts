type UserDataReadyListener = () => void;

const listeners = new Set<UserDataReadyListener>();

/** Subscribe to auth + local data init (login, recovery). Returns unsubscribe. */
export function subscribeUserDataReady(listener: UserDataReadyListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyUserDataReady(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.warn('[userDataEvents] listener error', e);
    }
  }
}

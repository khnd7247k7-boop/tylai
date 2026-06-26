import type { FirebaseApp } from 'firebase/app';

export const firebaseEnvConfigured: boolean;

export const app: FirebaseApp | null;

/** Firebase `Auth` or fallback mock from `firebaseConfig.js` when init fails */
export const auth: any;

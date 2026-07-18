import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';

export const firebaseEnvConfigured: boolean;

export const app: FirebaseApp | null;

/** Firebase `Auth` or fallback mock from `firebaseConfig.js` when init fails */
export const auth: any;

/** Firestore instance, or null when Firebase is not configured / failed to init */
export const db: Firestore | null;

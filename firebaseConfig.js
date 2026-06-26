import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

function trimEnv(value) {
  return value != null && String(value).trim() ? String(value).trim() : '';
}

// Expo inlines only *static* process.env.EXPO_PUBLIC_* (not process.env[name]).
// See https://docs.expo.dev/guides/environment-variables/
const firebaseConfig = {
  apiKey: trimEnv(process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain: trimEnv(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: trimEnv(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: trimEnv(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: trimEnv(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: trimEnv(process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
};

const missingFirebaseEnv = [
  !firebaseConfig.apiKey && 'EXPO_PUBLIC_FIREBASE_API_KEY',
  !firebaseConfig.authDomain && 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  !firebaseConfig.projectId && 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  !firebaseConfig.storageBucket && 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  !firebaseConfig.messagingSenderId && 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  !firebaseConfig.appId && 'EXPO_PUBLIC_FIREBASE_APP_ID',
].filter(Boolean);

export const firebaseEnvConfigured = missingFirebaseEnv.length === 0;

if (!firebaseEnvConfigured) {
  console.error(
    `[Firebase] Missing required env: ${missingFirebaseEnv.join(', ')}. ` +
      'Set them in .env/.env.local at the project root, then run: npx expo start --clear'
  );
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  // Safe sanity check: confirms which project the bundle loaded (not the secret key).
  console.log(
    '[Firebase] Env-loaded Web config — projectId:',
    firebaseConfig.projectId,
    'authDomain:',
    firebaseConfig.authDomain
  );
}

// Initialize Firebase (only if not already initialized)
let app;
try {
  if (!firebaseEnvConfigured) {
    app = null;
  } else if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log('[Firebase] App initialized successfully');
  } else {
    app = getApps()[0];
    console.log('[Firebase] Using existing app instance');
  }
} catch (error) {
  console.error('[Firebase] Error initializing Firebase app:', error);
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    console.log('[Firebase] Recovered existing app instance');
  } else {
    console.error('[Firebase] CRITICAL: No Firebase app available');
    app = null;
  }
}

function createAuthInstance() {
  if (!app) {
    throw new Error('Firebase app is not initialized');
  }
  try {
    if (Platform.OS === 'web') {
      return initializeAuth(app, {
        persistence: browserLocalPersistence,
      });
    }
    const { getReactNativePersistence } = require('firebase/auth');
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    if (e && e.code === 'auth/already-initialized') {
      return getAuth(app);
    }
    throw e;
  }
}

// Initialize Auth (persist session on native via AsyncStorage; web uses local persistence)
let auth;
try {
  if (!app) {
    throw new Error('Firebase app is not initialized');
  }
  auth = createAuthInstance();

  const initTime = new Date();
  console.log('[Firebase] Initialized at:', initTime.toISOString());
  console.log('[Firebase] System timestamp:', Date.now());
  console.log('[Firebase] UTC time:', initTime.toUTCString());
  console.log('[Firebase] Timezone offset:', initTime.getTimezoneOffset(), 'minutes');
  console.log('[Firebase] Local time string:', initTime.toString());

  auth.languageCode = 'en';
} catch (error) {
  console.error('Error initializing Firebase Auth:', error);
  const errorTime = new Date();
  console.error('[Firebase] Error occurred at:', errorTime.toISOString());
  console.error('[Firebase] System timestamp:', Date.now());
  console.error('[Firebase] UTC time:', errorTime.toUTCString());
  console.error('[Firebase] Timezone offset:', errorTime.getTimezoneOffset(), 'minutes');

  console.error('[Firebase] WARNING: Using mock auth object. Firebase Auth is not working properly.');
  auth = {
    currentUser: null,
    onAuthStateChanged: () => () => {},
    signOut: async () => {},
    _isMock: true,
  };
}

export { auth };

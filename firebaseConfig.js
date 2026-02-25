import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBWEggSHbP-3ynie4WhF82rYs3xq_JH0vg",
  authDomain: "tyl-ai-coach-78ac7.firebaseapp.com",
  projectId: "tyl-ai-coach-78ac7",
  storageBucket: "tyl-ai-coach-78ac7.firebasestorage.app",
  messagingSenderId: "775616354831",
  appId: "1:775616354831:web:ab286d3f21de50f0e2a17a"
};

// Initialize Firebase (only if not already initialized)
let app;
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log('[Firebase] App initialized successfully');
  } else {
    app = getApps()[0];
    console.log('[Firebase] Using existing app instance');
  }
} catch (error) {
  console.error('[Firebase] Error initializing Firebase app:', error);
  // Try to get existing app
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    console.log('[Firebase] Recovered existing app instance');
  } else {
    console.error('[Firebase] CRITICAL: No Firebase app available');
    app = null;
  }
}

// Initialize Auth
let auth;
try {
  if (!app) {
    throw new Error('Firebase app is not initialized');
  }
  auth = getAuth(app);
  
  // Log detailed time information to help diagnose time sync issues
  const initTime = new Date();
  console.log('[Firebase] Initialized at:', initTime.toISOString());
  console.log('[Firebase] System timestamp:', Date.now());
  console.log('[Firebase] UTC time:', initTime.toUTCString());
  console.log('[Firebase] Timezone offset:', initTime.getTimezoneOffset(), 'minutes');
  console.log('[Firebase] Local time string:', initTime.toString());
  
  // Set auth language if needed (helps with error messages)
  auth.languageCode = 'en';
  
} catch (error) {
  console.error('Error initializing Firebase Auth:', error);
  // Log time information for debugging
  const errorTime = new Date();
  console.error('[Firebase] Error occurred at:', errorTime.toISOString());
  console.error('[Firebase] System timestamp:', Date.now());
  console.error('[Firebase] UTC time:', errorTime.toUTCString());
  console.error('[Firebase] Timezone offset:', errorTime.getTimezoneOffset(), 'minutes');
  
  // Create a mock auth object to prevent crashes
  // But log a warning so we know Firebase isn't working
  console.error('[Firebase] WARNING: Using mock auth object. Firebase Auth is not working properly.');
  auth = {
    currentUser: null,
    onAuthStateChanged: () => () => {},
    signOut: async () => {},
    // Add these so the app can detect it's a mock
    _isMock: true,
  };
}

export { auth }; 
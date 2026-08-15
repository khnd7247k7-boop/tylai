import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  SafeAreaView,
  Modal,
  AppState,
  Keyboard,
  Platform,
} from 'react-native';
import { AppTextInput as TextInput } from './src/components/AppTextInput';
import { StatusBar } from 'expo-status-bar';
import Dashboard from './Dashboard';
import WorkoutScreen from './WorkoutScreen';
import FitnessScreen from './FitnessScreen';
import MentalScreen from './MentalScreen';
import ProgressScreen from './ProgressScreen';
import EmotionalScreen from './EmotionalScreen';
import AIComponent from './AIComponent';
import SettingsScreen from './SettingsScreen';
import SpiritualScreen from './SpiritualScreen';
import HealthScreen, { type TrendGraphId } from './HealthScreen';
import AppleHealthDataScreen from './AppleHealthDataScreen';
import MovementIntelligenceScreen from './MovementIntelligenceScreen';
import SwipeNavigation from './SwipeNavigation';
import SmoothTransition from './SmoothTransition';
import { ToastProvider } from './src/components/ToastProvider';
import { useToast } from './src/components/ToastProvider';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { updateNotificationSchedule, requestNotificationPermissions } from './src/utils/notifications';
import { auth } from './firebaseConfig';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import UserDataInitializer from './src/services/UserDataInitializer';
import { useNetworkStatus, checkNetworkConnection } from './src/utils/networkUtils';
import HealthService from './src/services/HealthService';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import MainBottomTabBar, { MainBottomTabId, MAIN_TAB_BAR_CHROME_HEIGHT } from './MainBottomTabBar';
import MoreMenuScreen from './MoreMenuScreen';
import NutritionSearchScreen from './NutritionSearchScreen';
import { AppTheme } from './src/theme/appVisualTheme';
import { getStayLoggedInPreference, setStayLoggedInPreference } from './src/utils/stayLoggedIn';
import { markMindsetCheckInComplete } from './src/utils/mindsetCheckIn';
import {
  clearSavedLoginCredentials,
  getRememberPasswordPreference,
  loadSavedLoginCredentials,
  saveLoginCredentials,
  setRememberPasswordPreference,
} from './src/utils/rememberPassword';
import {
  KeyboardInsetsProvider,
  KeyboardSafeView,
  KeyboardModalFrame,
  DismissKeyboardSurface,
} from './src/keyboard';
import { SmallWinsProvider } from './src/context/SmallWinsContext';
import { ActiveWorkoutProvider, useActiveWorkout } from './src/context/ActiveWorkoutContext';
import MedicalDisclaimerGate, {
  MEDICAL_DISCLAIMER_DEVICE_KEY,
} from './src/components/MedicalDisclaimerGate';
import OnboardingWizard from './src/components/onboarding/OnboardingWizard';
import NutritionQuestionnaireWizard from './src/components/onboarding/NutritionQuestionnaireWizard';
import AdvancedNutritionQuestionnaireWizard from './src/components/onboarding/AdvancedNutritionQuestionnaireWizard';
import NutritionBodyProfilePrompt from './src/components/NutritionBodyProfilePrompt';
import type { TourFitnessIntent, TourLogFoodIntent } from './src/tour/types';
import { shouldShowOnboardingWizard, isPendingFirstWorkoutPlan, shouldShowNutritionBodyProfilePrompt, loadCoachingProfile } from './src/services/CoachingProfileService';
import {
  isInitialNutritionSetupComplete,
  shouldLaunchAdvancedNutritionQuestionnaire,
  type NutritionPreferencesProfile,
} from './src/types/nutritionQuestionnaire';
import {
  applyPendingNutritionSuggestion,
  dismissPendingNutritionSuggestion,
  formatNutritionSuggestionSummary,
  loadPendingNutritionSuggestion,
  type PendingNutritionSuggestion,
} from './src/services/NutritionSuggestionService';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import AppBootScreen from './src/components/AppBootScreen';
import { SettingsProvider } from './SettingsProvider';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { firebaseEnvConfigured } from './firebaseConfig';

type LoggedInScreen =
  | 'dashboard'
  | 'workout'
  | 'fitness'
  | 'mental'
  | 'progress'
  | 'emotional'
  | 'ai'
  | 'settings'
  | 'spiritual'
  | 'health'
  | 'appleHealthData'
  | 'nutritionSearch'
  | 'moreHub'
  | 'movementIntelligence';

/** Screens reachable from the More menu — back / task-complete should return to moreHub when opened from there. */
const MORE_MENU_CHILD_SCREENS: LoggedInScreen[] = [
  'settings',
  'health',
  'appleHealthData',
  'spiritual',
  'emotional',
  'mental',
  'workout',
  'nutritionSearch',
  'movementIntelligence',
];

function AppInner() {
  const insets = useSafeAreaInsets();
  const { showToast, showNotification, dismissNotification } = useToast();
  const { isOnline } = useNetworkStatus(); // Monitor network connectivity
  const { activeWorkout, presentActiveWorkout } = useActiveWorkout();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'login' | LoggedInScreen>('login');
  const [navigationHistory, setNavigationHistory] = useState<Array<'login' | LoggedInScreen>>(['login']);
  const [fitnessSyncedTab, setFitnessSyncedTab] = useState<'workouts' | 'nutrition' | 'history'>('workouts');
  const [healthInitialTrendGraph, setHealthInitialTrendGraph] = useState<TrendGraphId | undefined>();
  /** Bumps whenever we intend to show Fitness root (clears nested plan/workout overlays inside FitnessScreen). */
  const [fitnessSurfaceNonce, setFitnessSurfaceNonce] = useState(0);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMethod, setResetMethod] = useState<'email' | null>(null);
  const [medicalDisclaimerGate, setMedicalDisclaimerGate] = useState(false);
  const [medicalDisclaimerResolved, setMedicalDisclaimerResolved] = useState(false);
  const [onboardingWizardVisible, setOnboardingWizardVisible] = useState(false);
  const [onboardingWizardMode, setOnboardingWizardMode] = useState<'onboarding' | 'edit'>('onboarding');
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'profile' | 'interface' | 'settings' | 'legal'
  >('profile');
  const onboardingWizardUserOpenedRef = useRef(false);
  const [onboardingGateResolved, setOnboardingGateResolved] = useState(false);
  const [initialPlanSetupPending, setInitialPlanSetupPending] = useState(false);
  const [nutritionBodyPromptVisible, setNutritionBodyPromptVisible] = useState(false);
  const [nutritionQuestionnaireVisible, setNutritionQuestionnaireVisible] = useState(false);
  const [advancedNutritionQuestionnaireVisible, setAdvancedNutritionQuestionnaireVisible] =
    useState(false);
  const [pendingNutritionSuggestion, setPendingNutritionSuggestion] =
    useState<PendingNutritionSuggestion | null>(null);
  const [tourLogFoodIntent, setTourLogFoodIntent] = useState<TourLogFoodIntent | null>(null);
  const [tourFitnessIntent, setTourFitnessIntent] = useState<TourFitnessIntent | null>(null);
  const nutritionNoticeIdRef = useRef<string | null>(null);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [authBootstrapped, setAuthBootstrapped] = useState(false);
  /** True when the current sub-screen was opened from MoreMenuScreen (not dashboard shortcuts). */
  const openedFromMoreMenuRef = useRef(false);

  // User data for AI analysis
  const [userData, setUserData] = useState({
    moodEntries: [],
    workoutHistory: [],
    mentalExercises: [],
    nutritionData: {
      dailyMeals: [],
      goals: { calories: 2000, protein: 150, carbs: 250, fat: 80 }
    },
    completedTasks: []
  });

  // Notifications need native modules; run after sign-in when user storage is available
  useEffect(() => {
    if (!isLoggedIn) return;
    const initializeNotifications = async () => {
      try {
        await requestNotificationPermissions();
        const { registerExpoPushToken } = await import('./src/utils/pushTokenRegistration');
        await registerExpoPushToken();
        const {
          loadSmartNotificationPrefs,
          shouldSuppressLegacyDailyReminder,
        } = await import('./src/services/notificationPrefsService');
        const smartPrefs = await loadSmartNotificationPrefs();
        if (shouldSuppressLegacyDailyReminder(smartPrefs)) {
          const { cancelAllNotifications } = await import('./src/utils/notifications');
          await cancelAllNotifications();
        } else {
          await updateNotificationSchedule();
        }
      } catch (e) {
        console.warn('[App] Notification setup skipped:', e);
      }
    };
    initializeNotifications();
  }, [isLoggedIn]);

  // Smart notification deep links — registered after navigatePrimaryTab exists (below).
  const smartNavRef = useRef<(target: string) => void>(() => {});

  useEffect(() => {
    if (!isLoggedIn) {
      setMedicalDisclaimerGate(false);
      setMedicalDisclaimerResolved(false);
      setOnboardingWizardVisible(false);
      onboardingWizardUserOpenedRef.current = false;
      setOnboardingGateResolved(false);
      setInitialPlanSetupPending(false);
      setNutritionBodyPromptVisible(false);
      setPendingNutritionSuggestion(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const { loadUserData } = await import('./src/utils/userStorage');
        const acceptedUser = await loadUserData<boolean>('onboardingMedicalDisclaimerAccepted');
        const acceptedDevice =
          (await AsyncStorage.getItem(MEDICAL_DISCLAIMER_DEVICE_KEY)) === 'true';
        if (!cancelled && acceptedUser !== true && !acceptedDevice) {
          setMedicalDisclaimerGate(true);
        } else if (!cancelled) {
          setMedicalDisclaimerGate(false);
        }
      } catch {
        if (!cancelled) setMedicalDisclaimerGate(true);
      } finally {
        if (!cancelled) setMedicalDisclaimerResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !medicalDisclaimerResolved || medicalDisclaimerGate) {
      setOnboardingGateResolved(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const show = await shouldShowOnboardingWizard();
        if (cancelled) return;
        if (show) {
          setOnboardingWizardMode('onboarding');
          onboardingWizardUserOpenedRef.current = false;
          setOnboardingWizardVisible(true);
        } else if (!onboardingWizardUserOpenedRef.current) {
          setOnboardingWizardVisible(false);
        }
        const pendingPlan = await isPendingFirstWorkoutPlan();
        if (!cancelled) {
          setInitialPlanSetupPending(pendingPlan);
          if (pendingPlan && !show) {
            setCurrentScreen('workout');
            setNavigationHistory(['dashboard', 'workout']);
          }
        }
      } catch {
        if (!cancelled) {
          setOnboardingWizardMode('onboarding');
          setOnboardingWizardVisible(true);
        }
      } finally {
        if (!cancelled) {
          setOnboardingGateResolved(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, medicalDisclaimerGate, medicalDisclaimerResolved]);

  // Safety: never keep the onboarding wizard interactive under the medical disclaimer overlay.
  useEffect(() => {
    if (
      medicalDisclaimerGate &&
      onboardingWizardVisible &&
      onboardingWizardMode === 'onboarding' &&
      !onboardingWizardUserOpenedRef.current
    ) {
      setOnboardingWizardVisible(false);
    }
  }, [medicalDisclaimerGate, onboardingWizardVisible, onboardingWizardMode]);

  useEffect(() => {
    if (
      !isLoggedIn ||
      medicalDisclaimerGate ||
      !onboardingGateResolved ||
      onboardingWizardVisible ||
      initialPlanSetupPending
    ) {
      setNutritionBodyPromptVisible(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const show = await shouldShowNutritionBodyProfilePrompt();
        if (!cancelled) setNutritionBodyPromptVisible(show);
      } catch {
        if (!cancelled) setNutritionBodyPromptVisible(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isLoggedIn,
    medicalDisclaimerGate,
    onboardingGateResolved,
    onboardingWizardVisible,
    initialPlanSetupPending,
  ]);

  const refreshPendingNutritionSuggestion = useCallback(async () => {
    if (!isLoggedIn) {
      setPendingNutritionSuggestion(null);
      return;
    }
    const pending = await loadPendingNutritionSuggestion();
    setPendingNutritionSuggestion(pending);
  }, [isLoggedIn]);

  useEffect(() => {
    refreshPendingNutritionSuggestion().catch(console.error);
  }, [refreshPendingNutritionSuggestion, currentScreen]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshPendingNutritionSuggestion().catch(console.error);
      }
    });
    return () => sub.remove();
  }, [refreshPendingNutritionSuggestion]);

  const handleApplyNutritionSuggestion = useCallback(async () => {
    try {
      await applyPendingNutritionSuggestion();
      setPendingNutritionSuggestion(null);
      setFitnessSurfaceNonce((n) => n + 1);
      showToast('Macro goals updated from coach suggestion.', 'success', 3000);
    } catch (e) {
      console.warn('[App] apply nutrition suggestion failed', e);
      Alert.alert('Could not apply', 'Try again from the Nutrition tab.');
    }
  }, [showToast]);

  const handleDismissNutritionSuggestion = useCallback(async () => {
    try {
      await dismissPendingNutritionSuggestion();
    } catch {
      /* best-effort */
    }
    setPendingNutritionSuggestion(null);
  }, []);

  useEffect(() => {
    if (
      !pendingNutritionSuggestion ||
      medicalDisclaimerGate ||
      onboardingWizardVisible ||
      nutritionBodyPromptVisible
    ) {
      if (nutritionNoticeIdRef.current) {
        dismissNotification(nutritionNoticeIdRef.current);
        nutritionNoticeIdRef.current = null;
      }
      return;
    }

    if (nutritionNoticeIdRef.current) return;

    const summary = formatNutritionSuggestionSummary(pendingNutritionSuggestion.suggestedGoals);
    nutritionNoticeIdRef.current = showNotification({
      title: 'Coach macro suggestion',
      lines: [`${pendingNutritionSuggestion.reason}`, `Suggested: ${summary}.`],
      type: 'info',
      persistent: true,
      onDismiss: () => {
        nutritionNoticeIdRef.current = null;
        void handleDismissNutritionSuggestion();
      },
      actions: [
        {
          label: 'Not now',
          style: 'cancel',
          onPress: () => {
            nutritionNoticeIdRef.current = null;
            void handleDismissNutritionSuggestion();
          },
        },
        {
          label: 'Apply',
          onPress: () => {
            nutritionNoticeIdRef.current = null;
            void handleApplyNutritionSuggestion();
          },
        },
      ],
    });
  }, [
    pendingNutritionSuggestion,
    medicalDisclaimerGate,
    onboardingWizardVisible,
    nutritionBodyPromptVisible,
    showNotification,
    dismissNotification,
    handleApplyNutritionSuggestion,
    handleDismissNutritionSuggestion,
  ]);

  // Load stored email / saved password when login screen mounts
  useEffect(() => {
    const loadStoredLoginFields = async () => {
      try {
        const remember = await getRememberPasswordPreference();
        setRememberPassword(remember);

        const saved = remember ? await loadSavedLoginCredentials() : null;
        if (saved?.email) {
          setEmail(saved.email);
          setPassword(saved.password);
          return;
        }

        const { getStoredCredentialsSummary } = await import('./src/utils/userStorage');
        const summary = await getStoredCredentialsSummary();
        if (summary.email) {
          setEmail(summary.email);
        }
      } catch {
        /* non-critical */
      }
    };
    loadStoredLoginFields();
  }, []);

  // Listen for authentication state changes
  useEffect(() => {
    try {
      // Check if auth is properly initialized before setting up listener
      if (!auth || auth._isMock) {
        console.error('[App] Auth is not properly initialized, skipping auth state listener');
        setIsLoggedIn(false);
        setCurrentScreen('login');
        setAuthBootstrapped(true);
        return;
      }
      
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          // User is signed in — show the app immediately; sync can finish in the background.
          console.log('[App] User authenticated:', user.uid);
          setIsLoggedIn(true);
          setCurrentScreen('dashboard');
          setNavigationHistory(['login', 'dashboard']);
          setAuthBootstrapped(true);

          // Save email to profile for future logins
          try {
            const { loadUserData, saveUserData } = await import('./src/utils/userStorage');
            const profile = await loadUserData<any>('userProfile') || {};
            if (user.email && (!profile.email || profile.email !== user.email)) {
              await saveUserData('userProfile', {
                ...profile,
                email: user.email,
                name: profile.name || user.displayName || ''
              });
              console.log('[App] Saved email to profile for future logins');
            }
          } catch (error) {
            console.error('[App] Error saving email to profile:', error);
          }

          // Initialize user data / HealthKit without blocking the boot screen.
          // Firestore can hang when the simulator briefly reports no internet.
          void (async () => {
            try {
              const { keysCopied } = await UserDataInitializer.initializeUserData();
              console.log('[App] User data initialized successfully');
              if (keysCopied > 0) {
                showToast(
                  `Restored ${keysCopied} saved item(s) from this device.`,
                  'success'
                );
              }
            } catch (error) {
              console.error('[App] Error initializing user data:', error);
            }

            try {
              const { isAnyExpoHealthMetricEnabled } = await import(
                './src/utils/healthDataPermissions'
              );
              if (await isAnyExpoHealthMetricEnabled()) {
                console.log('[App] Requesting health permissions for Apple Health sync');
                const hasPermissions = await HealthService.requestPermissions();
                if (hasPermissions) {
                  console.log('[App] HealthKit authorization flow completed');
                } else {
                  console.log('[App] Health permissions not available (Expo Go or HealthKit off)');
                }
              }
            } catch (error) {
              console.error('[App] Error requesting health permissions:', error);
            }
          })();
        } else {
          // User is signed out
          console.log('[App] User signed out');
          setIsLoggedIn(false);
          setCurrentScreen('login');
          UserDataInitializer.reset();
          setAuthBootstrapped(true);
        }
      }, (error) => {
        console.error('[App] Firebase Auth error:', error);
        // Continue without auth if there's an error
        setIsLoggedIn(false);
        setCurrentScreen('login');
        setAuthBootstrapped(true);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('[App] Error setting up auth listener:', error);
      // Continue without auth if there's an error
      setIsLoggedIn(false);
      setCurrentScreen('login');
      setAuthBootstrapped(true);
    }
  }, []);

  // If user chose not to stay logged in, sign out when they leave the app (background)
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'background') return;
      if (!auth || (auth as { _isMock?: boolean })._isMock) {
        return;
      }
      try {
        const stay = await getStayLoggedInPreference();
        if (!stay && auth.currentUser) {
          await signOut(auth);
        }
      } catch (e) {
        console.warn('[App] AppState stay-logged-in handling:', e);
      }
    });
    return () => sub.remove();
  }, []);

  const handleSubmit = async () => {
    // Check network connectivity first (required for Firebase Auth)
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      Alert.alert(
        'No Internet Connection',
        'An internet connection is required to sign in or create an account. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
      showToast('No internet connection. Please check your network settings.', 'error');
      return;
    }

    // Check if auth is properly initialized
    if (!auth) {
      Alert.alert('Error', 'Firebase is not properly initialized. Please restart the app.');
      console.error('[App] Auth object is null or undefined');
      return;
    }
    
    // Check if auth is a mock object (Firebase initialization failed)
    if (auth._isMock) {
      Alert.alert(
        'Firebase Error',
        'Firebase Authentication failed to initialize. Please:\n\n1. Check your internet connection\n2. Restart the app\n3. If the problem persists, check Firebase configuration'
      );
      console.error('[App] Using mock auth object - Firebase Auth is not working');
      return;
    }
    
    // Check if auth has the required methods
    if (typeof auth.signOut !== 'function') {
      Alert.alert('Error', 'Firebase Auth is not properly initialized. Please restart the app.');
      console.error('[App] Auth methods are missing. Auth object:', auth);
      return;
    }
    
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Check if there's a stored email to help user
    try {
      const { getStoredCredentialsSummary } = await import('./src/utils/userStorage');
      const summary = await getStoredCredentialsSummary();
      if (summary.email) {
        console.log('[App] Stored credentials found:');
        console.log('[App] - Email:', summary.email);
        console.log('[App] - Name:', summary.name || 'Not set');
        console.log('[App] - Has Profile:', summary.hasProfile);
        console.log('[App] Attempting login with:', email);
        if (summary.email !== email) {
          console.log('[App] Note: Login email differs from stored profile email');
        }
      } else {
        console.log('[App] No stored credentials found in profile');
      }
    } catch (error) {
      // Ignore - not critical
      console.log('[App] Could not check stored credentials:', error);
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!isLogin && !name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    try {
      // Verify auth is properly initialized
      if (!auth || typeof auth !== 'object') {
        throw new Error('Firebase Auth is not initialized. Please restart the app.');
      }

      // Check system time before authentication
      const localTime = new Date();
      const localTimestamp = localTime.getTime();
      const localTimeISO = localTime.toISOString();
      
      console.log('[App] Authentication attempt at:', localTimeISO);
      console.log('[App] Local timestamp:', localTimestamp);
      console.log('[App] Timezone offset:', localTime.getTimezoneOffset(), 'minutes');
      
      // Warn if time seems off (more than 5 minutes difference from expected)
      // This is a rough check - Firebase will do the real validation
      const expectedTime = Date.now();
      const timeDiff = Math.abs(localTimestamp - expectedTime);
      if (timeDiff > 300000) { // 5 minutes in milliseconds
        console.warn('[App] Warning: System time may be significantly off');
        Alert.alert(
          'Time Sync Warning',
          'Your device time may be out of sync. Please ensure:\n\n1. Automatic date & time is enabled\n2. Automatic timezone is enabled\n3. Your device is connected to the internet\n\nThen try again.',
          [{ text: 'OK' }]
        );
      }

    if (isLogin) {
        // Sign in existing user
        console.log('[App] Attempting to sign in user:', email);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('[App] Sign in successful:', userCredential.user.uid);
        if (rememberPassword) {
          await saveLoginCredentials(email, password);
        } else {
          await setRememberPasswordPreference(false);
          await clearSavedLoginCredentials();
        }
        // Auth state listener will handle the rest
      } else {
        // Create new user account
        console.log('[App] Attempting to create new user:', email);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log('[App] User creation successful:', userCredential.user.uid);
        try {
          const { loadUserData, saveUserData } = await import('./src/utils/userStorage');
          const profile = (await loadUserData<Record<string, unknown>>('userProfile')) || {};
          await saveUserData('userProfile', {
            ...profile,
            name: name.trim(),
            email: userCredential.user.email ?? email,
          });
        } catch (profileErr) {
          console.warn('[App] Could not save signup name to profile', profileErr);
        }
        Alert.alert(
          'Stay logged in?',
          'When enabled, you stay signed in on this device so you don\'t need to enter your password every time you open the app. You can change this anytime in Settings.',
          [
            {
              text: 'Ask each time',
              style: 'cancel',
              onPress: async () => {
                await setStayLoggedInPreference(false);
              },
            },
            {
              text: 'Stay logged in',
              onPress: async () => {
                await setStayLoggedInPreference(true);
              },
            },
          ],
          { cancelable: false }
        );
        // Auth state listener will handle the rest
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      let errorMessage = 'An error occurred';
      
      // Check if error has a code property (Firebase errors have this)
      if (error && error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email is already registered';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password should be at least 6 characters';
            break;
          case 'auth/user-not-found':
            errorMessage = 'User not found';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Invalid password';
            break;
          case 'auth/invalid-credential':
          case 'auth/invalid-user-token':
          case 'auth/user-token-expired':
            // These errors can occur if system clock is wrong
            const currentTime = new Date();
            const timeInfo = {
              localTime: currentTime.toISOString(),
              timestamp: currentTime.getTime(),
              timezoneOffset: currentTime.getTimezoneOffset(),
              utcTime: currentTime.toUTCString()
            };
            console.error('[App] Authentication error - Time info:', timeInfo);
            console.error('[App] Attempted login with email:', email);
            
            errorMessage = 'Invalid credentials. Possible causes:\n\n• Wrong email or password\n• System time is incorrect\n• Account may have been deleted\n\nTry:\n1. Verify your email and password\n2. Use "Forgot Password" to reset\n3. Check system date/time settings\n4. Try creating a new account if needed';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            break;
          case 'auth/invalid-api-key':
          case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
            errorMessage =
              'Firebase rejected this API key. Common fixes:\n\n' +
              '1) Use the Web app snippet from Firebase Console → Project settings → Your apps (JavaScript SDK needs the Web apiKey, not an Android/iOS-only key).\n' +
              '2) In Google Cloud Console → APIs & Services → Credentials, open the Browser key used by Firebase. If "Application restrictions" are set to HTTP referrers only, React Native Auth often fails — temporarily set restrictions to None or add the right mobile restrictions, then retry.\n' +
              '3) Ensure every EXPO_PUBLIC_FIREBASE_* value is from the same Web app config, then stop Metro and run: npx expo start -c';
            break;
          case 'auth/app-not-initialized':
            errorMessage = 'Firebase is not initialized. Please restart the app.';
            break;
          case 'auth/configuration-not-found':
            errorMessage =
              'Firebase Authentication is not set up for this project.\n\n' +
              'In Firebase Console (same project as EXPO_PUBLIC_FIREBASE_PROJECT_ID):\n' +
              '1) Build → Authentication → click Get started if shown\n' +
              '2) Sign-in method → enable Email/Password (and save)\n' +
              '3) Wait a minute, reload the app, then try again';
            break;
          default:
            errorMessage = error.message || `Error: ${error.code || 'Unknown error'}`;
        }
      } else if (error && error.message) {
        // If no code but has message, use the message
        errorMessage = error.message;
    } else {
        // Fallback for unexpected error format
        errorMessage = 'An unexpected error occurred. Please try again.';
        console.error('Unexpected error format:', error);
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const handleRememberPasswordToggle = async () => {
    const next = !rememberPassword;
    setRememberPassword(next);
    await setRememberPasswordPreference(next);
    if (!next) {
      await clearSavedLoginCredentials();
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
  };

  const handleForgotPassword = async () => {
    // Check network connectivity first
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      Alert.alert(
        'No Internet Connection',
        'An internet connection is required to reset your password. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
      showToast('No internet connection. Please check your network settings.', 'error');
      return;
    }

    if (!resetEmail.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      Alert.alert(
        'Password Reset Email Sent',
        'Check your email for instructions to reset your password. The email may take a few minutes to arrive.',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowForgotPassword(false);
              setResetEmail('');
              setResetMethod(null);
            }
          }
        ]
      );
      showToast('Password reset email sent!', 'success');
    } catch (error: any) {
      console.error('Password reset error:', error);
      let errorMessage = 'Failed to send password reset email. Please try again.';
      
      if (error && error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'No account found with this email address.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many requests. Please try again later.';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const handleLogout = async () => {
    try {
      try {
        const { clearExpoPushToken } = await import('./src/utils/pushTokenRegistration');
        await clearExpoPushToken();
      } catch {
        /* non-fatal */
      }
      await signOut(auth);
      // Auth state listener will handle the rest (setIsLoggedIn, etc.)
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
      UserDataInitializer.reset();
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  const handleNavigateToWorkout = () => {
    openedFromMoreMenuRef.current = false;
    navigatePrimaryTab('workout');
  };

  const handleNavigateToFitness = () => {
    setFitnessSyncedTab('workouts');
    setFitnessSurfaceNonce((n) => n + 1);
    navigatePrimaryTab('fitness');
  };

  const handleStartTodayWorkout = () => {
    setTourLogFoodIntent({ id: Date.now(), open: false });
    setTourFitnessIntent({ id: Date.now(), startTodayWorkout: true });
    setFitnessSyncedTab('workouts');
    setFitnessSurfaceNonce((n) => n + 1);
    navigatePrimaryTab('fitness');
  };

  const handleNavigateToLogFood = () => {
    setTourFitnessIntent({ id: Date.now(), closeAll: true });
    setFitnessSyncedTab('nutrition');
    setFitnessSurfaceNonce((n) => n + 1);
    navigatePrimaryTab('fitness');
    setTourLogFoodIntent({ id: Date.now(), open: true });
  };

  const handleNavigateToFitnessHistory = () => {
    setFitnessSyncedTab('history');
    setFitnessSurfaceNonce((n) => n + 1);
    navigatePrimaryTab('fitness');
  };

  const handleNavigateToMental = () => {
    openedFromMoreMenuRef.current = false;
    navigateToScreen('mental');
  };

  const handleMentalTaskComplete = useCallback((taskTitle: string) => {
    void markMindsetCheckInComplete(taskTitle);
  }, []);

  const handleOpenCoachingQuestionnaireEdit = useCallback(() => {
    onboardingWizardUserOpenedRef.current = true;
    setOnboardingWizardMode('edit');
    setOnboardingWizardVisible(true);
  }, []);

  const openAdvancedNutritionIfNeeded = useCallback(async () => {
    const profile = await loadCoachingProfile();
    const prefs = profile.nutritionPreferencesProfile;
    if (
      shouldLaunchAdvancedNutritionQuestionnaire(prefs) &&
      !prefs.advancedProfile?.completedAt
    ) {
      setAdvancedNutritionQuestionnaireVisible(true);
    }
  }, []);

  const handleOpenNutritionQuestionnaire = useCallback(() => {
    void (async () => {
      const profile = await loadCoachingProfile();
      const prefs = profile.nutritionPreferencesProfile;
      if (
        isInitialNutritionSetupComplete(prefs) &&
        shouldLaunchAdvancedNutritionQuestionnaire(prefs) &&
        !prefs.advancedProfile?.completedAt
      ) {
        setAdvancedNutritionQuestionnaireVisible(true);
        return;
      }
      setNutritionQuestionnaireVisible(true);
    })();
  }, []);

  const handleNutritionQuestionnaireClose = useCallback(() => {
    setNutritionQuestionnaireVisible(false);
  }, []);

  const handleNutritionQuestionnaireSaved = useCallback(
    (prefs: NutritionPreferencesProfile) => {
      setNutritionQuestionnaireVisible(false);
      if (shouldLaunchAdvancedNutritionQuestionnaire(prefs) && !prefs.advancedProfile?.completedAt) {
        setAdvancedNutritionQuestionnaireVisible(true);
      }
    },
    []
  );

  const handleAdvancedNutritionQuestionnaireClose = useCallback(() => {
    setAdvancedNutritionQuestionnaireVisible(false);
  }, []);

  const handleOnboardingWizardComplete = useCallback(() => {
    const wasEdit = onboardingWizardMode === 'edit';
    onboardingWizardUserOpenedRef.current = false;
    setOnboardingWizardVisible(false);
    setOnboardingWizardMode('onboarding');
    if (wasEdit) {
      return;
    }
    void openAdvancedNutritionIfNeeded();
    void (async () => {
      try {
        // Prefer the opt-in flag; if storage lags, still send Yes-users to the plan builder.
        let pending = await isPendingFirstWorkoutPlan();
        if (!pending) {
          // Brief retry — completeOnboarding may still be flushing durable storage.
          await new Promise((r) => setTimeout(r, 200));
          pending = await isPendingFirstWorkoutPlan();
        }
        setInitialPlanSetupPending(pending);
        if (pending) {
          navigateToScreen('workout');
        } else {
          navigateToScreen('dashboard');
        }
      } catch {
        navigateToScreen('dashboard');
      }
    })();
  }, [onboardingWizardMode, openAdvancedNutritionIfNeeded]);

  const handleOnboardingWizardCancel = useCallback(() => {
    onboardingWizardUserOpenedRef.current = false;
    setOnboardingWizardVisible(false);
    setOnboardingWizardMode('onboarding');
  }, []);

  const handleNavigateToEmotional = () => {
    openedFromMoreMenuRef.current = false;
    navigateToScreen('emotional');
  };

  const handleNavigateToAI = () => {
    openedFromMoreMenuRef.current = false;
    navigateToScreen('ai');
  };

  const handleNavigateToSpiritual = () => {
    openedFromMoreMenuRef.current = false;
    navigateToScreen('spiritual');
  };

  const handleNavigateToHealth = () => {
    openedFromMoreMenuRef.current = false;
    setHealthInitialTrendGraph(undefined);
    navigateToScreen('health');
  };

  const handleNavigateToNutritionTrends = () => {
    openedFromMoreMenuRef.current = false;
    setHealthInitialTrendGraph('nutrition');
    navigateToScreen('health');
  };

  const handleNavigateToAppleHealthData = () => {
    openedFromMoreMenuRef.current = false;
    navigateToScreen('appleHealthData');
  };

  const navigateToScreen = (screen: 'login' | LoggedInScreen) => {
    setNavigationHistory((prev) => {
      // Don't add the same screen twice in a row
      if (prev[prev.length - 1] !== screen) {
        return [...prev, screen];
      }
      return prev;
    });
    setCurrentScreen(screen);
  };

  /** Bottom-tab / primary destinations — always push so Back returns to the prior page. */
  const navigatePrimaryTab = useCallback((screen: LoggedInScreen) => {
    openedFromMoreMenuRef.current = false;
    setNavigationHistory((prev) => {
      if (prev[prev.length - 1] !== screen) {
        return [...prev, screen];
      }
      return prev;
    });
    setCurrentScreen(screen);
  }, []);

  smartNavRef.current = (target: string) => {
    if (target === 'fitness_log_food') {
      setFitnessSyncedTab('nutrition');
      setFitnessSurfaceNonce((n) => n + 1);
      navigatePrimaryTab('fitness');
      return;
    }
    if (target === 'fitness') {
      setFitnessSyncedTab('workouts');
      setFitnessSurfaceNonce((n) => n + 1);
      navigatePrimaryTab('fitness');
      return;
    }
    if (target === 'progress') {
      navigatePrimaryTab('progress');
      return;
    }
    if (target === 'health') {
      navigatePrimaryTab('moreHub');
      return;
    }
    navigatePrimaryTab('dashboard');
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    let stop: (() => void) | undefined;
    void (async () => {
      const { startSmartNotificationListeners } = await import(
        './src/utils/smartNotificationHandlers'
      );
      stop = startSmartNotificationListeners({
        onNavigate: (target) => smartNavRef.current(target),
      });
    })();
    return () => stop?.();
  }, [isLoggedIn]);

  const returnToMoreHub = useCallback(() => {
    openedFromMoreMenuRef.current = false;
    setNavigationHistory((prev) => {
      const trimmed = prev.slice(0, -1);
      const last = trimmed[trimmed.length - 1];
      if (last === 'moreHub') return trimmed;
      const moreIdx = trimmed.lastIndexOf('moreHub');
      if (moreIdx >= 0) return trimmed.slice(0, moreIdx + 1);
      return [...trimmed, 'moreHub'];
    });
    setCurrentScreen('moreHub');
  }, []);

  const handleGoBack = useCallback(() => {
    if (
      openedFromMoreMenuRef.current &&
      MORE_MENU_CHILD_SCREENS.includes(currentScreen as LoggedInScreen)
    ) {
      returnToMoreHub();
      return;
    }

    if (navigationHistory.length > 1) {
      const previousScreen = navigationHistory[navigationHistory.length - 2];
      // Never pop back to the login screen while signed in.
      if (previousScreen === 'login') {
        if (currentScreen !== 'dashboard') {
          setNavigationHistory((prev) => {
            const withoutCurrent = prev.slice(0, -1);
            if (withoutCurrent[withoutCurrent.length - 1] === 'dashboard') {
              return withoutCurrent;
            }
            return [...withoutCurrent, 'dashboard'];
          });
          setCurrentScreen('dashboard');
        }
        return;
      }
      setNavigationHistory((prev) => prev.slice(0, -1));
      setCurrentScreen(previousScreen);
      return;
    }

    if (MORE_MENU_CHILD_SCREENS.includes(currentScreen as LoggedInScreen)) {
      returnToMoreHub();
      return;
    }

    if (currentScreen !== 'dashboard') {
      setCurrentScreen('dashboard');
    }
  }, [currentScreen, navigationHistory, returnToMoreHub]);

  const handleInitialPlanSaved = useCallback(() => {
    setInitialPlanSetupPending(false);
  }, []);

  const openScreenFromMoreMenu = (screen: LoggedInScreen) => {
    openedFromMoreMenuRef.current = true;
    navigateToScreen(screen);
  };

  if (!authBootstrapped) {
    return <AppBootScreen />;
  }

  if (isLoggedIn) {
    const handleFitnessSwipeBack = () => {
      const internalHandler = (FitnessScreen as any).internalBackHandler;
      if (internalHandler) {
        internalHandler();
      } else {
        handleGoBack();
      }
    };

    const mainBottomActiveTab: MainBottomTabId = (() => {
      switch (currentScreen) {
        case 'dashboard':
          return 'dashboard';
        case 'fitness':
          // Live workout UI is always a Workouts surface, even if Nutrition was open before Resume.
          if (activeWorkout?.isPresented) return 'workouts';
          return fitnessSyncedTab === 'nutrition' ? 'nutrition' : 'workouts';
        case 'progress':
          return 'progress';
        case 'mental': {
          const mentalIdx = navigationHistory.lastIndexOf('mental');
          const prev = mentalIdx > 0 ? navigationHistory[mentalIdx - 1] : null;
          return prev === 'moreHub' ? 'more' : 'dashboard';
        }
        case 'moreHub':
          return 'more';
        case 'workout':
          return 'workouts';
        case 'settings':
        case 'health':
        case 'appleHealthData':
        case 'spiritual':
        case 'emotional':
        case 'nutritionSearch':
          return 'more';
        case 'movementIntelligence': {
          const miIdx = navigationHistory.lastIndexOf('movementIntelligence');
          const prev = miIdx > 0 ? navigationHistory[miIdx - 1] : null;
          return prev === 'progress' ? 'progress' : 'more';
        }
        case 'ai':
          return 'dashboard';
        default:
          return 'dashboard';
      }
    })();

    const mainTabBarBottomReserve =
      MAIN_TAB_BAR_CHROME_HEIGHT + Math.max(insets.bottom, 10);

    const handleMainBottomTabPress = (tab: MainBottomTabId) => {
      switch (tab) {
        case 'dashboard':
          navigatePrimaryTab('dashboard');
          break;
        case 'workouts':
          setFitnessSyncedTab('workouts');
          setFitnessSurfaceNonce((n) => n + 1);
          navigatePrimaryTab('fitness');
          break;
        case 'nutrition':
          setFitnessSyncedTab('nutrition');
          setFitnessSurfaceNonce((n) => n + 1);
          navigatePrimaryTab('fitness');
          break;
        case 'progress':
          navigatePrimaryTab('progress');
          break;
        case 'more':
          navigatePrimaryTab('moreHub');
          break;
      }
    };

    const dashboardEl = (
      <Dashboard
        onLogout={handleLogout}
        onNavigateToFitness={handleNavigateToFitness}
        onStartTodayWorkout={handleStartTodayWorkout}
        onNavigateToLogFood={handleNavigateToLogFood}
        onNavigateToHistory={handleNavigateToFitnessHistory}
        onNavigateToMental={handleNavigateToMental}
        onNavigateToEmotional={handleNavigateToEmotional}
        onNavigateToAI={handleNavigateToAI}
        onNavigateToSpiritual={handleNavigateToSpiritual}
        onNavigateToHealth={handleNavigateToHealth}
        onNavigateToAppleHealthData={handleNavigateToAppleHealthData}
      />
    );

    let body: React.ReactNode;
    switch (currentScreen) {
      case 'workout':
        body = (
          <SmoothTransition isVisible={true} direction="slideInRight">
            <SwipeNavigation onSwipeBack={handleGoBack}>
              <WorkoutScreen
                onBack={handleGoBack}
                onPlanSetupComplete={handleInitialPlanSaved}
                initialSetupPending={initialPlanSetupPending}
              />
            </SwipeNavigation>
          </SmoothTransition>
        );
        break;
      case 'fitness':
        body = (
          <SmoothTransition isVisible={true} direction="slideInRight">
            <SwipeNavigation onSwipeBack={handleFitnessSwipeBack}>
              <FitnessScreen
                onBack={handleGoBack}
                syncedFitnessTab={fitnessSyncedTab}
                fitnessSurfaceNonce={fitnessSurfaceNonce}
                tourLogFoodIntent={tourLogFoodIntent}
                tourFitnessIntent={tourFitnessIntent}
                onTourFitnessIntentConsumed={() => setTourFitnessIntent(null)}
                onFitnessTabChange={setFitnessSyncedTab}
                onNavigateToNutritionTrends={handleNavigateToNutritionTrends}
                onOpenNutritionQuestionnaire={handleOpenNutritionQuestionnaire}
                onCompleteTask={(taskTitle: string) => {
                  console.log('Task completed:', taskTitle);
                }}
              />
            </SwipeNavigation>
          </SmoothTransition>
        );
        break;
      case 'progress':
        body = (
          <SmoothTransition isVisible={true} direction="fadeIn">
            <ProgressScreen
              onOpenMovementIntelligence={() => {
                openedFromMoreMenuRef.current = false;
                navigateToScreen('movementIntelligence');
              }}
            />
          </SmoothTransition>
        );
        break;
      case 'mental':
        body = (
          <SmoothTransition isVisible={true} direction="slideInRight">
            <SwipeNavigation onSwipeBack={handleGoBack}>
              <MentalScreen
                onBack={handleGoBack}
                onCompleteTask={handleMentalTaskComplete}
              />
            </SwipeNavigation>
          </SmoothTransition>
        );
        break;
      case 'emotional':
        body = (
          <SmoothTransition isVisible={true} direction="slideInRight">
            <SwipeNavigation onSwipeBack={handleGoBack}>
              <EmotionalScreen
                onBack={handleGoBack}
                onCompleteTask={(taskTitle: string) => {
                  console.log('Task completed:', taskTitle);
                }}
              />
            </SwipeNavigation>
          </SmoothTransition>
        );
        break;
      case 'spiritual':
        body = (
          <SmoothTransition isVisible={true} direction="slideInRight">
            <SwipeNavigation onSwipeBack={handleGoBack}>
              <SpiritualScreen
                onBack={handleGoBack}
                onCompleteTask={(taskTitle: string) => {
                  console.log('Task completed:', taskTitle);
                }}
              />
            </SwipeNavigation>
          </SmoothTransition>
        );
        break;
      case 'settings':
        body = (
          <SmoothTransition isVisible={true} direction="slideInRight">
            <SwipeNavigation onSwipeBack={handleGoBack}>
              <SettingsScreen
                onBack={handleGoBack}
                onLogout={handleLogout}
                onEditCoachingQuestionnaire={handleOpenCoachingQuestionnaireEdit}
                initialTab={settingsInitialTab}
                standaloneSection
              />
            </SwipeNavigation>
          </SmoothTransition>
        );
        break;
      case 'health':
        body = (
          <SmoothTransition isVisible={true} direction="slideInRight">
            <SwipeNavigation onSwipeBack={handleGoBack}>
              <HealthScreen onBack={handleGoBack} initialTrendGraph={healthInitialTrendGraph} />
            </SwipeNavigation>
          </SmoothTransition>
        );
        break;
      case 'movementIntelligence':
        body = (
          <SmoothTransition isVisible={true} direction="slideInRight">
            <SwipeNavigation onSwipeBack={handleGoBack}>
              <MovementIntelligenceScreen onBack={handleGoBack} />
            </SwipeNavigation>
          </SmoothTransition>
        );
        break;
      case 'appleHealthData':
        body = (
          <SmoothTransition isVisible={true} direction="slideInRight">
            <SwipeNavigation onSwipeBack={handleGoBack}>
              <AppleHealthDataScreen onBack={handleGoBack} />
            </SwipeNavigation>
          </SmoothTransition>
        );
        break;
      case 'nutritionSearch':
        body = (
          <SmoothTransition isVisible={true} direction="slideInRight">
            <SwipeNavigation onSwipeBack={handleGoBack}>
              <NutritionSearchScreen onBack={handleGoBack} />
            </SwipeNavigation>
          </SmoothTransition>
        );
        break;
      case 'ai':
        body = (
          <SmoothTransition isVisible={true} direction="slideInRight">
            <SwipeNavigation onSwipeBack={handleGoBack}>
              <AIComponent userData={userData as any} />
            </SwipeNavigation>
          </SmoothTransition>
        );
        break;
      case 'moreHub':
        body = (
          <SmoothTransition isVisible={true} direction="fadeIn">
            <MoreMenuScreen
              onOpen={(target) => {
                switch (target) {
                  case 'profile':
                    setSettingsInitialTab('profile');
                    openScreenFromMoreMenu('settings');
                    break;
                  case 'settings':
                    setSettingsInitialTab('settings');
                    openScreenFromMoreMenu('settings');
                    break;
                  case 'interface':
                    setSettingsInitialTab('interface');
                    openScreenFromMoreMenu('settings');
                    break;
                  case 'legal':
                    setSettingsInitialTab('legal');
                    openScreenFromMoreMenu('settings');
                    break;
                  case 'health':
                    openScreenFromMoreMenu('health');
                    break;
                  case 'spiritual':
                    openScreenFromMoreMenu('spiritual');
                    break;
                  case 'emotional':
                    openScreenFromMoreMenu('emotional');
                    break;
                  case 'mental':
                    openScreenFromMoreMenu('mental');
                    break;
                  case 'workout':
                    openScreenFromMoreMenu('workout');
                    break;
                  case 'nutritionSearch':
                    openScreenFromMoreMenu('nutritionSearch');
                    break;
                  case 'movementIntelligence':
                    openScreenFromMoreMenu('movementIntelligence');
                    break;
                }
              }}
            />
          </SmoothTransition>
        );
        break;
      case 'dashboard':
      default:
        body = (
          <SmoothTransition isVisible={true} direction="fadeIn">
            {dashboardEl}
          </SmoothTransition>
        );
    }

    const blockMainChrome = medicalDisclaimerGate || onboardingWizardVisible;

    const showingLiveWorkout =
      currentScreen === 'fitness' && Boolean(activeWorkout?.isPresented);
    const showActiveWorkoutBanner =
      Boolean(activeWorkout) && !showingLiveWorkout && !blockMainChrome;

    const resumeActiveWorkoutFromBanner = () => {
      setFitnessSyncedTab('workouts');
      presentActiveWorkout();
      navigatePrimaryTab('fitness');
    };

    return (
      <SmallWinsProvider>
      <View style={{ flex: 1, backgroundColor: '#0d0d0d' }}>
        <View
          pointerEvents={blockMainChrome ? 'none' : 'auto'}
          style={{ flex: 1, paddingBottom: mainTabBarBottomReserve }}
        >
          {body}
        </View>
        {showActiveWorkoutBanner ? (
          <TouchableOpacity
            style={[
              styles.activeWorkoutBanner,
              { bottom: mainTabBarBottomReserve + 8 },
            ]}
            onPress={resumeActiveWorkoutFromBanner}
            accessibilityRole="button"
            accessibilityLabel="Resume workout in progress"
            activeOpacity={0.9}
          >
            <View style={styles.activeWorkoutBannerTextCol}>
              <Text style={styles.activeWorkoutBannerTitle}>Workout in progress</Text>
              <Text style={styles.activeWorkoutBannerSubtitle} numberOfLines={1}>
                {activeWorkout?.program?.name || 'Tap to resume'}
              </Text>
            </View>
            <Text style={styles.activeWorkoutBannerAction}>Resume →</Text>
          </TouchableOpacity>
        ) : null}
        <View
          pointerEvents={blockMainChrome ? 'none' : 'box-none'}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100000,
            elevation: 100000,
            opacity: blockMainChrome ? 0 : 1,
          }}
        >
          <MainBottomTabBar activeTab={mainBottomActiveTab} onTabPress={handleMainBottomTabPress} />
        </View>
        <MedicalDisclaimerGate
          visible={medicalDisclaimerGate}
          onAccepted={() => setMedicalDisclaimerGate(false)}
        />
        <OnboardingWizard
          visible={onboardingWizardVisible}
          mode={onboardingWizardMode}
          onComplete={handleOnboardingWizardComplete}
          onCancel={handleOnboardingWizardCancel}
        />
        <NutritionQuestionnaireWizard
          visible={nutritionQuestionnaireVisible}
          onClose={handleNutritionQuestionnaireClose}
          onSaved={handleNutritionQuestionnaireSaved}
        />
        <AdvancedNutritionQuestionnaireWizard
          visible={advancedNutritionQuestionnaireVisible}
          onClose={handleAdvancedNutritionQuestionnaireClose}
        />
        <NutritionBodyProfilePrompt
          visible={nutritionBodyPromptVisible}
          onComplete={() => {
            setNutritionBodyPromptVisible(false);
            refreshPendingNutritionSuggestion().catch(console.error);
          }}
          onDismiss={() => setNutritionBodyPromptVisible(false)}
        />
      </View>
      </SmallWinsProvider>
    );
  }

  // Show Login Screen
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <KeyboardSafeView style={styles.keyboardView}>
        <DismissKeyboardSurface style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.header}>
            <Text style={styles.logo}>TYLAI</Text>
            <Text style={styles.tagline}>Your AI Fitness Coach</Text>
          </View>

          <View style={styles.formContainer}>
            {/* Network Status Indicator */}
            {!isOnline && (
              <View style={styles.networkWarning}>
                <Text style={styles.networkWarningText}>
                  ⚠️ No Internet Connection - Sign in requires internet
                </Text>
              </View>
            )}
            
            <Text style={styles.title}>
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin
                ? 'Sign in to continue your fitness journey'
                : 'Join us and start your fitness transformation'}
            </Text>

            {!isLogin && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              {email && email.includes('@') && (
                <Text style={styles.emailHint}>✓ Email will be remembered for next time</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={isLogin ? 'password' : 'new-password'}
              />
            </View>

            {isLogin && (
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={handleRememberPasswordToggle}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberPassword }}
                accessibilityLabel="Remember password on this device"
              >
                <View
                  style={[
                    styles.rememberCheckbox,
                    rememberPassword && styles.rememberCheckboxChecked,
                  ]}
                >
                  {rememberPassword ? <Text style={styles.rememberCheckmark}>✓</Text> : null}
                </View>
                <Text style={styles.rememberLabel}>Remember password on this device</Text>
              </TouchableOpacity>
            )}

            {!isLogin && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
              <Text style={styles.buttonText}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleButton} onPress={toggleMode}>
              <Text style={styles.toggleText}>
                {isLogin
                  ? "Don't have an account? Sign Up"
                  : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>

            {isLogin && (
              <TouchableOpacity 
                style={styles.forgotPassword}
                onPress={() => {
                  setResetEmail(email); // Pre-fill with current email if available
                  setShowForgotPassword(true);
                }}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
        </DismissKeyboardSurface>
      </KeyboardSafeView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPassword}
        animationType="none"
        transparent={true}
        onRequestClose={() => {
          setShowForgotPassword(false);
          setResetEmail('');
          setResetMethod(null);
        }}
      >
        <KeyboardModalFrame justifyContent="center">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalSubtitle}>
              Choose how you'd like to reset your password
            </Text>

            {!resetMethod ? (
              <>
                <TouchableOpacity
                  style={styles.resetMethodButton}
                  onPress={() => setResetMethod('email')}
                >
                  <Text style={styles.resetMethodIcon}>📧</Text>
                  <View style={styles.resetMethodTextContainer}>
                    <Text style={styles.resetMethodTitle}>Email</Text>
                    <Text style={styles.resetMethodDescription}>
                      Send a password reset link to your email address
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowForgotPassword(false);
                    setResetEmail('');
                    setResetMethod(null);
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : resetMethod === 'email' ? (
              <>
                <Text style={styles.modalLabel}>Enter your email address</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="your.email@example.com"
                  placeholderTextColor="#666"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                />
                <Text style={styles.modalHint}>
                  We'll send you a link to reset your password
                </Text>

                <View style={styles.modalButtonContainer}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={handleForgotPassword}
                  >
                    <Text style={styles.modalButtonText}>Send Reset Link</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalBackButton}
                    onPress={() => {
                      setResetMethod(null);
                      setResetEmail('');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                  >
                    <Text style={styles.modalBackButtonText}>←</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
        </KeyboardModalFrame>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <AppErrorBoundary>
          <KeyboardInsetsProvider>
            <ToastProvider>
              <SettingsProvider>
                <SubscriptionProvider>
                <ActiveWorkoutProvider>
                {!firebaseEnvConfigured ? (
                  <View style={styles.configErrorScreen}>
                    <Text style={styles.configErrorTitle}>Configuration needed</Text>
                    <Text style={styles.configErrorBody}>
                      {__DEV__
                        ? 'Copy .env.example to .env, add your Firebase keys, then restart Metro:'
                        : 'This TestFlight build is missing Firebase configuration. Rebuild with EAS production secrets set (EXPO_PUBLIC_FIREBASE_*), then reinstall from TestFlight.'}
                    </Text>
                    {__DEV__ ? (
                      <Text style={styles.configErrorCode}>npx expo start --clear</Text>
                    ) : null}
                  </View>
                ) : (
                  <AppInner />
                )}
                </ActiveWorkoutProvider>
                </SubscriptionProvider>
              </SettingsProvider>
            </ToastProvider>
          </KeyboardInsetsProvider>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  configErrorScreen: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
    justifyContent: 'center',
    padding: 24,
  },
  configErrorTitle: {
    color: AppTheme.accent,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  configErrorBody: {
    color: AppTheme.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  configErrorCode: {
    color: '#9ae6b4',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  activeWorkoutBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100001,
    elevation: 100001,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1a2e24',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  activeWorkoutBannerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  activeWorkoutBannerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  activeWorkoutBannerSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  activeWorkoutBannerAction: {
    color: '#00ff88',
    fontSize: 15,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: AppTheme.accent,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: AppTheme.textMuted,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    padding: 30,
    borderWidth: 1,
    borderColor: AppTheme.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: AppTheme.textMuted,
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: AppTheme.inputBg,
    borderRadius: AppTheme.radiusButton,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  button: {
    backgroundColor: AppTheme.accent,
    borderRadius: AppTheme.radiusButton,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppTheme.accentDark,
  },
  toggleButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  toggleText: {
    fontSize: 16,
    color: AppTheme.accent,
    textDecorationLine: 'underline',
  },
  forgotPassword: {
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#888',
    textDecorationLine: 'underline',
  },
  emailHint: {
    fontSize: 11,
    color: '#00ff88',
    marginTop: 4,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 16,
  },
  rememberCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: AppTheme.inputBorder,
    backgroundColor: AppTheme.inputBg,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberCheckboxChecked: {
    borderColor: AppTheme.accent,
    backgroundColor: AppTheme.accent,
  },
  rememberCheckmark: {
    color: AppTheme.accentDark,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  rememberLabel: {
    flex: 1,
    fontSize: 14,
    color: AppTheme.textMuted,
    lineHeight: 20,
  },
  networkWarning: {
    backgroundColor: '#ff6b6b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  networkWarningText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 25,
    textAlign: 'center',
  },
  resetMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#333',
  },
  resetMethodIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  resetMethodTextContainer: {
    flex: 1,
  },
  resetMethodTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  resetMethodDescription: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  modalInput: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  modalHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  modalButtonContainer: {
    gap: 12,
  },
  modalButton: {
    backgroundColor: '#00ff88',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalBackButton: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  modalBackButtonText: {
    color: '#aaa',
    fontSize: 22,
    fontWeight: '600',
  },
  modalCancelButton: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#444',
  },
  modalCancelButtonText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '600',
  },
}); 
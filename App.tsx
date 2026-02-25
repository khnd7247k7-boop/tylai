import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Dashboard from './Dashboard';
import WorkoutScreen from './WorkoutScreen';
import FitnessScreen from './FitnessScreen';
import MentalScreen from './MentalScreen';
import EmotionalScreen from './EmotionalScreen';
import AIComponent from './AIComponent';
import SettingsScreen from './SettingsScreen';
import SpiritualScreen from './SpiritualScreen';
import HealthScreen from './HealthScreen';
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

function AppInner() {
  const { showToast } = useToast();
  const { isOnline } = useNetworkStatus(); // Monitor network connectivity
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'dashboard' | 'workout' | 'fitness' | 'mental' | 'emotional' | 'ai' | 'settings' | 'spiritual' | 'health'>('login');
  const [navigationHistory, setNavigationHistory] = useState<Array<'login' | 'dashboard' | 'workout' | 'fitness' | 'mental' | 'emotional' | 'ai' | 'settings' | 'spiritual' | 'health'>>(['login']);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMethod, setResetMethod] = useState<'email' | null>(null);
  
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

  // Initialize notifications on app start
  useEffect(() => {
    const initializeNotifications = async () => {
      await requestNotificationPermissions();
      await updateNotificationSchedule();
    };
    
    initializeNotifications();
  }, []);

  // Load stored email when component mounts
  useEffect(() => {
    const loadStoredEmail = async () => {
      try {
        const { getStoredCredentialsSummary } = await import('./src/utils/userStorage');
        const summary = await getStoredCredentialsSummary();
        if (summary.email) {
          console.log('[App] Found stored email:', summary.email);
          setEmail(summary.email); // Auto-fill email from stored profile
        }
      } catch (error) {
        console.log('[App] No stored email found');
      }
    };
    loadStoredEmail();
  }, []);

  // Listen for authentication state changes
  useEffect(() => {
    try {
      // Check if auth is properly initialized before setting up listener
      if (!auth || auth._isMock) {
        console.error('[App] Auth is not properly initialized, skipping auth state listener');
        setIsLoggedIn(false);
        setCurrentScreen('login');
        return;
      }
      
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          // User is signed in
          console.log('[App] User authenticated:', user.uid);
          setIsLoggedIn(true);
          setCurrentScreen('dashboard');
          setNavigationHistory(['login', 'dashboard']);
          
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
          
          // Initialize user data automatically
          try {
            await UserDataInitializer.initializeUserData();
            console.log('[App] User data initialized successfully');
          } catch (error) {
            console.error('[App] Error initializing user data:', error);
          }
          
          // Request health permissions on first login to sync watch data
          try {
            const { loadUserData, saveUserData } = await import('./src/utils/userStorage');
            const healthPermissionsRequested = await loadUserData<boolean>('healthPermissionsRequested');
            
            if (!healthPermissionsRequested) {
              console.log('[App] Requesting health permissions for watch data sync');
              const hasPermissions = await HealthService.requestPermissions();
              
              if (hasPermissions) {
                console.log('[App] Health permissions granted - watch data can now sync');
                showToast('Watch data sync enabled! Your smartwatch data will automatically sync to the app.', 'success');
              } else {
                console.log('[App] Health permissions not granted or not available');
                // Don't show error toast - permissions might not be available on all devices
              }
              
              // Mark that we've requested permissions (even if not granted)
              await saveUserData('healthPermissionsRequested', true);
            }
          } catch (error) {
            console.error('[App] Error requesting health permissions:', error);
            // Fail silently - health permissions are optional
          }
        } else {
          // User is signed out
          console.log('[App] User signed out');
          setIsLoggedIn(false);
          setCurrentScreen('login');
          UserDataInitializer.reset();
        }
      }, (error) => {
        console.error('[App] Firebase Auth error:', error);
        // Continue without auth if there's an error
        setIsLoggedIn(false);
        setCurrentScreen('login');
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('[App] Error setting up auth listener:', error);
      // Continue without auth if there's an error
      setIsLoggedIn(false);
      setCurrentScreen('login');
    }
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
        // Auth state listener will handle the rest
      } else {
        // Create new user account
        console.log('[App] Attempting to create new user:', email);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log('[App] User creation successful:', userCredential.user.uid);
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
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your connection.';
            break;
          case 'auth/app-not-initialized':
            errorMessage = 'Firebase is not initialized. Please restart the app.';
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
    navigateToScreen('workout');
  };

  const handleNavigateToFitness = () => {
    navigateToScreen('fitness');
  };

  const handleNavigateToMental = () => {
    navigateToScreen('mental');
  };

  const handleNavigateToEmotional = () => {
    navigateToScreen('emotional');
  };

  const handleNavigateToAI = () => {
    navigateToScreen('ai');
  };

  const handleNavigateToSettings = () => {
    navigateToScreen('settings');
  };

  const handleNavigateToSpiritual = () => {
    navigateToScreen('spiritual');
  };

  const handleNavigateToHealth = () => {
    navigateToScreen('health');
  };

  const handleBackToDashboard = () => {
    setCurrentScreen('dashboard');
  };

  const handleGoBack = () => {
    // Get the previous screen from navigation history
    if (navigationHistory.length > 1) {
      const previousScreen = navigationHistory[navigationHistory.length - 2];
      setNavigationHistory(prev => prev.slice(0, -1)); // Remove current screen from history
      setCurrentScreen(previousScreen);
    } else {
      // If no history, default to dashboard
      setCurrentScreen('dashboard');
    }
  };

  const navigateToScreen = (screen: 'login' | 'dashboard' | 'workout' | 'fitness' | 'mental' | 'emotional' | 'ai' | 'settings' | 'spiritual' | 'health') => {
    setNavigationHistory(prev => {
      // Don't add the same screen twice in a row
      if (prev[prev.length - 1] !== screen) {
        return [...prev, screen];
      }
      return prev;
    });
    setCurrentScreen(screen);
  };

  // Show Workout Screen
  if (isLoggedIn && currentScreen === 'workout') {
    return (
      <ToastProvider>
        <SmoothTransition isVisible={true} direction="slideInRight">
          <SwipeNavigation onSwipeBack={handleGoBack}>
            <WorkoutScreen onBack={handleGoBack} />
          </SwipeNavigation>
        </SmoothTransition>
      </ToastProvider>
    );
  }

  // Show Fitness Screen
  if (isLoggedIn && currentScreen === 'fitness') {
    const handleFitnessSwipeBack = () => {
      // Check if FitnessScreen has an internal back handler (for sub-screens)
      const internalHandler = (FitnessScreen as any).internalBackHandler;
      if (internalHandler) {
        internalHandler();
      } else {
        handleGoBack();
      }
    };

    return (
      <ToastProvider>
        <SmoothTransition isVisible={true} direction="slideInRight">
          <SwipeNavigation onSwipeBack={handleFitnessSwipeBack}>
            <FitnessScreen 
              onBack={handleGoBack} 
              onCompleteTask={(taskTitle: string) => {
                // This will be handled by the Dashboard component
                console.log('Task completed:', taskTitle);
              }}
            />
          </SwipeNavigation>
        </SmoothTransition>
      </ToastProvider>
    );
  }

  // Show Mental Screen
  if (isLoggedIn && currentScreen === 'mental') {
    return (
      <ToastProvider>
        <SmoothTransition isVisible={true} direction="slideInRight">
          <SwipeNavigation onSwipeBack={handleGoBack}>
            <MentalScreen onBack={handleGoBack} onCompleteTask={(taskTitle: string) => {
              // This will be handled by the Dashboard component
              console.log('Task completed:', taskTitle);
            }} />
          </SwipeNavigation>
        </SmoothTransition>
      </ToastProvider>
    );
  }

  // Show Emotional Screen
  if (isLoggedIn && currentScreen === 'emotional') {
    return (
      <ToastProvider>
        <SmoothTransition isVisible={true} direction="slideInRight">
          <SwipeNavigation onSwipeBack={handleGoBack}>
            <EmotionalScreen onBack={handleGoBack} onCompleteTask={(taskTitle: string) => {
              // This will be handled by the Dashboard component
              console.log('Task completed:', taskTitle);
            }} />
          </SwipeNavigation>
        </SmoothTransition>
      </ToastProvider>
    );
  }

  // Show Spiritual Screen
  if (isLoggedIn && currentScreen === 'spiritual') {
    return (
      <ToastProvider>
        <SmoothTransition isVisible={true} direction="slideInRight">
          <SwipeNavigation onSwipeBack={handleGoBack}>
            <SpiritualScreen onBack={handleGoBack} onCompleteTask={(taskTitle: string) => {
              // This will be handled by the Dashboard component
              console.log('Task completed:', taskTitle);
            }} />
          </SwipeNavigation>
        </SmoothTransition>
      </ToastProvider>
    );
  }

  // Show Settings Screen
  if (isLoggedIn && currentScreen === 'settings') {
    return (
      <ToastProvider>
        <SmoothTransition isVisible={true} direction="slideInRight">
          <SwipeNavigation onSwipeBack={handleGoBack}>
            <SettingsScreen onBack={handleGoBack} onLogout={handleLogout} />
          </SwipeNavigation>
        </SmoothTransition>
      </ToastProvider>
    );
  }

  // Show Health Screen
  if (isLoggedIn && currentScreen === 'health') {
    return (
      <ToastProvider>
        <SmoothTransition isVisible={true} direction="slideInRight">
          <SwipeNavigation onSwipeBack={handleGoBack}>
            <HealthScreen onBack={handleGoBack} />
          </SwipeNavigation>
        </SmoothTransition>
      </ToastProvider>
    );
  }

  // Show Dashboard if logged in
  if (isLoggedIn && currentScreen === 'dashboard') {
    return (
      <ToastProvider>
        <SmoothTransition isVisible={true} direction="fadeIn">
          <Dashboard onLogout={handleLogout} onNavigateToFitness={handleNavigateToFitness} onNavigateToMental={handleNavigateToMental} onNavigateToEmotional={handleNavigateToEmotional} onNavigateToAI={handleNavigateToAI} onNavigateToSettings={handleNavigateToSettings} onNavigateToSpiritual={handleNavigateToSpiritual} onNavigateToHealth={handleNavigateToHealth} />
        </SmoothTransition>
      </ToastProvider>
    );
  }

  // Show Login Screen
  return (
    <ToastProvider>
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
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
              />
            </View>

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
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPassword}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowForgotPassword(false);
          setResetEmail('');
          setResetMethod(null);
        }}
      >
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
                  >
                    <Text style={styles.modalBackButtonText}>Back</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </ToastProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
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
    color: '#00ff88',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 30,
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
    color: '#888',
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
    backgroundColor: '#3a3a3a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#4a4a4a',
  },
  button: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  toggleButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  toggleText: {
    fontSize: 16,
    color: '#00ff88',
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
    fontSize: 16,
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
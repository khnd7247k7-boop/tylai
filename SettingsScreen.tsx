import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Switch,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { AppTextInput as TextInput } from './src/components/AppTextInput';
import * as FileSystem from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveUserData, loadUserData, clearAllUserData } from './src/utils/userStorage';
import { subscribeUserDataReady } from './src/utils/userDataEvents';
import {
  COACH_MOCK_HEALTH_KEY,
  DEFAULT_COACH_MOCK_HEALTH,
  type CoachMockHealthSettings,
} from './src/constants/coachMockHealth';
import { updateNotificationSchedule } from './src/utils/notifications';
import { NOTICE_CONTENT, LICENSE_CONTENT, LICENSING_SUMMARY_CONTENT, THIRD_PARTY_CONTENT } from './src/constants/legalDocuments';
import {
  PRIVACY_POLICY_CONTENT,
  TERMS_OF_SERVICE_CONTENT,
  FITNESS_DISCLAIMER_CONTENT,
  AI_DISCLAIMER_CONTENT,
} from './src/constants/legalPolicies';
import {
  MEDICAL_DISCLAIMER_SHORT,
  APPLE_HEALTH_PRIVACY_SUMMARY,
  WORKOUT_LIABILITY_WAIVER_SHORT,
  AI_DISCLAIMER_SHORT,
  PRIVACY_SUMMARY_SHORT,
  LOCAL_DATA_DELETION_FOOTNOTE,
} from './src/constants/complianceDisclosures';
import { scheduleSummaryLine } from './src/utils/trainingSchedule';
import { COPYRIGHT_NOTICE } from './src/constants/copyright';
import { LEGAL_COMPANY_NAME, LEGAL_EFFECTIVE_DATE } from './src/constants/legalMeta';
import { AppTheme } from './src/theme/appVisualTheme';
import { getStayLoggedInPreference, setStayLoggedInPreference } from './src/utils/stayLoggedIn';
import { KeyboardSafeView } from './src/keyboard';
import type { Auth } from 'firebase/auth';
import { useUserSettings } from './SettingsProvider';
import { useSubscription } from './src/context/SubscriptionContext';
import { tierLabel } from './src/constants/featureTiers';
import { formatStripePlanLabel } from './src/services/betaAccessService';
import {
  loadCoachingProfile,
  saveCoachingProfileDraft,
  syncCoachingProfileToUserProfile,
} from './src/services/CoachingProfileService';
import {
  PRIMARY_GOAL_LABELS,
  type CoachingProfile,
  type ChallengeDial,
  isCoachingProfileComplete,
} from './src/types/coachingProfile';

interface UserProfile {
  name: string;
  email: string;
  age: string;
  sex: 'male' | 'female' | 'other' | '';
  height: string;
  weight: string;
  fitnessGoal: string;
  secondaryGoals?: string[];
  experienceLevel: string;
  injuries?: string;
  limitations?: string;
  daysPerWeek?: number;
  equipmentAvailability?: string;
  preferredWorkoutLength?: number; // in minutes
  nutritionGoals?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    water: number;
  };
}

interface AppSettings {
  notifications: boolean;
  hapticFeedback: boolean;
  darkMode: boolean;
  autoBackup: boolean;
  reminderTime: string;
  language: string;
  healthDataSyncEnabled: boolean;
}

interface InterfaceSettings {
  theme: 'dark' | 'light' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  animations: boolean;
  compactMode: boolean;
  showProgressBars: boolean;
}

interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
  onEditCoachingQuestionnaire?: () => void;
  initialTab?: 'profile' | 'interface' | 'settings' | 'legal';
  /** When true, show only the section matching initialTab (opened from More menu). */
  standaloneSection?: boolean;
}

const SECTION_HEADERS: Record<'profile' | 'interface' | 'settings' | 'legal', string> = {
  profile: 'Profile',
  interface: 'Interface',
  settings: 'Settings',
  legal: 'Legal',
};

export default function SettingsScreen({
  onBack,
  onLogout,
  onEditCoachingQuestionnaire,
  initialTab = 'profile',
  standaloneSection = false,
}: SettingsScreenProps) {
  const { showPredictiveWeight, enableMacroPreview, autoRestTimer, setPreference } = useUserSettings();
  const {
    tier,
    isPremium,
    presentUpgrade,
    restorePurchases,
    setDevPremiumOverride,
    basicFeatures,
    premiumFeatures,
    stripeStatus,
    manageBilling,
  } = useSubscription();
  const [activeTab, setActiveTab] = useState<'profile' | 'interface' | 'settings' | 'legal'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    age: '',
    sex: '',
    height: '',
    weight: '',
    fitnessGoal: 'General Fitness',
    experienceLevel: 'Beginner',
  });
  const [settings, setSettings] = useState<AppSettings>({
    notifications: true,
    hapticFeedback: true,
    darkMode: true,
    autoBackup: true,
    reminderTime: '09:00',
    language: 'English',
    healthDataSyncEnabled: true,
  });
  const [interfaceSettings, setInterfaceSettings] = useState<InterfaceSettings>({
    theme: 'dark',
    fontSize: 'medium',
    animations: true,
    compactMode: false,
    showProgressBars: true,
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [coachMockHealth, setCoachMockHealth] = useState<CoachMockHealthSettings>(DEFAULT_COACH_MOCK_HEALTH);
  const [coachingProfile, setCoachingProfile] = useState<CoachingProfile | null>(null);

  const loadDocument = (documentName: string) => {
    let title = '';
    let content = '';
    
    switch (documentName) {
      case 'NOTICE':
        title = 'NOTICE - Third-Party Notices and Licenses';
        content = NOTICE_CONTENT;
        break;
      case 'LICENSE':
        title = 'LICENSE - Apache License 2.0';
        content = LICENSE_CONTENT;
        break;
      case 'LICENSING_SUMMARY':
        title = 'Licensing Summary';
        content = LICENSING_SUMMARY_CONTENT;
        break;
      case 'THIRD_PARTY':
        title = 'Third Party Notices - TypeScript';
        content = THIRD_PARTY_CONTENT;
        break;
      case 'PRIVACY_POLICY':
        title = 'Privacy Policy';
        content = PRIVACY_POLICY_CONTENT;
        break;
      case 'TERMS_OF_SERVICE':
        title = 'Terms of Service';
        content = TERMS_OF_SERVICE_CONTENT;
        break;
      case 'FITNESS_DISCLAIMER':
        title = 'Fitness & Wellness Disclaimer';
        content = FITNESS_DISCLAIMER_CONTENT;
        break;
      case 'AI_DISCLAIMER':
        title = 'AI Disclaimer';
        content = AI_DISCLAIMER_CONTENT;
        break;
      default:
        return;
    }
    
    setDocumentContent(content);
    setSelectedDocument(title);
    setShowDocumentModal(true);
  };

  useEffect(() => {
    loadSettingsData();
    return subscribeUserDataReady(loadSettingsData);
  }, []);

  const loadSettingsData = async () => {
    try {
      const savedProfile = await loadUserData<UserProfile>('userProfile');
      const savedSettings = await loadUserData<AppSettings>('appSettings');
      const savedInterfaceSettings = await loadUserData<InterfaceSettings>('interfaceSettings');
      
      if (savedProfile) {
        setProfile(savedProfile);
      }
      if (savedSettings) {
        setSettings(savedSettings);
      }
      if (savedInterfaceSettings) {
        setInterfaceSettings(savedInterfaceSettings);
      }
      setStayLoggedIn(await getStayLoggedInPreference());
      const savedMock = await loadUserData<Partial<CoachMockHealthSettings>>(COACH_MOCK_HEALTH_KEY);
      if (savedMock) {
        setCoachMockHealth({
          enabled: !!savedMock.enabled,
          mindfulMinutesMock: savedMock.mindfulMinutesMock === 20 ? 20 : 0,
        });
      } else {
        setCoachMockHealth(DEFAULT_COACH_MOCK_HEALTH);
      }
      const cp = await loadCoachingProfile();
      setCoachingProfile(cp.completedAt ? cp : null);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const saveProfile = async (updatedProfile: UserProfile) => {
    try {
      await saveUserData('userProfile', updatedProfile);
      setProfile(updatedProfile);
      // no notification
    } catch (error) {
      console.error('Error saving profile:', error);
      // no notification
    }
  };

  const saveSettings = async (updatedSettings: AppSettings) => {
    try {
      await saveUserData('appSettings', updatedSettings);
      setSettings(updatedSettings);
      // Update notification schedule when settings change
      await updateNotificationSchedule();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const saveInterfaceSettings = async (updatedSettings: InterfaceSettings) => {
    try {
      await saveUserData('interfaceSettings', updatedSettings);
      setInterfaceSettings(updatedSettings);
    } catch (error) {
      console.error('Error saving interface settings:', error);
    }
  };

  const persistCoachMockHealth = async (next: CoachMockHealthSettings) => {
    try {
      setCoachMockHealth(next);
      await saveUserData(COACH_MOCK_HEALTH_KEY, next);
    } catch (error) {
      console.error('Error saving coach mock health:', error);
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      // Sign out from Firebase (data persists for next login)
      try {
        const { signOut } = await import('firebase/auth');
        const { auth } = (await import('./firebaseConfig')) as { auth: Auth };
        await signOut(auth);
        // Auth state listener in App.tsx will handle the rest
      } catch (firebaseError) {
        console.error('Firebase sign out error:', firebaseError);
        // Still proceed with logout
      }
      
      setShowLogoutModal(false);
      // Call onLogout to navigate to login screen
      onLogout();
    } catch (error) {
      console.error('Error during logout:', error);
      // Still try to logout even if there's an error
      setShowLogoutModal(false);
      onLogout();
    }
  };

  const renderSubscriptionSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Subscription</Text>
      <View style={styles.subscriptionStatusRow}>
        <Text style={styles.settingLabel}>Current plan</Text>
        <Text style={[styles.subscriptionTierPill, isPremium && styles.subscriptionTierPillPremium]}>
          {tierLabel(tier)}
        </Text>
      </View>
      <Text style={styles.settingDescription}>
        Basic includes workout tracking, your plans, nutrition & macros, and all trends. Premium adds Gemini AI
        Coach, Food coach, and AI Workout builder.
      </Text>
      {stripeStatus?.active && formatStripePlanLabel(stripeStatus.plan) ? (
        <Text style={styles.settingDescription}>
          Stripe plan: {formatStripePlanLabel(stripeStatus.plan)}
          {stripeStatus.cancelAtPeriodEnd ? ' · Cancels at period end' : ''}
        </Text>
      ) : null}

      {!isPremium ? (
        <TouchableOpacity style={styles.subscriptionPrimaryBtn} onPress={presentUpgrade} activeOpacity={0.88}>
          <Text style={styles.subscriptionPrimaryBtnText}>Upgrade to Premium</Text>
        </TouchableOpacity>
      ) : null}

      {stripeStatus?.active ? (
        <TouchableOpacity
          style={styles.subscriptionPrimaryBtn}
          onPress={() => void manageBilling()}
          activeOpacity={0.88}
        >
          <Text style={styles.subscriptionPrimaryBtnText}>Manage billing</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.subscriptionSecondaryBtn} onPress={() => restorePurchases()} activeOpacity={0.7}>
        <Text style={styles.subscriptionSecondaryBtnText}>Restore purchases</Text>
      </TouchableOpacity>

      <Text style={[styles.settingDescription, { marginTop: 14, marginBottom: 6 }]}>Included with Basic</Text>
      {basicFeatures.slice(0, 6).map((f) => (
        <Text key={f.id} style={styles.subscriptionFeatureLine}>
          • {f.label}
        </Text>
      ))}
      <Text style={[styles.settingDescription, { marginTop: 10, marginBottom: 6 }]}>Premium (Gemini)</Text>
      {premiumFeatures.map((f) => (
        <Text key={f.id} style={styles.subscriptionFeatureLine}>
          • {f.label}
        </Text>
      ))}

      {__DEV__ ? (
        <View style={[styles.settingRow, { marginTop: 16 }]}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Premium (dev override)</Text>
            <Text style={styles.settingDescription}>Simulate an active subscription for testing gates.</Text>
          </View>
          <Switch
            value={isPremium}
            onValueChange={(v) => void setDevPremiumOverride(v)}
            trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
            thumbColor={isPremium ? '#fff' : '#888'}
          />
        </View>
      ) : null}
    </View>
  );

  const renderProfileTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={profile.name}
            onChangeText={(text) => setProfile({ ...profile, name: text })}
            placeholder="Enter your full name"
            editable={isEditingProfile}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={profile.email}
            onChangeText={(text) => setProfile({ ...profile, email: text })}
            placeholder="Enter your email"
            keyboardType="email-address"
            editable={isEditingProfile}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Age</Text>
          <TextInput
            style={styles.input}
            value={profile.age}
            onChangeText={(text) => setProfile({ ...profile, age: text })}
            placeholder="Enter your age"
            keyboardType="numeric"
            editable={isEditingProfile}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Height</Text>
          <TextInput
            style={styles.input}
            value={profile.height}
            onChangeText={(text) => setProfile({ ...profile, height: text })}
            placeholder="e.g., 5 feet 8 inches or 173cm"
            editable={isEditingProfile}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Weight</Text>
          <TextInput
            style={styles.input}
            value={profile.weight}
            onChangeText={(text) => setProfile({ ...profile, weight: text })}
            placeholder="e.g., 150 lbs or 68 kg"
            keyboardType="numeric"
            editable={isEditingProfile}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coaching profile</Text>
        <Text style={styles.settingDescription}>
          Your goals, schedule, equipment, and body stats from onboarding. Update the full questionnaire
          if your goals change or you want to fix an answer.
        </Text>
        {onEditCoachingQuestionnaire ? (
          <TouchableOpacity
            style={[styles.guideReplayRow, { marginTop: 10, marginBottom: 12 }]}
            onPress={onEditCoachingQuestionnaire}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Update coaching questionnaire"
          >
            <View style={styles.settingLabelContainer}>
              <Text style={styles.settingLabel}>Update questionnaire</Text>
              <Text style={styles.settingDescription}>
                Revisit goals, training days, experience, injuries, and nutrition targets.
              </Text>
            </View>
            <Text style={styles.guideReplayChevron}>▶</Text>
          </TouchableOpacity>
        ) : null}
        {coachingProfile && isCoachingProfileComplete(coachingProfile) ? (
          <>
            <Text style={styles.coachingReadonlyLine}>
              Goal:{' '}
              {coachingProfile.goalProfile.primaryGoal
                ? PRIMARY_GOAL_LABELS[coachingProfile.goalProfile.primaryGoal]
                : '—'}
            </Text>
            <Text style={styles.coachingReadonlyLine}>
              Schedule: {scheduleSummaryLine(coachingProfile.scheduleProfile)}
            </Text>
            <Text style={styles.coachingReadonlyLine}>
              Experience: {coachingProfile.experienceProfile.level}
            </Text>
            <Text style={styles.coachingReadonlyLine}>
              Equipment: {coachingProfile.equipmentProfile.access?.replace(/_/g, ' ')}
            </Text>
            <Text style={[styles.label, { marginTop: 16 }]}>Challenge dial</Text>
            <View style={styles.challengeRow}>
              {(['easy', 'balanced', 'maximum'] as ChallengeDial[]).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.challengeChip,
                    coachingProfile.adherenceProfile.challengeDial === d &&
                      styles.challengeChipActive,
                  ]}
                  onPress={async () => {
                    const next = {
                      ...coachingProfile,
                      adherenceProfile: { ...coachingProfile.adherenceProfile, challengeDial: d },
                    };
                    setCoachingProfile(next);
                    await saveCoachingProfileDraft(next, 8);
                    await syncCoachingProfileToUserProfile(next);
                  }}
                >
                  <Text
                    style={[
                      styles.challengeChipText,
                      coachingProfile.adherenceProfile.challengeDial === d &&
                        styles.challengeChipTextActive,
                    ]}
                  >
                    {d === 'easy'
                      ? 'Easy'
                      : d === 'balanced'
                        ? 'Balanced'
                        : 'Max'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {isEditingProfile ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Exercises you enjoy</Text>
                  <TextInput
                    style={styles.input}
                    value={coachingProfile.preferenceProfile.likedExercises ?? ''}
                    onChangeText={(text) =>
                      setCoachingProfile({
                        ...coachingProfile,
                        preferenceProfile: {
                          ...coachingProfile.preferenceProfile,
                          likedExercises: text,
                        },
                      })
                    }
                    placeholder="Optional"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Exercises to avoid</Text>
                  <TextInput
                    style={styles.input}
                    value={coachingProfile.preferenceProfile.dislikedExercises ?? ''}
                    onChangeText={(text) =>
                      setCoachingProfile({
                        ...coachingProfile,
                        preferenceProfile: {
                          ...coachingProfile.preferenceProfile,
                          dislikedExercises: text,
                        },
                      })
                    }
                    placeholder="Optional"
                  />
                </View>
              </>
            ) : null}
          </>
        ) : (
          <Text style={styles.settingDescription}>
            Complete onboarding after sign-in to build your coaching profile, or tap Update questionnaire
            above when available.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account details</Text>
        {isEditingProfile ? (
          <>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={async () => {
                await saveProfile(profile);
                if (coachingProfile) {
                  await saveCoachingProfileDraft(coachingProfile, 8);
                  await syncCoachingProfileToUserProfile(coachingProfile);
                }
                setIsEditingProfile(false);
              }}
            >
              <Text style={styles.buttonText}>Save Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={async () => {
                await loadSettingsData();
                setIsEditingProfile(false);
              }}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.editButton]}
            onPress={() => setIsEditingProfile(true)}
          >
            <Text style={styles.buttonText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Logout Button - Only in Profile section */}
      <View style={styles.logoutSection}>
        <TouchableOpacity 
          style={[styles.logoutButton]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSettingsTab = () => (
    <View style={styles.tabContent}>
      {renderSubscriptionSection()}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Push Notifications</Text>
          <Switch
            value={settings.notifications}
            onValueChange={(value) => {
              const newSettings = { ...settings, notifications: value };
              setSettings(newSettings);
              saveSettings(newSettings);
            }}
            trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
            thumbColor={settings.notifications ? '#fff' : '#888'}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Daily Reminders</Text>
          <Switch
            value={settings.reminderTime !== 'Off'}
            onValueChange={(value) => {
              const newSettings = { 
                ...settings, 
                reminderTime: value ? '09:00' : 'Off' 
              };
              setSettings(newSettings);
              saveSettings(newSettings);
            }}
            trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
            thumbColor={settings.reminderTime !== 'Off' ? '#fff' : '#888'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Preferences</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Show predictive workout target</Text>
            <Text style={styles.settingDescription}>
              Displays a target card with suggested load and reps from previous performance.
            </Text>
          </View>
          <Switch
            value={showPredictiveWeight}
            onValueChange={(value) => setPreference('showPredictiveWeight', value)}
            trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
            thumbColor={showPredictiveWeight ? '#fff' : '#888'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Enable macro impact preview</Text>
            <Text style={styles.settingDescription}>
              Shows current vs predicted macros in nutrition search before adding food.
            </Text>
          </View>
          <Switch
            value={enableMacroPreview}
            onValueChange={(value) => setPreference('enableMacroPreview', value)}
            trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
            thumbColor={enableMacroPreview ? '#fff' : '#888'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Auto rest timer after set log</Text>
            <Text style={styles.settingDescription}>
              Automatically starts a 2:00 timer when a set is logged.
            </Text>
          </View>
          <Switch
            value={autoRestTimer}
            onValueChange={(value) => setPreference('autoRestTimer', value)}
            trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
            thumbColor={autoRestTimer ? '#fff' : '#888'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Stay logged in</Text>
            <Text style={styles.settingDescription}>
              Keep your session on this device so you don&apos;t need to sign in every time you open the app
            </Text>
          </View>
          <Switch
            value={stayLoggedIn}
            onValueChange={(value) => {
              if (!value) {
                Alert.alert(
                  'Turn off stay logged in?',
                  'You will be signed out now. When stay logged in is off, you will also be signed out whenever you leave the app.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign out',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await setStayLoggedInPreference(false);
                          setStayLoggedIn(false);
                          const { signOut } = await import('firebase/auth');
                          const { auth } = (await import('./firebaseConfig')) as { auth: Auth };
                          await signOut(auth);
                        } catch (e) {
                          console.error('Error updating stay logged in:', e);
                        }
                      },
                    },
                  ]
                );
                return;
              }
              setStayLoggedInPreference(true)
                .then(() => setStayLoggedIn(true))
                .catch((e) => console.error('Error saving stay logged in:', e));
            }}
            trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
            thumbColor={stayLoggedIn ? '#fff' : '#888'}
          />
        </View>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Haptic Feedback</Text>
          <Switch
            value={settings.hapticFeedback}
            onValueChange={(value) => {
              const newSettings = { ...settings, hapticFeedback: value };
              setSettings(newSettings);
              saveSettings(newSettings);
            }}
            trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
            thumbColor={settings.hapticFeedback ? '#fff' : '#888'}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Auto Backup Data</Text>
          <Switch
            value={settings.autoBackup}
            onValueChange={(value) => {
              const newSettings = { ...settings, autoBackup: value };
              setSettings(newSettings);
              saveSettings(newSettings);
            }}
            trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
            thumbColor={settings.autoBackup ? '#fff' : '#888'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Coach (testing)</Text>
        <Text style={styles.settingDescription}>
          Override mindful minutes for the Dashboard AI Coach only. Real Apple Health reads still run for
          charts unless sync is off; this mock only replaces the coach snapshot so you can compare replies.
        </Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Mock health data</Text>
            <Text style={styles.settingDescription}>
              When on, the coach uses the simulated mindful minutes below instead of HealthKit for that field.
            </Text>
          </View>
          <Switch
            value={coachMockHealth.enabled}
            onValueChange={(value) => {
              void persistCoachMockHealth({ ...coachMockHealth, enabled: value });
            }}
            trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
            thumbColor={coachMockHealth.enabled ? '#fff' : '#888'}
          />
        </View>

        {coachMockHealth.enabled && (
          <View style={styles.mockMindfulBlock}>
            <Text style={styles.settingLabel}>Simulated mindful minutes</Text>
            <View style={styles.optionButtons}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  coachMockHealth.mindfulMinutesMock === 0 && styles.optionButtonActive,
                ]}
                onPress={() => void persistCoachMockHealth({ ...coachMockHealth, mindfulMinutesMock: 0 })}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    coachMockHealth.mindfulMinutesMock === 0 && styles.optionButtonTextActive,
                  ]}
                >
                  0 min
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  coachMockHealth.mindfulMinutesMock === 20 && styles.optionButtonActive,
                ]}
                onPress={() => void persistCoachMockHealth({ ...coachMockHealth, mindfulMinutesMock: 20 })}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    coachMockHealth.mindfulMinutesMock === 20 && styles.optionButtonTextActive,
                  ]}
                >
                  20 min
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Export Data</Text>
          <Text style={styles.actionButtonSubtext}>Download your wellness data</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Import Data</Text>
          <Text style={styles.actionButtonSubtext}>Restore from backup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={() =>
            Alert.alert(
              'Delete data on this device?',
              `This removes wellness data stored locally for your account on this phone (workouts, logs, preferences in this app). This cannot be undone.\n\n${LOCAL_DATA_DELETION_FOOTNOTE}`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete local data',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await clearAllUserData();
                      try {
                        const HealthService = (await import('./src/services/HealthService')).default;
                        HealthService.clearPermissionCache();
                      } catch {
                        /* optional module */
                      }
                      setProfile({
                        name: '',
                        email: '',
                        age: '',
                        sex: '',
                        height: '',
                        weight: '',
                        fitnessGoal: 'General Fitness',
                        experienceLevel: 'Beginner',
                      });
                      setSettings({
                        notifications: true,
                        hapticFeedback: true,
                        darkMode: true,
                        autoBackup: true,
                        reminderTime: '09:00',
                        language: 'English',
                        healthDataSyncEnabled: true,
                      });
                      setInterfaceSettings({
                        theme: 'dark',
                        fontSize: 'medium',
                        animations: true,
                        compactMode: false,
                        showProgressBars: true,
                      });
                      setHealthDataPerms(DEFAULT_HEALTH_DATA_PERMISSIONS);
                      setCoachMockHealth(DEFAULT_COACH_MOCK_HEALTH);
                      setCoachingProfile(null);
                      await saveUserData(COACH_MOCK_HEALTH_KEY, DEFAULT_COACH_MOCK_HEALTH);
                      await saveHealthDataPermissions(DEFAULT_HEALTH_DATA_PERMISSIONS);
                      await updateNotificationSchedule();
                      Alert.alert(
                        'Local data removed',
                        'Your wellness data for this account has been deleted from this device. The app no longer stores those personal metrics here. If you use cloud sign-in, deleting your account may require a separate step with your provider.'
                      );
                    } catch (e) {
                      console.error('Local data wipe failed:', e);
                      Alert.alert(
                        'Could not finish',
                        'Something went wrong while deleting data. Try again or reinstall the app.'
                      );
                    }
                  },
                },
              ]
            )
          }
        >
          <Text style={styles.actionButtonText}>Delete data on this device</Text>
          <Text style={styles.actionButtonSubtext}>
            Erase local wellness data for this account (right to be forgotten on device)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderInterfaceTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Theme</Text>
          <View style={styles.optionButtons}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                interfaceSettings.theme === 'dark' && styles.optionButtonActive
              ]}
              onPress={() => {
                const newSettings: InterfaceSettings = { ...interfaceSettings, theme: 'dark' };
                setInterfaceSettings(newSettings);
                saveInterfaceSettings(newSettings);
              }}
            >
              <Text style={[
                styles.optionButtonText,
                interfaceSettings.theme === 'dark' && styles.optionButtonTextActive
              ]}>Dark</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.optionButton,
                interfaceSettings.theme === 'light' && styles.optionButtonActive
              ]}
              onPress={() => {
                const newSettings: InterfaceSettings = { ...interfaceSettings, theme: 'light' };
                setInterfaceSettings(newSettings);
                saveInterfaceSettings(newSettings);
              }}
            >
              <Text style={[
                styles.optionButtonText,
                interfaceSettings.theme === 'light' && styles.optionButtonTextActive
              ]}>Light</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.optionButton,
                interfaceSettings.theme === 'auto' && styles.optionButtonActive
              ]}
              onPress={() => {
                const newSettings: InterfaceSettings = { ...interfaceSettings, theme: 'auto' };
                setInterfaceSettings(newSettings);
                saveInterfaceSettings(newSettings);
              }}
            >
              <Text style={[
                styles.optionButtonText,
                interfaceSettings.theme === 'auto' && styles.optionButtonTextActive
              ]}>Auto</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Font Size</Text>
          <View style={styles.optionButtons}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                interfaceSettings.fontSize === 'small' && styles.optionButtonActive
              ]}
              onPress={() => {
                const newSettings: InterfaceSettings = { ...interfaceSettings, fontSize: 'small' };
                setInterfaceSettings(newSettings);
                saveInterfaceSettings(newSettings);
              }}
            >
              <Text style={[
                styles.optionButtonText,
                interfaceSettings.fontSize === 'small' && styles.optionButtonTextActive
              ]}>Small</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.optionButton,
                interfaceSettings.fontSize === 'medium' && styles.optionButtonActive
              ]}
              onPress={() => {
                const newSettings: InterfaceSettings = { ...interfaceSettings, fontSize: 'medium' };
                setInterfaceSettings(newSettings);
                saveInterfaceSettings(newSettings);
              }}
            >
              <Text style={[
                styles.optionButtonText,
                interfaceSettings.fontSize === 'medium' && styles.optionButtonTextActive
              ]}>Medium</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.optionButton,
                interfaceSettings.fontSize === 'large' && styles.optionButtonActive
              ]}
              onPress={() => {
                const newSettings: InterfaceSettings = { ...interfaceSettings, fontSize: 'large' };
                setInterfaceSettings(newSettings);
                saveInterfaceSettings(newSettings);
              }}
            >
              <Text style={[
                styles.optionButtonText,
                interfaceSettings.fontSize === 'large' && styles.optionButtonTextActive
              ]}>Large</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Animations</Text>
          <Switch
            value={interfaceSettings.animations}
            onValueChange={(value) => {
              const newSettings: InterfaceSettings = { ...interfaceSettings, animations: value };
              setInterfaceSettings(newSettings);
              saveInterfaceSettings(newSettings);
            }}
            trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
            thumbColor={interfaceSettings.animations ? '#fff' : '#888'}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Compact Mode</Text>
          <Switch
            value={interfaceSettings.compactMode}
            onValueChange={(value) => {
              const newSettings: InterfaceSettings = { ...interfaceSettings, compactMode: value };
              setInterfaceSettings(newSettings);
              saveInterfaceSettings(newSettings);
            }}
            trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
            thumbColor={interfaceSettings.compactMode ? '#fff' : '#888'}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Show Progress Bars</Text>
          <Switch
            value={interfaceSettings.showProgressBars}
            onValueChange={(value) => {
              const newSettings: InterfaceSettings = { ...interfaceSettings, showProgressBars: value };
              setInterfaceSettings(newSettings);
              saveInterfaceSettings(newSettings);
            }}
            trackColor={{ false: '#3a3a3a', true: AppTheme.accent }}
            thumbColor={interfaceSettings.showProgressBars ? '#fff' : '#888'}
          />
        </View>
      </View>
    </View>
  );

  const renderLegalTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Copyright</Text>
        <Text style={styles.complianceBlock}>{COPYRIGHT_NOTICE}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Policies & disclaimers</Text>
        <Text style={styles.sectionDescription}>
          Full legal documents for {LEGAL_COMPANY_NAME}. Effective {LEGAL_EFFECTIVE_DATE}.
        </Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.documentButton}
          onPress={() => loadDocument('PRIVACY_POLICY')}
        >
          <Text style={styles.documentButtonTitle}>Privacy Policy</Text>
          <Text style={styles.documentButtonSubtext}>
            Data collection, use, rights, and third-party services
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.documentButton}
          onPress={() => loadDocument('TERMS_OF_SERVICE')}
        >
          <Text style={styles.documentButtonTitle}>Terms of Service</Text>
          <Text style={styles.documentButtonSubtext}>
            Eligibility, billing, acceptable use, and governing law
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.documentButton}
          onPress={() => loadDocument('FITNESS_DISCLAIMER')}
        >
          <Text style={styles.documentButtonTitle}>Fitness Disclaimer</Text>
          <Text style={styles.documentButtonSubtext}>
            Not medical advice; exercise risks and physician consultation
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.documentButton}
          onPress={() => loadDocument('AI_DISCLAIMER')}
        >
          <Text style={styles.documentButtonTitle}>AI Disclaimer</Text>
          <Text style={styles.documentButtonSubtext}>
            AI accuracy limits; not for medical or emergency use
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summaries</Text>
        <Text style={styles.complianceBlock}>{PRIVACY_SUMMARY_SHORT}</Text>
        <Text style={styles.complianceHeading}>Fitness & wellness</Text>
        <Text style={styles.complianceBlock}>{MEDICAL_DISCLAIMER_SHORT}</Text>
        <Text style={styles.complianceHeading}>Apple Health & connected data</Text>
        <Text style={styles.complianceBlock}>{APPLE_HEALTH_PRIVACY_SUMMARY}</Text>
        <Text style={styles.complianceHeading}>AI features</Text>
        <Text style={styles.complianceBlock}>{AI_DISCLAIMER_SHORT}</Text>
        <Text style={styles.complianceHeading}>Workouts & liability</Text>
        <Text style={styles.complianceBlock}>{WORKOUT_LIABILITY_WAIVER_SHORT}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Open-source & licenses</Text>
        <Text style={styles.sectionDescription}>
          Third-party software notices and license texts.
        </Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.documentButton}
          onPress={() => loadDocument('NOTICE')}
        >
          <Text style={styles.documentButtonTitle}>NOTICE</Text>
          <Text style={styles.documentButtonSubtext}>
            Third-party notices and licenses
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.documentButton}
          onPress={() => loadDocument('LICENSE')}
        >
          <Text style={styles.documentButtonTitle}>LICENSE</Text>
          <Text style={styles.documentButtonSubtext}>
            Apache License 2.0
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.documentButton}
          onPress={() => loadDocument('LICENSING_SUMMARY')}
        >
          <Text style={styles.documentButtonTitle}>Licensing Summary</Text>
          <Text style={styles.documentButtonSubtext}>
            Overview of licenses and compliance
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.documentButton}
          onPress={() => loadDocument('THIRD_PARTY')}
        >
          <Text style={styles.documentButtonTitle}>Third Party Notices</Text>
          <Text style={styles.documentButtonSubtext}>
            TypeScript third-party notices
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardSafeView style={{ flex: 1 }}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {standaloneSection ? SECTION_HEADERS[activeTab] : 'Settings'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {!standaloneSection ? (
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'profile' && styles.tabButtonActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'profile' && styles.tabButtonTextActive]}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'interface' && styles.tabButtonActive]}
          onPress={() => setActiveTab('interface')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'interface' && styles.tabButtonTextActive]}>Interface</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'settings' && styles.tabButtonActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'settings' && styles.tabButtonTextActive]}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'legal' && styles.tabButtonActive]}
          onPress={() => setActiveTab('legal')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'legal' && styles.tabButtonTextActive]}>Legal</Text>
        </TouchableOpacity>
      </View>
      ) : null}

      {/* Content */}
      <ScrollView
        style={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'interface' && renderInterfaceTab()}
        {activeTab === 'settings' && renderSettingsTab()}
        {activeTab === 'legal' && renderLegalTab()}
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowLogoutModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.confirmLogoutModalCard}>
            <Text style={styles.modalTitle}>Confirm Logout</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to logout? All your data will be saved and you can continue where you left off when you sign back in.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalLogoutTint]}
                onPress={confirmLogout}
              >
                <Text style={styles.modalButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Document Viewer Modal */}
      <Modal
        visible={showDocumentModal}
        animationType="none"
        onRequestClose={() => setShowDocumentModal(false)}
      >
        <SafeAreaView style={styles.documentModalContainer}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>{selectedDocument || 'Document'}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowDocumentModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.documentContent} showsVerticalScrollIndicator={true}>
            <Text style={styles.documentText}>{documentContent || 'Loading...'}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      </KeyboardSafeView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: AppTheme.accent,
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 50,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: AppTheme.card,
    marginHorizontal: 20,
    marginVertical: 15,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: AppTheme.accent,
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppTheme.textMuted,
  },
  tabButtonTextActive: {
    color: AppTheme.accentDark,
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  contentContainer: {
    flex: 1,
  },
  section: {
    marginBottom: 30,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#121212',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  guideReplayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  subscriptionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subscriptionTierPill: {
    color: AppTheme.textMuted,
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  subscriptionTierPillPremium: {
    color: '#111',
    backgroundColor: AppTheme.accent,
  },
  subscriptionPrimaryBtn: {
    marginTop: 12,
    backgroundColor: AppTheme.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  subscriptionPrimaryBtnText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '800',
  },
  subscriptionSecondaryBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 8,
  },
  subscriptionSecondaryBtnText: {
    color: AppTheme.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionFeatureLine: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 4,
  },
  guideReplayChevron: {
    color: AppTheme.accent,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  settingLabelContainer: {
    flex: 1,
    marginRight: 15,
  },
  settingDescription: {
    fontSize: 12,
    color: AppTheme.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  settingDescriptionMuted: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
    lineHeight: 15,
    fontStyle: 'italic',
  },
  healthCategoriesIntro: {
    fontSize: 13,
    color: '#aaa',
    lineHeight: 18,
    marginTop: 16,
    marginBottom: 8,
  },
  secondaryActionButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  secondaryActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryActionButtonSubtext: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
    lineHeight: 16,
  },
  complianceHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
    marginBottom: 6,
  },
  complianceBlock: {
    fontSize: 14,
    color: '#bbb',
    lineHeight: 20,
  },
  coachingReadonlyLine: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
    lineHeight: 20,
  },
  challengeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  challengeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  challengeChipActive: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
  },
  challengeChipText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
  },
  challengeChipTextActive: {
    color: AppTheme.accent,
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  editButton: {
    backgroundColor: AppTheme.accent,
  },
  saveButton: {
    backgroundColor: AppTheme.accent,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppTheme.accentDark,
  },
  actionButton: {
    backgroundColor: AppTheme.card,
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  dangerButton: {
    borderColor: '#ff4444',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  actionButtonSubtext: {
    fontSize: 14,
    color: '#888',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  infoLabel: {
    fontSize: 16,
    color: '#ccc',
  },
  infoValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmLogoutModalCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 25,
    marginHorizontal: 30,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
  },
  modalMessage: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  modalLogoutTint: {
    backgroundColor: '#ff4444',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  mockMindfulBlock: {
    marginTop: 8,
    marginBottom: 4,
  },
  optionButtons: {
    flexDirection: 'row',
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3a3a3a',
    borderWidth: 1,
    borderColor: '#555',
    marginRight: 10,
  },
  optionButtonActive: {
    backgroundColor: AppTheme.accent,
    borderColor: AppTheme.accent,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppTheme.textMuted,
  },
  optionButtonTextActive: {
    color: AppTheme.accentDark,
  },
  sectionDescription: {
    fontSize: 14,
    color: AppTheme.textMuted,
    marginBottom: 20,
    lineHeight: 20,
  },
  documentButton: {
    backgroundColor: '#121212',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  documentButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  documentButtonSubtext: {
    fontSize: 14,
    color: AppTheme.textMuted,
  },
  documentModalContainer: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
    backgroundColor: AppTheme.card,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: AppTheme.accent,
    borderRadius: 8,
  },
  closeButtonText: {
    color: AppTheme.accentDark,
    fontSize: 16,
    fontWeight: '600',
  },
  documentContent: {
    flex: 1,
    padding: 20,
  },
  documentText: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logoutSection: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: '#ff4444',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});

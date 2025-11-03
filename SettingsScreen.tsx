import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  Switch,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveUserData, loadUserData, clearAllUserData } from './src/utils/userStorage';
import { updateNotificationSchedule } from './src/utils/notifications';

interface UserProfile {
  name: string;
  email: string;
  age: string;
  height: string;
  weight: string;
  fitnessGoal: string;
  experienceLevel: string;
}

interface AppSettings {
  notifications: boolean;
  hapticFeedback: boolean;
  darkMode: boolean;
  autoBackup: boolean;
  reminderTime: string;
  language: string;
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
}

export default function SettingsScreen({ onBack, onLogout }: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'interface' | 'settings'>('profile');
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    age: '',
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

  useEffect(() => {
    loadSettingsData();
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

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      // Clear all user-specific data
      await clearAllUserData();
      
      // Also sign out from Firebase
      try {
        const { signOut } = await import('firebase/auth');
        const { auth } = await import('./firebaseConfig');
        await signOut(auth);
      } catch (firebaseError) {
        console.error('Firebase sign out error:', firebaseError);
        // Continue with logout even if Firebase sign out fails
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
        <Text style={styles.sectionTitle}>Fitness Goals</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fitness Goal</Text>
          <TextInput
            style={styles.input}
            value={profile.fitnessGoal}
            onChangeText={(text) => setProfile({ ...profile, fitnessGoal: text })}
            placeholder="e.g., Weight Loss, Muscle Gain, General Fitness"
            editable={isEditingProfile}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Experience Level</Text>
          <TextInput
            style={styles.input}
            value={profile.experienceLevel}
            onChangeText={(text) => setProfile({ ...profile, experienceLevel: text })}
            placeholder="e.g., Beginner, Intermediate, Advanced"
            editable={isEditingProfile}
          />
        </View>
      </View>

      <View style={styles.buttonContainer}>
        {isEditingProfile ? (
          <>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={() => {
                saveProfile(profile);
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
            trackColor={{ false: '#3a3a3a', true: '#4ECDC4' }}
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
            trackColor={{ false: '#3a3a3a', true: '#4ECDC4' }}
            thumbColor={settings.reminderTime !== 'Off' ? '#fff' : '#888'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Preferences</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Haptic Feedback</Text>
          <Switch
            value={settings.hapticFeedback}
            onValueChange={(value) => {
              const newSettings = { ...settings, hapticFeedback: value };
              setSettings(newSettings);
              saveSettings(newSettings);
            }}
            trackColor={{ false: '#3a3a3a', true: '#4ECDC4' }}
            thumbColor={settings.hapticFeedback ? '#fff' : '#888'}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Dark Mode</Text>
          <Switch
            value={settings.darkMode}
            onValueChange={(value) => {
              const newSettings = { ...settings, darkMode: value };
              setSettings(newSettings);
              saveSettings(newSettings);
            }}
            trackColor={{ false: '#3a3a3a', true: '#4ECDC4' }}
            thumbColor={settings.darkMode ? '#fff' : '#888'}
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
            trackColor={{ false: '#3a3a3a', true: '#4ECDC4' }}
            thumbColor={settings.autoBackup ? '#fff' : '#888'}
          />
        </View>
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
          onPress={() => Alert.alert(
            'Clear All Data',
            'This will permanently delete all your wellness data. This action cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Delete All', 
                style: 'destructive',
                onPress: () => {
                  // Clear all data logic here
                  Alert.alert('Data Cleared', 'All data has been deleted');
                }
              }
            ]
          )}
        >
          <Text style={styles.actionButtonText}>Clear All Data</Text>
          <Text style={styles.actionButtonSubtext}>Permanently delete all data</Text>
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
                const newSettings = { ...interfaceSettings, theme: 'dark' };
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
                const newSettings = { ...interfaceSettings, theme: 'light' };
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
                const newSettings = { ...interfaceSettings, theme: 'auto' };
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
                const newSettings = { ...interfaceSettings, fontSize: 'small' };
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
                const newSettings = { ...interfaceSettings, fontSize: 'medium' };
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
                const newSettings = { ...interfaceSettings, fontSize: 'large' };
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
              const newSettings = { ...interfaceSettings, animations: value };
              setInterfaceSettings(newSettings);
              saveInterfaceSettings(newSettings);
            }}
            trackColor={{ false: '#3a3a3a', true: '#4ECDC4' }}
            thumbColor={interfaceSettings.animations ? '#fff' : '#888'}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Compact Mode</Text>
          <Switch
            value={interfaceSettings.compactMode}
            onValueChange={(value) => {
              const newSettings = { ...interfaceSettings, compactMode: value };
              setInterfaceSettings(newSettings);
              saveInterfaceSettings(newSettings);
            }}
            trackColor={{ false: '#3a3a3a', true: '#4ECDC4' }}
            thumbColor={interfaceSettings.compactMode ? '#fff' : '#888'}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Show Progress Bars</Text>
          <Switch
            value={interfaceSettings.showProgressBars}
            onValueChange={(value) => {
              const newSettings = { ...interfaceSettings, showProgressBars: value };
              setInterfaceSettings(newSettings);
              saveInterfaceSettings(newSettings);
            }}
            trackColor={{ false: '#3a3a3a', true: '#4ECDC4' }}
            thumbColor={interfaceSettings.showProgressBars ? '#fff' : '#888'}
          />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
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
      </View>

      {/* Content */}
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'interface' && renderInterfaceTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowLogoutModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContainer}>
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
                style={[styles.modalButton, styles.logoutButton]}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: '#4ECDC4',
    fontSize: 16,
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
    backgroundColor: '#2a2a2a',
    marginHorizontal: 20,
    marginVertical: 15,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#4ECDC4',
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
  },
  tabButtonTextActive: {
    color: '#1a1a1a',
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  contentContainer: {
    flex: 1,
  },
  section: {
    marginBottom: 30,
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
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#555',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
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
    backgroundColor: '#4ECDC4',
  },
  saveButton: {
    backgroundColor: '#00ff88',
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  actionButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
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
  modalContainer: {
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
  logoutButton: {
    backgroundColor: '#ff4444',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
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
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  optionButtonTextActive: {
    color: '#1a1a1a',
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

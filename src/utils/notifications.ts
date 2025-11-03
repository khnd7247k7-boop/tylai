import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { loadUserData } from './userStorage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface AppSettings {
  notifications: boolean;
  reminderTime: string;
  [key: string]: any;
}

// Request notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push notification permissions');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

// Cancel all scheduled notifications
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Schedule daily notification
export async function scheduleDailyNotification(time: string = '09:00') {
  try {
    // Cancel existing daily notifications first
    await cancelAllNotifications();
    
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return false;
    }
    
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Daily Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4ECDC4',
      });
    }
    
    // Schedule notification for every day at the specified time
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Daily Wellness Check-in 🌟",
        body: "Time to focus on your wellness journey! Complete your daily tasks and check in.",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { type: 'daily_reminder' },
      },
      trigger: {
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });
    
    console.log(`Daily notification scheduled for ${time}`);
    return true;
  } catch (error) {
    console.error('Error scheduling daily notification:', error);
    return false;
  }
}

// Update notification schedule based on user settings
export async function updateNotificationSchedule() {
  try {
    const settings = await loadUserData<AppSettings>('appSettings');
    
    if (settings?.notifications && settings?.reminderTime && settings.reminderTime !== 'Off') {
      await scheduleDailyNotification(settings.reminderTime);
      console.log('Notifications enabled and scheduled');
    } else {
      await cancelAllNotifications();
      console.log('Notifications disabled');
    }
  } catch (error) {
    console.error('Error updating notification schedule:', error);
  }
}

// Get all scheduled notifications (for debugging)
export async function getAllScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}


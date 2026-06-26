import { Platform } from 'react-native';
import { loadUserData } from './userStorage';

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null | undefined;
let handlerConfigured = false;

async function getNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  if (notificationsModule !== undefined) return notificationsModule;
  try {
    const mod = await import('expo-notifications');
    if (!handlerConfigured) {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      handlerConfigured = true;
    }
    notificationsModule = mod;
    return mod;
  } catch (error) {
    console.warn('[notifications] Native module unavailable:', error);
    notificationsModule = null;
    return null;
  }
}

export interface AppSettings {
  notifications: boolean;
  reminderTime: string;
  [key: string]: any;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return false;

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

export async function cancelAllNotifications() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleDailyNotification(time: string = '09:00') {
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return false;

    await cancelAllNotifications();

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return false;
    }

    const [hours, minutes] = time.split(':').map(Number);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Daily Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4ECDC4',
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Wellness Check-in 🌟',
        body: 'Time to focus on your wellness journey! Complete your daily tasks and check in.',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { type: 'daily_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      },
    });

    console.log(`Daily notification scheduled for ${time}`);
    return true;
  } catch (error) {
    console.error('Error scheduling daily notification:', error);
    return false;
  }
}

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

export async function getAllScheduledNotifications() {
  const Notifications = await getNotifications();
  if (!Notifications) return [];
  return Notifications.getAllScheduledNotificationsAsync();
}

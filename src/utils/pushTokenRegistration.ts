/**
 * Register / clear Expo push tokens for the Smart Notification Engine.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { requestNotificationPermissions } from './notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'tyl_push_device_id';

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

function projectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ||
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId
  );
}

export async function registerExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const uid = auth?.currentUser?.uid;
  if (!uid || !db || auth?._isMock) return null;

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  try {
    const Notifications = await import('expo-notifications');
    const pid = projectId();
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      pid ? { projectId: pid } : undefined
    );
    const token = tokenResult?.data;
    if (!token || !token.startsWith('ExponentPushToken')) {
      console.warn('[pushToken] unexpected token', token);
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('smart_coach', {
        name: 'Smart Coach',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const deviceId = await getOrCreateDeviceId();
    await setDoc(
      doc(db, 'users', uid, 'devices', deviceId),
      {
        expoPushToken: token,
        platform: Platform.OS,
        updatedAt: new Date().toISOString(),
        appVersion: Constants.expoConfig?.version ?? null,
      },
      { merge: true }
    );
    console.log('[pushToken] registered for', uid);
    return token;
  } catch (e) {
    console.warn('[pushToken] registration failed', e);
    return null;
  }
}

export async function clearExpoPushToken(): Promise<void> {
  const uid = auth?.currentUser?.uid;
  if (!uid || !db || auth?._isMock) return;
  try {
    const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) return;
    await deleteDoc(doc(db, 'users', uid, 'devices', deviceId));
  } catch (e) {
    console.warn('[pushToken] clear failed', e);
  }
}

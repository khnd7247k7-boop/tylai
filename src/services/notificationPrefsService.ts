/**
 * Load/save Smart Notification prefs to Firestore (canonical for the engine).
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import {
  DEFAULT_SMART_NOTIFICATION_PREFS,
  type SmartNotificationPrefs,
} from '../types/smartNotifications';

function prefsRef(uid: string) {
  // Document path must have an even number of segments.
  return doc(db, 'users', uid, 'notificationPrefs', 'settings');
}

export async function loadSmartNotificationPrefs(): Promise<SmartNotificationPrefs> {
  const uid = auth?.currentUser?.uid;
  if (!uid || !db || auth?._isMock) {
    return { ...DEFAULT_SMART_NOTIFICATION_PREFS, categories: { ...DEFAULT_SMART_NOTIFICATION_PREFS.categories } };
  }
  try {
    const snap = await getDoc(prefsRef(uid));
    if (!snap.exists()) {
      return {
        ...DEFAULT_SMART_NOTIFICATION_PREFS,
        categories: { ...DEFAULT_SMART_NOTIFICATION_PREFS.categories },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_SMART_NOTIFICATION_PREFS.timezone,
      };
    }
    const raw = snap.data() as Partial<SmartNotificationPrefs>;
    return {
      ...DEFAULT_SMART_NOTIFICATION_PREFS,
      ...raw,
      categories: {
        ...DEFAULT_SMART_NOTIFICATION_PREFS.categories,
        ...(raw.categories || {}),
      },
    };
  } catch (e) {
    console.warn('[notificationPrefs] load failed', e);
    return {
      ...DEFAULT_SMART_NOTIFICATION_PREFS,
      categories: { ...DEFAULT_SMART_NOTIFICATION_PREFS.categories },
    };
  }
}

export async function saveSmartNotificationPrefs(
  prefs: SmartNotificationPrefs
): Promise<void> {
  const uid = auth?.currentUser?.uid;
  if (!uid || !db || auth?._isMock) return;
  const payload: SmartNotificationPrefs = {
    ...prefs,
    categories: { ...prefs.categories },
    updatedAt: new Date().toISOString(),
    timezone:
      prefs.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      DEFAULT_SMART_NOTIFICATION_PREFS.timezone,
  };
  await setDoc(prefsRef(uid), payload, { merge: true });
}

/** True when smart engine should suppress the legacy local daily reminder. */
export function shouldSuppressLegacyDailyReminder(prefs: SmartNotificationPrefs): boolean {
  return prefs.enabled === true;
}

/**
 * TYL Smart Notification Engine — Cloud Functions entrypoints.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { evaluateUser, listUserIdsWithDevices } from './evaluate';

initializeApp();

const geminiApiKey = defineString('GEMINI_API_KEY', { default: '' });
const expoAccessToken = defineString('EXPO_ACCESS_TOKEN', { default: '' });

/**
 * Runs every hour. For each user with a registered device, evaluate daily state
 * and send at most the remaining daily budget (0–2) of smart pushes.
 */
export const evaluateSmartNotifications = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'America/Denver',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async () => {
    const db = getFirestore();
    const uids = await listUserIdsWithDevices(db, 400);
    console.log(`[smartNotifications] evaluating ${uids.length} user(s)`);

    let sentTotal = 0;
    const reasons: Record<string, number> = {};

    // Process in small batches to stay under timeout
    for (let i = 0; i < uids.length; i += 10) {
      const batch = uids.slice(i, i + 10);
      const results = await Promise.all(
        batch.map((uid) =>
          evaluateUser(db, uid, {
            geminiApiKey: geminiApiKey.value() || process.env.GEMINI_API_KEY || '',
            expoAccessToken: expoAccessToken.value() || process.env.EXPO_ACCESS_TOKEN || '',
          }).catch((err) => {
            console.warn(`[smartNotifications] user ${uid} failed`, err);
            return { uid, sent: 0, skippedReason: 'error' as const };
          })
        )
      );
      for (const r of results) {
        sentTotal += r.sent;
        if (r.skippedReason) {
          reasons[r.skippedReason] = (reasons[r.skippedReason] || 0) + 1;
        }
      }
    }

    console.log(`[smartNotifications] sent=${sentTotal}`, reasons);
  }
);

/**
 * Client reports open / action / dismiss for fatigue learning.
 */
export const reportSmartNotificationEvent = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  const uid = request.auth.uid;
  const historyId = String(request.data?.historyId || '').trim();
  const event = String(request.data?.event || '').trim(); // opened | acted | dismissed
  if (!historyId || !['opened', 'acted', 'dismissed'].includes(event)) {
    throw new HttpsError('invalid-argument', 'historyId and event required');
  }

  const db = getFirestore();
  const ref = db.doc(`users/${uid}/notificationHistory/${historyId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Notification not found');
  }

  const patch: Record<string, string> = {};
  const now = new Date().toISOString();
  if (event === 'opened') patch.openedAt = now;
  if (event === 'acted') {
    patch.actedAt = now;
    patch.openedAt = snap.data()?.openedAt || now;
  }
  if (event === 'dismissed') patch.dismissedAt = now;

  await ref.update(patch);

  if (event === 'dismissed') {
    const type = snap.data()?.type as string | undefined;
    if (type) {
      const stateRef = db.doc(`users/${uid}/smartNotificationState/current`);
      const stateSnap = await stateRef.get();
      const counts = {
        ...((stateSnap.data()?.categoryIgnoreCounts as Record<string, number>) || {}),
      };
      counts[type] = (counts[type] || 0) + 1;
      await stateRef.set({ categoryIgnoreCounts: counts }, { merge: true });
    }
  }

  return { ok: true };
});

/** Manual trigger for a single user (admin testing via callable). */
export const evaluateSmartNotificationsForMe = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  const db = getFirestore();
  const result = await evaluateUser(db, request.auth.uid, {
    geminiApiKey: geminiApiKey.value() || process.env.GEMINI_API_KEY || '',
    expoAccessToken: expoAccessToken.value() || process.env.EXPO_ACCESS_TOKEN || '',
  });
  return result;
});

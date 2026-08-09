/**
 * Per-user evaluation + send pipeline.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { buildUserDailyState } from './dailyState';
import { runCandidatePipeline } from './scoring';
import { maybeRewriteWithGemini } from './gemini';
import { pushDataForCandidate, sendExpoPush } from './push';
import {
  DEFAULT_NOTIFICATION_PREFS,
  type DeviceDoc,
  type NotificationCategory,
  type NotificationPrefs,
  type SmartNotificationState,
} from './types';

function mergePrefs(raw: unknown): NotificationPrefs {
  const base = {
    ...DEFAULT_NOTIFICATION_PREFS,
    categories: { ...DEFAULT_NOTIFICATION_PREFS.categories },
  };
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<NotificationPrefs>;
  return {
    enabled: r.enabled !== false,
    intensity: r.intensity === 'minimal' || r.intensity === 'high' ? r.intensity : 'balanced',
    categories: {
      ...base.categories,
      ...(r.categories || {}),
    },
    timezone: typeof r.timezone === 'string' && r.timezone ? r.timezone : base.timezone,
    quietHoursStart: Number.isFinite(r.quietHoursStart)
      ? Number(r.quietHoursStart)
      : base.quietHoursStart,
    quietHoursEnd: Number.isFinite(r.quietHoursEnd)
      ? Number(r.quietHoursEnd)
      : base.quietHoursEnd,
    updatedAt: r.updatedAt,
  };
}

async function loadEngineState(db: Firestore, uid: string): Promise<SmartNotificationState> {
  const snap = await db.doc(`users/${uid}/smartNotificationState/current`).get();
  const d = snap.data() as SmartNotificationState | undefined;
  return {
    lastEvaluatedAt: d?.lastEvaluatedAt ?? null,
    sentTodayCount: d?.sentTodayCount ?? 0,
    sentTodayDateKey: d?.sentTodayDateKey ?? null,
    recentCategoryTimestamps: d?.recentCategoryTimestamps ?? {},
    recentMilestoneIds: d?.recentMilestoneIds ?? [],
    categoryIgnoreCounts: d?.categoryIgnoreCounts ?? {},
  };
}

async function loadRecentHistoryMeta(
  db: Firestore,
  uid: string,
  dateKey: string
): Promise<{
  notificationsToday: number;
  recentTypes: NotificationCategory[];
  ignoredCategories: NotificationCategory[];
}> {
  const snap = await db
    .collection(`users/${uid}/notificationHistory`)
    .orderBy('sentAt', 'desc')
    .limit(30)
    .get()
    .catch(async () => {
      // Index may not exist yet — fall back to unordered limit
      return db.collection(`users/${uid}/notificationHistory`).limit(30).get();
    });

  const recentTypes: NotificationCategory[] = [];
  const ignored = new Map<NotificationCategory, number>();
  let notificationsToday = 0;

  snap.docs.forEach((doc) => {
    const data = doc.data() as {
      type?: NotificationCategory;
      sentAt?: string;
      localDateKey?: string;
      openedAt?: string | null;
      dismissedAt?: string | null;
    };
    if (data.localDateKey === dateKey) {
      notificationsToday += 1;
    }
    if (data.type) {
      recentTypes.push(data.type);
      if (!data.openedAt && data.dismissedAt) {
        ignored.set(data.type, (ignored.get(data.type) || 0) + 1);
      }
      if (!data.openedAt && data.sentAt) {
        const age = Date.now() - Date.parse(data.sentAt);
        if (age > 48 * 60 * 60 * 1000) {
          ignored.set(data.type, (ignored.get(data.type) || 0) + 1);
        }
      }
    }
  });

  const ignoredCategories = [...ignored.entries()]
    .filter(([, n]) => n >= 2)
    .map(([t]) => t);

  return { notificationsToday, recentTypes, ignoredCategories };
}

export type EvaluateResult = {
  uid: string;
  sent: number;
  skippedReason?: string;
};

export async function evaluateUser(
  db: Firestore,
  uid: string,
  env: { geminiApiKey?: string; expoAccessToken?: string }
): Promise<EvaluateResult> {
  const devicesSnap = await db.collection(`users/${uid}/devices`).limit(5).get();
  if (devicesSnap.empty) {
    return { uid, sent: 0, skippedReason: 'no_device' };
  }
  const tokens = devicesSnap.docs
    .map((d) => (d.data() as DeviceDoc).expoPushToken)
    .filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken'));

  if (!tokens.length) {
    return { uid, sent: 0, skippedReason: 'no_token' };
  }

  const prefsSnap = await db.doc(`users/${uid}/notificationPrefs/settings`).get();
  const prefs = mergePrefs(prefsSnap.data());
  if (!prefs.enabled) {
    return { uid, sent: 0, skippedReason: 'prefs_disabled' };
  }

  const appSettingsSnap = await db.doc(`users/${uid}/appData/appSettings`).get();
  const appSettingsRaw = appSettingsSnap.data() as { value?: { notifications?: boolean } } | undefined;
  const appSettingsVal = appSettingsRaw?.value ?? (appSettingsRaw as { notifications?: boolean } | undefined);
  if (appSettingsVal && appSettingsVal.notifications === false) {
    return { uid, sent: 0, skippedReason: 'app_settings_off' };
  }

  let engineState = await loadEngineState(db, uid);

  // Bootstrap date with a lightweight state build
  const bootstrap = await buildUserDailyState(db, uid, prefs.timezone, {
    notificationsToday: 0,
    recentTypes: [],
    ignoredCategories: [],
  });

  if (engineState.sentTodayDateKey !== bootstrap.localDateKey) {
    engineState = {
      ...engineState,
      sentTodayCount: 0,
      sentTodayDateKey: bootstrap.localDateKey,
    };
  }

  const historyForDay = await loadRecentHistoryMeta(db, uid, bootstrap.localDateKey);
  const state = {
    ...bootstrap,
    notificationHistory: {
      notificationsToday: engineState.sentTodayCount,
      recentTypes: historyForDay.recentTypes,
      ignoredCategories: historyForDay.ignoredCategories,
    },
  };

  // Merge ignore counts into engine state for scoring
  for (const cat of historyForDay.ignoredCategories) {
    engineState.categoryIgnoreCounts = {
      ...engineState.categoryIgnoreCounts,
      [cat]: Math.max(engineState.categoryIgnoreCounts?.[cat] ?? 0, 2),
    };
  }

  const winners = runCandidatePipeline(state, prefs, engineState);
  if (!winners.length) {
    await db.doc(`users/${uid}/smartNotificationState/current`).set(
      {
        lastEvaluatedAt: new Date().toISOString(),
        sentTodayCount: engineState.sentTodayCount,
        sentTodayDateKey: state.localDateKey,
        recentCategoryTimestamps: engineState.recentCategoryTimestamps,
        recentMilestoneIds: engineState.recentMilestoneIds ?? [],
        categoryIgnoreCounts: engineState.categoryIgnoreCounts ?? {},
      },
      { merge: true }
    );
    return { uid, sent: 0, skippedReason: 'no_candidates' };
  }

  let sent = 0;
  const recentCategoryTimestamps = { ...engineState.recentCategoryTimestamps };
  const recentMilestoneIds = [...(engineState.recentMilestoneIds ?? [])];

  for (const candidate of winners) {
    const rewritten = await maybeRewriteWithGemini(candidate, state.coachingTone, {
      apiKey: env.geminiApiKey || '',
      force: prefs.intensity === 'high',
    });

    const historyRef = db.collection(`users/${uid}/notificationHistory`).doc();
    const historyId = historyRef.id;
    const data = pushDataForCandidate(candidate, historyId);

    let delivered = false;
    let lastError: string | undefined;
    for (const token of tokens) {
      const result = await sendExpoPush({
        token,
        title: rewritten.title,
        body: rewritten.message,
        data,
        accessToken: env.expoAccessToken,
      });
      if (result.ok) {
        delivered = true;
      } else {
        lastError = result.error;
      }
    }

    await historyRef.set({
      id: historyId,
      type: candidate.type,
      title: rewritten.title,
      body: rewritten.message,
      reason: candidate.reason,
      verifiedFacts: candidate.verifiedFacts,
      action: candidate.action,
      priority: candidate.priority,
      combined: candidate.combined === true,
      usedAi: rewritten.usedAi,
      milestoneId: candidate.milestoneId ?? null,
      localDateKey: state.localDateKey,
      sentAt: new Date().toISOString(),
      deliveryStatus: delivered ? 'sent' : 'failed',
      deliveryError: delivered ? null : lastError || 'unknown',
      openedAt: null,
      actedAt: null,
      dismissedAt: null,
      candidateId: candidate.id,
    });

    if (delivered) {
      sent += 1;
      recentCategoryTimestamps[candidate.type] = new Date().toISOString();
      if (candidate.milestoneId && !recentMilestoneIds.includes(candidate.milestoneId)) {
        recentMilestoneIds.push(candidate.milestoneId);
      }
    }
  }

  await db.doc(`users/${uid}/smartNotificationState/current`).set(
    {
      lastEvaluatedAt: new Date().toISOString(),
      sentTodayCount: engineState.sentTodayCount + sent,
      sentTodayDateKey: state.localDateKey,
      recentCategoryTimestamps,
      recentMilestoneIds: recentMilestoneIds.slice(-40),
      categoryIgnoreCounts: engineState.categoryIgnoreCounts ?? {},
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { uid, sent };
}

/** Collect uids that have at least one device token registered. */
export async function listUserIdsWithDevices(db: Firestore, maxUsers = 500): Promise<string[]> {
  const snap = await db.collectionGroup('devices').limit(maxUsers * 3).get();
  const uids = new Set<string>();
  for (const doc of snap.docs) {
    const parts = doc.ref.path.split('/');
    if (parts[0] === 'users' && parts[1]) uids.add(parts[1]);
    if (uids.size >= maxUsers) break;
  }
  return [...uids];
}

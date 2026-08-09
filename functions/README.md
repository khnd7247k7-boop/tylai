# Smart Notification Engine (Cloud Functions)

## Setup

```bash
cd functions
npm install
npm run build
```

## Deploy

From repo root (requires Firebase CLI + project access):

```bash
firebase deploy --only functions,firestore:rules
```

Set secrets / params:

```bash
firebase functions:secrets:set GEMINI_API_KEY   # or use params in console
# Optional Expo push security:
firebase functions:config:set expo.token="..." 
```

With Functions v2 params, set `GEMINI_API_KEY` and `EXPO_ACCESS_TOKEN` in the Firebase console
or via `firebase functions:params:set`.

## Schedule

`evaluateSmartNotifications` uses `onSchedule('every 60 minutes')` — no separate
Cloud Scheduler job is required (Firebase creates it on deploy).

## Client

The app registers Expo push tokens at `users/{uid}/devices/{deviceId}` and writes
prefs to `users/{uid}/notificationPrefs/settings`.

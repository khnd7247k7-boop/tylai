# Privacy Settings & Data Protection Spec

Use this as a checklist when adding privacy controls and protecting credit card information, personal data, and health data.

---

## 1. Credit card & payment data

*(App does not currently process payments. Add these when integrating subscriptions or purchases.)*

- [ ] **Never store full card numbers (PAN)** — Use a payment provider (Stripe, RevenueCat, etc.) so card data is tokenized and never touches your servers or device storage.
- [ ] **PCI DSS** — If you ever handle card data directly, comply with PCI DSS; otherwise use a PCI-compliant provider and keep card fields out of your app (use their hosted UI or SDK).
- [ ] **No logging of card digits** — Ensure no payment method details are written to logs, analytics, or crash reports.
- [ ] **Setting:** Option to remove saved payment method (e.g. “Manage payment method” / “Remove card”) that clears tokens via the provider’s API.

---

## 2. Personal data (profile, account, usage)

**Currently stored (e.g. in AsyncStorage / Firebase):** user profile (name, email, age, sex, height, weight, goals, experience, injuries, equipment), workout history, meals, mood, gratitude, affirmations, saved plans.

- [ ] **Encryption at rest** — Sensitive profile and history stored encrypted (e.g. expo-secure-store for secrets, or encrypt before AsyncStorage). Document what is encrypted and with what key.
- [ ] **Privacy policy** — In-app link to a privacy policy that explains what data is collected, why, how long it’s kept, and who it’s shared with (including AI/analytics).
- [ ] **Consent** — Clear consent for optional data (e.g. health sync, analytics, marketing). Toggles in Settings, not pre-checked without consent.
- [ ] **Data retention** — Document and optionally enforce retention (e.g. delete workout history older than X years). Setting: “Auto-delete data older than [1 year / 2 years / never]”.
- [ ] **Account data export** — “Download my data” (GDPR-style) that exports profile + workout/meal/history in a readable format (JSON or CSV).
- [ ] **Account deletion** — “Delete my account” that: revokes Firebase Auth, clears all `user_{userId}_*` keys from AsyncStorage, and triggers deletion of that user’s data from any backend/Firestore. Confirm with a modal and optional “reason” dropdown.
- [ ] **In-app privacy settings section** — Single place for: data export, account deletion, health data sync on/off, analytics on/off, marketing on/off (if applicable).

---

## 3. Health & fitness data

*(Relevant if using HealthKit / Google Fit / smartwatch data.)*

- [ ] **Explicit permission** — Request health permissions only when the user turns on “Health data sync” (or similar); don’t request at install.
- [ ] **Setting:** “Health data sync” toggle (you already have `healthDataSyncEnabled`) — document that when OFF, no health data is read or stored.
- [ ] **Minimal use** — Only request and store the health data types you need (e.g. heart rate, workouts); document them in the privacy policy.
- [ ] **No resale** — Privacy policy states health data is never sold. If you use analytics, ensure health data is not sent to third-party analytics.
- [ ] **Region-specific rules** — HIPAA (US) and GDPR (EU) considerations for health-related data; if you act as a “business associate” or process health data in a regulated way, document compliance.

---

## 4. Authentication & device security

- [ ] **Secure storage for tokens** — Firebase Auth handles tokens; ensure no custom tokens or passwords are stored in plain AsyncStorage. Use secure storage for any API keys or refresh tokens if you add your own auth layer.
- [ ] **Logout** — On logout, clear all in-memory and local user data (you have `clearAllUserData`); confirm no sensitive data remains in state or storage for that user.
- [ ] **Optional:** Biometric / PIN to open app (e.g. expo-local-authentication) as a setting: “Require Face ID / fingerprint / PIN to open app”.

---

## 5. Third-party sharing & analytics

- [ ] **List third parties** — Document in privacy policy: Firebase (Auth, Firestore, etc.), any analytics (e.g. Expo, Sentry), and any AI APIs that receive user-generated content (e.g. workout descriptions).
- [ ] **Settings toggles** — “Share usage data for product improvement” (analytics) and “Use my data to personalize workouts” (if you send profile/workouts to AI). Off by default or clearly consented.
- [ ] **No sale of personal data** — Privacy policy states personal and health data are not sold. If you ever add advertising or data monetization, add explicit consent and a setting.

---

## 6. In-app privacy settings UI (suggested)

Add a **Privacy** or **Privacy & security** section in Settings (e.g. in `SettingsScreen.tsx`) with:

| Setting | Type | Purpose |
|--------|------|--------|
| Privacy policy | Link | Opens privacy policy URL |
| Download my data | Button | Triggers data export |
| Delete my account | Button | Triggers account deletion flow with confirmation |
| Health data sync | Toggle | Already present; ensure it gates all health reads/writes |
| Analytics / usage data | Toggle | If you add analytics, gate it here |
| Require app lock | Toggle | Optional: biometric/PIN to open app |
| Manage payment method | Link/Button | When payments exist; opens provider’s manage page or removes token |

---

## 7. Implementation notes

- **AsyncStorage** — Currently unencrypted. For highly sensitive fields (e.g. if you ever store a token or health snapshot), consider `expo-secure-store` or encrypting the value before `setItem`.
- **Firebase** — Use Security Rules so only the authenticated user can read/write their own document(s). Do not store payment card details in Firestore.
- **Logs** — Avoid logging PII (email, name, exact weights, etc.) in production; strip or redact in crash reporting.

When you add payments or new personal/health data, revisit this doc and tick off the relevant items.

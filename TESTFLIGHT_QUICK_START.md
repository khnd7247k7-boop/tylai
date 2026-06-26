# TestFlight — Quick Start (TYLAI)

Use the canonical project at **`~/Code/tyl-ai-app-local`** (not Desktop/iCloud).

| Item | Value |
|------|--------|
| App name | TYLAI |
| Bundle ID | `com.tyl-ai.tylai` |
| Apple Team ID | `TW87JL55MT` |
| EAS account | `tyl_ai` |
| Version | 1.0.0 (build auto-increments on EAS production) |

---

## Before your first build

### 1. App Store Connect — create the app

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** → **New App**
2. Platform: **iOS**
3. Name: **TYLAI**
4. Primary language: English
5. Bundle ID: select **`com.tyl-ai.tylai`** (register it first in [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list) if missing)
6. SKU: e.g. `tylai-ios`
7. User access: Full Access

**Enable HealthKit on the App ID** (Developer portal → Identifiers → `com.tyl-ai.tylai` → Capabilities → HealthKit).

Copy the **Apple ID** (numeric) from App Store Connect → App Information → General → Apple ID. Paste it into `eas.json` → `submit.production.ios.ascAppId`.

### 2. Deploy gemini-proxy for production (required for testers)

TestFlight builds **cannot** use `localhost` or your Mac LAN IP. Food search, restaurant search, and Gemini all go through the proxy.

**Full guide:** [`gemini-proxy/DEPLOY.md`](gemini-proxy/DEPLOY.md)

Quick version — deploy `gemini-proxy/` to **Cloud Run** or **Render** with:

- `GEMINI_KEY` (Google AI Studio + billing enabled)
- `FIREBASE_PROJECT_ID`
- `USDA_FDC_API_KEY` (free at [fdc.nal.usda.gov](https://fdc.nal.usda.gov/api-key-signup.html))
- `NUTRITIONIX_APP_ID` + `NUTRITIONIX_API_KEY` (restaurant menus — [developer.nutritionix.com](https://developer.nutritionix.com/))

Point a subdomain at it, e.g. `https://api.tyl-ai.com`, then verify:

```bash
curl https://api.tyl-ai.com/health
```

### 3. Set EAS secrets (one time)

From `~/Code/tyl-ai-app-local`:

```bash
npm install
npx eas login
npx eas init
```

Then set secrets for **production** builds.

Add to `.env.local` first:

```env
EXPO_PUBLIC_GEMINI_PROXY_URL=https://api.tyl-ai.com
EXPO_PUBLIC_BETA_ACCESS_API_URL=https://tyl-ai.com/api/beta-access
EXPO_PUBLIC_BETA_PAYMENT_URL=https://tyl-ai.com/join.html#pricing
```

Sync to EAS:

```bash
bash scripts/sync-eas-secrets.sh
```

Or set manually:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_GEMINI_PROXY_URL --value "https://YOUR-PRODUCTION-PROXY-URL"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_APP_ID --value "..."
```

Do **not** set `EXPO_PUBLIC_GRANT_PREMIUM` for production (production profile forces it off).

List secrets: `eas secret:list`

### 4. Link EAS project (if not done)

```bash
npm run eas:init
```

This adds `extra.eas.projectId` to your Expo config.

---

## Build & upload to TestFlight

```bash
cd ~/Code/tyl-ai-app-local
npm run eas:build:ios
```

Wait ~15–25 minutes. EAS builds in the cloud and handles distribution signing.

Submit to App Store Connect:

```bash
npm run eas:submit:ios
```

Or combine:

```bash
npm run testflight
```

First submit will prompt for Apple ID credentials or App Store Connect API key.

---

## After upload (App Store Connect)

1. Open **TestFlight** tab for TYLAI
2. Wait for **Processing** to finish (~5–15 min)
3. Answer **Export Compliance** — already set to standard encryption only (`ITSAppUsesNonExemptEncryption: false`)
4. Fill **Test Information** (what to test, contact email)
5. **Internal testing** — add yourself under Users and Access → Internal Testing (instant, up to 100)
6. **External testing** — create a group, add testers, submit for Beta App Review (first time only)

---

## App Store privacy (HealthKit)

Because the app uses HealthKit, in App Store Connect → App Privacy:

- Declare **Health & Fitness** data collection
- Describe use: personalized coaching, trends, recovery guidance
- Match your usage strings in `Info.plist`

---

## Checklist before inviting testers

Run the preflight script:

```bash
bash scripts/preflight-testflight.sh
```

Then self-test on your phone:

- [ ] Production gemini-proxy live (`curl https://api.tyl-ai.com/health`)
- [ ] EAS production secrets set (Firebase + **HTTPS** proxy URL)
- [ ] You paid on [join.html](https://tyl-ai.com/join.html) with the same email as the app
- [ ] TestFlight build processed; you installed it
- [ ] Food search returns results (USDA key on proxy)
- [ ] Restaurant / eating-out search works (Nutritionix + Gemini)
- [ ] AI coach / workout plan generates
- [ ] Onboarding “Build my plan” saves

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| AI features fail on TestFlight | Check `EXPO_PUBLIC_GEMINI_PROXY_URL` secret points to public HTTPS proxy |
| Build fails signing | Confirm Apple Developer membership is active; run build again — EAS creates certs |
| HealthKit crash / denied | Enable HealthKit capability on App ID + entitlements file |
| Version rejected | Bump `expo.version` in `app.json` for next store release; build number auto-increments |

---

## Commands reference

```bash
npm run eas:build:ios    # Production .ipa for App Store / TestFlight
npm run eas:submit:ios   # Upload latest build to App Store Connect
eas build:list           # View past builds
eas submit --platform ios --latest
```

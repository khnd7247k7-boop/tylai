# TestFlight Quick Start Guide

## ✅ Your App is TestFlight Ready!

Your Expo app is fully compatible with TestFlight. Here's what you need to do:

---

## Quick Setup (30 minutes)

### 1. Update app.json

Add these iOS configurations to your `app.json`:

```json
{
  "expo": {
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.tylai",  // ← ADD THIS (change to your company)
      "buildNumber": "1",                            // ← ADD THIS
      "infoPlist": {                                 // ← ADD THIS
        "NSCameraUsageDescription": "This app uses the camera to scan barcodes for meal tracking.",
        "NSPhotoLibraryUsageDescription": "This app needs access to your photo library to save images."
      }
    }
  }
}
```

**Important:** Replace `com.yourcompany.tylai` with your actual bundle identifier (e.g., `com.travispixton.tylai`)

### 2. Install EAS CLI

```bash
npm install -g eas-cli
```

### 3. Login to EAS

```bash
eas login
```

### 4. Configure EAS Build

```bash
eas build:configure
```

This creates an `eas.json` file automatically.

### 5. Build for iOS

```bash
eas build --platform ios
```

This will:
- Build your app in the cloud
- Take 10-20 minutes
- Generate an `.ipa` file ready for TestFlight

### 6. Submit to TestFlight

```bash
eas submit --platform ios
```

Or manually upload to App Store Connect.

---

## Required: Apple Developer Account

You'll need:
- **Apple Developer Program membership** ($99/year)
- **App Store Connect access**
- **TestFlight enabled** (automatic with Developer account)

---

## Do You Need Firestore First?

### ❌ **No - You can start TestFlight immediately!**

**Current setup works fine for TestFlight:**
- ✅ Firebase Auth works
- ✅ AsyncStorage works
- ✅ All features functional
- ✅ No blockers

**You can add Firestore later** while TestFlight is running.

---

## Recommended Timeline

### Week 1: TestFlight Setup
- Set up EAS
- Build iOS app
- Submit to TestFlight
- Invite 10-20 beta testers

### Week 2-3: Beta Testing + Firestore
- Collect feedback
- Fix bugs
- **Implement Firestore** (in parallel)
- Test Firestore locally

### Week 4: Update TestFlight
- Build new version with Firestore
- Submit update
- Expand beta group

---

## Cost

- **Apple Developer:** $99/year (required)
- **EAS Build:** Free tier available (limited builds)
- **Firebase:** Free tier (500-1,000 users)
- **Total:** $99/year minimum

---

## Next Steps

1. ✅ Get Apple Developer account
2. ✅ Update `app.json` (add bundle identifier)
3. ✅ Run `eas build:configure`
4. ✅ Run `eas build --platform ios`
5. ✅ Submit to TestFlight

**Time to first build: 2-4 hours** (mostly waiting)

---

## Need Help?

See `TESTFLIGHT_GUIDE.md` for detailed instructions.







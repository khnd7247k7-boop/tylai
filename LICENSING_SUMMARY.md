# Licensing and Compliance Summary

## Overview
This document provides a quick reference for licensing, copyright, and compliance requirements for the TYL AI App.

## Your App's License
- **License**: Apache License 2.0
- **Location**: `LICENSE.txt`
- **Status**: Permissive open-source license
- **Allows**: Commercial use, modification, distribution, private use
- **Requires**: Attribution, license notice, state changes

## Third-Party Dependencies

### Open Source (MIT License)
Most dependencies use the MIT License, which is very permissive:
- React, React Native, Expo
- React Navigation, Gesture Handler, Reanimated
- AsyncStorage, NetInfo
- All Expo packages

**MIT License Requirements:**
- Include copyright notice
- Include license text (included in NOTICE file)
- No restrictions on use

### Open Source (Apache 2.0)
- TypeScript (Microsoft)
- Firebase SDK (Google)

**Apache 2.0 Requirements:**
- Include copyright notice
- Include license text (in LICENSE.txt)
- Include NOTICE file (created)
- State changes if you modify

## Proprietary Services

### Services You're Using
1. **Firebase** (Google)
   - Terms: https://firebase.google.com/terms
   - Free tier available
   - Requires Google account

2. **Expo Services**
   - Terms: https://expo.dev/terms
   - Free tier available
   - Requires Expo account

3. **Apple HealthKit**
   - Requires: Apple Developer Program ($99/year)
   - Terms: Apple Developer Program License Agreement
   - Used via: expo-health package

4. **Google Fit / Health Connect**
   - Terms: Google Fit API Terms of Service
   - Free to use
   - Used via: expo-health package

### Distribution Platforms
- **Apple App Store**: Requires Apple Developer Program
- **Google Play Store**: Requires Google Play Developer account ($25 one-time)

## Patents
- **No specific patents identified** in your codebase
- Using standard open-source libraries and official platform APIs
- Platform APIs (HealthKit, Google Fit) are covered by platform licenses

## Copyright
- **Your code**: You own the copyright (or should verify ownership)
- **Third-party code**: Copyrighted by respective authors (listed in NOTICE)
- **TypeScript**: Includes third-party code (see ThirdPartyNoticeText.txt)

## Required Actions

### ✅ Already Done
- [x] LICENSE.txt (Apache 2.0)
- [x] NOTICE file (comprehensive attributions)
- [x] ThirdPartyNoticeText.txt (TypeScript notices)

### 📋 Recommended Actions

1. **Add NOTICE to App**
   - Include NOTICE file in app bundle
   - Show in Settings → About or Legal section
   - Or link from app store listings

2. **Privacy Policy**
   - Required for App Store/Play Store
   - Must disclose health data usage
   - Must comply with HIPAA/GDPR if applicable

3. **Terms of Service**
   - Recommended for commercial apps
   - Should cover health data usage

4. **App Store Compliance**
   - **iOS**: HealthKit usage requires privacy policy
   - **Android**: Health data access requires privacy policy
   - Both require clear permission descriptions

5. **Service Agreements**
   - Ensure compliance with:
     - Firebase Terms of Service
     - Expo Terms of Service
     - Apple Developer Program License
     - Google Play Developer Policy

## Health Data Compliance

### Legal Requirements
- **HIPAA** (US): If storing/transmitting health data, may need compliance
- **GDPR** (EU): Requires explicit consent, data portability, right to deletion
- **CCPA** (California): Similar to GDPR for California residents

### Best Practices
- ✅ Request explicit permission (you do this)
- ✅ Store data locally (you do this)
- ✅ Allow users to disable sync (you do this)
- ⚠️ Add privacy policy (recommended)
- ⚠️ Add data deletion option (recommended)

## Distribution Checklist

### Before Publishing
- [ ] Review NOTICE file
- [ ] Create Privacy Policy
- [ ] Create Terms of Service (if commercial)
- [ ] Verify all licenses are compatible
- [ ] Check service agreements compliance
- [ ] Test health data permissions flow
- [ ] Document health data usage

### App Store Requirements
- [ ] Privacy Policy URL
- [ ] Health data usage description
- [ ] Permission request descriptions
- [ ] Data collection disclosure

## Questions to Consider

1. **Commercial Use**: Are you selling the app or using it commercially?
   - If yes, ensure all licenses allow commercial use (they do)

2. **Health Data**: Are you storing/transmitting health data?
   - If yes, may need HIPAA compliance
   - If no, still need privacy policy for permissions

3. **Open Source**: Do you plan to open source your code?
   - Apache 2.0 is compatible with most open source licenses
   - You can choose to keep it private (package.json has "private": true)

4. **Contributors**: Do you have contributors?
   - Ensure they grant you rights to their contributions
   - Consider Contributor License Agreement (CLA)

## Resources

- Apache 2.0 License: https://www.apache.org/licenses/LICENSE-2.0
- MIT License: https://opensource.org/licenses/MIT
- Firebase Terms: https://firebase.google.com/terms
- Expo Terms: https://expo.dev/terms
- Apple Developer: https://developer.apple.com/
- Google Play Policy: https://play.google.com/about/developer-content-policy/

## Summary

**Good News:**
- ✅ All dependencies are permissively licensed (MIT/Apache 2.0)
- ✅ No patent concerns identified
- ✅ Using official platform APIs (covered by platform licenses)
- ✅ NOTICE file created with all attributions

**Action Items:**
- 📝 Create Privacy Policy (required for app stores)
- 📝 Consider Terms of Service
- 📝 Review service agreements
- 📝 Ensure health data compliance

**No Blockers:**
- No licensing issues that prevent distribution
- No patent concerns
- All dependencies allow commercial use

---

Last Updated: 2024
For questions, refer to NOTICE file or contact legal counsel.



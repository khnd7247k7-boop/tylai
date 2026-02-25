# Smartwatch Integration Setup Instructions

## Quick Start

Your app now has smartwatch integration! Here's how to set it up:

## 1. Install Required Package

Run this command in your terminal:

```bash
npx expo install expo-health
```

## 2. Configure App Permissions

### For iOS (Apple Watch / HealthKit)

Add these to your `app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSHealthShareUsageDescription": "We need access to your health data to track your workouts and provide personalized fitness insights.",
        "NSHealthUpdateUsageDescription": "We need to write workout data to HealthKit to keep your health data synchronized."
      }
    }
  }
}
```

### For Android (Google Fit / Health Connect)

Add these permissions to your `app.json`:

```json
{
  "expo": {
    "android": {
      "permissions": [
        "android.permission.ACTIVITY_RECOGNITION",
        "android.permission.READ_EXTERNAL_STORAGE"
      ]
    }
  }
}
```

## 3. How It Works

### Automatic Integration

- **On Workout Start**: The app automatically requests health permissions
- **During Workout**: Real-time heart rate is displayed (updates every 10 seconds)
- **On Workout Complete**: All health metrics are automatically collected and saved

### What Data Is Collected

- **Heart Rate**: Average, max, and min during workout
- **Calories Burned**: Active calories from your smartwatch
- **Steps**: Steps taken during the workout
- **Distance**: Distance traveled (if applicable)
- **Heart Rate Zones**: Time spent in fat burn, cardio, and peak zones

### Where You'll See It

1. **During Workout**: Real-time heart rate appears in the progress section
2. **Workout History**: Full health metrics are displayed in workout details
3. **AI Analysis**: Health data is included in AI recommendations

## 4. User Experience

### First Time Setup

When a user starts their first workout:
1. App requests health data permissions
2. User grants permissions in system dialog
3. Health tracking begins automatically

### If Permissions Are Denied

- App continues to work normally
- Health metrics simply won't be collected
- No error messages or interruptions

## 5. Testing

### On Real Device

⚠️ **Important**: Health data APIs don't work in simulators/emulators. You must test on a real device with:
- **iOS**: iPhone with Apple Watch paired, or iPhone with HealthKit data
- **Android**: Android device with Google Fit or Health Connect enabled

### Test Checklist

- [ ] Start a workout
- [ ] Grant health permissions when prompted
- [ ] Verify heart rate appears during workout
- [ ] Complete workout
- [ ] Check workout history for health metrics
- [ ] Verify all metrics are saved correctly

## 6. Troubleshooting

### Heart Rate Not Showing

**Possible Causes:**
- Permissions not granted
- No smartwatch/device connected
- Health app not set up on device
- Device doesn't support heart rate monitoring

**Solutions:**
- Check device settings → Privacy → Health
- Ensure smartwatch is paired and connected
- Verify health app has data

### Calories/Steps Not Recording

**Possible Causes:**
- Workout not detected by health app
- Permissions not granted
- Health app not syncing

**Solutions:**
- Manually start workout on smartwatch
- Check health app permissions
- Ensure device is syncing with health platform

### Package Not Found Error

If you see `expo-health` not found:
```bash
npx expo install expo-health
npx expo prebuild --clean  # Rebuild native code
```

## 7. Privacy & Security

### Data Storage

- Health data is stored locally on device (AsyncStorage)
- Data is user-specific (prefixed with user ID)
- No health data is sent to external servers
- Data is encrypted at rest (device encryption)

### User Control

- Users can revoke permissions anytime in device settings
- App gracefully handles permission denial
- No data collection without explicit permission

## 8. Supported Devices

### iOS
- ✅ Apple Watch (all models)
- ✅ iPhone with HealthKit
- ✅ Third-party apps that sync to HealthKit

### Android
- ✅ Google Fit compatible devices
- ✅ Samsung Health (via Health Connect)
- ✅ Fitbit (via Health Connect)
- ✅ Garmin (via Health Connect)
- ✅ Other Health Connect compatible apps

## 9. Future Enhancements

Potential features to add:
- Real-time heart rate zone indicators
- Workout intensity recommendations based on HR
- Recovery time suggestions based on HRV
- Sleep quality integration
- Automatic workout detection
- VO2 Max tracking
- Stress level monitoring

## 10. Support

If you encounter issues:
1. Check that `expo-health` is installed
2. Verify permissions are granted
3. Test on real device (not simulator)
4. Check device health app has data
5. Review console logs for errors

---

**Ready to go!** Once you install `expo-health` and configure permissions, smartwatch integration will work automatically. 🎉






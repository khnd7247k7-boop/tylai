# Smartwatch Integration Guide

## Overview

Yes, it's absolutely possible to integrate smartwatch data into your TYL AI fitness app! This would allow you to automatically track heart rate, steps, calories burned, sleep, and more from Apple Watch, Fitbit, Garmin, and other wearables.

## What Data Can Be Accessed

### Apple Watch (via HealthKit)
- **Heart Rate**: Real-time and resting heart rate
- **Steps**: Daily step count
- **Active Energy**: Calories burned during activity
- **Workout Data**: Duration, distance, pace, elevation
- **Sleep**: Sleep duration and quality
- **VO2 Max**: Cardiovascular fitness level
- **Heart Rate Variability (HRV)**: Stress and recovery metrics
- **Exercise Minutes**: Active minutes per day
- **Stand Hours**: Hours stood per day

### Android Wearables (via Google Fit / Health Connect)
- **Heart Rate**: Real-time and resting heart rate
- **Steps**: Daily step count
- **Calories**: Active and total calories
- **Distance**: Walking/running distance
- **Sleep**: Sleep duration and stages
- **Workout Sessions**: Exercise data with timestamps
- **Weight**: Body weight (if synced)
- **Blood Pressure**: If device supports it

### Fitbit API
- **Activity Data**: Steps, distance, calories, floors
- **Heart Rate**: Resting and active heart rate zones
- **Sleep**: Sleep stages and quality
- **Weight & Body Fat**: Body composition
- **Exercise Logs**: Detailed workout data

### Garmin Connect API
- **Activity Data**: Steps, distance, calories
- **Heart Rate**: Real-time and resting
- **Sleep**: Sleep duration and quality
- **Stress**: Stress levels throughout the day
- **Body Battery**: Energy levels
- **Workout Data**: Detailed exercise metrics

## Implementation Options

### Option 1: Expo Health (Recommended for Expo Apps)

**Package**: `expo-health` (or `react-native-health` for bare React Native)

**Pros**:
- Works with Expo managed workflow
- Unified API for both iOS (HealthKit) and Android (Google Fit)
- Easy to implement
- Good documentation

**Cons**:
- Requires Expo SDK 50+ (you're on 54, so you're good!)
- Some advanced features may require custom native code

**Installation**:
```bash
npx expo install expo-health
```

**Basic Usage**:
```typescript
import * as Health from 'expo-health';

// Request permissions
const requestPermissions = async () => {
  const permissions = await Health.requestPermissionsAsync({
    permissions: ['steps', 'heartRate', 'activeEnergy'],
  });
  return permissions;
};

// Read steps
const getSteps = async () => {
  const steps = await Health.getStepsAsync({
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    endDate: new Date(),
  });
  return steps;
};

// Read heart rate
const getHeartRate = async () => {
  const heartRate = await Health.getHeartRateAsync({
    startDate: new Date(Date.now() - 60 * 60 * 1000), // Last hour
    endDate: new Date(),
  });
  return heartRate;
};
```

### Option 2: React Native Health (For Bare React Native)

**Package**: `react-native-health`

**Pros**:
- More features and control
- Better for complex health data needs
- Active community

**Cons**:
- Requires ejecting from Expo or using Expo bare workflow
- More complex setup

### Option 3: Platform-Specific APIs

**iOS**: Direct HealthKit integration
**Android**: Google Fit API or Health Connect API

**Pros**:
- Maximum control and features
- Access to all platform-specific features

**Cons**:
- Requires native code
- Platform-specific implementations
- More maintenance

## Recommended Implementation for Your App

### Phase 1: Basic Integration (Start Here)

1. **Install expo-health**:
   ```bash
   npx expo install expo-health
   ```

2. **Create a Health Service** (`src/services/HealthService.ts`):
   ```typescript
   import * as Health from 'expo-health';
   
   export class HealthService {
     static async requestPermissions() {
       return await Health.requestPermissionsAsync({
         permissions: [
           'steps',
           'heartRate',
           'activeEnergy',
           'distance',
           'workouts',
         ],
       });
     }
   
     static async getTodaySteps(): Promise<number> {
       const today = new Date();
       today.setHours(0, 0, 0, 0);
       const steps = await Health.getStepsAsync({
         startDate: today,
         endDate: new Date(),
       });
       return steps?.value || 0;
     }
   
     static async getHeartRateDuringWorkout(
       startTime: Date,
       endTime: Date
     ): Promise<number[]> {
       const heartRate = await Health.getHeartRateAsync({
         startDate: startTime,
         endDate: endTime,
       });
       return heartRate?.map(hr => hr.value) || [];
     }
   
     static async getCaloriesBurned(
       startTime: Date,
       endTime: Date
     ): Promise<number> {
       const calories = await Health.getActiveEnergyAsync({
         startDate: startTime,
         endDate: endTime,
       });
       return calories?.reduce((sum, c) => sum + c.value, 0) || 0;
     }
   }
   ```

3. **Integrate into Workout Execution**:
   - When a workout starts, request permissions
   - Track start time
   - During workout, periodically read heart rate
   - When workout ends, fetch total calories, average heart rate, etc.
   - Save this data to the workout session

### Phase 2: Enhanced Features

1. **Real-time Heart Rate Display**:
   - Show current heart rate during workout
   - Display heart rate zones (fat burn, cardio, peak)
   - Alert user if heart rate is too high/low

2. **Automatic Workout Detection**:
   - Detect when user starts a workout on their watch
   - Auto-sync workout data to your app
   - Match detected workouts with your saved plans

3. **Sleep Integration**:
   - Track sleep duration and quality
   - Use sleep data to adjust workout recommendations
   - Show sleep quality in dashboard

4. **Recovery Metrics**:
   - Use HRV (Heart Rate Variability) for recovery tracking
   - Adjust workout intensity based on recovery
   - AI suggestions based on recovery status

### Phase 3: AI Integration

1. **Enhanced AI Analysis**:
   - Include heart rate data in workout analysis
   - Correlate sleep quality with workout performance
   - Use steps/activity to adjust recommendations
   - Factor in recovery metrics for workout suggestions

2. **Personalized Insights**:
   - "Your heart rate was higher than usual today - consider lighter intensity"
   - "Based on your sleep data, you might want to rest today"
   - "Your recovery metrics suggest you're ready for a challenging workout"

## Use Cases in Your App

### 1. **Workout Tracking Enhancement**
- **Current**: User manually inputs weight/reps
- **With Smartwatch**: Auto-track heart rate, calories, duration
- **Benefit**: More accurate workout data, less manual input

### 2. **Automatic Workout Logging**
- **Current**: User must manually log workouts
- **With Smartwatch**: Auto-detect workouts from watch
- **Benefit**: Seamless tracking, no missed workouts

### 3. **Recovery-Based Recommendations**
- **Current**: AI suggests based on workout history
- **With Smartwatch**: AI considers HRV, sleep, stress
- **Benefit**: More accurate, personalized recommendations

### 4. **Dashboard Integration**
- **Current**: Shows workout completion
- **With Smartwatch**: Shows steps, active calories, heart rate trends
- **Benefit**: Comprehensive health overview

### 5. **Nutrition Calorie Adjustment**
- **Current**: Fixed calorie goals
- **With Smartwatch**: Adjust goals based on actual activity
- **Benefit**: More accurate nutrition planning

## Implementation Steps

### Step 1: Add Health Permissions

Update `app.json`:
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSHealthShareUsageDescription": "We need access to your health data to track your workouts and provide personalized fitness insights.",
        "NSHealthUpdateUsageDescription": "We need to write workout data to HealthKit to keep your health data synchronized."
      }
    },
    "android": {
      "permissions": [
        "android.permission.ACTIVITY_RECOGNITION",
        "android.permission.READ_EXTERNAL_STORAGE"
      ]
    }
  }
}
```

### Step 2: Create Health Service

Create `src/services/HealthService.ts` (see example above)

### Step 3: Integrate into ProgramExecutionScreen

```typescript
// In ProgramExecutionScreen.tsx
import { HealthService } from '../src/services/HealthService';

// When workout starts
const handleWorkoutStart = async () => {
  await HealthService.requestPermissions();
  const startTime = new Date();
  // ... existing workout start logic
};

// When workout ends
const handleWorkoutComplete = async () => {
  const endTime = new Date();
  const calories = await HealthService.getCaloriesBurned(startTime, endTime);
  const avgHeartRate = await HealthService.getAverageHeartRate(startTime, endTime);
  
  // Add to workout session
  const session = {
    ...existingSession,
    caloriesBurned: calories,
    averageHeartRate: avgHeartRate,
    // ... other health metrics
  };
};
```

### Step 4: Update WorkoutSession Interface

```typescript
// In data/workoutPrograms.ts
export interface WorkoutSession {
  // ... existing fields
  caloriesBurned?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  heartRateZones?: {
    fatBurn: number;
    cardio: number;
    peak: number;
  };
  steps?: number;
  distance?: number;
}
```

### Step 5: Display in History

Update `WorkoutHistoryDetailScreen.tsx` to show:
- Calories burned
- Average heart rate
- Heart rate zones
- Steps taken during workout

## Requirements & Limitations

### Requirements:
1. **User Permissions**: Users must grant health data permissions
2. **Device Compatibility**: 
   - iOS: Requires iPhone with HealthKit (iOS 8+)
   - Android: Requires Google Fit or Health Connect
3. **Wearable Device**: User must have a compatible smartwatch/fitness tracker
4. **Expo SDK**: Requires Expo SDK 50+ (you have 54, so you're good!)

### Limitations:
1. **Platform Differences**: iOS and Android have different health data structures
2. **Permission Denial**: Users can deny permissions, need fallback
3. **Data Availability**: Not all devices track all metrics
4. **Battery Impact**: Frequent health data reads can drain battery
5. **Privacy**: Health data is sensitive, must comply with HIPAA/GDPR

## Privacy & Security Considerations

1. **User Consent**: Always request explicit permission
2. **Data Storage**: Store health data securely (encrypted)
3. **Data Sharing**: Never share health data without explicit consent
4. **Compliance**: Follow HIPAA (US) and GDPR (EU) regulations
5. **Transparency**: Clearly explain what data you collect and why

## Testing

1. **Test on Real Devices**: Health data doesn't work in simulators
2. **Test Permission Flows**: Handle denied permissions gracefully
3. **Test Data Sync**: Ensure data syncs correctly from watch to phone
4. **Test Edge Cases**: No watch, watch disconnected, etc.

## Next Steps

1. **Start Small**: Begin with basic step counting and heart rate
2. **Test Thoroughly**: Health data is sensitive, test extensively
3. **User Education**: Explain benefits to encourage permission grants
4. **Iterate**: Add more features based on user feedback

## Resources

- [Expo Health Documentation](https://docs.expo.dev/versions/latest/sdk/health/)
- [Apple HealthKit Documentation](https://developer.apple.com/documentation/healthkit)
- [Google Fit API](https://developers.google.com/fit)
- [Health Connect (Android)](https://developer.android.com/guide/health-and-fitness/health-connect)

---

**Recommendation**: Start with `expo-health` for basic integration (steps, heart rate, calories), then expand based on user needs and feedback. This will give you the most value with the least complexity.






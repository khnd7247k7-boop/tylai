# User Data System Documentation

## Overview

All user data in the app is automatically saved and loaded based on the user's account. When a user signs up or logs in, all their data (workouts, meals, mood entries, gratitude, etc.) is automatically associated with their account and persists across sessions.

## How It Works

### 1. **User-Specific Storage**

All data is stored with user-specific keys using the format: `user_{userId}_{dataKey}`

Example:
- User ID: `abc123`
- Data Key: `workoutHistory`
- Storage Key: `user_abc123_workoutHistory`

This ensures that:
- Each user's data is completely isolated
- Multiple users can use the app on the same device
- Data persists across app restarts
- Data is automatically loaded when user logs in

### 2. **Automatic Data Loading**

When a user logs in:
1. Firebase Auth authenticates the user
2. `onAuthStateChanged` listener detects the login
3. `UserDataInitializer` automatically initializes all user data
4. All screens automatically load their data via `useEffect` hooks

### 3. **Data Persistence**

All data is saved to AsyncStorage (local device storage) with user-specific keys. This means:
- Data persists even if the app is closed
- Data is automatically loaded when the app reopens
- Each user's data is completely separate

## Data Categories

### Fitness Data
- `workoutHistory` - All completed workouts
- `meals` - Daily meal entries
- `savedMeals` - User's saved meal templates
- `nutritionGoals` - Calorie and macro goals
- `savedWorkoutPlans` - Custom workout plans
- `activeWorkoutPlans` - Currently active plans

### Emotional Data
- `moodEntries` - Daily mood tracking entries
- `emotionalExercises` - Completed emotional exercises

### Mental Data
- `breathingExercises` - Completed breathing exercises
- `visualizationExercises` - Completed visualization exercises
- `mindfulnessExercises` - Completed mindfulness exercises
- `dailyMentalProgress` - Daily mental wellness progress

### Spiritual Data
- `gratitudeEntries` - Daily gratitude entries
- `affirmationEntries` - Completed affirmations
- `reflectionEntries` - Spiritual reflection entries

### Dashboard Data
- `dashboardTasks` - Daily tasks
- `dailyCheckIn` - Daily check-in status
- `dashboardTasksLastReset` - Last task reset date

## Implementation Details

### Storage Functions

All data operations use `saveUserData` and `loadUserData` from `src/utils/userStorage.ts`:

```typescript
// Save data (automatically uses user-specific key)
await saveUserData('workoutHistory', workoutHistory);

// Load data (automatically uses user-specific key)
const history = await loadUserData<WorkoutHistory[]>('workoutHistory');
```

### Automatic Loading

Each screen automatically loads its data when it mounts:

```typescript
useEffect(() => {
  loadWorkoutHistory();
  loadSavedPlans();
  // ... other data loading
}, []);
```

### Authentication Flow

1. **Sign Up / Login**
   ```typescript
   // User enters email/password
   await createUserWithEmailAndPassword(auth, email, password);
   // OR
   await signInWithEmailAndPassword(auth, email, password);
   ```

2. **Auth State Listener**
   ```typescript
   onAuthStateChanged(auth, async (user) => {
     if (user) {
       // User logged in - initialize data
       await UserDataInitializer.initializeUserData();
     } else {
       // User logged out - reset state
       UserDataInitializer.reset();
     }
   });
   ```

3. **Data Initialization**
   - Checks for existing data in all categories
   - Initializes Wellness Data Manager for AI sync
   - Prepares all screens for data loading

## User Experience

### New User Sign Up
1. User creates account with email/password
2. Firebase creates user account
3. User data storage is initialized (empty)
4. User can start using the app
5. All data they save is automatically associated with their account

### Existing User Login
1. User enters email/password
2. Firebase authenticates user
3. All user's saved data is automatically loaded:
   - Workout history
   - Saved meals
   - Mood entries
   - Gratitude entries
   - Spiritual practices
   - Mental exercises
   - Dashboard tasks
   - And more...
4. User sees their complete history and saved data

### Logout
1. User clicks logout
2. Firebase signs out user
3. App state is reset
4. User data remains saved (not deleted)
5. Next login will load all data again

## Data Security

- Each user's data is isolated by user ID
- Data is stored locally on device (AsyncStorage)
- No data is shared between users
- Data persists even after logout (for next login)

## Migration Notes

If you have existing data without user IDs:
- Old data will still work (falls back to base key)
- New data will use user-specific keys
- Consider migrating old data to user-specific keys

## Troubleshooting

### Data Not Loading
- Check that user is authenticated: `auth.currentUser`
- Verify user ID is available: `getCurrentUserId()`
- Check console logs for errors
- Ensure screens are calling `loadUserData` in `useEffect`

### Data Not Saving
- Verify user is logged in
- Check that `saveUserData` is being used (not direct AsyncStorage)
- Check console for errors
- Verify storage permissions

### Multiple Users on Same Device
- Each user's data is completely separate
- Data is keyed by user ID
- No data mixing between users

## Best Practices

1. **Always use `saveUserData` and `loadUserData`**
   - Never use AsyncStorage directly
   - These functions handle user-specific keys automatically

2. **Load data in `useEffect`**
   - Each screen should load its data on mount
   - This ensures data is always fresh

3. **Save data immediately after changes**
   - Don't wait to save
   - Save after each user action

4. **Handle loading states**
   - Show loading indicators while data loads
   - Handle empty states gracefully

## Example: Adding New Data Type

To add a new data type that's user-specific:

1. **Save data:**
   ```typescript
   await saveUserData('myNewData', myData);
   ```

2. **Load data:**
   ```typescript
   const myData = await loadUserData<MyDataType>('myNewData');
   ```

3. **Load on screen mount:**
   ```typescript
   useEffect(() => {
     const loadMyData = async () => {
       const data = await loadUserData<MyDataType>('myNewData');
       if (data) {
         setMyData(data);
       }
     };
     loadMyData();
   }, []);
   ```

That's it! The user-specific key handling is automatic.








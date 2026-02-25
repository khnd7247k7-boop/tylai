# AI Background Code Requirements

## Overview

For the AI to work properly, several background services need to be initialized and running. This document explains what needs to happen and when.

## Required Background Services

### 1. **UserDataInitializer** (`src/services/UserDataInitializer.ts`)
**Purpose**: Initializes all user data when a user logs in.

**What it does**:
- Loads and verifies data exists for all categories (workout history, meals, mood entries, etc.)
- Initializes the WellnessDataManager (which starts the AI sync service)
- Called automatically when user logs in via Firebase Auth

**When it runs**:
- Automatically called in `App.tsx` when `onAuthStateChanged` detects a logged-in user (line 132)
- Runs once per login session

**Code location**: `App.tsx` line 132:
```typescript
await UserDataInitializer.initializeUserData();
```

---

### 2. **WellnessDataManager** (`src/services/WellnessDataManager.ts`)
**Purpose**: Centralized data management that automatically triggers AI sync when data changes.

**What it does**:
- Provides unified interface for saving/loading data across all categories
- Automatically notifies `WellnessDataSync` when data is saved
- Initializes `WellnessDataSync` on app start

**When it runs**:
- Initialized by `UserDataInitializer.initializeUserData()` (line 31)
- Called automatically whenever data is saved via `saveCategoryData()`

**Initialization chain**:
```
UserDataInitializer.initializeUserData()
  → WellnessDataManager.initialize()
    → WellnessDataSync.initialize()
```

---

### 3. **WellnessDataSync** (`src/services/WellnessDataSync.ts`)
**Purpose**: Automatically syncs data changes to AI analysis in the background.

**What it does**:
- Monitors data changes across all categories (fitness, mental, emotional, spiritual)
- Debounces rapid updates (waits 2 seconds after last change before syncing)
- Aggregates all data and triggers AI analysis
- Saves AI insights and recommendations to storage
- Runs in background without blocking UI

**When it runs**:
1. **On app start**: Initialized by `WellnessDataManager.initialize()`
   - Performs initial sync if it's been >1 hour since last sync
   - Loads cached AI results if sync isn't needed

2. **On data changes**: Automatically triggered when data is saved
   - Called via `WellnessDataSync.notifyDataUpdate(category)`
   - Debounced to batch rapid changes (2-second delay)

**Key methods**:
- `initialize()`: Called on app start
- `notifyDataUpdate(category)`: Called when data is saved
- `performSync()`: Actually runs the AI analysis (called after debounce)
- `forceSync()`: Manual sync (bypasses debounce)

**Sync process**:
```
Data Saved → notifyDataUpdate() → [2 second debounce] → performSync()
  → WellnessDataAggregator.aggregateAllData()
  → AIService.analyzeUserData()
  → AIService.generateRecommendations()
  → Save to storage (aiInsights, aiRecommendations)
```

---

### 4. **WellnessDataAggregator** (`src/services/WellnessDataAggregator.ts`)
**Purpose**: Collects and normalizes data from all wellness categories.

**What it does**:
- Loads data from all categories (fitness, mental, emotional, spiritual)
- Normalizes different data formats into unified structure
- Provides `ExtendedUserWellnessData` with all categories
- Tracks data freshness and completeness

**When it runs**:
- Called by `WellnessDataSync.performSync()` (line 73)
- Called whenever AI analysis is needed

---

### 5. **AIService** (`AIService.ts`)
**Purpose**: Core AI engine that analyzes data and generates insights/recommendations.

**What it does**:
- Analyzes user wellness data patterns
- Generates personalized insights
- Creates recommendations based on user behavior
- Analyzes workout performance for program adaptations
- Detects cross-category patterns

**When it runs**:
- Called by `WellnessDataSync.performSync()` (lines 76-77)
- Called directly for workout performance analysis (in `SavedPlanViewScreen.tsx`)

**Key methods**:
- `analyzeUserData(data)`: Generates insights
- `generateRecommendations(data)`: Generates recommendations
- `analyzeWorkoutPerformance(history, plan)`: Generates workout adaptations

---

## Initialization Flow

### On App Start / User Login:

```
1. User logs in via Firebase Auth
   ↓
2. onAuthStateChanged fires in App.tsx
   ↓
3. UserDataInitializer.initializeUserData() is called
   ↓
4. WellnessDataManager.initialize() is called
   ↓
5. WellnessDataSync.initialize() is called
   ↓
6. WellnessDataSync checks if sync is needed (>1 hour since last sync)
   ↓
7. If needed: performSync() runs
   - Aggregates all data
   - Runs AI analysis
   - Saves results
```

### On Data Changes:

```
1. User saves data (e.g., completes workout, logs meal)
   ↓
2. WellnessDataManager.saveCategoryData() is called
   ↓
3. Data is saved to AsyncStorage
   ↓
4. WellnessDataSync.notifyDataUpdate(category) is called
   ↓
5. [2 second debounce timer starts]
   ↓
6. If no more updates in 2 seconds: performSync() runs
   ↓
7. AI analysis runs in background
   ↓
8. Results saved to storage
```

---

## What Needs to Be Running

### ✅ Already Implemented (Automatic):

1. **UserDataInitializer** - Runs automatically on login
2. **WellnessDataManager** - Initialized by UserDataInitializer
3. **WellnessDataSync** - Initialized by WellnessDataManager
4. **WellnessDataAggregator** - Called automatically by WellnessDataSync
5. **AIService** - Called automatically by WellnessDataSync

### ⚠️ Important Notes:

1. **Data Saving**: For AI sync to work, data should be saved via:
   - `WellnessDataManager.saveCategoryData()` (preferred)
   - OR manually call `WellnessDataSync.notifyDataUpdate()` after saving

2. **Manual Sync**: If you need to force an immediate sync:
   ```typescript
   await WellnessDataManager.syncAI();
   // or
   await WellnessDataSync.forceSync();
   ```

3. **Cached Results**: AI results are cached in storage:
   - `aiInsights`: Array of AI insights
   - `aiRecommendations`: Array of AI recommendations
   - `lastAISync`: Timestamp of last sync

4. **Background Processing**: All AI analysis runs asynchronously and doesn't block the UI.

---

## Current Implementation Status

### ✅ Working:
- Automatic initialization on login
- Background sync on data changes
- Debounced updates (2-second delay)
- Cached results for fast access
- Automatic sync check on app start

### 📝 Files That Use These Services:

**App.tsx**:
- Line 132: `UserDataInitializer.initializeUserData()` - Called on login

**WellnessDataManager.ts**:
- Line 35: `WellnessDataSync.notifyDataUpdate()` - Called when data is saved
- Line 136: `WellnessDataSync.initialize()` - Called on initialization

**WellnessDataSync.ts**:
- Line 73: `WellnessDataAggregator.aggregateAllData()` - Called during sync
- Line 76-77: `AIService.analyzeUserData()` and `generateRecommendations()` - Called during sync

**SavedPlanViewScreen.tsx**:
- Line 40: `AIService.analyzeWorkoutPerformance()` - Called directly for workout suggestions

---

## Troubleshooting

### AI Not Generating Insights/Recommendations:

1. **Check if services are initialized**:
   - Look for console logs: `[DataManager] Initializing...`
   - Check: `[DataSync] Initializing sync service...`

2. **Check if data is being saved correctly**:
   - Ensure data is saved via `WellnessDataManager.saveCategoryData()`
   - OR manually call `WellnessDataSync.notifyDataUpdate()` after saving

3. **Check sync status**:
   ```typescript
   const lastSync = await WellnessDataSync.getLastSyncTimestamp();
   console.log('Last sync:', lastSync);
   ```

4. **Force a sync**:
   ```typescript
   await WellnessDataManager.syncAI();
   ```

5. **Check for errors**:
   - Look for `[DataSync] Error during sync:` in console
   - Check if data aggregation is working

---

## Summary

**The AI works automatically** - no manual intervention needed! The background services:

1. ✅ Initialize automatically on user login
2. ✅ Monitor data changes automatically
3. ✅ Sync to AI analysis automatically (with 2-second debounce)
4. ✅ Cache results for fast access
5. ✅ Run in background without blocking UI

**The only requirement**: Data must be saved via `WellnessDataManager` (or manually notify the sync service) for the AI to detect changes and generate new insights.






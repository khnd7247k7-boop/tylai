# AI Integration Guide

This guide explains how to integrate the AI wellness system across all health categories in your app.

## Overview

The AI system consists of several backend services that work together:

1. **WellnessDataAggregator** - Collects and normalizes data from all categories
2. **WellnessDataSync** - Automatically syncs data changes to AI analysis
3. **CrossCategoryPatternDetector** - Identifies patterns across categories
4. **WellnessDataManager** - Unified interface for all data operations
5. **AIService** - Generates insights and recommendations

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    App Screens                          │
│  (Fitness, Mental, Emotional, Spiritual)                │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│           WellnessDataManager                            │
│  (Unified data operations + auto-sync)                  │
└──────┬───────────────────────────────┬───────────────────┘
       │                               │
       ▼                               ▼
┌──────────────────┐         ┌──────────────────────┐
│  Data Storage    │         │  WellnessDataSync   │
│  (AsyncStorage)  │         │  (Auto AI updates)   │
└──────────────────┘         └──────────┬───────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────┐
│         WellnessDataAggregator                           │
│         (Collects all category data)                     │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              AIService                                    │
│  (Generates insights & recommendations)                  │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│      CrossCategoryPatternDetector                       │
│  (Finds correlations between categories)                  │
└─────────────────────────────────────────────────────────┘
```

## Integration Steps

### 1. Initialize on App Start

In your main `App.tsx` or `index.js`, initialize the data manager:

```typescript
import WellnessDataManager from './src/services/WellnessDataManager';

// On app start
useEffect(() => {
  WellnessDataManager.initialize();
}, []);
```

### 2. Update Existing Screens to Use Data Manager

Instead of directly calling `saveUserData`, use `WellnessDataManager`:

#### Before (Old Way):
```typescript
import { saveUserData } from './src/utils/userStorage';

const saveMoodEntry = async (entry: MoodEntry) => {
  await saveUserData('moodEntries', entries);
};
```

#### After (New Way):
```typescript
import WellnessDataManager from './src/services/WellnessDataManager';

const saveMoodEntry = async (entry: MoodEntry) => {
  // This automatically triggers AI sync!
  await WellnessDataManager.saveEmotionalData('moodEntries', entries);
};
```

### 3. Use the React Hook (Recommended)

For components that need wellness data, use the `useWellnessData` hook:

```typescript
import { useWellnessData } from './src/hooks/useWellnessData';

function MyComponent() {
  const {
    wellnessData,
    insights,
    recommendations,
    saveEmotionalData,
    syncAI,
  } = useWellnessData();

  const handleSaveMood = async (mood: MoodEntry) => {
    await saveEmotionalData('moodEntries', [mood]);
    // AI sync happens automatically!
  };

  return (
    <View>
      {/* Your UI */}
      {insights.map(insight => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </View>
  );
}
```

## Category-Specific Integration

### Fitness Screen

```typescript
// Save workout history
await WellnessDataManager.saveFitnessData('workoutHistory', workoutHistory);

// Save nutrition data
await WellnessDataManager.saveFitnessData('nutritionData', nutritionData);

// Save workout plans
await WellnessDataManager.saveFitnessData('savedWorkoutPlans', plans);
```

### Mental Screen

```typescript
// Save breathing exercises
await WellnessDataManager.saveMentalData('breathingExercises', exercises);

// Save visualization exercises
await WellnessDataManager.saveMentalData('visualizationExercises', exercises);

// Save mindfulness exercises
await WellnessDataManager.saveMentalData('mindfulnessExercises', exercises);

// Save daily progress
await WellnessDataManager.saveMentalData('dailyMentalProgress', progress);
```

### Emotional Screen

```typescript
// Save mood entries
await WellnessDataManager.saveEmotionalData('moodEntries', moodEntries);

// Save emotional exercises
await WellnessDataManager.saveEmotionalData('emotionalExercises', exercises);
```

### Spiritual Screen

```typescript
// Save gratitude entries
await WellnessDataManager.saveSpiritualData('gratitudeEntries', entries);

// Save affirmation entries
await WellnessDataManager.saveSpiritualData('affirmationEntries', entries);

// Save reflection entries
await WellnessDataManager.saveSpiritualData('reflectionEntries', entries);
```

## Automatic AI Sync

The system automatically syncs AI analysis when data changes:

1. **Debounced Updates**: Multiple rapid saves are batched together (2 second delay)
2. **Background Processing**: AI analysis happens in the background
3. **Cached Results**: Insights and recommendations are cached for fast access
4. **Smart Sync**: Only syncs if data has changed significantly

## Manual AI Sync

If you need to force an immediate sync:

```typescript
import WellnessDataManager from './src/services/WellnessDataManager';

// Force immediate sync
const { insights, recommendations } = await WellnessDataManager.syncAI();
```

## Accessing AI Insights

### Using the Hook

```typescript
const { insights, recommendations } = useWellnessData();
```

### Direct Access

```typescript
import WellnessDataManager from './src/services/WellnessDataManager';

const insights = await WellnessDataManager.getAIInsights();
const recommendations = await WellnessDataManager.getAIRecommendations();
```

## Cross-Category Patterns

The system automatically detects patterns like:

- **Mood ↔ Workout Performance**: "When mood is high, workouts are longer"
- **Sleep ↔ Energy**: "Better sleep quality leads to higher energy"
- **Spiritual ↔ Mood**: "Gratitude practices boost mood"
- **Mental ↔ Stress**: "Breathing exercises reduce stress"
- **Nutrition ↔ Performance**: "Higher protein intake improves workout performance"

These patterns are included in AI insights automatically.

## Data Freshness & Completeness

Check data quality:

```typescript
const freshnessScore = await WellnessDataManager.getDataFreshnessScore();
const completenessScore = await WellnessDataManager.getDataCompletenessScore();

// Scores are 0-100
// Higher = better
```

## Best Practices

1. **Always use WellnessDataManager** instead of direct `saveUserData` calls
2. **Use the hook** in components that display AI insights
3. **Don't worry about sync timing** - the system handles it automatically
4. **Check data scores** to encourage users to complete more activities
5. **Display insights** prominently to show the value of the AI system

## Migration Checklist

For each screen (Fitness, Mental, Emotional, Spiritual):

- [ ] Replace `saveUserData` with `WellnessDataManager.save*Data`
- [ ] Update imports
- [ ] Test that data still saves correctly
- [ ] Verify AI sync happens automatically
- [ ] Add UI to display insights/recommendations (optional)

## Example: Complete Integration

```typescript
import React, { useState } from 'react';
import { View, Button } from 'react-native';
import { useWellnessData } from './src/hooks/useWellnessData';

function EmotionalScreen() {
  const { saveEmotionalData, insights } = useWellnessData();
  const [mood, setMood] = useState('');

  const handleSaveMood = async () => {
    const newEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      primaryMood: mood,
      intensity: 5,
      // ... other fields
    };

    // Load existing entries
    const existing = await WellnessDataManager.loadCategoryData('moodEntries') || [];
    
    // Save with new entry
    await saveEmotionalData('moodEntries', [...existing, newEntry]);
    
    // AI sync happens automatically!
  };

  return (
    <View>
      {/* Mood input UI */}
      <Button title="Save Mood" onPress={handleSaveMood} />
      
      {/* Display AI insights */}
      {insights.map(insight => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </View>
  );
}
```

## Troubleshooting

### AI insights not updating?
- Check that you're using `WellnessDataManager` instead of direct `saveUserData`
- Wait a few seconds for debounced sync
- Call `syncAI()` manually to force update

### Data not saving?
- Check console logs for errors
- Verify user is logged in (for user-specific storage)
- Check AsyncStorage permissions

### Performance issues?
- The system debounces updates (2 second delay)
- AI analysis happens in background
- Results are cached for fast access

## Next Steps

1. Integrate `WellnessDataManager` into all screens
2. Add AI insights UI to dashboard
3. Display cross-category patterns to users
4. Use data scores to gamify the experience








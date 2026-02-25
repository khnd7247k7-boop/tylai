# Workout Builder Enhancements

## Overview

The workout builder has been enhanced to include comprehensive exercise data and user profile information for AI-powered workout generation.

## What Was Added

### 1. **Comprehensive Exercise Database** (`src/data/exerciseDatabase.ts`)

Each exercise now includes:
- **Name**: Exercise name
- **Movement Pattern**: push, pull, squat, hinge, lunge, carry, rotation, gait, isometric, stretch, cardio
- **Muscle Groups**: Array of muscles targeted
- **Equipment**: Array of required equipment
- **Difficulty**: beginner, intermediate, advanced
- **Alternatives**: Array of alternative exercises
- **Category**: strength, cardio, flexibility, balance

### 2. **Enhanced Exercise Interface**

The `Exercise` interface now includes:
```typescript
interface Exercise {
  // ... existing fields
  movementPattern?: string;
  muscleGroups?: string[];
  equipment?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  alternatives?: string[];
}
```

### 3. **User Profile Service** (`src/services/UserProfileService.ts`)

Provides access to user profile data for AI:
- Age
- Sex
- Height
- Weight
- Training Experience
- Primary Goals
- Secondary Goals
- Injuries
- Limitations
- Days Per Week
- Equipment Availability
- Preferred Workout Length

### 4. **Updated User Profile Interface**

The `UserProfile` interface in `SettingsScreen.tsx` now includes:
- `sex`: 'male' | 'female' | 'other' | ''
- `secondaryGoals`: string[]
- `injuries`: string
- `limitations`: string
- `daysPerWeek`: number
- `equipmentAvailability`: string
- `preferredWorkoutLength`: number (minutes)

## How It Works

### Exercise Selection

The workout generator now:
1. Loads user profile data (age, sex, height, weight, experience, goals, equipment, etc.)
2. Filters exercises based on:
   - User's equipment availability
   - User's difficulty level
   - Excluded exercises (injuries/limitations)
   - Primary and secondary goals
3. Selects exercises with full metadata:
   - Movement patterns
   - Muscle groups targeted
   - Equipment needed
   - Difficulty level
   - Alternative exercises

### AI Context

When generating workouts, the AI has access to:
- Complete user profile (age, sex, height, weight, experience)
- Primary and secondary goals
- Injuries and limitations
- Equipment availability
- Preferred workout length
- Days per week

For each exercise, the AI knows:
- Movement pattern
- Muscle groups
- Equipment needed
- Difficulty
- Alternative movements

## Usage

### Getting Exercise Data

```typescript
import { getExerciseData, exerciseDatabase } from './src/data/exerciseDatabase';

// Get specific exercise
const pushUp = getExerciseData('Push-ups');
// Returns: { name, movementPattern, muscleGroups, equipment, difficulty, alternatives, category }

// Get exercises by category
const strengthExercises = getExercisesByCategory('strength');

// Get exercises by equipment
const bodyweightExercises = getExercisesByEquipment('bodyweight');

// Get alternatives
const alternatives = getAlternativeExercises('Squat');
```

### Getting User Profile Data

```typescript
import UserProfileService from './src/services/UserProfileService';

// Get complete profile
const profile = await UserProfileService.getUserProfileData();

// Get profile summary for AI
const summary = await UserProfileService.getProfileSummary();
```

## Next Steps

1. **Update Settings Screen**: Add fields for:
   - Sex selection
   - Secondary goals (multi-select)
   - Preferred workout length input

2. **Update Workout Generation**: 
   - Use exercise database instead of exerciseLibrary
   - Filter by equipment availability
   - Use preferred workout length
   - Consider secondary goals

3. **Display Exercise Details**: 
   - Show movement pattern, muscle groups, equipment, alternatives in workout view
   - Allow users to swap exercises with alternatives

4. **AI Integration**: 
   - Pass all user profile data to AI service
   - Use exercise metadata for smarter recommendations
   - Suggest alternatives based on equipment/injuries

## Files Modified

- `WorkoutScreen.tsx` - Updated Exercise interface, imports, generateWorkoutPlan function
- `SettingsScreen.tsx` - Updated UserProfile interface
- `src/data/exerciseDatabase.ts` - NEW: Comprehensive exercise database
- `src/services/UserProfileService.ts` - NEW: User profile service

## Exercise Database

Currently includes 80+ exercises across:
- Strength: 24 exercises
- Cardio: 18 exercises
- Flexibility: 13 exercises
- Balance: 11 exercises

Each exercise has complete metadata for intelligent workout generation.








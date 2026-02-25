/**
 * Wellness Data Aggregator Service
 * 
 * This service collects and normalizes data from all health categories
 * (Fitness, Mental, Emotional, Spiritual) into a unified format for AI analysis.
 * 
 * Key Responsibilities:
 * - Aggregate data from all screens
 * - Normalize different data formats
 * - Track data freshness and completeness
 * - Provide unified data structure for AI analysis
 */

import { loadUserData } from '../utils/userStorage';
import { UserWellnessData } from '../../AIService';

// Extended interfaces for all wellness categories
export interface SpiritualData {
  gratitudeEntries: Array<{
    id: string;
    date: string;
    entries: Array<{
      text: string;
      reflection?: string;
    }>;
  }>;
  affirmationEntries: Array<{
    id: string;
    date: string;
    affirmation: string;
    category: string;
    completed: boolean;
    completedAt?: string;
  }>;
  reflectionEntries: Array<{
    id: string;
    date: string;
    prompt: string;
    response: string;
    category: string;
  }>;
  universalPractices: Array<{
    id: string;
    title: string;
    completed: boolean;
    completedAt?: string;
  }>;
  weeklyCheckIns: Array<{
    id: string;
    date: string;
    responses: Record<string, any>;
  }>;
}

export interface MentalData {
  breathingExercises: Array<{
    id: string;
    title: string;
    type: string;
    completed: boolean;
    completedAt?: string;
  }>;
  visualizationExercises: Array<{
    id: string;
    title: string;
    type: string;
    completed: boolean;
    completedAt?: string;
  }>;
  mindfulnessExercises: Array<{
    id: string;
    title: string;
    type: string;
    completed: boolean;
    completedAt?: string;
  }>;
  dailyProgress: Array<{
    date: string;
    exercisesCompleted: number;
    totalExercises: number;
    streak: number;
  }>;
}

export interface EmotionalData {
  moodEntries: Array<{
    id: string;
    date: string;
    primaryMood: string;
    intensity: number;
    emotions: string[];
    triggers: string[];
    physicalSensations: string[];
    thoughts: string;
    copingStrategies: string[];
    gratitude: string;
    energyLevel: number;
    sleepQuality: number;
    socialConnections: number;
  }>;
  emotionalExercises: Array<{
    id: string;
    title: string;
    category: string;
    completed: boolean;
    completedAt?: string;
  }>;
}

export interface FitnessData {
  workoutHistory: Array<{
    date: string;
    programName: string;
    duration: number;
    exercises: Array<{
      name: string;
      sets: Array<{ weight: number; reps: number; }>;
    }>;
  }>;
  nutritionData: {
    dailyMeals: Array<{
      date: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }>;
    goals: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  };
  savedWorkoutPlans: Array<{
    id: string;
    name: string;
    createdAt: string;
    lastUsed?: string;
  }>;
}

export interface ExtendedUserWellnessData extends UserWellnessData {
  spiritualData: SpiritualData;
  mentalData: MentalData;
  emotionalData: EmotionalData;
  fitnessData: FitnessData;
  completedTasks: Array<{
    title: string;
    category: 'fitness' | 'mental' | 'emotional' | 'spiritual';
    completed: boolean;
    completedAt?: string;
  }>;
  lastUpdated: {
    fitness: string | null;
    mental: string | null;
    emotional: string | null;
    spiritual: string | null;
  };
}

class WellnessDataAggregator {
  /**
   * Aggregate all wellness data from storage
   */
  async aggregateAllData(): Promise<ExtendedUserWellnessData> {
    try {
      // Load data from all categories in parallel
      const [
        moodEntries,
        workoutHistory,
        mentalExercises,
        nutritionData,
        completedTasks,
        emotionalExercises,
        gratitudeEntries,
        affirmationEntries,
        reflectionEntries,
        breathingExercises,
        visualizationExercises,
        mindfulnessExercises,
        dailyMentalProgress,
        savedWorkoutPlans,
      ] = await Promise.all([
        loadUserData('moodEntries'),
        loadUserData('workoutHistory'),
        loadUserData('mentalExercises'),
        loadUserData('nutritionData'),
        loadUserData('completedTasks'),
        loadUserData('emotionalExercises'),
        loadUserData('gratitudeEntries'),
        loadUserData('affirmationEntries'),
        loadUserData('reflectionEntries'),
        loadUserData('breathingExercises'),
        loadUserData('visualizationExercises'),
        loadUserData('mindfulnessExercises'),
        loadUserData('dailyMentalProgress'),
        loadUserData('savedWorkoutPlans'),
      ]);

      // Normalize and structure the data
      const spiritualData: SpiritualData = {
        gratitudeEntries: gratitudeEntries || [],
        affirmationEntries: affirmationEntries || [],
        reflectionEntries: reflectionEntries || [],
        universalPractices: [],
        weeklyCheckIns: [],
      };

      const mentalData: MentalData = {
        breathingExercises: breathingExercises || [],
        visualizationExercises: visualizationExercises || [],
        mindfulnessExercises: mindfulnessExercises || [],
        dailyProgress: dailyMentalProgress || [],
      };

      const emotionalData: EmotionalData = {
        moodEntries: moodEntries || [],
        emotionalExercises: emotionalExercises || [],
      };

      const fitnessData: FitnessData = {
        workoutHistory: workoutHistory || [],
        nutritionData: nutritionData || {
          dailyMeals: [],
          goals: { calories: 2000, protein: 150, carbs: 250, fat: 80 },
        },
        savedWorkoutPlans: savedWorkoutPlans || [],
      };

      // Combine all mental exercises
      const allMentalExercises = [
        ...(breathingExercises || []),
        ...(visualizationExercises || []),
        ...(mindfulnessExercises || []),
      ];

      // Get last updated timestamps
      const lastUpdated = {
        fitness: this.getLastUpdatedDate([
          ...(workoutHistory || []),
          ...(nutritionData?.dailyMeals || []),
        ]),
        mental: this.getLastUpdatedDate(allMentalExercises),
        emotional: this.getLastUpdatedDate([
          ...(moodEntries || []),
          ...(emotionalExercises || []),
        ]),
        spiritual: this.getLastUpdatedDate([
          ...(gratitudeEntries || []),
          ...(affirmationEntries || []),
          ...(reflectionEntries || []),
        ]),
      };

      return {
        moodEntries: moodEntries || [],
        workoutHistory: workoutHistory || [],
        mentalExercises: allMentalExercises,
        nutritionData: fitnessData.nutritionData,
        completedTasks: completedTasks || [],
        spiritualData,
        mentalData,
        emotionalData,
        fitnessData,
        lastUpdated,
      };
    } catch (error) {
      console.error('Error aggregating wellness data:', error);
      // Return empty structure on error
      return this.getEmptyWellnessData();
    }
  }

  /**
   * Get last updated date from an array of entries
   */
  private getLastUpdatedDate(entries: Array<{ date?: string; completedAt?: string }>): string | null {
    if (!entries || entries.length === 0) return null;

    const dates = entries
      .map(entry => entry.completedAt || entry.date)
      .filter(date => date)
      .sort()
      .reverse();

    return dates.length > 0 ? dates[0] : null;
  }

  /**
   * Get empty wellness data structure
   */
  private getEmptyWellnessData(): ExtendedUserWellnessData {
    return {
      moodEntries: [],
      workoutHistory: [],
      mentalExercises: [],
      nutritionData: {
        dailyMeals: [],
        goals: { calories: 2000, protein: 150, carbs: 250, fat: 80 },
      },
      completedTasks: [],
      spiritualData: {
        gratitudeEntries: [],
        affirmationEntries: [],
        reflectionEntries: [],
        universalPractices: [],
        weeklyCheckIns: [],
      },
      mentalData: {
        breathingExercises: [],
        visualizationExercises: [],
        mindfulnessExercises: [],
        dailyProgress: [],
      },
      emotionalData: {
        moodEntries: [],
        emotionalExercises: [],
      },
      fitnessData: {
        workoutHistory: [],
        nutritionData: {
          dailyMeals: [],
          goals: { calories: 2000, protein: 150, carbs: 250, fat: 80 },
        },
        savedWorkoutPlans: [],
      },
      lastUpdated: {
        fitness: null,
        mental: null,
        emotional: null,
        spiritual: null,
      },
    };
  }

  /**
   * Get data freshness score (0-100)
   * Higher score = more recent data across all categories
   */
  getDataFreshnessScore(data: ExtendedUserWellnessData): number {
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;

    let totalScore = 0;
    let categoryCount = 0;

    Object.entries(data.lastUpdated).forEach(([category, lastUpdated]) => {
      if (!lastUpdated) {
        totalScore += 0;
        categoryCount++;
        return;
      }

      const timeDiff = now - new Date(lastUpdated).getTime();
      let score = 0;

      if (timeDiff < oneDay) {
        score = 100; // Very fresh
      } else if (timeDiff < 3 * oneDay) {
        score = 75; // Fresh
      } else if (timeDiff < oneWeek) {
        score = 50; // Moderate
      } else if (timeDiff < 2 * oneWeek) {
        score = 25; // Stale
      } else {
        score = 0; // Very stale
      }

      totalScore += score;
      categoryCount++;
    });

    return categoryCount > 0 ? Math.round(totalScore / categoryCount) : 0;
  }

  /**
   * Get data completeness score (0-100)
   * Higher score = more complete data across all categories
   */
  getDataCompletenessScore(data: ExtendedUserWellnessData): number {
    const categories = [
      { name: 'fitness', entries: data.fitnessData.workoutHistory.length + data.fitnessData.nutritionData.dailyMeals.length },
      { name: 'mental', entries: data.mentalData.breathingExercises.length + data.mentalData.visualizationExercises.length + data.mentalData.mindfulnessExercises.length },
      { name: 'emotional', entries: data.emotionalData.moodEntries.length + data.emotionalData.emotionalExercises.length },
      { name: 'spiritual', entries: data.spiritualData.gratitudeEntries.length + data.spiritualData.affirmationEntries.length + data.spiritualData.reflectionEntries.length },
    ];

    // Consider data complete if each category has at least 5 entries
    const threshold = 5;
    const completeCategories = categories.filter(cat => cat.entries >= threshold).length;
    
    return Math.round((completeCategories / categories.length) * 100);
  }
}

export default new WellnessDataAggregator();








// AI Service for personalized wellness insights and recommendations
// This is a mock AI service that simulates intelligent analysis of user data

import { ExtendedUserWellnessData } from './src/services/WellnessDataAggregator';
import CrossCategoryPatternDetector from './src/services/CrossCategoryPatternDetector';

export interface UserWellnessData {
  moodEntries: Array<{
    date: string;
    primaryMood: string;
    intensity: number;
    emotions: string[];
    triggers: string[];
    physicalSensations: string[];
    thoughts: string;
    copingStrategies: string[];
    energyLevel: number;
    sleepQuality: number;
    socialConnections: number;
  }>;
  workoutHistory: Array<{
    date: string;
    programName: string;
    duration: number;
    exercises: Array<{
      name: string;
      sets: Array<{ weight: number; reps: number; }>;
    }>;
  }>;
  mentalExercises: Array<{
    id: string;
    title: string;
    type: string;
    completed: boolean;
    completedAt?: string;
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
  completedTasks: Array<{
    title: string;
    category: string;
    completed: boolean;
    completedAt?: string;
  }>;
}

export interface AIInsight {
  id: string;
  type: 'mood' | 'fitness' | 'mental' | 'nutrition' | 'overall';
  title: string;
  message: string;
  confidence: number; // 0-100
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  timestamp: string;
}

export interface AIRecommendation {
  id: string;
  type: 'exercise' | 'mental' | 'nutrition' | 'lifestyle' | 'emergency';
  title: string;
  description: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  estimatedTime: number; // in minutes
  category: string;
  personalized: boolean;
}

export interface AIPattern {
  pattern: string;
  frequency: number;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
  suggestions: string[];
}

export interface ExercisePerformance {
  exerciseName: string;
  exerciseId?: string;
  averageWeight: number;
  averageReps: number;
  averageSets: number;
  totalVolume: number; // weight * reps * sets
  completionRate: number; // 0-100
  progression: number; // percentage change over time
  lastPerformed: string;
  timesPerformed: number;
}

export interface WorkoutPerformance {
  programId: string;
  programName: string;
  averageDuration: number;
  completionRate: number; // 0-100
  frequency: number; // workouts per week
  consistency: number; // 0-100, based on adherence to schedule
  totalWorkouts: number;
  exercisePerformances: ExercisePerformance[];
  category: 'strength' | 'cardio' | 'flexibility' | 'bodyweight' | 'mixed';
}

export interface ProgramAdaptation {
  id: string;
  planId: string;
  type: 'progressive_overload' | 'volume_adjustment' | 'exercise_substitution' | 'intensity_change' | 'frequency_change' | 'duration_adjustment' | 'rest_adjustment';
  priority: 'low' | 'medium' | 'high';
  confidence: number; // 0-100
  title: string;
  description: string;
  reason: string;
  changes: {
    exerciseId?: string;
    exerciseName?: string;
    oldValue?: string | number;
    newValue?: string | number;
    field: 'weight' | 'reps' | 'sets' | 'restTime' | 'duration' | 'exercise' | 'frequency';
  }[];
  estimatedImpact: 'positive' | 'neutral' | 'negative';
  createdAt: string;
}

class AIService {
  private insights: AIInsight[] = [];
  private recommendations: AIRecommendation[] = [];
  private patterns: AIPattern[] = [];
  private adaptations: ProgramAdaptation[] = [];

  // Analyze user data and generate insights
  analyzeUserData(data: UserWellnessData | ExtendedUserWellnessData): AIInsight[] {
    this.insights = [];
    
    // Check if this is extended data with all categories
    const isExtendedData = 'spiritualData' in data && 'mentalData' in data && 'emotionalData' in data && 'fitnessData' in data;
    
    // Use extended data if available, otherwise fall back to basic structure
    const moodEntries = isExtendedData ? (data as ExtendedUserWellnessData).emotionalData.moodEntries : data.moodEntries || [];
    const workoutHistory = isExtendedData ? (data as ExtendedUserWellnessData).fitnessData.workoutHistory : data.workoutHistory || [];
    const mentalExercises = isExtendedData 
      ? [
          ...(data as ExtendedUserWellnessData).mentalData.breathingExercises,
          ...(data as ExtendedUserWellnessData).mentalData.visualizationExercises,
          ...(data as ExtendedUserWellnessData).mentalData.mindfulnessExercises,
        ]
      : data.mentalExercises || [];
    const nutritionData = isExtendedData 
      ? (data as ExtendedUserWellnessData).fitnessData.nutritionData 
      : data.nutritionData;
    const completedTasks = data.completedTasks || [];
    
    // Analyze mood patterns
    if (moodEntries.length > 0) {
      this.analyzeMoodPatterns(moodEntries);
    }
    
    // Analyze fitness patterns
    if (workoutHistory.length > 0) {
      this.analyzeFitnessPatterns(workoutHistory);
    }
    
    // Analyze mental wellness patterns
    if (mentalExercises.length > 0) {
      this.analyzeMentalPatterns(mentalExercises);
    }
    
    // Analyze nutrition patterns
    if (nutritionData && nutritionData.dailyMeals.length > 0) {
      this.analyzeNutritionPatterns(nutritionData);
    }
    
    // Analyze overall wellness patterns
    if (completedTasks.length > 0) {
      this.analyzeOverallPatterns({ ...data, completedTasks } as UserWellnessData);
    }

    // Cross-category pattern detection (only for extended data)
    if (isExtendedData) {
      try {
        const crossCategoryPatterns = CrossCategoryPatternDetector.detectPatterns(data as ExtendedUserWellnessData);
        crossCategoryPatterns.forEach(pattern => {
          this.insights.push({
            id: pattern.id,
            type: 'overall',
            title: pattern.pattern,
            message: pattern.description + (pattern.recommendation ? ` ${pattern.recommendation}` : ''),
            confidence: pattern.confidence,
            actionable: !!pattern.recommendation,
            priority: pattern.impact === 'negative' ? 'high' : pattern.impact === 'positive' ? 'low' : 'medium',
            category: pattern.categories.join('-'),
            timestamp: new Date().toISOString(),
          });
        });
      } catch (error) {
        console.error('Error detecting cross-category patterns:', error);
      }
    }
    
    return this.insights;
  }

  // Generate personalized recommendations
  generateRecommendations(data: UserWellnessData | ExtendedUserWellnessData): AIRecommendation[] {
    this.recommendations = [];
    
    // Check if this is extended data
    const isExtendedData = 'spiritualData' in data && 'mentalData' in data && 'emotionalData' in data && 'fitnessData' in data;
    
    // Use extended data if available, otherwise fall back to basic structure
    const moodEntries = isExtendedData ? (data as ExtendedUserWellnessData).emotionalData.moodEntries : data.moodEntries || [];
    const workoutHistory = isExtendedData ? (data as ExtendedUserWellnessData).fitnessData.workoutHistory : data.workoutHistory || [];
    const mentalExercises = isExtendedData 
      ? [
          ...(data as ExtendedUserWellnessData).mentalData.breathingExercises,
          ...(data as ExtendedUserWellnessData).mentalData.visualizationExercises,
          ...(data as ExtendedUserWellnessData).mentalData.mindfulnessExercises,
        ]
      : data.mentalExercises || [];
    const nutritionData = isExtendedData 
      ? (data as ExtendedUserWellnessData).fitnessData.nutritionData 
      : data.nutritionData;
    const spiritualData = isExtendedData ? (data as ExtendedUserWellnessData).spiritualData : null;
    
    // Generate mood-based recommendations
    if (moodEntries.length > 0) {
      this.generateMoodRecommendations(moodEntries);
    }
    
    // Generate fitness recommendations
    if (workoutHistory.length > 0) {
      this.generateFitnessRecommendations(workoutHistory);
    }
    
    // Generate mental wellness recommendations
    if (mentalExercises.length > 0) {
      this.generateMentalRecommendations(mentalExercises);
    }
    
    // Generate nutrition recommendations
    if (nutritionData && nutritionData.dailyMeals.length > 0) {
      this.generateNutritionRecommendations(nutritionData);
    }
    
    // Generate lifestyle recommendations
    this.generateLifestyleRecommendations(data);

    // Generate spiritual recommendations (if extended data available)
    if (spiritualData) {
      this.generateSpiritualRecommendations(spiritualData, moodEntries);
    }
    
    return this.recommendations;
  }

  // Generate spiritual wellness recommendations
  private generateSpiritualRecommendations(spiritualData: any, moodEntries: any[]) {
    const gratitudeCount = spiritualData.gratitudeEntries?.length || 0;
    const affirmationCount = spiritualData.affirmationEntries?.length || 0;
    const reflectionCount = spiritualData.reflectionEntries?.length || 0;

    // Low spiritual practice engagement
    if (gratitudeCount + affirmationCount + reflectionCount < 5) {
      this.recommendations.push({
        id: `spiritual-engagement-${Date.now()}`,
        type: 'lifestyle',
        title: 'Start a Daily Gratitude Practice',
        description: 'Write down 3 things you\'re grateful for each day',
        reason: 'Spiritual practices like gratitude have been shown to improve mood and overall well-being',
        priority: 'medium',
        estimatedTime: 5,
        category: 'spiritual',
        personalized: true
      });
    }

    // Check if spiritual practices correlate with better mood
    if (moodEntries.length >= 5 && gratitudeCount > 0) {
      const recentMood = moodEntries.slice(0, 5);
      const avgMood = recentMood.reduce((sum: number, m: any) => sum + m.intensity, 0) / recentMood.length;
      
      if (avgMood < 5) {
        this.recommendations.push({
          id: `spiritual-mood-boost-${Date.now()}`,
          type: 'mental',
          title: 'Try a Gratitude Practice',
          description: 'Gratitude practices can boost mood and energy levels',
          reason: `Your recent mood average is ${avgMood.toFixed(1)}/10 - spiritual practices may help`,
          priority: 'high',
          estimatedTime: 5,
          category: 'spiritual',
          personalized: true
        });
      }
    }
  }

  // Analyze mood patterns
  private analyzeMoodPatterns(moodEntries: any[]) {
    if (moodEntries.length < 3) return;

    const recentEntries = moodEntries.slice(0, 7); // Last 7 entries
    const avgIntensity = recentEntries.reduce((sum, entry) => sum + entry.intensity, 0) / recentEntries.length;
    
    // Low mood intensity pattern
    if (avgIntensity < 4) {
      this.insights.push({
        id: `mood-low-${Date.now()}`,
        type: 'mood',
        title: 'Low Mood Intensity Detected',
        message: `Your average mood intensity has been ${avgIntensity.toFixed(1)}/10 over the past week. Consider engaging in uplifting activities or reaching out for support.`,
        confidence: 85,
        actionable: true,
        priority: 'medium',
        category: 'mood',
        timestamp: new Date().toISOString()
      });
    }

    // High stress pattern
    const stressEntries = recentEntries.filter(entry => 
      entry.primaryMood === 'Anxious' || 
      entry.primaryMood === 'Overwhelmed' || 
      entry.primaryMood === 'Worried'
    );
    
    if (stressEntries.length >= 3) {
      this.insights.push({
        id: `mood-stress-${Date.now()}`,
        type: 'mood',
        title: 'Frequent Stress Patterns',
        message: `You've reported feeling stressed, anxious, or overwhelmed ${stressEntries.length} times this week. Consider practicing stress management techniques.`,
        confidence: 90,
        actionable: true,
        priority: 'high',
        category: 'mood',
        timestamp: new Date().toISOString()
      });
    }

    // Sleep-mood correlation
    const sleepMoodCorrelation = this.calculateSleepMoodCorrelation(recentEntries);
    if (sleepMoodCorrelation > 0.7) {
      this.insights.push({
        id: `mood-sleep-${Date.now()}`,
        type: 'mood',
        title: 'Sleep Quality Affects Mood',
        message: `Your mood intensity strongly correlates with sleep quality (${(sleepMoodCorrelation * 100).toFixed(0)}% correlation). Focus on improving sleep hygiene.`,
        confidence: 80,
        actionable: true,
        priority: 'medium',
        category: 'mood',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Analyze fitness patterns
  private analyzeFitnessPatterns(workoutHistory: any[]) {
    if (workoutHistory.length < 2) return;

    const recentWorkouts = workoutHistory.slice(0, 7);
    const avgDuration = recentWorkouts.reduce((sum, workout) => sum + workout.duration, 0) / recentWorkouts.length;
    
    // Consistent workout pattern
    if (recentWorkouts.length >= 4) {
      this.insights.push({
        id: `fitness-consistent-${Date.now()}`,
        type: 'fitness',
        title: 'Great Workout Consistency!',
        message: `You've completed ${recentWorkouts.length} workouts this week with an average duration of ${avgDuration.toFixed(0)} minutes. Keep up the excellent work!`,
        confidence: 95,
        actionable: false,
        priority: 'low',
        category: 'fitness',
        timestamp: new Date().toISOString()
      });
    }

    // Declining workout frequency
    const weeklyWorkouts = this.groupWorkoutsByWeek(workoutHistory);
    if (weeklyWorkouts.length >= 2) {
      const currentWeek = weeklyWorkouts[0].count;
      const previousWeek = weeklyWorkouts[1].count;
      
      if (currentWeek < previousWeek * 0.7) {
        this.insights.push({
          id: `fitness-decline-${Date.now()}`,
          type: 'fitness',
          title: 'Workout Frequency Declining',
          message: `Your workout frequency has decreased from ${previousWeek} to ${currentWeek} sessions per week. Consider setting smaller, achievable goals.`,
          confidence: 80,
          actionable: true,
          priority: 'medium',
          category: 'fitness',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Analyze mental wellness patterns
  private analyzeMentalPatterns(mentalExercises: any[]) {
    const completedExercises = mentalExercises.filter(ex => ex.completed);
    const recentCompletions = completedExercises.filter(ex => 
      ex.completedAt && new Date(ex.completedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    // High mental wellness engagement
    if (recentCompletions.length >= 5) {
      this.insights.push({
        id: `mental-engagement-${Date.now()}`,
        type: 'mental',
        title: 'Excellent Mental Wellness Practice',
        message: `You've completed ${recentCompletions.length} mental wellness exercises this week. Your commitment to mental health is impressive!`,
        confidence: 90,
        actionable: false,
        priority: 'low',
        category: 'mental',
        timestamp: new Date().toISOString()
      });
    }

    // Low mental wellness engagement
    if (recentCompletions.length === 0 && mentalExercises.length > 0) {
      this.insights.push({
        id: `mental-low-${Date.now()}`,
        type: 'mental',
        title: 'Mental Wellness Reminder',
        message: `You haven't completed any mental wellness exercises this week. Even 5 minutes of mindfulness can make a difference.`,
        confidence: 85,
        actionable: true,
        priority: 'medium',
        category: 'mental',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Analyze nutrition patterns
  private analyzeNutritionPatterns(nutritionData: any) {
    const recentMeals = nutritionData.dailyMeals.slice(0, 7);
    const goals = nutritionData.goals;
    
    if (recentMeals.length < 3) return;

    const avgCalories = recentMeals.reduce((sum: number, meal: any) => sum + meal.calories, 0) / recentMeals.length;
    const avgProtein = recentMeals.reduce((sum: number, meal: any) => sum + meal.protein, 0) / recentMeals.length;
    
    // Calorie goal achievement
    const calorieAchievement = (avgCalories / goals.calories) * 100;
    if (calorieAchievement < 80) {
      this.insights.push({
        id: `nutrition-calories-${Date.now()}`,
        type: 'nutrition',
        title: 'Calorie Intake Below Goal',
        message: `Your average daily calories (${avgCalories.toFixed(0)}) is ${(100 - calorieAchievement).toFixed(0)}% below your goal. Consider adding healthy snacks.`,
        confidence: 85,
        actionable: true,
        priority: 'medium',
        category: 'nutrition',
        timestamp: new Date().toISOString()
      });
    } else if (calorieAchievement > 120) {
      this.insights.push({
        id: `nutrition-calories-high-${Date.now()}`,
        type: 'nutrition',
        title: 'Calorie Intake Above Goal',
        message: `Your average daily calories (${avgCalories.toFixed(0)}) is ${(calorieAchievement - 100).toFixed(0)}% above your goal. Consider portion control strategies.`,
        confidence: 85,
        actionable: true,
        priority: 'medium',
        category: 'nutrition',
        timestamp: new Date().toISOString()
      });
    }

    // Protein intake analysis
    const proteinAchievement = (avgProtein / goals.protein) * 100;
    if (proteinAchievement < 80) {
      this.insights.push({
        id: `nutrition-protein-${Date.now()}`,
        type: 'nutrition',
        title: 'Protein Intake Below Goal',
        message: `Your average daily protein (${avgProtein.toFixed(0)}g) is ${(100 - proteinAchievement).toFixed(0)}% below your goal. Consider adding lean protein sources.`,
        confidence: 80,
        actionable: true,
        priority: 'medium',
        category: 'nutrition',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Analyze overall wellness patterns
  private analyzeOverallPatterns(data: UserWellnessData) {
    const completedTasks = data.completedTasks.filter(task => task.completed);
    const recentTasks = completedTasks.filter(task => 
      task.completedAt && new Date(task.completedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    // High overall engagement
    if (recentTasks.length >= 8) {
      this.insights.push({
        id: `overall-high-${Date.now()}`,
        type: 'overall',
        title: 'Outstanding Wellness Engagement',
        message: `You've completed ${recentTasks.length} wellness tasks this week! Your dedication to holistic health is inspiring.`,
        confidence: 95,
        actionable: false,
        priority: 'low',
        category: 'overall',
        timestamp: new Date().toISOString()
      });
    }

    // Low overall engagement
    if (recentTasks.length < 3) {
      this.insights.push({
        id: `overall-low-${Date.now()}`,
        type: 'overall',
        title: 'Wellness Engagement Opportunity',
        message: `You've completed ${recentTasks.length} wellness tasks this week. Small daily actions can lead to big improvements in your overall well-being.`,
        confidence: 80,
        actionable: true,
        priority: 'medium',
        category: 'overall',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Generate mood-based recommendations
  private generateMoodRecommendations(moodEntries: any[]) {
    if (moodEntries.length === 0) return;

    const recentEntry = moodEntries[0];
    const mood = recentEntry.primaryMood;
    const intensity = recentEntry.intensity;

    // High stress recommendations
    if (mood === 'Anxious' || mood === 'Overwhelmed' || mood === 'Worried') {
      this.recommendations.push({
        id: `mood-stress-${Date.now()}`,
        type: 'mental',
        title: 'Stress Relief Breathing Exercise',
        description: 'Practice 4-7-8 breathing to calm your nervous system',
        reason: `You're feeling ${mood.toLowerCase()} with intensity ${intensity}/10`,
        priority: 'high',
        estimatedTime: 5,
        category: 'stress-relief',
        personalized: true
      });

      this.recommendations.push({
        id: `mood-nature-${Date.now()}`,
        type: 'lifestyle',
        title: 'Nature Walk',
        description: 'Take a 10-minute walk in nature to reduce stress',
        reason: 'Nature exposure has been shown to reduce cortisol levels',
        priority: 'medium',
        estimatedTime: 10,
        category: 'stress-relief',
        personalized: true
      });
    }

    // Low mood recommendations
    if (mood === 'Sad' || mood === 'Lonely' || intensity < 4) {
      this.recommendations.push({
        id: `mood-gratitude-${Date.now()}`,
        type: 'mental',
        title: 'Gratitude Practice',
        description: 'Write down 3 things you\'re grateful for today',
        reason: `You're feeling ${mood.toLowerCase()} - gratitude can boost mood`,
        priority: 'high',
        estimatedTime: 5,
        category: 'mood-boost',
        personalized: true
      });

      this.recommendations.push({
        id: `mood-social-${Date.now()}`,
        type: 'lifestyle',
        title: 'Social Connection',
        description: 'Reach out to a friend or family member',
        reason: 'Social connection is a powerful mood booster',
        priority: 'medium',
        estimatedTime: 15,
        category: 'mood-boost',
        personalized: true
      });
    }
  }

  // Generate fitness recommendations
  private generateFitnessRecommendations(workoutHistory: any[]) {
    const recentWorkouts = workoutHistory.slice(0, 3);
    const avgDuration = recentWorkouts.reduce((sum, workout) => sum + workout.duration, 0) / recentWorkouts.length;

    // Low intensity workout recommendation
    if (avgDuration < 30) {
      this.recommendations.push({
        id: `fitness-intensity-${Date.now()}`,
        type: 'exercise',
        title: 'Increase Workout Intensity',
        description: 'Try adding 10 more minutes to your workouts',
        reason: `Your average workout duration is ${avgDuration.toFixed(0)} minutes`,
        priority: 'medium',
        estimatedTime: 10,
        category: 'fitness',
        personalized: true
      });
    }

    // Consistency recommendation
    if (recentWorkouts.length < 2) {
      this.recommendations.push({
        id: `fitness-consistency-${Date.now()}`,
        type: 'exercise',
        title: 'Quick Workout Session',
        description: 'Do a 15-minute bodyweight workout',
        reason: 'You haven\'t worked out recently - even short sessions help',
        priority: 'high',
        estimatedTime: 15,
        category: 'fitness',
        personalized: true
      });
    }
  }

  // Generate mental wellness recommendations
  private generateMentalRecommendations(mentalExercises: any[]) {
    const completedExercises = mentalExercises.filter(ex => ex.completed);
    const recentCompletions = completedExercises.filter(ex => 
      ex.completedAt && new Date(ex.completedAt) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    );

    if (recentCompletions.length === 0) {
      this.recommendations.push({
        id: `mental-mindfulness-${Date.now()}`,
        type: 'mental',
        title: '5-Minute Mindfulness',
        description: 'Practice the Emotion Body Scan exercise',
        reason: 'You haven\'t done mental wellness exercises recently',
        priority: 'high',
        estimatedTime: 5,
        category: 'mindfulness',
        personalized: true
      });
    }
  }

  // Generate nutrition recommendations
  private generateNutritionRecommendations(nutritionData: any) {
    const recentMeals = nutritionData.dailyMeals.slice(0, 3);
    const goals = nutritionData.goals;
    
    if (recentMeals.length === 0) return;

    const avgProtein = recentMeals.reduce((sum: number, meal: any) => sum + meal.protein, 0) / recentMeals.length;
    const proteinDeficit = goals.protein - avgProtein;

    if (proteinDeficit > 20) {
      this.recommendations.push({
        id: `nutrition-protein-${Date.now()}`,
        type: 'nutrition',
        title: 'High-Protein Snack',
        description: 'Add a protein-rich snack like Greek yogurt or nuts',
        reason: `You need ${proteinDeficit.toFixed(0)}g more protein to reach your goal`,
        priority: 'medium',
        estimatedTime: 5,
        category: 'nutrition',
        personalized: true
      });
    }
  }

  // Generate lifestyle recommendations
  private generateLifestyleRecommendations(data: UserWellnessData) {
    const recentMood = data.moodEntries[0];
    if (!recentMood) return;

    // Sleep quality recommendation
    if (recentMood.sleepQuality < 6) {
      this.recommendations.push({
        id: `lifestyle-sleep-${Date.now()}`,
        type: 'lifestyle',
        title: 'Sleep Hygiene Practice',
        description: 'Create a relaxing bedtime routine',
        reason: `Your sleep quality is ${recentMood.sleepQuality}/10`,
        priority: 'high',
        estimatedTime: 20,
        category: 'sleep',
        personalized: true
      });
    }

    // Social connection recommendation
    if (recentMood.socialConnections < 5) {
      this.recommendations.push({
        id: `lifestyle-social-${Date.now()}`,
        type: 'lifestyle',
        title: 'Social Connection',
        description: 'Call a friend or join a social activity',
        reason: `Your social connections are rated ${recentMood.socialConnections}/10`,
        priority: 'medium',
        estimatedTime: 30,
        category: 'social',
        personalized: true
      });
    }
  }

  // Helper methods
  private calculateSleepMoodCorrelation(entries: any[]): number {
    if (entries.length < 3) return 0;
    
    const sleepScores = entries.map(e => e.sleepQuality);
    const moodScores = entries.map(e => e.intensity);
    
    // Simple correlation calculation
    const n = entries.length;
    const sumSleep = sleepScores.reduce((a, b) => a + b, 0);
    const sumMood = moodScores.reduce((a, b) => a + b, 0);
    const sumSleepMood = sleepScores.reduce((sum, sleep, i) => sum + sleep * moodScores[i], 0);
    const sumSleepSq = sleepScores.reduce((sum, sleep) => sum + sleep * sleep, 0);
    const sumMoodSq = moodScores.reduce((sum, mood) => sum + mood * mood, 0);
    
    const correlation = (n * sumSleepMood - sumSleep * sumMood) / 
      Math.sqrt((n * sumSleepSq - sumSleep * sumSleep) * (n * sumMoodSq - sumMood * sumMood));
    
    return Math.abs(correlation);
  }

  private groupWorkoutsByWeek(workoutHistory: any[]) {
    const weeks: { [key: string]: number } = {};
    
    workoutHistory.forEach(workout => {
      const date = new Date(workout.date);
      const weekKey = `${date.getFullYear()}-W${this.getWeekNumber(date)}`;
      weeks[weekKey] = (weeks[weekKey] || 0) + 1;
    });
    
    return Object.entries(weeks)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => b.week.localeCompare(a.week));
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Get insights by category
  getInsightsByCategory(category: string): AIInsight[] {
    return this.insights.filter(insight => insight.category === category);
  }

  // Get recommendations by priority
  getRecommendationsByPriority(priority: 'low' | 'medium' | 'high'): AIRecommendation[] {
    return this.recommendations.filter(rec => rec.priority === priority);
  }

  // Get all insights
  getAllInsights(): AIInsight[] {
    return this.insights;
  }

  // Get all recommendations
  getAllRecommendations(): AIRecommendation[] {
    return this.recommendations;
  }

  // ========== WORKOUT PERFORMANCE ANALYSIS & ADAPTATION ==========

  /**
   * Analyze workout performance and generate program adaptations
   */
  analyzeWorkoutPerformance(
    workoutHistory: any[],
    currentPlan: any
  ): ProgramAdaptation[] {
    this.adaptations = [];
    
    if (!workoutHistory || workoutHistory.length === 0) {
      return [];
    }

    if (!currentPlan) {
      return [];
    }

    // Analyze performance metrics
    const performance = this.calculatePerformanceMetrics(workoutHistory, currentPlan);
    
    // Generate adaptations based on workout category
    if (performance.category === 'strength' || performance.category === 'mixed') {
      this.analyzeStrengthAdaptations(performance, currentPlan);
    }
    
    // Analyze time/performance metrics for all workout types
    this.analyzeTimePerformance(performance, currentPlan);
    this.analyzeCompletionRates(performance, currentPlan);
    this.analyzeFrequencyPatterns(performance, currentPlan);
    this.analyzeExerciseSubstitutions(performance, currentPlan);
    
    // Cardio-specific adaptations
    if (performance.category === 'cardio') {
      this.analyzeCardioAdaptations(performance, currentPlan);
    }
    
    // Flexibility-specific adaptations
    if (performance.category === 'flexibility') {
      this.analyzeFlexibilityAdaptations(performance, currentPlan);
    }

    return this.adaptations;
  }

  /**
   * Calculate performance metrics from workout history
   */
  private calculatePerformanceMetrics(workoutHistory: any[], currentPlan: any): WorkoutPerformance {
    const recentWorkouts = workoutHistory
      .filter(w => w.completed)
      .slice(0, 14); // Last 2 weeks

    if (recentWorkouts.length === 0) {
      return {
        programId: currentPlan.id || '',
        programName: currentPlan.name || '',
        averageDuration: 0,
        completionRate: 0,
        frequency: 0,
        consistency: 0,
        totalWorkouts: 0,
        exercisePerformances: [],
        category: this.determineWorkoutCategory(currentPlan)
      };
    }

    // Calculate exercise performances
    const exerciseMap = new Map<string, ExercisePerformance>();
    
    recentWorkouts.forEach(workout => {
      workout.exercises?.forEach((exercise: any) => {
        if (!exercise.name) return;
        
        const key = exercise.exerciseId || exercise.name;
        if (!exerciseMap.has(key)) {
          exerciseMap.set(key, {
            exerciseName: exercise.name,
            exerciseId: exercise.exerciseId,
            averageWeight: 0,
            averageReps: 0,
            averageSets: 0,
            totalVolume: 0,
            completionRate: 0,
            progression: 0,
            lastPerformed: workout.date,
            timesPerformed: 0
          });
        }

        const perf = exerciseMap.get(key)!;
        perf.timesPerformed++;
        
        // Calculate averages for strength exercises
        if (exercise.sets && exercise.sets.length > 0) {
          const completedSets = exercise.sets.filter((s: any) => s.completed);
          if (completedSets.length > 0) {
            const totalWeight = completedSets.reduce((sum: number, s: any) => sum + (s.weight || 0), 0);
            const totalReps = completedSets.reduce((sum: number, s: any) => sum + (s.reps || 0), 0);
            
            perf.averageWeight = (perf.averageWeight * (perf.timesPerformed - 1) + totalWeight / completedSets.length) / perf.timesPerformed;
            perf.averageReps = (perf.averageReps * (perf.timesPerformed - 1) + totalReps / completedSets.length) / perf.timesPerformed;
            perf.averageSets = completedSets.length;
            perf.totalVolume = perf.averageWeight * perf.averageReps * perf.averageSets;
            perf.completionRate = (completedSets.length / exercise.sets.length) * 100;
          }
        }
      });
    });

    // Calculate progression for each exercise
    const sortedWorkouts = [...recentWorkouts].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    exerciseMap.forEach((perf, key) => {
      const firstWorkout = sortedWorkouts.find(w => 
        w.exercises?.some((e: any) => (e.exerciseId || e.name) === key)
      );
      const lastWorkout = [...sortedWorkouts].reverse().find(w => 
        w.exercises?.some((e: any) => (e.exerciseId || e.name) === key)
      );

      if (firstWorkout && lastWorkout) {
        const firstExercise = firstWorkout.exercises?.find((e: any) => (e.exerciseId || e.name) === key);
        const lastExercise = lastWorkout.exercises?.find((e: any) => (e.exerciseId || e.name) === key);
        
        if (firstExercise?.sets && lastExercise?.sets) {
          const firstCompleted = firstExercise.sets.filter((s: any) => s.completed);
          const lastCompleted = lastExercise.sets.filter((s: any) => s.completed);
          
          if (firstCompleted.length > 0 && lastCompleted.length > 0) {
            const firstAvgWeight = firstCompleted.reduce((sum: number, s: any) => sum + (s.weight || 0), 0) / firstCompleted.length;
            const lastAvgWeight = lastCompleted.reduce((sum: number, s: any) => sum + (s.weight || 0), 0) / lastCompleted.length;
            
            if (firstAvgWeight > 0) {
              perf.progression = ((lastAvgWeight - firstAvgWeight) / firstAvgWeight) * 100;
            } else {
              // For bodyweight exercises, track rep progression
              const firstAvgReps = firstCompleted.reduce((sum: number, s: any) => sum + (s.reps || 0), 0) / firstCompleted.length;
              const lastAvgReps = lastCompleted.reduce((sum: number, s: any) => sum + (s.reps || 0), 0) / lastCompleted.length;
              if (firstAvgReps > 0) {
                perf.progression = ((lastAvgReps - firstAvgReps) / firstAvgReps) * 100;
              }
            }
          }
        }
      }
    });

    // Calculate overall metrics
    const totalDuration = recentWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    const averageDuration = totalDuration / recentWorkouts.length;
    
    const totalSets = recentWorkouts.reduce((sum, w) => {
      return sum + (w.exercises?.reduce((exSum: number, ex: any) => 
        exSum + (ex.sets?.length || 0), 0) || 0);
    }, 0);
    const completedSets = recentWorkouts.reduce((sum, w) => {
      return sum + (w.exercises?.reduce((exSum: number, ex: any) => 
        exSum + (ex.sets?.filter((s: any) => s.completed).length || 0), 0) || 0);
    }, 0);
    const completionRate = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

    // Calculate frequency (workouts per week)
    const daysDiff = (new Date().getTime() - new Date(sortedWorkouts[0].date).getTime()) / (1000 * 60 * 60 * 24);
    const frequency = daysDiff > 0 ? (recentWorkouts.length / daysDiff) * 7 : 0;

    // Calculate consistency (adherence to planned schedule)
    const expectedWorkouts = currentPlan.daysPerWeek ? 
      Math.floor((daysDiff / 7) * currentPlan.daysPerWeek) : recentWorkouts.length;
    const consistency = expectedWorkouts > 0 ? (recentWorkouts.length / expectedWorkouts) * 100 : 0;

    return {
      programId: currentPlan.id || '',
      programName: currentPlan.name || '',
      averageDuration,
      completionRate,
      frequency,
      consistency,
      totalWorkouts: recentWorkouts.length,
      exercisePerformances: Array.from(exerciseMap.values()),
      category: this.determineWorkoutCategory(currentPlan)
    };
  }

  /**
   * Determine workout category from plan
   */
  private determineWorkoutCategory(plan: any): 'strength' | 'cardio' | 'flexibility' | 'bodyweight' | 'mixed' {
    if (plan.category) {
      if (plan.category === 'strength' || plan.category === 'muscle_building') return 'strength';
      if (plan.category === 'cardio') return 'cardio';
      if (plan.category === 'bodyweight') return 'bodyweight';
    }
    
    if (plan.goal) {
      if (plan.goal === 'strength' || plan.goal === 'muscle_gain') return 'strength';
      if (plan.goal === 'weight_loss' || plan.goal === 'endurance') return 'cardio';
      if (plan.goal === 'flexibility') return 'flexibility';
    }

    // Check exercises to determine category
    const exercises = plan.exercises || plan.weeklyPlan?.weekDays?.[0]?.exercises || [];
    const hasStrength = exercises.some((e: any) => e.category === 'strength' || e.weight);
    const hasCardio = exercises.some((e: any) => e.category === 'cardio');
    const hasFlexibility = exercises.some((e: any) => e.category === 'flexibility' || e.category === 'balance');

    if (hasStrength && hasCardio) return 'mixed';
    if (hasStrength) return 'strength';
    if (hasCardio) return 'cardio';
    if (hasFlexibility) return 'flexibility';
    
    return 'mixed';
  }

  /**
   * Analyze strength-specific adaptations
   */
  private analyzeStrengthAdaptations(performance: WorkoutPerformance, plan: any) {
    performance.exercisePerformances.forEach(exPerf => {
      // Progressive overload: increase weight if consistently hitting reps
      if (exPerf.timesPerformed >= 3 && exPerf.progression < 5 && exPerf.completionRate >= 90 && exPerf.averageWeight > 0) {
        const currentWeight = exPerf.averageWeight;
        const suggestedWeight = Math.ceil(currentWeight * 1.05); // 5% increase
        
        this.adaptations.push({
          id: `prog-overload-${exPerf.exerciseName}-${Date.now()}`,
          planId: performance.programId,
          type: 'progressive_overload',
          priority: 'medium',
          confidence: 85,
          title: `Increase Weight: ${exPerf.exerciseName}`,
          description: `You've consistently completed ${exPerf.exerciseName} with good form. Consider increasing weight from ${currentWeight.toFixed(0)}lbs to ${suggestedWeight}lbs.`,
          reason: `You've performed this exercise ${exPerf.timesPerformed} times with ${exPerf.completionRate.toFixed(0)}% completion rate. Time to progress!`,
          changes: [{
            exerciseName: exPerf.exerciseName,
            exerciseId: exPerf.exerciseId,
            oldValue: currentWeight,
            newValue: suggestedWeight,
            field: 'weight'
          }],
          estimatedImpact: 'positive',
          createdAt: new Date().toISOString()
        });
      }

      // Volume adjustment: increase sets if too easy
      if (exPerf.completionRate >= 95 && exPerf.averageSets < 4) {
        this.adaptations.push({
          id: `volume-increase-${exPerf.exerciseName}-${Date.now()}`,
          planId: performance.programId,
          type: 'volume_adjustment',
          priority: 'low',
          confidence: 75,
          title: `Add Set: ${exPerf.exerciseName}`,
          description: `You're completing all sets easily. Consider adding one more set for better volume.`,
          reason: `Completion rate is ${exPerf.completionRate.toFixed(0)}% with ${exPerf.averageSets} sets.`,
          changes: [{
            exerciseName: exPerf.exerciseName,
            exerciseId: exPerf.exerciseId,
            oldValue: exPerf.averageSets,
            newValue: exPerf.averageSets + 1,
            field: 'sets'
          }],
          estimatedImpact: 'positive',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Analyze time/performance metrics (works for all workout types)
   */
  private analyzeTimePerformance(performance: WorkoutPerformance, plan: any) {
    const expectedDuration = plan.duration || plan.weeklyPlan?.weekDays?.[0]?.duration || 30;
    const durationDiff = performance.averageDuration - expectedDuration;

    // Workout taking too long - reduce volume or intensity
    if (durationDiff > expectedDuration * 0.2 && performance.averageDuration > expectedDuration) {
      this.adaptations.push({
        id: `duration-reduce-${Date.now()}`,
        planId: performance.programId,
        type: 'duration_adjustment',
        priority: 'medium',
        confidence: 80,
        title: 'Reduce Workout Duration',
        description: `Your workouts are taking ${performance.averageDuration.toFixed(0)} minutes (expected ${expectedDuration} min). Consider reducing exercises or rest time.`,
        reason: `Average duration is ${durationDiff.toFixed(0)} minutes longer than planned.`,
        changes: [{
          oldValue: expectedDuration,
          newValue: Math.max(expectedDuration - 10, 20),
          field: 'duration'
        }],
        estimatedImpact: 'neutral',
        createdAt: new Date().toISOString()
      });
    }

    // Workout too short - increase volume
    if (durationDiff < -expectedDuration * 0.3 && performance.averageDuration < expectedDuration) {
      this.adaptations.push({
        id: `duration-increase-${Date.now()}`,
        planId: performance.programId,
        type: 'duration_adjustment',
        priority: 'low',
        confidence: 70,
        title: 'Increase Workout Duration',
        description: `Your workouts are completing in ${performance.averageDuration.toFixed(0)} minutes (expected ${expectedDuration} min). You may benefit from adding more exercises.`,
        reason: `Average duration is ${Math.abs(durationDiff).toFixed(0)} minutes shorter than planned.`,
        changes: [{
          oldValue: expectedDuration,
          newValue: expectedDuration + 10,
          field: 'duration'
        }],
        estimatedImpact: 'positive',
        createdAt: new Date().toISOString()
      });
    }
  }

  /**
   * Analyze completion rates
   */
  private analyzeCompletionRates(performance: WorkoutPerformance, plan: any) {
    // Low completion rate - reduce difficulty
    if (performance.completionRate < 70 && performance.totalWorkouts >= 3) {
      this.adaptations.push({
        id: `reduce-difficulty-${Date.now()}`,
        planId: performance.programId,
        type: 'intensity_change',
        priority: 'high',
        confidence: 90,
        title: 'Reduce Workout Intensity',
        description: `Your completion rate is ${performance.completionRate.toFixed(0)}%. The current plan may be too challenging. Consider reducing volume or intensity.`,
        reason: `Only ${performance.completionRate.toFixed(0)}% of sets are being completed.`,
        changes: [{
          oldValue: 'current',
          newValue: 'reduced',
          field: 'sets'
        }],
        estimatedImpact: 'positive',
        createdAt: new Date().toISOString()
      });
    }

    // High completion rate - increase difficulty
    if (performance.completionRate >= 95 && performance.totalWorkouts >= 5) {
      this.adaptations.push({
        id: `increase-difficulty-${Date.now()}`,
        planId: performance.programId,
        type: 'intensity_change',
        priority: 'medium',
        confidence: 80,
        title: 'Increase Workout Intensity',
        description: `Your completion rate is ${performance.completionRate.toFixed(0)}%. You're ready for more challenge!`,
        reason: `Excellent ${performance.completionRate.toFixed(0)}% completion rate over ${performance.totalWorkouts} workouts.`,
        changes: [{
          oldValue: 'current',
          newValue: 'increased',
          field: 'sets'
        }],
        estimatedImpact: 'positive',
        createdAt: new Date().toISOString()
      });
    }
  }

  /**
   * Analyze frequency patterns
   */
  private analyzeFrequencyPatterns(performance: WorkoutPerformance, plan: any) {
    const expectedFrequency = plan.daysPerWeek || 3;
    const frequencyDiff = performance.frequency - expectedFrequency;

    // Working out more than planned - suggest increasing days
    if (frequencyDiff > 1 && performance.consistency > 100) {
      this.adaptations.push({
        id: `increase-frequency-${Date.now()}`,
        planId: performance.programId,
        type: 'frequency_change',
        priority: 'low',
        confidence: 75,
        title: 'Consider Increasing Workout Frequency',
        description: `You're working out ${performance.frequency.toFixed(1)} times per week (planned ${expectedFrequency}). You may benefit from a more structured ${expectedFrequency + 1}-day program.`,
        reason: `Current frequency: ${performance.frequency.toFixed(1)}x/week vs planned: ${expectedFrequency}x/week.`,
        changes: [{
          oldValue: expectedFrequency,
          newValue: expectedFrequency + 1,
          field: 'frequency'
        }],
        estimatedImpact: 'positive',
        createdAt: new Date().toISOString()
      });
    }

    // Working out less than planned - suggest reducing days
    if (frequencyDiff < -1 && performance.consistency < 70) {
      this.adaptations.push({
        id: `reduce-frequency-${Date.now()}`,
        planId: performance.programId,
        type: 'frequency_change',
        priority: 'medium',
        confidence: 85,
        title: 'Consider Reducing Workout Frequency',
        description: `You're working out ${performance.frequency.toFixed(1)} times per week (planned ${expectedFrequency}). A ${expectedFrequency - 1}-day program may be more sustainable.`,
        reason: `Current frequency: ${performance.frequency.toFixed(1)}x/week vs planned: ${expectedFrequency}x/week. Consistency is ${performance.consistency.toFixed(0)}%.`,
        changes: [{
          oldValue: expectedFrequency,
          newValue: Math.max(expectedFrequency - 1, 2),
          field: 'frequency'
        }],
        estimatedImpact: 'positive',
        createdAt: new Date().toISOString()
      });
    }
  }

  /**
   * Analyze exercise substitutions
   */
  private analyzeExerciseSubstitutions(performance: WorkoutPerformance, plan: any) {
    // Find exercises that are consistently skipped or have low completion
    performance.exercisePerformances.forEach(exPerf => {
      if (exPerf.completionRate < 50 && exPerf.timesPerformed >= 3) {
        this.adaptations.push({
          id: `substitute-${exPerf.exerciseName}-${Date.now()}`,
          planId: performance.programId,
          type: 'exercise_substitution',
          priority: 'medium',
          confidence: 80,
          title: `Consider Alternative: ${exPerf.exerciseName}`,
          description: `You're only completing ${exPerf.completionRate.toFixed(0)}% of ${exPerf.exerciseName}. Consider trying an alternative exercise.`,
          reason: `Low completion rate (${exPerf.completionRate.toFixed(0)}%) suggests this exercise may not be suitable.`,
          changes: [{
            exerciseName: exPerf.exerciseName,
            exerciseId: exPerf.exerciseId,
            oldValue: exPerf.exerciseName,
            newValue: 'alternative',
            field: 'exercise'
          }],
          estimatedImpact: 'positive',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Analyze cardio-specific adaptations
   */
  private analyzeCardioAdaptations(performance: WorkoutPerformance, plan: any) {
    // Increase duration if completing easily
    if (performance.completionRate >= 90 && performance.averageDuration < (plan.duration || 30)) {
      this.adaptations.push({
        id: `cardio-duration-${Date.now()}`,
        planId: performance.programId,
        type: 'duration_adjustment',
        priority: 'medium',
        confidence: 75,
        title: 'Increase Cardio Duration',
        description: `You're completing cardio sessions easily. Consider increasing duration from ${plan.duration || 30} to ${(plan.duration || 30) + 10} minutes.`,
        reason: `Completion rate: ${performance.completionRate.toFixed(0)}% with average duration of ${performance.averageDuration.toFixed(0)} minutes.`,
        changes: [{
          oldValue: plan.duration || 30,
          newValue: (plan.duration || 30) + 10,
          field: 'duration'
        }],
        estimatedImpact: 'positive',
        createdAt: new Date().toISOString()
      });
    }

    // Increase intensity if duration is consistent
    if (performance.completionRate >= 95 && performance.consistency >= 80) {
      this.adaptations.push({
        id: `cardio-intensity-${Date.now()}`,
        planId: performance.programId,
        type: 'intensity_change',
        priority: 'low',
        confidence: 70,
        title: 'Increase Cardio Intensity',
        description: `You're consistently completing cardio workouts. Consider adding intervals or increasing pace.`,
        reason: `High completion (${performance.completionRate.toFixed(0)}%) and consistency (${performance.consistency.toFixed(0)}%).`,
        changes: [{
          oldValue: 'moderate',
          newValue: 'high',
          field: 'restTime'
        }],
        estimatedImpact: 'positive',
        createdAt: new Date().toISOString()
      });
    }
  }

  /**
   * Analyze flexibility-specific adaptations
   */
  private analyzeFlexibilityAdaptations(performance: WorkoutPerformance, plan: any) {
    // Increase hold times if completing easily
    if (performance.completionRate >= 90) {
      this.adaptations.push({
        id: `flexibility-duration-${Date.now()}`,
        planId: performance.programId,
        type: 'duration_adjustment',
        priority: 'low',
        confidence: 75,
        title: 'Increase Stretch Hold Times',
        description: `You're completing flexibility exercises easily. Consider holding stretches 10-15 seconds longer.`,
        reason: `Completion rate: ${performance.completionRate.toFixed(0)}% suggests you're ready for longer holds.`,
        changes: [{
          oldValue: 'current',
          newValue: 'increased',
          field: 'duration'
        }],
        estimatedImpact: 'positive',
        createdAt: new Date().toISOString()
      });
    }
  }

  /**
   * Get all pending adaptations for a plan
   */
  getAdaptationsForPlan(planId: string): ProgramAdaptation[] {
    return this.adaptations.filter((a: ProgramAdaptation) => a.planId === planId);
  }

  /**
   * Clear adaptations (after they've been applied or dismissed)
   */
  clearAdaptation(adaptationId: string) {
    this.adaptations = this.adaptations.filter((a: ProgramAdaptation) => a.id !== adaptationId);
  }
}

export default new AIService();

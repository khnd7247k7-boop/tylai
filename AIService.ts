// AI Service for personalized wellness insights and recommendations
// This is a mock AI service that simulates intelligent analysis of user data

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

class AIService {
  private insights: AIInsight[] = [];
  private recommendations: AIRecommendation[] = [];
  private patterns: AIPattern[] = [];

  // Analyze user data and generate insights
  analyzeUserData(data: UserWellnessData): AIInsight[] {
    this.insights = [];
    
    // Analyze mood patterns
    this.analyzeMoodPatterns(data.moodEntries);
    
    // Analyze fitness patterns
    this.analyzeFitnessPatterns(data.workoutHistory);
    
    // Analyze mental wellness patterns
    this.analyzeMentalPatterns(data.mentalExercises);
    
    // Analyze nutrition patterns
    this.analyzeNutritionPatterns(data.nutritionData);
    
    // Analyze overall wellness patterns
    this.analyzeOverallPatterns(data);
    
    return this.insights;
  }

  // Generate personalized recommendations
  generateRecommendations(data: UserWellnessData): AIRecommendation[] {
    this.recommendations = [];
    
    // Generate mood-based recommendations
    this.generateMoodRecommendations(data.moodEntries);
    
    // Generate fitness recommendations
    this.generateFitnessRecommendations(data.workoutHistory);
    
    // Generate mental wellness recommendations
    this.generateMentalRecommendations(data.mentalExercises);
    
    // Generate nutrition recommendations
    this.generateNutritionRecommendations(data.nutritionData);
    
    // Generate lifestyle recommendations
    this.generateLifestyleRecommendations(data);
    
    return this.recommendations;
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

    const avgCalories = recentMeals.reduce((sum, meal) => sum + meal.calories, 0) / recentMeals.length;
    const avgProtein = recentMeals.reduce((sum, meal) => sum + meal.protein, 0) / recentMeals.length;
    
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

    const avgProtein = recentMeals.reduce((sum, meal) => sum + meal.protein, 0) / recentMeals.length;
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
}

export default new AIService();

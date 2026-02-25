/**
 * Cross-Category Pattern Detector Service
 * 
 * This service identifies patterns and correlations across different wellness categories.
 * For example: "When mood is low, workout performance decreases" or
 * "Spiritual practices correlate with better sleep quality"
 * 
 * Key Responsibilities:
 * - Analyze correlations between categories
 * - Identify patterns in user behavior
 * - Detect anomalies or concerning trends
 * - Generate cross-category insights
 */

import { ExtendedUserWellnessData } from './WellnessDataAggregator';

export interface CrossCategoryPattern {
  id: string;
  pattern: string;
  description: string;
  categories: string[];
  confidence: number; // 0-100
  impact: 'positive' | 'negative' | 'neutral';
  evidence: Array<{
    category: string;
    data: any;
    date: string;
  }>;
  recommendation?: string;
}

export interface Correlation {
  category1: string;
  category2: string;
  strength: number; // -1 to 1 (negative to positive correlation)
  significance: number; // 0-100 (how significant the correlation is)
  examples: Array<{
    date: string;
    value1: number;
    value2: number;
  }>;
}

class CrossCategoryPatternDetector {
  /**
   * Detect patterns across all wellness categories
   */
  detectPatterns(data: ExtendedUserWellnessData): CrossCategoryPattern[] {
    const patterns: CrossCategoryPattern[] = [];

    // Pattern 1: Mood and Workout Performance
    const moodWorkoutPattern = this.detectMoodWorkoutCorrelation(data);
    if (moodWorkoutPattern) patterns.push(moodWorkoutPattern);

    // Pattern 2: Sleep Quality and Energy Levels
    const sleepEnergyPattern = this.detectSleepEnergyCorrelation(data);
    if (sleepEnergyPattern) patterns.push(sleepEnergyPattern);

    // Pattern 3: Spiritual Practices and Mood
    const spiritualMoodPattern = this.detectSpiritualMoodCorrelation(data);
    if (spiritualMoodPattern) patterns.push(spiritualMoodPattern);

    // Pattern 4: Mental Exercises and Stress Levels
    const mentalStressPattern = this.detectMentalStressCorrelation(data);
    if (mentalStressPattern) patterns.push(mentalStressPattern);

    // Pattern 5: Nutrition and Workout Performance
    const nutritionWorkoutPattern = this.detectNutritionWorkoutCorrelation(data);
    if (nutritionWorkoutPattern) patterns.push(nutritionWorkoutPattern);

    // Pattern 6: Consistency Across Categories
    const consistencyPattern = this.detectConsistencyPattern(data);
    if (consistencyPattern) patterns.push(consistencyPattern);

    return patterns;
  }

  /**
   * Detect correlation between mood and workout performance
   */
  private detectMoodWorkoutCorrelation(data: ExtendedUserWellnessData): CrossCategoryPattern | null {
    const moodEntries = data.emotionalData.moodEntries;
    const workouts = data.fitnessData.workoutHistory;

    if (moodEntries.length < 3 || workouts.length < 3) return null;

    // Match mood entries with workouts on the same day
    const correlations: Array<{ mood: number; workoutDuration: number; date: string }> = [];

    moodEntries.forEach(mood => {
      const moodDate = new Date(mood.date).toDateString();
      const sameDayWorkout = workouts.find(w => 
        new Date(w.date).toDateString() === moodDate
      );

      if (sameDayWorkout) {
        correlations.push({
          mood: mood.intensity,
          workoutDuration: sameDayWorkout.duration,
          date: mood.date,
        });
      }
    });

    if (correlations.length < 3) return null;

    // Calculate correlation
    const avgMood = correlations.reduce((sum, c) => sum + c.mood, 0) / correlations.length;
    const avgDuration = correlations.reduce((sum, c) => sum + c.workoutDuration, 0) / correlations.length;

    let correlationSum = 0;
    correlations.forEach(c => {
      const moodDiff = c.mood - avgMood;
      const durationDiff = c.workoutDuration - avgDuration;
      correlationSum += moodDiff * durationDiff;
    });

    const correlation = correlationSum / correlations.length;
    const strength = Math.abs(correlation) / 10; // Normalize

    if (strength > 0.3) {
      const isPositive = correlation > 0;
      return {
        id: `mood-workout-${Date.now()}`,
        pattern: isPositive 
          ? 'Positive Mood Correlates with Longer Workouts'
          : 'Lower Mood Correlates with Shorter Workouts',
        description: isPositive
          ? 'When your mood is higher, you tend to work out longer. This suggests your emotional state positively impacts your physical activity.'
          : 'When your mood is lower, your workouts tend to be shorter. Consider doing a quick mood-boosting activity before workouts.',
        categories: ['emotional', 'fitness'],
        confidence: Math.min(90, Math.round(strength * 100)),
        impact: isPositive ? 'positive' : 'negative',
        evidence: correlations.map(c => ({
          category: 'emotional',
          data: { mood: c.mood, workoutDuration: c.workoutDuration },
          date: c.date,
        })),
        recommendation: isPositive
          ? 'Continue tracking mood before workouts. Consider doing a quick mood-boosting activity if you feel low before exercising.'
          : 'Try doing a 5-minute breathing exercise or gratitude practice before workouts to boost your mood and energy.',
      };
    }

    return null;
  }

  /**
   * Detect correlation between sleep quality and energy levels
   */
  private detectSleepEnergyCorrelation(data: ExtendedUserWellnessData): CrossCategoryPattern | null {
    const moodEntries = data.emotionalData.moodEntries;

    if (moodEntries.length < 5) return null;

    const sleepEnergyPairs = moodEntries
      .filter(m => m.sleepQuality && m.energyLevel)
      .map(m => ({
        sleep: m.sleepQuality,
        energy: m.energyLevel,
        date: m.date,
      }));

    if (sleepEnergyPairs.length < 5) return null;

    const avgSleep = sleepEnergyPairs.reduce((sum, p) => sum + p.sleep, 0) / sleepEnergyPairs.length;
    const avgEnergy = sleepEnergyPairs.reduce((sum, p) => sum + p.energy, 0) / sleepEnergyPairs.length;

    let correlationSum = 0;
    sleepEnergyPairs.forEach(p => {
      const sleepDiff = p.sleep - avgSleep;
      const energyDiff = p.energy - avgEnergy;
      correlationSum += sleepDiff * energyDiff;
    });

    const correlation = correlationSum / sleepEnergyPairs.length;
    const strength = Math.abs(correlation) / 10;

    if (strength > 0.4) {
      return {
        id: `sleep-energy-${Date.now()}`,
        pattern: 'Sleep Quality Strongly Affects Energy Levels',
        description: 'Your sleep quality directly impacts your daily energy levels. Better sleep leads to higher energy throughout the day.',
        categories: ['emotional'],
        confidence: Math.min(95, Math.round(strength * 100)),
        impact: 'positive',
        evidence: sleepEnergyPairs.map(p => ({
          category: 'emotional',
          data: { sleep: p.sleep, energy: p.energy },
          date: p.date,
        })),
        recommendation: 'Focus on improving sleep quality through consistent bedtime routines, reducing screen time before bed, and creating a comfortable sleep environment.',
      };
    }

    return null;
  }

  /**
   * Detect correlation between spiritual practices and mood
   */
  private detectSpiritualMoodCorrelation(data: ExtendedUserWellnessData): CrossCategoryPattern | null {
    const spiritualEntries = [
      ...data.spiritualData.gratitudeEntries,
      ...data.spiritualData.affirmationEntries,
      ...data.spiritualData.reflectionEntries,
    ];
    const moodEntries = data.emotionalData.moodEntries;

    if (spiritualEntries.length < 3 || moodEntries.length < 5) return null;

    // Check if mood improves on days with spiritual practices
    const spiritualDates = new Set(
      spiritualEntries.map(e => new Date(e.date).toDateString())
    );

    const moodsWithSpiritual = moodEntries.filter(m => 
      spiritualDates.has(new Date(m.date).toDateString())
    );
    const moodsWithoutSpiritual = moodEntries.filter(m => 
      !spiritualDates.has(new Date(m.date).toDateString())
    );

    if (moodsWithSpiritual.length < 2 || moodsWithoutSpiritual.length < 2) return null;

    const avgMoodWith = moodsWithSpiritual.reduce((sum, m) => sum + m.intensity, 0) / moodsWithSpiritual.length;
    const avgMoodWithout = moodsWithoutSpiritual.reduce((sum, m) => sum + m.intensity, 0) / moodsWithoutSpiritual.length;

    const difference = avgMoodWith - avgMoodWithout;

    if (Math.abs(difference) > 1) {
      const isPositive = difference > 0;
      return {
        id: `spiritual-mood-${Date.now()}`,
        pattern: isPositive
          ? 'Spiritual Practices Boost Mood'
          : 'Spiritual Practices May Need Adjustment',
        description: isPositive
          ? `On days when you practice gratitude, affirmations, or reflection, your average mood is ${difference.toFixed(1)} points higher.`
          : 'Consider trying different spiritual practices or adjusting your current routine.',
        categories: ['spiritual', 'emotional'],
        confidence: Math.min(85, Math.round(Math.abs(difference) * 10)),
        impact: isPositive ? 'positive' : 'neutral',
        evidence: [
          ...moodsWithSpiritual.map(m => ({
            category: 'spiritual',
            data: { mood: m.intensity, hasSpiritual: true },
            date: m.date,
          })),
          ...moodsWithoutSpiritual.slice(0, 5).map(m => ({
            category: 'spiritual',
            data: { mood: m.intensity, hasSpiritual: false },
            date: m.date,
          })),
        ],
        recommendation: isPositive
          ? 'Continue your spiritual practices! They\'re having a positive impact on your mood.'
          : 'Try experimenting with different types of spiritual practices to find what resonates with you.',
      };
    }

    return null;
  }

  /**
   * Detect correlation between mental exercises and stress levels
   */
  private detectMentalStressCorrelation(data: ExtendedUserWellnessData): CrossCategoryPattern | null {
    const mentalExercises = data.mentalData.breathingExercises
      .concat(data.mentalData.visualizationExercises)
      .concat(data.mentalData.mindfulnessExercises)
      .filter(e => e.completed);

    const moodEntries = data.emotionalData.moodEntries;

    if (mentalExercises.length < 3 || moodEntries.length < 5) return null;

    // Check if mood improves after mental exercises
    const exerciseDates = new Set(
      mentalExercises
        .filter(e => e.completedAt)
        .map(e => new Date(e.completedAt!).toDateString())
    );

    const moodsAfterExercise = moodEntries.filter(m => {
      const moodDate = new Date(m.date).toDateString();
      // Check if there was an exercise on the same day or day before
      return Array.from(exerciseDates).some(exDate => {
        const exDateObj = new Date(exDate);
        const moodDateObj = new Date(moodDate);
        const diffDays = Math.abs((moodDateObj.getTime() - exDateObj.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 1;
      });
    });

    if (moodsAfterExercise.length < 2) return null;

    const avgMoodAfter = moodsAfterExercise.reduce((sum, m) => sum + m.intensity, 0) / moodsAfterExercise.length;
    const allMoodAvg = moodEntries.reduce((sum, m) => sum + m.intensity, 0) / moodEntries.length;

    const difference = avgMoodAfter - allMoodAvg;

    if (difference > 0.5) {
      return {
        id: `mental-stress-${Date.now()}`,
        pattern: 'Mental Exercises Improve Mood',
        description: `Your mood tends to be ${difference.toFixed(1)} points higher on days when you complete mental exercises (breathing, visualization, or mindfulness).`,
        categories: ['mental', 'emotional'],
        confidence: Math.min(80, Math.round(difference * 15)),
        impact: 'positive',
        evidence: moodsAfterExercise.map(m => ({
          category: 'mental',
          data: { mood: m.intensity, hasMentalExercise: true },
          date: m.date,
        })),
        recommendation: 'Make mental exercises a regular part of your routine, especially on stressful days.',
      };
    }

    return null;
  }

  /**
   * Detect correlation between nutrition and workout performance
   */
  private detectNutritionWorkoutCorrelation(data: ExtendedUserWellnessData): CrossCategoryPattern | null {
    const meals = data.fitnessData.nutritionData.dailyMeals;
    const workouts = data.fitnessData.workoutHistory;

    if (meals.length < 5 || workouts.length < 5) return null;

    // Match meals with workouts on the same day
    const correlations: Array<{ protein: number; workoutDuration: number; date: string }> = [];

    meals.forEach(meal => {
      const mealDate = new Date(meal.date).toDateString();
      const sameDayWorkout = workouts.find(w => 
        new Date(w.date).toDateString() === mealDate
      );

      if (sameDayWorkout && meal.protein > 0) {
        correlations.push({
          protein: meal.protein,
          workoutDuration: sameDayWorkout.duration,
          date: meal.date,
        });
      }
    });

    if (correlations.length < 3) return null;

    const avgProtein = correlations.reduce((sum, c) => sum + c.protein, 0) / correlations.length;
    const avgDuration = correlations.reduce((sum, c) => sum + c.workoutDuration, 0) / correlations.length;

    let correlationSum = 0;
    correlations.forEach(c => {
      const proteinDiff = c.protein - avgProtein;
      const durationDiff = c.workoutDuration - avgDuration;
      correlationSum += proteinDiff * durationDiff;
    });

    const correlation = correlationSum / correlations.length;
    const strength = Math.abs(correlation) / 100; // Normalize for protein (typically 50-200g range)

    if (strength > 0.2) {
      const isPositive = correlation > 0;
      return {
        id: `nutrition-workout-${Date.now()}`,
        pattern: isPositive
          ? 'Higher Protein Intake Correlates with Longer Workouts'
          : 'Nutrition May Need Adjustment for Workouts',
        description: isPositive
          ? 'On days when you consume more protein, you tend to work out longer. Protein is essential for workout performance and recovery.'
          : 'Consider ensuring adequate protein intake on workout days to support performance and recovery.',
        categories: ['fitness'],
        confidence: Math.min(75, Math.round(strength * 100)),
        impact: isPositive ? 'positive' : 'neutral',
        evidence: correlations.map(c => ({
          category: 'fitness',
          data: { protein: c.protein, workoutDuration: c.workoutDuration },
          date: c.date,
        })),
        recommendation: isPositive
          ? 'Continue prioritizing protein intake, especially on workout days.'
          : 'Aim for 0.8-1g of protein per pound of body weight, especially on days you exercise.',
      };
    }

    return null;
  }

  /**
   * Detect consistency patterns across categories
   */
  private detectConsistencyPattern(data: ExtendedUserWellnessData): CrossCategoryPattern | null {
    const categories = [
      { name: 'fitness', entries: data.fitnessData.workoutHistory.length },
      { name: 'mental', entries: data.mentalData.breathingExercises.length + data.mentalData.visualizationExercises.length + data.mentalData.mindfulnessExercises.length },
      { name: 'emotional', entries: data.emotionalData.moodEntries.length },
      { name: 'spiritual', entries: data.spiritualData.gratitudeEntries.length + data.spiritualData.affirmationEntries.length },
    ];

    const totalEntries = categories.reduce((sum, cat) => sum + cat.entries, 0);
    if (totalEntries < 10) return null;

    // Check if user is consistent across all categories
    const avgEntries = totalEntries / categories.length;
    const variance = categories.reduce((sum, cat) => {
      const diff = cat.entries - avgEntries;
      return sum + (diff * diff);
    }, 0) / categories.length;

    const consistencyScore = 100 - Math.min(100, Math.round(variance / avgEntries * 100));

    if (consistencyScore > 70) {
      return {
        id: `consistency-${Date.now()}`,
        pattern: 'Well-Balanced Wellness Routine',
        description: 'You\'re maintaining a consistent practice across all wellness categories. This balanced approach is excellent for overall well-being.',
        categories: ['fitness', 'mental', 'emotional', 'spiritual'],
        confidence: consistencyScore,
        impact: 'positive',
        evidence: categories.map(cat => ({
          category: cat.name,
          data: { entries: cat.entries },
          date: new Date().toISOString(),
        })),
        recommendation: 'Keep up the great work! Your balanced approach to wellness is paying off.',
      };
    } else if (consistencyScore < 40) {
      const lowCategory = categories.reduce((min, cat) => 
        cat.entries < min.entries ? cat : min
      );

      return {
        id: `inconsistency-${Date.now()}`,
        pattern: `Focus Needed on ${lowCategory.name.charAt(0).toUpperCase() + lowCategory.name.slice(1)}`,
        description: `Your wellness routine shows some imbalance. The ${lowCategory.name} category has fewer entries compared to others.`,
        categories: [lowCategory.name],
        confidence: 100 - consistencyScore,
        impact: 'neutral',
        evidence: categories.map(cat => ({
          category: cat.name,
          data: { entries: cat.entries },
          date: new Date().toISOString(),
        })),
        recommendation: `Consider adding more ${lowCategory.name} activities to your routine for a more balanced wellness approach.`,
      };
    }

    return null;
  }

  /**
   * Get all correlations between categories
   */
  getCorrelations(data: ExtendedUserWellnessData): Correlation[] {
    const correlations: Correlation[] = [];
    // Implementation would calculate statistical correlations
    // This is a simplified version
    return correlations;
  }
}

export default new CrossCategoryPatternDetector();








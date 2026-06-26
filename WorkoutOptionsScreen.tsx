import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { GeneratedWorkoutPlan, GeneratedWorkoutPlanDay } from './data/workoutPrograms';
import { AppTheme } from './src/theme/appVisualTheme';

interface WorkoutOptionsScreenProps {
  workoutOptions: GeneratedWorkoutPlan[];
  generatedGoal?: string;
  onSave: (workout: GeneratedWorkoutPlan) => void;
  onStartWorkout?: (workout: GeneratedWorkoutPlan) => void;
  onBack: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.9;
const CARD_SPACING = 20;

export default function WorkoutOptionsScreen({
  workoutOptions,
  generatedGoal,
  onSave,
  onStartWorkout,
  onBack,
}: WorkoutOptionsScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < workoutOptions.length) {
      setCurrentIndex(index);
    }
  };

  const currentWorkout = workoutOptions[currentIndex];

  const handleSave = () => {
    if (currentWorkout) onSave(currentWorkout);
  };

  const handleStart = () => {
    if (currentWorkout && onStartWorkout) onStartWorkout(currentWorkout);
  };

  const renderWorkoutCard = ({
    item: workout,
  }: {
    item: GeneratedWorkoutPlan;
    index: number;
  }) => {
    return (
      <View style={styles.cardWrapper}>
        <View style={styles.card}>
          <ScrollView
            style={styles.cardContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            nestedScrollEnabled={true}
          >
            <View style={styles.header}>
              <Text style={styles.workoutName}>{workout.name}</Text>
              <Text style={styles.workoutInfo}>
                {workout.daysPerWeek} days/week • {workout.level} • {workout.goal.replace('_', ' ')}
              </Text>
            </View>

            <View style={styles.daysSection}>
              <Text style={styles.sectionTitle}>Training Days</Text>
              {workout.weeklyPlan?.weekDays.map((day: GeneratedWorkoutPlanDay, dayIndex: number) => (
                <View key={dayIndex} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayName}>{day.dayName}</Text>
                    <Text style={styles.dayFocus}>{day.focus}</Text>
                  </View>
                  <Text style={styles.dayDuration}>
                    ~{day.duration} min • {day.exercises.length} exercises
                  </Text>

                  <View style={styles.exercisesContainer}>
                    <Text style={styles.exercisesTitle}>Exercises</Text>
                    {day.exercises.map((ex, idx) => (
                      <Text key={`${ex.name}-${idx}`} style={styles.exerciseLine}>
                        <Text style={styles.exerciseName}>{ex.name}</Text>
                        <Text style={styles.exerciseSets}> — {ex.sets}×{ex.reps}</Text>
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose Your Workout</Text>
        <View style={styles.placeholder} />
      </View>

      {generatedGoal === 'weight_loss' && (
        <View style={styles.nutritionBanner}>
          <Text style={styles.nutritionBannerText}>
            Weight is lost in the kitchen, not the gym. Focus on nutrition and a sustainable calorie deficit — this plan keeps training effective without relying on extra cardio.
          </Text>
        </View>
      )}

      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={workoutOptions}
          renderItem={renderWorkoutCard}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          snapToInterval={SCREEN_WIDTH}
          decelerationRate="fast"
          getItemLayout={(data, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.indicatorContainer}>
          {workoutOptions.map((_, index) => (
            <View
              key={index}
              style={[styles.indicator, index === currentIndex && styles.indicatorActive]}
            />
          ))}
        </View>

        <Text style={styles.counter}>
          {currentIndex + 1} of {workoutOptions.length}
        </Text>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Plan</Text>
        </TouchableOpacity>

        {onStartWorkout ? (
          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>Save & Start Workout</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: AppTheme.accent,
    fontSize: 22,
    fontWeight: '600',
  },
  title: {
    color: AppTheme.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 60,
  },
  nutritionBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderRadius: 12,
  },
  nutritionBannerText: {
    color: AppTheme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  carouselContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  cardWrapper: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: CARD_WIDTH,
    height: '85%',
    backgroundColor: AppTheme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppTheme.border,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  workoutName: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  workoutInfo: {
    color: AppTheme.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  daysSection: {
    marginTop: 10,
  },
  sectionTitle: {
    color: AppTheme.accent,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 15,
    letterSpacing: 0.3,
  },
  dayCard: {
    backgroundColor: '#12181f',
    borderRadius: 14,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.22)',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  dayName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  dayFocus: {
    color: AppTheme.accent,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dayDuration: {
    color: AppTheme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  exercisesContainer: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
  },
  exercisesTitle: {
    color: AppTheme.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exerciseLine: {
    marginBottom: 8,
    lineHeight: 22,
  },
  exerciseName: {
    color: '#f3f4f6',
    fontSize: 15,
    fontWeight: '700',
  },
  exerciseSets: {
    color: AppTheme.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
    backgroundColor: AppTheme.bgScreen,
    gap: 10,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppTheme.border,
    marginHorizontal: 4,
  },
  indicatorActive: {
    backgroundColor: AppTheme.accent,
    width: 24,
  },
  counter: {
    color: AppTheme.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  saveButton: {
    backgroundColor: AppTheme.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: AppTheme.accentDark,
    fontSize: 17,
    fontWeight: '800',
  },
  startButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  startButtonText: {
    color: AppTheme.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
});

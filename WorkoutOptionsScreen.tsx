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
import { WorkoutPlan } from './data/workoutPrograms';

interface WorkoutOptionsScreenProps {
  workoutOptions: WorkoutPlan[];
  generatedGoal?: string;
  onSelect: (workout: WorkoutPlan) => void;
  onBack: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.9;
const CARD_SPACING = 20;

export default function WorkoutOptionsScreen({
  workoutOptions,
  generatedGoal,
  onSelect,
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

  const handleSelect = () => {
    onSelect(workoutOptions[currentIndex]);
  };

  const renderWorkoutCard = ({ item: workout, index }: { item: WorkoutPlan; index: number }) => {
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
            {workout.weeklyPlan?.weekDays.map((day, dayIndex) => (
              <View key={dayIndex} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayName}>{day.dayName}</Text>
                  <Text style={styles.dayFocus}>{day.focus}</Text>
                </View>
                <Text style={styles.dayDuration}>~{day.duration} min • {day.exercises.length} exercises</Text>
                
                <View style={styles.exercisesContainer}>
                  <Text style={styles.exercisesTitle}>Exercises:</Text>
                  <Text style={styles.exercisesList}>
                    {day.exercises.map((ex, idx) => 
                      `${ex.name} (${ex.sets}×${ex.reps})${idx < day.exercises.length - 1 ? ' • ' : ''}`
                    ).join('')}
                  </Text>
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
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
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
              style={[
                styles.indicator,
                index === currentIndex && styles.indicatorActive,
              ]}
            />
          ))}
        </View>
        
        <Text style={styles.counter}>
          {currentIndex + 1} of {workoutOptions.length}
        </Text>

        <TouchableOpacity style={styles.selectButton} onPress={handleSelect}>
          <Text style={styles.selectButtonText}>Select This Workout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#ffffff',
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
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
    borderLeftWidth: 4,
    borderLeftColor: '#00ff88',
    borderRadius: 8,
  },
  nutritionBannerText: {
    color: '#e0e0e0',
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
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#00ff88',
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
    borderBottomColor: '#2a2a2a',
  },
  workoutName: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  workoutInfo: {
    color: '#888888',
    fontSize: 14,
  },
  daysSection: {
    marginTop: 10,
  },
  sectionTitle: {
    color: '#00ff88',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  dayCard: {
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  dayFocus: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '500',
  },
  dayDuration: {
    color: '#888888',
    fontSize: 12,
    marginBottom: 10,
  },
  exercisesContainer: {
    marginTop: 8,
  },
  exercisesTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  exercisesList: {
    color: '#cccccc',
    fontSize: 13,
    lineHeight: 20,
    flexWrap: 'wrap',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 4,
  },
  indicatorActive: {
    backgroundColor: '#00ff88',
    width: 24,
  },
  counter: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  selectButton: {
    backgroundColor: '#00ff88',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});


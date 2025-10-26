import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MentalExercise {
  id: string;
  title: string;
  type: 'breathing' | 'visualization' | 'mindfulness';
  description: string;
  instructions: string[];
  duration: number; // in minutes
  completed: boolean;
  completedAt?: string;
}

interface DailyMentalProgress {
  id: string;
  date: string;
  exercises: {
    exerciseId: string;
    exerciseTitle: string;
    exerciseType: string;
    completedAt: string;
    duration: number;
  }[];
  totalExercises: number;
  completedExercises: number;
  totalDuration: number;
}

interface MentalScreenProps {
  onBack: () => void;
  onCompleteTask: (taskTitle: string) => void;
}

export default function MentalScreen({ onBack, onCompleteTask }: MentalScreenProps) {
  const [activeTab, setActiveTab] = useState<'breathing' | 'visualization' | 'mindfulness' | 'progress'>('breathing');
  const [dailyProgress, setDailyProgress] = useState<DailyMentalProgress[]>([]);
  const [mentalExercises, setMentalExercises] = useState<MentalExercise[]>([
    // Breathing Exercises
    {
      id: '1',
      title: '4-7-8 Breathing',
      type: 'breathing',
      description: 'Calm your nervous system with this powerful breathing technique',
      instructions: [
        'Sit comfortably with your back straight',
        'Place the tip of your tongue behind your upper front teeth',
        'Exhale completely through your mouth',
        'Close your mouth and inhale through your nose for 4 counts',
        'Hold your breath for 7 counts',
        'Exhale through your mouth for 8 counts',
        'Repeat as many cycles as needed'
      ],
      duration: 0,
      completed: false,
    },
    {
      id: '2',
      title: 'Box Breathing',
      type: 'breathing',
      description: 'Military-style breathing for focus and stress relief',
      instructions: [
        'Sit in a comfortable position',
        'Inhale through your nose for 4 counts',
        'Hold your breath for 4 counts',
        'Exhale through your nose for 4 counts',
        'Hold empty for 4 counts',
        'Repeat as many cycles as needed'
      ],
      duration: 0,
      completed: false,
    },
    {
      id: '3',
      title: 'Diaphragmatic Breathing',
      type: 'breathing',
      description: 'Deep belly breathing to activate your parasympathetic nervous system',
      instructions: [
        'Lie down or sit comfortably',
        'Place one hand on your chest, one on your belly',
        'Breathe in slowly through your nose',
        'Feel your belly rise while your chest stays still',
        'Exhale slowly through your mouth',
        'Continue for as long as feels comfortable'
      ],
      duration: 0,
      completed: false,
    },
    // Visualization Exercises
    {
      id: '4',
      title: 'Safe Place Visualization',
      type: 'visualization',
      description: 'Create a mental sanctuary for peace and relaxation',
      instructions: [
        'Close your eyes and take 3 deep breaths',
        'Imagine a place where you feel completely safe and peaceful',
        'Notice the details: colors, sounds, smells, textures',
        'Feel the warmth and comfort of this place',
        'Stay here for as long as you need',
        'When ready, slowly return to the present moment'
      ],
      duration: 0,
      completed: false,
    },
    {
      id: '5',
      title: 'Success Visualization',
      type: 'visualization',
      description: 'Program your mind for success and achievement',
      instructions: [
        'Sit in a comfortable position',
        'Close your eyes and take deep breaths',
        'Visualize yourself achieving your biggest goal',
        'See yourself succeeding with confidence',
        'Feel the emotions of accomplishment',
        'Notice all the details of your success',
        'Stay with this vision for as long as feels right'
      ],
      duration: 0,
      completed: false,
    },
    {
      id: '6',
      title: 'Nature Walk Visualization',
      type: 'visualization',
      description: 'Take a mental journey through a peaceful natural setting',
      instructions: [
        'Close your eyes and imagine walking in nature',
        'Picture a beautiful forest, beach, or mountain path',
        'Notice the sounds of birds, wind, or water',
        'Feel the ground beneath your feet',
        'Smell the fresh air and natural scents',
        'Continue your mental walk for as long as you enjoy it'
      ],
      duration: 0,
      completed: false,
    },
    // Mindfulness Exercises
    {
      id: '7',
      title: 'Body Scan Meditation',
      type: 'mindfulness',
      description: 'Bring awareness to each part of your body',
      instructions: [
        'Lie down comfortably or sit with your back straight',
        'Close your eyes and take a few deep breaths',
        'Start at the top of your head',
        'Slowly scan down through your body',
        'Notice any tension or sensations',
        'Breathe into any areas of tension',
        'Continue down to your toes',
        'Take as much time as you need for a complete scan'
      ],
      duration: 0,
      completed: false,
    },
    {
      id: '8',
      title: 'Mindful Eating',
      type: 'mindfulness',
      description: 'Practice present-moment awareness while eating',
      instructions: [
        'Choose a small piece of food (raisin, grape, or small bite)',
        'Look at it carefully, noticing its color and texture',
        'Smell it and notice any aromas',
        'Place it in your mouth without chewing',
        'Notice the taste and texture',
        'Chew slowly and mindfully',
        'Continue eating your meal with this awareness'
      ],
      duration: 0,
      completed: false,
    },
    {
      id: '9',
      title: 'Loving-Kindness Meditation',
      type: 'mindfulness',
      description: 'Cultivate compassion for yourself and others',
      instructions: [
        'Sit comfortably and close your eyes',
        'Take a few deep breaths to center yourself',
        'Repeat these phrases silently:',
        '"May I be happy, may I be healthy, may I be safe"',
        'Then think of someone you love and repeat:',
        '"May you be happy, may you be healthy, may you be safe"',
        'Continue for as long as feels right'
      ],
      duration: 0,
      completed: false,
    },
  ]);

  // Load mental exercises and daily progress from AsyncStorage on component mount
  useEffect(() => {
    loadMentalExercises();
    loadDailyProgress();
  }, []);

  const loadMentalExercises = async () => {
    try {
      const savedExercises = await AsyncStorage.getItem('mentalExercises');
      const lastResetDate = await AsyncStorage.getItem('mentalExercisesLastReset');
      const today = new Date().toDateString();
      
      console.log('Loading mental exercises:', savedExercises);
      console.log('Last reset date:', lastResetDate);
      console.log('Today:', today);
      
      if (savedExercises) {
        const parsedExercises = JSON.parse(savedExercises);
        console.log('Parsed mental exercises:', parsedExercises);
        
        // If it's a new day, reset all exercise completion status
        if (lastResetDate !== today) {
          console.log('New day detected - resetting exercise completion status');
          const resetExercises = parsedExercises.map(exercise => ({
            ...exercise,
            completed: false,
            completedAt: undefined
          }));
          setMentalExercises(resetExercises);
          await saveMentalExercises(resetExercises);
          await AsyncStorage.setItem('mentalExercisesLastReset', today);
        } else {
          setMentalExercises(parsedExercises);
        }
      }
    } catch (error) {
      console.error('Error loading mental exercises:', error);
    }
  };

  const saveMentalExercises = async (exercises: MentalExercise[]) => {
    try {
      console.log('Saving mental exercises:', exercises);
      await AsyncStorage.setItem('mentalExercises', JSON.stringify(exercises));
      console.log('Mental exercises saved successfully');
    } catch (error) {
      console.error('Error saving mental exercises:', error);
    }
  };

  const loadDailyProgress = async () => {
    try {
      const savedProgress = await AsyncStorage.getItem('dailyMentalProgress');
      console.log('Loading daily mental progress:', savedProgress);
      if (savedProgress) {
        const parsedProgress = JSON.parse(savedProgress);
        console.log('Parsed daily mental progress:', parsedProgress);
        setDailyProgress(parsedProgress);
      }
    } catch (error) {
      console.error('Error loading daily mental progress:', error);
    }
  };

  const saveDailyProgress = async (progress: DailyMentalProgress[]) => {
    try {
      console.log('Saving daily mental progress:', progress);
      await AsyncStorage.setItem('dailyMentalProgress', JSON.stringify(progress));
      console.log('Daily mental progress saved successfully');
    } catch (error) {
      console.error('Error saving daily mental progress:', error);
    }
  };

  const toggleExerciseCompletion = (exerciseId: string) => {
    const exercise = mentalExercises.find(e => e.id === exerciseId);
    if (!exercise) return;

    const updatedExercises = mentalExercises.map(ex => 
      ex.id === exerciseId 
        ? { 
            ...ex, 
            completed: !ex.completed, 
            completedAt: !ex.completed ? new Date().toISOString() : undefined 
          }
        : ex
    );
    setMentalExercises(updatedExercises);
    saveMentalExercises(updatedExercises);
    
    // Track daily progress
    const today = new Date().toDateString();
    const todayProgress = dailyProgress.find(p => p.date === today);
    
    if (!exercise.completed) {
      // Adding completion
      const newExerciseEntry = {
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        exerciseType: exercise.type,
        completedAt: new Date().toISOString(),
        duration: exercise.duration,
      };

      if (todayProgress) {
        // Update existing day
        const updatedProgress = dailyProgress.map(p => 
          p.date === today 
            ? {
                ...p,
                exercises: [...p.exercises, newExerciseEntry],
                completedExercises: p.completedExercises + 1,
                totalDuration: p.totalDuration + (exercise.duration || 0),
              }
            : p
        );
        setDailyProgress(updatedProgress);
        saveDailyProgress(updatedProgress);
      } else {
        // Create new day
        const newDayProgress: DailyMentalProgress = {
          id: Date.now().toString(),
          date: today,
          exercises: [newExerciseEntry],
          totalExercises: mentalExercises.length,
          completedExercises: 1,
          totalDuration: exercise.duration || 0,
        };
        const updatedProgress = [...dailyProgress, newDayProgress];
        setDailyProgress(updatedProgress);
        saveDailyProgress(updatedProgress);
      }
      
      onCompleteTask(exercise.title);
    } else {
      // Removing completion
      if (todayProgress) {
        const updatedProgress = dailyProgress.map(p => 
          p.date === today 
            ? {
                ...p,
                exercises: p.exercises.filter(e => e.exerciseId !== exerciseId),
                completedExercises: Math.max(0, p.completedExercises - 1),
                totalDuration: Math.max(0, p.totalDuration - (exercise.duration || 0)),
              }
            : p
        );
        setDailyProgress(updatedProgress);
        saveDailyProgress(updatedProgress);
      }
    }
  };

  const getExercisesByType = (type: MentalExercise['type']) => {
    return mentalExercises.filter(exercise => exercise.type === type);
  };

  const getProgressStats = () => {
    const total = mentalExercises.length;
    const completed = mentalExercises.filter(exercise => exercise.completed).length;
    const breathingCompleted = getExercisesByType('breathing').filter(e => e.completed).length;
    const visualizationCompleted = getExercisesByType('visualization').filter(e => e.completed).length;
    const mindfulnessCompleted = getExercisesByType('mindfulness').filter(e => e.completed).length;
    
    return {
      total,
      completed,
      breathingCompleted,
      visualizationCompleted,
      mindfulnessCompleted,
      percentage: Math.round((completed / total) * 100)
    };
  };

  const renderTabButton = (tab: string, title: string) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
      onPress={() => setActiveTab(tab as any)}
    >
      <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabButtonText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderExercise = (exercise: MentalExercise) => (
    <View key={exercise.id} style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseTitle}>{exercise.title}</Text>
          <Text style={styles.exerciseDescription}>{exercise.description}</Text>
          <Text style={styles.exerciseDuration}>
            {exercise.duration > 0 ? `${exercise.duration} minutes` : 'Flexible duration'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.checkbox, exercise.completed && styles.checkedBox]}
          onPress={() => toggleExerciseCompletion(exercise.id)}
        >
          {exercise.completed && <Text style={styles.checkmark}>DONE</Text>}
        </TouchableOpacity>
      </View>
      
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Instructions:</Text>
        {exercise.instructions.map((instruction, index) => (
          <Text key={index} style={styles.instruction}>
            {index + 1}. {instruction}
          </Text>
        ))}
      </View>
    </View>
  );

  const renderProgress = () => {
    const stats = getProgressStats();
    
    return (
      <View style={styles.tabContent}>
        <View style={styles.progressOverview}>
          <Text style={styles.sectionTitle}>Mental Wellness Progress</Text>
          <View style={styles.dailyResetInfo}>
            <Text style={styles.dailyResetText}>
              Exercise progress resets daily to help you track your daily mental wellness routine
            </Text>
          </View>
          <View style={styles.overallProgress}>
            <Text style={styles.progressPercentage}>{stats.percentage}%</Text>
            <Text style={styles.progressText}>
              {stats.completed} of {stats.total} exercises completed today
            </Text>
          </View>
        </View>

        <View style={styles.categoryProgress}>
          <View style={styles.categoryItem}>
            <Text style={styles.categoryTitle}>Breathing</Text>
            <Text style={styles.categoryStats}>
              {stats.breathingCompleted} of {getExercisesByType('breathing').length} completed
            </Text>
          </View>
          <View style={styles.categoryItem}>
            <Text style={styles.categoryTitle}>Visualization</Text>
            <Text style={styles.categoryStats}>
              {stats.visualizationCompleted} of {getExercisesByType('visualization').length} completed
            </Text>
          </View>
          <View style={styles.categoryItem}>
            <Text style={styles.categoryTitle}>Mindfulness</Text>
            <Text style={styles.categoryStats}>
              {stats.mindfulnessCompleted} of {getExercisesByType('mindfulness').length} completed
            </Text>
          </View>
        </View>

        <View style={styles.completedExercises}>
          <Text style={styles.sectionTitle}>Today's Completed</Text>
          {dailyProgress
            .filter(day => day.date === new Date().toDateString())
            .map(day => 
              day.exercises.map(exercise => (
                <View key={exercise.exerciseId} style={styles.completedItem}>
                  <Text style={styles.completedTitle}>{exercise.exerciseTitle}</Text>
                  <Text style={styles.completedDate}>
                    {new Date(exercise.completedAt).toLocaleTimeString()}
                  </Text>
                </View>
              ))
            )}
          {dailyProgress.filter(day => day.date === new Date().toDateString()).length === 0 && (
            <Text style={styles.noExercisesText}>No exercises completed today</Text>
          )}
        </View>

        <View style={styles.dailyHistory}>
          <Text style={styles.sectionTitle}>Daily History</Text>
          {dailyProgress
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 7)
            .map(day => (
              <View key={day.id} style={styles.dayItem}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayDate}>{new Date(day.date).toLocaleDateString()}</Text>
                  <Text style={styles.dayStats}>
                    {day.completedExercises}/{day.totalExercises} exercises{day.totalDuration > 0 ? ` • ${day.totalDuration}min` : ''}
                  </Text>
                </View>
                <View style={styles.dayExercises}>
                  {day.exercises.map(exercise => (
                    <Text key={exercise.exerciseId} style={styles.dayExercise}>
                      • {exercise.exerciseTitle}{exercise.duration > 0 ? ` (${exercise.duration}min)` : ''}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          {dailyProgress.length === 0 && (
            <Text style={styles.noHistoryText}>No mental wellness history yet</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mental Wellness</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {renderTabButton('breathing', 'Breathing')}
        {renderTabButton('visualization', 'Visualization')}
        {renderTabButton('mindfulness', 'Mindfulness')}
        {renderTabButton('progress', 'Progress')}
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'breathing' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Breathing Exercises</Text>
            <Text style={styles.sectionDescription}>
              Calm your nervous system and reduce stress with these powerful breathing techniques.
            </Text>
            {getExercisesByType('breathing').map(renderExercise)}
          </View>
        )}

        {activeTab === 'visualization' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Visualization Techniques</Text>
            <Text style={styles.sectionDescription}>
              Harness the power of your imagination to create positive mental states and achieve your goals.
            </Text>
            {getExercisesByType('visualization').map(renderExercise)}
          </View>
        )}

        {activeTab === 'mindfulness' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Mindfulness Practices</Text>
            <Text style={styles.sectionDescription}>
              Develop present-moment awareness and cultivate inner peace through mindfulness meditation.
            </Text>
            {getExercisesByType('mindfulness').map(renderExercise)}
          </View>
        )}

        {activeTab === 'progress' && renderProgress()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 50,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 15,
    marginVertical: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  activeTabButton: {
    backgroundColor: '#4ECDC4',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  tabButtonText: {
    fontSize: 12,
    color: '#ccc',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  activeTabButtonText: {
    color: '#1a1a1a',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  exerciseCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 15,
  },
  exerciseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 22,
    flexWrap: 'nowrap',
  },
  exerciseDescription: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
    lineHeight: 20,
    flexWrap: 'nowrap',
  },
  exerciseDuration: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  checkedBox: {
    backgroundColor: '#4ECDC4',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  checkmark: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  instructionsContainer: {
    backgroundColor: '#3a3a3a',
    borderRadius: 15,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 15,
    textShadowColor: 'rgba(78, 205, 196, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  instruction: {
    fontSize: 14,
    color: '#e0e0e0',
    marginBottom: 10,
    lineHeight: 22,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(78, 205, 196, 0.3)',
    paddingLeft: 12,
  },
  progressOverview: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.2)',
  },
  overallProgress: {
    alignItems: 'center',
  },
  progressPercentage: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 15,
    textShadowColor: 'rgba(78, 205, 196, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  progressText: {
    fontSize: 16,
    color: '#e0e0e0',
    fontWeight: '600',
    textAlign: 'center',
  },
  categoryProgress: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  categoryStats: {
    fontSize: 14,
    color: '#4ECDC4',
  },
  completedExercises: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
  },
  completedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  completedTitle: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
  },
  completedDate: {
    fontSize: 12,
    color: '#4ECDC4',
  },
  noExercisesText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  dailyHistory: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
  },
  dayItem: {
    backgroundColor: '#3a3a3a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  dayStats: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  dayExercises: {
    marginLeft: 8,
  },
  dayExercise: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 4,
    lineHeight: 20,
  },
  noHistoryText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  dailyResetInfo: {
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  dailyResetText: {
    fontSize: 14,
    color: '#4ECDC4',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
});

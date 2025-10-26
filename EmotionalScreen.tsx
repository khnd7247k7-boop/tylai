import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TabSwipeNavigation from './TabSwipeNavigation';

interface MoodEntry {
  id: string;
  date: string;
  primaryMood: string;
  intensity: number; // 1-10 scale
  emotions: string[];
  triggers: string[];
  physicalSensations: string[];
  thoughts: string;
  copingStrategies: string[];
  gratitude: string;
  energyLevel: number; // 1-10 scale
  sleepQuality: number; // 1-10 scale
  socialConnections: number; // 1-10 scale
}

interface EmotionalExercise {
  id: string;
  title: string;
  type: 'awareness' | 'regulation' | 'expression' | 'reflection';
  description: string;
  instructions: string[];
  duration: number; // in minutes, 0 for flexible
  completed: boolean;
  completedAt?: string;
}

interface EmotionalScreenProps {
  onBack: () => void;
  onCompleteTask: (taskTitle: string) => void;
}

export default function EmotionalScreen({ onBack, onCompleteTask }: EmotionalScreenProps) {
  const [activeTab, setActiveTab] = useState<'mood' | 'exercises' | 'history' | 'insights'>('mood');
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [emotionalExercises, setEmotionalExercises] = useState<EmotionalExercise[]>([
    // Emotional Awareness Exercises
    {
      id: '1',
      title: 'Emotion Body Scan',
      type: 'awareness',
      description: 'Connect with your body to identify where emotions are felt physically',
      instructions: [
        'Find a quiet, comfortable space to sit or lie down',
        'Close your eyes and take three deep breaths',
        'Slowly scan your body from head to toe',
        'Notice any areas of tension, warmth, or discomfort',
        'Ask yourself: "What emotion might this physical sensation represent?"',
        'Breathe into any areas of tension and observe what happens',
        'Take note of any emotions that arise during this process'
      ],
      duration: 0,
      completed: false,
    },
    {
      id: '2',
      title: 'Emotion Wheel Exploration',
      type: 'awareness',
      description: 'Use the emotion wheel to expand your emotional vocabulary',
      instructions: [
        'Look at the emotion wheel and identify your current primary emotion',
        'Notice the related emotions around it on the wheel',
        'Ask yourself: "What other emotions am I feeling right now?"',
        'Try to identify at least 3 different emotions you\'re experiencing',
        'Rate the intensity of each emotion from 1-10',
        'Reflect on what might be causing each emotion',
        'Practice naming these emotions out loud or in writing'
      ],
      duration: 0,
      completed: false,
    },
    {
      id: '3',
      title: 'The Three Whys Technique',
      type: 'awareness',
      description: 'Dive deeper into your emotions by asking "why" three times',
      instructions: [
        'Identify a strong emotion you\'re currently feeling',
        'Ask yourself: "Why am I feeling this emotion?"',
        'Write down or think about your first answer',
        'Ask again: "Why is this situation causing me to feel this way?"',
        'Reflect on this second answer',
        'Ask a third time: "Why do I typically react this way to such situations?"',
        'Notice any patterns or deeper insights that emerge'
      ],
      duration: 0,
      completed: false,
    },
    // Emotional Regulation Exercises
    {
      id: '4',
      title: 'Box Breathing for Emotional Regulation',
      type: 'regulation',
      description: 'Use controlled breathing to calm intense emotions',
      instructions: [
        'Sit comfortably with your back straight',
        'Inhale slowly through your nose for 4 counts',
        'Hold your breath for 4 counts',
        'Exhale slowly through your mouth for 4 counts',
        'Hold your breath for 4 counts',
        'Repeat this cycle 4-8 times',
        'Focus on the counting to anchor your mind',
        'Notice how your emotions begin to settle'
      ],
      duration: 0,
      completed: false,
    },
    {
      id: '5',
      title: 'Emotion Surfing',
      type: 'regulation',
      description: 'Learn to ride emotional waves without being overwhelmed',
      instructions: [
        'Acknowledge the emotion you\'re feeling without judgment',
        'Imagine the emotion as a wave in the ocean',
        'Instead of fighting the wave, imagine surfing on top of it',
        'Breathe deeply and ride the wave of emotion',
        'Remind yourself: "This emotion is temporary and will pass"',
        'Focus on your breathing as you surf the emotional wave',
        'Notice when the intensity begins to decrease naturally'
      ],
      duration: 0,
      completed: false,
    },
    // Emotional Expression Exercises
    {
      id: '6',
      title: 'Emotion Journaling',
      type: 'expression',
      description: 'Express your emotions through structured writing',
      instructions: [
        'Set aside 10-15 minutes for uninterrupted writing',
        'Start by describing the emotion you\'re feeling',
        'Write about what triggered this emotion',
        'Describe the physical sensations in your body',
        'Write about any thoughts or memories that came up',
        'Express what you wish you could say or do',
        'End by writing one thing you\'re grateful for today'
      ],
      duration: 0,
      completed: false,
    },
    {
      id: '7',
      title: 'Emotion Art Expression',
      type: 'expression',
      description: 'Express emotions through creative art without judgment',
      instructions: [
        'Gather art supplies (paper, colors, markers, etc.)',
        'Choose colors that represent your current emotions',
        'Draw, paint, or create without worrying about skill',
        'Let your emotions guide your creative process',
        'Don\'t judge what you create - focus on the process',
        'When finished, look at your creation and reflect',
        'Notice what emotions or insights arise from your art'
      ],
      duration: 0,
      completed: false,
    },
    // Emotional Reflection Exercises
    {
      id: '8',
      title: 'Daily Emotional Check-in',
      type: 'reflection',
      description: 'Reflect on your emotional patterns and growth',
      instructions: [
        'Review your day and identify the main emotions you experienced',
        'Rate your overall emotional well-being from 1-10',
        'Identify one emotional strength you showed today',
        'Notice one area where you could improve emotional awareness',
        'Reflect on how your emotions affected your relationships',
        'Set one intention for emotional growth tomorrow',
        'End with a moment of self-compassion and appreciation'
      ],
      duration: 0,
      completed: false,
    },
  ]);

  // Mood tracking form state
  const [currentMoodEntry, setCurrentMoodEntry] = useState<Partial<MoodEntry>>({
    primaryMood: '',
    intensity: 5,
    emotions: [],
    triggers: [],
    physicalSensations: [],
    thoughts: '',
    copingStrategies: [],
    gratitude: '',
    energyLevel: 5,
    sleepQuality: 5,
    socialConnections: 5,
  });

  // Load data from AsyncStorage on component mount
  useEffect(() => {
    loadMoodEntries();
    loadEmotionalExercises();
  }, []);

  const loadMoodEntries = async () => {
    try {
      const savedEntries = await AsyncStorage.getItem('moodEntries');
      if (savedEntries) {
        const parsedEntries = JSON.parse(savedEntries);
        setMoodEntries(parsedEntries);
      }
    } catch (error) {
      console.error('Error loading mood entries:', error);
    }
  };

  const saveMoodEntries = async (entries: MoodEntry[]) => {
    try {
      await AsyncStorage.setItem('moodEntries', JSON.stringify(entries));
    } catch (error) {
      console.error('Error saving mood entries:', error);
    }
  };

  const loadEmotionalExercises = async () => {
    try {
      const savedExercises = await AsyncStorage.getItem('emotionalExercises');
      if (savedExercises) {
        const parsedExercises = JSON.parse(savedExercises);
        setEmotionalExercises(parsedExercises);
      }
    } catch (error) {
      console.error('Error loading emotional exercises:', error);
    }
  };

  const saveEmotionalExercises = async (exercises: EmotionalExercise[]) => {
    try {
      await AsyncStorage.setItem('emotionalExercises', JSON.stringify(exercises));
    } catch (error) {
      console.error('Error saving emotional exercises:', error);
    }
  };

  const handleMoodSubmit = () => {
    if (!currentMoodEntry.primaryMood) {
      Alert.alert('Error', 'Please select your primary mood');
      return;
    }

    const newEntry: MoodEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      primaryMood: currentMoodEntry.primaryMood,
      intensity: currentMoodEntry.intensity || 5,
      emotions: currentMoodEntry.emotions || [],
      triggers: currentMoodEntry.triggers || [],
      physicalSensations: currentMoodEntry.physicalSensations || [],
      thoughts: currentMoodEntry.thoughts || '',
      copingStrategies: currentMoodEntry.copingStrategies || [],
      gratitude: currentMoodEntry.gratitude || '',
      energyLevel: currentMoodEntry.energyLevel || 5,
      sleepQuality: currentMoodEntry.sleepQuality || 5,
      socialConnections: currentMoodEntry.socialConnections || 5,
    };

    const updatedEntries = [newEntry, ...moodEntries];
    setMoodEntries(updatedEntries);
    saveMoodEntries(updatedEntries);

    // Reset form
    setCurrentMoodEntry({
      primaryMood: '',
      intensity: 5,
      emotions: [],
      triggers: [],
      physicalSensations: [],
      thoughts: '',
      copingStrategies: [],
      gratitude: '',
      energyLevel: 5,
      sleepQuality: 5,
      socialConnections: 5,
    });

    Alert.alert('Success', 'Mood entry saved successfully!');
  };

  const toggleExerciseCompletion = async (exerciseId: string) => {
    const updatedExercises = emotionalExercises.map(exercise =>
      exercise.id === exerciseId
        ? {
            ...exercise,
            completed: !exercise.completed,
            completedAt: !exercise.completed ? new Date().toISOString() : undefined
          }
        : exercise
    );
    setEmotionalExercises(updatedExercises);
    await saveEmotionalExercises(updatedExercises);

    // Complete emotional tasks
    if (!emotionalExercises.find(e => e.id === exerciseId)?.completed) {
      onCompleteTask('emotional awareness exercise');
    }
  };

  const moodOptions = [
    'Happy', 'Sad', 'Angry', 'Anxious', 'Excited', 'Calm', 'Frustrated', 'Grateful',
    'Lonely', 'Confident', 'Overwhelmed', 'Peaceful', 'Irritated', 'Hopeful', 'Worried', 'Content'
  ];

  const emotionOptions = [
    'Joy', 'Sadness', 'Anger', 'Fear', 'Surprise', 'Disgust', 'Love', 'Shame',
    'Guilt', 'Pride', 'Envy', 'Jealousy', 'Hope', 'Despair', 'Excitement', 'Boredom'
  ];

  const triggerOptions = [
    'Work stress', 'Relationship issues', 'Health concerns', 'Financial worries',
    'Social situations', 'Family dynamics', 'Personal goals', 'Unexpected events',
    'Social media', 'News/current events', 'Physical discomfort', 'Past memories'
  ];

  const physicalSensationOptions = [
    'Tight chest', 'Racing heart', 'Tense muscles', 'Headache', 'Stomach ache',
    'Sweating', 'Shaking', 'Heavy feeling', 'Lightness', 'Warmth', 'Coldness', 'Numbness'
  ];

  const copingStrategyOptions = [
    'Deep breathing', 'Exercise', 'Talking to someone', 'Journaling', 'Meditation',
    'Music', 'Nature walk', 'Creative activity', 'Self-care', 'Problem-solving', 'Seeking help'
  ];

  const renderMoodTracker = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Daily Mood Tracker</Text>
      
      {/* Primary Mood Selection */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>How are you feeling today?</Text>
        <View style={styles.moodGrid}>
          {moodOptions.map((mood) => (
            <TouchableOpacity
              key={mood}
              style={[
                styles.moodOption,
                currentMoodEntry.primaryMood === mood && styles.selectedMoodOption
              ]}
              onPress={() => setCurrentMoodEntry(prev => ({ ...prev, primaryMood: mood }))}
            >
              <Text style={[
                styles.moodOptionText,
                currentMoodEntry.primaryMood === mood && styles.selectedMoodOptionText
              ]}>
                {mood}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Intensity Scale */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>How intense is this feeling? (1-10)</Text>
        <View style={styles.intensityContainer}>
          <Text style={styles.intensityLabel}>1</Text>
          <View style={styles.intensitySlider}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.intensityDot,
                  currentMoodEntry.intensity === value && styles.selectedIntensityDot
                ]}
                onPress={() => setCurrentMoodEntry(prev => ({ ...prev, intensity: value }))}
              />
            ))}
          </View>
          <Text style={styles.intensityLabel}>10</Text>
        </View>
        <Text style={styles.intensityValue}>{currentMoodEntry.intensity}/10</Text>
      </View>

      {/* Additional Emotions */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>What other emotions are you experiencing?</Text>
        <View style={styles.emotionGrid}>
          {emotionOptions.map((emotion) => (
            <TouchableOpacity
              key={emotion}
              style={[
                styles.emotionOption,
                currentMoodEntry.emotions?.includes(emotion) && styles.selectedEmotionOption
              ]}
              onPress={() => {
                const currentEmotions = currentMoodEntry.emotions || [];
                const updatedEmotions = currentEmotions.includes(emotion)
                  ? currentEmotions.filter(e => e !== emotion)
                  : [...currentEmotions, emotion];
                setCurrentMoodEntry(prev => ({ ...prev, emotions: updatedEmotions }));
              }}
            >
              <Text style={[
                styles.emotionOptionText,
                currentMoodEntry.emotions?.includes(emotion) && styles.selectedEmotionOptionText
              ]}>
                {emotion}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Triggers */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>What might have triggered these feelings?</Text>
        <View style={styles.triggerGrid}>
          {triggerOptions.map((trigger) => (
            <TouchableOpacity
              key={trigger}
              style={[
                styles.triggerOption,
                currentMoodEntry.triggers?.includes(trigger) && styles.selectedTriggerOption
              ]}
              onPress={() => {
                const currentTriggers = currentMoodEntry.triggers || [];
                const updatedTriggers = currentTriggers.includes(trigger)
                  ? currentTriggers.filter(t => t !== trigger)
                  : [...currentTriggers, trigger];
                setCurrentMoodEntry(prev => ({ ...prev, triggers: updatedTriggers }));
              }}
            >
              <Text style={[
                styles.triggerOptionText,
                currentMoodEntry.triggers?.includes(trigger) && styles.selectedTriggerOptionText
              ]}>
                {trigger}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Physical Sensations */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>What physical sensations do you notice?</Text>
        <View style={styles.sensationGrid}>
          {physicalSensationOptions.map((sensation) => (
            <TouchableOpacity
              key={sensation}
              style={[
                styles.sensationOption,
                currentMoodEntry.physicalSensations?.includes(sensation) && styles.selectedSensationOption
              ]}
              onPress={() => {
                const currentSensations = currentMoodEntry.physicalSensations || [];
                const updatedSensations = currentSensations.includes(sensation)
                  ? currentSensations.filter(s => s !== sensation)
                  : [...currentSensations, sensation];
                setCurrentMoodEntry(prev => ({ ...prev, physicalSensations: updatedSensations }));
              }}
            >
              <Text style={[
                styles.sensationOptionText,
                currentMoodEntry.physicalSensations?.includes(sensation) && styles.selectedSensationOptionText
              ]}>
                {sensation}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Thoughts */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>What thoughts are going through your mind?</Text>
        <TextInput
          style={styles.thoughtsInput}
          placeholder="Write about your thoughts and mental patterns..."
          value={currentMoodEntry.thoughts}
          onChangeText={(text) => setCurrentMoodEntry(prev => ({ ...prev, thoughts: text }))}
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Coping Strategies */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>What helps you cope with these feelings?</Text>
        <View style={styles.copingGrid}>
          {copingStrategyOptions.map((strategy) => (
            <TouchableOpacity
              key={strategy}
              style={[
                styles.copingOption,
                currentMoodEntry.copingStrategies?.includes(strategy) && styles.selectedCopingOption
              ]}
              onPress={() => {
                const currentStrategies = currentMoodEntry.copingStrategies || [];
                const updatedStrategies = currentStrategies.includes(strategy)
                  ? currentStrategies.filter(s => s !== strategy)
                  : [...currentStrategies, strategy];
                setCurrentMoodEntry(prev => ({ ...prev, copingStrategies: updatedStrategies }));
              }}
            >
              <Text style={[
                styles.copingOptionText,
                currentMoodEntry.copingStrategies?.includes(strategy) && styles.selectedCopingOptionText
              ]}>
                {strategy}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Gratitude */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>What's one thing you're grateful for today?</Text>
        <TextInput
          style={styles.gratitudeInput}
          placeholder="Share something positive from your day..."
          value={currentMoodEntry.gratitude}
          onChangeText={(text) => setCurrentMoodEntry(prev => ({ ...prev, gratitude: text }))}
        />
      </View>

      {/* Additional Metrics */}
      <View style={styles.metricsContainer}>
        <Text style={styles.questionText}>Rate these areas (1-10):</Text>
        
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Energy Level</Text>
          <View style={styles.metricSlider}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.metricDot,
                  currentMoodEntry.energyLevel === value && styles.selectedMetricDot
                ]}
                onPress={() => setCurrentMoodEntry(prev => ({ ...prev, energyLevel: value }))}
              />
            ))}
          </View>
          <Text style={styles.metricValue}>{currentMoodEntry.energyLevel}</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Sleep Quality</Text>
          <View style={styles.metricSlider}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.metricDot,
                  currentMoodEntry.sleepQuality === value && styles.selectedMetricDot
                ]}
                onPress={() => setCurrentMoodEntry(prev => ({ ...prev, sleepQuality: value }))}
              />
            ))}
          </View>
          <Text style={styles.metricValue}>{currentMoodEntry.sleepQuality}</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Social Connections</Text>
          <View style={styles.metricSlider}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.metricDot,
                  currentMoodEntry.socialConnections === value && styles.selectedMetricDot
                ]}
                onPress={() => setCurrentMoodEntry(prev => ({ ...prev, socialConnections: value }))}
              />
            ))}
          </View>
          <Text style={styles.metricValue}>{currentMoodEntry.socialConnections}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleMoodSubmit}>
        <Text style={styles.submitButtonText}>Save Mood Entry</Text>
      </TouchableOpacity>
    </View>
  );

  const renderExercises = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Emotional Awareness Exercises</Text>
      {emotionalExercises.map((exercise) => (
        <View key={exercise.id} style={styles.exerciseCard}>
          <View style={styles.exerciseHeader}>
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseTitle}>{exercise.title}</Text>
              <Text style={styles.exerciseDescription}>{exercise.description}</Text>
              <Text style={styles.exerciseType}>{exercise.type.toUpperCase()}</Text>
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
      ))}
    </View>
  );

  const renderHistory = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Mood History</Text>
      {moodEntries.length === 0 ? (
        <Text style={styles.noHistoryText}>No mood entries yet. Start tracking your emotions!</Text>
      ) : (
        moodEntries.map((entry) => (
          <View key={entry.id} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyDate}>{new Date(entry.date).toLocaleDateString()}</Text>
              <Text style={styles.historyMood}>{entry.primaryMood}</Text>
              <Text style={styles.historyIntensity}>Intensity: {entry.intensity}/10</Text>
            </View>
            
            {entry.emotions.length > 0 && (
              <View style={styles.historySection}>
                <Text style={styles.historySectionTitle}>Emotions:</Text>
                <Text style={styles.historySectionText}>{entry.emotions.join(', ')}</Text>
              </View>
            )}
            
            {entry.triggers.length > 0 && (
              <View style={styles.historySection}>
                <Text style={styles.historySectionTitle}>Triggers:</Text>
                <Text style={styles.historySectionText}>{entry.triggers.join(', ')}</Text>
              </View>
            )}
            
            {entry.thoughts && (
              <View style={styles.historySection}>
                <Text style={styles.historySectionTitle}>Thoughts:</Text>
                <Text style={styles.historySectionText}>{entry.thoughts}</Text>
              </View>
            )}
            
            {entry.gratitude && (
              <View style={styles.historySection}>
                <Text style={styles.historySectionTitle}>Gratitude:</Text>
                <Text style={styles.historySectionText}>{entry.gratitude}</Text>
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );

  const renderInsights = () => {
    const recentEntries = moodEntries.slice(0, 7); // Last 7 entries
    const averageIntensity = recentEntries.length > 0 
      ? recentEntries.reduce((sum, entry) => sum + entry.intensity, 0) / recentEntries.length 
      : 0;
    
    const mostCommonMoods = moodEntries.reduce((acc, entry) => {
      acc[entry.primaryMood] = (acc[entry.primaryMood] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topMoods = Object.entries(mostCommonMoods)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    return (
      <View style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Emotional Insights</Text>
        
        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>Recent Mood Patterns</Text>
          <Text style={styles.insightText}>
            Average intensity: {averageIntensity.toFixed(1)}/10
          </Text>
          <Text style={styles.insightText}>
            Total entries: {moodEntries.length}
          </Text>
        </View>

        {topMoods.length > 0 && (
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>Most Common Moods</Text>
            {topMoods.map(([mood, count]) => (
              <Text key={mood} style={styles.insightText}>
                {mood}: {count} times
              </Text>
            ))}
          </View>
        )}

        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>Emotional Awareness Tips</Text>
          <Text style={styles.insightText}>
            • Notice patterns in your mood triggers
          </Text>
          <Text style={styles.insightText}>
            • Practice the emotional exercises regularly
          </Text>
          <Text style={styles.insightText}>
            • Use the "Three Whys" technique for deeper understanding
          </Text>
          <Text style={styles.insightText}>
            • Remember that all emotions are valid and temporary
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emotional Wellness</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'mood' && styles.tabButtonActive]}
          onPress={() => setActiveTab('mood')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'mood' && styles.tabButtonTextActive]}>Mood</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'exercises' && styles.tabButtonActive]}
          onPress={() => setActiveTab('exercises')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'exercises' && styles.tabButtonTextActive]}>Exercises</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'history' && styles.tabButtonTextActive]}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'insights' && styles.tabButtonActive]}
          onPress={() => setActiveTab('insights')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'insights' && styles.tabButtonTextActive]}>Insights</Text>
        </TouchableOpacity>
      </View>

      <TabSwipeNavigation
        tabs={['mood', 'exercises', 'history', 'insights']}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as any)}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {activeTab === 'mood' && renderMoodTracker()}
          {activeTab === 'exercises' && renderExercises()}
          {activeTab === 'history' && renderHistory()}
          {activeTab === 'insights' && renderInsights()}
        </ScrollView>
      </TabSwipeNavigation>
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
    padding: 5,
  },
  backButtonText: {
    color: '#96CEB4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 50,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 15,
    marginVertical: 15,
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  tabButtonActive: {
    backgroundColor: '#96CEB4',
    shadowColor: '#96CEB4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textAlign: 'center',
    lineHeight: 16,
  },
  tabButtonTextActive: {
    color: '#1a1a1a',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  tabContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  questionContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moodOption: {
    backgroundColor: '#3a3a3a',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedMoodOption: {
    backgroundColor: '#96CEB4',
    borderColor: '#96CEB4',
  },
  moodOptionText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedMoodOptionText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  intensityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  intensityLabel: {
    color: '#ccc',
    fontSize: 14,
  },
  intensitySlider: {
    flexDirection: 'row',
    gap: 8,
  },
  intensityDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3a3a3a',
    borderWidth: 2,
    borderColor: '#555',
  },
  selectedIntensityDot: {
    backgroundColor: '#96CEB4',
    borderColor: '#96CEB4',
  },
  intensityValue: {
    color: '#96CEB4',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emotionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emotionOption: {
    backgroundColor: '#3a3a3a',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedEmotionOption: {
    backgroundColor: '#96CEB4',
    borderColor: '#96CEB4',
  },
  emotionOptionText: {
    color: '#ccc',
    fontSize: 12,
  },
  selectedEmotionOptionText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  triggerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  triggerOption: {
    backgroundColor: '#3a3a3a',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedTriggerOption: {
    backgroundColor: '#96CEB4',
    borderColor: '#96CEB4',
  },
  triggerOptionText: {
    color: '#ccc',
    fontSize: 12,
  },
  selectedTriggerOptionText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  sensationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sensationOption: {
    backgroundColor: '#3a3a3a',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedSensationOption: {
    backgroundColor: '#96CEB4',
    borderColor: '#96CEB4',
  },
  sensationOptionText: {
    color: '#ccc',
    fontSize: 12,
  },
  selectedSensationOptionText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  thoughtsInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  copingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  copingOption: {
    backgroundColor: '#3a3a3a',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedCopingOption: {
    backgroundColor: '#96CEB4',
    borderColor: '#96CEB4',
  },
  copingOptionText: {
    color: '#ccc',
    fontSize: 12,
  },
  selectedCopingOptionText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  gratitudeInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 14,
  },
  metricsContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  metricLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    width: 120,
  },
  metricSlider: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  metricDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3a3a3a',
    borderWidth: 1,
    borderColor: '#555',
  },
  selectedMetricDot: {
    backgroundColor: '#96CEB4',
    borderColor: '#96CEB4',
  },
  metricValue: {
    color: '#96CEB4',
    fontSize: 14,
    fontWeight: 'bold',
    width: 30,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#96CEB4',
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#96CEB4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  exerciseCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    color: '#96CEB4',
    marginBottom: 5,
  },
  exerciseDescription: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
  },
  exerciseType: {
    fontSize: 12,
    color: '#96CEB4',
    fontWeight: '600',
    backgroundColor: 'rgba(150, 206, 180, 0.1)',
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
    borderColor: '#96CEB4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#96CEB4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  checkedBox: {
    backgroundColor: '#96CEB4',
    shadowColor: '#96CEB4',
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
    borderLeftColor: '#96CEB4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  instruction: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
    lineHeight: 20,
  },
  historyCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  historyDate: {
    fontSize: 14,
    color: '#888',
  },
  historyMood: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#96CEB4',
  },
  historyIntensity: {
    fontSize: 12,
    color: '#ccc',
  },
  historySection: {
    marginBottom: 10,
  },
  historySectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  historySectionText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  noHistoryText: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  insightCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#96CEB4',
    marginBottom: 10,
  },
  insightText: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 5,
    lineHeight: 20,
  },
});

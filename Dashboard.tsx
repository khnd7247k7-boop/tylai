import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useToast } from './src/components/ToastProvider';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveUserData, loadUserData } from './src/utils/userStorage';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  category: 'fitness' | 'mindset' | 'spiritual' | 'emotional';
}

interface DashboardProps {
  onLogout: () => void;
  onNavigateToFitness: () => void;
  onNavigateToMental: () => void;
  onNavigateToEmotional: () => void;
  onNavigateToAI: () => void;
  onNavigateToSettings: () => void;
  onNavigateToSpiritual: () => void;
}

interface GratitudeEntry {
  id: string;
  date: string;
  entries: string[];
  reflection: string;
}

export default function Dashboard({ onLogout, onNavigateToFitness, onNavigateToMental, onNavigateToEmotional, onNavigateToAI, onNavigateToSettings, onNavigateToSpiritual }: DashboardProps) {
  const { showToast } = useToast();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Task['category'] | null>(null);
  const [manualQuoteIndex, setManualQuoteIndex] = useState<number | null>(null);
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: '30-minute cardio workout', completed: false, category: 'fitness' },
    { id: '2', title: 'Strength training - upper body', completed: false, category: 'fitness' },
    { id: '3', title: 'Practice gratitude journaling', completed: false, category: 'mindset' },
    { id: '4', title: 'Read 20 pages of self-help book', completed: false, category: 'mindset' },
    { id: '5', title: 'Morning meditation (10 minutes)', completed: false, category: 'spiritual' },
    { id: '6', title: 'Connect with nature walk', completed: false, category: 'spiritual' },
    { id: '7', title: 'Express feelings to a friend', completed: false, category: 'emotional' },
    { id: '8', title: 'Practice deep breathing exercises', completed: false, category: 'emotional' },
  ]);

  // Load all data from AsyncStorage on component mount and refresh gratitude entries
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Refresh gratitude entries periodically to update circle progress
  useEffect(() => {
    const loadGratitudeEntries = async () => {
      try {
        const savedGratitude = await loadUserData<GratitudeEntry[]>('gratitudeEntries');
        if (savedGratitude) {
          setGratitudeEntries(savedGratitude);
        }
      } catch (error) {
        console.error('Error loading gratitude entries:', error);
      }
    };
    
    // Load gratitude entries every 2 seconds to catch updates
    const interval = setInterval(loadGratitudeEntries, 2000);
    loadGratitudeEntries(); // Initial load
    
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = new Date().toDateString();
      const lastResetDate = await loadUserData<string>('dashboardTasksLastReset');
      
      // Load tasks
      const parsedTasks = await loadUserData<Task[]>('dashboardTasks');
      if (parsedTasks) {
        console.log('Loading dashboard tasks:', parsedTasks);
        
        // If it's a new day, reset all task completions
        if (lastResetDate !== today) {
          console.log('New day detected - resetting dashboard task completions');
          const resetTasks = parsedTasks.map(task => ({
            ...task,
            completed: false
          }));
          setTasks(resetTasks);
          await saveTasks(resetTasks);
          await saveUserData('dashboardTasksLastReset', today);
        } else {
          setTasks(parsedTasks);
        }
      } else {
        // First time loading - set reset date
        await saveUserData('dashboardTasksLastReset', today);
      }

      // Load check-in status
      const checkInData = await loadUserData<{ date: string; checkedIn: boolean; timestamp: string }>('dailyCheckIn');
      if (checkInData) {
        if (checkInData.date === today) {
          console.log('Loading check-in status:', checkInData);
          setIsCheckedIn(checkInData.checkedIn);
        } else {
          // Reset check-in for new day
          setIsCheckedIn(false);
        }
      }

      // Load gratitude entries
      const savedGratitude = await loadUserData<GratitudeEntry[]>('gratitudeEntries');
      if (savedGratitude) {
        setGratitudeEntries(savedGratitude);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const saveTasks = async (tasksToSave: Task[]) => {
    try {
      console.log('Saving dashboard tasks:', tasksToSave);
      await saveUserData('dashboardTasks', tasksToSave);
      console.log('Dashboard tasks saved successfully');
    } catch (error) {
      console.error('Error saving dashboard tasks:', error);
    }
  };

  const saveCheckInStatus = async (checkedIn: boolean) => {
    try {
      const checkInData = {
        date: new Date().toDateString(),
        checkedIn: checkedIn,
        timestamp: new Date().toISOString()
      };
      console.log('Saving check-in status:', checkInData);
      await saveUserData('dailyCheckIn', checkInData);
      console.log('Check-in status saved successfully');
    } catch (error) {
      console.error('Error saving check-in status:', error);
    }
  };

  // Comprehensive quote collection for daily rotation
  const quotes = [
    // Fitness & Health Quotes
    "The only bad workout is the one that didn't happen. Every step forward is progress, no matter how small.",
    "Your body can do it. It's your mind that you have to convince.",
    "The groundwork for all happiness is good health.",
    "Take care of your body. It's the only place you have to live.",
    "Health is not valued until sickness comes.",
    "The first wealth is health.",
    "Exercise is king. Nutrition is queen. Put them together and you've got a kingdom.",
    "Don't wish for it, work for it.",
    "Success isn't always about greatness. It's about consistency.",
    "The pain you feel today is the strength you feel tomorrow.",
    
    // Mental Wellness Quotes
    "You are not your thoughts. You are the observer of your thoughts.",
    "The mind is everything. What you think you become.",
    "Peace comes from within. Do not seek it without.",
    "Your mental health is a priority. Your happiness is essential.",
    "It's okay to not be okay. It's okay to ask for help.",
    "You don't have to be perfect to be amazing.",
    "Progress, not perfection.",
    "Self-care is not selfish. It's essential.",
    "You are enough, just as you are.",
    "The present moment is the only time over which we have dominion.",
    
    // Emotional Wellness Quotes
    "Feelings are just visitors, let them come and go.",
    "Your emotions are valid. Your reactions are your responsibility.",
    "Healing is not linear. It's okay to have setbacks.",
    "Vulnerability is not weakness; it's our greatest measure of courage.",
    "You are allowed to feel your feelings.",
    "Emotional pain is not a sign of weakness. It's a sign of being human.",
    "The way you treat yourself sets the standard for others.",
    "You don't have to be positive all the time. It's perfectly okay to feel sad.",
    "Your feelings are temporary, but your strength is permanent.",
    "It's okay to take breaks. It's okay to rest. It's okay to heal.",
    
    // Motivation & Growth Quotes
    "The only way to do great work is to love what you do.",
    "Believe you can and you're halfway there.",
    "Don't be afraid to give up the good to go for the great.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "The future belongs to those who believe in the beauty of their dreams.",
    "You are never too old to set another goal or to dream a new dream.",
    "The only impossible journey is the one you never begin.",
    "What lies behind us and what lies before us are tiny matters compared to what lies within us.",
    "Life is 10% what happens to you and 90% how you react to it.",
    "The way to get started is to quit talking and begin doing.",
    
    // Mindfulness & Spirituality Quotes
    "Be present in all things and thankful for all things.",
    "The present moment is the only time over which we have dominion.",
    "Mindfulness is about being fully awake in our lives.",
    "Wherever you are, be there totally.",
    "The mind is like water. When agitated, it becomes difficult to see. When calm, everything becomes clear.",
    "Peace is the result of retraining your mind to process life as it is, rather than as you think it should be.",
    "The best way to take care of the future is to take care of the present moment.",
    "You have power over your mind - not outside events. Realize this, and you will find strength.",
    "The soul always knows what to do to heal itself. The challenge is to silence the mind.",
    "In the end, only three things matter: how much you loved, how gently you lived, and how gracefully you let go.",
  ];

  // Get quote of the day based on current date or manual selection
  const getQuoteOfTheDay = () => {
    if (manualQuoteIndex !== null) {
      return quotes[manualQuoteIndex];
    }
    
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    const quoteIndex = dayOfYear % quotes.length;
    return quotes[quoteIndex];
  };

  const quoteOfTheDay = getQuoteOfTheDay();

  // Function to refresh quote manually
  const refreshQuote = () => {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    setManualQuoteIndex(randomIndex);
  };

  // Function to reset to daily quote
  const resetToDailyQuote = () => {
    setManualQuoteIndex(null);
  };

  const handleCheckIn = async () => {
    if (!isCheckedIn) {
      setIsCheckedIn(true);
      await saveCheckInStatus(true);
      // no notification
    } else {
      // no notification
    }
  };

  const toggleTask = async (taskId: string) => {
    const updatedTasks = tasks.map(task => 
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
  };

  const completeTaskByTitle = async (taskTitle: string) => {
    const updatedTasks = tasks.map(task => 
      task.title.toLowerCase().includes(taskTitle.toLowerCase()) 
        ? { ...task, completed: true } 
        : task
    );
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
  };

  const getTasksByCategory = (category: Task['category']) => {
    return tasks.filter(task => task.category === category);
  };

  const getCompletionRate = (category: Task['category']) => {
    const categoryTasks = getTasksByCategory(category);
    if (categoryTasks.length === 0) return 0;
    const completed = categoryTasks.filter(task => task.completed).length;
    return Math.round((completed / categoryTasks.length) * 100);
  };

  const getCategoryProgress = (category: Task['category']) => {
    const categoryTasks = getTasksByCategory(category);
    if (categoryTasks.length === 0) return 0;
    const completed = categoryTasks.filter(task => task.completed).length;
    return completed / categoryTasks.length;
  };

  const getCategoryColor = (category: Task['category']) => {
    const colors = {
      fitness: '#FF6B6B',
      mindset: '#4ECDC4', 
      spiritual: '#45B7D1',
      emotional: '#96CEB4'
    };
    return colors[category];
  };

  const getCategoryTitle = (category: Task['category']) => {
    const titles = {
      fitness: 'Physical',
      mindset: 'Mental',
      spiritual: 'Spiritual',
      emotional: 'Emotional'
    };
    return titles[category];
  };

  const getCategoryAngle = (category: Task['category']) => {
    const angles = {
      fitness: 0,
      mindset: 90,
      spiritual: 180,
      emotional: 270
    };
    return angles[category];
  };

  const getCategoryProgressAngle = (category: Task['category']) => {
    const progress = getCategoryProgress(category);
    return progress * 90; // Each section is 90 degrees
  };

  const TaskModal = () => {
    if (!selectedCategory) return null;
    
    const categoryTasks = getTasksByCategory(selectedCategory);
    const categoryColor = getCategoryColor(selectedCategory);
    const categoryTitle = getCategoryTitle(selectedCategory);
    
    return (
      <Modal
        visible={selectedCategory !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCategory(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedCategory(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: categoryColor }]}>
                {categoryTitle} Tasks
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={styles.closeButtonText}>X</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {categoryTasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.modalTaskItem}
                  onPress={() => toggleTask(task.id)}
                >
                  <View style={[
                    styles.modalCheckbox,
                    task.completed && { backgroundColor: categoryColor, borderColor: categoryColor }
                  ]}>
                  </View>
                  <Text style={[
                    styles.modalTaskText,
                    task.completed && styles.modalTaskTextCompleted
                  ]}>
                    {task.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <Text style={styles.modalProgressText}>
                {categoryTasks.filter(t => t.completed).length} of {categoryTasks.length} tasks completed
              </Text>
            </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  const CircularProgressCircle = () => {
    const categories: Task['category'][] = ['fitness', 'mindset', 'spiritual', 'emotional'];
    const circleSize = 280;
    const radius = circleSize / 2;
    
    return (
      <View style={styles.bigCircleContainer}>
        <View style={styles.bigCircle}>
          {/* Background circle */}
          <View style={styles.circleBackground} />
          
          {/* Background progress track - shows full circular path */}
          <View style={styles.progressTrack} />
          
          {/* Segment dividers */}
          {[0, 90, 180, 270].map((angle, index) => (
            <View
              key={angle}
              style={[
                styles.segmentDivider,
                {
                  transform: [{ rotate: `${angle}deg` }],
                }
              ]}
            />
          ))}
          
          {/* Overall progress arc - fills entire circle based on total task completions and gratitude entries */}
          {(() => {
            const today = new Date().toISOString().split('T')[0];
            const todayGratitudeEntries = gratitudeEntries.filter(entry => entry.date === today);
            const gratitudeCount = todayGratitudeEntries.length;
            
            // Calculate spiritual section progress based on gratitude entries (3 entries = 100% of spiritual section)
            const spiritualProgress = Math.min(gratitudeCount / 3, 1); // 0 to 1
            
            // Calculate task completions
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.completed).length;
            
            // Calculate progress for each quadrant
            // Each quadrant represents one category (fitness, mindset, spiritual, emotional)
            const fitnessTasks = tasks.filter(t => t.category === 'fitness');
            const mindsetTasks = tasks.filter(t => t.category === 'mindset');
            const spiritualTasks = tasks.filter(t => t.category === 'spiritual');
            const emotionalTasks = tasks.filter(t => t.category === 'emotional');
            
            const fitnessProgress = fitnessTasks.length > 0 
              ? fitnessTasks.filter(t => t.completed).length / fitnessTasks.length 
              : 0;
            const mindsetProgress = mindsetTasks.length > 0 
              ? mindsetTasks.filter(t => t.completed).length / mindsetTasks.length 
              : 0;
            // Spiritual progress uses gratitude entries (3 entries = full spiritual section)
            const emotionalProgress = emotionalTasks.length > 0 
              ? emotionalTasks.filter(t => t.completed).length / emotionalTasks.length 
              : 0;
            
            // Calculate overall progress around the circle
            // Each quadrant fills independently based on its own progress
            // Progress flows clockwise: fitness (top) -> mindset (right) -> spiritual (bottom) -> emotional (left)
            // Each quadrant is 90 degrees
            
            // Calculate cumulative progress angle around the circle
            // Each section contributes up to 90 degrees based on its completion
            let totalProgressAngle = 0;
            
            // Fitness (top): 0-90 degrees
            totalProgressAngle += fitnessProgress * 90;
            
            // Mindset (right): 90-180 degrees
            totalProgressAngle += mindsetProgress * 90;
            
            // Spiritual (bottom): 180-270 degrees - uses gratitude entries (3 entries = 100%)
            totalProgressAngle += spiritualProgress * 90;
            
            // Emotional (left): 270-360 degrees
            totalProgressAngle += emotionalProgress * 90;
            
            // Clamp to 360 degrees max
            totalProgressAngle = Math.min(totalProgressAngle, 360);
            
            // Determine colors for each quadrant based on which category they belong to
            const getColorForAngle = (angle: number) => {
              if (angle < 90) return getCategoryColor('fitness');
              if (angle < 180) return getCategoryColor('mindset');
              if (angle < 270) return getCategoryColor('spiritual');
              return getCategoryColor('emotional');
            };
            
            // Determine which borders to show based on total progress angle
            const showTop = totalProgressAngle > 0;
            const showRight = totalProgressAngle > 90;
            const showBottom = totalProgressAngle > 180;
            const showLeft = totalProgressAngle > 270;
            
            // Get colors for each segment
            const topColor = showTop ? getColorForAngle(45) : 'transparent';
            const rightColor = showRight ? getColorForAngle(135) : 'transparent';
            const bottomColor = showBottom ? getColorForAngle(225) : 'transparent';
            const leftColor = showLeft ? getColorForAngle(315) : 'transparent';
            
            return (
              <View style={styles.progressSegmentContainer}>
                {/* Overall progress ring - flows clockwise around entire circle */}
                <View
                  style={[
                    styles.progressRing,
                    {
                      borderTopColor: topColor,
                      borderRightColor: rightColor,
                      borderBottomColor: bottomColor,
                      borderLeftColor: leftColor,
                    }
                  ]}
                />
              </View>
            );
          })()}
          
          {/* Category labels integrated into segments */}
          {categories.map((category, index) => {
            const color = getCategoryColor(category);
            const progress = getCategoryProgress(category);
            const angle = index * 90 + 45; // Center of each quadrant
            const labelRadius = radius * 0.75; // Position labels inside the circle
            const x = Math.cos((angle) * Math.PI / 180) * labelRadius;
            const y = Math.sin((angle) * Math.PI / 180) * labelRadius;
            
            return (
              <TouchableOpacity
                key={category}
                style={[
                  styles.segmentButton,
                  {
                    left: radius + x - 45,
                    top: radius + y - 20,
                  }
                ]}
                onPress={() => {
                  if (category === 'fitness') {
                    onNavigateToFitness();
                  } else if (category === 'mindset') {
                    onNavigateToMental();
                  } else if (category === 'emotional') {
                    onNavigateToEmotional();
                  } else if (category === 'spiritual') {
                    onNavigateToSpiritual();
                  } else {
                    setSelectedCategory(category);
                  }
                }}
              >
                <Text style={[styles.segmentButtonTitle, { color }]}>
                  {getCategoryTitle(category)}
                </Text>
                <View style={[styles.segmentProgressBar, { backgroundColor: color + '40' }]}>
                  <View 
                    style={[
                      styles.segmentProgressFill, 
                      { 
                        width: `${progress * 100}%`,
                        backgroundColor: color 
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.segmentProgressText}>
                  {Math.round(progress * 100)}%
                </Text>
              </TouchableOpacity>
            );
          })}
          
          {/* Center content - removed for cleaner design */}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.greeting}>Welcome back!</Text>
            <TouchableOpacity style={styles.settingsButton} onPress={onNavigateToSettings}>
              <Text style={styles.settingsText}>⚙️</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</Text>
        </View>

        {/* Check-in Section */}
        <View style={styles.checkInSection}>
          <Text style={styles.sectionTitle}>Daily Check-in</Text>
          <TouchableOpacity
            style={[styles.checkInButton, isCheckedIn && styles.checkInButtonCompleted]}
            onPress={handleCheckIn}
            disabled={isCheckedIn}
          >
            <Text style={styles.checkInButtonText}>
              {isCheckedIn ? 'Checked In' : 'Check In Today'}
            </Text>
          </TouchableOpacity>
        </View>


        {/* Quote of the Day */}
        <View style={styles.quoteSection}>
          <View style={styles.quoteHeader}>
            <Text style={styles.quoteTitle}>Quote of the Day</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={refreshQuote}>
              <Text style={styles.refreshButtonText}>↻</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.quoteDate}>{new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</Text>
          <View style={styles.quoteContainer}>
            <Text style={styles.quoteText}>"{quoteOfTheDay}"</Text>
          </View>
          {manualQuoteIndex !== null && (
            <TouchableOpacity style={styles.resetButton} onPress={resetToDailyQuote}>
              <Text style={styles.resetButtonText}>Reset to Daily Quote</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Big Circle Focus Areas */}
        <Text style={styles.categoriesTitle}>Today's Focus Areas</Text>
        <CircularProgressCircle />
        
        {/* Task Modal */}
        <TaskModal />

        {/* Overall Progress */}
        <View style={styles.overallProgressSection}>
          <Text style={styles.progressTitle}>Overall Progress</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {tasks.filter(t => t.completed).length} of {tasks.length} tasks completed
          </Text>
        </View>

        {/* AI Insights Button */}
        <TouchableOpacity style={styles.aiButton} onPress={onNavigateToAI}>
          <Text style={styles.aiButtonIcon}>AI</Text>
          <View style={styles.aiButtonContent}>
            <Text style={styles.aiButtonTitle}>AI Insights</Text>
            <Text style={styles.aiButtonSubtitle}>Get personalized recommendations</Text>
          </View>
          <Text style={styles.aiButtonArrow}>{'>'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  settingsButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsText: {
    fontSize: 18,
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  date: {
    fontSize: 16,
    color: '#888',
  },
  checkInSection: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  checkInButton: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  checkInButtonCompleted: {
    backgroundColor: '#4CAF50',
  },
  checkInButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  quoteSection: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quoteTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 18,
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  quoteDate: {
    fontSize: 14,
    color: '#4ECDC4',
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  resetButton: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 12,
    alignSelf: 'center',
  },
  resetButtonText: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  quoteContainer: {
    backgroundColor: '#3a3a3a',
    borderRadius: 12,
    padding: 15,
  },
  quoteText: {
    fontSize: 16,
    color: '#fff',
    fontStyle: 'italic',
    lineHeight: 24,
  },
  categoriesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  completionRate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00ff88',
  },
  overallProgressSection: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#3a3a3a',
    borderRadius: 4,
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00ff88',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  // Big Circle Focus Areas
  bigCircleContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  bigCircle: {
    width: 280,
    height: 280,
    position: 'relative',
    marginBottom: 20,
  },
  circleBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 140,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#2a2a2a',
  },
  progressTrack: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 140,
    borderWidth: 8,
    borderColor: '#2a2a2a',
    opacity: 0.3,
  },
  segmentDivider: {
    position: 'absolute',
    width: 4,
    height: '100%',
    backgroundColor: '#1a1a1a',
    left: '50%',
    top: 0,
    marginLeft: -2,
  },
  progressSegmentContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  progressRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 140,
    borderWidth: 8,
    borderColor: 'transparent',
  },
  circleCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
  },
  centerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  centerProgress: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ff88',
    textAlign: 'center',
  },
  centerSubtext: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 2,
  },
  segmentButton: {
    position: 'absolute',
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  segmentButtonTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  segmentProgressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  segmentProgressFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  segmentProgressText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Task Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ff6b6b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContent: {
    maxHeight: 300,
    padding: 20,
  },
  modalTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 5,
  },
  modalCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCheckmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalTaskText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  modalTaskTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#3a3a3a',
    alignItems: 'center',
  },
  modalProgressText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  aiButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#4ECDC4',
  },
  aiButtonIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  aiButtonContent: {
    flex: 1,
  },
  aiButtonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 4,
  },
  aiButtonSubtitle: {
    fontSize: 14,
    color: '#ccc',
  },
  aiButtonArrow: {
    fontSize: 20,
    color: '#4ECDC4',
    fontWeight: 'bold',
  },
}); 
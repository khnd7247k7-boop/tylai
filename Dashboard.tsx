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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

export default function Dashboard({ onLogout, onNavigateToFitness, onNavigateToMental, onNavigateToEmotional, onNavigateToAI }: DashboardProps) {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Task['category'] | null>(null);
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

  // Load all data from AsyncStorage on component mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load tasks
      const savedTasks = await AsyncStorage.getItem('dashboardTasks');
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks);
        console.log('Loading dashboard tasks:', parsedTasks);
        setTasks(parsedTasks);
      }

      // Load check-in status
      const savedCheckIn = await AsyncStorage.getItem('dailyCheckIn');
      if (savedCheckIn) {
        const checkInData = JSON.parse(savedCheckIn);
        const today = new Date().toDateString();
        if (checkInData.date === today) {
          console.log('Loading check-in status:', checkInData);
          setIsCheckedIn(checkInData.checkedIn);
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const saveTasks = async (tasksToSave: Task[]) => {
    try {
      console.log('Saving dashboard tasks:', tasksToSave);
      await AsyncStorage.setItem('dashboardTasks', JSON.stringify(tasksToSave));
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
      await AsyncStorage.setItem('dailyCheckIn', JSON.stringify(checkInData));
      console.log('Check-in status saved successfully');
    } catch (error) {
      console.error('Error saving check-in status:', error);
    }
  };

  const quoteOfTheDay = "The only bad workout is the one that didn't happen. Every step forward is progress, no matter how small.";

  const handleCheckIn = async () => {
    if (!isCheckedIn) {
      setIsCheckedIn(true);
      await saveCheckInStatus(true);
      Alert.alert('Success!', 'You\'ve checked in for today! Keep up the great work!');
    } else {
      Alert.alert('Already Checked In', 'You\'ve already checked in today. Come back tomorrow!');
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
        <View style={styles.modalOverlay}>
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
                    task.completed && { backgroundColor: categoryColor }
                  ]}>
                    {task.completed && <Text style={styles.modalCheckmark}>DONE</Text>}
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
        </View>
      </Modal>
    );
  };

  const CircularProgressCircle = () => {
    const categories: Task['category'][] = ['fitness', 'mindset', 'spiritual', 'emotional'];
    
    return (
      <View style={styles.bigCircleContainer}>
        <View style={styles.bigCircle}>
          {/* Background circle */}
          <View style={styles.circleBackground} />
          
          {/* Progress sections */}
          {categories.map((category, index) => {
            const progress = getCategoryProgress(category);
            const color = getCategoryColor(category);
            const angle = getCategoryAngle(category);
            
            return (
              <View key={category} style={styles.progressSection}>
                {/* Progress arc for this category */}
                <View 
                  style={[
                    styles.progressArc,
                    {
                      transform: [{ rotate: `${angle}deg` }],
                      borderColor: color,
                      borderTopColor: progress > 0 ? color : 'transparent',
                      borderRightColor: progress > 0.25 ? color : 'transparent',
                      borderBottomColor: progress > 0.5 ? color : 'transparent',
                      borderLeftColor: progress > 0.75 ? color : 'transparent',
                    }
                  ]}
                />
              </View>
            );
          })}
          
          {/* Center content */}
          <View style={styles.circleCenter}>
            <Text style={styles.centerTitle}>Focus Areas</Text>
            <Text style={styles.centerProgress}>
              {Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)}%
            </Text>
            <Text style={styles.centerSubtext}>Overall Progress</Text>
          </View>
        </View>
        
        {/* Category buttons positioned at corners around the circle */}
        {categories.map((category) => {
          const color = getCategoryColor(category);
          const progress = getCategoryProgress(category);
          const angle = getCategoryAngle(category);
          
          // Calculate position for corner buttons
          const radius = 140; // Half of circle diameter
          const buttonDistance = 180; // Distance from center
          const x = Math.cos((angle + 45) * Math.PI / 180) * buttonDistance;
          const y = Math.sin((angle + 45) * Math.PI / 180) * buttonDistance;
          
          return (
            <TouchableOpacity
              key={category}
              style={[
                styles.cornerButton,
                {
                  backgroundColor: color,
                  left: 140 + x - 30, // Center circle + offset - half button width
                  top: 140 + y - 30,  // Center circle + offset - half button height
                }
              ]}
                   onPress={() => {
                     if (category === 'fitness') {
                       onNavigateToFitness();
                     } else if (category === 'mindset') {
                       onNavigateToMental();
                     } else if (category === 'emotional') {
                       onNavigateToEmotional();
                     } else {
                       setSelectedCategory(category);
                     }
                   }}
            >
              <Text style={styles.cornerButtonText}>
                {getCategoryTitle(category)}
              </Text>
              <Text style={styles.cornerButtonProgress}>
                {Math.round(progress * 100)}%
              </Text>
            </TouchableOpacity>
          );
        })}
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
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutText}>Logout</Text>
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
          <Text style={styles.quoteTitle}>Quote of the Day</Text>
          <View style={styles.quoteContainer}>
            <Text style={styles.quoteText}>"{quoteOfTheDay}"</Text>
          </View>
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
  logoutButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  quoteTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
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
    backgroundColor: '#2a2a2a',
    borderWidth: 8,
    borderColor: '#3a3a3a',
  },
  progressSection: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  progressArc: {
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
  cornerButton: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cornerButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 13,
    paddingHorizontal: 2,
  },
  cornerButtonProgress: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 3,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
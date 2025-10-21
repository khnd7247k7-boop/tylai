import React, { useState } from 'react';
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
import WorkoutScreen from './WorkoutScreen';
import ProgramExecutionScreen from './ProgramExecutionScreen';
import { workoutPrograms, WorkoutProgram, WorkoutSession } from './data/workoutPrograms';

interface MacroLog {
  id: string;
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
}

interface WorkoutHistory {
  id: string;
  date: string;
  name: string;
  duration: number;
  exercises: number;
}

interface CompletedTask {
  id: string;
  title: string;
  category: 'fitness' | 'mindset' | 'spiritual' | 'emotional';
  completedAt: string;
  completed: boolean;
}

export default function FitnessScreen({ onBack, onCompleteTask }: { onBack: () => void; onCompleteTask: (taskTitle: string) => void }) {
  const [activeTab, setActiveTab] = useState<'workouts' | 'macros' | 'history' | 'tasks'>('workouts');
  const [macroLogs, setMacroLogs] = useState<MacroLog[]>([]);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [showWorkoutScreen, setShowWorkoutScreen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<WorkoutProgram | null>(null);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([
    { id: '1', title: '30-minute cardio workout', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '2', title: 'Strength training - upper body', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '3', title: 'Lower body strength training', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '4', title: 'Core workout (15 minutes)', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '5', title: 'Stretching and flexibility', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
    { id: '6', title: 'HIIT workout (20 minutes)', category: 'fitness', completedAt: new Date().toISOString(), completed: false },
  ]);

  const [todayMacros, setTodayMacros] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    water: '',
  });

  const handleMacroSubmit = () => {
    if (!todayMacros.calories || !todayMacros.protein || !todayMacros.carbs || !todayMacros.fat) {
      Alert.alert('Error', 'Please fill in all macro fields');
      return;
    }

    const newLog: MacroLog = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      calories: parseInt(todayMacros.calories),
      protein: parseInt(todayMacros.protein),
      carbs: parseInt(todayMacros.carbs),
      fat: parseInt(todayMacros.fat),
      water: parseInt(todayMacros.water) || 0,
    };

    setMacroLogs(prev => [newLog, ...prev]);
    setTodayMacros({ calories: '', protein: '', carbs: '', fat: '', water: '' });
    Alert.alert('Success', 'Macros logged successfully!');
  };

  const handleProgramSelect = (program: WorkoutProgram) => {
    console.log('Selected program:', program);
    setSelectedProgram(program);
  };

  const handleWorkoutComplete = (session: WorkoutSession) => {
    setWorkoutHistory(prev => [session, ...prev]);
    setSelectedProgram(null);
    
    // Automatically complete fitness tasks when workout is finished
    onCompleteTask('workout');
    onCompleteTask('cardio');
    onCompleteTask('strength');
  };

  const toggleTaskCompletion = (taskId: string) => {
    setCompletedTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, completed: !task.completed, completedAt: new Date().toISOString() }
        : task
    ));
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      fitness: '#FF6B6B',
      mindset: '#4ECDC4',
      spiritual: '#45B7D1',
      emotional: '#96CEB4'
    };
    return colors[category as keyof typeof colors] || '#888';
  };

  const getCategoryTitle = (category: string) => {
    const titles = {
      fitness: 'Fitness',
      mindset: 'Mindset',
      spiritual: 'Spiritual',
      emotional: 'Emotional'
    };
    return titles[category as keyof typeof titles] || category;
  };

  const TabButton = ({ tab, title }: { tab: string, title: string }) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
      onPress={() => setActiveTab(tab as any)}
    >
      <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderWorkouts = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity
        style={styles.startWorkoutButton}
        onPress={() => setShowWorkoutScreen(true)}
      >
        <Text style={styles.startWorkoutButtonText}>Start Custom Workout</Text>
      </TouchableOpacity>
      
      <View style={styles.workoutPrograms}>
        <Text style={styles.sectionTitle}>Workout Programs</Text>
        
        {workoutPrograms && workoutPrograms.length > 0 ? workoutPrograms.map((program, index) => {
          const isFirstInCategory = index === 0 || 
            workoutPrograms[index - 1].category !== program.category;
          
          return (
            <View key={program.id}>
              {isFirstInCategory && (
                <Text style={styles.programCategory}>
                  {program.category === 'strength' && 'Strength Building'}
                  {program.category === 'muscle_building' && 'Muscle Building'}
                  {program.category === 'cardio' && 'Cardio & Conditioning'}
                  {program.category === 'bodyweight' && 'Bodyweight Training'}
                </Text>
              )}
              
              <TouchableOpacity
                style={styles.programCard}
                onPress={() => handleProgramSelect(program)}
              >
                <Text style={styles.programTitle}>{program.name}</Text>
                <Text style={styles.programDescription}>{program.description}</Text>
                <Text style={styles.programDuration}>
                  {program.duration} min • {program.frequency}x/week • {program.focus}
                </Text>
                <Text style={styles.programLevel}>
                  {program.level.charAt(0).toUpperCase() + program.level.slice(1)}
                </Text>
                <Text style={styles.programEquipment}>
                  Equipment: {program.equipment.join(', ')}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No workout programs available</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderMacros = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Today's Macros</Text>
      
      <View style={styles.macroInputs}>
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>Calories</Text>
          <TextInput
            style={styles.macroInput}
            placeholder="2000"
            value={todayMacros.calories}
            onChangeText={(text) => setTodayMacros(prev => ({ ...prev, calories: text }))}
            keyboardType="numeric"
          />
        </View>
        
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>Protein (g)</Text>
          <TextInput
            style={styles.macroInput}
            placeholder="150"
            value={todayMacros.protein}
            onChangeText={(text) => setTodayMacros(prev => ({ ...prev, protein: text }))}
            keyboardType="numeric"
          />
        </View>
        
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>Carbs (g)</Text>
          <TextInput
            style={styles.macroInput}
            placeholder="250"
            value={todayMacros.carbs}
            onChangeText={(text) => setTodayMacros(prev => ({ ...prev, carbs: text }))}
            keyboardType="numeric"
          />
        </View>
        
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>Fat (g)</Text>
          <TextInput
            style={styles.macroInput}
            placeholder="80"
            value={todayMacros.fat}
            onChangeText={(text) => setTodayMacros(prev => ({ ...prev, fat: text }))}
            keyboardType="numeric"
          />
        </View>
        
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>Water (oz)</Text>
          <TextInput
            style={styles.macroInput}
            placeholder="64"
            value={todayMacros.water}
            onChangeText={(text) => setTodayMacros(prev => ({ ...prev, water: text }))}
            keyboardType="numeric"
          />
        </View>
      </View>
      
      <TouchableOpacity style={styles.logButton} onPress={handleMacroSubmit}>
        <Text style={styles.logButtonText}>Log Macros</Text>
      </TouchableOpacity>
      
      {macroLogs.length > 0 && (
        <View style={styles.macroHistory}>
          <Text style={styles.sectionTitle}>Recent Logs</Text>
          {macroLogs.slice(0, 5).map(log => (
            <View key={log.id} style={styles.macroLog}>
              <Text style={styles.macroDate}>
                {new Date(log.date).toLocaleDateString()}
              </Text>
              <Text style={styles.macroStats}>
                {log.calories} cal • {log.protein}g protein • {log.water}oz water
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderHistory = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Workout History</Text>
      
      {workoutHistory.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No workouts completed yet</Text>
          <Text style={styles.emptyStateSubtext}>Start your first workout to see your history here</Text>
        </View>
      ) : (
        workoutHistory.map(session => (
          <View key={session.id} style={styles.historyItem}>
            <Text style={styles.historyDate}>
              {new Date(session.date).toLocaleDateString()}
            </Text>
            <Text style={styles.historyName}>{session.programName}</Text>
            <Text style={styles.historyStats}>
              {session.duration} min • {session.exercises.length} exercises
            </Text>
            {session.notes && (
              <Text style={styles.historyNotes}>Notes: {session.notes}</Text>
            )}
          </View>
        ))
      )}
    </View>
  );

  const renderTasks = () => {
    const fitnessTasks = completedTasks.filter(task => task.category === 'fitness');
    const completedCount = fitnessTasks.filter(task => task.completed).length;
    const totalCount = fitnessTasks.length;
    const categoryColor = getCategoryColor('fitness');
    
    return (
      <View style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Fitness Tasks</Text>
        <Text style={styles.sectionSubtitle}>Check off fitness tasks you've completed today</Text>
        
        <View style={styles.taskCategorySection}>
          <View style={styles.taskCategoryHeader}>
            <Text style={[styles.taskCategoryTitle, { color: categoryColor }]}>
              Fitness
            </Text>
            <Text style={styles.taskCategoryProgress}>
              {completedCount}/{totalCount}
            </Text>
          </View>
          
          {fitnessTasks.map(task => (
            <TouchableOpacity
              key={task.id}
              style={styles.taskItem}
              onPress={() => toggleTaskCompletion(task.id)}
            >
              <View style={[
                styles.taskCheckbox,
                task.completed && { backgroundColor: categoryColor }
              ]}>
                {task.completed && <Text style={styles.taskCheckmark}>✓</Text>}
              </View>
              <Text style={[
                styles.taskText,
                task.completed && styles.taskTextCompleted
              ]}>
                {task.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.taskSummary}>
          <Text style={styles.taskSummaryTitle}>Fitness Progress</Text>
          <Text style={styles.taskSummaryText}>
            {completedCount} of {totalCount} fitness tasks completed
          </Text>
        </View>
      </View>
    );
  };

  if (showWorkoutScreen) {
    return (
      <WorkoutScreen 
        onBack={() => setShowWorkoutScreen(false)} 
      />
    );
  }

  if (selectedProgram) {
    return (
      <ProgramExecutionScreen
        program={selectedProgram}
        onBack={() => setSelectedProgram(null)}
        onComplete={handleWorkoutComplete}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fitness</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TabButton tab="workouts" title="Workouts" />
        <TabButton tab="macros" title="Macros" />
        <TabButton tab="history" title="History" />
        <TabButton tab="tasks" title="Tasks" />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'workouts' && renderWorkouts()}
        {activeTab === 'macros' && renderMacros()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'tasks' && renderTasks()}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginVertical: 15,
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#00ff88',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  tabButtonTextActive: {
    color: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  tabContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  startWorkoutButton: {
    backgroundColor: '#00ff88',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
    marginBottom: 30,
  },
  startWorkoutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  workoutPrograms: {
    marginBottom: 30,
  },
  programCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  programTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  programDescription: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  programDuration: {
    fontSize: 12,
    color: '#00ff88',
    fontWeight: '600',
    marginBottom: 4,
  },
  programCategory: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 15,
    marginLeft: 5,
  },
  programLevel: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  programEquipment: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
  historyNotes: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  macroInputs: {
    marginBottom: 20,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  macroLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    flex: 1,
  },
  macroInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    width: 120,
    textAlign: 'center',
  },
  logButton: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  logButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  macroHistory: {
    marginTop: 20,
  },
  macroLog: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  macroDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  macroStats: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  historyItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  historyName: {
    fontSize: 14,
    color: '#00ff88',
    marginTop: 2,
  },
  historyStats: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  // Task styles
  sectionSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 20,
    textAlign: 'center',
  },
  taskCategorySection: {
    marginBottom: 25,
  },
  taskCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  taskCategoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  taskCategoryProgress: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 5,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    marginBottom: 8,
  },
  taskCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheckmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  taskText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  taskTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  taskSummary: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
    alignItems: 'center',
  },
  taskSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  taskSummaryText: {
    fontSize: 16,
    color: '#00ff88',
    fontWeight: '600',
  },
});

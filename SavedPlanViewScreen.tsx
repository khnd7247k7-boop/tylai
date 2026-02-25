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
import { WorkoutProgram, WorkoutSession } from './data/workoutPrograms';
import ProgramExecutionScreen from './ProgramExecutionScreen';
import { loadUserData, saveUserData } from './src/utils/userStorage';
import AIService, { ProgramAdaptation } from './AIService';

interface SavedPlanViewScreenProps {
  plan: any;
  onBack: () => void;
  onWorkoutComplete?: () => void;
}

export default function SavedPlanViewScreen({ plan, onBack, onWorkoutComplete }: SavedPlanViewScreenProps) {
  const [currentPlan, setCurrentPlan] = useState(plan);
  const [selectedProgram, setSelectedProgram] = useState<WorkoutProgram | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<ProgramAdaptation[]>([]);
  const [implementedSuggestions, setImplementedSuggestions] = useState<ProgramAdaptation[]>([]);
  const [showImplemented, setShowImplemented] = useState(false);

  useEffect(() => {
    loadWorkoutHistory();
    // Load implemented first, then filter active suggestions
    loadImplementedSuggestions().then(() => {
      loadAISuggestions();
    });
  }, []);

  const loadAISuggestions = async () => {
    try {
      const history = await loadUserData<WorkoutSession[]>('workoutHistory') || [];
      const suggestions = AIService.analyzeWorkoutPerformance(history, currentPlan);
      
      // Load implemented suggestions to filter them out
      const savedPlans = await loadUserData<any[]>('savedWorkoutPlans') || [];
      const plan = savedPlans.find(p => p.id === currentPlan.id);
      const implementedSuggestions = plan?.implementedSuggestions || [];
      
      // Create a function to generate a unique key for a suggestion based on its content
      const getSuggestionKey = (s: ProgramAdaptation) => {
        // Use title, exercise name, field, and values to create a unique identifier
        const firstChange = s.changes[0];
        if (firstChange) {
          return `${s.title}-${firstChange.exerciseName || firstChange.exerciseId}-${firstChange.field}-${firstChange.oldValue}-${firstChange.newValue}`;
        }
        return s.id; // Fallback to ID if no changes
      };
      
      // Create a set of implemented suggestion keys
      const implementedKeys = new Set(
        implementedSuggestions.map((s: any) => getSuggestionKey(s))
      );
      
      // Filter out suggestions that match implemented ones by content
      const activeSuggestions = suggestions.filter(s => {
        const key = getSuggestionKey(s);
        return !implementedKeys.has(key);
      });
      
      setAiSuggestions(activeSuggestions);
    } catch (error) {
      console.error('Error loading AI suggestions:', error);
    }
  };

  const loadImplementedSuggestions = async () => {
    try {
      const savedPlans = await loadUserData<any[]>('savedWorkoutPlans') || [];
      const plan = savedPlans.find(p => p.id === currentPlan.id);
      if (plan && plan.implementedSuggestions) {
        setImplementedSuggestions(plan.implementedSuggestions);
      } else {
        setImplementedSuggestions([]);
      }
    } catch (error) {
      console.error('Error loading implemented suggestions:', error);
    }
  };

  const handleDeletePlan = async () => {
    Alert.alert(
      'Delete Plan',
      'Are you sure you want to delete this workout plan? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from saved plans
              const savedPlans = await loadUserData<any[]>('savedWorkoutPlans') || [];
              const updatedPlans = savedPlans.filter(p => p.id !== currentPlan.id);
              await saveUserData('savedWorkoutPlans', updatedPlans);
              
              // Remove from active plans if it was active
              const activePlans = await loadUserData<string[]>('activeWorkoutPlans') || [];
              const updatedActive = activePlans.filter(id => id !== currentPlan.id);
              if (updatedActive.length !== activePlans.length) {
                await saveUserData('activeWorkoutPlans', updatedActive);
              }
              
              Alert.alert('Success', 'Workout plan deleted successfully', [
                { text: 'OK', onPress: onBack }
              ]);
            } catch (error) {
              console.error('Error deleting plan:', error);
              Alert.alert('Error', 'Failed to delete workout plan');
            }
          },
        },
      ]
    );
  };

  const loadWorkoutHistory = async () => {
    try {
      const history = await loadUserData<WorkoutSession[]>('workoutHistory') || [];
      // Filter history for this plan
      const planHistory = history.filter(session => session.programId === currentPlan.id);
      setWorkoutHistory(planHistory);
    } catch (error) {
      console.error('Error loading workout history:', error);
    }
  };

  const handleStartWorkout = (dayIndex?: number) => {
    if (currentPlan.weeklyPlan && currentPlan.weeklyPlan.weekDays && currentPlan.weeklyPlan.weekDays.length > 0) {
      // Multi-day plan - select which day to start
      if (dayIndex !== undefined) {
        const dayWorkout = currentPlan.weeklyPlan.weekDays[dayIndex];
        const program: WorkoutProgram = {
          id: `${currentPlan.id}-${dayWorkout.day}`,
          name: dayWorkout.workoutName,
          description: dayWorkout.focus,
          duration: dayWorkout.duration,
          frequency: 1,
          level: currentPlan.level || 'intermediate',
          category: 'strength',
          exercises: dayWorkout.exercises,
          focus: dayWorkout.focus,
          equipment: [],
        };
        setSelectedProgram(program);
        setSelectedDayIndex(dayIndex);
      } else if (currentPlan.weeklyPlan.weekDays.length === 1) {
        // Only one day, start it directly
        const dayWorkout = currentPlan.weeklyPlan.weekDays[0];
        const program: WorkoutProgram = {
          id: `${currentPlan.id}-${dayWorkout.day}`,
          name: dayWorkout.workoutName,
          description: dayWorkout.focus,
          duration: dayWorkout.duration,
          frequency: 1,
          level: currentPlan.level || 'intermediate',
          category: 'strength',
          exercises: dayWorkout.exercises,
          focus: dayWorkout.focus,
          equipment: [],
        };
        setSelectedProgram(program);
      } else {
        // Multiple days - show day selector
        setSelectedDayIndex(-1); // -1 means show day selector
      }
    } else if (currentPlan.exercises && currentPlan.exercises.length > 0) {
      // Single workout plan
      const program: WorkoutProgram = {
        id: currentPlan.id,
        name: currentPlan.name,
        description: currentPlan.description || 'Custom workout',
        duration: currentPlan.duration || (currentPlan.exercises.length * 5),
        frequency: currentPlan.daysPerWeek || 1,
        level: currentPlan.level || 'intermediate',
        category: 'strength',
        exercises: currentPlan.exercises,
        focus: currentPlan.focus || 'Custom workout',
        equipment: [],
      };
      setSelectedProgram(program);
    }
  };

  const handleWorkoutComplete = async (session: WorkoutSession) => {
    try {
      // Save the workout session to history
      const existingHistory = await loadUserData<WorkoutSession[]>('workoutHistory') || [];
      const updatedHistory = [session, ...existingHistory];
      await saveUserData('workoutHistory', updatedHistory);
      console.log('Workout session saved to history:', session);
    } catch (error) {
      console.error('Error saving workout history:', error);
    }

    setSelectedProgram(null);
    setSelectedDayIndex(null);
    await loadWorkoutHistory();
    if (onWorkoutComplete) {
      onWorkoutComplete();
    }
  };

  const toggleDayExpanded = (dayIndex: number) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(dayIndex)) {
      newExpanded.delete(dayIndex);
    } else {
      newExpanded.add(dayIndex);
    }
    setExpandedDays(newExpanded);
  };

  const applySuggestion = async (suggestion: ProgramAdaptation) => {
    try {
      // Load current plan
      const savedPlans = await loadUserData<any[]>('savedWorkoutPlans') || [];
      const planIndex = savedPlans.findIndex(p => p.id === currentPlan.id);
      
      if (planIndex === -1) {
        Alert.alert('Error', 'Plan not found');
        return;
      }

      const updatedPlan = { ...savedPlans[planIndex] };

      // Helper function to find exercise by ID or name
      const findExercise = (exercises: any[], change: any) => {
        if (!exercises || exercises.length === 0) return null;
        
        // Try by ID first
        if (change.exerciseId) {
          const byId = exercises.find((ex: any) => ex.id === change.exerciseId);
          if (byId) return byId;
        }
        
        // Try by name (case-insensitive, partial match)
        if (change.exerciseName) {
          const searchName = change.exerciseName.toLowerCase().trim();
          const byName = exercises.find((ex: any) => 
            ex.name && ex.name.toLowerCase().trim() === searchName
          );
          if (byName) return byName;
        }
        
        return null;
      };

      // Apply the specific suggestion
      suggestion.changes.forEach(change => {
        if (change.field === 'weight' && (change.exerciseId || change.exerciseName)) {
          // Update weight for specific exercise
          if (updatedPlan.weeklyPlan && updatedPlan.weeklyPlan.weekDays) {
            updatedPlan.weeklyPlan.weekDays.forEach((day: any) => {
              const exercise = findExercise(day.exercises || [], change);
              if (exercise && change.newValue !== undefined) {
                exercise.weight = typeof change.newValue === 'number' 
                  ? change.newValue 
                  : parseFloat(change.newValue.toString()) || exercise.weight || 0;
                console.log(`Updated ${exercise.name} weight to ${exercise.weight}lbs`);
              }
            });
          } else if (updatedPlan.exercises) {
            const exercise = findExercise(updatedPlan.exercises, change);
            if (exercise && change.newValue !== undefined) {
              exercise.weight = typeof change.newValue === 'number' 
                ? change.newValue 
                : parseFloat(change.newValue.toString()) || exercise.weight || 0;
              console.log(`Updated ${exercise.name} weight to ${exercise.weight}lbs`);
            }
          }
        } else if (change.field === 'sets' && (change.exerciseId || change.exerciseName)) {
          // Update sets for specific exercise - newValue is already the final value (e.g., 3 -> 4)
          if (updatedPlan.weeklyPlan && updatedPlan.weeklyPlan.weekDays) {
            updatedPlan.weeklyPlan.weekDays.forEach((day: any) => {
              const exercise = findExercise(day.exercises || [], change);
              if (exercise && change.newValue !== undefined) {
                // Parse current sets (handle string ranges like "3-5" or just "3")
                const currentSets = typeof exercise.sets === 'string' 
                  ? (exercise.sets.includes('-') 
                      ? parseInt(exercise.sets.split('-')[0]) 
                      : parseInt(exercise.sets)) || 0
                  : exercise.sets || 0;
                
                // newValue is the final value (e.g., if oldValue=3 and newValue=4, use 4)
                const newSetsValue = typeof change.newValue === 'number' 
                  ? change.newValue 
                  : parseInt(change.newValue.toString()) || currentSets;
                
                exercise.sets = newSetsValue;
                console.log(`Updated ${exercise.name} sets from ${currentSets} to ${newSetsValue}`);
              }
            });
          } else if (updatedPlan.exercises) {
            const exercise = findExercise(updatedPlan.exercises, change);
            if (exercise && change.newValue !== undefined) {
              const currentSets = typeof exercise.sets === 'string' 
                ? (exercise.sets.includes('-') 
                    ? parseInt(exercise.sets.split('-')[0]) 
                    : parseInt(exercise.sets)) || 0
                : exercise.sets || 0;
              
              const newSetsValue = typeof change.newValue === 'number' 
                ? change.newValue 
                : parseInt(change.newValue.toString()) || currentSets;
              
              exercise.sets = newSetsValue;
              console.log(`Updated ${exercise.name} sets from ${currentSets} to ${newSetsValue}`);
            }
          }
        } else if (change.field === 'reps' && (change.exerciseId || change.exerciseName)) {
          // Update reps for specific exercise
          if (updatedPlan.weeklyPlan && updatedPlan.weeklyPlan.weekDays) {
            updatedPlan.weeklyPlan.weekDays.forEach((day: any) => {
              const exercise = findExercise(day.exercises || [], change);
              if (exercise && change.newValue !== undefined) {
                const newRepsValue = typeof change.newValue === 'number' 
                  ? change.newValue 
                  : parseInt(change.newValue.toString()) || exercise.reps;
                
                // Preserve range format if it was a range, otherwise use the new value
                if (typeof exercise.reps === 'string' && exercise.reps.includes('-')) {
                  exercise.reps = change.newValue.toString();
                } else {
                  exercise.reps = newRepsValue;
                }
                console.log(`Updated ${exercise.name} reps to ${exercise.reps}`);
              }
            });
          } else if (updatedPlan.exercises) {
            const exercise = findExercise(updatedPlan.exercises, change);
            if (exercise && change.newValue !== undefined) {
              const newRepsValue = typeof change.newValue === 'number' 
                ? change.newValue 
                : parseInt(change.newValue.toString()) || exercise.reps;
              
              if (typeof exercise.reps === 'string' && exercise.reps.includes('-')) {
                exercise.reps = change.newValue.toString();
              } else {
                exercise.reps = newRepsValue;
              }
              console.log(`Updated ${exercise.name} reps to ${exercise.reps}`);
            }
          }
        } else if (change.field === 'restTime' && (change.exerciseId || change.exerciseName)) {
          // Update rest time for specific exercise
          if (updatedPlan.weeklyPlan && updatedPlan.weeklyPlan.weekDays) {
            updatedPlan.weeklyPlan.weekDays.forEach((day: any) => {
              const exercise = findExercise(day.exercises || [], change);
              if (exercise && change.newValue !== undefined) {
                exercise.restTime = typeof change.newValue === 'number' 
                  ? change.newValue 
                  : parseInt(change.newValue.toString()) || exercise.restTime || 60;
              }
            });
          } else if (updatedPlan.exercises) {
            const exercise = findExercise(updatedPlan.exercises, change);
            if (exercise && change.newValue !== undefined) {
              exercise.restTime = typeof change.newValue === 'number' 
                ? change.newValue 
                : parseInt(change.newValue.toString()) || exercise.restTime || 60;
            }
          }
        } else if (change.field === 'duration') {
          // Update workout duration
          if (change.newValue !== undefined) {
            const newDuration = typeof change.newValue === 'number' 
              ? change.newValue 
              : parseInt(change.newValue.toString()) || updatedPlan.duration;
            updatedPlan.duration = newDuration;
            if (updatedPlan.weeklyPlan && updatedPlan.weeklyPlan.weekDays) {
              updatedPlan.weeklyPlan.weekDays.forEach((day: any) => {
                day.duration = newDuration;
              });
            }
          }
        } else if (change.field === 'frequency') {
          // Update workout frequency
          if (change.newValue !== undefined) {
            updatedPlan.daysPerWeek = typeof change.newValue === 'number' 
              ? change.newValue 
              : parseInt(change.newValue.toString()) || updatedPlan.daysPerWeek;
          }
        }
      });

      // Add suggestion to implemented list
      if (!updatedPlan.implementedSuggestions) {
        updatedPlan.implementedSuggestions = [];
      }
      updatedPlan.implementedSuggestions.push({
        ...suggestion,
        implementedAt: new Date().toISOString(),
      });

      // Save updated plan
      savedPlans[planIndex] = updatedPlan;
      await saveUserData('savedWorkoutPlans', savedPlans);

      // Update local plan state to reflect changes
      setCurrentPlan(updatedPlan);

      // Remove applied suggestion from list
      setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      AIService.clearAdaptation(suggestion.id);

      // Update implemented suggestions list
      setImplementedSuggestions(updatedPlan.implementedSuggestions);

      Alert.alert('Success', `"${suggestion.title}" has been applied to your workout plan!`);
      
      // Reload implemented suggestions first, then filter active suggestions
      await loadImplementedSuggestions();
      await loadAISuggestions();
      
      // Notify parent to refresh
      if (onWorkoutComplete) {
        onWorkoutComplete();
      }
    } catch (error) {
      console.error('Error applying suggestion:', error);
      Alert.alert('Error', 'Failed to apply suggestion. Please try again.');
    }
  };

  const handleApplyAllSuggestions = async () => {
    if (aiSuggestions.length === 0) return;

    try {
      // Load current plan
      const savedPlans = await loadUserData<any[]>('savedWorkoutPlans') || [];
      const planIndex = savedPlans.findIndex(p => p.id === currentPlan.id);
      
      if (planIndex === -1) {
        Alert.alert('Error', 'Plan not found');
        return;
      }

      const updatedPlan = { ...savedPlans[planIndex] };

      // Helper function to find exercise by ID or name
      const findExercise = (exercises: any[], change: any) => {
        if (!exercises || exercises.length === 0) return null;
        
        if (change.exerciseId) {
          const byId = exercises.find((ex: any) => ex.id === change.exerciseId);
          if (byId) return byId;
        }
        
        if (change.exerciseName) {
          const searchName = change.exerciseName.toLowerCase().trim();
          const byName = exercises.find((ex: any) => 
            ex.name && ex.name.toLowerCase().trim() === searchName
          );
          if (byName) return byName;
        }
        
        return null;
      };

      // Apply each suggestion
      aiSuggestions.forEach(suggestion => {
        suggestion.changes.forEach(change => {
          if (change.field === 'weight' && (change.exerciseId || change.exerciseName)) {
            if (updatedPlan.weeklyPlan && updatedPlan.weeklyPlan.weekDays) {
              updatedPlan.weeklyPlan.weekDays.forEach((day: any) => {
                const exercise = findExercise(day.exercises || [], change);
                if (exercise && change.newValue !== undefined) {
                  exercise.weight = typeof change.newValue === 'number' 
                    ? change.newValue 
                    : parseFloat(change.newValue.toString()) || exercise.weight || 0;
                }
              });
            } else if (updatedPlan.exercises) {
              const exercise = findExercise(updatedPlan.exercises, change);
              if (exercise && change.newValue !== undefined) {
                exercise.weight = typeof change.newValue === 'number' 
                  ? change.newValue 
                  : parseFloat(change.newValue.toString()) || exercise.weight || 0;
              }
            }
          } else if (change.field === 'sets' && (change.exerciseId || change.exerciseName)) {
            if (updatedPlan.weeklyPlan && updatedPlan.weeklyPlan.weekDays) {
              updatedPlan.weeklyPlan.weekDays.forEach((day: any) => {
                const exercise = findExercise(day.exercises || [], change);
                if (exercise && change.newValue !== undefined) {
                  const currentSets = typeof exercise.sets === 'string' 
                    ? (exercise.sets.includes('-') 
                        ? parseInt(exercise.sets.split('-')[0]) 
                        : parseInt(exercise.sets)) || 0
                    : exercise.sets || 0;
                  
                  const newSetsValue = typeof change.newValue === 'number' 
                    ? change.newValue 
                    : parseInt(change.newValue.toString()) || currentSets;
                  
                  exercise.sets = newSetsValue;
                }
              });
            } else if (updatedPlan.exercises) {
              const exercise = findExercise(updatedPlan.exercises, change);
              if (exercise && change.newValue !== undefined) {
                const currentSets = typeof exercise.sets === 'string' 
                  ? (exercise.sets.includes('-') 
                      ? parseInt(exercise.sets.split('-')[0]) 
                      : parseInt(exercise.sets)) || 0
                  : exercise.sets || 0;
                
                const newSetsValue = typeof change.newValue === 'number' 
                  ? change.newValue 
                  : parseInt(change.newValue.toString()) || currentSets;
                
                exercise.sets = newSetsValue;
              }
            }
          } else if (change.field === 'reps' && (change.exerciseId || change.exerciseName)) {
            if (updatedPlan.weeklyPlan && updatedPlan.weeklyPlan.weekDays) {
              updatedPlan.weeklyPlan.weekDays.forEach((day: any) => {
                const exercise = findExercise(day.exercises || [], change);
                if (exercise && change.newValue !== undefined) {
                  const newRepsValue = typeof change.newValue === 'number' 
                    ? change.newValue 
                    : parseInt(change.newValue.toString()) || exercise.reps;
                  
                  if (typeof exercise.reps === 'string' && exercise.reps.includes('-')) {
                    exercise.reps = change.newValue.toString();
                  } else {
                    exercise.reps = newRepsValue;
                  }
                }
              });
            } else if (updatedPlan.exercises) {
              const exercise = findExercise(updatedPlan.exercises, change);
              if (exercise && change.newValue !== undefined) {
                const newRepsValue = typeof change.newValue === 'number' 
                  ? change.newValue 
                  : parseInt(change.newValue.toString()) || exercise.reps;
                
                if (typeof exercise.reps === 'string' && exercise.reps.includes('-')) {
                  exercise.reps = change.newValue.toString();
                } else {
                  exercise.reps = newRepsValue;
                }
              }
            }
          } else if (change.field === 'restTime' && (change.exerciseId || change.exerciseName)) {
            if (updatedPlan.weeklyPlan && updatedPlan.weeklyPlan.weekDays) {
              updatedPlan.weeklyPlan.weekDays.forEach((day: any) => {
                const exercise = findExercise(day.exercises || [], change);
                if (exercise && change.newValue !== undefined) {
                  exercise.restTime = typeof change.newValue === 'number' 
                    ? change.newValue 
                    : parseInt(change.newValue.toString()) || exercise.restTime || 60;
                }
              });
            } else if (updatedPlan.exercises) {
              const exercise = findExercise(updatedPlan.exercises, change);
              if (exercise && change.newValue !== undefined) {
                exercise.restTime = typeof change.newValue === 'number' 
                  ? change.newValue 
                  : parseInt(change.newValue.toString()) || exercise.restTime || 60;
              }
            }
          } else if (change.field === 'duration') {
            if (change.newValue !== undefined) {
              const newDuration = typeof change.newValue === 'number' 
                ? change.newValue 
                : parseInt(change.newValue.toString()) || updatedPlan.duration;
              updatedPlan.duration = newDuration;
              if (updatedPlan.weeklyPlan && updatedPlan.weeklyPlan.weekDays) {
                updatedPlan.weeklyPlan.weekDays.forEach((day: any) => {
                  day.duration = newDuration;
                });
              }
            }
          } else if (change.field === 'frequency') {
            if (change.newValue !== undefined) {
              updatedPlan.daysPerWeek = typeof change.newValue === 'number' 
                ? change.newValue 
                : parseInt(change.newValue.toString()) || updatedPlan.daysPerWeek;
            }
          }
        });
      });

      // Save updated plan
      savedPlans[planIndex] = updatedPlan;
      await saveUserData('savedWorkoutPlans', savedPlans);

      // Update local plan state to reflect changes
      setCurrentPlan(updatedPlan);

      // Clear all suggestions
      aiSuggestions.forEach(s => AIService.clearAdaptation(s.id));
      setAiSuggestions([]);

      // Update implemented suggestions list
      setImplementedSuggestions(updatedPlan.implementedSuggestions);

      Alert.alert('Success', 'All AI suggestions have been applied to your workout plan!');
      setShowAISuggestions(false);
      
      // Reload suggestions (they will be filtered to exclude implemented ones)
      await loadAISuggestions();
      
      // Notify parent to refresh
      if (onWorkoutComplete) {
        onWorkoutComplete();
      }
    } catch (error) {
      console.error('Error applying suggestions:', error);
      Alert.alert('Error', 'Failed to apply suggestions. Please try again.');
    }
  };

  if (selectedProgram) {
    return (
      <ProgramExecutionScreen
        program={selectedProgram}
        onBack={() => {
          setSelectedProgram(null);
          setSelectedDayIndex(null);
        }}
        onComplete={handleWorkoutComplete}
      />
    );
  }

  // Day selector for multi-day plans
  if (selectedDayIndex === -1 && currentPlan.weeklyPlan && currentPlan.weeklyPlan.weekDays) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedDayIndex(null)}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Day</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.label}>Choose which day to start</Text>
            {currentPlan.weeklyPlan.weekDays.map((dayWorkout: any, index: number) => (
              <TouchableOpacity
                key={`day-select-${index}-${dayWorkout.dayName}`}
                style={styles.dayCard}
                onPress={() => handleStartWorkout(index)}
              >
                <Text style={styles.dayCardTitle}>{dayWorkout.dayName}</Text>
                <Text style={styles.dayCardSubtitle}>{dayWorkout.workoutName}</Text>
                <Text style={styles.dayCardDetails}>
                  {dayWorkout.exercises.length} exercises • ~{dayWorkout.duration} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Plan</Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeletePlan}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.planName}>{currentPlan.name}</Text>
          <Text style={styles.planDetails}>
            {currentPlan.level || 'Custom'} • {(currentPlan.goal || 'strength').replace('_', ' ')} • {currentPlan.daysPerWeek || (currentPlan.trainingDays && currentPlan.trainingDays.length) || 1} days/week
          </Text>
          {currentPlan.trainingDays && currentPlan.trainingDays.length > 0 && (
            <Text style={styles.trainingDays}>
              Training Days: {currentPlan.trainingDays.join(', ')}
            </Text>
          )}
          {currentPlan.savedAt && (
            <Text style={styles.savedDate}>
              Saved: {new Date(currentPlan.savedAt).toLocaleDateString()}
            </Text>
          )}
        </View>

        {/* Multi-day plan view */}
        {currentPlan.weeklyPlan && currentPlan.weeklyPlan.weekDays && currentPlan.weeklyPlan.weekDays.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.label}>Weekly Schedule</Text>
            {currentPlan.weeklyPlan.weekDays.map((dayWorkout: any, index: number) => {
              const isExpanded = expandedDays.has(index);
              return (
                <View key={`day-${index}-${dayWorkout.dayName}`} style={styles.dayWorkoutCard}>
                  <View style={styles.dayWorkoutHeader}>
                    <TouchableOpacity
                      style={styles.dayWorkoutHeaderLeft}
                      onPress={() => toggleDayExpanded(index)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.expandButton}>
                        <Text style={styles.expandButtonText}>
                          {isExpanded ? '▼' : '▶'}
                        </Text>
                      </View>
                      <View style={styles.dayWorkoutInfo}>
                        <Text style={styles.dayWorkoutDay}>{dayWorkout.dayName}</Text>
                        <Text style={styles.dayWorkoutName}>{dayWorkout.workoutName}</Text>
                        <Text style={styles.dayWorkoutStats}>
                          {dayWorkout.exercises.length} exercises • ~{dayWorkout.duration} min
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.startDayButton}
                      onPress={() => handleStartWorkout(index)}
                    >
                      <Text style={styles.startDayButtonText}>Start</Text>
                    </TouchableOpacity>
                  </View>
                  {isExpanded && (
                    <View style={styles.exercisesList}>
                      {dayWorkout.exercises.map((exercise: any, exIndex: number) => (
                        <View key={`day-${index}-ex-${exIndex}-${exercise.id || exercise.name}`} style={styles.exerciseItem}>
                          <Text style={styles.exerciseName}>
                            {exIndex + 1}. {exercise.name}
                          </Text>
                          <Text style={styles.exerciseDetails}>
                            {exercise.sets} sets × {exercise.reps} reps
                            {exercise.weight > 0 && ` @ ${exercise.weight} lbs`}
                            {' • '}{exercise.restTime}s rest
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            <View style={styles.aiSuggestionsContainer}>
              {aiSuggestions.length > 0 && (
                <TouchableOpacity
                  style={styles.aiSuggestionsButton}
                  onPress={() => setShowAISuggestions(true)}
                >
                  <Text style={styles.aiSuggestionsButtonText}>
                    AI Suggestions ({aiSuggestions.length})
                  </Text>
                </TouchableOpacity>
              )}
              
              {implementedSuggestions.length > 0 && (
                <TouchableOpacity
                  style={styles.implementedButton}
                  onPress={() => setShowImplemented(true)}
                >
                  <Text style={styles.implementedButtonText}>
                    Implemented ({implementedSuggestions.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : currentPlan.exercises && currentPlan.exercises.length > 0 ? (
          // Single workout plan view
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.exercisesHeader}
              onPress={() => toggleDayExpanded(0)}
            >
              <Text style={styles.label}>Exercises</Text>
              <Text style={styles.expandButtonText}>
                {expandedDays.has(0) ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
            {expandedDays.has(0) && (
              <View style={styles.exercisesList}>
                {currentPlan.exercises.map((exercise: any, index: number) => (
                  <View key={exercise.id || `single-plan-ex-${index}-${exercise.name}`} style={styles.exerciseItem}>
                    <Text style={styles.exerciseName}>
                      {index + 1}. {exercise.name}
                    </Text>
                    <Text style={styles.exerciseDetails}>
                      {exercise.sets} sets × {exercise.reps} reps
                      {exercise.weight > 0 && ` @ ${exercise.weight} lbs`}
                      {' • '}{exercise.restTime || 60}s rest
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* Workout History */}
        {workoutHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>Workout History</Text>
            <Text style={styles.hint}>
              You've completed this workout {workoutHistory.length} time{workoutHistory.length > 1 ? 's' : ''}
            </Text>
            {workoutHistory.slice(0, 5).map((session, index) => (
              <View key={session.id || index} style={styles.historyItem}>
                <Text style={styles.historyDate}>
                  {new Date(session.date).toLocaleDateString()}
                </Text>
                <Text style={styles.historyDetails}>
                  {session.duration} min • {session.exercises.length} exercises
                </Text>
                {session.notes && (
                  <Text style={styles.historyNotes}>{session.notes}</Text>
                )}
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      {/* AI Suggestions Modal */}
      <Modal
        visible={showAISuggestions}
        animationType="slide"
        presentationStyle="pageSheet"
        transparent={false}
        onRequestClose={() => setShowAISuggestions(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAISuggestions(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>AI Suggestions</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
            {aiSuggestions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No suggestions available</Text>
                <Text style={styles.emptyStateSubtext}>
                  Complete more workouts to receive personalized program adjustments
                </Text>
              </View>
            ) : (
              <>
                {aiSuggestions.map((suggestion) => (
                  <View key={suggestion.id} style={styles.suggestionCard}>
                    <View style={styles.suggestionHeader}>
                      <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                      <View style={[
                        styles.priorityBadge,
                        suggestion.priority === 'high' && styles.priorityHigh,
                        suggestion.priority === 'medium' && styles.priorityMedium,
                        suggestion.priority === 'low' && styles.priorityLow,
                      ]}>
                        <Text style={styles.priorityText}>
                          {suggestion.priority.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
                    <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
                    {suggestion.changes.length > 0 && (
                      <View style={styles.changesContainer}>
                        <Text style={styles.changesTitle}>Proposed Changes:</Text>
                        {suggestion.changes.map((change, idx) => (
                          <View key={idx} style={styles.changeItem}>
                            {change.exerciseName && (
                              <Text style={styles.changeText}>
                                <Text style={styles.changeLabel}>Exercise:</Text> {change.exerciseName}
                              </Text>
                            )}
                            {change.field && (
                              <Text style={styles.changeText}>
                                <Text style={styles.changeLabel}>Field:</Text> {change.field}
                              </Text>
                            )}
                            {change.oldValue !== undefined && change.newValue !== undefined && (
                              <Text style={styles.changeText}>
                                <Text style={styles.changeLabel}>Change:</Text> {change.oldValue} → {change.newValue}
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                    <View style={styles.confidenceContainer}>
                      <Text style={styles.confidenceText}>
                        Confidence: {suggestion.confidence}%
                      </Text>
                    </View>
                    <View style={styles.suggestionActions}>
                      <TouchableOpacity
                        style={styles.applySuggestionButton}
                        onPress={() => applySuggestion(suggestion)}
                      >
                        <Text style={styles.applySuggestionButtonText}>Apply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                
                {aiSuggestions.length > 1 && (
                  <TouchableOpacity
                    style={styles.applyAllButton}
                    onPress={handleApplyAllSuggestions}
                  >
                    <Text style={styles.applyAllButtonText}>Apply All Suggestions</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Implemented Suggestions Modal */}
      <Modal
        visible={showImplemented}
        animationType="slide"
        presentationStyle="pageSheet"
        transparent={false}
        onRequestClose={() => setShowImplemented(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowImplemented(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Implemented Suggestions</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
            {implementedSuggestions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No implemented suggestions yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Applied suggestions will appear here
                </Text>
              </View>
            ) : (
              <>
                {implementedSuggestions
                  .sort((a, b) => {
                    const dateA = (a as any).implementedAt ? new Date((a as any).implementedAt).getTime() : 0;
                    const dateB = (b as any).implementedAt ? new Date((b as any).implementedAt).getTime() : 0;
                    return dateB - dateA; // Most recent first
                  })
                  .map((suggestion) => (
                    <View key={suggestion.id} style={styles.implementedCard}>
                      <View style={styles.suggestionHeader}>
                        <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                        <View style={styles.implementedBadge}>
                          <Text style={styles.implementedBadgeText}>✓ IMPLEMENTED</Text>
                        </View>
                      </View>
                      {(suggestion as any).implementedAt && (
                        <Text style={styles.implementedDate}>
                          Applied: {new Date((suggestion as any).implementedAt).toLocaleDateString()}
                        </Text>
                      )}
                      <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
                      {suggestion.changes.length > 0 && (
                        <View style={styles.changesContainer}>
                          <Text style={styles.changesTitle}>Changes Applied:</Text>
                          {suggestion.changes.map((change, idx) => (
                            <View key={idx} style={styles.changeItem}>
                              {change.exerciseName && (
                                <Text style={styles.changeText}>
                                  <Text style={styles.changeLabel}>Exercise:</Text> {change.exerciseName}
                                </Text>
                              )}
                              {change.field && (
                                <Text style={styles.changeText}>
                                  <Text style={styles.changeLabel}>Field:</Text> {change.field}
                                </Text>
                              )}
                              {change.oldValue !== undefined && change.newValue !== undefined && (
                                <Text style={styles.changeText}>
                                  <Text style={styles.changeLabel}>Change:</Text> {change.oldValue} → {change.newValue}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ff4444',
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  planDetails: {
    fontSize: 16,
    color: '#888',
    marginBottom: 5,
  },
  trainingDays: {
    fontSize: 14,
    color: '#00ff88',
    marginBottom: 5,
  },
  savedDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  hint: {
    fontSize: 14,
    color: '#888',
    marginBottom: 15,
  },
  dayCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  dayCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 5,
  },
  dayCardSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 5,
  },
  dayCardDetails: {
    fontSize: 14,
    color: '#888',
  },
  dayWorkoutCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  dayWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  dayWorkoutHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  expandButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  expandButtonText: {
    fontSize: 16,
    color: '#00ff88',
    fontWeight: 'bold',
  },
  dayWorkoutInfo: {
    flex: 1,
  },
  dayWorkoutDay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 5,
  },
  dayWorkoutName: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 5,
  },
  dayWorkoutStats: {
    fontSize: 14,
    color: '#888',
  },
  startDayButton: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  startDayButtonText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: 'bold',
  },
  exercisesList: {
    marginTop: 10,
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  exerciseItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
  },
  exerciseDetails: {
    fontSize: 14,
    color: '#888',
  },
  historyItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00ff88',
    marginBottom: 5,
  },
  historyDetails: {
    fontSize: 14,
    color: '#888',
    marginBottom: 5,
  },
  historyNotes: {
    fontSize: 14,
    color: '#ccc',
    fontStyle: 'italic',
  },
  actionButtons: {
    marginTop: 20,
    marginBottom: 40,
  },
  actionButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#00ff88',
  },
  startButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  aiSuggestionsContainer: {
    marginBottom: 20,
  },
  aiSuggestionsButton: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  aiSuggestionsButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  implementedButton: {
    backgroundColor: '#4a90e2',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  implementedButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  implementedCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4a90e2',
  },
  implementedBadge: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  implementedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  implementedDate: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalClose: {
    fontSize: 24,
    color: '#888',
    fontWeight: 'bold',
  },
  modalScrollView: {
    flex: 1,
    padding: 20,
  },
  suggestionCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  suggestionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityHigh: {
    backgroundColor: '#FF6B6B',
  },
  priorityMedium: {
    backgroundColor: '#FFA726',
  },
  priorityLow: {
    backgroundColor: '#66BB6A',
  },
  priorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  suggestionDescription: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
    lineHeight: 20,
  },
  suggestionReason: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  changesContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  changesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00ff88',
    marginBottom: 8,
  },
  changeItem: {
    marginBottom: 6,
  },
  changeText: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 18,
  },
  changeLabel: {
    fontWeight: '600',
    color: '#fff',
  },
  confidenceContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  confidenceText: {
    fontSize: 12,
    color: '#888',
  },
  applyAllButton: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  applyAllButtonText: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: 'bold',
  },
  suggestionActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  applySuggestionButton: {
    backgroundColor: '#00ff88',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  applySuggestionButtonText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: 'bold',
  },
});


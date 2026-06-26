import React, { useCallback, useEffect, useMemo, useState, useDeferredValue } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { AppTextInput as TextInput } from './src/components/AppTextInput';
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { StatusBar } from 'expo-status-bar';
import { WorkoutProgram, Exercise, WorkoutSession } from './data/workoutPrograms';
import ProgramExecutionScreen from './ProgramExecutionScreen';
import { saveUserData, loadUserData } from './src/utils/userStorage';
import { exerciseDatabase, ExerciseData } from './src/data/exerciseDatabase';
import { useSmallWins } from './src/context/SmallWinsContext';
import { AppTheme } from './src/theme/appVisualTheme';
import {
  type CustomExercise,
  type DayWorkout,
  type PlanWeek,
  cloneDayWorkoutsFromPreviousWeek,
  createInitialProgramWeeks,
  dayWorkoutsToSavedWeekDays,
  parseSetsAndReps,
  savedPlanToEditableProgram,
} from './src/utils/customWorkoutPlan';
import { TOUR_TARGET_IDS } from './src/tour/tourTargets';
import { useTourTargetRef } from './src/tour/useTourTargetRef';

interface BuildYourOwnWorkoutScreenProps {
  onBack: () => void;
  onWorkoutComplete?: () => void;
  /** When set, opens the builder in edit mode for an existing saved plan. */
  planToEdit?: any;
}

const MAX_PROGRAM_WEEKS = 12;

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function BuildYourOwnWorkoutScreen({
  onBack,
  onWorkoutComplete,
  planToEdit,
}: BuildYourOwnWorkoutScreenProps) {
  const fitnessBuildIntroRef = useTourTargetRef(TOUR_TARGET_IDS.fitnessBuildIntro);
  const { onWorkoutSessionSaved } = useSmallWins();
  const isEditMode = Boolean(planToEdit?.id);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(planToEdit?.id ?? null);
  // Step 1: Basic Details
  const [workoutName, setWorkoutName] = useState('');
  const [trainingDays, setTrainingDays] = useState<string[]>([]);
  const [numWeeks, setNumWeeks] = useState(1);
  const [weekNames, setWeekNames] = useState<string[]>(['Week 1']);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(-1);
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(-1);

  const [programWeeks, setProgramWeeks] = useState<PlanWeek[]>([]);
  
  // Current day exercise selection
  const [currentDayExercises, setCurrentDayExercises] = useState<CustomExercise[]>([]);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const deferredExerciseSearchQuery = useDeferredValue(exerciseSearchQuery);
  const [showCustomExerciseInput, setShowCustomExerciseInput] = useState(false);
  const [customExerciseName, setCustomExerciseName] = useState('');
  
  // Exercise configuration
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
  const [showExerciseConfigModal, setShowExerciseConfigModal] = useState(false);
  const [configExerciseName, setConfigExerciseName] = useState('');
  const [configSets, setConfigSets] = useState('3');
  const [configReps, setConfigReps] = useState('10');
  const [configWeight, setConfigWeight] = useState('0');
  const [configRestTime, setConfigRestTime] = useState('60');
  
  const [selectedProgram, setSelectedProgram] = useState<WorkoutProgram | null>(null);

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameTarget, setRenameTarget] = useState<
    | { kind: 'program' }
    | { kind: 'week'; weekIndex: number }
    | { kind: 'workout'; weekIndex: number; dayIndex: number }
    | null
  >(null);

  useEffect(() => {
    if (!planToEdit?.id) return;
    const editable = savedPlanToEditableProgram(planToEdit);
    if (!editable) {
      Alert.alert('Cannot edit', 'This plan has no workouts or exercises to edit.');
      onBack();
      return;
    }
    setEditingPlanId(planToEdit.id);
    setWorkoutName(editable.workoutName);
    setTrainingDays(editable.trainingDays);
    setNumWeeks(editable.numWeeks);
    setWeekNames(editable.weekNames);
    setProgramWeeks(editable.programWeeks);
    setCurrentWeekIndex(-1);
    setCurrentDayIndex(-2);
  }, [planToEdit?.id]);

  const syncWeekNamesFromCount = (count: number) => {
    setWeekNames((prev) => {
      const next = [...prev];
      while (next.length < count) {
        next.push(`Week ${next.length + 1}`);
      }
      return next.slice(0, count);
    });
  };

  const openRenameModal = (
    target: NonNullable<typeof renameTarget>,
    initial: string
  ) => {
    setRenameTarget(target);
    setRenameDraft(initial);
    setRenameModalVisible(true);
  };

  const applyRename = () => {
    const name = renameDraft.trim();
    if (!name || !renameTarget) {
      Alert.alert('Name required', 'Enter a name to continue.');
      return;
    }
    if (renameTarget.kind === 'program') {
      setWorkoutName(name);
    } else if (renameTarget.kind === 'week') {
      setProgramWeeks((prev) => {
        const next = [...prev];
        next[renameTarget.weekIndex] = { ...next[renameTarget.weekIndex], name };
        return next;
      });
      setWeekNames((prev) => {
        const next = [...prev];
        next[renameTarget.weekIndex] = name;
        return next;
      });
    } else {
      setProgramWeeks((prev) => {
        const next = [...prev];
        const days = [...next[renameTarget.weekIndex].dayWorkouts];
        days[renameTarget.dayIndex] = { ...days[renameTarget.dayIndex], workoutName: name };
        next[renameTarget.weekIndex] = { ...next[renameTarget.weekIndex], dayWorkouts: days };
        return next;
      });
    }
    setRenameModalVisible(false);
    setRenameTarget(null);
    setRenameDraft('');
  };

  const updateCurrentDayWorkoutName = (name: string) => {
    if (currentWeekIndex < 0 || currentDayIndex < 0) return;
    setProgramWeeks((prev) => {
      const next = [...prev];
      const days = [...next[currentWeekIndex].dayWorkouts];
      days[currentDayIndex] = { ...days[currentDayIndex], workoutName: name };
      next[currentWeekIndex] = { ...next[currentWeekIndex], dayWorkouts: days };
      return next;
    });
  };

  const filteredExercises = useMemo(() => {
    const q = deferredExerciseSearchQuery.trim().toLowerCase();
    const matched = q
      ? exerciseDatabase.filter((ex) => ex.name.toLowerCase().includes(q))
      : exerciseDatabase;
    // Avoid rendering hundreds of rows in a clipped box; search narrows the list.
    return matched.slice(0, q ? 80 : 40);
  }, [deferredExerciseSearchQuery]);

  const exerciseSearchActive = deferredExerciseSearchQuery.trim().length > 0;

  const handleToggleDay = (day: string) => {
    if (trainingDays.includes(day)) {
      setTrainingDays(trainingDays.filter(d => d !== day));
    } else {
      setTrainingDays([...trainingDays, day]);
    }
  };

  const handleStartBuildingDays = () => {
    if (!workoutName.trim()) {
      Alert.alert('Error', 'Please enter a program name');
      return;
    }
    if (trainingDays.length === 0) {
      Alert.alert('Error', 'Please select at least one training day');
      return;
    }

    const weeks = createInitialProgramWeeks(numWeeks, trainingDays, weekNames);
    setProgramWeeks(weeks);
    setCurrentWeekIndex(0);
    setCurrentDayIndex(0);
    setCurrentDayExercises([]);
    setExerciseSearchQuery('');
  };

  const updateCurrentDayInPlan = (patch: Partial<DayWorkout>) => {
    if (currentWeekIndex < 0 || currentDayIndex < 0) return;
    setProgramWeeks((prev) => {
      const next = [...prev];
      const days = [...next[currentWeekIndex].dayWorkouts];
      const merged = { ...days[currentDayIndex], ...patch };
      days[currentDayIndex] = merged;
      next[currentWeekIndex] = { ...next[currentWeekIndex], dayWorkouts: days };
      if (patch.exercises) {
        setCurrentDayExercises(patch.exercises);
      }
      return next;
    });
  };

  const handleAddExerciseToCurrentDay = (exerciseName: string) => {
    const newExercise: CustomExercise = {
      id: `exercise-${Date.now()}-${Math.random()}`,
      name: exerciseName,
      sets: '3',
      reps: '10',
      weight: 0,
      restTime: 60,
    };
    const updated = [...currentDayExercises, newExercise];
    setCurrentDayExercises(updated);
    updateCurrentDayInPlan({ exercises: updated });
  };

  const handleAddCustomExercise = () => {
    if (!customExerciseName.trim()) {
      Alert.alert('Error', 'Please enter an exercise name');
      return;
    }
    handleAddExerciseToCurrentDay(customExerciseName);
    setCustomExerciseName('');
    setShowCustomExerciseInput(false);
  };

  const handleRemoveExercise = (exerciseId: string) => {
    const updated = currentDayExercises.filter((ex) => ex.id !== exerciseId);
    setCurrentDayExercises(updated);
    updateCurrentDayInPlan({ exercises: updated });
  };

  const handleReorderExercises = useCallback(
    (data: CustomExercise[]) => {
      setCurrentDayExercises(data);
      if (currentWeekIndex >= 0 && currentDayIndex >= 0) {
        setProgramWeeks((prev) => {
          const next = [...prev];
          const days = [...next[currentWeekIndex].dayWorkouts];
          days[currentDayIndex] = { ...days[currentDayIndex], exercises: data };
          next[currentWeekIndex] = { ...next[currentWeekIndex], dayWorkouts: days };
          return next;
        });
      }
    },
    [currentWeekIndex, currentDayIndex]
  );

  const handleOpenExerciseConfig = (index: number) => {
    const exercise = currentDayExercises[index];
    setEditingExerciseIndex(index);
    setConfigExerciseName(exercise.name);
    setConfigSets(exercise.sets);
    setConfigReps(exercise.reps);
    setConfigWeight(exercise.weight.toString());
    setConfigRestTime(exercise.restTime.toString());
    setShowExerciseConfigModal(true);
  };

  const handleSaveExerciseConfig = () => {
    if (editingExerciseIndex === null) return;
    
    // Validate sets and reps (allow ranges like "4-6" or "6-10")
    const setsPattern = /^(\d+(-\d+)?)$/;
    const repsPattern = /^(\d+(-\d+)?)$/;
    
    if (!setsPattern.test(configSets.trim())) {
      Alert.alert('Invalid Format', 'Sets must be a number (e.g., "4") or range (e.g., "4-6")');
      return;
    }
    
    if (!repsPattern.test(configReps.trim())) {
      Alert.alert('Invalid Format', 'Reps must be a number (e.g., "10") or range (e.g., "6-10")');
      return;
    }
    
    const weight = parseFloat(configWeight) || 0;
    const restTime = parseInt(configRestTime) || 60;

    const updatedExercises = [...currentDayExercises];
    updatedExercises[editingExerciseIndex] = {
      ...updatedExercises[editingExerciseIndex],
      sets: configSets.trim(),
      reps: configReps.trim(),
      weight,
      restTime,
    };
    setCurrentDayExercises(updatedExercises);
    updateCurrentDayInPlan({ exercises: updatedExercises });
    setShowExerciseConfigModal(false);
    setEditingExerciseIndex(null);
  };

  const renderConfiguredExercise = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<CustomExercise>) => {
      const index = getIndex() ?? 0;
      return (
        <ScaleDecorator>
          <View
            style={[
              styles.exerciseConfigCard,
              isActive && styles.exerciseConfigCardActive,
            ]}
          >
            <View style={styles.exerciseConfigHeader}>
              <Pressable
                onLongPress={drag}
                delayLongPress={150}
                style={styles.dragHandle}
                accessibilityRole="button"
                accessibilityLabel={`Reorder ${item.name}`}
                accessibilityHint="Hold and drag to change exercise order"
              >
                <Text style={styles.dragHandleText}>☰</Text>
              </Pressable>
              <Text style={styles.exerciseConfigNumber}>{index + 1}</Text>
              <Text style={styles.exerciseConfigName}>{item.name}</Text>
              <TouchableOpacity
                style={styles.removeExerciseButton}
                onPress={() => handleRemoveExercise(item.id)}
              >
                <Text style={styles.removeExerciseText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.exerciseConfigDetails}>
              <Text style={styles.exerciseConfigDetailText}>
                {item.sets} sets × {item.reps} reps
              </Text>
              {item.weight > 0 && (
                <Text style={styles.exerciseConfigDetailText}>
                  @ {item.weight} lbs
                </Text>
              )}
              <Text style={styles.exerciseConfigDetailText}>
                {item.restTime}s rest
              </Text>
            </View>
            <TouchableOpacity
              style={styles.configureButton}
              onPress={() => handleOpenExerciseConfig(index)}
            >
              <Text style={styles.configureButtonText}>Configure</Text>
            </TouchableOpacity>
          </View>
        </ScaleDecorator>
      );
    },
    [handleOpenExerciseConfig, handleRemoveExercise]
  );

  const handleCompleteCurrentDay = () => {
    if (currentDayExercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise for this workout');
      return;
    }

    const updatedWeeks = [...programWeeks];
    const days = [...updatedWeeks[currentWeekIndex].dayWorkouts];
    days[currentDayIndex] = {
      ...days[currentDayIndex],
      exercises: [...currentDayExercises],
      completed: true,
    };
    updatedWeeks[currentWeekIndex] = {
      ...updatedWeeks[currentWeekIndex],
      dayWorkouts: days,
    };

    const weekDone = days.every((d) => d.completed && d.exercises.length > 0);
    if (weekDone) {
      updatedWeeks[currentWeekIndex] = { ...updatedWeeks[currentWeekIndex], completed: true };
    }
    setProgramWeeks(updatedWeeks);

    if (currentDayIndex < trainingDays.length - 1) {
      const nextDay = currentDayIndex + 1;
      setCurrentDayIndex(nextDay);
      setCurrentDayExercises([...days[nextDay].exercises]);
      setExerciseSearchQuery('');
      return;
    }

    if (currentWeekIndex < programWeeks.length - 1) {
      const nextWeekIndex = currentWeekIndex + 1;
      const completedWeekName = updatedWeeks[currentWeekIndex].name;
      const prevWeekDays = updatedWeeks[currentWeekIndex].dayWorkouts;
      const copiedDays = cloneDayWorkoutsFromPreviousWeek(prevWeekDays, trainingDays);
      updatedWeeks[nextWeekIndex] = {
        ...updatedWeeks[nextWeekIndex],
        dayWorkouts: copiedDays,
      };
      setProgramWeeks(updatedWeeks);
      setCurrentWeekIndex(nextWeekIndex);
      setCurrentDayIndex(0);
      setCurrentDayExercises([...copiedDays[0].exercises]);
      setExerciseSearchQuery('');
      Alert.alert(
        'New week',
        `Exercises were copied from "${completedWeekName}" so you can adjust sets and reps for this phase.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setCurrentWeekIndex(-1);
    setCurrentDayIndex(-2);
  };

  const handleBackToDay = (weekIndex: number, dayIndex: number) => {
    setCurrentWeekIndex(weekIndex);
    setCurrentDayIndex(dayIndex);
    setCurrentDayExercises([...programWeeks[weekIndex].dayWorkouts[dayIndex].exercises]);
    setExerciseSearchQuery('');
  };

  const handleReorderReviewExercises = useCallback(
    (weekIndex: number, dayIndex: number, data: CustomExercise[]) => {
      setProgramWeeks((prev) => {
        const next = [...prev];
        const days = [...next[weekIndex].dayWorkouts];
        days[dayIndex] = { ...days[dayIndex], exercises: data };
        next[weekIndex] = { ...next[weekIndex], dayWorkouts: days };
        return next;
      });
    },
    []
  );

  const handleStartWorkout = (weekIndex: number, dayIndex: number) => {
    const dayWorkout = programWeeks[weekIndex]?.dayWorkouts[dayIndex];

    if (!dayWorkout || dayWorkout.exercises.length === 0) {
      Alert.alert('Error', 'No exercises configured for this workout');
      return;
    }

    const programExercises: Exercise[] = dayWorkout.exercises.map((ex) => {
      const { setsNum, repsNum } = parseSetsAndReps(ex);
      return {
        id: ex.id,
        name: ex.name,
        sets: setsNum,
        reps: repsNum,
        weight: ex.weight,
        restTime: ex.restTime,
        category: 'strength' as const,
      };
    });

    const weekLabel = programWeeks[weekIndex]?.name || `Week ${weekIndex + 1}`;
    const sessionName =
      dayWorkout.workoutName.trim() || `${workoutName} - ${dayWorkout.day}`;

    const program: WorkoutProgram = {
      id: `custom-${Date.now()}`,
      name: `${sessionName} (${weekLabel})`,
      description: `${weekLabel} • ${dayWorkout.day}`,
      duration: dayWorkout.exercises.length * 5,
      frequency: 1,
      level: 'intermediate' as const,
      category: 'strength' as const,
      exercises: programExercises,
      focus: dayWorkout.workoutName || 'Custom workout',
      equipment: [],
    };

    setSelectedProgram(program);
  };

  const handleWorkoutComplete = async (session: WorkoutSession) => {
    try {
      console.log('Saving workout session:', session);
      console.log('Session exercises:', session.exercises);
      const existingHistory = await loadUserData<WorkoutSession[]>('workoutHistory') || [];
      const updatedHistory = [session, ...existingHistory]; // Add to beginning for most recent first
      await saveUserData('workoutHistory', updatedHistory);
      console.log('Workout history saved successfully');
    } catch (error) {
      console.error('Error saving workout history:', error);
    }

    try {
      await onWorkoutSessionSaved(session);
    } catch {
      /* ignore */
    }

    setSelectedProgram(null);
    if (onWorkoutComplete) {
      onWorkoutComplete();
    }
  };

  const handleSaveWorkout = async () => {
    const allCompleted = programWeeks.every((week) =>
      week.dayWorkouts.every((dw) => dw.completed && dw.exercises.length > 0)
    );
    if (!allCompleted) {
      Alert.alert('Error', 'Please complete every week and training day before saving');
      return;
    }

    const programWeeksSaved = programWeeks.map((week, weekIndex) => ({
      weekNumber: weekIndex + 1,
      name: week.name,
      weekDays: dayWorkoutsToSavedWeekDays(week.dayWorkouts, workoutName),
    }));

    const firstWeekDays = programWeeksSaved[0]?.weekDays ?? [];
    const totalDuration = programWeeks.reduce(
      (sum, week) =>
        sum + week.dayWorkouts.reduce((dSum, dw) => dSum + dw.exercises.length * 5, 0),
      0
    );

    const weeklyPlan = { weekDays: firstWeekDays };

    const savedPlanPayload = {
      name: workoutName,
      level: 'intermediate' as const,
      goal: 'strength' as const,
      exercises: firstWeekDays[0]?.exercises ?? [],
      duration: totalDuration,
      daysPerWeek: trainingDays.length,
      totalWeeks: programWeeks.length,
      programWeeks: programWeeksSaved,
      trainingDays,
      weeklyPlan,
      isCustom: true,
    };

    try {
      const existingPlans = await loadUserData<any[]>('savedWorkoutPlans') || [];
      if (editingPlanId) {
        const planIndex = existingPlans.findIndex((p) => p.id === editingPlanId);
        if (planIndex === -1) {
          Alert.alert('Error', 'Could not find this plan to update.');
          return;
        }
        const previous = existingPlans[planIndex];
        existingPlans[planIndex] = {
          ...previous,
          ...savedPlanPayload,
          id: previous.id,
          savedAt: previous.savedAt,
          updatedAt: new Date().toISOString(),
        };
        await saveUserData('savedWorkoutPlans', existingPlans);
        Alert.alert('Success', 'Workout plan updated successfully!');
      } else {
        const savedPlan = {
          ...savedPlanPayload,
          id: `custom-${Date.now()}`,
          savedAt: new Date().toISOString(),
        };
        await saveUserData('savedWorkoutPlans', [...existingPlans, savedPlan]);
        Alert.alert('Success', 'Workout plan saved successfully!');
      }
      onBack();
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('Error', 'Failed to save workout');
    }
  };

  if (selectedProgram) {
    return (
      <ProgramExecutionScreen
        program={selectedProgram}
        onBack={() => setSelectedProgram(null)}
        onComplete={handleWorkoutComplete}
      />
    );
  }

  // Step 1: Basic Details
  if (currentDayIndex === -1) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
        <View style={styles.header} ref={fitnessBuildIntroRef} nativeID={TOUR_TARGET_IDS.fitnessBuildIntro}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? 'Edit Program' : 'Build Your Own Workout'}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.label}>Program Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 8-Week Strength Block"
              placeholderTextColor="#666"
              value={workoutName}
              onChangeText={setWorkoutName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Program Length</Text>
            <Text style={styles.hint}>
              Multi-week plans let you change rep schemes each phase (build, hypertrophy, etc.)
            </Text>
            <View style={styles.weekStepperRow}>
              <TouchableOpacity
                style={styles.weekStepperBtn}
                onPress={() => {
                  const next = Math.max(1, numWeeks - 1);
                  setNumWeeks(next);
                  syncWeekNamesFromCount(next);
                }}
                disabled={numWeeks <= 1}
              >
                <Text style={styles.weekStepperBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.weekStepperValue}>
                {numWeeks} {numWeeks === 1 ? 'week' : 'weeks'}
              </Text>
              <TouchableOpacity
                style={styles.weekStepperBtn}
                onPress={() => {
                  const next = Math.min(MAX_PROGRAM_WEEKS, numWeeks + 1);
                  setNumWeeks(next);
                  syncWeekNamesFromCount(next);
                }}
                disabled={numWeeks >= MAX_PROGRAM_WEEKS}
              >
                <Text style={styles.weekStepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {numWeeks > 1 && (
              <View style={styles.weekNamesBlock}>
                <Text style={styles.hint}>Optional labels for each week</Text>
                {weekNames.slice(0, numWeeks).map((label, i) => (
                  <View key={`week-name-${i}`} style={styles.weekNameRow}>
                    <Text style={styles.weekNameLabel}>Week {i + 1}</Text>
                    <TextInput
                      style={styles.weekNameInput}
                      placeholder={`Week ${i + 1}`}
                      placeholderTextColor="#666"
                      value={label}
                      onChangeText={(text) => {
                        setWeekNames((prev) => {
                          const next = [...prev];
                          next[i] = text;
                          return next;
                        });
                      }}
                      autoCapitalize="words"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Training Days</Text>
            <Text style={styles.hint}>Select the days you want to train</Text>
            <View style={styles.daysContainer}>
              {DAYS_OF_WEEK.map(day => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayButton,
                    trainingDays.includes(day) && styles.dayButtonSelected
                  ]}
                  onPress={() => handleToggleDay(day)}
                >
                  <Text style={[
                    styles.dayButtonText,
                    trainingDays.includes(day) && styles.dayButtonTextSelected
                  ]}>
                    {day.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {trainingDays.length > 0 && (
              <Text style={styles.selectedDaysText}>
                Selected: {trainingDays.join(', ')}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.nextButton, (!workoutName.trim() || trainingDays.length === 0) && styles.nextButtonDisabled]}
            onPress={handleStartBuildingDays}
            disabled={!workoutName.trim() || trainingDays.length === 0}
          >
            <Text style={styles.nextButtonText}>Next — Add Exercises</Text>
          </TouchableOpacity>
          {(!workoutName.trim() || trainingDays.length === 0) && (
            <Text style={styles.step1Hint}>
              Enter a program name and select at least one training day to continue.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const renameModal = (
    <Modal
      visible={renameModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setRenameModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.renameModalCard}
        >
          <Text style={styles.modalTitle}>
            {renameTarget?.kind === 'program'
              ? 'Rename program'
              : renameTarget?.kind === 'week'
                ? 'Rename week'
                : 'Rename workout'}
          </Text>
          <TextInput
            style={styles.input}
            value={renameDraft}
            onChangeText={setRenameDraft}
            placeholder="Enter name"
            placeholderTextColor="#666"
            autoFocus
            autoCapitalize="words"
          />
          <View style={styles.renameModalActions}>
            <TouchableOpacity
              style={styles.renameCancelBtn}
              onPress={() => {
                setRenameModalVisible(false);
                setRenameTarget(null);
              }}
            >
              <Text style={styles.renameCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.renameSaveBtn} onPress={applyRename}>
              <Text style={styles.renameSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  // Step 2-N: Building each day's workout
  if (
    currentWeekIndex >= 0 &&
    currentWeekIndex < programWeeks.length &&
    currentDayIndex >= 0 &&
    currentDayIndex < trainingDays.length
  ) {
    const currentDay = trainingDays[currentDayIndex];
    const currentWeek = programWeeks[currentWeekIndex];
    const currentDayPlan = currentWeek.dayWorkouts[currentDayIndex];
    const isExerciseSelected = (name: string) => currentDayExercises.some(ex => ex.name === name);

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => {
            const updatedWeeks = [...programWeeks];
            const days = [...updatedWeeks[currentWeekIndex].dayWorkouts];
            days[currentDayIndex] = {
              ...days[currentDayIndex],
              exercises: [...currentDayExercises],
            };
            updatedWeeks[currentWeekIndex] = {
              ...updatedWeeks[currentWeekIndex],
              dayWorkouts: days,
            };
            setProgramWeeks(updatedWeeks);

            if (currentDayIndex > 0) {
              const prev = currentDayIndex - 1;
              setCurrentDayIndex(prev);
              setCurrentDayExercises([...days[prev].exercises]);
            } else if (currentWeekIndex > 0) {
              const prevWeek = currentWeekIndex - 1;
              const prevDays = updatedWeeks[prevWeek].dayWorkouts;
              const lastDay = trainingDays.length - 1;
              setCurrentWeekIndex(prevWeek);
              setCurrentDayIndex(lastDay);
              setCurrentDayExercises([...prevDays[lastDay].exercises]);
            } else {
              setCurrentWeekIndex(-1);
              setCurrentDayIndex(-1);
              setCurrentDayExercises([]);
            }
          }}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentWeek.name}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Week {currentWeekIndex + 1} of {programWeeks.length} • Day {currentDayIndex + 1} of{' '}
            {trainingDays.length}
          </Text>
          <View style={styles.workoutNameEditRow}>
            <Text style={styles.workoutNameEditLabel}>Workout name</Text>
            <TextInput
              style={styles.workoutNameEditInput}
              value={currentDayPlan.workoutName}
              onChangeText={updateCurrentDayWorkoutName}
              placeholder={`${currentDay} workout`}
              placeholderTextColor="#666"
            />
            <TouchableOpacity
              style={styles.inlineEditBtn}
              onPress={() =>
                openRenameModal(
                  { kind: 'workout', weekIndex: currentWeekIndex, dayIndex: currentDayIndex },
                  currentDayPlan.workoutName
                )
              }
            >
              <Text style={styles.inlineEditBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.buildDayScroll}
            contentContainerStyle={styles.buildDayScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View style={styles.section}>
              <Text style={styles.label}>Add Exercises for {currentDay}</Text>
              <Text style={styles.hint}>
                Search the library, tap to add, or create a custom exercise
              </Text>

              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search exercises..."
                  placeholderTextColor="#666"
                  value={exerciseSearchQuery}
                  onChangeText={setExerciseSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  spellCheck={false}
                  textContentType="none"
                  clearButtonMode="while-editing"
                  onSubmitEditing={() => {
                    if (
                      exerciseSearchQuery.trim() &&
                      filteredExercises.length === 0 &&
                      !isExerciseSelected(exerciseSearchQuery.trim())
                    ) {
                      handleAddExerciseToCurrentDay(exerciseSearchQuery.trim());
                      setExerciseSearchQuery('');
                    }
                  }}
                />
                {exerciseSearchQuery.trim() &&
                  filteredExercises.length === 0 &&
                  !isExerciseSelected(exerciseSearchQuery.trim()) && (
                    <TouchableOpacity
                      style={styles.addSearchResultButton}
                      onPress={() => {
                        handleAddExerciseToCurrentDay(exerciseSearchQuery.trim());
                        setExerciseSearchQuery('');
                      }}
                    >
                      <Text style={styles.addSearchResultButtonText}>
                        + Add "{exerciseSearchQuery.trim()}"
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>

              {!exerciseSearchActive && (
                <Text style={styles.exerciseBrowseHint}>
                  Showing common exercises — type to search the full library
                </Text>
              )}

              <ScrollView
                style={styles.exerciseList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {filteredExercises.map((exercise) => {
                  const selected = isExerciseSelected(exercise.name);
                  return (
                    <TouchableOpacity
                      key={exercise.name}
                      style={[
                        styles.exerciseItem,
                        selected && styles.exerciseItemSelected,
                      ]}
                      onPress={() => {
                        if (selected) {
                          handleRemoveExercise(
                            currentDayExercises.find((ex) => ex.name === exercise.name)!.id
                          );
                        } else {
                          handleAddExerciseToCurrentDay(exercise.name);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.exerciseItemText,
                          selected && styles.exerciseItemTextSelected,
                        ]}
                      >
                        {exercise.name}
                      </Text>
                      {selected && <Text style={styles.checkmark}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={styles.addCustomExerciseBtn}
                onPress={() => setShowCustomExerciseInput((v) => !v)}
              >
                <Text style={styles.addCustomExerciseBtnText}>
                  {showCustomExerciseInput ? 'Hide custom exercise' : '+ Add custom exercise'}
                </Text>
              </TouchableOpacity>

              {showCustomExerciseInput && (
                <View style={styles.customExerciseInput}>
                  <TextInput
                    style={styles.input}
                    placeholder="Exercise name"
                    placeholderTextColor="#666"
                    value={customExerciseName}
                    onChangeText={setCustomExerciseName}
                    autoCapitalize="words"
                  />
                  <View style={styles.customExerciseActions}>
                    <TouchableOpacity style={styles.addButton} onPress={handleAddCustomExercise}>
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {currentDayExercises.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.label}>
                  Your exercises ({currentDayExercises.length})
                </Text>
                <Text style={styles.reorderHint}>Hold ☰ and drag to reorder</Text>
                <DraggableFlatList
                  data={currentDayExercises}
                  keyExtractor={(item) => item.id}
                  onDragEnd={({ data }) => handleReorderExercises(data)}
                  renderItem={renderConfiguredExercise}
                  scrollEnabled={false}
                />
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.completeDayButton,
                currentDayExercises.length === 0 && styles.completeDayButtonDisabled,
              ]}
              onPress={handleCompleteCurrentDay}
              disabled={currentDayExercises.length === 0}
            >
              <Text style={styles.completeDayButtonText}>
                {currentDayIndex < trainingDays.length - 1
                  ? `Complete ${currentDayPlan.workoutName || currentDay} & continue`
                  : currentWeekIndex < programWeeks.length - 1
                    ? `Finish week — start ${programWeeks[currentWeekIndex + 1]?.name || 'next week'}`
                    : 'Finish & review program'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Exercise Configuration Modal */}
        <Modal
          visible={showExerciseConfigModal}
          transparent
          animationType="none"
          onRequestClose={() => setShowExerciseConfigModal(false)}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Configure Exercise</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowExerciseConfigModal(false);
                    setEditingExerciseIndex(null);
                  }}
                >
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Exercise: {configExerciseName}</Text>
                </View>

                <View style={styles.modalRow}>
                  <View style={styles.modalField}>
                    <Text style={styles.modalLabel}>Sets</Text>
                    <Text style={styles.modalHint}>e.g., 4 or 4-6</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="3 or 4-6"
                      placeholderTextColor="#666"
                      keyboardType="default"
                      value={configSets}
                      onChangeText={setConfigSets}
                    />
                  </View>
                  <View style={styles.modalField}>
                    <Text style={styles.modalLabel}>Reps</Text>
                    <Text style={styles.modalHint}>e.g., 10 or 6-10</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="10 or 6-10"
                      placeholderTextColor="#666"
                      keyboardType="default"
                      value={configReps}
                      onChangeText={setConfigReps}
                    />
                  </View>
                </View>

                <View style={styles.modalRow}>
                  <View style={styles.modalField}>
                    <Text style={styles.modalLabel}>Weight (lbs)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="0"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={configWeight}
                      onChangeText={setConfigWeight}
                    />
                  </View>
                  <View style={styles.modalField}>
                    <Text style={styles.modalLabel}>Rest (seconds)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="60"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={configRestTime}
                      onChangeText={setConfigRestTime}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={handleSaveExerciseConfig}
                >
                  <Text style={styles.modalSaveButtonText}>Save Configuration</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>
        {renameModal}
      </SafeAreaView>
    );
  }

  // Review & Save Step
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => {
          const lastWeek = programWeeks.length - 1;
          const lastDay = trainingDays.length - 1;
          setCurrentWeekIndex(lastWeek);
          setCurrentDayIndex(lastDay);
          setCurrentDayExercises([...programWeeks[lastWeek].dayWorkouts[lastDay].exercises]);
        }}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Edit Program' : 'Review Program'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.reviewProgramNameRow}>
            <Text style={styles.reviewProgramName}>{workoutName}</Text>
            <TouchableOpacity
              style={styles.inlineEditBtn}
              onPress={() => openRenameModal({ kind: 'program' }, workoutName)}
            >
              <Text style={styles.inlineEditBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            {programWeeks.length} {programWeeks.length === 1 ? 'week' : 'weeks'} •{' '}
            {trainingDays.length} training days per week
          </Text>

          {programWeeks.map((week, weekIndex) => (
            <View key={week.id} style={styles.reviewWeekBlock}>
              <View style={styles.reviewWeekHeader}>
                <Text style={styles.reviewWeekTitle}>{week.name}</Text>
                <TouchableOpacity
                  style={styles.inlineEditBtn}
                  onPress={() => openRenameModal({ kind: 'week', weekIndex }, week.name)}
                >
                  <Text style={styles.inlineEditBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>

              {week.dayWorkouts.map((dayWorkout, dayIndex) => (
                <View key={`${week.id}-${dayWorkout.day}`} style={styles.reviewDayCard}>
                  <View style={styles.reviewDayHeader}>
                    <View style={styles.reviewDayTitleBlock}>
                      <Text style={styles.reviewDayTitle}>{dayWorkout.workoutName}</Text>
                      <Text style={styles.reviewDayMeta}>{dayWorkout.day}</Text>
                    </View>
                    <View style={styles.reviewDayActions}>
                      <TouchableOpacity
                        style={styles.editDayButton}
                        onPress={() =>
                          openRenameModal(
                            { kind: 'workout', weekIndex, dayIndex },
                            dayWorkout.workoutName
                          )
                        }
                      >
                        <Text style={styles.editDayButtonText}>Rename</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editDayButton}
                        onPress={() => handleBackToDay(weekIndex, dayIndex)}
                      >
                        <Text style={styles.editDayButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.startDayButton}
                        onPress={() => handleStartWorkout(weekIndex, dayIndex)}
                      >
                        <Text style={styles.startDayButtonText}>Start</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.reviewDaySubtitle}>
                    {dayWorkout.exercises.length} exercises • ~{dayWorkout.exercises.length * 5} min
                  </Text>
                  {dayWorkout.exercises.length > 1 ? (
                    <Text style={styles.reorderHint}>Hold ☰ and drag to reorder</Text>
                  ) : null}
                  <DraggableFlatList
                    scrollEnabled={false}
                    data={dayWorkout.exercises}
                    keyExtractor={(item) => item.id}
                    onDragEnd={({ data }) =>
                      handleReorderReviewExercises(weekIndex, dayIndex, data)
                    }
                    renderItem={({ item, drag, isActive, getIndex }) => {
                      const exIndex = getIndex() ?? 0;
                      return (
                        <ScaleDecorator>
                          <View
                            style={[
                              styles.reviewExerciseItem,
                              isActive && styles.reviewExerciseItemActive,
                            ]}
                          >
                            {dayWorkout.exercises.length > 1 ? (
                              <Pressable
                                onLongPress={drag}
                                delayLongPress={150}
                                style={styles.dragHandle}
                                accessibilityRole="button"
                                accessibilityLabel={`Reorder ${item.name}`}
                                accessibilityHint="Hold and drag to change exercise order"
                              >
                                <Text style={styles.dragHandleText}>☰</Text>
                              </Pressable>
                            ) : null}
                            <View style={styles.reviewExerciseTextCol}>
                              <Text style={styles.reviewExerciseName}>
                                {exIndex + 1}. {item.name}
                              </Text>
                              <Text style={styles.reviewExerciseDetails}>
                                {item.sets} sets × {item.reps} reps
                                {item.weight > 0 && ` @ ${item.weight} lbs`}
                                {' • '}{item.restTime}s rest
                              </Text>
                            </View>
                          </View>
                        </ScaleDecorator>
                      );
                    }}
                  />
                </View>
              ))}
            </View>
          ))}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSaveWorkout}
            >
              <Text style={styles.saveButtonText}>
                {isEditMode ? 'Save Changes' : 'Save Program'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      {renameModal}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  header: {
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppTheme.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: AppTheme.card,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  progressText: {
    color: AppTheme.accent,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  buildDayScroll: {
    flex: 1,
  },
  buildDayScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  step1Hint: {
    color: AppTheme.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  exerciseBrowseHint: {
    color: AppTheme.textMuted,
    fontSize: 13,
    marginBottom: 10,
  },
  addCustomExerciseBtn: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  addCustomExerciseBtnText: {
    color: AppTheme.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 14,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppTheme.textPrimary,
    marginBottom: 10,
  },
  hint: {
    fontSize: 14,
    color: AppTheme.textMuted,
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 15,
    color: AppTheme.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  dayButton: {
    flex: 1,
    minWidth: '13%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderColor: '#4ADE80',
  },
  dayButtonText: {
    color: AppTheme.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  dayButtonTextSelected: {
    color: '#4ADE80',
  },
  selectedDaysText: {
    color: '#00ff88',
    fontSize: 14,
    marginTop: 10,
  },
  weekStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 16,
  },
  weekStepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStepperBtnText: {
    color: AppTheme.accent,
    fontSize: 24,
    fontWeight: '700',
  },
  weekStepperValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    minWidth: 100,
    textAlign: 'center',
  },
  weekNamesBlock: {
    marginTop: 16,
    gap: 10,
  },
  weekNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weekNameLabel: {
    color: AppTheme.textMuted,
    fontSize: 14,
    width: 56,
  },
  weekNameInput: {
    flex: 1,
    backgroundColor: AppTheme.inputBg,
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  workoutNameEditRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutNameEditLabel: {
    color: AppTheme.textMuted,
    fontSize: 13,
  },
  workoutNameEditInput: {
    flex: 1,
    backgroundColor: AppTheme.inputBg,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: '#fff',
    borderWidth: 1,
    borderColor: AppTheme.border,
    fontSize: 14,
  },
  inlineEditBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppTheme.accent,
  },
  inlineEditBtnText: {
    color: AppTheme.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  renameModalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    width: '88%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  renameModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  renameCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#333',
    alignItems: 'center',
  },
  renameCancelText: {
    color: '#ccc',
    fontWeight: '600',
  },
  renameSaveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: AppTheme.accent,
    alignItems: 'center',
  },
  renameSaveText: {
    color: AppTheme.accentDark,
    fontWeight: '800',
  },
  reviewProgramNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewProgramName: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  reviewWeekBlock: {
    marginTop: 20,
  },
  reviewWeekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reviewWeekTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: AppTheme.accent,
  },
  reviewDayTitleBlock: {
    flex: 1,
    marginRight: 8,
  },
  reviewDayMeta: {
    color: AppTheme.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  searchContainer: {
    marginBottom: 15,
  },
  searchInput: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 15,
    color: AppTheme.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  addSearchResultButton: {
    backgroundColor: '#4ADE80',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  addSearchResultButtonText: {
    color: '#0f2517',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addCustomButton: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
    marginBottom: 15,
    alignItems: 'center',
  },
  addCustomButtonText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
  },
  customExerciseInput: {
    marginBottom: 15,
  },
  customExerciseActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    flex: 1,
    backgroundColor: '#00ff88',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: 'bold',
  },
  exerciseList: {
    maxHeight: 320,
    marginBottom: 12,
  },
  exerciseItem: {
    backgroundColor: '#121212',
    borderRadius: 8,
    padding: 15,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  exerciseItemSelected: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: '#4ADE80',
  },
  exerciseItemText: {
    color: AppTheme.textPrimary,
    fontSize: 16,
    flex: 1,
  },
  exerciseItemTextSelected: {
    color: '#4ADE80',
    fontWeight: '600',
  },
  checkmark: {
    color: '#4ADE80',
    fontSize: 20,
    fontWeight: 'bold',
  },
  draggableList: {
    flex: 1,
  },
  draggableListContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  exerciseConfigCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  exerciseConfigCardActive: {
    borderColor: AppTheme.accent,
    shadowColor: AppTheme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  dragHandle: {
    paddingVertical: 6,
    paddingRight: 8,
    marginRight: 4,
  },
  dragHandleText: {
    color: '#888',
    fontSize: 20,
    lineHeight: 22,
  },
  reorderHint: {
    color: '#888',
    fontSize: 13,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  exerciseConfigHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  exerciseConfigNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00ff88',
    marginRight: 10,
    width: 30,
  },
  exerciseConfigName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  removeExerciseButton: {
    padding: 5,
  },
  removeExerciseText: {
    color: '#ff4444',
    fontSize: 24,
    fontWeight: 'bold',
  },
  exerciseConfigDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
    gap: 10,
  },
  exerciseConfigDetailText: {
    color: '#888',
    fontSize: 14,
    marginRight: 15,
  },
  configureButton: {
    backgroundColor: '#333',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
    alignSelf: 'flex-start',
  },
  configureButtonText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
  },
  completeDayButton: {
    backgroundColor: '#4ADE80',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  completeDayButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  completeDayButtonText: {
    color: '#0f2517',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reviewDayCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  reviewDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewDayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00ff88',
  },
  reviewDayActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editDayButton: {
    backgroundColor: '#333',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  editDayButtonText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
  },
  startDayButton: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  startDayButtonText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: 'bold',
  },
  reviewDaySubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 15,
  },
  reviewExerciseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  reviewExerciseItemActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    borderTopColor: AppTheme.accent,
  },
  reviewExerciseTextCol: {
    flex: 1,
    minWidth: 0,
  },
  reviewExerciseName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  reviewExerciseDetails: {
    color: '#888',
    fontSize: 14,
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
  saveButton: {
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: '#00ff88',
  },
  saveButtonText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextButton: {
    backgroundColor: '#4ADE80',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#0f2517',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: AppTheme.bgScreen,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
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
  modalScroll: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  modalField: {
    flex: 1,
  },
  modalLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  modalInput: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 15,
    color: AppTheme.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  modalSaveButton: {
    backgroundColor: '#4ADE80',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  modalSaveButtonText: {
    color: '#0f2517',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

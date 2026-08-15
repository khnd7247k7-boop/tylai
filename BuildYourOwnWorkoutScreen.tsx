import React, { useCallback, useEffect, useMemo, useState, useDeferredValue, memo } from 'react';
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
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  type RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { StatusBar } from 'expo-status-bar';
import { WorkoutProgram, Exercise } from './data/workoutPrograms';
import { saveUserData, loadUserData } from './src/utils/userStorage';
import { useActiveWorkout } from './src/context/ActiveWorkoutContext';
import { deleteSavedWorkoutPlan } from './src/utils/savedWorkoutPlanActions';
import { exerciseDatabase } from './src/data/exerciseDatabase';
import { AppTheme } from './src/theme/appVisualTheme';
import {
  type CustomExercise,
  type DayWorkout,
  type PlanWeek,
  type CustomPlanScheduleMode,
  type EditableSavedProgram,
  cloneCustomExercises,
  cloneDayWorkoutsFromPreviousWeek,
  createFlexibleTrainingDays,
  createInitialProgramWeeks,
  dayWorkoutsToSavedWeekDays,
  parseSetsAndReps,
  savedPlanToEditableProgram,
  sortWeeklyTrainingDays,
  scheduleModeDescription,
} from './src/utils/customWorkoutPlan';
import {
  buildSupersetLetterMap,
  cleanupSingletonSupersets,
  formatSupersetTag,
  groupExercisesAsSuperset,
  normalizeSupersetContiguity,
  ungroupExercises,
} from './src/utils/workoutSupersets';
import { TOUR_TARGET_IDS } from './src/tour/tourTargets';
import { useTourTargetRef } from './src/tour/useTourTargetRef';
import ScanWorkoutSpreadsheetModal from './src/components/workout/ScanWorkoutSpreadsheetModal';

interface BuildYourOwnWorkoutScreenProps {
  onBack: () => void;
  onWorkoutComplete?: () => void;
  /** When set, opens the builder in edit mode for an existing saved plan. */
  planToEdit?: any;
  /** Called after a plan is deleted from edit mode so parent lists stay in sync. */
  onPlanDeleted?: (planId: string) => void;
}

const MAX_PROGRAM_WEEKS = 12;
const EXERCISE_ROW_HEIGHT = 56;

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

type ExerciseLibraryRowProps = {
  name: string;
  selected: boolean;
  onToggle: (name: string) => void;
};

const ExerciseLibraryRow = memo(function ExerciseLibraryRow({
  name,
  selected,
  onToggle,
}: ExerciseLibraryRowProps) {
  return (
    <TouchableOpacity
      style={[styles.exerciseItem, selected && styles.exerciseItemSelected]}
      onPress={() => onToggle(name)}
      activeOpacity={0.7}
    >
      <Text
        style={[styles.exerciseItemText, selected && styles.exerciseItemTextSelected]}
        numberOfLines={1}
      >
        {name}
      </Text>
      {selected ? <Text style={styles.checkmark}>✓</Text> : null}
    </TouchableOpacity>
  );
});

export default function BuildYourOwnWorkoutScreen({
  onBack,
  onWorkoutComplete,
  planToEdit,
  onPlanDeleted,
}: BuildYourOwnWorkoutScreenProps) {
  const fitnessBuildIntroRef = useTourTargetRef(TOUR_TARGET_IDS.fitnessBuildIntro);
  const { startActiveWorkout } = useActiveWorkout();
  const isEditMode = Boolean(planToEdit?.id);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(planToEdit?.id ?? null);
  // Step 1: Basic Details
  const [workoutName, setWorkoutName] = useState('');
  const [scheduleMode, setScheduleMode] = useState<CustomPlanScheduleMode>('weekly_split');
  const [flexibleDayCount, setFlexibleDayCount] = useState(4);
  const [trainingDays, setTrainingDays] = useState<string[]>([]);
  const [numWeeks, setNumWeeks] = useState(1);
  const [weekNames, setWeekNames] = useState<string[]>(['Week 1']);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(-1);
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(-1);
  const [scanSpreadsheetVisible, setScanSpreadsheetVisible] = useState(false);
  const [copyDaysModalVisible, setCopyDaysModalVisible] = useState(false);
  const [copyTargetDayIndexes, setCopyTargetDayIndexes] = useState<number[]>([]);
  const [copyAlsoName, setCopyAlsoName] = useState(false);

  const [programWeeks, setProgramWeeks] = useState<PlanWeek[]>([]);
  
  // Current day exercise selection
  const [currentDayExercises, setCurrentDayExercises] = useState<CustomExercise[]>([]);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const deferredExerciseSearchQuery = useDeferredValue(exerciseSearchQuery);
  const [showCustomExerciseInput, setShowCustomExerciseInput] = useState(false);
  const [customExerciseName, setCustomExerciseName] = useState('');
  /** Local draft so typing the workout name doesn't re-render the exercise list every keystroke. */
  const [dayNameDraft, setDayNameDraft] = useState('');
  
  // Exercise configuration
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
  const [showExerciseConfigModal, setShowExerciseConfigModal] = useState(false);
  const [configExerciseName, setConfigExerciseName] = useState('');
  const [configSets, setConfigSets] = useState('3');
  const [configReps, setConfigReps] = useState('10');
  const [configWeight, setConfigWeight] = useState('0');
  const [configRestTime, setConfigRestTime] = useState('60');
  /** 'reps' = sets × reps logging; 'timed' = timed hold(s). */
  const [configLoggingMode, setConfigLoggingMode] = useState<'reps' | 'timed'>('reps');
  const [configDurationSeconds, setConfigDurationSeconds] = useState('45');
  /** Exercise ids selected for creating / ungrouping a superset. */
  const [supersetPickIds, setSupersetPickIds] = useState<string[]>([]);
  const [showMoreCommonExercises, setShowMoreCommonExercises] = useState(false);

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
    setScheduleMode(editable.scheduleMode);
    setFlexibleDayCount(editable.flexibleDayCount);
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

  const updateCurrentDayWorkoutName = useCallback(
    (name: string) => {
      if (currentWeekIndex < 0 || currentDayIndex < 0) return;
      setProgramWeeks((prev) => {
        const next = [...prev];
        const days = [...next[currentWeekIndex].dayWorkouts];
        days[currentDayIndex] = { ...days[currentDayIndex], workoutName: name };
        next[currentWeekIndex] = { ...next[currentWeekIndex], dayWorkouts: days };
        return next;
      });
    },
    [currentWeekIndex, currentDayIndex]
  );

  const filteredExercises = useMemo(() => {
    const q = deferredExerciseSearchQuery.trim().toLowerCase();
    const matched = q
      ? exerciseDatabase.filter((ex) => ex.name.toLowerCase().includes(q))
      : exerciseDatabase;
    if (q) return matched.slice(0, 120);
    return matched.slice(0, showMoreCommonExercises ? 60 : 8);
  }, [deferredExerciseSearchQuery, showMoreCommonExercises]);

  const exerciseSearchActive = deferredExerciseSearchQuery.trim().length > 0;
  const commonExercisesTotal = useMemo(() => {
    if (exerciseSearchActive) return filteredExercises.length;
    return Math.min(60, exerciseDatabase.length);
  }, [exerciseSearchActive, filteredExercises.length]);

  const selectedExerciseNames = useMemo(
    () => new Set(currentDayExercises.map((ex) => ex.name)),
    [currentDayExercises]
  );

  /** Single source write for the day's exercise list (avoids double setState). */
  const commitDayExercises = useCallback(
    (updated: CustomExercise[]) => {
      const cleaned = cleanupSingletonSupersets(updated);
      setCurrentDayExercises(cleaned);
      setSupersetPickIds((prev) => prev.filter((id) => cleaned.some((ex) => ex.id === id)));
      if (currentWeekIndex < 0 || currentDayIndex < 0) return;
      setProgramWeeks((prev) => {
        const next = [...prev];
        const week = next[currentWeekIndex];
        if (!week) return prev;
        const days = [...week.dayWorkouts];
        days[currentDayIndex] = { ...days[currentDayIndex], exercises: cleaned };
        next[currentWeekIndex] = { ...week, dayWorkouts: days };
        return next;
      });
    },
    [currentWeekIndex, currentDayIndex]
  );

  const handleToggleDay = (day: string) => {
    if (trainingDays.includes(day)) {
      setTrainingDays(trainingDays.filter(d => d !== day));
    } else {
      setTrainingDays([...trainingDays, day]);
    }
  };

  const step1Ready =
    Boolean(workoutName.trim()) &&
    (scheduleMode === 'weekly_split'
      ? trainingDays.length > 0
      : flexibleDayCount >= 1);

  const selectScheduleMode = (mode: CustomPlanScheduleMode) => {
    setScheduleMode(mode);
    if (mode === 'flexible_days') {
      setNumWeeks(1);
      syncWeekNamesFromCount(1);
    }
  };

  const applyScannedProgram = useCallback((editable: EditableSavedProgram) => {
    setWorkoutName(editable.workoutName);
    setScheduleMode(editable.scheduleMode);
    setFlexibleDayCount(editable.flexibleDayCount);
    setTrainingDays(editable.trainingDays);
    setNumWeeks(editable.numWeeks);
    setWeekNames(editable.weekNames);
    setProgramWeeks(editable.programWeeks);
    setCurrentWeekIndex(-1);
    setCurrentDayIndex(-2);
    setCurrentDayExercises([]);
    setSupersetPickIds([]);
    setExerciseSearchQuery('');
  }, []);

  const handleStartBuildingDays = () => {
    if (!workoutName.trim()) {
      Alert.alert('Error', 'Please enter a program name');
      return;
    }

    const resolvedTrainingDays =
      scheduleMode === 'flexible_days'
        ? createFlexibleTrainingDays(flexibleDayCount)
        : sortWeeklyTrainingDays(trainingDays);

    if (resolvedTrainingDays.length === 0) {
      Alert.alert(
        'Error',
        scheduleMode === 'flexible_days'
          ? 'Choose at least one training day in your rotation'
          : 'Please select at least one training day'
      );
      return;
    }

    setTrainingDays(resolvedTrainingDays);
    const effectiveWeeks = scheduleMode === 'flexible_days' ? 1 : numWeeks;
    const weeks = createInitialProgramWeeks(effectiveWeeks, resolvedTrainingDays, weekNames);
    setProgramWeeks(weeks);
    setCurrentWeekIndex(0);
    setCurrentDayIndex(0);
    setCurrentDayExercises([]);
    setExerciseSearchQuery('');
    setDayNameDraft(weeks[0]?.dayWorkouts[0]?.workoutName ?? '');
  };

  const handleAddExerciseToCurrentDay = useCallback(
    (exerciseName: string) => {
      const newExercise: CustomExercise = {
        id: `exercise-${Date.now()}-${Math.random()}`,
        name: exerciseName,
        sets: '3',
        reps: '10',
        weight: 0,
        restTime: 60,
      };
      commitDayExercises([...currentDayExercises, newExercise]);
    },
    [commitDayExercises, currentDayExercises]
  );

  const handleAddCustomExercise = () => {
    if (!customExerciseName.trim()) {
      Alert.alert('Error', 'Please enter an exercise name');
      return;
    }
    handleAddExerciseToCurrentDay(customExerciseName);
    setCustomExerciseName('');
    setShowCustomExerciseInput(false);
  };

  const handleRemoveExercise = useCallback(
    (exerciseId: string) => {
      commitDayExercises(currentDayExercises.filter((ex) => ex.id !== exerciseId));
    },
    [commitDayExercises, currentDayExercises]
  );

  const handleToggleLibraryExercise = useCallback(
    (exerciseName: string) => {
      const existing = currentDayExercises.find((ex) => ex.name === exerciseName);
      if (existing) {
        commitDayExercises(currentDayExercises.filter((ex) => ex.id !== existing.id));
      } else {
        const newExercise: CustomExercise = {
          id: `exercise-${Date.now()}-${Math.random()}`,
          name: exerciseName,
          sets: '3',
          reps: '10',
          weight: 0,
          restTime: 60,
        };
        commitDayExercises([...currentDayExercises, newExercise]);
      }
    },
    [commitDayExercises, currentDayExercises]
  );

  const handleReorderExercises = useCallback(
    (data: CustomExercise[]) => {
      commitDayExercises(normalizeSupersetContiguity(data));
    },
    [commitDayExercises]
  );

  const toggleSupersetPick = useCallback((exerciseId: string) => {
    setSupersetPickIds((prev) =>
      prev.includes(exerciseId) ? prev.filter((id) => id !== exerciseId) : [...prev, exerciseId]
    );
  }, []);

  const handleCreateSuperset = useCallback(() => {
    if (supersetPickIds.length < 2) {
      Alert.alert('Superset', 'Select at least 2 exercises to group into a superset.');
      return;
    }
    commitDayExercises(groupExercisesAsSuperset(currentDayExercises, supersetPickIds));
    setSupersetPickIds([]);
  }, [commitDayExercises, currentDayExercises, supersetPickIds]);

  const handleUngroupSuperset = useCallback(() => {
    if (supersetPickIds.length === 0) {
      Alert.alert('Superset', 'Select exercises in a superset to ungroup.');
      return;
    }
    commitDayExercises(ungroupExercises(currentDayExercises, supersetPickIds));
    setSupersetPickIds([]);
  }, [commitDayExercises, currentDayExercises, supersetPickIds]);

  const handleOpenExerciseConfig = useCallback(
    (index: number) => {
      const exercise = currentDayExercises[index];
      if (!exercise) return;
      setEditingExerciseIndex(index);
      setConfigExerciseName(exercise.name);
      setConfigSets(exercise.sets);
      setConfigReps(exercise.reps);
      setConfigWeight(exercise.weight.toString());
      setConfigRestTime(exercise.restTime.toString());
      const timed = (exercise.durationSeconds ?? 0) > 0;
      setConfigLoggingMode(timed ? 'timed' : 'reps');
      setConfigDurationSeconds(String(timed ? exercise.durationSeconds : 45));
      setShowExerciseConfigModal(true);
    },
    [currentDayExercises]
  );

  const handleSaveExerciseConfig = () => {
    if (editingExerciseIndex === null) return;

    const setsPattern = /^(\d+(-\d+)?)$/;
    const repsPattern = /^(\d+(-\d+)?)$/;
    const restTime = parseInt(configRestTime, 10) || 60;

    if (configLoggingMode === 'timed') {
      const duration = parseInt(configDurationSeconds.trim(), 10);
      if (!Number.isFinite(duration) || duration < 5 || duration > 600) {
        Alert.alert('Invalid Duration', 'Enter a time between 5 and 600 seconds.');
        return;
      }
      if (!setsPattern.test(configSets.trim())) {
        Alert.alert('Invalid Format', 'Rounds must be a number (e.g., "1" or "3") or range (e.g., "2-3")');
        return;
      }
      const updatedExercises = [...currentDayExercises];
      updatedExercises[editingExerciseIndex] = {
        ...updatedExercises[editingExerciseIndex],
        sets: configSets.trim(),
        reps: String(duration),
        weight: 0,
        restTime,
        durationSeconds: duration,
      };
      commitDayExercises(updatedExercises);
      setShowExerciseConfigModal(false);
      setEditingExerciseIndex(null);
      return;
    }

    if (!setsPattern.test(configSets.trim())) {
      Alert.alert('Invalid Format', 'Sets must be a number (e.g., "4") or range (e.g., "4-6")');
      return;
    }

    if (!repsPattern.test(configReps.trim())) {
      Alert.alert('Invalid Format', 'Reps must be a number (e.g., "10") or range (e.g., "6-10")');
      return;
    }

    const weight = parseFloat(configWeight) || 0;
    const updatedExercises = [...currentDayExercises];
    const { durationSeconds: _removed, ...rest } = updatedExercises[editingExerciseIndex];
    updatedExercises[editingExerciseIndex] = {
      ...rest,
      sets: configSets.trim(),
      reps: configReps.trim(),
      weight,
      restTime,
    };
    commitDayExercises(updatedExercises);
    setShowExerciseConfigModal(false);
    setEditingExerciseIndex(null);
  };

  const supersetLetterByIndex = useMemo(
    () => buildSupersetLetterMap(currentDayExercises),
    [currentDayExercises]
  );

  const renderConfiguredExercise = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<CustomExercise>) => {
      const index = getIndex() ?? 0;
      const picked = supersetPickIds.includes(item.id);
      const tag = formatSupersetTag(
        supersetLetterByIndex.get(index),
        item.supersetOrder ?? (item.supersetId ? 0 : undefined)
      );
      return (
        <ScaleDecorator>
          <View
            style={[
              styles.selectedCompactRow,
              isActive && styles.selectedCompactRowActive,
              item.supersetId ? styles.selectedCompactRowSuperset : null,
              picked ? styles.selectedCompactRowPicked : null,
            ]}
          >
            <TouchableOpacity
              style={[styles.supersetPickHit, picked && styles.supersetPickHitOn]}
              onPress={() => toggleSupersetPick(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: picked }}
              accessibilityLabel={`Select ${item.name} for superset`}
            >
              <Text style={styles.supersetPickMark}>{picked ? '✓' : ''}</Text>
            </TouchableOpacity>
            <Pressable
              onLongPress={drag}
              delayLongPress={120}
              style={styles.dragHandleCompact}
              accessibilityRole="button"
              accessibilityLabel={`Reorder ${item.name}`}
              accessibilityHint="Hold and drag to change exercise order"
            >
              <Text style={styles.dragHandleCompactText}>☰</Text>
            </Pressable>
            <TouchableOpacity
              style={styles.selectedCompactMain}
              onPress={() => handleOpenExerciseConfig(index)}
              activeOpacity={0.75}
            >
              <Text style={styles.selectedCompactIndex}>
                {tag ?? String(index + 1)}
              </Text>
              <Text style={styles.selectedCompactName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.selectedCompactMeta}>
                {(item.durationSeconds ?? 0) > 0
                  ? `${item.sets}×${item.durationSeconds}s`
                  : `${item.sets}×${item.reps}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.selectedCompactRemoveBtn}
              onPress={() => handleRemoveExercise(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name}`}
            >
              <Text style={styles.selectedCompactRemove}>×</Text>
            </TouchableOpacity>
          </View>
        </ScaleDecorator>
      );
    },
    [
      handleOpenExerciseConfig,
      handleRemoveExercise,
      supersetPickIds,
      supersetLetterByIndex,
      toggleSupersetPick,
    ]
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
      workoutName: dayNameDraft.trim() || days[currentDayIndex].workoutName,
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
      setSupersetPickIds([]);
      setDayNameDraft(days[nextDay].workoutName || '');
      setExerciseSearchQuery('');
      setShowMoreCommonExercises(false);
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
      setSupersetPickIds([]);
      setDayNameDraft(copiedDays[0].workoutName || '');
      setExerciseSearchQuery('');
      setShowMoreCommonExercises(false);
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

  const openCopyToDaysModal = useCallback(() => {
    if (currentDayExercises.length === 0) {
      Alert.alert('Add exercises first', 'Build this workout, then copy it to other days.');
      return;
    }
    if (trainingDays.length < 2) {
      Alert.alert(
        'Only one workout',
        'Add more training days or workouts in rotation to copy this list elsewhere.'
      );
      return;
    }
    // Default: all other days in this week
    const defaults = trainingDays
      .map((_, i) => i)
      .filter((i) => i !== currentDayIndex);
    setCopyTargetDayIndexes(defaults);
    setCopyAlsoName(false);
    setCopyDaysModalVisible(true);
  }, [currentDayExercises.length, trainingDays, currentDayIndex]);

  const toggleCopyTargetDay = useCallback((dayIndex: number) => {
    setCopyTargetDayIndexes((prev) =>
      prev.includes(dayIndex) ? prev.filter((i) => i !== dayIndex) : [...prev, dayIndex].sort((a, b) => a - b)
    );
  }, []);

  const applyCopyToSelectedDays = useCallback(() => {
    if (copyTargetDayIndexes.length === 0) {
      Alert.alert('Pick at least one day', 'Select which day(s) should get these exercises.');
      return;
    }
    if (currentWeekIndex < 0 || currentDayExercises.length === 0) return;

    const sourceName = dayNameDraft.trim() || programWeeks[currentWeekIndex]?.dayWorkouts[currentDayIndex]?.workoutName;
    const targetsWithExisting = copyTargetDayIndexes.filter(
      (i) => (programWeeks[currentWeekIndex]?.dayWorkouts[i]?.exercises?.length ?? 0) > 0
    );

    const runCopy = () => {
      setProgramWeeks((prev) => {
        const next = [...prev];
        const week = next[currentWeekIndex];
        if (!week) return prev;
        const days = [...week.dayWorkouts];

        // Persist current day first
        days[currentDayIndex] = {
          ...days[currentDayIndex],
          exercises: [...currentDayExercises],
          workoutName:
            dayNameDraft.trim() || days[currentDayIndex].workoutName,
        };

        for (const targetIndex of copyTargetDayIndexes) {
          if (targetIndex === currentDayIndex) continue;
          if (!days[targetIndex]) continue;
          days[targetIndex] = {
            ...days[targetIndex],
            exercises: cloneCustomExercises(currentDayExercises),
            ...(copyAlsoName && sourceName
              ? { workoutName: sourceName }
              : {}),
            completed: false,
          };
        }

        next[currentWeekIndex] = { ...week, dayWorkouts: days, completed: false };
        return next;
      });
      setCopyDaysModalVisible(false);
      const labels = copyTargetDayIndexes
        .map((i) => trainingDays[i])
        .filter(Boolean)
        .join(', ');
      Alert.alert(
        'Copied',
        `Exercises copied to ${labels}. You can still tweak sets and reps on each day.`
      );
    };

    if (targetsWithExisting.length > 0) {
      Alert.alert(
        'Replace exercises?',
        `Some selected days already have exercises. Copying will replace them.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: runCopy },
        ]
      );
      return;
    }
    runCopy();
  }, [
    copyTargetDayIndexes,
    currentWeekIndex,
    currentDayIndex,
    currentDayExercises,
    dayNameDraft,
    programWeeks,
    copyAlsoName,
    trainingDays,
  ]);

  const handleBackToDay = (weekIndex: number, dayIndex: number) => {
    setCurrentWeekIndex(weekIndex);
    setCurrentDayIndex(dayIndex);
    setCurrentDayExercises([...programWeeks[weekIndex].dayWorkouts[dayIndex].exercises]);
    setSupersetPickIds([]);
    setDayNameDraft(programWeeks[weekIndex].dayWorkouts[dayIndex].workoutName || '');
    setExerciseSearchQuery('');
    setShowMoreCommonExercises(false);
  };

  const handleReorderReviewExercises = useCallback(
    (weekIndex: number, dayIndex: number, data: CustomExercise[]) => {
      setProgramWeeks((prev) => {
        const next = [...prev];
        const days = [...next[weekIndex].dayWorkouts];
        days[dayIndex] = {
          ...days[dayIndex],
          exercises: normalizeSupersetContiguity(data),
        };
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
        setsPrescription: ex.sets.trim(),
        repsPrescription: ex.reps.trim(),
        weight: ex.weight,
        restTime: ex.restTime,
        category: 'strength' as const,
        ...(ex.durationSeconds != null && ex.durationSeconds > 0
          ? { durationSeconds: ex.durationSeconds }
          : {}),
        ...(ex.supersetId
          ? { supersetId: ex.supersetId, supersetOrder: ex.supersetOrder ?? 0 }
          : {}),
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

    startActiveWorkout({
      program,
      onSessionComplete: async () => {
        if (onWorkoutComplete) {
          onWorkoutComplete();
        }
      },
    });
  };

  const handleDeleteProgram = () => {
    if (!editingPlanId) return;
    Alert.alert(
      'Delete Program',
      'Are you sure you want to delete this workout plan? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSavedWorkoutPlan(editingPlanId);
              onPlanDeleted?.(editingPlanId);
            } catch (error) {
              console.error('Error deleting plan:', error);
              Alert.alert('Error', 'Failed to delete workout plan. Please try again.');
            }
          },
        },
      ]
    );
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
      weekDays: dayWorkoutsToSavedWeekDays(week.dayWorkouts, workoutName, scheduleMode),
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
      scheduleMode,
      flexibleDayCount:
        scheduleMode === 'flexible_days' ? trainingDays.length : flexibleDayCount,
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
          {isEditMode ? (
            <TouchableOpacity
              style={styles.headerDeleteBtn}
              onPress={handleDeleteProgram}
              accessibilityRole="button"
              accessibilityLabel="Delete program"
            >
              <Text style={styles.headerDeleteBtnText}>Delete</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {!isEditMode ? (
            <View style={styles.section}>
              <Text style={styles.label}>Scan a workout</Text>
              <Text style={styles.hint}>
                Photograph a spreadsheet, printed plan, or handwritten pen-and-paper log. AI extracts
                exercises, sets, and reps into this builder.
              </Text>
              <TouchableOpacity
                style={styles.scanSpreadsheetBtn}
                onPress={() => setScanSpreadsheetVisible(true)}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Scan workout from photo"
              >
                <Text style={styles.scanSpreadsheetBtnText}>Scan workout from photo</Text>
              </TouchableOpacity>
            </View>
          ) : null}

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
            <Text style={styles.label}>Schedule Type</Text>
            <Text style={styles.hint}>
              Weekly split ties workouts to calendar days. Flexible days lets you rotate through workouts and rest when you need.
            </Text>
            <View style={styles.scheduleModeRow}>
              <TouchableOpacity
                style={[
                  styles.scheduleModeButton,
                  scheduleMode === 'weekly_split' && styles.scheduleModeButtonSelected,
                ]}
                onPress={() => selectScheduleMode('weekly_split')}
              >
                <Text
                  style={[
                    styles.scheduleModeButtonTitle,
                    scheduleMode === 'weekly_split' && styles.scheduleModeButtonTitleSelected,
                  ]}
                >
                  Weekly split
                </Text>
                <Text style={styles.scheduleModeButtonHint}>Mon, Wed, Fri…</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.scheduleModeButton,
                  scheduleMode === 'flexible_days' && styles.scheduleModeButtonSelected,
                ]}
                onPress={() => selectScheduleMode('flexible_days')}
              >
                <Text
                  style={[
                    styles.scheduleModeButtonTitle,
                    scheduleMode === 'flexible_days' && styles.scheduleModeButtonTitleSelected,
                  ]}
                >
                  Flexible days
                </Text>
                <Text style={styles.scheduleModeButtonHint}>Rest when needed</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              {scheduleMode === 'weekly_split' ? 'Training Days' : 'Workouts in Rotation'}
            </Text>
            {scheduleMode === 'weekly_split' ? (
              <>
                <Text style={styles.hint}>Select the days you want to train each week</Text>
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
                    Selected: {sortWeeklyTrainingDays(trainingDays).join(', ')}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.hint}>
                  How many distinct workouts do you rotate through? Take rest days whenever you need — no fixed weekday required.
                </Text>
                <View style={styles.weekStepperRow}>
                  <TouchableOpacity
                    style={styles.weekStepperBtn}
                    onPress={() => setFlexibleDayCount((n) => Math.max(1, n - 1))}
                    disabled={flexibleDayCount <= 1}
                  >
                    <Text style={styles.weekStepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.weekStepperValue}>
                    {flexibleDayCount} {flexibleDayCount === 1 ? 'workout' : 'workouts'}
                  </Text>
                  <TouchableOpacity
                    style={styles.weekStepperBtn}
                    onPress={() => setFlexibleDayCount((n) => Math.min(7, n + 1))}
                    disabled={flexibleDayCount >= 7}
                  >
                    <Text style={styles.weekStepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.selectedDaysText}>
                  {createFlexibleTrainingDays(flexibleDayCount).join(', ')}
                </Text>
              </>
            )}
          </View>

          {scheduleMode === 'weekly_split' ? (
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
          ) : null}

          <TouchableOpacity
            style={[styles.nextButton, !step1Ready && styles.nextButtonDisabled]}
            onPress={handleStartBuildingDays}
            disabled={!step1Ready}
          >
            <Text style={styles.nextButtonText}>Next — Add Exercises</Text>
          </TouchableOpacity>
          {!step1Ready && (
            <Text style={styles.step1Hint}>
              {scheduleMode === 'weekly_split'
                ? 'Enter a program name and select at least one training day to continue.'
                : 'Enter a program name and choose how many workouts are in your rotation.'}
            </Text>
          )}
        </ScrollView>

        <ScanWorkoutSpreadsheetModal
          visible={scanSpreadsheetVisible}
          onClose={() => setScanSpreadsheetVisible(false)}
          onApply={applyScannedProgram}
        />
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
              workoutName: dayNameDraft.trim() || days[currentDayIndex].workoutName,
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
              setDayNameDraft(days[prev].workoutName || '');
            } else if (currentWeekIndex > 0) {
              const prevWeek = currentWeekIndex - 1;
              const prevDays = updatedWeeks[prevWeek].dayWorkouts;
              const lastDay = trainingDays.length - 1;
              setCurrentWeekIndex(prevWeek);
              setCurrentDayIndex(lastDay);
              setCurrentDayExercises([...prevDays[lastDay].exercises]);
              setDayNameDraft(prevDays[lastDay].workoutName || '');
            } else {
              setCurrentWeekIndex(-1);
              setCurrentDayIndex(-1);
              setCurrentDayExercises([]);
              setDayNameDraft('');
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
            Week {currentWeekIndex + 1} of {programWeeks.length} •{' '}
            {scheduleMode === 'flexible_days' ? currentDay : `Day ${currentDayIndex + 1}`} ·{' '}
            {currentDayIndex + 1} of {trainingDays.length}
          </Text>
          <View style={styles.workoutNameEditRow}>
            <Text style={styles.workoutNameEditLabel}>Workout name</Text>
            <TextInput
              style={styles.workoutNameEditInput}
              value={dayNameDraft}
              onChangeText={setDayNameDraft}
              onBlur={() => updateCurrentDayWorkoutName(dayNameDraft.trim() || currentDayPlan.workoutName)}
              onFocus={() => {
                if (!dayNameDraft) setDayNameDraft(currentDayPlan.workoutName || '');
              }}
              placeholder={`${currentDay} workout`}
              placeholderTextColor="#666"
            />
            <TouchableOpacity
              style={styles.inlineEditBtn}
              onPress={() =>
                openRenameModal(
                  { kind: 'workout', weekIndex: currentWeekIndex, dayIndex: currentDayIndex },
                  dayNameDraft || currentDayPlan.workoutName
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
          <NestableScrollContainer
            style={styles.buildDayScroll}
            contentContainerStyle={styles.buildDayScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator
          >
            <View style={styles.libraryChrome}>
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
                  onChangeText={(text) => {
                    setExerciseSearchQuery(text);
                    if (text.trim()) setShowMoreCommonExercises(false);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  spellCheck={false}
                  textContentType="none"
                  clearButtonMode="while-editing"
                  onSubmitEditing={() => {
                    const q = exerciseSearchQuery.trim();
                    if (q && filteredExercises.length === 0 && !selectedExerciseNames.has(q)) {
                      handleAddExerciseToCurrentDay(q);
                      setExerciseSearchQuery('');
                    }
                  }}
                />
                {exerciseSearchQuery.trim() &&
                  filteredExercises.length === 0 &&
                  !selectedExerciseNames.has(exerciseSearchQuery.trim()) && (
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
            </View>

            <View style={styles.buildDaySelectedBlock}>
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

              {currentDayExercises.length > 0 && (
                <View style={styles.selectedExercisesPanel}>
                  <View style={styles.selectedExercisesHeader}>
                    <Text style={styles.selectedExercisesTitle}>
                      Selected ({currentDayExercises.length})
                    </Text>
                    <Text style={styles.selectedExercisesHint}>
                      Check 2+ · Superset · tap name to configure · ☰ reorder
                    </Text>
                  </View>
                  {supersetPickIds.length > 0 ? (
                    <View style={styles.supersetActionsRow}>
                      <TouchableOpacity
                        style={[
                          styles.supersetActionBtn,
                          supersetPickIds.length < 2 && styles.supersetActionBtnDisabled,
                        ]}
                        onPress={handleCreateSuperset}
                        disabled={supersetPickIds.length < 2}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.supersetActionBtnText}>
                          Create superset ({supersetPickIds.length})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.supersetActionBtnSecondary}
                        onPress={handleUngroupSuperset}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.supersetActionBtnSecondaryText}>Ungroup</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setSupersetPickIds([])}
                        hitSlop={10}
                      >
                        <Text style={styles.supersetClearPick}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  <NestableDraggableFlatList
                    data={currentDayExercises}
                    keyExtractor={(item) => item.id}
                    onDragEnd={({ data }) => handleReorderExercises(data)}
                    renderItem={renderConfiguredExercise}
                    scrollEnabled={false}
                    activationDistance={12}
                  />
                </View>
              )}

              {currentDayExercises.length > 0 && trainingDays.length > 1 ? (
                <TouchableOpacity
                  style={styles.copyToDaysButton}
                  onPress={openCopyToDaysModal}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Copy exercises to other days"
                >
                  <Text style={styles.copyToDaysButtonText}>Copy to day(s)…</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.completeDayButton,
                  currentDayExercises.length === 0 && styles.completeDayButtonDisabled,
                ]}
                onPress={() => {
                  if (dayNameDraft.trim()) {
                    updateCurrentDayWorkoutName(dayNameDraft.trim());
                  }
                  handleCompleteCurrentDay();
                }}
                disabled={currentDayExercises.length === 0}
              >
                <Text style={styles.completeDayButtonText}>
                  {currentDayIndex < trainingDays.length - 1
                    ? `Complete ${dayNameDraft || currentDayPlan.workoutName || currentDay} & continue`
                    : currentWeekIndex < programWeeks.length - 1
                      ? `Finish week — start ${programWeeks[currentWeekIndex + 1]?.name || 'next week'}`
                      : 'Finish & review program'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.exerciseBrowseSection}>
              <Text style={styles.exerciseBrowseSectionTitle}>
                {exerciseSearchActive ? 'Search results' : 'Common exercises'}
              </Text>
              {!exerciseSearchActive && (
                <Text style={styles.exerciseBrowseHint}>
                  Showing {filteredExercises.length} of {commonExercisesTotal} — type to search the full library
                </Text>
              )}

              <View style={styles.exerciseListEmbedded}>
                {filteredExercises.length === 0 ? (
                  <Text style={styles.exerciseBrowseHint}>No matches — add as custom above</Text>
                ) : (
                  filteredExercises.map((item) => (
                    <ExerciseLibraryRow
                      key={item.name}
                      name={item.name}
                      selected={selectedExerciseNames.has(item.name)}
                      onToggle={handleToggleLibraryExercise}
                    />
                  ))
                )}
              </View>

              {!exerciseSearchActive && filteredExercises.length < commonExercisesTotal ? (
                <TouchableOpacity
                  style={styles.showMoreExercisesBtn}
                  onPress={() => setShowMoreCommonExercises(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.showMoreExercisesBtnText}>
                    Show more common exercises
                  </Text>
                </TouchableOpacity>
              ) : null}
              {!exerciseSearchActive && showMoreCommonExercises ? (
                <TouchableOpacity
                  style={styles.showMoreExercisesBtn}
                  onPress={() => setShowMoreCommonExercises(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.showMoreExercisesBtnText}>Show fewer</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </NestableScrollContainer>
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

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Logging type</Text>
                  <Text style={styles.modalHint}>
                    Choose sets & reps for strength moves, or timed for planks, holds, and carries.
                  </Text>
                  <View style={styles.loggingModeRow}>
                    <TouchableOpacity
                      style={[
                        styles.loggingModeChip,
                        configLoggingMode === 'reps' && styles.loggingModeChipOn,
                      ]}
                      onPress={() => setConfigLoggingMode('reps')}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.loggingModeChipText,
                          configLoggingMode === 'reps' && styles.loggingModeChipTextOn,
                        ]}
                      >
                        Sets & reps
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.loggingModeChip,
                        configLoggingMode === 'timed' && styles.loggingModeChipOn,
                      ]}
                      onPress={() => setConfigLoggingMode('timed')}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.loggingModeChipText,
                          configLoggingMode === 'timed' && styles.loggingModeChipTextOn,
                        ]}
                      >
                        Timed
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {configLoggingMode === 'timed' ? (
                  <View style={styles.modalRow}>
                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Rounds</Text>
                      <Text style={styles.modalHint}>e.g., 1 or 3</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="1"
                        placeholderTextColor="#666"
                        keyboardType="default"
                        value={configSets}
                        onChangeText={setConfigSets}
                      />
                    </View>
                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Seconds</Text>
                      <Text style={styles.modalHint}>hold / work time</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="45"
                        placeholderTextColor="#666"
                        keyboardType="number-pad"
                        value={configDurationSeconds}
                        onChangeText={setConfigDurationSeconds}
                      />
                    </View>
                  </View>
                ) : (
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
                )}

                <View style={styles.modalRow}>
                  {configLoggingMode === 'reps' ? (
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
                  ) : null}
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

        <Modal
          visible={copyDaysModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCopyDaysModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.copyDaysModalCard}>
              <Text style={styles.modalTitle}>Copy to day(s)</Text>
              <Text style={styles.copyDaysIntro}>
                Copy the {currentDayExercises.length} exercise
                {currentDayExercises.length === 1 ? '' : 's'} from{' '}
                {trainingDays[currentDayIndex] || 'this workout'} onto the days you select.
                Existing exercises on those days will be replaced.
              </Text>

              <View style={styles.copyDaysSelectRow}>
                <TouchableOpacity
                  onPress={() =>
                    setCopyTargetDayIndexes(
                      trainingDays.map((_, i) => i).filter((i) => i !== currentDayIndex)
                    )
                  }
                  hitSlop={8}
                >
                  <Text style={styles.copyDaysSelectLink}>Select all</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCopyTargetDayIndexes([])} hitSlop={8}>
                  <Text style={styles.copyDaysSelectLink}>Clear</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.copyDaysList}>
                {trainingDays.map((label, index) => {
                  if (index === currentDayIndex) {
                    return (
                      <View key={`copy-src-${label}`} style={[styles.copyDayRow, styles.copyDayRowDisabled]}>
                        <Text style={styles.copyDayLabel}>{label}</Text>
                        <Text style={styles.copyDayMeta}>Source</Text>
                      </View>
                    );
                  }
                  const selected = copyTargetDayIndexes.includes(index);
                  const existingCount =
                    programWeeks[currentWeekIndex]?.dayWorkouts[index]?.exercises?.length ?? 0;
                  return (
                    <TouchableOpacity
                      key={`copy-tgt-${label}`}
                      style={[styles.copyDayRow, selected && styles.copyDayRowSelected]}
                      onPress={() => toggleCopyTargetDay(index)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.copyDayCheck, selected && styles.copyDayCheckOn]}>
                        {selected ? <Text style={styles.copyDayCheckMark}>✓</Text> : null}
                      </View>
                      <View style={styles.copyDayTextCol}>
                        <Text
                          style={[styles.copyDayLabel, selected && styles.copyDayLabelSelected]}
                        >
                          {label}
                        </Text>
                        {existingCount > 0 ? (
                          <Text style={styles.copyDayMeta}>
                            {existingCount} exercise{existingCount === 1 ? '' : 's'} (will replace)
                          </Text>
                        ) : (
                          <Text style={styles.copyDayMeta}>Empty</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.copyAlsoNameRow, copyAlsoName && styles.copyAlsoNameRowOn]}
                onPress={() => setCopyAlsoName((v) => !v)}
                activeOpacity={0.85}
              >
                <View style={[styles.copyDayCheck, copyAlsoName && styles.copyDayCheckOn]}>
                  {copyAlsoName ? <Text style={styles.copyDayCheckMark}>✓</Text> : null}
                </View>
                <Text style={styles.copyAlsoNameText}>Also copy workout name</Text>
              </TouchableOpacity>

              <View style={styles.copyDaysActions}>
                <TouchableOpacity
                  style={styles.copyDaysCancelBtn}
                  onPress={() => setCopyDaysModalVisible(false)}
                >
                  <Text style={styles.copyDaysCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.copyDaysConfirmBtn,
                    copyTargetDayIndexes.length === 0 && styles.copyDaysConfirmBtnDisabled,
                  ]}
                  onPress={applyCopyToSelectedDays}
                  disabled={copyTargetDayIndexes.length === 0}
                >
                  <Text style={styles.copyDaysConfirmText}>
                    Copy to {copyTargetDayIndexes.length || '…'} day
                    {copyTargetDayIndexes.length === 1 ? '' : 's'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
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
        {isEditMode ? (
          <TouchableOpacity
            style={styles.headerDeleteBtn}
            onPress={handleDeleteProgram}
            accessibilityRole="button"
            accessibilityLabel="Delete program"
          >
            <Text style={styles.headerDeleteBtnText}>Delete</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <NestableScrollContainer
        style={styles.scrollView}
        contentContainerStyle={styles.reviewScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
            {scheduleModeDescription(scheduleMode, trainingDays.length)}
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
                  <NestableDraggableFlatList
                    scrollEnabled={false}
                    data={dayWorkout.exercises}
                    keyExtractor={(item) => item.id}
                    onDragEnd={({ data }) =>
                      handleReorderReviewExercises(weekIndex, dayIndex, data)
                    }
                    renderItem={({ item, drag, isActive, getIndex }) => {
                      const exIndex = getIndex() ?? 0;
                      const letters = buildSupersetLetterMap(dayWorkout.exercises);
                      const tag = formatSupersetTag(
                        letters.get(exIndex),
                        item.supersetOrder ?? (item.supersetId ? 0 : undefined)
                      );
                      return (
                        <ScaleDecorator>
                          <View
                            style={[
                              styles.reviewExerciseItem,
                              isActive && styles.reviewExerciseItemActive,
                              item.supersetId ? styles.reviewExerciseItemSuperset : null,
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
                                {tag ? `${tag} · ` : `${exIndex + 1}. `}{item.name}
                              </Text>
                              <Text style={styles.reviewExerciseDetails}>
                                {(item.durationSeconds ?? 0) > 0
                                  ? `${item.sets} × ${item.durationSeconds}s`
                                  : `${item.sets} sets × ${item.reps} reps`}
                                {item.weight > 0 && ` @ ${item.weight} lbs`}
                                {' • '}{item.restTime}s rest
                                {item.supersetId ? ' • alternate sets' : ''}
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
            {isEditMode ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteProgramButton]}
                onPress={handleDeleteProgram}
                accessibilityRole="button"
                accessibilityLabel="Delete program"
              >
                <Text style={styles.deleteProgramButtonText}>Delete Program</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </NestableScrollContainer>
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
    paddingBottom: 28,
    flexGrow: 1,
  },
  libraryChrome: {
    paddingBottom: 8,
  },
  buildDaySelectedBlock: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  exerciseBrowseSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  exerciseBrowseSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppTheme.textSecondary,
    marginBottom: 4,
  },
  exerciseListEmbedded: {
    marginBottom: 8,
  },
  showMoreExercisesBtn: {
    marginTop: 2,
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  showMoreExercisesBtnText: {
    color: AppTheme.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  selectedExercisesPanel: {
    marginTop: 2,
    marginBottom: 6,
  },
  selectedExercisesHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  selectedExercisesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppTheme.textSecondary,
  },
  selectedExercisesHint: {
    flex: 1,
    textAlign: 'right',
    fontSize: 11,
    color: AppTheme.textFaint,
  },
  reviewScrollContent: {
    paddingBottom: 32,
  },
  selectedCompactRow: {
    height: 40,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppTheme.border,
    paddingRight: 6,
  },
  selectedCompactRowActive: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  selectedCompactRowSuperset: {
    borderColor: 'rgba(0,255,136,0.35)',
    backgroundColor: 'rgba(0,255,136,0.05)',
  },
  selectedCompactRowPicked: {
    borderColor: AppTheme.accent,
  },
  supersetPickHit: {
    width: 28,
    height: 28,
    marginLeft: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  supersetPickHitOn: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0,255,136,0.15)',
  },
  supersetPickMark: {
    color: AppTheme.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  supersetActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  supersetActionBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  supersetActionBtnDisabled: {
    opacity: 0.4,
  },
  supersetActionBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 12,
  },
  supersetActionBtnSecondary: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#555',
  },
  supersetActionBtnSecondaryText: {
    color: '#ddd',
    fontWeight: '700',
    fontSize: 12,
  },
  supersetClearPick: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  dragHandleCompact: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  dragHandleCompactText: {
    color: '#777',
    fontSize: 14,
    lineHeight: 16,
  },
  selectedCompactMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    minWidth: 0,
  },
  selectedCompactIndex: {
    width: 22,
    fontSize: 12,
    fontWeight: '700',
    color: AppTheme.accent,
  },
  selectedCompactName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textPrimary,
    minWidth: 0,
  },
  selectedCompactMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: AppTheme.textMuted,
    marginRight: 4,
  },
  selectedCompactRemoveBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCompactRemove: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
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
    marginTop: 2,
    marginBottom: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  addCustomExerciseBtnText: {
    color: AppTheme.accent,
    fontSize: 13,
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
  scanSpreadsheetBtn: {
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
    borderWidth: 1,
    borderColor: AppTheme.accent,
    borderRadius: AppTheme.radiusButton,
    paddingVertical: 14,
    alignItems: 'center',
  },
  scanSpreadsheetBtnText: {
    color: AppTheme.accent,
    fontSize: 15,
    fontWeight: '700',
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
  scheduleModeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scheduleModeButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  scheduleModeButtonSelected: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderColor: '#4ADE80',
  },
  scheduleModeButtonTitle: {
    color: AppTheme.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  scheduleModeButtonTitleSelected: {
    color: '#4ADE80',
  },
  scheduleModeButtonHint: {
    color: AppTheme.textMuted,
    fontSize: 12,
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
  exerciseItem: {
    height: EXERCISE_ROW_HEIGHT - 8,
    marginBottom: 8,
    backgroundColor: '#121212',
    borderRadius: 8,
    paddingHorizontal: 15,
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  completeDayButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  completeDayButtonText: {
    color: '#0f2517',
    fontSize: 14,
    fontWeight: 'bold',
  },
  copyToDaysButton: {
    borderWidth: 1,
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  copyToDaysButtonText: {
    color: AppTheme.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  copyDaysModalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 18,
    width: '100%',
    maxWidth: 420,
    maxHeight: '86%',
  },
  copyDaysIntro: {
    color: AppTheme.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  copyDaysSelectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  copyDaysSelectLink: {
    color: AppTheme.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  copyDaysList: {
    gap: 8,
    marginBottom: 12,
  },
  copyDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: '#121212',
  },
  copyDayRowSelected: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
  },
  copyDayRowDisabled: {
    opacity: 0.55,
  },
  copyDayCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyDayCheckOn: {
    borderColor: AppTheme.accent,
    backgroundColor: AppTheme.accent,
  },
  copyDayCheckMark: {
    color: '#0a0a0a',
    fontSize: 13,
    fontWeight: '800',
  },
  copyDayTextCol: {
    flex: 1,
  },
  copyDayLabel: {
    color: AppTheme.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  copyDayLabelSelected: {
    color: AppTheme.accent,
  },
  copyDayMeta: {
    color: AppTheme.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  copyAlsoNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    marginBottom: 14,
  },
  copyAlsoNameRowOn: {},
  copyAlsoNameText: {
    color: AppTheme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  copyDaysActions: {
    flexDirection: 'row',
    gap: 10,
  },
  copyDaysCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
  },
  copyDaysCancelText: {
    color: AppTheme.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  copyDaysConfirmBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: AppTheme.accent,
    alignItems: 'center',
  },
  copyDaysConfirmBtnDisabled: {
    opacity: 0.4,
  },
  copyDaysConfirmText: {
    color: AppTheme.accentDark,
    fontSize: 14,
    fontWeight: '800',
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
  reviewExerciseItemSuperset: {
    borderLeftWidth: 3,
    borderLeftColor: AppTheme.accent,
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
  deleteProgramButton: {
    marginTop: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  deleteProgramButtonText: {
    color: '#ff6666',
    fontSize: 16,
    fontWeight: '700',
  },
  headerDeleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  headerDeleteBtnText: {
    color: '#ff6666',
    fontSize: 13,
    fontWeight: '700',
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
  loggingModeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  loggingModeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: '#121212',
    alignItems: 'center',
  },
  loggingModeChipOn: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0,255,136,0.1)',
  },
  loggingModeChipText: {
    color: AppTheme.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  loggingModeChipTextOn: {
    color: AppTheme.accent,
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

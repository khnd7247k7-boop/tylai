import React, { useState, useEffect, useCallback, useDeferredValue, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { AppTextInput as TextInput } from './src/components/AppTextInput';
import { DateTimeWheelPicker } from './src/components/DateTimeWheelPicker';
import { StatusBar } from 'expo-status-bar';
import { WorkoutSession } from './data/workoutPrograms';
import { saveUserData, loadUserData } from './src/utils/userStorage';
import { exerciseDatabase, type ExerciseData } from './src/data/exerciseDatabase';
import {
  addUserCustomExercise,
  loadUserCustomExercises,
  resolveExerciseData,
} from './src/utils/userCustomExercises';
import {
  cascadeStringSetFieldToNext,
  plannedRepsInput,
  plannedWeightInput,
  resolveSetSlotCount,
} from './src/utils/setLoggingPrefill';
import { useSmallWins } from './src/context/SmallWinsContext';
import TrackCardioSection from './src/components/workout/TrackCardioSection';
import type { CardioLog } from './data/workoutPrograms';

interface LogPastWorkoutScreenProps {
  onBack: () => void;
  onComplete: (session: WorkoutSession) => void;
  /** past = previous session with date picker; daily = today's one-off session. */
  mode?: 'past' | 'daily';
  /** Called after the user opts to save a daily workout as a reusable program. */
  onProgramsChanged?: () => void;
}

interface ExerciseEntry {
  id: string;
  name: string;
  sets: Array<{
    setNumber: number;
    weight: string;
    reps: string;
    completed: boolean;
  }>;
}

function formatSetBrief(s: { weight: string; reps: string }): string {
  const w = s.weight.trim();
  const r = s.reps.trim();
  if (w && r) return `${w}×${r}`;
  if (w) return `${w} lb`;
  if (r) return `${r} reps`;
  return '—';
}

function exerciseTrackingSummary(ex: ExerciseEntry): string {
  const parts = ex.sets.map((s) => formatSetBrief(s));
  return `${ex.sets.length} set${ex.sets.length === 1 ? '' : 's'} · ${parts.join(', ')}`;
}

function formatDailyWorkoutTitle(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function LogPastWorkoutScreen({
  onBack,
  onComplete,
  mode = 'past',
  onProgramsChanged,
}: LogPastWorkoutScreenProps) {
  const isDaily = mode === 'daily';
  const { onWorkoutSessionSaved } = useSmallWins();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [workoutName, setWorkoutName] = useState(() =>
    mode === 'daily' ? formatDailyWorkoutTitle(new Date()) : ''
  );
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const deferredExerciseSearch = useDeferredValue(exerciseSearch);
  const [savedPlans, setSavedPlans] = useState<any[]>([]);
  /** Cloned snapshot for day-picker UI only — never written back to storage. */
  const [templatePlan, setTemplatePlan] = useState<any | null>(null);
  const [templatePlanId, setTemplatePlanId] = useState<string | null>(null);
  const [templatePlanName, setTemplatePlanName] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [customExercises, setCustomExercises] = useState<ExerciseData[]>([]);
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [customExerciseSaving, setCustomExerciseSaving] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(() => new Date());
  /** Remount wheel pickers each open so dials land on the preset date. */
  const [datePickerKey, setDatePickerKey] = useState(0);
  /** Manual adds default expanded; plan-loaded rows start collapsed until the user expands. */
  const [expandOverride, setExpandOverride] = useState<Record<string, boolean>>({});
  const [cardio, setCardio] = useState<CardioLog | null>(null);
  const cardioWindow = useMemo(() => {
    const center = selectedDate.getTime();
    return {
      start: new Date(center - 3 * 60 * 60 * 1000),
      end: new Date(center + 3 * 60 * 60 * 1000),
    };
  }, [selectedDate]);

  const isExerciseExpanded = useCallback(
    (ex: ExerciseEntry) => expandOverride[ex.id] !== false,
    [expandOverride]
  );

  const setAllExercisesExpanded = useCallback((expanded: boolean) => {
    setExpandOverride((prev) => {
      const next = { ...prev };
      for (const ex of exercises) {
        next[ex.id] = expanded;
      }
      return next;
    });
  }, [exercises]);

  const refreshCustomExercises = useCallback(async () => {
    try {
      const list = await loadUserCustomExercises();
      setCustomExercises(list);
    } catch (e) {
      console.error('loadUserCustomExercises', e);
    }
  }, []);

  useEffect(() => {
    loadSavedPlans();
    refreshCustomExercises();
  }, [refreshCustomExercises]);

  const loadSavedPlans = async () => {
    try {
      const plans = await loadUserData<any[]>('savedWorkoutPlans') || [];
      setSavedPlans(plans);
    } catch (error) {
      console.error('Error loading saved plans:', error);
    }
  };

  const openDateModal = () => {
    // Seed dials from the date shown in "When was this workout?" (defaults to today).
    const preset = new Date(selectedDate.getTime());
    setDraftDate(preset);
    setDatePickerKey((k) => k + 1);
    setShowDateModal(true);
  };

  const applyDraftDate = () => {
    setSelectedDate(new Date(draftDate.getTime()));
    setShowDateModal(false);
  };

  const renderExerciseCard = (item: ExerciseEntry) => {
    const expanded = isExerciseExpanded(item);
    return (
      <View key={item.id} style={styles.exerciseCard}>
        <View style={styles.exerciseHeader}>
          <View style={styles.exerciseHeaderTitleBlock}>
            <Text style={styles.exerciseName}>{item.name}</Text>
            {!expanded ? (
              <Text style={styles.exerciseCompactSummary} numberOfLines={2}>
                {exerciseTrackingSummary(item)}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.expandToggleBtn}
            onPress={() =>
              setExpandOverride((o) => ({
                ...o,
                [item.id]: !expanded,
              }))
            }
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Hide exercise details' : 'Show exercise sets and weights'}
          >
            <Text style={styles.expandToggleBtnText}>{expanded ? 'Hide details' : 'Show details'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveExercise(item.id)}
            accessibilityLabel={`Remove ${item.name}`}
          >
            <Text style={styles.removeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        {expanded ? (
          <>
            {item.sets.map((set) => (
              <View key={set.setNumber} style={styles.setRow}>
                <Text style={styles.setNumber}>Set {set.setNumber}</Text>
                <TextInput
                  style={styles.setInput}
                  placeholder="Weight"
                  value={set.weight}
                  onChangeText={(value) => handleSetChange(item.id, set.setNumber, 'weight', value)}
                  keyboardType="numeric"
                />
                <Text style={styles.setLabel}>lbs</Text>
                <TextInput
                  style={styles.setInput}
                  placeholder="Reps"
                  value={set.reps}
                  onChangeText={(value) => handleSetChange(item.id, set.setNumber, 'reps', value)}
                  keyboardType="numeric"
                />
                <Text style={styles.setLabel}>reps</Text>
                {item.sets.length > 1 ? (
                  <TouchableOpacity
                    style={styles.removeSetButton}
                    onPress={() => handleRemoveSet(item.id, set.setNumber)}
                  >
                    <Text style={styles.removeSetButtonText}>×</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
            <TouchableOpacity style={styles.addSetButton} onPress={() => handleAddSet(item.id)}>
              <Text style={styles.addSetButtonText}>+ Add Set</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    );
  };

  const searchResults = useMemo(() => {
    const query = deferredExerciseSearch.trim();
    if (!query) return [];
    const q = query.toLowerCase();
    const seen = new Set<string>();
    const names: string[] = [];
    for (const ex of exerciseDatabase) {
      if (ex.name.toLowerCase().includes(q) && !seen.has(ex.name.toLowerCase())) {
        seen.add(ex.name.toLowerCase());
        names.push(ex.name);
        if (names.length >= 10) break;
      }
    }
    if (names.length < 10) {
      for (const ex of customExercises) {
        if (ex.name.toLowerCase().includes(q) && !seen.has(ex.name.toLowerCase())) {
          seen.add(ex.name.toLowerCase());
          names.push(ex.name);
          if (names.length >= 10) break;
        }
      }
    }
    return names;
  }, [customExercises, deferredExerciseSearch]);

  const handleAddExercise = (exerciseName: string, catalogOverride?: ExerciseData[]) => {
    const catalog = catalogOverride ?? customExercises;
    const exerciseData = resolveExerciseData(exerciseName, catalog);
    if (!exerciseData) {
      Alert.alert('Exercise not found', 'Try search, or use “Add custom exercise” to save a new name.');
      return;
    }

    const newExercise: ExerciseEntry = {
      id: Date.now().toString(),
      name: exerciseData.name,
      sets: [
        { setNumber: 1, weight: '', reps: '', completed: false },
        { setNumber: 2, weight: '', reps: '', completed: false },
        { setNumber: 3, weight: '', reps: '', completed: false },
      ],
    };

    setExercises((prev) => [...prev, newExercise]);
    setExpandOverride((o) => ({ ...o, [newExercise.id]: true }));
    setExerciseSearch('');
  };

  const handleSaveCustomExerciseToLibrary = async () => {
    const name = customExerciseName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter an exercise name.');
      return;
    }
    const dupBuiltin = exerciseDatabase.some((e) => e.name.toLowerCase() === name.toLowerCase());
    if (dupBuiltin) {
      Alert.alert('Already in catalog', 'Search for that name and tap it — no need to add it again.');
      return;
    }
    setCustomExerciseSaving(true);
    try {
      const created = await addUserCustomExercise(name);
      if (!created) {
        Alert.alert('Already in catalog', 'That name matches the built-in list. Use search to add it.');
        return;
      }
      const merged = [...customExercises];
      if (!merged.some((e) => e.id === created.id)) merged.push(created);
      setCustomExercises(merged);
      setShowAddCustomModal(false);
      setCustomExerciseName('');
      handleAddExercise(created.name, merged);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setCustomExerciseSaving(false);
    }
  };

  const handleAddSet = (exerciseId: string) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [...ex.sets, {
            setNumber: ex.sets.length + 1,
            weight: last?.weight ?? '',
            reps: last?.reps ?? '',
            completed: false,
          }],
        };
      }
      return ex;
    }));
  };

  const handleRemoveSet = (exerciseId: string, setNumber: number) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        return {
          ...ex,
          sets: ex.sets.filter(s => s.setNumber !== setNumber).map((s, idx) => ({
            ...s,
            setNumber: idx + 1,
          })),
        };
      }
      return ex;
    }));
  };

  const handleRemoveExercise = (exerciseId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
    setExpandOverride((prev) => {
      const next = { ...prev };
      delete next[exerciseId];
      return next;
    });
  };

  const handleSetChange = (exerciseId: string, setNumber: number, field: 'weight' | 'reps', value: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const setIdx = ex.sets.findIndex((s) => s.setNumber === setNumber);
        let sets = ex.sets.map((set) => {
          if (set.setNumber === setNumber) {
            return {
              ...set,
              [field]: value,
              completed: value.trim() !== '',
            };
          }
          return set;
        });
        if (setIdx >= 0) {
          sets = cascadeStringSetFieldToNext(sets, setIdx, field, value);
        }
        return { ...ex, sets };
      })
    );
  };

  const clonePlanForTemplate = (plan: any) => {
    try {
      return JSON.parse(JSON.stringify(plan));
    } catch {
      return { ...plan, weeklyPlan: plan?.weeklyPlan ? { ...plan.weeklyPlan } : plan?.weeklyPlan };
    }
  };

  const handleLoadPlan = (plan: any) => {
    // Copy only — edits in this screen must never mutate the saved program.
    const cloned = clonePlanForTemplate(plan);
    setTemplatePlan(cloned);
    setTemplatePlanId(typeof plan?.id === 'string' ? plan.id : null);
    setTemplatePlanName(typeof plan?.name === 'string' ? plan.name : null);
    // Daily logs keep the date title (or whatever the user typed) — never the plan name.
    if (!isDaily) {
      setWorkoutName(plan.name || '');
    }
    setSelectedDayIndex(null);
    setExercises([]);
    setExpandOverride({});

    if (cloned.weeklyPlan?.weekDays?.length > 1) {
      return;
    }

    loadExercisesFromPlan(cloned, 0);
  };

  const loadExercisesFromPlan = (plan: any, dayIndex: number) => {
    const planExercises: ExerciseEntry[] = [];

    if (plan.weeklyPlan?.weekDays?.length > 0) {
      const dayExercises = plan.weeklyPlan.weekDays[dayIndex]?.exercises ?? [];
      dayExercises.forEach((ex: any, idx: number) => {
        const weight = plannedWeightInput(ex?.weight);
        const reps = plannedRepsInput(ex);
        planExercises.push({
          // Fresh ids so this log is not linked to saved-plan exercise rows
          id: `log-${Date.now()}-${dayIndex}-${idx}`,
          name: String(ex?.name || `Exercise ${idx + 1}`),
          sets: Array.from({ length: resolveSetSlotCount(ex?.sets) }, (_, i) => ({
            setNumber: i + 1,
            weight,
            reps,
            completed: false,
          })),
        });
      });
      const dayName = plan.weeklyPlan.weekDays[dayIndex].dayName || `Day ${dayIndex + 1}`;
      if (!isDaily) {
        setWorkoutName(`${plan.name} - ${dayName}`);
      }
    } else if (Array.isArray(plan.exercises)) {
      plan.exercises.forEach((ex: any, idx: number) => {
        const weight = plannedWeightInput(ex?.weight);
        const reps = plannedRepsInput(ex);
        planExercises.push({
          id: `log-${Date.now()}-${idx}`,
          name: String(ex?.name || `Exercise ${idx + 1}`),
          sets: Array.from({ length: resolveSetSlotCount(ex?.sets) }, (_, i) => ({
            setNumber: i + 1,
            weight,
            reps,
            completed: false,
          })),
        });
      });
    }

    setExercises(planExercises);
    // Start minimized so the list is scannable; user expands sets when ready to log.
    const collapsed: Record<string, boolean> = {};
    for (const ex of planExercises) {
      collapsed[ex.id] = false;
    }
    setExpandOverride(collapsed);
  };

  const handleSelectDay = (dayIndex: number) => {
    if (!templatePlan) return;
    setSelectedDayIndex(dayIndex);
    loadExercisesFromPlan(templatePlan, dayIndex);
  };

  const handleSave = async () => {
    if (!workoutName.trim()) {
      Alert.alert('Error', 'Please enter a workout name');
      return;
    }

    if (exercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    // Validate that at least one set has data
    const hasData = exercises.some(ex => 
      ex.sets.some(set => set.weight.trim() !== '' || set.reps.trim() !== '')
    );

    if (!hasData) {
      Alert.alert('Error', 'Please enter weight and/or reps for at least one set');
      return;
    }

    // Create workout session
    const completedExercises = exercises.map(ex => ({
      exerciseId: ex.id,
      name: ex.name,
      sets: ex.sets
        .filter(set => set.weight.trim() !== '' || set.reps.trim() !== '')
        .map(set => ({
          setNumber: set.setNumber,
          weight: parseFloat(set.weight) || 0,
          reps: parseFloat(set.reps) || 0,
          restTime: 60,
          completed: true,
        })),
    })).filter(ex => ex.sets.length > 0);

    if (completedExercises.length === 0) {
      Alert.alert('Error', 'Please complete at least one exercise');
      return;
    }

    const workoutDate = new Date(selectedDate);
    workoutDate.setSeconds(0, 0);
    const dateString = workoutDate.toISOString();
    const strengthMin = completedExercises.length * 5;
    const cardioMin = cardio && cardio.durationMin > 0 ? cardio.durationMin : 0;

    const session: WorkoutSession = {
      id: Date.now().toString(),
      // Daily logs never use the source plan id — exercise edits stay on this session only.
      programId: isDaily ? `daily-${Date.now()}` : templatePlanId || 'manual',
      programName: workoutName,
      date: dateString,
      duration: strengthMin + cardioMin,
      exercises: completedExercises,
      notes: isDaily
        ? templatePlanName
          ? `Daily workout (started from ${templatePlanName})`
          : 'Daily workout'
        : '',
      completed: true,
      cardio: cardio && cardio.durationMin > 0 ? cardio : undefined,
    };

    // Save to history + refresh Progress / Fitness
    try {
      const { appendCompletedWorkoutSession } = await import('./src/utils/workoutHistoryStorage');
      const { notifyUserDataReady } = await import('./src/utils/userDataEvents');
      await appendCompletedWorkoutSession(session, { notify: false });

      try {
        await onWorkoutSessionSaved(session);
      } catch {
        /* ignore gamification errors */
      }

      notifyUserDataReady();

      const { notifyWorkoutCompleted } = await import('./src/utils/workoutCompleteNotifications');
      void notifyWorkoutCompleted({
        programName: workoutName,
        duration: session.duration,
        exerciseCount: completedExercises.length,
      });

      const finish = () => {
        onComplete(session);
        onBack();
      };

      if (isDaily) {
        Alert.alert(
          'Workout saved',
          'Logged to your history. Save this session as a reusable program?',
          [
            { text: 'Not now', style: 'cancel', onPress: finish },
            {
              text: 'Save as program',
              onPress: async () => {
                try {
                  await saveDailyAsProgram(workoutName.trim(), completedExercises);
                  onProgramsChanged?.();
                  Alert.alert('Program saved', 'Added to Saved Programs.', [
                    { text: 'OK', onPress: finish },
                  ]);
                } catch (error) {
                  console.error('Error saving daily workout as program:', error);
                  Alert.alert('Saved to history', 'Could not also save as a program.', [
                    { text: 'OK', onPress: finish },
                  ]);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Success', 'Workout saved successfully!', [
          {
            text: 'OK',
            onPress: finish,
          },
        ]);
      }
    } catch (error) {
      console.error('Error saving past workout:', error);
      Alert.alert('Error', 'Failed to save workout');
    }
  };

  const saveDailyAsProgram = async (
    name: string,
    completedExercises: Array<{
      exerciseId: string;
      name: string;
      sets: Array<{
        setNumber: number;
        weight: number;
        reps: number;
        restTime: number;
        completed: boolean;
      }>;
    }>
  ) => {
    const planExercises = completedExercises.map((ex, index) => {
      const setCount = Math.max(1, ex.sets.length);
      const avgReps = Math.round(
        ex.sets.reduce((sum, s) => sum + (s.reps || 0), 0) / setCount
      );
      const maxWeight = Math.max(0, ...ex.sets.map((s) => s.weight || 0));
      return {
        id: ex.exerciseId || `ex-${Date.now()}-${index}`,
        name: ex.name,
        sets: setCount,
        reps: avgReps || 10,
        weight: maxWeight,
        restTime: 60,
        notes: '',
      };
    });

    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const weekDay = {
      day: 1,
      dayName,
      workoutName: name,
      focus: 'Custom daily workout',
      duration: Math.max(15, planExercises.length * 5),
      exercises: planExercises,
    };

    const savedPlan = {
      id: `custom-daily-${Date.now()}`,
      name,
      level: 'intermediate' as const,
      goal: 'strength' as const,
      exercises: planExercises,
      duration: weekDay.duration,
      daysPerWeek: 1,
      totalWeeks: 1,
      programWeeks: [
        {
          weekNumber: 1,
          name: 'Week 1',
          weekDays: [weekDay],
        },
      ],
      trainingDays: [dayName],
      scheduleMode: 'flexible_days' as const,
      flexibleDayCount: 1,
      weeklyPlan: { weekDays: [weekDay] },
      isCustom: true,
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingPlans = (await loadUserData<any[]>('savedWorkoutPlans')) || [];
    await saveUserData('savedWorkoutPlans', [...existingPlans, savedPlan]);
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isDaily ? 'Daily Workout' : 'Past Workout'}</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {isDaily ? (
            <View style={styles.section}>
              <Text style={styles.hintText}>
                Log a one-off session for today — different from your saved plan. Add each exercise
                with weight and reps, then save. You can also keep it as a reusable program.
              </Text>
              <View style={styles.dateFieldButton}>
                <Text style={styles.dateFieldLabel}>Workout date</Text>
                <Text style={styles.dateFieldValue}>{formatDateTime(selectedDate)}</Text>
              </View>
            </View>
          ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date & Time</Text>
            <TouchableOpacity style={styles.dateFieldButton} onPress={openDateModal} activeOpacity={0.85}>
              <Text style={styles.dateFieldLabel}>When was this workout?</Text>
              <Text style={styles.dateFieldValue}>{formatDateTime(selectedDate)}</Text>
              <Text style={styles.dateFieldAction}>Change</Text>
            </TouchableOpacity>
          </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workout Name</Text>
            <TextInput
              style={styles.input}
              placeholder={
                isDaily
                  ? "Defaults to today's date — rename anytime"
                  : 'e.g., Upper Body, Leg Day, Full Body'
              }
              value={workoutName}
              onChangeText={setWorkoutName}
              autoCapitalize="words"
            />
          </View>

          {savedPlans.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isDaily ? 'Start from a saved plan (optional)' : 'Load from Saved Plan (Optional)'}
              </Text>
              {isDaily ? (
                <Text style={styles.hintText}>
                  This only copies exercises into today&apos;s log. Changing or removing them here
                  will not edit your saved program.
                </Text>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.plansScroll}>
                {savedPlans.slice(0, 5).map(plan => (
                  <TouchableOpacity
                    key={plan.id}
                    style={[styles.planCard, templatePlanId === plan.id && styles.planCardSelected]}
                    onPress={() => handleLoadPlan(plan)}
                  >
                    <Text style={styles.planCardName}>{plan.name}</Text>
                    <Text style={styles.planCardInfo}>
                      {plan.weeklyPlan?.weekDays?.length > 1
                        ? `${plan.weeklyPlan.weekDays.length} days`
                        : `${plan.exercises?.length || plan.weeklyPlan?.weekDays[0]?.exercises?.length || 0} exercises`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {templatePlan && templatePlan.weeklyPlan && templatePlan.weeklyPlan.weekDays && templatePlan.weeklyPlan.weekDays.length > 1 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Workout Day</Text>
              <View style={styles.daySelector}>
                {templatePlan.weeklyPlan.weekDays.map((day: any, index: number) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayButton,
                      selectedDayIndex === index && styles.dayButtonSelected
                    ]}
                    onPress={() => handleSelectDay(index)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      selectedDayIndex === index && styles.dayButtonTextSelected
                    ]}>
                      {day.dayName || `Day ${index + 1}`}
                    </Text>
                    <Text style={[
                      styles.dayButtonSubtext,
                      selectedDayIndex === index && styles.dayButtonSubtextSelected
                    ]}>
                      {day.exercises?.length || 0} exercises
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Exercise</Text>
            <TextInput
              style={styles.input}
              placeholder="Search for exercise..."
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              textContentType="none"
              clearButtonMode="while-editing"
            />
            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                {searchResults.map(exerciseName => (
                  <TouchableOpacity
                    key={exerciseName}
                    style={styles.searchResultItem}
                    onPress={() => handleAddExercise(exerciseName)}
                  >
                    <Text style={styles.searchResultText}>{exerciseName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={styles.addCustomExerciseButton}
              onPress={() => {
                setCustomExerciseName(exerciseSearch.trim());
                setShowAddCustomModal(true);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Add custom exercise to your library"
            >
              <Text style={styles.addCustomExerciseButtonText}>＋ Add custom exercise</Text>
              <Text style={styles.addCustomExerciseHint}>
                Save any name to your exercise list, then it appears in search for future workouts.
              </Text>
            </TouchableOpacity>
          </View>

          {exercises.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.exercisesSectionHeader}>
                <Text style={[styles.sectionTitle, styles.exercisesSectionTitle]}>
                  Exercises ({exercises.length})
                </Text>
                {exercises.length > 1 ? (
                  <View style={styles.expandAllRow}>
                    <TouchableOpacity
                      onPress={() => setAllExercisesExpanded(true)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                      accessibilityRole="button"
                      accessibilityLabel="Show details for all exercises"
                    >
                      <Text style={styles.expandAllText}>Show all</Text>
                    </TouchableOpacity>
                    <Text style={styles.expandAllDivider}>·</Text>
                    <TouchableOpacity
                      onPress={() => setAllExercisesExpanded(false)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Hide details for all exercises"
                    >
                      <Text style={styles.expandAllText}>Hide all</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
              {exercises.map((exercise) => renderExerciseCard(exercise))}
            </View>
          ) : (
            <View style={styles.emptyExercisesBox}>
              <Text style={styles.emptyExercisesText}>
                Search and tap an exercise above to start logging sets, weight, and reps.
              </Text>
            </View>
          )}

          <TrackCardioSection
            value={cardio}
            onChange={setCardio}
            windowStart={cardioWindow.start}
            windowEnd={cardioWindow.end}
            workoutSummary={{
              name: workoutName.trim() || (isDaily ? 'Daily workout' : 'Logged workout'),
              exerciseNames: exercises.map((ex) => ex.name).filter(Boolean),
              durationMin: exercises.length > 0 ? exercises.length * 5 : undefined,
            }}
          />

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>
              {isDaily ? 'Finish & Save' : 'Save Workout'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showDateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.dateModalRoot}>
          <Pressable style={styles.dateModalBackdrop} onPress={() => setShowDateModal(false)} />
          <View style={styles.dateModalSheet}>
            <Text style={styles.dateModalTitle}>Select date & time</Text>
            <View style={styles.pickerGroup}>
              <DateTimeWheelPicker
                key={datePickerKey}
                value={draftDate}
                onChange={setDraftDate}
                maximumDate={new Date()}
              />
            </View>
            <TouchableOpacity style={styles.dateModalDone} onPress={applyDraftDate}>
              <Text style={styles.dateModalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddCustomModal}
        transparent
        animationType="none"
        onRequestClose={() => !customExerciseSaving && setShowAddCustomModal(false)}
      >
        <View style={styles.customModalRoot}>
          <Pressable
            style={styles.customModalBackdrop}
            onPress={() => !customExerciseSaving && setShowAddCustomModal(false)}
            accessibilityLabel="Dismiss"
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.customModalCenter}
          >
            <View style={styles.customModalCard}>
              <Text style={styles.customModalTitle}>Add custom exercise</Text>
              <Text style={styles.customModalSub}>
                Stored on this account for Previous workouts and search. Use the exact name you want to see in your history.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Tibialis raises"
                placeholderTextColor="#888"
                value={customExerciseName}
                onChangeText={setCustomExerciseName}
                autoCapitalize="words"
                editable={!customExerciseSaving}
              />
              <View style={styles.customModalActions}>
                <TouchableOpacity
                  style={styles.customModalCancel}
                  onPress={() => !customExerciseSaving && setShowAddCustomModal(false)}
                  disabled={customExerciseSaving}
                >
                  <Text style={styles.customModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.customModalSave, customExerciseSaving && styles.customModalSaveDisabled]}
                  onPress={() => handleSaveCustomExerciseToLibrary()}
                  disabled={customExerciseSaving}
                >
                  <Text style={styles.customModalSaveText}>
                    {customExerciseSaving ? 'Saving…' : 'Save & add to workout'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
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
    fontSize: 22,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  keyboardView: {
    flex: 1,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  exercisesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },
  exercisesSectionTitle: {
    marginBottom: 0,
  },
  expandAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expandAllText: {
    color: '#00ff88',
    fontSize: 13,
    fontWeight: '600',
  },
  expandAllDivider: {
    color: '#555',
    fontSize: 13,
  },
  hintText: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 12,
  },
  selectedDateText: {
    color: '#ccc',
    fontSize: 15,
    marginBottom: 8,
  },
  dateFieldButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    padding: 16,
  },
  dateFieldLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 6,
  },
  dateFieldValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateFieldAction: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyExercisesBox: {
    backgroundColor: '#242424',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    padding: 16,
    marginBottom: 20,
  },
  emptyExercisesText: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  dateModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dateModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  dateModalSheet: {
    backgroundColor: '#2a2a2a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: '#444',
  },
  dateModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  dateModalDone: {
    marginTop: 12,
    backgroundColor: '#00ff88',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dateModalDoneText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '700',
  },
  pickerGroup: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
    paddingVertical: 8,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  plansScroll: {
    marginTop: 10,
  },
  planCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 15,
    marginRight: 10,
    minWidth: 150,
    borderWidth: 1,
    borderColor: '#333',
  },
  planCardSelected: {
    borderColor: '#00ff88',
    backgroundColor: '#2a4a2a',
  },
  planCardName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  planCardInfo: {
    color: '#888',
    fontSize: 12,
  },
  searchResults: {
    marginTop: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    maxHeight: 200,
  },
  searchResultItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchResultText: {
    color: '#fff',
    fontSize: 14,
  },
  exerciseCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  exerciseCardActive: {
    borderColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  reorderHint: {
    color: '#888',
    fontSize: 13,
    marginBottom: 12,
    marginTop: -6,
    fontStyle: 'italic',
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
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  exerciseHeaderTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  exerciseCompactSummary: {
    marginTop: 6,
    fontSize: 13,
    color: '#aaa',
    lineHeight: 18,
  },
  expandToggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
    alignSelf: 'flex-start',
  },
  expandToggleBtnText: {
    color: '#00ff88',
    fontSize: 13,
    fontWeight: '700',
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  setNumber: {
    width: 60,
    color: '#888',
    fontSize: 14,
  },
  setInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  setLabel: {
    width: 40,
    color: '#888',
    fontSize: 12,
  },
  removeSetButton: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addSetButton: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addSetButtonText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  daySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  dayButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  dayButtonSelected: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  dayButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  dayButtonTextSelected: {
    color: '#1a1a1a',
  },
  dayButtonSubtext: {
    color: '#888',
    fontSize: 12,
  },
  dayButtonSubtextSelected: {
    color: '#1a1a1a',
    opacity: 0.7,
  },
  addCustomExerciseButton: {
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#243024',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  addCustomExerciseButtonText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '700',
  },
  addCustomExerciseHint: {
    marginTop: 8,
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
  },
  customModalRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  customModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  customModalCenter: {
    paddingHorizontal: 20,
  },
  customModalCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#444',
  },
  customModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  customModalSub: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 16,
    lineHeight: 20,
  },
  customModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  customModalCancel: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#555',
  },
  customModalCancelText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
  },
  customModalSave: {
    flex: 1.2,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#00ff88',
  },
  customModalSaveDisabled: {
    opacity: 0.6,
  },
  customModalSaveText: {
    color: '#1a1a1a',
    fontSize: 15,
    fontWeight: '700',
  },
});


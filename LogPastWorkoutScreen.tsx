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
import { cascadeStringSetFieldToNext } from './src/utils/setLoggingPrefill';
import { useSmallWins } from './src/context/SmallWinsContext';

interface LogPastWorkoutScreenProps {
  onBack: () => void;
  onComplete: (session: WorkoutSession) => void;
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

export default function LogPastWorkoutScreen({ onBack, onComplete }: LogPastWorkoutScreenProps) {
  const { onWorkoutSessionSaved } = useSmallWins();
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  });
  const [workoutName, setWorkoutName] = useState('');
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const deferredExerciseSearch = useDeferredValue(exerciseSearch);
  const [savedPlans, setSavedPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [customExercises, setCustomExercises] = useState<ExerciseData[]>([]);
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [customExerciseSaving, setCustomExerciseSaving] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  });
  /** Exercises stay expanded while logging; only collapse when the user taps Minimize. */
  const [expandOverride, setExpandOverride] = useState<Record<string, boolean>>({});

  const isExerciseExpanded = useCallback(
    (ex: ExerciseEntry) => expandOverride[ex.id] !== false,
    [expandOverride]
  );

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
    setDraftDate(new Date(selectedDate));
    setShowDateModal(true);
  };

  const applyDraftDate = () => {
    setSelectedDate(new Date(draftDate));
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
            accessibilityLabel={expanded ? 'Minimize exercise sets' : 'Show exercise sets and weights'}
          >
            <Text style={styles.expandToggleBtnText}>{expanded ? 'Minimize' : 'Show sets'}</Text>
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
    setExercises(exercises.map(ex => {
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
    }));
  };

  const handleLoadPlan = (plan: any) => {
    setSelectedPlan(plan);
    setWorkoutName(plan.name);
    setSelectedDayIndex(null);
    setExercises([]);
    
    // If plan has multiple days, don't load exercises yet - wait for day selection
    if (plan.weeklyPlan && plan.weeklyPlan.weekDays && plan.weeklyPlan.weekDays.length > 1) {
      // User needs to select a day first
      return;
    }
    
    // Load exercises from plan (single day or no weekly plan)
    loadExercisesFromPlan(plan, 0);
  };

  const loadExercisesFromPlan = (plan: any, dayIndex: number) => {
    const planExercises: ExerciseEntry[] = [];
    
    if (plan.weeklyPlan && plan.weeklyPlan.weekDays && plan.weeklyPlan.weekDays.length > 0) {
      // Use selected day's exercises
      const dayExercises = plan.weeklyPlan.weekDays[dayIndex].exercises;
      dayExercises.forEach((ex: any, idx: number) => {
        planExercises.push({
          id: `plan-${dayIndex}-${idx}`,
          name: ex.name,
          sets: Array.from({ length: ex.sets || 3 }, (_, i) => ({
            setNumber: i + 1,
            weight: '',
            reps: '',
            completed: false,
          })),
        });
      });
      // Update workout name to include day name
      const dayName = plan.weeklyPlan.weekDays[dayIndex].dayName || `Day ${dayIndex + 1}`;
      setWorkoutName(`${plan.name} - ${dayName}`);
    } else if (plan.exercises) {
      plan.exercises.forEach((ex: any, idx: number) => {
        planExercises.push({
          id: `plan-${idx}`,
          name: ex.name,
          sets: Array.from({ length: ex.sets || 3 }, (_, i) => ({
            setNumber: i + 1,
            weight: '',
            reps: '',
            completed: false,
          })),
        });
      });
    }
    
    setExercises(planExercises);
  };

  const handleSelectDay = (dayIndex: number) => {
    if (!selectedPlan) return;
    setSelectedDayIndex(dayIndex);
    loadExercisesFromPlan(selectedPlan, dayIndex);
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

    const session: WorkoutSession = {
      id: Date.now().toString(),
      programId: selectedPlan?.id || 'manual',
      programName: workoutName,
      date: dateString,
      duration: completedExercises.length * 5, // Estimate 5 min per exercise
      exercises: completedExercises,
      notes: '',
      completed: true,
    };

    // Save to history
    try {
      const existingHistory = await loadUserData<WorkoutSession[]>('workoutHistory') || [];
      const updatedHistory = [session, ...existingHistory];
      await saveUserData('workoutHistory', updatedHistory);

      try {
        await onWorkoutSessionSaved(session);
      } catch {
        /* ignore gamification errors */
      }

      Alert.alert('Success', 'Workout saved successfully!', [
        {
          text: 'OK',
          onPress: () => {
            onComplete(session);
            onBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Error saving past workout:', error);
      Alert.alert('Error', 'Failed to save workout');
    }
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
        <Text style={styles.headerTitle}>Previous</Text>
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date & Time</Text>
            <TouchableOpacity style={styles.dateFieldButton} onPress={openDateModal} activeOpacity={0.85}>
              <Text style={styles.dateFieldLabel}>When was this workout?</Text>
              <Text style={styles.dateFieldValue}>{formatDateTime(selectedDate)}</Text>
              <Text style={styles.dateFieldAction}>Change</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workout Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Upper Body, Leg Day, Full Body"
              value={workoutName}
              onChangeText={setWorkoutName}
              autoCapitalize="words"
            />
          </View>

          {savedPlans.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Load from Saved Plan (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.plansScroll}>
                {savedPlans.slice(0, 5).map(plan => (
                  <TouchableOpacity
                    key={plan.id}
                    style={[styles.planCard, selectedPlan?.id === plan.id && styles.planCardSelected]}
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

          {selectedPlan && selectedPlan.weeklyPlan && selectedPlan.weeklyPlan.weekDays && selectedPlan.weeklyPlan.weekDays.length > 1 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Workout Day</Text>
              <View style={styles.daySelector}>
                {selectedPlan.weeklyPlan.weekDays.map((day: any, index: number) => (
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
              <Text style={styles.sectionTitle}>Exercises ({exercises.length})</Text>
              {exercises.map((exercise) => renderExerciseCard(exercise))}
            </View>
          ) : (
            <View style={styles.emptyExercisesBox}>
              <Text style={styles.emptyExercisesText}>
                Search and tap an exercise above to start logging sets, weight, and reps.
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Workout</Text>
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


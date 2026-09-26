import React, { useDeferredValue, useMemo, useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppTextInput as TextInput } from './AppTextInput';
import { exerciseDatabase, type ExerciseData } from '../data/exerciseDatabase';

export type SessionExerciseRow = {
  id: string;
  name: string;
  sets?: number;
  reps?: number;
  canRemove?: boolean;
};

interface EditSessionExercisesModalProps {
  visible: boolean;
  exercises: SessionExerciseRow[];
  onClose: () => void;
  onAdd: (exercise: ExerciseData) => void;
  onRemove: (index: number) => void;
}

export default function EditSessionExercisesModal({
  visible,
  exercises,
  onClose,
  onAdd,
  onRemove,
}: EditSessionExercisesModalProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const selectedNames = useMemo(
    () => new Set(exercises.map((ex) => ex.name.trim().toLowerCase())),
    [exercises]
  );

  const matches = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const pool = q
      ? exerciseDatabase.filter((ex) => ex.name.toLowerCase().includes(q))
      : exerciseDatabase.slice(0, 30);
    return pool.filter((ex) => !selectedNames.has(ex.name.trim().toLowerCase())).slice(0, 40);
  }, [deferredQuery, selectedNames]);

  const customName = query.trim();
  const showCustom =
    customName.length > 0 &&
    !selectedNames.has(customName.toLowerCase()) &&
    !matches.some((ex) => ex.name.toLowerCase() === customName.toLowerCase());

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Add or remove exercises</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.close}>Done</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Changes can stay on this workout only, or update the saved plan.
        </Text>

        <TextInput
          style={styles.search}
          placeholder="Search exercises to add..."
          placeholderTextColor="#666"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.section}>This workout</Text>
          {exercises.map((ex, index) => (
            <View key={`${ex.id}-${index}`} style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{ex.name}</Text>
                {ex.sets != null && ex.reps != null ? (
                  <Text style={styles.rowMeta}>
                    {ex.sets} sets • {ex.reps} reps
                  </Text>
                ) : null}
              </View>
              {ex.canRemove === false ? (
                <Text style={styles.locked}>Kept</Text>
              ) : (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => onRemove(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${ex.name}`}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          <Text style={styles.section}>Add exercise</Text>
          {showCustom ? (
            <TouchableOpacity
              style={styles.addRow}
              onPress={() => {
                onAdd({
                  id: `custom-${Date.now()}`,
                  name: customName,
                  movementPattern: 'push',
                  primaryMuscleGroup: 'full body',
                  secondaryMuscleGroups: [],
                  equipmentRequired: ['bodyweight'],
                  difficulty: 'beginner',
                  potentialRisks: [],
                  alternatives: [],
                  category: 'strength',
                });
                setQuery('');
              }}
            >
              <Text style={styles.addName}>+ Add “{customName}”</Text>
            </TouchableOpacity>
          ) : null}
          {matches.map((ex) => (
            <TouchableOpacity
              key={ex.id || ex.name}
              style={styles.addRow}
              onPress={() => {
                onAdd(ex);
                setQuery('');
              }}
            >
              <Text style={styles.addName}>{ex.name}</Text>
              <Text style={styles.rowMeta}>
                {ex.primaryMuscleGroup}
                {ex.difficulty ? ` • ${ex.difficulty}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
          {matches.length === 0 && !showCustom ? (
            <Text style={styles.empty}>No matching exercises. Try a different search.</Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  close: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    color: '#888',
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  search: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  rowInfo: {
    flex: 1,
    marginRight: 12,
  },
  rowName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#3a2222',
  },
  removeText: {
    color: '#ff6b6b',
    fontSize: 13,
    fontWeight: '700',
  },
  locked: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  addRow: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  addName: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    color: '#666',
    fontSize: 14,
    marginBottom: 24,
  },
});

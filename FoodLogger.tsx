import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

export type MacroTotals = {
  protein: number;
  carbs: number;
  fat: number;
};

type FoodLoggerProps = {
  enableMacroPreview: boolean;
  currentTotals: MacroTotals;
  predictedTotals: MacroTotals;
  onAddStagedFood?: () => void;
};

const MAX_MACRO = {
  protein: 220,
  carbs: 320,
  fat: 120,
} as const;

export default function FoodLogger({
  enableMacroPreview,
  currentTotals,
  predictedTotals,
  onAddStagedFood,
}: FoodLoggerProps) {
  if (!enableMacroPreview) return null;

  const haptic = () => void Haptics.selectionAsync();

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>Prediction Plate</Text>
      <MacroRow label="Protein" current={currentTotals.protein} predicted={predictedTotals.protein} max={MAX_MACRO.protein} />
      <MacroRow label="Carbs" current={currentTotals.carbs} predicted={predictedTotals.carbs} max={MAX_MACRO.carbs} />
      <MacroRow label="Fat" current={currentTotals.fat} predicted={predictedTotals.fat} max={MAX_MACRO.fat} />
      {onAddStagedFood ? (
        <Pressable style={styles.addBtn} onPressIn={haptic} onPress={onAddStagedFood}>
          <Text style={styles.addBtnText}>Add from Staging Area</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MacroRow({
  label,
  current,
  predicted,
  max,
}: {
  label: string;
  current: number;
  predicted: number;
  max: number;
}) {
  const currentW = `${Math.min(100, (current / max) * 100)}%` as `${number}%`;
  const predictedW = `${Math.min(100, (predicted / max) * 100)}%` as `${number}%`;
  return (
    <View style={styles.macroRow}>
      <Text style={styles.macroLabel}>
        {label}: {Math.round(current)}g -&gt; {Math.round(predicted)}g
      </Text>
      <View style={styles.track}>
        <View style={[styles.currentFill, { width: currentW }]} />
        <View style={[styles.predictedFill, { width: predictedW }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#1E1E1E',
    borderBottomColor: '#2c2c2c',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  title: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  macroRow: { marginBottom: 10 },
  macroLabel: { color: '#d6d6d6', fontSize: 12, marginBottom: 5 },
  track: {
    height: 9,
    borderRadius: 99,
    backgroundColor: '#121212',
    overflow: 'hidden',
    position: 'relative',
  },
  currentFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 99,
    backgroundColor: '#3f3f3f',
  },
  predictedFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 99,
    backgroundColor: '#4ADE80',
    shadowColor: '#4ADE80',
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  addBtn: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: '#4ADE80',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#0f2517', fontWeight: '700' },
});

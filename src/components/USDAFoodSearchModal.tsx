import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppTextInput as TextInput } from './AppTextInput';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFoodDetail } from '../hooks/useFoodDetail';
import { AppTheme } from '../theme/appVisualTheme';
import type { FoodSearchHit } from '../types/fdcApi';
import { extractMacrosPer100g, scaleMacrosFrom100g } from '../utils/fdcNutrients';
import { buildPortionOptions, foodCategoryDescription, type FdcPortionMode } from '../utils/fdcPortions';
import { FdcNutritionErrorBoundary } from './nutrition/FdcNutritionErrorBoundary';

export type USDAFoodApplyPayload = {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  nutritionScanNote?: string;
  portionGrams: number;
};

export interface USDAFoodSearchModalProps {
  visible: boolean;
  /** USDA search hit to load portions/macros for (opened from Log Food inline list). */
  foodHit: FoodSearchHit | null;
  onClose: () => void;
  /** Persist the chosen portion (e.g. append to today’s log). Sheet closes only after this resolves. */
  onApply?: (payload: USDAFoodApplyPayload) => void | Promise<void>;
}

function formatMacro(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return (Math.round(n * 10 ** digits) / 10 ** digits).toString();
}

function formatEnergy(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return String(Math.round(n));
}

const USDAFoodPortionContent: React.FC<USDAFoodSearchModalProps> = ({ foodHit, onClose, onApply }) => {
  const insets = useSafeAreaInsets();
  const [portionMode, setPortionMode] = useState<FdcPortionMode>('grams');
  const [gramsInput, setGramsInput] = useState('100');
  const [quantity, setQuantity] = useState('1');
  const [selectedPortionKey, setSelectedPortionKey] = useState<string>('');

  const { food, loading: loadingDetail, error: detailError } = useFoodDetail(foodHit?.fdcId ?? null, foodHit != null);

  useEffect(() => {
    if (!foodHit) {
      setPortionMode('grams');
      setGramsInput('100');
      setQuantity('1');
      setSelectedPortionKey('');
    }
  }, [foodHit]);

  const portionOptions = useMemo(() => buildPortionOptions(food), [food]);

  useEffect(() => {
    if (portionOptions.length === 0 && portionMode === 'measure') {
      setPortionMode('grams');
    }
  }, [portionOptions.length, portionMode]);

  useEffect(() => {
    if (food?.fdcId) {
      setGramsInput('100');
      setQuantity('1');
      setPortionMode('grams');
      setSelectedPortionKey('');
    }
  }, [food?.fdcId]);

  useEffect(() => {
    if (portionOptions.length > 0 && !selectedPortionKey) {
      setSelectedPortionKey(portionOptions[0].key);
    }
  }, [portionOptions, selectedPortionKey]);

  const per100 = useMemo(() => extractMacrosPer100g(food ?? undefined), [food]);

  const totalGrams = useMemo(() => {
    if (portionMode === 'grams') {
      const n = parseFloat(gramsInput.replace(/,/g, ''));
      return Number.isFinite(n) && n > 0 ? n : 100;
    }
    const opt = portionOptions.find((o) => o.key === selectedPortionKey) ?? portionOptions[0];
    const q = parseFloat(quantity.replace(/,/g, ''));
    const mult = Number.isFinite(q) && q > 0 ? q : 1;
    if (!opt) return 100;
    return opt.gramWeight * mult;
  }, [portionMode, gramsInput, quantity, selectedPortionKey, portionOptions]);

  const scaled = useMemo(() => scaleMacrosFrom100g(per100, totalGrams), [per100, totalGrams]);

  const apply = useCallback(async () => {
    const desc = food?.description ?? foodHit?.description;
    if (!desc?.trim()) return;
    const cal = scaled.energyKcal;
    if ((cal == null || !Number.isFinite(cal) || cal <= 0) && scaled.proteinG == null && scaled.fatG == null && scaled.carbsG == null) {
      return;
    }
    const calStr =
      scaled.energyKcal != null && Number.isFinite(scaled.energyKcal) && scaled.energyKcal > 0
        ? formatEnergy(scaled.energyKcal)
        : formatEnergy((scaled.proteinG ?? 0) * 4 + (scaled.carbsG ?? 0) * 4 + (scaled.fatG ?? 0) * 9);
    const dt = food?.dataType ?? foodHit?.dataType ?? 'FDC';
    const portionLabel =
      portionMode === 'grams'
        ? `${totalGrams} g (custom)`
        : `${quantity}× ${portionOptions.find((o) => o.key === selectedPortionKey)?.label ?? 'portion'} (${Math.round(totalGrams)} g)`;
    const note = `USDA FoodData Central (${dt}). Per 100 g on file; scaled for ${portionLabel}.`;
    try {
      await onApply?.({
        name: desc.trim(),
        calories: calStr,
        protein: formatMacro(scaled.proteinG, 1),
        carbs: formatMacro(scaled.carbsG, 1),
        fat: formatMacro(scaled.fatG, 1),
        nutritionScanNote: note,
        portionGrams: Math.round(totalGrams * 10) / 10,
      });
      onClose();
    } catch {
      // Persist failed — keep this sheet open so the user can retry or adjust.
    }
  }, [food, foodHit, onApply, onClose, portionMode, portionOptions, quantity, scaled, selectedPortionKey, totalGrams]);

  const renderNutrientBlock = (label: string, per100Val: number | null, scaledVal: number | null, energy = false) => (
    <View style={styles.nutRow}>
      <Text style={styles.nutLabel}>{label}</Text>
      <View style={styles.nutCol}>
        <Text style={styles.nutSub}>per 100 g</Text>
        <Text style={styles.nutValue}>{energy ? formatEnergy(per100Val) : formatMacro(per100Val, 1)}</Text>
      </View>
      <View style={styles.nutCol}>
        <Text style={styles.nutSub}>this portion</Text>
        <Text style={[styles.nutValue, styles.nutValueAccent]}>
          {energy ? formatEnergy(scaledVal) : formatMacro(scaledVal, 1)}
        </Text>
      </View>
    </View>
  );

  if (!foodHit) return null;

  const detailCategory = foodCategoryDescription(food) || foodHit.foodCategory || '';

  return (
    <>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} hitSlop={14} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.closeDone}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>USDA portions</Text>
          <View style={{ width: 52 }} />
        </View>

        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.detailName} numberOfLines={4}>
            {food?.description ?? foodHit.description}
          </Text>
          <Text style={styles.detailType}>
            {[foodHit.dataType, detailCategory].filter(Boolean).join(' · ')}
          </Text>

          {loadingDetail ? (
            <View style={styles.centerPad}>
              <ActivityIndicator size="large" color={AppTheme.accent} />
              <Text style={styles.muted}>Loading nutrients…</Text>
            </View>
          ) : detailError ? (
            <Text style={styles.errorText}>{detailError}</Text>
          ) : food ? (
            <>
              <View style={styles.weightCard}>
                <Text style={styles.weightLabel}>Portion</Text>
                <Text style={styles.weightHint}>USDA values are per 100 g; choose grams or a common measure.</Text>
                <View style={styles.segment}>
                  <TouchableOpacity
                    style={[styles.segmentBtn, portionMode === 'grams' && styles.segmentBtnOn]}
                    onPress={() => setPortionMode('grams')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.segmentText, portionMode === 'grams' && styles.segmentTextOn]}>Grams</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentBtn, portionMode === 'measure' && styles.segmentBtnOn]}
                    onPress={() => portionOptions.length > 0 && setPortionMode('measure')}
                    activeOpacity={0.85}
                    disabled={portionOptions.length === 0}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        portionMode === 'measure' && styles.segmentTextOn,
                        portionOptions.length === 0 && styles.segmentTextDisabled,
                      ]}
                    >
                      Common measures
                    </Text>
                  </TouchableOpacity>
                </View>

                {portionMode === 'grams' ? (
                  <>
                    <Text style={styles.fieldLabel}>Weight (g)</Text>
                    <TextInput
                      style={styles.weightInput}
                      value={gramsInput}
                      onChangeText={setGramsInput}
                      keyboardType="decimal-pad"
                      placeholder="100"
                      placeholderTextColor={AppTheme.textFaint}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>Measure</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.measureScroll}>
                      {portionOptions.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.measureChip, selectedPortionKey === opt.key && styles.measureChipOn]}
                          onPress={() => setSelectedPortionKey(opt.key)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[styles.measureChipText, selectedPortionKey === opt.key && styles.measureChipTextOn]}
                            numberOfLines={2}
                          >
                            {opt.label}
                          </Text>
                          <Text style={styles.measureGramHint}>{Math.round(opt.gramWeight)} g</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <Text style={styles.fieldLabel}>Quantity (how many)</Text>
                    <TextInput
                      style={styles.weightInput}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="decimal-pad"
                      placeholder="1"
                      placeholderTextColor={AppTheme.textFaint}
                    />
                  </>
                )}
                <Text style={styles.totalGramsLine}>≈ {Math.round(totalGrams * 10) / 10} g total</Text>
              </View>

              <View style={styles.macroCard}>
                {renderNutrientBlock('Energy (kcal)', per100.energyKcal, scaled.energyKcal, true)}
                {renderNutrientBlock('Protein (g)', per100.proteinG, scaled.proteinG)}
                {renderNutrientBlock('Fat (g)', per100.fatG, scaled.fatG)}
                {renderNutrientBlock('Carbs (g)', per100.carbsG, scaled.carbsG)}
              </View>

              {onApply ? (
                <TouchableOpacity style={styles.applyBtn} onPress={() => void apply()} activeOpacity={0.88}>
                  <Text style={styles.applyBtnText}>Add to log food</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

export const USDAFoodSearchModal: React.FC<USDAFoodSearchModalProps> = (props) => {
  const [boundaryNonce, setBoundaryNonce] = useState(0);
  const open = props.visible && props.foodHit != null;
  return (
    <Modal
      visible={open}
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={props.onClose}
    >
      {open ? (
        <FdcNutritionErrorBoundary key={boundaryNonce} onReset={() => setBoundaryNonce((n) => n + 1)}>
          <USDAFoodPortionContent {...props} />
        </FdcNutritionErrorBoundary>
      ) : null}
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  closeDone: {
    fontSize: 16,
    fontWeight: '600',
    color: AppTheme.accent,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: AppTheme.textPrimary,
    letterSpacing: 0.3,
  },
  detailScroll: {
    flex: 1,
  },
  detailScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  detailName: {
    fontSize: 22,
    fontWeight: '800',
    color: AppTheme.textPrimary,
    lineHeight: 28,
    marginTop: 8,
    letterSpacing: 0.3,
  },
  detailType: {
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textMuted,
    marginTop: 6,
    marginBottom: 16,
  },
  centerPad: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  muted: {
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textMuted,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#f87171',
    marginTop: 10,
  },
  weightCard: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 14,
    marginBottom: 12,
  },
  weightLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: AppTheme.textSecondary,
    letterSpacing: 0.4,
  },
  weightHint: {
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textMuted,
    marginTop: 6,
    marginBottom: 12,
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: AppTheme.radiusPill,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    alignItems: 'center',
  },
  segmentBtnOn: {
    backgroundColor: 'rgba(0, 255, 136, 0.18)',
    borderColor: AppTheme.accent,
    borderWidth: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textMuted,
  },
  segmentTextOn: {
    color: AppTheme.accent,
    fontWeight: '700',
  },
  segmentTextDisabled: {
    opacity: 0.45,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textSecondary,
    marginBottom: 6,
  },
  measureScroll: {
    marginBottom: 12,
    maxHeight: 100,
  },
  measureChip: {
    maxWidth: 200,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: AppTheme.radiusPill,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  measureChipOn: {
    backgroundColor: 'rgba(0, 255, 136, 0.18)',
    borderColor: AppTheme.accent,
    borderWidth: 2,
  },
  measureChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textMuted,
  },
  measureChipTextOn: {
    color: AppTheme.accent,
    fontWeight: '700',
  },
  measureGramHint: {
    fontSize: 11,
    color: AppTheme.textFaint,
    marginTop: 4,
  },
  weightInput: {
    backgroundColor: AppTheme.inputBg,
    borderRadius: AppTheme.radiusRow,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    color: AppTheme.textPrimary,
  },
  totalGramsLine: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '800',
    color: AppTheme.accent,
  },
  macroCard: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    paddingVertical: 8,
    marginBottom: 12,
  },
  nutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.borderMuted,
  },
  nutLabel: {
    flex: 1.2,
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textSecondary,
  },
  nutCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  nutSub: {
    fontSize: 11,
    color: AppTheme.textFaint,
    marginBottom: 2,
  },
  nutValue: {
    fontSize: 16,
    fontWeight: '700',
    color: AppTheme.textPrimary,
  },
  nutValueAccent: {
    color: AppTheme.accent,
  },
  applyBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: AppTheme.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: AppTheme.accentDark,
    letterSpacing: 0.5,
  },
});

import React, { useCallback, useEffect, useMemo, useState, useDeferredValue } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Modal,
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { AppTextInput as TextInput } from './src/components/AppTextInput';
import { FlashList } from '@shopify/flash-list';
import debounce from 'lodash/debounce';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { AppTheme } from './src/theme/appVisualTheme';
import { isUsdaNutritionDbSupported } from './src/database/DatabaseManager';
import {
  fetchFoodDetail,
  gramsForPortion,
  scaleNutrientAmount,
  searchFoodsFts,
} from './src/database/usdaNutritionRepository';
import type { UsdaFoodPortionRow, UsdaFoodSearchRow, UsdaNutrientRow } from './src/types/usdaSqlite';
import FoodLogger, { type MacroTotals } from './FoodLogger';
import { loadUserData, saveUserData } from './src/utils/userStorage';
import type { LoggedMeal } from './src/utils/loggedMeals';
import { useUserSettings } from './SettingsProvider';

interface NutritionSearchScreenProps {
  onBack: () => void;
}

export default function NutritionSearchScreen({ onBack }: NutritionSearchScreenProps) {
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
  const { enableMacroPreview } = useUserSettings();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<UsdaFoodSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailNutrients, setDetailNutrients] = useState<UsdaNutrientRow[]>([]);
  const [detailPortions, setDetailPortions] = useState<UsdaFoodPortionRow[]>([]);
  const [detailTitle, setDetailTitle] = useState('');
  const [selectedPortion, setSelectedPortion] = useState<UsdaFoodPortionRow | null>(null);
  const [portionMultiplier, setPortionMultiplier] = useState('1');
  const [stagedName, setStagedName] = useState('');
  const [currentTotals, setCurrentTotals] = useState<MacroTotals>({ protein: 0, carbs: 0, fat: 0 });

  const runSearch = useMemo(
    () =>
      debounce((q: string) => {
        if (!isUsdaNutritionDbSupported || !q.trim()) {
          setResults([]);
          setLoading(false);
          return;
        }
        setLoading(true);
        searchFoodsFts(q, 80)
          .then(setResults)
          .catch(() => setResults([]))
          .finally(() => setLoading(false));
      }, 120),
    []
  );

  useEffect(() => {
    return () => runSearch.cancel();
  }, [runSearch]);

  useEffect(() => {
    runSearch(deferredQuery);
  }, [deferredQuery, runSearch]);

  useEffect(() => {
    (async () => {
      const meals = (await loadUserData<LoggedMeal[]>('meals')) || [];
      const totals = meals.reduce(
        (acc, meal) => ({
          protein: acc.protein + (meal.protein || 0),
          carbs: acc.carbs + (meal.carbs || 0),
          fat: acc.fat + (meal.fat || 0),
        }),
        { protein: 0, carbs: 0, fat: 0 }
      );
      setCurrentTotals(totals);
    })();
  }, []);

  const openDetail = useCallback(async (row: UsdaFoodSearchRow) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    void Haptics.selectionAsync();
    setDetailTitle(row.description);
    setStagedName(row.description);
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedPortion(null);
    setPortionMultiplier('1');
    try {
      const detail = await fetchFoodDetail(row.fdc_id);
      if (!detail) {
        setDetailNutrients([]);
        setDetailPortions([]);
      } else {
        setDetailNutrients(detail.nutrients);
        setDetailPortions(detail.portions);
        setSelectedPortion(detail.portions[0] ?? null);
      }
    } catch {
      setDetailNutrients([]);
      setDetailPortions([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const mult = useMemo(() => {
    const n = parseFloat(portionMultiplier.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [portionMultiplier]);

  const grams = useMemo(() => {
    if (!selectedPortion) return 100;
    return gramsForPortion(selectedPortion.gram_weight, selectedPortion.amount, mult);
  }, [selectedPortion, mult]);

  const macroLines = useMemo(() => {
    const pick = (id: number) => detailNutrients.find((n) => n.nutrient_id === id);
    const energy = pick(1008);
    const protein = pick(1003);
    const fat = pick(1004);
    const carbs = pick(1005);
    const lines: { label: string; value: string }[] = [];
    if (energy) {
      lines.push({
        label: 'Energy',
        value: `${scaleNutrientAmount(energy.amount, grams).toFixed(0)} ${energy.unit_name}`,
      });
    }
    if (protein) {
      lines.push({
        label: 'Protein',
        value: `${scaleNutrientAmount(protein.amount, grams).toFixed(1)} ${protein.unit_name}`,
      });
    }
    if (carbs) {
      lines.push({
        label: 'Carbs',
        value: `${scaleNutrientAmount(carbs.amount, grams).toFixed(1)} ${carbs.unit_name}`,
      });
    }
    if (fat) {
      lines.push({
        label: 'Fat',
        value: `${scaleNutrientAmount(fat.amount, grams).toFixed(1)} ${fat.unit_name}`,
      });
    }
    return lines;
  }, [detailNutrients, grams]);

  const stagedMacros = useMemo<MacroTotals>(() => {
    const pick = (id: number) => detailNutrients.find((n) => n.nutrient_id === id);
    const protein = pick(1003);
    const carbs = pick(1005);
    const fat = pick(1004);
    return {
      protein: protein ? scaleNutrientAmount(protein.amount, grams) : 0,
      carbs: carbs ? scaleNutrientAmount(carbs.amount, grams) : 0,
      fat: fat ? scaleNutrientAmount(fat.amount, grams) : 0,
    };
  }, [detailNutrients, grams]);

  const predictedTotals = useMemo<MacroTotals>(
    () => ({
      protein: currentTotals.protein + stagedMacros.protein,
      carbs: currentTotals.carbs + stagedMacros.carbs,
      fat: currentTotals.fat + stagedMacros.fat,
    }),
    [currentTotals, stagedMacros]
  );

  const addStagedFood = useCallback(async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newMeal: LoggedMeal = {
      id: `${Date.now()}`,
      name: stagedName || detailTitle || 'Food',
      calories: Math.round(stagedMacros.protein * 4 + stagedMacros.carbs * 4 + stagedMacros.fat * 9),
      protein: stagedMacros.protein,
      carbs: stagedMacros.carbs,
      fat: stagedMacros.fat,
      time: new Date().toLocaleTimeString(),
      date: new Date().toISOString(),
      servings: mult,
      mealSlot: 'staging',
    };
    const meals = (await loadUserData<LoggedMeal[]>('meals')) || [];
    const nextMeals = [newMeal, ...meals];
    await saveUserData('meals', nextMeals);
    setCurrentTotals(predictedTotals);
    setDetailOpen(false);
  }, [detailTitle, mult, predictedTotals, stagedMacros, stagedName]);

  const renderItem = useCallback(
    ({ item }: { item: UsdaFoodSearchRow }) => (
      <TouchableOpacity style={styles.row} onPress={() => openDetail(item)} activeOpacity={0.7}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={styles.rowMeta}>fdc_id {item.fdc_id}</Text>
      </TouchableOpacity>
    ),
    [openDetail]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={[styles.header, styles.headerCard]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} accessibilityRole="button">
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Nutrition search</Text>
        <Text style={styles.subtitle}>Offline USDA sample (FTS5 + SQLite)</Text>
      </View>

      {!isUsdaNutritionDbSupported || Platform.OS === 'web' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Local SQLite search runs on iOS and Android builds with Hermes (not in remote Chrome
            debugging or web).
          </Text>
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Search foods…"
        placeholderTextColor={AppTheme.textMuted}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        textContentType="none"
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      <FoodLogger
        enableMacroPreview={enableMacroPreview}
        currentTotals={currentTotals}
        predictedTotals={detailOpen ? predictedTotals : currentTotals}
      />

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={AppTheme.accent} />
        </View>
      ) : null}

      <View style={styles.listFlex}>
        <FlashList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.fdc_id)}
          keyboardShouldPersistTaps="handled"
          drawDistance={250}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {query.trim() ? 'No matches.' : 'Type to search the bundled database.'}
            </Text>
          }
          contentContainerStyle={styles.listPad}
        />
      </View>

      <Modal visible={detailOpen} animationType="none" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
            <Text style={styles.modalTitle} numberOfLines={2}>
              {detailTitle}
            </Text>
            {detailLoading ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={AppTheme.accent} />
            ) : (
              <>
                <Text style={styles.sectionLabel}>Portion</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {detailPortions.map((p) => {
                    const active = selectedPortion?.id === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setSelectedPortion(p)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {p.portion_description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <Text style={styles.sectionLabel}>Multiplier</Text>
                <View style={styles.multiplierRow}>
                  <Pressable
                    style={styles.adjustBtn}
                    onPressIn={() => void Haptics.selectionAsync()}
                    onPress={() => setPortionMultiplier(String(Math.max(0.25, mult - 0.25).toFixed(2)))}
                  >
                    <Text style={styles.adjustBtnText}>-</Text>
                  </Pressable>
                  <TextInput
                    style={[styles.input, styles.multiplierInput]}
                    value={portionMultiplier}
                    onChangeText={setPortionMultiplier}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={AppTheme.textMuted}
                  />
                  <Pressable
                    style={styles.adjustBtn}
                    onPressIn={() => void Haptics.selectionAsync()}
                    onPress={() => setPortionMultiplier(String((mult + 0.25).toFixed(2)))}
                  >
                    <Text style={styles.adjustBtnText}>+</Text>
                  </Pressable>
                </View>
                <View style={styles.stagingArea}>
                  <Text style={styles.stagingTitle}>Staging Area (Prediction Plate)</Text>
                  <Text style={styles.stagingText}>{stagedName || detailTitle}</Text>
                  <FoodLogger
                    enableMacroPreview={enableMacroPreview}
                    currentTotals={currentTotals}
                    predictedTotals={predictedTotals}
                    onAddStagedFood={addStagedFood}
                  />
                </View>
                <Text style={styles.gramsLine}>
                  ≈ {grams.toFixed(1)} g — nutrients scaled from per 100 g reference in this sample
                  DB.
                </Text>
                <Text style={styles.sectionLabel}>Macros (scaled)</Text>
                {macroLines.map((line) => (
                  <View key={line.label} style={styles.macroRow}>
                    <Text style={styles.macroLabel}>{line.label}</Text>
                    <Text style={styles.macroValue}>{line.value}</Text>
                  </View>
                ))}
                <Text style={styles.sectionLabel}>All nutrients</Text>
                {detailNutrients.map((n) => (
                  <View key={n.nutrient_id} style={styles.macroRow}>
                    <Text style={styles.macroLabel} numberOfLines={1}>
                      {n.nutrient_name}
                    </Text>
                    <Text style={styles.macroValue}>
                      {scaleNutrientAmount(n.amount, grams).toFixed(n.unit_name === 'kcal' ? 0 : 2)}{' '}
                      {n.unit_name}
                    </Text>
                  </View>
                ))}
              </>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailOpen(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppTheme.bgScreen },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  back: { color: AppTheme.accent, fontSize: 16, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: AppTheme.textPrimary },
  subtitle: { fontSize: 13, color: AppTheme.textMuted, marginTop: 4 },
  headerCard: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderRadius: AppTheme.radiusRow,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: AppTheme.radiusRow,
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  bannerText: { color: AppTheme.textMuted, fontSize: 13, lineHeight: 18 },
  input: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: AppTheme.radiusRow,
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
    color: AppTheme.textPrimary,
    fontSize: 16,
  },
  multiplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjustBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustBtnText: { color: '#fff', fontSize: 22, lineHeight: 24 },
  multiplierInput: {
    flex: 1,
    marginHorizontal: 0,
  },
  stagingArea: {
    marginTop: 10,
    marginBottom: 8,
    borderRadius: AppTheme.radiusRow,
    borderColor: AppTheme.border,
    borderWidth: 1,
    backgroundColor: '#121212',
    overflow: 'hidden',
  },
  stagingTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  stagingText: {
    color: '#a2a2a2',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  loadingRow: { alignItems: 'center', marginBottom: 6 },
  listFlex: { flex: 1, minHeight: 2 },
  listPad: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    minHeight: 68,
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusRow,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  rowTitle: { color: AppTheme.textPrimary, fontSize: 16, fontWeight: '600' },
  rowMeta: { color: AppTheme.textMuted, fontSize: 12, marginTop: 4 },
  empty: { color: AppTheme.textMuted, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: AppTheme.bgScreen,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  modalScrollContent: {
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: AppTheme.textPrimary, marginBottom: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: AppTheme.textMuted,
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { borderColor: AppTheme.accent, backgroundColor: AppTheme.card },
  chipText: { color: AppTheme.textPrimary, fontSize: 14 },
  chipTextActive: { color: AppTheme.accent, fontWeight: '600' },
  chipRow: { flexGrow: 0, marginBottom: 4 },
  gramsLine: { color: AppTheme.textMuted, fontSize: 13, marginTop: 6, marginBottom: 4 },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.border,
  },
  macroLabel: { flex: 1, color: AppTheme.textPrimary, marginRight: 8, fontSize: 14 },
  macroValue: { color: AppTheme.textMuted, fontSize: 14 },
  closeBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: AppTheme.radiusRow,
    backgroundColor: AppTheme.accent,
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

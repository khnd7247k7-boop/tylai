import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Keyboard,
  Platform,
  type TextInput as RNTextInput,
} from 'react-native';
import { AppTextInput as TextInput } from './AppTextInput';
import { AppTheme } from '../theme/appVisualTheme';
import type { LogFoodItem } from '../types/nutritionLogging';
import {
  createLogFoodItem,
  scaledMacrosForLogFoodItem,
  sumLogFoodItemMacros,
} from '../utils/logFoodItems';
import {
  NUMERIC_INPUT_ACCESSORY_ID,
  setNumericAccessoryChain,
} from '../keyboard/NumericInputAccessory';

type MacroField = 'protein' | 'carbs' | 'fat';

type Props = {
  items: LogFoodItem[];
  onChange: (items: LogFoodItem[]) => void;
  /** When the user removes the last remaining item (e.g. delete the whole meal). */
  onRemoveLastItem?: () => void;
  /** Scroll the sheet so the focused field stays above the keyboard. */
  onInputFocus?: (input: RNTextInput) => void;
};

/** Human-friendly quantity string (supports decimals like 0.5 / 1.5). */
function formatQty(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '1';
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

/** Parse a quantity while typing — null means incomplete (keep draft, don't snap). */
function parseQtyDraft(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, '');
  if (cleaned === '' || cleaned === '.' || cleaned === '0.') return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000) / 1000;
}

function sanitizeDecimalInput(text: string): string {
  // Allow digits and a single decimal point so users can type 1.5 / .5 freely.
  let cleaned = text.replace(/,/g, '').replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  return cleaned;
}

function parseMacroDraft(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, '');
  if (cleaned === '' || cleaned === '.') return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10) / 10;
}

function formatMacro(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  return String(Math.round(n * 10) / 10);
}

type ItemField = 'name' | 'amount' | 'qty' | MacroField;

export default function LogFoodItemBreakdown({
  items,
  onChange,
  onRemoveLastItem,
  onInputFocus,
}: Props) {
  const totals = sumLogFoodItemMacros(items);
  /** Draft qty text per item so partial decimals ("1.", ".5") don't snap back to 1. */
  const [qtyDraftById, setQtyDraftById] = useState<Record<string, string>>({});
  /** Draft macro text so ".", "10.", and clears stay visible while typing. */
  const [macroDraftById, setMacroDraftById] = useState<
    Record<string, Partial<Record<MacroField, string>>>
  >({});

  const nameRefs = useRef<Record<string, RNTextInput | null>>({});
  const amountRefs = useRef<Record<string, RNTextInput | null>>({});
  const qtyRefs = useRef<Record<string, RNTextInput | null>>({});
  const proteinRefs = useRef<Record<string, RNTextInput | null>>({});
  const carbsRefs = useRef<Record<string, RNTextInput | null>>({});
  const fatRefs = useRef<Record<string, RNTextInput | null>>({});

  useEffect(() => {
    const ids = new Set(items.map((item) => item.id));
    setQtyDraftById((prev) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const [id, text] of Object.entries(prev)) {
        if (ids.has(id)) next[id] = text;
        else changed = true;
      }
      return changed || Object.keys(next).length !== Object.keys(prev).length ? next : prev;
    });
    setMacroDraftById((prev) => {
      let changed = false;
      const next: Record<string, Partial<Record<MacroField, string>>> = {};
      for (const [id, draft] of Object.entries(prev)) {
        if (ids.has(id)) next[id] = draft;
        else changed = true;
      }
      return changed || Object.keys(next).length !== Object.keys(prev).length ? next : prev;
    });
  }, [items]);

  const updateItem = (id: string, patch: Partial<LogFoodItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const qtyTextFor = (item: LogFoodItem): string =>
    Object.prototype.hasOwnProperty.call(qtyDraftById, item.id)
      ? qtyDraftById[item.id]
      : formatQty(item.quantity);

  const handleQtyChange = (id: string, text: string) => {
    const cleaned = sanitizeDecimalInput(text);
    setQtyDraftById((prev) => ({ ...prev, [id]: cleaned }));
    const parsed = parseQtyDraft(cleaned);
    if (parsed != null) {
      updateItem(id, { quantity: parsed });
    }
  };

  const commitQty = (id: string) => {
    const draft = qtyDraftById[id];
    const item = items.find((row) => row.id === id);
    const parsed = draft != null ? parseQtyDraft(draft) : null;
    const finalQty =
      parsed != null
        ? parsed
        : item && item.quantity > 0
          ? item.quantity
          : 1;
    updateItem(id, { quantity: finalQty });
    setQtyDraftById((prev) => ({ ...prev, [id]: formatQty(finalQty) }));
  };

  const updateScaledMacro = (
    id: string,
    field: 'baseProtein' | 'baseCarbs' | 'baseFat',
    scaledValue: number
  ) => {
    const item = items.find((row) => row.id === id);
    if (!item) return;
    const q = item.quantity > 0 ? item.quantity : 1;
    updateItem(id, { [field]: Math.round((scaledValue / q) * 10) / 10 });
  };

  const macroTextFor = (item: LogFoodItem, field: MacroField, scaledValue: number): string => {
    const draft = macroDraftById[item.id]?.[field];
    if (draft != null) return draft;
    return formatMacro(scaledValue);
  };

  const handleMacroChange = (id: string, field: MacroField, text: string) => {
    const cleaned = sanitizeDecimalInput(text);
    setMacroDraftById((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: cleaned },
    }));
    const parsed = parseMacroDraft(cleaned);
    if (parsed != null) {
      const baseField =
        field === 'protein' ? 'baseProtein' : field === 'carbs' ? 'baseCarbs' : 'baseFat';
      updateScaledMacro(id, baseField, parsed);
    }
  };

  const commitMacro = (id: string, field: MacroField, scaledValue: number) => {
    const draft = macroDraftById[id]?.[field];
    const finalVal = draft != null ? parseMacroDraft(draft) ?? 0 : scaledValue;
    const baseField =
      field === 'protein' ? 'baseProtein' : field === 'carbs' ? 'baseCarbs' : 'baseFat';
    updateScaledMacro(id, baseField, finalVal);
    setMacroDraftById((prev) => {
      const current = prev[id];
      if (!current || current[field] == null) return prev;
      const nextDraft = { ...current };
      delete nextDraft[field];
      const next = { ...prev };
      if (Object.keys(nextDraft).length === 0) delete next[id];
      else next[id] = nextDraft;
      return next;
    });
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) {
      onRemoveLastItem?.();
      return;
    }
    onChange(items.filter((item) => item.id !== id));
  };

  const addItem = () => {
    onChange([
      ...items,
      createLogFoodItem({ name: 'New item', amount: '1 serving', baseProtein: 0, baseCarbs: 0, baseFat: 0 }),
    ]);
  };

  const refFor = (id: string, field: ItemField): RNTextInput | null => {
    if (field === 'name') return nameRefs.current[id] ?? null;
    if (field === 'amount') return amountRefs.current[id] ?? null;
    if (field === 'qty') return qtyRefs.current[id] ?? null;
    if (field === 'protein') return proteinRefs.current[id] ?? null;
    if (field === 'carbs') return carbsRefs.current[id] ?? null;
    return fatRefs.current[id] ?? null;
  };

  const fieldOrder: ItemField[] = ['name', 'amount', 'qty', 'protein', 'carbs', 'fat'];

  const neighbor = (itemIndex: number, field: ItemField, dir: -1 | 1): RNTextInput | null => {
    const fieldIndex = fieldOrder.indexOf(field);
    const nextFieldIndex = fieldIndex + dir;
    if (nextFieldIndex >= 0 && nextFieldIndex < fieldOrder.length) {
      return refFor(items[itemIndex].id, fieldOrder[nextFieldIndex]);
    }
    const nextItem = items[itemIndex + dir];
    if (!nextItem) return null;
    return refFor(nextItem.id, dir === 1 ? 'name' : 'fat');
  };

  const focusNeighbor = (itemIndex: number, field: ItemField, dir: -1 | 1) => {
    const target = neighbor(itemIndex, field, dir);
    if (target) target.focus();
    else Keyboard.dismiss();
  };

  const handleFieldFocus = (itemIndex: number, field: ItemField, input: RNTextInput | null) => {
    if (input) onInputFocus?.(input);
    setNumericAccessoryChain({
      focusPrev: neighbor(itemIndex, field, -1) ? () => focusNeighbor(itemIndex, field, -1) : undefined,
      focusNext: neighbor(itemIndex, field, 1) ? () => focusNeighbor(itemIndex, field, 1) : undefined,
    });
  };

  const numericPadProps = (itemIndex: number, field: ItemField) => ({
    inputAccessoryViewID: Platform.OS === 'ios' ? NUMERIC_INPUT_ACCESSORY_ID : undefined,
    returnKeyType: (neighbor(itemIndex, field, 1) ? 'next' : 'done') as 'next' | 'done',
    blurOnSubmit: false,
    onSubmitEditing: () => focusNeighbor(itemIndex, field, 1),
  });

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>What you ate (edit items & amounts)</Text>
      <Text style={styles.hint}>
        Change × Qty to scale an item (e.g. 0.5 or 1.5). Macros update automatically.
      </Text>

      {items.map((item, index) => {
        const scaled = scaledMacrosForLogFoodItem(item);
        return (
          <View key={item.id} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowIndex}>#{index + 1}</Text>
              <TouchableOpacity
                onPress={() => removeItem(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name}`}
              >
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Food</Text>
            <TextInput
              ref={(node) => {
                nameRefs.current[item.id] = node;
              }}
              style={styles.textInput}
              value={item.name}
              onChangeText={(text) => updateItem(item.id, { name: text })}
              placeholder="Item name"
              placeholderTextColor={AppTheme.textFaint}
              autoCapitalize="sentences"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => focusNeighbor(index, 'name', 1)}
              onFocus={() => handleFieldFocus(index, 'name', nameRefs.current[item.id])}
            />

            <View style={styles.amountQtyRow}>
              <View style={styles.amountCol}>
                <Text style={styles.fieldLabel}>Amount</Text>
                <TextInput
                  ref={(node) => {
                    amountRefs.current[item.id] = node;
                  }}
                  style={styles.textInput}
                  value={item.amount}
                  onChangeText={(text) => updateItem(item.id, { amount: text })}
                  placeholder="e.g. 1 cup, 6 oz"
                  placeholderTextColor={AppTheme.textFaint}
                  autoCapitalize="none"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => focusNeighbor(index, 'amount', 1)}
                  onFocus={() => handleFieldFocus(index, 'amount', amountRefs.current[item.id])}
                />
              </View>
              <Pressable
                style={styles.qtyCol}
                onPress={() => qtyRefs.current[item.id]?.focus()}
              >
                <Text style={styles.fieldLabel}>× Qty</Text>
                <TextInput
                  ref={(node) => {
                    qtyRefs.current[item.id] = node;
                  }}
                  style={styles.textInput}
                  value={qtyTextFor(item)}
                  onChangeText={(text) => handleQtyChange(item.id, text)}
                  onBlur={() => commitQty(item.id)}
                  placeholder="1"
                  placeholderTextColor={AppTheme.textFaint}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  accessibilityLabel={`Quantity multiplier for ${item.name}`}
                  onFocus={() => handleFieldFocus(index, 'qty', qtyRefs.current[item.id])}
                  {...numericPadProps(index, 'qty')}
                />
              </Pressable>
            </View>

            <View style={styles.macroRow}>
              <Pressable
                style={styles.macroCol}
                onPress={() => proteinRefs.current[item.id]?.focus()}
              >
                <Text style={styles.macroLabel}>P (g)</Text>
                <TextInput
                  ref={(node) => {
                    proteinRefs.current[item.id] = node;
                  }}
                  style={[styles.macroInput, styles.macroProtein]}
                  value={macroTextFor(item, 'protein', scaled.protein)}
                  onChangeText={(text) => handleMacroChange(item.id, 'protein', text)}
                  onBlur={() => commitMacro(item.id, 'protein', scaled.protein)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={AppTheme.textFaint}
                  onFocus={() => handleFieldFocus(index, 'protein', proteinRefs.current[item.id])}
                  {...numericPadProps(index, 'protein')}
                />
              </Pressable>
              <Pressable
                style={styles.macroCol}
                onPress={() => carbsRefs.current[item.id]?.focus()}
              >
                <Text style={styles.macroLabel}>C (g)</Text>
                <TextInput
                  ref={(node) => {
                    carbsRefs.current[item.id] = node;
                  }}
                  style={[styles.macroInput, styles.macroCarbs]}
                  value={macroTextFor(item, 'carbs', scaled.carbs)}
                  onChangeText={(text) => handleMacroChange(item.id, 'carbs', text)}
                  onBlur={() => commitMacro(item.id, 'carbs', scaled.carbs)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={AppTheme.textFaint}
                  onFocus={() => handleFieldFocus(index, 'carbs', carbsRefs.current[item.id])}
                  {...numericPadProps(index, 'carbs')}
                />
              </Pressable>
              <Pressable
                style={styles.macroCol}
                onPress={() => fatRefs.current[item.id]?.focus()}
              >
                <Text style={styles.macroLabel}>F (g)</Text>
                <TextInput
                  ref={(node) => {
                    fatRefs.current[item.id] = node;
                  }}
                  style={[styles.macroInput, styles.macroFat]}
                  value={macroTextFor(item, 'fat', scaled.fat)}
                  onChangeText={(text) => handleMacroChange(item.id, 'fat', text)}
                  onBlur={() => commitMacro(item.id, 'fat', scaled.fat)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={AppTheme.textFaint}
                  onFocus={() => handleFieldFocus(index, 'fat', fatRefs.current[item.id])}
                  {...numericPadProps(index, 'fat')}
                />
              </Pressable>
            </View>
          </View>
        );
      })}

      <TouchableOpacity style={styles.addBtn} onPress={addItem} activeOpacity={0.85}>
        <Text style={styles.addBtnText}>+ Add item</Text>
      </TouchableOpacity>

      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Meal total</Text>
        <Text style={styles.totalsValue}>
          {totals.calories} kcal · {totals.protein}g P · {totals.carbs}g C · {totals.fat}g F
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: AppTheme.radiusRow,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textMuted,
    marginBottom: 12,
  },
  row: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.border,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowIndex: {
    fontSize: 11,
    fontWeight: '700',
    color: AppTheme.textFaint,
    letterSpacing: 0.4,
  },
  removeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f87171',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: AppTheme.textMuted,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: AppTheme.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: AppTheme.textPrimary,
    marginBottom: 8,
  },
  amountQtyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  amountCol: {
    flex: 1,
  },
  qtyCol: {
    width: 88,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroCol: {
    flex: 1,
  },
  macroLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: AppTheme.textMuted,
    marginBottom: 4,
  },
  macroInput: {
    backgroundColor: AppTheme.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    paddingHorizontal: 8,
    paddingVertical: 10,
    minHeight: 44,
    fontSize: 14,
    fontWeight: '600',
    color: AppTheme.textPrimary,
    textAlign: 'center',
  },
  macroProtein: {
    borderColor: 'rgba(96, 165, 250, 0.45)',
  },
  macroCarbs: {
    borderColor: 'rgba(74, 222, 128, 0.45)',
  },
  macroFat: {
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  addBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.accent,
  },
  totalsRow: {
    paddingTop: 4,
  },
  totalsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: AppTheme.textMuted,
    marginBottom: 4,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  totalsValue: {
    fontSize: 14,
    fontWeight: '700',
    color: AppTheme.accent,
  },
});

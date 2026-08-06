import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { AppTheme } from '../../theme/appVisualTheme';
import type { Weekday } from '../../types/recurringMeals';
import {
  EVERY_DAY,
  WEEKDAY_LABELS,
  WEEKDAYS_ONLY,
  WEEKENDS_ONLY,
} from '../../types/recurringMeals';
import type { RecurringMealTemplate } from '../../types/recurringMeals';
import {
  addRecurringMealRule,
  describeRecurrence,
  materializeRecurringMeals,
} from '../../utils/recurringMealsStorage';

type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

type Props = {
  visible: boolean;
  mealName: string;
  template: RecurringMealTemplate | null;
  onClose: () => void;
  onSaved: (mealsUpdated: boolean) => void;
  onOnceToday?: () => void;
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addWeeksKey(key: string, weeks: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + weeks * 7);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const SLOT_OPTIONS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' },
];

export default function RecurringMealScheduleModal({
  visible,
  mealName,
  template,
  onClose,
  onSaved,
  onOnceToday,
}: Props): React.ReactElement {
  const [weekdays, setWeekdays] = useState<Weekday[]>([...EVERY_DAY]);
  const [slot, setSlot] = useState<MealSlot>('breakfast');
  const [durationMode, setDurationMode] = useState<'forever' | 'weeks' | 'until'>('forever');
  const [weeksInput, setWeeksInput] = useState('4');
  const [untilInput, setUntilInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !template) return;
    setWeekdays([...EVERY_DAY]);
    setSlot(template.mealSlot);
    setDurationMode('forever');
    setWeeksInput('4');
    setUntilInput(addWeeksKey(todayKey(), 4));
  }, [visible, template]);

  const summary = useMemo(() => {
    let end: string | null = null;
    if (durationMode === 'weeks') {
      const w = Math.max(1, parseInt(weeksInput, 10) || 1);
      end = addWeeksKey(todayKey(), w);
    } else if (durationMode === 'until') {
      end = untilInput.trim() || null;
    }
    return describeRecurrence(weekdays, end);
  }, [weekdays, durationMode, weeksInput, untilInput]);

  const toggleDay = (day: Weekday) => {
    setWeekdays((prev) => {
      if (prev.includes(day)) {
        const next = prev.filter((d) => d !== day);
        return next.length ? next : prev;
      }
      return [...prev, day].sort((a, b) => a - b) as Weekday[];
    });
  };

  const handleSave = async () => {
    if (!template) return;
    if (!weekdays.length) {
      Alert.alert('Pick at least one day', 'Choose which days this meal should repeat.');
      return;
    }

    let endDate: string | null = null;
    if (durationMode === 'weeks') {
      const w = Math.max(1, parseInt(weeksInput, 10) || 1);
      endDate = addWeeksKey(todayKey(), w);
    } else if (durationMode === 'until') {
      const raw = untilInput.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        Alert.alert('Check the end date', 'Use YYYY-MM-DD, for example 2026-12-31.');
        return;
      }
      if (raw < todayKey()) {
        Alert.alert('Check the end date', 'End date should be today or later.');
        return;
      }
      endDate = raw;
    }

    setSaving(true);
    try {
      await addRecurringMealRule({
        template: { ...template, mealSlot: slot },
        weekdays,
        startDate: todayKey(),
        endDate,
      });
      await materializeRecurringMeals();
      onSaved(true);
      onClose();
    } catch (e) {
      console.warn('[RecurringMealScheduleModal] save failed', e);
      Alert.alert('Could not save', 'Try again in a moment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.center}
        >
          <View style={styles.card}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Repeat meal</Text>
              <Text style={styles.intro}>
                Schedule “{mealName}” so it logs automatically on the days you choose.
              </Text>

              <Text style={styles.label}>How often</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    weekdays.length === 7 && styles.chipOn,
                  ]}
                  onPress={() => setWeekdays([...EVERY_DAY])}
                >
                  <Text style={[styles.chipText, weekdays.length === 7 && styles.chipTextOn]}>
                    Every day
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    weekdays.length === 5 &&
                      weekdays.every((d) => d >= 1 && d <= 5) &&
                      styles.chipOn,
                  ]}
                  onPress={() => setWeekdays([...WEEKDAYS_ONLY])}
                >
                  <Text
                    style={[
                      styles.chipText,
                      weekdays.length === 5 &&
                        weekdays.every((d) => d >= 1 && d <= 5) &&
                        styles.chipTextOn,
                    ]}
                  >
                    Weekdays
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    weekdays.length === 2 &&
                      weekdays.includes(0) &&
                      weekdays.includes(6) &&
                      styles.chipOn,
                  ]}
                  onPress={() => setWeekdays([...WEEKENDS_ONLY])}
                >
                  <Text
                    style={[
                      styles.chipText,
                      weekdays.length === 2 &&
                        weekdays.includes(0) &&
                        weekdays.includes(6) &&
                        styles.chipTextOn,
                    ]}
                  >
                    Weekends
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Days</Text>
              <View style={styles.dayRow}>
                {WEEKDAY_LABELS.map(({ day, short }) => {
                  const on = weekdays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayChip, on && styles.dayChipOn]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>{short}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Meal time</Text>
              <View style={styles.chipRow}>
                {SLOT_OPTIONS.map((opt) => {
                  const on = slot === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setSlot(opt.id)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>How long</Text>
              <View style={styles.chipRow}>
                {(
                  [
                    { id: 'forever', label: 'Ongoing' },
                    { id: 'weeks', label: 'For weeks' },
                    { id: 'until', label: 'Until date' },
                  ] as const
                ).map((opt) => {
                  const on = durationMode === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setDurationMode(opt.id)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {durationMode === 'weeks' ? (
                <>
                  <Text style={styles.hint}>Number of weeks from today</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={weeksInput}
                    onChangeText={setWeeksInput}
                    placeholder="4"
                    placeholderTextColor={AppTheme.textMuted}
                  />
                </>
              ) : null}

              {durationMode === 'until' ? (
                <>
                  <Text style={styles.hint}>End date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={untilInput}
                    onChangeText={setUntilInput}
                    placeholder="2026-12-31"
                    placeholderTextColor={AppTheme.textMuted}
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                  />
                </>
              ) : null}

              <Text style={styles.summary}>{summary}</Text>

              {onOnceToday ? (
                <TouchableOpacity
                  style={styles.onceBtn}
                  onPress={() => {
                    onOnceToday();
                    onClose();
                  }}
                  disabled={saving}
                >
                  <Text style={styles.onceBtnText}>Just once · today only</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onClose} disabled={saving}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSave]}
                  onPress={() => handleSave().catch(console.error)}
                  disabled={saving}
                >
                  <Text style={styles.btnSaveText}>{saving ? 'Saving…' : 'Start repeating'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  center: { width: '100%', maxHeight: '92%' },
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: AppTheme.textPrimary,
    marginBottom: 6,
  },
  intro: {
    fontSize: 14,
    color: AppTheme.textMuted,
    lineHeight: 20,
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: AppTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: AppTheme.textFaint,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: AppTheme.bgScreen,
  },
  chipOn: {
    borderColor: AppTheme.accent,
    backgroundColor: AppTheme.accent,
  },
  chipText: {
    color: AppTheme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextOn: {
    color: AppTheme.accentDark,
    fontWeight: '800',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 12,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.bgScreen,
  },
  dayChipOn: {
    borderColor: AppTheme.accent,
    backgroundColor: AppTheme.accent,
  },
  dayChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppTheme.textMuted,
  },
  dayChipTextOn: {
    color: AppTheme.accentDark,
  },
  input: {
    backgroundColor: AppTheme.bgScreen,
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: AppTheme.textPrimary,
    fontSize: 16,
    marginBottom: 12,
  },
  summary: {
    fontSize: 13,
    color: AppTheme.accent,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 4,
  },
  onceBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  onceBtnText: {
    color: AppTheme.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
  },
  btnCancel: {
    backgroundColor: AppTheme.bgScreen,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  btnSave: {
    backgroundColor: AppTheme.accent,
  },
  btnCancelText: {
    color: AppTheme.textSecondary,
    fontWeight: '600',
  },
  btnSaveText: {
    color: AppTheme.accentDark,
    fontWeight: '800',
  },
});

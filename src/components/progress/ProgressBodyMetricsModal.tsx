import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { AppTheme } from '../../theme/appVisualTheme';
import { loadUserData, saveUserData } from '../../utils/userStorage';
import { notifyUserDataReady } from '../../utils/userDataEvents';
import type { WeightEntry } from '../../utils/workoutHistoryChartData';
import type { CustomBodyMeasurement, MeasurementEntry } from '../../types/bodyMeasurements';

interface ProgressBodyMetricsModalProps {
  visible: boolean;
  /** Prefill date (YYYY-MM-DD), e.g. focused progress week. */
  initialDate?: string | null;
  onClose: () => void;
  /** Called after a successful save with the date key that was written. */
  onSaved?: (savedDateKey: string) => void;
}

type CustomDraft = {
  id: string;
  label: string;
  value: string;
  unit: string;
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseOptionalPositive(raw: string, label: string, max: number): number | null | undefined {
  const trimmed = raw.trim().replace(/,/g, '.');
  if (!trimmed) return undefined;
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0 || n > max) {
    Alert.alert('Check your numbers', `Enter a valid ${label} (for example a positive number under ${max}).`);
    return null;
  }
  return Math.round(n * 10) / 10;
}

function parseDateInput(dateStr: string): Date | null {
  const isoLike = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!isoLike) {
    Alert.alert(
      'Check the date',
      'Use Year-Month-Day with four digits for the year, for example 2026-04-01.'
    );
    return null;
  }
  const y = Number(isoLike[1]);
  const mo = Number(isoLike[2]);
  const d = Number(isoLike[3]);
  const noonLocal = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (
    noonLocal.getFullYear() !== y ||
    noonLocal.getMonth() !== mo - 1 ||
    noonLocal.getDate() !== d
  ) {
    Alert.alert('Check the date', 'That calendar date is not valid. Example: 2026-04-01.');
    return null;
  }
  return noonLocal;
}

function dayKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ProgressBodyMetricsModal({
  visible,
  initialDate,
  onClose,
  onSaved,
}: ProgressBodyMetricsModalProps): React.ReactElement {
  const [weightInput, setWeightInput] = useState('');
  const [waistInput, setWaistInput] = useState('');
  const [chestInput, setChestInput] = useState('');
  const [hipsInput, setHipsInput] = useState('');
  const [customRows, setCustomRows] = useState<CustomDraft[]>([]);
  const [dateInput, setDateInput] = useState(todayKey());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const key = initialDate?.slice(0, 10) || todayKey();
    setDateInput(key);
    setWeightInput('');
    setWaistInput('');
    setChestInput('');
    setHipsInput('');
    setCustomRows([]);

    void (async () => {
      const [weights, measurements] = await Promise.all([
        loadUserData<WeightEntry[]>('weightEntries'),
        loadUserData<MeasurementEntry[]>('measurementEntries'),
      ]);
      const weightSameDay = (weights ?? []).find(
        (e) => dayKeyFromDate(new Date(e.date)) === key
      );
      if (weightSameDay) setWeightInput(String(weightSameDay.weight));

      const mSameDay = (measurements ?? []).find((e) => e.date.slice(0, 10) === key);
      if (mSameDay?.waistIn != null) setWaistInput(String(mSameDay.waistIn));
      if (mSameDay?.chestIn != null) setChestInput(String(mSameDay.chestIn));
      if (mSameDay?.hipsIn != null) setHipsInput(String(mSameDay.hipsIn));
      if (mSameDay?.custom?.length) {
        setCustomRows(
          mSameDay.custom.map((c) => ({
            id: c.id,
            label: c.label,
            value: String(c.value),
            unit: c.unit?.trim() || 'in',
          }))
        );
      }
    })();
  }, [visible, initialDate]);

  const addCustomRow = () => {
    setCustomRows((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: '',
        value: '',
        unit: 'in',
      },
    ]);
  };

  const updateCustomRow = (id: string, patch: Partial<CustomDraft>) => {
    setCustomRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeCustomRow = (id: string) => {
    setCustomRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleSave = async () => {
    const noonLocal = parseDateInput(dateInput);
    if (!noonLocal) return;

    const weight = parseOptionalPositive(weightInput, 'weight in pounds', 999);
    if (weight === null) return;
    const waistIn = parseOptionalPositive(waistInput, 'waist in inches', 99);
    if (waistIn === null) return;
    const chestIn = parseOptionalPositive(chestInput, 'chest in inches', 99);
    if (chestIn === null) return;
    const hipsIn = parseOptionalPositive(hipsInput, 'hips in inches', 99);
    if (hipsIn === null) return;

    const custom: CustomBodyMeasurement[] = [];
    for (const row of customRows) {
      const label = row.label.trim();
      const valueRaw = row.value.trim();
      if (!label && !valueRaw) continue;
      if (!label) {
        Alert.alert('Name your measurement', 'Give each added measurement a name (for example Neck).');
        return;
      }
      const value = parseOptionalPositive(valueRaw, label, 999);
      if (value === null) return;
      if (value == null) {
        Alert.alert('Add a value', `Enter a number for “${label}”.`);
        return;
      }
      custom.push({
        id: row.id,
        label,
        value,
        unit: row.unit.trim() || 'in',
      });
    }

    if (
      weight == null &&
      waistIn == null &&
      chestIn == null &&
      hipsIn == null &&
      custom.length === 0
    ) {
      Alert.alert('Add a value', 'Enter weight and/or at least one measurement before saving.');
      return;
    }

    setSaving(true);
    try {
      const dateIso = noonLocal.toISOString();
      const dateKey = dayKeyFromDate(noonLocal);
      let wroteMeasurements = false;

      if (weight != null) {
        const existing = (await loadUserData<WeightEntry[]>('weightEntries')) ?? [];
        const newEntry: WeightEntry = {
          id: Date.now().toString(),
          date: dateIso,
          weight,
        };
        const idx = existing.findIndex(
          (e) => new Date(e.date).toDateString() === noonLocal.toDateString()
        );
        let updated = [...existing];
        if (idx >= 0) updated[idx] = newEntry;
        else updated = [newEntry, ...updated];
        updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        await saveUserData('weightEntries', updated);
      }

      const shouldWriteMeasurements =
        waistIn != null ||
        chestIn != null ||
        hipsIn != null ||
        custom.length > 0 ||
        customRows.length > 0;

      if (shouldWriteMeasurements) {
        const existing = (await loadUserData<MeasurementEntry[]>('measurementEntries')) ?? [];
        const prev = existing.find((e) => e.date.slice(0, 10) === dateKey);
        const newEntry: MeasurementEntry = {
          id: prev?.id ?? `m-${Date.now()}`,
          date: dateKey,
          waistIn: waistIn ?? prev?.waistIn,
          chestIn: chestIn ?? prev?.chestIn,
          hipsIn: hipsIn ?? prev?.hipsIn,
          custom:
            customRows.length === 0
              ? undefined
              : custom.length > 0
                ? custom
                : prev?.custom,
        };

        const idx = existing.findIndex((e) => e.date.slice(0, 10) === dateKey);
        let updated = [...existing];
        if (idx >= 0) updated[idx] = newEntry;
        else updated = [newEntry, ...updated];
        updated.sort((a, b) => b.date.localeCompare(a.date));
        await saveUserData('measurementEntries', updated);

        const verify = (await loadUserData<MeasurementEntry[]>('measurementEntries')) ?? [];
        const saved = verify.find((e) => e.date.slice(0, 10) === dateKey);
        if (!saved) {
          throw new Error('Measurement entry missing after save');
        }
        if (custom.length > 0) {
          const savedLabels = new Set(
            (saved.custom ?? []).map((c) => c.label.trim().toLowerCase())
          );
          const missing = custom.filter((c) => !savedLabels.has(c.label.trim().toLowerCase()));
          if (missing.length) {
            throw new Error(`Custom measurements failed to persist: ${missing.map((m) => m.label).join(', ')}`);
          }
        }
        wroteMeasurements = true;
      }

      notifyUserDataReady();
      onSaved?.(dateKey);
      onClose();
      if (wroteMeasurements || weight != null) {
        const extras =
          custom.length > 0
            ? ` · ${custom.map((c) => c.label).join(', ')}`
            : '';
        Alert.alert('Saved', `Measurements updated for ${dateKey}${extras}.`);
      }
    } catch (e) {
      console.warn('[ProgressBodyMetricsModal] save failed', e);
      Alert.alert('Could not save', 'Try again in a moment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.center}
        >
          <View style={styles.card}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.title}>Log weight & measurements</Text>
              <Text style={styles.intro}>
                Add what you measured today. Leave a field blank to skip it. Use Add measurement for
                anything else (neck, arms, etc.).
              </Text>

              <Text style={styles.label}>Date</Text>
              <Text style={styles.hint}>Format: YYYY-MM-DD</Text>
              <TextInput
                style={styles.input}
                placeholder={todayKey()}
                placeholderTextColor={AppTheme.textMuted}
                value={dateInput}
                onChangeText={setDateInput}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.label}>Weight (lb)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 182.4"
                placeholderTextColor={AppTheme.textMuted}
                keyboardType="decimal-pad"
                value={weightInput}
                onChangeText={setWeightInput}
              />

              <Text style={styles.label}>Waist (in)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 32.5"
                placeholderTextColor={AppTheme.textMuted}
                keyboardType="decimal-pad"
                value={waistInput}
                onChangeText={setWaistInput}
              />

              <Text style={styles.label}>Chest (in)</Text>
              <TextInput
                style={styles.input}
                placeholder="optional"
                placeholderTextColor={AppTheme.textMuted}
                keyboardType="decimal-pad"
                value={chestInput}
                onChangeText={setChestInput}
              />

              <Text style={styles.label}>Hips (in)</Text>
              <TextInput
                style={styles.input}
                placeholder="optional"
                placeholderTextColor={AppTheme.textMuted}
                keyboardType="decimal-pad"
                value={hipsInput}
                onChangeText={setHipsInput}
              />

              {customRows.map((row) => (
                <View key={row.id} style={styles.customBlock}>
                  <View style={styles.customHeader}>
                    <Text style={styles.label}>Custom measurement</Text>
                    <TouchableOpacity onPress={() => removeCustomRow(row.id)} hitSlop={8}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Name (e.g. Neck)"
                    placeholderTextColor={AppTheme.textMuted}
                    value={row.label}
                    onChangeText={(text) => updateCustomRow(row.id, { label: text })}
                    autoCapitalize="words"
                  />
                  <View style={styles.customValueRow}>
                    <TextInput
                      style={[styles.input, styles.customValueInput]}
                      placeholder="Value"
                      placeholderTextColor={AppTheme.textMuted}
                      keyboardType="decimal-pad"
                      value={row.value}
                      onChangeText={(text) => updateCustomRow(row.id, { value: text })}
                    />
                    <TextInput
                      style={[styles.input, styles.customUnitInput]}
                      placeholder="in"
                      placeholderTextColor={AppTheme.textMuted}
                      value={row.unit}
                      onChangeText={(text) => updateCustomRow(row.id, { unit: text })}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addBtn}
                onPress={addCustomRow}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Text style={styles.addBtnText}>+ Add measurement</Text>
              </TouchableOpacity>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnCancel]}
                  onPress={onClose}
                  disabled={saving}
                >
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSave]}
                  onPress={() => handleSave().catch(console.error)}
                  disabled={saving}
                >
                  <Text style={styles.btnSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  center: { width: '100%', maxHeight: '90%' },
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: AppTheme.border,
    maxHeight: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  intro: {
    fontSize: 14,
    color: AppTheme.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textSecondary,
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: AppTheme.textMuted,
    marginBottom: 8,
  },
  input: {
    backgroundColor: AppTheme.bgScreen,
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 14,
  },
  customBlock: {
    marginBottom: 4,
  },
  customHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  removeText: {
    color: AppTheme.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  customValueRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customValueInput: {
    flex: 1,
  },
  customUnitInput: {
    width: 72,
  },
  addBtn: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: AppTheme.bgScreen,
  },
  addBtnText: {
    color: AppTheme.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    fontWeight: '700',
  },
});

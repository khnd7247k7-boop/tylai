import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { AppTextInput as TextInput } from '../AppTextInput';
import { AppTheme } from '../../theme/appVisualTheme';
import { useToast } from '../ToastProvider';
import { subscribeUserDataReady } from '../../utils/userDataEvents';
import {
  addWaterOunces,
  getTodayWaterTotal,
  loadWaterLogEntries,
  loadWaterQuickAmounts,
  undoLastWaterEntryToday,
} from '../../utils/waterLog';

interface WaterTrackerSectionProps {
  waterGoalOz: number;
}

function formatOz(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

export default function WaterTrackerSection({
  waterGoalOz,
}: WaterTrackerSectionProps): React.ReactElement {
  const { showToast } = useToast();
  const [todayTotal, setTodayTotal] = useState(0);
  const [quickAmounts, setQuickAmounts] = useState<number[]>([]);
  const [customOz, setCustomOz] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const [entries, quick] = await Promise.all([
      loadWaterLogEntries(),
      loadWaterQuickAmounts(),
    ]);
    setTodayTotal(getTodayWaterTotal(entries));
    setQuickAmounts(quick);
  }, []);

  useEffect(() => {
    void reload();
    return subscribeUserDataReady(() => {
      void reload();
    });
  }, [reload]);

  const goal = Math.max(1, Number(waterGoalOz) || 64);
  const pct = Math.min(100, (todayTotal / goal) * 100);

  const logAmount = async (ounces: number) => {
    if (saving) return;
    setSaving(true);
    Keyboard.dismiss();
    try {
      const result = await addWaterOunces(ounces);
      setTodayTotal(result.todayTotal);
      setQuickAmounts(result.quickAmounts);
      setCustomOz('');
      showToast(`+${formatOz(result.added)} fl oz water`, 'success', 2200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not log water.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustom = () => {
    const parsed = parseFloat(customOz.replace(/,/g, '').trim());
    void logAmount(parsed);
  };

  const handleUndo = async () => {
    if (saving || todayTotal <= 0) return;
    setSaving(true);
    try {
      const result = await undoLastWaterEntryToday();
      if (!result) {
        showToast('Nothing to undo today.', 'info');
        return;
      }
      setTodayTotal(result.todayTotal);
      showToast('Removed last water log', 'info', 2200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Water</Text>
      <View style={styles.card}>
        <View style={styles.totalRow}>
          <Text style={styles.totalBig}>
            {formatOz(Math.round(todayTotal * 10) / 10)}{' '}
            <Text style={styles.totalUnit}>/ {formatOz(goal)} fl oz</Text>
          </Text>
          {todayTotal > 0 ? (
            <TouchableOpacity onPress={() => void handleUndo()} hitSlop={10} disabled={saving}>
              <Text style={styles.undoText}>Undo</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>

        <Text style={styles.addLabel}>Add water</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={customOz}
            onChangeText={setCustomOz}
            placeholder="fl oz"
            placeholderTextColor={AppTheme.textFaint}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={handleAddCustom}
            editable={!saving}
          />
          <TouchableOpacity
            style={[styles.addBtn, saving && styles.addBtnDisabled]}
            onPress={handleAddCustom}
            activeOpacity={0.85}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Add water"
          >
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {quickAmounts.length > 0 ? (
          <>
            <Text style={styles.quickLabel}>Tap to add again</Text>
            <View style={styles.quickRow}>
              {quickAmounts.map((oz) => (
                <TouchableOpacity
                  key={oz}
                  style={styles.quickChip}
                  onPress={() => void logAmount(oz)}
                  activeOpacity={0.85}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${formatOz(oz)} fluid ounces`}
                >
                  <Text style={styles.quickChipText}>{formatOz(oz)} fl oz</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.hint}>
            Log an amount once — your last 3 sizes show up here for quick refill tracking.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    backgroundColor: AppTheme.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 14,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalBig: {
    fontSize: 22,
    fontWeight: '800',
    color: AppTheme.textPrimary,
  },
  totalUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: AppTheme.textMuted,
  },
  undoText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textMuted,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: AppTheme.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#4dabf7',
  },
  addLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: AppTheme.textMuted,
    marginBottom: 8,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: AppTheme.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  addBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: AppTheme.radiusPill,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  addBtnDisabled: {
    opacity: 0.55,
  },
  addBtnText: {
    color: AppTheme.accentDark,
    fontWeight: '800',
    fontSize: 14,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: AppTheme.textMuted,
    marginBottom: 8,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: AppTheme.radiusPill,
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: 'rgba(77, 171, 247, 0.45)',
  },
  quickChipText: {
    color: '#4dabf7',
    fontWeight: '700',
    fontSize: 13,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textFaint,
  },
});

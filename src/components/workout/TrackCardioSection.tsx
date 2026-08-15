/**
 * Track Cardio — type + duration, with optional Apple Watch workout merge.
 * Used on Log Workout and as the finish-workout prompt.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppTextInput as TextInput } from '../AppTextInput';
import type { CardioLog } from '../../../data/workoutPrograms';
import { CARDIO_ACTIVITIES, normalizeCardioActivity } from '../../constants/cardioActivities';
import HealthService from '../../services/HealthService';
import type { HealthKitWorkoutSample } from '../../native/healthKitBridge';

export type WorkoutCardioSummary = {
  name: string;
  exerciseNames: string[];
  durationMin?: number;
};

type Props = {
  value: CardioLog | null;
  onChange: (next: CardioLog | null) => void;
  windowStart: Date;
  windowEnd: Date;
  workoutSummary?: WorkoutCardioSummary | null;
  compact?: boolean;
};

function formatWatchChip(w: HealthKitWorkoutSample): string {
  const mins = Math.max(1, Math.round(w.durationMin));
  const bits = [`${w.activityLabel}`, `${mins} min`];
  if (w.distanceM && w.distanceM > 50) {
    bits.push(`${(w.distanceM / 1000).toFixed(w.distanceM >= 1000 ? 1 : 2)} km`);
  }
  if (w.calories && w.calories > 0) {
    bits.push(`${Math.round(w.calories)} kcal`);
  }
  return bits.join(' · ');
}

function logFromWatch(
  watch: HealthKitWorkoutSample,
  overrides?: Partial<Pick<CardioLog, 'activity' | 'durationMin'>>
): CardioLog {
  const activity = normalizeCardioActivity(overrides?.activity ?? watch.activityLabel);
  const durationMin = Math.max(
    1,
    Math.round(overrides?.durationMin ?? watch.durationMin)
  );
  const edited =
    (overrides?.activity != null &&
      normalizeCardioActivity(overrides.activity) !== normalizeCardioActivity(watch.activityLabel)) ||
    (overrides?.durationMin != null &&
      Math.round(overrides.durationMin) !== Math.round(watch.durationMin));
  return {
    activity,
    durationMin,
    distanceM: watch.distanceM,
    calories: watch.calories != null ? Math.round(watch.calories) : undefined,
    source: edited ? 'mixed' : 'healthkit',
    watchWorkoutId: watch.uuid,
  };
}

export default function TrackCardioSection({
  value,
  onChange,
  windowStart,
  windowEnd,
  workoutSummary,
  compact = false,
}: Props): React.ReactElement {
  const enabled = value != null;
  const [watchRows, setWatchRows] = useState<HealthKitWorkoutSample[]>([]);
  const [loadingWatch, setLoadingWatch] = useState(false);
  const [customActivity, setCustomActivity] = useState('');

  const windowStartMs = windowStart.getTime();
  const windowEndMs = windowEnd.getTime();

  useEffect(() => {
    let cancelled = false;
    setLoadingWatch(true);
    HealthService.fetchNearbyCardioWorkouts(new Date(windowStartMs), new Date(windowEndMs))
      .then((rows) => {
        if (!cancelled) setWatchRows(rows);
      })
      .catch(() => {
        if (!cancelled) setWatchRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingWatch(false);
      });
    return () => {
      cancelled = true;
    };
  }, [windowStartMs, windowEndMs]);

  const selectedWatch = useMemo(
    () => watchRows.find((w) => w.uuid === value?.watchWorkoutId) ?? null,
    [watchRows, value?.watchWorkoutId]
  );

  const applyManual = (activity: string, durationMin: number) => {
    const trimmed = activity.trim() || 'Cardio';
    if (selectedWatch) {
      onChange(logFromWatch(selectedWatch, { activity: trimmed, durationMin }));
      return;
    }
    onChange({
      activity: normalizeCardioActivity(trimmed),
      durationMin: Math.max(1, Math.round(durationMin) || 1),
      source: 'manual',
    });
  };

  const enableEmpty = () => {
    onChange({
      activity: 'Running',
      durationMin: 20,
      source: 'manual',
    });
  };

  const knownChipSelected = CARDIO_ACTIVITIES.some(
    (a) => a.toLowerCase() === String(value?.activity ?? '').toLowerCase()
  );

  return (
    <View style={[styles.section, compact && styles.sectionCompact]}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Track Cardio</Text>
        <TouchableOpacity
          onPress={() => (enabled ? onChange(null) : enableEmpty())}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={enabled ? 'Remove cardio' : 'Add cardio'}
        >
          <Text style={styles.toggleText}>{enabled ? 'Remove' : 'Add'}</Text>
        </TouchableOpacity>
      </View>

      {workoutSummary && (workoutSummary.name || workoutSummary.exerciseNames.length > 0) ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>From this workout</Text>
          {workoutSummary.name ? (
            <Text style={styles.summaryName}>{workoutSummary.name}</Text>
          ) : null}
          {workoutSummary.durationMin != null ? (
            <Text style={styles.summaryMeta}>{workoutSummary.durationMin} min logged</Text>
          ) : null}
          {workoutSummary.exerciseNames.length > 0 ? (
            <Text style={styles.summaryMeta} numberOfLines={3}>
              {workoutSummary.exerciseNames.slice(0, 8).join(' · ')}
              {workoutSummary.exerciseNames.length > 8
                ? ` · +${workoutSummary.exerciseNames.length - 8} more`
                : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.hintText}>
        Add the type and how long you went. If Apple Watch logged a session nearby, tap it to
        combine calories and distance with what you enter.
      </Text>

      {loadingWatch ? (
        <View style={styles.watchLoading}>
          <ActivityIndicator color="#00ff88" />
          <Text style={styles.watchLoadingText}>Looking for watch workouts…</Text>
        </View>
      ) : watchRows.length > 0 ? (
        <View style={styles.watchBlock}>
          <Text style={styles.watchLabel}>From your watch</Text>
          {watchRows.map((w) => {
            const selected = value?.watchWorkoutId === w.uuid;
            return (
              <TouchableOpacity
                key={w.uuid}
                style={[styles.watchChip, selected && styles.watchChipSelected]}
                onPress={() => {
                  if (selected) {
                    onChange(
                      value
                        ? {
                            activity: value.activity,
                            durationMin: value.durationMin,
                            source: 'manual',
                          }
                        : null
                    );
                    return;
                  }
                  onChange(logFromWatch(w));
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.watchChipText, selected && styles.watchChipTextSelected]}>
                  {formatWatchChip(w)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {enabled && value ? (
        <>
          <Text style={styles.fieldLabel}>Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {CARDIO_ACTIVITIES.map((name) => {
              const selected = value.activity.toLowerCase() === name.toLowerCase();
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.typeChip, selected && styles.typeChipSelected]}
                  onPress={() => {
                    setCustomActivity('');
                    applyManual(name, value.durationMin);
                  }}
                >
                  <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {!knownChipSelected || customActivity.length > 0 ? (
            <TextInput
              style={styles.input}
              placeholder="Custom type (e.g. assault bike)"
              placeholderTextColor="#666"
              value={customActivity || (knownChipSelected ? '' : value.activity)}
              onChangeText={(text) => {
                setCustomActivity(text);
                applyManual(text || 'Other', value.durationMin);
              }}
            />
          ) : (
            <TouchableOpacity onPress={() => setCustomActivity(value.activity)} hitSlop={8}>
              <Text style={styles.customLink}>Use a custom type</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.fieldLabel}>Duration (minutes)</Text>
          <TextInput
            style={styles.input}
            placeholder="20"
            placeholderTextColor="#666"
            keyboardType="number-pad"
            value={String(value.durationMin || '')}
            onChangeText={(text) => {
              const n = parseInt(text.replace(/[^\d]/g, ''), 10);
              applyManual(value.activity, Number.isFinite(n) ? n : 0);
            }}
          />

          {(value.calories != null || value.distanceM != null) && value.source !== 'manual' ? (
            <Text style={styles.mergedNote}>
              Watch data included
              {value.calories != null ? ` · ${value.calories} kcal` : ''}
              {value.distanceM != null
                ? ` · ${(value.distanceM / 1000).toFixed(value.distanceM >= 1000 ? 1 : 2)} km`
                : ''}
              {value.source === 'mixed' ? ' · edited' : ''}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 25 },
  sectionCompact: { marginBottom: 8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  toggleText: {
    color: '#00ff88',
    fontSize: 15,
    fontWeight: '700',
  },
  hintText: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    padding: 12,
    marginBottom: 12,
  },
  summaryLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryMeta: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
  },
  watchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  watchLoadingText: { color: '#888', fontSize: 13 },
  watchBlock: { marginBottom: 12, gap: 8 },
  watchLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  watchChip: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  watchChipSelected: {
    borderColor: '#00ff88',
    backgroundColor: '#2a4a2a',
  },
  watchChipText: { color: '#ddd', fontSize: 13, fontWeight: '600' },
  watchChipTextSelected: { color: '#00ff88' },
  fieldLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  chipRow: { gap: 8, paddingBottom: 10 },
  typeChip: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  typeChipSelected: {
    borderColor: '#00ff88',
    backgroundColor: '#2a4a2a',
  },
  typeChipText: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  typeChipTextSelected: { color: '#00ff88' },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  customLink: {
    color: '#00ff88',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  mergedNote: {
    color: '#00ff88',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});

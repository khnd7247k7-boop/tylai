import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppTheme } from '../theme/appVisualTheme';
import type { ScheduleProfile } from '../types/coachingProfile';
import {
  DAY_NAMES_ORDER,
  scheduleModeDescription,
  sortWeeklyTrainingDays,
  type CustomPlanScheduleMode,
} from '../utils/customWorkoutPlan';
import {
  applyDaysPerWeekChange,
  applyScheduleModeChange,
  toggleWeeklyTrainingDay,
} from '../utils/trainingSchedule';

type Props = {
  schedule: ScheduleProfile;
  onChange: (schedule: ScheduleProfile) => void;
  /** When false, days-per-week chips are hidden (parent already collected them). */
  showDaysPerWeek?: boolean;
};

export default function TrainingScheduleFields({
  schedule,
  onChange,
  showDaysPerWeek = true,
}: Props) {
  const daysPerWeek = schedule.daysPerWeek ?? 0;
  const scheduleMode = schedule.scheduleMode;
  const weeklySelected = schedule.trainingDays ?? [];

  return (
    <View>
      {showDaysPerWeek ? (
        <>
          <Text style={styles.fieldLabel}>Days per week you can train</Text>
          <View style={styles.chipRow}>
            {[2, 3, 4, 5, 6].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, daysPerWeek === d && styles.chipSelected]}
                onPress={() => onChange(applyDaysPerWeekChange(schedule, d))}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, daysPerWeek === d && styles.chipTextSelected]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.fieldLabel}>How should we schedule workouts?</Text>
      <Text style={styles.hint}>
        Pick fixed weekdays, or a flexible rotation you can follow in any order with rest days when you need them.
      </Text>
      <View style={styles.modeRow}>
        {(
          [
            ['weekly_split', 'Weekly split', 'Pick Mon, Tue, Thu…'] as const,
            ['flexible_days', 'Flexible days', 'Rotate workouts · rest anytime'] as const,
          ] as const
        ).map(([mode, title, subtitle]) => (
          <TouchableOpacity
            key={mode}
            style={[styles.modeCard, scheduleMode === mode && styles.modeCardSelected]}
            onPress={() => onChange(applyScheduleModeChange(schedule, mode))}
            activeOpacity={0.85}
          >
            <Text style={[styles.modeTitle, scheduleMode === mode && styles.modeTitleSelected]}>
              {title}
            </Text>
            <Text style={styles.modeSubtitle}>{subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {scheduleMode === 'weekly_split' && daysPerWeek > 0 ? (
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Training days</Text>
          <Text style={styles.hint}>
            Select {daysPerWeek} {daysPerWeek === 1 ? 'day' : 'days'} ({weeklySelected.length}/{daysPerWeek})
          </Text>
          <View style={styles.dayRow}>
            {DAY_NAMES_ORDER.map((day) => {
              const selected = weeklySelected.includes(day);
              const atLimit = !selected && weeklySelected.length >= daysPerWeek;
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayChip,
                    selected && styles.dayChipSelected,
                    atLimit && styles.dayChipDisabled,
                  ]}
                  onPress={() => onChange(toggleWeeklyTrainingDay(schedule, day))}
                  disabled={atLimit}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      selected && styles.dayChipTextSelected,
                      atLimit && styles.dayChipTextDisabled,
                    ]}
                  >
                    {day.slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {weeklySelected.length > 0 ? (
            <Text style={styles.selectedLine}>
              Selected: {sortWeeklyTrainingDays(weeklySelected).join(', ')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {scheduleMode === 'flexible_days' && daysPerWeek > 0 ? (
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Workouts in rotation</Text>
          <Text style={styles.hint}>
            {scheduleModeDescription('flexible_days', daysPerWeek)} — train on whatever days fit your week.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    color: AppTheme.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  hint: {
    color: AppTheme.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.bgElevated,
  },
  chipSelected: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
  },
  chipText: {
    color: AppTheme.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: AppTheme.accent,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  modeCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: AppTheme.bgElevated,
  },
  modeCardSelected: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
  },
  modeTitle: {
    color: AppTheme.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  modeTitleSelected: {
    color: AppTheme.accent,
  },
  modeSubtitle: {
    color: AppTheme.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  section: {
    marginTop: 8,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
    backgroundColor: AppTheme.bgElevated,
  },
  dayChipSelected: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
  },
  dayChipDisabled: {
    opacity: 0.45,
  },
  dayChipText: {
    color: AppTheme.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  dayChipTextSelected: {
    color: AppTheme.accent,
  },
  dayChipTextDisabled: {
    color: AppTheme.textMuted,
  },
  selectedLine: {
    color: AppTheme.accent,
    fontSize: 13,
    marginTop: 10,
    fontWeight: '600',
  },
});

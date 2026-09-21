import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AppTheme } from '../../theme/appVisualTheme';
import {
  dailyHealthHasActivity,
  formatCompactSteps,
  type DailyHealthSummary,
} from '../../services/dailyHealthSummaryService';

interface HealthActivityCalendarProps {
  month: Date;
  summaries: Record<string, DailyHealthSummary>;
  selectedDateKey: string | null;
  onSelectDate: (dateKey: string) => void;
  onMonthChange: (next: Date) => void;
  loading?: boolean;
}

function dateKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function HealthActivityCalendar({
  month,
  summaries,
  selectedDateKey,
  onSelectDate,
  onMonthChange,
  loading = false,
}: HealthActivityCalendarProps): React.ReactElement {
  const { year, monthIndex, days, monthLabel, todayKey } = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const cells: Array<number | null> = [];
    for (let i = 0; i < first.getDay(); i += 1) cells.push(null);
    for (let d = 1; d <= last.getDate(); d += 1) cells.push(d);
    const now = new Date();
    return {
      year: y,
      monthIndex: m,
      days: cells,
      monthLabel: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      todayKey: dateKey(now.getFullYear(), now.getMonth(), now.getDate()),
    };
  }, [month]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
          hitSlop={10}
        >
          <Text style={styles.nav}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.month}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={() => onMonthChange(new Date(year, monthIndex + 1, 1))}
          hitSlop={10}
        >
          <Text style={styles.nav}>›</Text>
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={AppTheme.accent} style={styles.spinner} /> : null}
      <View style={styles.weekRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={`${d}-${i}`} style={styles.weekLabel}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((day, idx) => {
          if (day == null) {
            return <View key={`e-${idx}`} style={styles.cell} />;
          }
          const key = dateKey(year, monthIndex, day);
          const summary = summaries[key];
          const selected = selectedDateKey === key;
          const isToday = todayKey === key;
          const hasWatch = (summary?.workouts.length ?? 0) > 0;
          const stepsLabel = formatCompactSteps(summary?.steps ?? 0);
          return (
            <TouchableOpacity
              key={key}
              style={[styles.cell, isToday && styles.cellToday, selected && styles.cellSelected]}
              onPress={() => onSelectDate(key)}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.dayNum, selected && styles.daySelected, isToday && styles.dayToday]}
              >
                {day}
              </Text>
              <Text
                style={[
                  styles.steps,
                  dailyHealthHasActivity(summary) ? styles.stepsOn : styles.stepsOff,
                ]}
                numberOfLines={1}
              >
                {stepsLabel || '—'}
              </Text>
              {hasWatch ? <View style={styles.workoutDot} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.hint}>Steps from Apple Health · green dot = Watch workout</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nav: { color: AppTheme.accent, fontSize: 28, fontWeight: '300', paddingHorizontal: 8 },
  month: { color: AppTheme.textPrimary, fontSize: 16, fontWeight: '700' },
  spinner: { marginBottom: 8 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: {
    width: '14.28%',
    textAlign: 'center',
    color: AppTheme.textFaint,
    fontSize: 11,
    fontWeight: '600',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%',
    minHeight: 52,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellToday: {
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
  },
  cellSelected: {
    borderColor: AppTheme.accent,
  },
  dayNum: {
    color: AppTheme.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  dayToday: { color: AppTheme.accent },
  daySelected: { color: AppTheme.accent },
  steps: {
    fontSize: 9,
    marginTop: 1,
    fontWeight: '600',
  },
  stepsOn: { color: AppTheme.accent },
  stepsOff: { color: AppTheme.textFaint },
  workoutDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: AppTheme.accent,
    marginTop: 2,
  },
  hint: {
    marginTop: 8,
    fontSize: 11,
    color: AppTheme.textFaint,
    textAlign: 'center',
  },
});

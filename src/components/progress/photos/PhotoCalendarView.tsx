import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { PhotoSession } from '../../../types/progressPhotos';
import { AppTheme } from '../../../theme/appVisualTheme';

interface PhotoCalendarViewProps {
  sessions: PhotoSession[];
  selectedId: string;
  onSelect: (session: PhotoSession) => void;
  monthOffset?: number;
  onMonthChange?: (offset: number) => void;
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function dayKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function PhotoCalendarView({
  sessions,
  selectedId,
  onSelect,
  monthOffset = 0,
  onMonthChange,
}: PhotoCalendarViewProps): React.ReactElement {
  const [localOffset, setLocalOffset] = useState(0);
  const offset = onMonthChange ? monthOffset : localOffset;
  const setOffset = onMonthChange ?? setLocalOffset;

  const { year, month, cells, sessionByDay, monthLabel } = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const y = base.getFullYear();
    const m = base.getMonth();
    const first = startOfMonth(y, m);
    const startWeekday = (first.getDay() + 6) % 7; // Monday-first
    const count = daysInMonth(y, m);
    const map = new Map<string, PhotoSession>();
    for (const s of sessions) map.set(s.date, s);

    const grid: Array<{ day: number | null; key: string | null }> = [];
    for (let i = 0; i < startWeekday; i++) grid.push({ day: null, key: null });
    for (let d = 1; d <= count; d++) {
      grid.push({ day: d, key: dayKey(y, m, d) });
    }

    const label = base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return { year: y, month: m, cells: grid, sessionByDay: map, monthLabel: label };
  }, [offset, sessions]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setOffset(offset - 1)} hitSlop={10}>
          <Text style={styles.nav}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.month}>{monthLabel}</Text>
        <TouchableOpacity onPress={() => setOffset(offset + 1)} hitSlop={10}>
          <Text style={styles.nav}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <Text key={`${d}-${i}`} style={styles.weekLabel}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          if (!cell.day || !cell.key) {
            return <View key={`e-${idx}`} style={styles.cell} />;
          }
          const session = sessionByDay.get(cell.key);
          const selected = session?.id === selectedId;
          return (
            <TouchableOpacity
              key={cell.key}
              style={[styles.cell, selected && styles.cellSelected]}
              disabled={!session}
              onPress={() => session && onSelect(session)}
              activeOpacity={session ? 0.7 : 1}
            >
              <Text style={[styles.dayNum, !session && styles.dayMuted, selected && styles.daySelected]}>
                {cell.day}
              </Text>
              {session ? <View style={[styles.dot, selected && styles.dotSelected]} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
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
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nav: { color: AppTheme.accent, fontSize: 28, fontWeight: '300', paddingHorizontal: 8 },
  month: { color: AppTheme.textPrimary, fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekLabel: {
    width: `${100 / 7}%` as unknown as number,
    textAlign: 'center',
    color: AppTheme.textFaint,
    fontSize: 11,
    fontWeight: '600',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%` as unknown as number,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  cellSelected: { backgroundColor: 'rgba(0,255,136,0.12)' },
  dayNum: { color: AppTheme.textSecondary, fontSize: 13, fontWeight: '600' },
  dayMuted: { color: AppTheme.textFaint },
  daySelected: { color: AppTheme.accent },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: AppTheme.accent,
    marginTop: 3,
    opacity: 0.7,
  },
  dotSelected: { opacity: 1 },
});

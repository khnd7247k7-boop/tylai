import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { PhotoSession } from '../../../types/progressPhotos';
import { AppTheme } from '../../../theme/appVisualTheme';

interface MonthJourneyCarouselProps {
  sessions: PhotoSession[];
  selectedId: string;
  onSelectMonth: (yearMonth: string) => void;
  onExpandWeekTimeline?: () => void;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export default function MonthJourneyCarousel({
  sessions,
  selectedId,
  onSelectMonth,
  onExpandWeekTimeline,
}: MonthJourneyCarouselProps): React.ReactElement | null {
  const selectedSession = sessions.find((s) => s.id === selectedId);
  const activeMonth = selectedSession ? monthKey(selectedSession.date) : null;
  const [expanded, setExpanded] = useState(false);

  const months = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      const k = monthKey(s.date);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, count }));
  }, [sessions]);

  if (months.length < 2) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Monthly journey</Text>
        <TouchableOpacity
          onPress={() => {
            setExpanded((v) => !v);
            if (!expanded) onExpandWeekTimeline?.();
          }}
        >
          <Text style={styles.link}>{expanded ? 'Collapse' : 'Weeks'}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {months.map((m) => {
          const selected = m.key === activeMonth;
          return (
            <TouchableOpacity
              key={m.key}
              style={[styles.card, selected && styles.cardSelected]}
              onPress={() => onSelectMonth(m.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.month, selected && styles.monthSelected]}>
                {monthLabel(m.key)}
              </Text>
              <Text style={styles.count}>{m.count} session{m.count === 1 ? '' : 's'}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  link: { color: AppTheme.accent, fontWeight: '600', fontSize: 13 },
  row: { gap: 10, paddingRight: 8 },
  card: {
    minWidth: 140,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: AppTheme.radiusCard,
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  cardSelected: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  month: { color: AppTheme.textPrimary, fontWeight: '700', fontSize: 15 },
  monthSelected: { color: AppTheme.accent },
  count: { color: AppTheme.textMuted, fontSize: 12, marginTop: 4 },
});

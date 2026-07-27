import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { AppTheme } from '../../../theme/appVisualTheme';
import type { PhotoSession } from '../../../types/progressPhotos';
import type { SessionProgressMetrics } from '../../../types/sessionProgressMetrics';
import { formatTimelineLabel } from '../../../services/PhotoService';
import { computeSessionCompleteness } from '../../../utils/sessionCompleteness';
import {
  buildJourneyMilestones,
  type JourneyMilestone,
} from '../../../utils/progressJourneyMilestones';

interface PhotoTimelineProps {
  sessions: PhotoSession[];
  selectedId: string;
  metricsById: Map<string, SessionProgressMetrics>;
  reflectionDates?: Set<string>;
  onSelect: (session: PhotoSession) => void;
  onScrubIndex?: (index: number) => void;
  /** Page-level journey scrubber copy (not a photos-only control). */
  pageScrubber?: boolean;
}

function localDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type TimelineItem =
  | { type: 'session'; session: PhotoSession; index: number }
  | { type: 'milestone'; milestone: JourneyMilestone };

const SLOT = 72;

/** Living week scrubber — snaps, fades inactive weeks, scales the active node. */
export default function PhotoTimeline({
  sessions,
  selectedId,
  metricsById,
  reflectionDates,
  onSelect,
  onScrubIndex,
  pageScrubber = false,
}: PhotoTimelineProps): React.ReactElement {
  const scrollRef = useRef<ScrollView>(null);
  const today = localDateKey();

  const items = useMemo((): TimelineItem[] => {
    const milestones = buildJourneyMilestones(sessions, metricsById);
    const byAfter = new Map<string, JourneyMilestone[]>();
    for (const m of milestones) {
      const list = byAfter.get(m.afterSessionId) ?? [];
      list.push(m);
      byAfter.set(m.afterSessionId, list);
    }
    const out: TimelineItem[] = [];
    sessions.forEach((session, index) => {
      out.push({ type: 'session', session, index });
      for (const m of byAfter.get(session.id) ?? []) {
        out.push({ type: 'milestone', milestone: m });
      }
    });
    return out;
  }, [metricsById, sessions]);

  useEffect(() => {
    const idx = items.findIndex(
      (it) => it.type === 'session' && it.session.id === selectedId
    );
    if (idx >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ x: Math.max(0, idx * SLOT - 48), animated: true });
    }
  }, [items, selectedId]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!onScrubIndex || !sessions.length) return;
    const x = e.nativeEvent.contentOffset.x;
    const approx = Math.round(x / SLOT);
    const sessionItems = items
      .map((it, i) => ({ it, i }))
      .filter((row) => row.it.type === 'session');
    if (!sessionItems.length) return;
    const nearest = sessionItems.reduce((best, cur) =>
      Math.abs(cur.i - approx) < Math.abs(best.i - approx) ? cur : best
    );
    if (nearest.it.type === 'session') onScrubIndex(nearest.it.index);
  };

  const rangeLabel =
    sessions.length >= 2
      ? `${formatTimelineLabel(sessions[0], 0, sessions[0].date === today)}  →  ${formatTimelineLabel(sessions[sessions.length - 1], sessions.length - 1, sessions[sessions.length - 1].date === today)}`
      : sessions.length === 1
        ? formatTimelineLabel(sessions[0], 0, sessions[0].date === today)
        : 'Your journey';

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{pageScrubber ? 'Journey' : 'Timeline'}</Text>
        <Text style={styles.range}>{rangeLabel}</Text>
      </View>
      <View style={styles.rail}>
        <View style={styles.railLine} />
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
          snapToInterval={SLOT}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
        >
          {items.map((item) => {
            if (item.type === 'milestone') {
              return (
                <View key={item.milestone.id} style={styles.milestone}>
                  <Text style={styles.milestoneEmoji}>{item.milestone.emoji}</Text>
                </View>
              );
            }
            const { session, index } = item;
            const selected = session.id === selectedId;
            const label = formatTimelineLabel(session, index, session.date === today);
            const completeness = computeSessionCompleteness(session, metricsById.get(session.id), {
              hasReflection: reflectionDates?.has(session.date),
            });
            return (
              <WeekNode
                key={session.id}
                label={label}
                selected={selected}
                thumbUri={session.photos.front}
                filled={completeness.ratio}
                onPress={() => onSelect(session)}
              />
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function WeekNode({
  label,
  selected,
  thumbUri,
  filled,
  onPress,
}: {
  label: string;
  selected: boolean;
  thumbUri: string;
  filled: number;
  onPress: () => void;
}): React.ReactElement {
  const scale = useRef(new Animated.Value(selected ? 1.1 : 0.9)).current;
  const opacity = useRef(new Animated.Value(selected ? 1 : 0.42)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: selected ? 1.1 : 0.9,
        useNativeDriver: true,
        speed: 18,
        bounciness: 5,
      }),
      Animated.timing(opacity, {
        toValue: selected ? 1 : 0.42,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale, selected]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.nodeWrap}>
      <Animated.View
        style={[
          styles.thumbWrap,
          selected && styles.thumbSelected,
          { transform: [{ scale }], opacity },
        ]}
      >
        <Image source={{ uri: thumbUri }} style={styles.thumb} />
        {selected ? <View style={styles.glow} /> : null}
      </Animated.View>
      <Animated.View
        style={[styles.dot, selected && styles.dotActive, { opacity }]}
      />
      <Animated.Text style={[styles.label, selected && styles.labelActive, { opacity }]}>
        {label}
      </Animated.Text>
      {!selected && filled > 0 ? (
        <View style={styles.fillMark}>
          <View style={[styles.fillBar, { width: Math.max(2, Math.round(filled * 28)) }]} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 16 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  range: {
    flex: 1,
    textAlign: 'right',
    fontSize: 11,
    color: AppTheme.textFaint,
    fontWeight: '500',
  },
  rail: { position: 'relative' },
  railLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 48,
    height: 2,
    backgroundColor: AppTheme.border,
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 4,
    alignItems: 'flex-start',
  },
  nodeWrap: {
    width: SLOT - 8,
    marginRight: 8,
    alignItems: 'center',
  },
  thumbWrap: {
    width: 44,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.bgElevated,
    marginBottom: 10,
  },
  thumbSelected: {
    borderColor: AppTheme.accent,
    shadowColor: AppTheme.accent,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  thumb: { width: '100%', height: '100%' },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(0,255,136,0.35)',
  },
  fillMark: {
    position: 'absolute',
    top: 58,
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: AppTheme.border,
    overflow: 'hidden',
  },
  fillBar: {
    height: '100%',
    backgroundColor: 'rgba(0,255,136,0.55)',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AppTheme.border,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: AppTheme.bgScreen,
  },
  dotActive: {
    backgroundColor: AppTheme.accent,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: AppTheme.textMuted,
    textAlign: 'center',
  },
  labelActive: { color: AppTheme.accent },
  milestone: {
    width: 36,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
  },
  milestoneEmoji: { fontSize: 16 },
});

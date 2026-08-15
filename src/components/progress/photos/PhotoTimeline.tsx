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
  Platform,
} from 'react-native';
import { AppTheme } from '../../../theme/appVisualTheme';
import type { PhotoSession, PhotoPose } from '../../../types/progressPhotos';
import { firstAvailablePose, isPhotoUri } from '../../../types/progressPhotos';
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
  /** Thumbnail pose so week nodes match the selected angle. */
  thumbPose?: PhotoPose;
}

function localDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fixed slot width so snap + scrub math stay aligned (milestones share the same pitch). */
const SLOT = 76;
const NODE_WIDTH = 64;

/**
 * Living week scrubber — snaps to sessions without fighting the user’s finger.
 * Programmatic scroll only runs for external selection changes (tap / chevron / replay),
 * not after a scrub-driven selection update.
 */
export default function PhotoTimeline({
  sessions,
  selectedId,
  metricsById,
  reflectionDates,
  onSelect,
  onScrubIndex,
  pageScrubber = false,
  thumbPose = 'front',
}: PhotoTimelineProps): React.ReactElement {
  const scrollRef = useRef<ScrollView>(null);
  const today = localDateKey();
  const userDraggingRef = useRef(false);
  const skipAutoScrollRef = useRef(false);
  const lastAutoScrollIdRef = useRef<string | null>(null);

  const milestonesBySession = useMemo(() => {
    const milestones = buildJourneyMilestones(sessions, metricsById);
    const map = new Map<string, JourneyMilestone[]>();
    for (const m of milestones) {
      const list = map.get(m.afterSessionId) ?? [];
      list.push(m);
      map.set(m.afterSessionId, list);
    }
    return map;
  }, [metricsById, sessions]);

  const selectedIndex = useMemo(
    () => sessions.findIndex((s) => s.id === selectedId),
    [sessions, selectedId]
  );

  useEffect(() => {
    if (selectedIndex < 0 || !scrollRef.current) return;
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      lastAutoScrollIdRef.current = selectedId;
      return;
    }
    if (userDraggingRef.current) return;
    if (lastAutoScrollIdRef.current === selectedId) return;
    lastAutoScrollIdRef.current = selectedId;
    const x = Math.max(0, selectedIndex * SLOT - SLOT);
    scrollRef.current.scrollTo({ x, animated: true });
  }, [selectedId, selectedIndex]);

  const commitScrubFromOffset = (x: number) => {
    if (!onScrubIndex || !sessions.length) return;
    const index = Math.max(0, Math.min(sessions.length - 1, Math.round(x / SLOT)));
    const session = sessions[index];
    if (!session || session.id === selectedId) return;
    skipAutoScrollRef.current = true;
    onScrubIndex(index);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    userDraggingRef.current = false;
    commitScrubFromOffset(e.nativeEvent.contentOffset.x);
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
          snapToAlignment="start"
          disableIntervalMomentum
          directionalLockEnabled
          nestedScrollEnabled
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            userDraggingRef.current = true;
          }}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={(e) => {
            // If momentum will continue, wait for onMomentumScrollEnd.
            const vy = e.nativeEvent.velocity?.x ?? 0;
            if (Platform.OS === 'ios' && Math.abs(vy) > 0.05) {
              return;
            }
            onScrollEnd(e);
          }}
        >
          {sessions.map((session, index) => {
            const selected = session.id === selectedId;
            const label = formatTimelineLabel(session, index, session.date === today);
            const completeness = computeSessionCompleteness(session, metricsById.get(session.id), {
              hasReflection: reflectionDates?.has(session.date),
            });
            const marks = milestonesBySession.get(session.id) ?? [];
            return (
              <View key={session.id} style={styles.slot}>
                <WeekNode
                  label={label}
                  selected={selected}
                  thumbUri={
                    (thumbPose && isPhotoUri(session.photos[thumbPose])
                      ? session.photos[thumbPose]
                      : undefined) ||
                    session.photos[firstAvailablePose(session.photos)] ||
                    undefined
                  }
                  filled={completeness.ratio}
                  milestoneEmoji={marks[0]?.emoji}
                  onPress={() => {
                    userDraggingRef.current = false;
                    skipAutoScrollRef.current = false;
                    onSelect(session);
                  }}
                />
              </View>
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
  milestoneEmoji,
  onPress,
}: {
  label: string;
  selected: boolean;
  thumbUri: string;
  filled: number;
  milestoneEmoji?: string;
  onPress: () => void;
}): React.ReactElement {
  const scale = useRef(new Animated.Value(selected ? 1.08 : 0.92)).current;
  const opacity = useRef(new Animated.Value(selected ? 1 : 0.45)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: selected ? 1.08 : 0.92,
        useNativeDriver: true,
        speed: 18,
        bounciness: 5,
      }),
      Animated.timing(opacity, {
        toValue: selected ? 1 : 0.45,
        duration: 180,
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
        {milestoneEmoji ? (
          <View style={styles.milestoneBadge}>
            <Text style={styles.milestoneEmoji}>{milestoneEmoji}</Text>
          </View>
        ) : null}
      </Animated.View>
      <Animated.View style={[styles.dot, selected && styles.dotActive, { opacity }]} />
      <Animated.Text style={[styles.label, selected && styles.labelActive, { opacity }]} numberOfLines={1}>
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
    paddingHorizontal: 8,
    paddingBottom: 4,
    alignItems: 'flex-start',
  },
  slot: {
    width: SLOT,
    alignItems: 'center',
  },
  nodeWrap: {
    width: NODE_WIDTH,
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
  milestoneBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneEmoji: { fontSize: 11 },
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
});

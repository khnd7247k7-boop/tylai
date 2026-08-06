import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import type { PhotoSession, PhotoPose } from '../../../types/progressPhotos';
import { PHOTO_POSES, PHOTO_POSE_LABELS } from '../../../types/progressPhotos';
import type { SessionCompleteness } from '../../../utils/sessionCompleteness';
import { formatTimelineLabel, formatSessionStamp } from '../../../services/PhotoService';
import { AppTheme } from '../../../theme/appVisualTheme';
import SessionProgressRing from './SessionProgressRing';

interface PhotoHeroCardProps {
  session: PhotoSession;
  weekIndex: number;
  isToday: boolean;
  completeness: SessionCompleteness;
  compareSession?: PhotoSession | null;
  compareMode?: boolean;
  onCompareModeChange?: (enabled: boolean) => void;
  onOpenDetails: () => void;
  onSwipeSession?: (direction: 'prev' | 'next') => void;
  /** When true, hides week chrome — page timeline owns the week label. */
  embedded?: boolean;
  canSwipePrev?: boolean;
  canSwipeNext?: boolean;
  /** Controlled pose so week scrubbing keeps the same angle. */
  pose?: PhotoPose;
  onPoseChange?: (pose: PhotoPose) => void;
}

/**
 * Featured transformation frame — instant photo swap (no crossfade flash),
 * optional before/after scrub that only reveals the earlier photo when dragged.
 */
export default function PhotoHeroCard({
  session,
  weekIndex,
  isToday,
  completeness,
  compareSession,
  compareMode: compareModeProp,
  onCompareModeChange,
  onOpenDetails,
  onSwipeSession,
  embedded = false,
  canSwipePrev = false,
  canSwipeNext = false,
  pose: poseProp,
  onPoseChange,
}: PhotoHeroCardProps): React.ReactElement {
  const [poseLocal, setPoseLocal] = useState<PhotoPose>('front');
  const pose = poseProp ?? poseLocal;
  const setPose = (next: PhotoPose) => {
    onPoseChange?.(next);
    if (poseProp === undefined) setPoseLocal(next);
  };
  const [compareModeLocal, setCompareModeLocal] = useState(false);
  const compareMode = compareModeProp ?? compareModeLocal;
  const setCompareMode = (next: boolean) => {
    onCompareModeChange?.(next);
    if (compareModeProp === undefined) setCompareModeLocal(next);
  };

  const [slider, setSlider] = useState(0);
  const [frameW, setFrameW] = useState(0);
  const widthRef = useRef(0);
  const pressScale = useRef(new Animated.Value(1)).current;

  const label = formatTimelineLabel(session, weekIndex, isToday);
  const uri = session.photos[pose];
  const compareUri = compareSession?.photos[pose];
  const canCompare = Boolean(compareSession && compareSession.id !== session.id);

  useEffect(() => {
    // Keep the selected pose (front/side/back) when scrubbing weeks so users
    // can compare the same angle over time. Only reset compare UI.
    setCompareMode(false);
    setSlider(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on session change
  }, [session.id]);

  useEffect(() => {
    // Entering compare: show current photo only until the user drags the scrub line.
    if (compareMode) setSlider(0);
  }, [compareMode]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          compareMode ? true : Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: (evt) => {
          if (!compareMode) return;
          const x = evt.nativeEvent.locationX;
          setSlider(Math.min(1, Math.max(0, x / (widthRef.current || 1))));
        },
        onPanResponderMove: (evt) => {
          if (!compareMode) return;
          const x = evt.nativeEvent.locationX;
          setSlider(Math.min(1, Math.max(0, x / (widthRef.current || 1))));
        },
        onPanResponderRelease: (_, g) => {
          if (compareMode) return;
          if (g.dx <= -48) onSwipeSession?.('next');
          else if (g.dx >= 48) onSwipeSession?.('prev');
        },
      }),
    [compareMode, onSwipeSession]
  );

  return (
    <Animated.View
      style={[styles.card, embedded && styles.cardEmbedded, { transform: [{ scale: pressScale }] }]}
    >
      {!embedded ? (
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.weekTitle}>{label}</Text>
          </View>
          <View style={styles.ringWrap}>
            <SessionProgressRing completeness={completeness} size={42} />
            <Text style={styles.ringCaption}>
              {completeness.completedCount}/{completeness.total}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.heroFrameWrap}>
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={() =>
            Animated.spring(pressScale, {
              toValue: 0.985,
              useNativeDriver: true,
              speed: 40,
              bounciness: 0,
            }).start()
          }
          onPressOut={() =>
            Animated.spring(pressScale, {
              toValue: 1,
              useNativeDriver: true,
              speed: 20,
              bounciness: 6,
            }).start()
          }
          onPress={onOpenDetails}
        >
          <View
            style={styles.heroFrame}
            onLayout={(e) => {
              widthRef.current = e.nativeEvent.layout.width;
              setFrameW(e.nativeEvent.layout.width);
            }}
            {...pan.panHandlers}
          >
            {/* Current (after) photo — no crossfade; swap instantly to avoid flashing */}
            <Image source={{ uri }} style={styles.heroImage} resizeMode="cover" />

            {compareMode && compareUri ? (
              <>
                {/* Before photo only appears as the scrub line is dragged */}
                <View style={[styles.beforeClip, { width: frameW * slider }]} pointerEvents="none">
                  <Image
                    source={{ uri: compareUri }}
                    style={[styles.heroImage, frameW > 0 ? { width: frameW } : null]}
                    resizeMode="cover"
                  />
                </View>
                <View style={[styles.handle, { left: Math.max(0, frameW * slider - 1) }]} />
                <View
                  style={[styles.handleKnob, { left: Math.max(12, frameW * slider - 14) }]}
                />
                {slider > 0.02 ? (
                  <>
                    <Text style={styles.beforeBadge}>Before</Text>
                    <Text style={styles.afterBadge}>After</Text>
                  </>
                ) : (
                  <Text style={styles.afterBadge}>Drag to compare</Text>
                )}
              </>
            ) : null}

            <View style={styles.stampWrap} pointerEvents="none">
              <Text style={styles.stampText}>{formatSessionStamp(session)}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {onSwipeSession && canSwipePrev ? (
          <TouchableOpacity
            style={[styles.navChevron, styles.navChevronLeft]}
            onPress={() => onSwipeSession('prev')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Previous photos"
          >
            <Text style={styles.navChevronText}>‹</Text>
          </TouchableOpacity>
        ) : null}
        {onSwipeSession && canSwipeNext ? (
          <TouchableOpacity
            style={[styles.navChevron, styles.navChevronRight]}
            onPress={() => onSwipeSession('next')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Next photos"
          >
            <Text style={styles.navChevronText}>›</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.poseRow}>
        {PHOTO_POSES.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.poseChip, pose === p && styles.poseChipActive]}
            onPress={() => setPose(p)}
            activeOpacity={0.85}
          >
            <Text style={[styles.poseText, pose === p && styles.poseTextActive]}>
              {PHOTO_POSE_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.ghostBtn} onPress={onOpenDetails} activeOpacity={0.85}>
          <Text style={styles.ghostText}>Session details</Text>
        </TouchableOpacity>
        {canCompare ? (
          <TouchableOpacity
            style={[styles.ghostBtn, compareMode && styles.ghostBtnActive]}
            onPress={() => setCompareMode(!compareMode)}
            activeOpacity={0.85}
          >
            <Text style={[styles.ghostText, compareMode && styles.ghostTextActive]}>
              {compareMode ? 'Exit compare' : 'Compare'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardEmbedded: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    shadowOpacity: 0,
    elevation: 0,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  weekTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: AppTheme.textPrimary,
  },
  ringWrap: { alignItems: 'center', marginLeft: 8 },
  ringCaption: { fontSize: 10, color: AppTheme.textFaint, marginTop: 2 },
  heroFrameWrap: {
    position: 'relative',
    width: '100%',
  },
  heroFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: Math.min(460, Dimensions.get('window').height * 0.48),
    borderRadius: AppTheme.radiusCard,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
  },
  heroImage: { width: '100%', height: '100%' },
  stampWrap: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    maxWidth: '48%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  stampText: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  navChevron: {
    position: 'absolute',
    top: '42%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navChevronLeft: { left: 8 },
  navChevronRight: { right: 8 },
  navChevronText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '600',
    marginTop: -2,
  },
  beforeClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#fff',
  },
  handleKnob: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  beforeBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 4,
  },
  afterBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 4,
  },
  poseRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  poseChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: AppTheme.radiusPill,
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
  },
  poseChipActive: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0,255,136,0.1)',
  },
  poseText: { color: AppTheme.textMuted, fontWeight: '600', fontSize: 13 },
  poseTextActive: { color: AppTheme.accent },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  ghostBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: AppTheme.radiusButton,
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.bgElevated,
  },
  ghostBtnActive: { borderColor: AppTheme.accent },
  ghostText: { color: AppTheme.textSecondary, fontWeight: '600', fontSize: 13 },
  ghostTextActive: { color: AppTheme.accent },
});

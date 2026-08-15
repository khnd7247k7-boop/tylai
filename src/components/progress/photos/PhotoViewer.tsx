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
import { AppTheme } from '../../../theme/appVisualTheme';
import {
  PHOTO_POSE_LABELS,
  availablePoses,
  firstAvailablePose,
  isPhotoUri,
  type PhotoPose,
  type PhotoSession,
} from '../../../types/progressPhotos';
import { formatSessionStamp } from '../../../services/PhotoService';

interface PhotoViewerProps {
  session: PhotoSession;
  animate?: boolean;
  /** Swipe horizontally to adjacent photo sessions. */
  onSwipeSession?: (direction: 'prev' | 'next') => void;
  onOpenDetails?: () => void;
}

const SWIPE_THRESHOLD = 48;

export default function PhotoViewer({
  session,
  animate = true,
  onSwipeSession,
  onOpenDetails,
}: PhotoViewerProps): React.ReactElement {
  const poses = useMemo(() => availablePoses(session.photos), [session.photos]);
  const [poseIndex, setPoseIndex] = useState(0);
  const pose = poses[poseIndex] ?? firstAvailablePose(session.photos);
  const [loading, setLoading] = useState(true);
  const fade = useRef(new Animated.Value(1)).current;
  const initialUri = isPhotoUri(session.photos[pose]) ? session.photos[pose]! : '';
  const [displayUri, setDisplayUri] = useState(initialUri);
  const scale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(1);
  const pinchStart = useRef(1);
  const lastTap = useRef(0);

  const uri = isPhotoUri(session.photos[pose]) ? session.photos[pose]! : '';

  useEffect(() => {
    setPoseIndex(0);
  }, [session.id]);

  useEffect(() => {
    if (poseIndex >= poses.length) setPoseIndex(0);
  }, [poseIndex, poses.length]);

  useEffect(() => {
    if (!uri) {
      setDisplayUri('');
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!animate) {
      setDisplayUri(uri);
      fade.setValue(1);
      return;
    }
    Animated.timing(fade, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setDisplayUri(uri);
      setLoading(true);
      Animated.timing(fade, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  }, [animate, fade, uri]);

  const goPose = (nextIndex: number) => {
    if (!poses.length) return;
    const clamped = Math.max(0, Math.min(poses.length - 1, nextIndex));
    if (clamped === poseIndex) return;
    setPoseIndex(clamped);
  };

  const resetZoom = () => {
    baseScale.current = 1;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  useEffect(() => {
    resetZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8 || (g.numberActiveTouches ?? 1) >= 2,
        onPanResponderGrant: (evt) => {
          if ((evt.nativeEvent.touches?.length ?? 1) >= 2) {
            pinchStart.current = baseScale.current;
          }
        },
        onPanResponderMove: (evt, g) => {
          const touches = evt.nativeEvent.touches;
          if (touches && touches.length >= 2) {
            const [a, b] = touches;
            const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            if (!(pan as any)._pinchBaseDist) {
              (pan as any)._pinchBaseDist = dist;
            }
            const baseDist = (pan as any)._pinchBaseDist || dist;
            const next = Math.min(3, Math.max(1, pinchStart.current * (dist / baseDist)));
            scale.setValue(next);
            return;
          }
        },
        onPanResponderRelease: (evt, g) => {
          (pan as any)._pinchBaseDist = 0;
          const touches = evt.nativeEvent.changedTouches?.length ?? 1;
          if (Math.abs(g.dx) < 12 && Math.abs(g.dy) < 12 && touches <= 1) {
            const now = Date.now();
            if (now - lastTap.current < 280) {
              if (baseScale.current > 1.05) resetZoom();
              else {
                baseScale.current = 2;
                Animated.spring(scale, {
                  toValue: 2,
                  useNativeDriver: true,
                  speed: 18,
                  bounciness: 4,
                }).start();
              }
              lastTap.current = 0;
              return;
            }
            lastTap.current = now;
          }

          const currentScale = Number(
            (scale as unknown as { _value?: number })._value ?? baseScale.current
          );
          if (Number.isFinite(currentScale) && currentScale !== baseScale.current) {
            baseScale.current = Math.min(3, Math.max(1, currentScale));
            scale.setValue(baseScale.current);
          }

          if (baseScale.current > 1.05) return;

          if (g.dx <= -SWIPE_THRESHOLD) {
            if (poseIndex < poses.length - 1) goPose(poseIndex + 1);
            else onSwipeSession?.('next');
          } else if (g.dx >= SWIPE_THRESHOLD) {
            if (poseIndex > 0) goPose(poseIndex - 1);
            else onSwipeSession?.('prev');
          }
        },
      }),
    [onSwipeSession, poseIndex, poses.length, scale]
  );

  return (
    <View style={styles.wrap}>
      <TouchableOpacity activeOpacity={0.9} onPress={onOpenDetails} disabled={!onOpenDetails}>
        <View style={styles.metaRow}>
          <Text style={styles.poseHint}>
            {PHOTO_POSE_LABELS[pose]}
            {poses.length > 1 ? ' · swipe poses · double-tap zoom' : ' · double-tap zoom'}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.frame} {...pan.panHandlers}>
        {loading && <View style={styles.skeleton} />}
        {displayUri ? (
          <Animated.View style={[styles.imageWrap, { opacity: fade, transform: [{ scale }] }]}>
            <Image
              source={{ uri: displayUri }}
              style={styles.image}
              resizeMode="cover"
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          </Animated.View>
        ) : (
          <View style={[styles.imageWrap, styles.emptyWrap]}>
            <Text style={styles.emptyText}>No photo</Text>
          </View>
        )}
        <View style={styles.stampWrap} pointerEvents="none">
          <Text style={styles.stampText}>{formatSessionStamp(session)}</Text>
        </View>
      </View>

      {poses.length > 1 ? (
        <View style={styles.segment}>
          {poses.map((p, i) => {
            const active = i === poseIndex;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => {
                  resetZoom();
                  setPoseIndex(i);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {PHOTO_POSE_LABELS[p]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
    alignItems: 'center',
  },
  metaRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    paddingHorizontal: 16,
    width: '100%',
  },
  poseHint: {
    fontSize: 11,
    color: AppTheme.textMuted,
    textAlign: 'center',
  },
  frame: {
    borderRadius: AppTheme.radiusCard,
    overflow: 'hidden',
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.border,
    aspectRatio: 3 / 4,
    maxHeight: 420,
    width: Dimensions.get('window').width - 64,
  },
  stampWrap: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    maxWidth: '70%',
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
  skeleton: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AppTheme.inputBg,
  },
  imageWrap: {
    flex: 1,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: AppTheme.textMuted,
    fontWeight: '600',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  segment: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: AppTheme.bgElevated,
    borderRadius: AppTheme.radiusPill,
    padding: 4,
    borderWidth: 1,
    borderColor: AppTheme.border,
    width: '100%',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: AppTheme.radiusPill,
  },
  segmentBtnActive: {
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textMuted,
  },
  segmentTextActive: {
    color: AppTheme.accent,
  },
});

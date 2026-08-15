import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  Image,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { PhotoSession, PhotoPose } from '../../../types/progressPhotos';
import {
  PHOTO_POSE_LABELS,
  availablePoses,
  isPhotoUri,
} from '../../../types/progressPhotos';
import { findComparisonSessions } from '../../../services/sessionProgressMetricsService';
import { formatDisplayDate } from '../../../services/PhotoService';
import { AppTheme } from '../../../theme/appVisualTheme';

type RangeOption = 'beginning' | '30d' | '60d' | '90d';

interface PhotoComparisonModeProps {
  visible: boolean;
  sessions: PhotoSession[];
  onClose: () => void;
}

export default function PhotoComparisonMode({
  visible,
  sessions,
  onClose,
}: PhotoComparisonModeProps): React.ReactElement {
  const [range, setRange] = useState<RangeOption>('beginning');
  const [pose, setPose] = useState<PhotoPose>('front');
  const [slider, setSlider] = useState(0);
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  const pair = useMemo(
    () => findComparisonSessions(sessions, range),
    [sessions, range]
  );

  const poses = useMemo(() => {
    if (!pair) return [] as PhotoPose[];
    const after = availablePoses(pair.after.photos);
    const before = new Set(availablePoses(pair.before.photos));
    const shared = after.filter((p) => before.has(p));
    return shared.length ? shared : after;
  }, [pair]);

  useEffect(() => {
    if (!poses.length) return;
    if (!poses.includes(pose)) setPose(poses[0]);
  }, [poses, pose]);

  const afterUri =
    pair && isPhotoUri(pair.after.photos[pose]) ? pair.after.photos[pose] : undefined;
  const beforeUri =
    pair && isPhotoUri(pair.before.photos[pose]) ? pair.before.photos[pose] : undefined;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const w = widthRef.current || 1;
        setSlider(Math.min(1, Math.max(0, x / w)));
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const w = widthRef.current || 1;
        setSlider(Math.min(1, Math.max(0, x / w)));
      },
    })
  ).current;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Compare</Text>
          <View style={{ width: 48 }} />
        </View>

        <View style={styles.rangeRow}>
          {([
            ['beginning', 'Start'],
            ['30d', '30d'],
            ['60d', '60d'],
            ['90d', '90d'],
          ] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.rangeChip, range === key && styles.rangeChipActive]}
              onPress={() => setRange(key)}
            >
              <Text style={[styles.rangeText, range === key && styles.rangeTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!pair ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Take at least two photo sessions to compare.</Text>
          </View>
        ) : (
          <>
            <View style={styles.labels}>
              <Text style={styles.label}>{formatDisplayDate(pair.before.date)}</Text>
              <Text style={styles.label}>{formatDisplayDate(pair.after.date)}</Text>
            </View>

            <View style={styles.sliderFrame} onLayout={onLayout} {...pan.panHandlers}>
              {afterUri ? (
                <Image source={{ uri: afterUri }} style={styles.fullImage} resizeMode="cover" />
              ) : (
                <View style={[styles.fullImage, styles.missingPose]}>
                  <Text style={styles.missingPoseText}>No after photo</Text>
                </View>
              )}
              {beforeUri ? (
                <View style={[styles.beforeClip, { width: width * slider }]}>
                  <Image
                    source={{ uri: beforeUri }}
                    style={[styles.fullImage, width > 0 ? { width } : null]}
                    resizeMode="cover"
                  />
                </View>
              ) : null}
              <View style={[styles.handle, { left: Math.max(0, width * slider - 1) }]}>
                <View style={styles.handleKnob} />
              </View>
              <Text style={styles.badgeLeft}>Before</Text>
              <Text style={styles.badgeRight}>After</Text>
            </View>

            {poses.length > 0 ? (
              <View style={styles.poseRow}>
                {poses.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.poseChip, pose === p && styles.poseChipActive]}
                    onPress={() => setPose(p)}
                  >
                    <Text style={[styles.poseText, pose === p && styles.poseTextActive]}>
                      {PHOTO_POSE_LABELS[p]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <Text style={styles.hint}>
              {slider <= 0.02 ? 'Drag the line to reveal your before photo' : 'Drag across the image to compare'}
            </Text>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppTheme.bgScreen },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  close: { color: AppTheme.accent, fontSize: 16, fontWeight: '600', width: 48 },
  title: { color: AppTheme.textPrimary, fontSize: 17, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  rangeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: AppTheme.radiusPill,
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
  },
  rangeChipActive: { borderColor: AppTheme.accent, backgroundColor: 'rgba(0,255,136,0.08)' },
  rangeText: { color: AppTheme.textMuted, fontWeight: '600', fontSize: 13 },
  rangeTextActive: { color: AppTheme.accent },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  label: { color: AppTheme.textMuted, fontSize: 12, fontWeight: '600' },
  sliderFrame: {
    marginHorizontal: 16,
    aspectRatio: 3 / 4,
    borderRadius: AppTheme.radiusCard,
    overflow: 'hidden',
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  fullImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  missingPose: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
  },
  missingPoseText: {
    color: AppTheme.textMuted,
    fontWeight: '600',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleKnob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: AppTheme.accent,
  },
  badgeLeft: {
    position: 'absolute',
    left: 12,
    top: 12,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  badgeRight: {
    position: 'absolute',
    right: 12,
    top: 12,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  poseRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 16 },
  poseChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: AppTheme.radiusPill,
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
  },
  poseChipActive: { borderColor: AppTheme.accent },
  poseText: { color: AppTheme.textMuted, fontWeight: '600' },
  poseTextActive: { color: AppTheme.accent },
  hint: {
    textAlign: 'center',
    color: AppTheme.textFaint,
    fontSize: 12,
    marginTop: 12,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: AppTheme.textMuted, textAlign: 'center', fontSize: 15 },
});

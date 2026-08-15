import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { PhotoPose, PhotoSession } from '../../../types/progressPhotos';
import {
  PHOTO_POSE_LABELS,
  availablePoses,
  firstAvailablePose,
  isPhotoUri,
} from '../../../types/progressPhotos';
import type { SessionProgressMetrics } from '../../../types/sessionProgressMetrics';
import { formatSessionStamp } from '../../../services/PhotoService';
import { AppTheme } from '../../../theme/appVisualTheme';

interface PhotoSessionDetailModalProps {
  visible: boolean;
  session: PhotoSession | null;
  metrics: SessionProgressMetrics | null;
  onClose: () => void;
  initialPose?: PhotoPose;
  onPoseChange?: (pose: PhotoPose) => void;
  onEditPoses?: () => void;
}

const SCREEN_W = Dimensions.get('window').width;

export default function PhotoSessionDetailModal({
  visible,
  session,
  metrics,
  onClose,
  initialPose = 'front',
  onPoseChange,
  onEditPoses,
}: PhotoSessionDetailModalProps): React.ReactElement {
  const poses = useMemo(
    () => (session ? availablePoses(session.photos) : []),
    [session]
  );
  const [pose, setPose] = useState<PhotoPose>(() =>
    firstAvailablePose(session?.photos, initialPose)
  );

  useEffect(() => {
    if (!visible || !session) return;
    setPose(firstAvailablePose(session.photos, initialPose));
  }, [visible, initialPose, session?.id, session?.photos]);

  const selectPose = (next: PhotoPose) => {
    setPose(next);
    onPoseChange?.(next);
  };

  const workoutLine = useMemo(() => {
    if (!metrics) return '—';
    const w = metrics.workoutSummary;
    if (w.completedSessions === 0) return 'No workouts logged this day';
    const lift =
      w.topLiftName && w.topLiftWeight != null
        ? ` · Top lift ${w.topLiftName} @ ${Math.round(w.topLiftWeight)} lb`
        : '';
    return `${w.completedSessions} session${w.completedSessions === 1 ? '' : 's'} · ${w.totalSets} sets${lift}`;
  }, [metrics]);

  if (!session) return <></>;

  const photoUri = isPhotoUri(session.photos[pose]) ? session.photos[pose] : undefined;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Session details</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.photoFrame}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={styles.photoEmpty}>
                <Text style={styles.photoEmptyText}>No photo for this pose</Text>
              </View>
            )}
            <View style={styles.stampWrap} pointerEvents="none">
              <Text style={styles.stampText}>{formatSessionStamp(session)}</Text>
            </View>
          </View>

          {poses.length > 0 ? (
            <View style={styles.poseRow}>
              {poses.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.poseChip, p === pose && styles.poseChipActive]}
                  onPress={() => selectPose(p)}
                >
                  <Text style={[styles.poseChipText, p === pose && styles.poseChipTextActive]}>
                    {PHOTO_POSE_LABELS[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {onEditPoses ? (
            <TouchableOpacity style={styles.editPosesBtn} onPress={onEditPoses} activeOpacity={0.85}>
              <Text style={styles.editPosesBtnText}>Fix poses</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Body & training</Text>
            <DetailRow label="Weight" value={formatMetric(metrics?.weight)} />
            <DetailRow label="Waist" value={formatMetric(metrics?.measurements)} />
            {(metrics?.extraMeasurements ?? [])
              .filter((m) => m.status === 'available')
              .map((m) => (
                <DetailRow key={m.label} label={m.label} value={formatMetric(m)} />
              ))}
            <DetailRow label="Strength" value={formatMetric(metrics?.strength)} />
            <DetailRow label="Calories" value={formatMetric(metrics?.calories)} />
            <DetailRow label="Protein" value={formatMetric(metrics?.protein)} />
            <DetailRow label="Recovery" value={formatMetric(metrics?.recovery)} />
            <DetailRow label="Workout summary" value={workoutLine} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coach notes</Text>
            <Text style={styles.placeholder}>
              {metrics?.coachNotes ?? 'Coach notes for this session will appear here.'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI insights</Text>
            <Text style={styles.placeholder}>
              {metrics?.aiInsightsPlaceholder ??
                'AI insights for this session will appear here in a future update.'}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function formatMetric(
  m: SessionProgressMetrics['weight'] | undefined
): string {
  if (!m || m.status !== 'available' || m.value == null) return '—';
  return `${m.value}${m.unit ? ` ${m.unit}` : ''}`;
}

function DetailRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppTheme.bgScreen },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  close: { color: AppTheme.accent, fontSize: 16, fontWeight: '600', width: 48 },
  headerTitle: { color: AppTheme.textPrimary, fontSize: 17, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  photoFrame: {
    width: SCREEN_W - 32,
    aspectRatio: 3 / 4,
    borderRadius: AppTheme.radiusCard,
    overflow: 'hidden',
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignSelf: 'center',
  },
  photo: { width: '100%', height: '100%' },
  photoEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
  },
  photoEmptyText: { color: AppTheme.textMuted, fontWeight: '600' },
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
  poseRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 },
  editPosesBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: AppTheme.radiusPill,
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.inputBg,
  },
  editPosesBtnText: {
    color: AppTheme.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  poseChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: AppTheme.radiusPill,
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
  },
  poseChipActive: { borderColor: AppTheme.accent, backgroundColor: 'rgba(0,255,136,0.08)' },
  poseChipText: { color: AppTheme.textMuted, fontWeight: '600', fontSize: 13 },
  poseChipTextActive: { color: AppTheme.accent },
  section: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.border,
  },
  rowLabel: { color: AppTheme.textMuted, fontSize: 14, flex: 1 },
  rowValue: { color: AppTheme.textPrimary, fontSize: 14, fontWeight: '600', flex: 1.2, textAlign: 'right' },
  placeholder: { color: AppTheme.textFaint, fontSize: 14, lineHeight: 20 },
});

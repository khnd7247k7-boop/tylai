/**
 * Fix front / side / back assignments on an existing progress photo session.
 * Empty poses are allowed — tap through photos or clear a slot.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  PHOTO_POSES,
  PHOTO_POSE_LABELS,
  availablePoses,
  isPhotoUri,
  type PhotoPose,
  type PhotoSession,
  type PhotoSessionPhotos,
} from '../../../types/progressPhotos';
import { formatDisplayDate, updateSessionPosePhotos } from '../../../services/PhotoService';
import { AppTheme } from '../../../theme/appVisualTheme';

type Props = {
  visible: boolean;
  session: PhotoSession | null;
  onClose: () => void;
  onSaved: (session: PhotoSession) => void;
};

export default function PhotoSessionPoseEditModal({
  visible,
  session,
  onClose,
  onSaved,
}: Props): React.ReactElement {
  const [draft, setDraft] = useState<PhotoSessionPhotos | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !session) {
      setDraft(null);
      setSaving(false);
      return;
    }
    const next: PhotoSessionPhotos = {};
    for (const pose of PHOTO_POSES) {
      if (isPhotoUri(session.photos[pose])) next[pose] = session.photos[pose];
    }
    setDraft(next);
  }, [visible, session?.id, session?.photos.front, session?.photos.side, session?.photos.back]);

  const pool = useMemo(() => {
    if (!draft) return [] as string[];
    return Array.from(new Set(availablePoses(draft).map((p) => draft[p]!).filter(Boolean)));
  }, [draft]);

  const cyclePose = (pose: PhotoPose) => {
    if (!draft) return;
    // Include empty so users can clear Side (or any pose).
    const options: Array<string | null> = [...pool, null];
    if (!options.length) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const current = prev[pose] ?? null;
      const idx = Math.max(
        0,
        options.findIndex((uri) => uri === current)
      );
      const nextUri = options[(idx + 1) % options.length];
      const next: PhotoSessionPhotos = { ...prev };
      if (!nextUri) {
        delete next[pose];
        return next;
      }
      const swapPose = PHOTO_POSES.find((p) => p !== pose && prev[p] === nextUri);
      next[pose] = nextUri;
      if (swapPose) {
        if (current) next[swapPose] = current;
        else delete next[swapPose];
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!session || !draft || saving) return;
    if (!availablePoses(draft).length) {
      Alert.alert('Keep one photo', 'A session needs at least one progress photo.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateSessionPosePhotos(session.id, draft);
      onSaved(updated);
      onClose();
    } catch (e) {
      console.warn('[PhotoSessionPoseEditModal] save failed', e);
      Alert.alert('Could not update poses', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!session) return <></>;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12} disabled={saving}>
            <Text style={styles.headerBtn}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.eyebrow}>Fix poses</Text>
            <Text style={styles.title}>{formatDisplayDate(session.date)}</Text>
          </View>
          <TouchableOpacity onPress={() => void handleSave()} hitSlop={12} disabled={saving || !draft}>
            {saving ? (
              <ActivityIndicator color={AppTheme.accent} />
            ) : (
              <Text style={[styles.headerBtn, styles.headerBtnAccent]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.help}>
            Tap a pose to cycle photos. Keep tapping to clear a slot — Side is optional. Save when
            each photo is in the right place.
          </Text>
          <View style={styles.poseRow}>
            {PHOTO_POSES.map((pose) => (
              <TouchableOpacity
                key={pose}
                style={styles.poseSlot}
                onPress={() => cyclePose(pose)}
                activeOpacity={0.85}
                disabled={saving}
              >
                {draft?.[pose] ? (
                  <Image source={{ uri: draft[pose] }} style={styles.thumb} />
                ) : (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>—</Text>
                  </View>
                )}
                <Text style={styles.poseLabel}>{PHOTO_POSE_LABELS[pose]}</Text>
                <Text style={styles.poseHint}>{draft?.[pose] ? 'Tap to change' : 'Optional'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
  headerBtn: { color: AppTheme.textSecondary, fontSize: 16, fontWeight: '600', minWidth: 64 },
  headerBtnAccent: { color: AppTheme.accent, textAlign: 'right' },
  headerCenter: { alignItems: 'center', flex: 1 },
  eyebrow: { color: AppTheme.textFaint, fontSize: 11, fontWeight: '700' },
  title: { color: AppTheme.textPrimary, fontSize: 16, fontWeight: '800' },
  body: { padding: 16, paddingBottom: 40 },
  help: { color: AppTheme.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  poseRow: { flexDirection: 'row', gap: 10 },
  poseSlot: { flex: 1, alignItems: 'center' },
  thumb: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: AppTheme.radiusCard,
    backgroundColor: AppTheme.card,
  },
  empty: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: AppTheme.radiusCard,
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: AppTheme.textFaint, fontSize: 22 },
  poseLabel: {
    marginTop: 8,
    color: AppTheme.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  poseHint: { marginTop: 2, color: AppTheme.textFaint, fontSize: 11 },
});

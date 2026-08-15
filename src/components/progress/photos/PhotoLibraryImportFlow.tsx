/**
 * Import progress photos from the device library (up to 15).
 * Photos are grouped by capture date onto the timeline; each day gets
 * front / side / back (by time order within that day).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { PermissionStatus } from 'expo-image-picker';
import { AppTheme } from '../../../theme/appVisualTheme';
import {
  PHOTO_POSES,
  PHOTO_POSE_LABELS,
  type PhotoPose,
} from '../../../types/progressPhotos';
import {
  formatDisplayDate,
  getSessionForDate,
} from '../../../services/PhotoService';
import { resolveAssetCaptureDate } from '../../../utils/progressPhotoCaptureDate';
import {
  assignPosesForDay,
  capturesFromDayDraft,
  groupPhotosIntoDayDrafts,
  type DaySessionDraft,
  type LibraryPhotoItem,
} from '../../../utils/progressPhotoImportGroups';
import {
  assignPosesForDaySmart,
  groupPhotosIntoDayDraftsSmart,
} from '../../../utils/progressPoseClassify';

export const LIBRARY_IMPORT_MAX_PHOTOS = 15;

export type LibraryImportSession = {
  captures: Partial<Record<PhotoPose, string>>;
  date: string;
  timestamp: string;
};

/** Batch import — one or many timeline days. */
export type LibraryImportResult = {
  sessions: LibraryImportSession[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onComplete: (result: LibraryImportResult) => Promise<void>;
};

type Phase = 'pick' | 'review' | 'confirm';

type DayConfirmMeta = {
  dateKey: string;
  displayDate: string;
  replace: boolean;
  poseCount: number;
  reusedPoses: boolean;
};

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveAssets(
  assets: ImagePicker.ImagePickerAsset[]
): Promise<LibraryPhotoItem[]> {
  const out: LibraryPhotoItem[] = [];
  for (const asset of assets) {
    if (!asset?.uri) continue;
    const resolved = await resolveAssetCaptureDate(asset);
    out.push({ uri: asset.uri, resolved });
  }
  return out;
}

export default function PhotoLibraryImportFlow({
  visible,
  onClose,
  onComplete,
}: Props): React.ReactElement {
  const [items, setItems] = useState<LibraryPhotoItem[]>([]);
  const [drafts, setDrafts] = useState<DaySessionDraft[]>([]);
  const [picking, setPicking] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [usedVision, setUsedVision] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<Phase>('pick');
  const [confirmMeta, setConfirmMeta] = useState<DayConfirmMeta[]>([]);
  const [suppressModal, setSuppressModal] = useState(false);
  const modalDismissResolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!visible) return;
    setItems([]);
    setDrafts([]);
    setPicking(false);
    setClassifying(false);
    setUsedVision(false);
    setSaving(false);
    setPhase('pick');
    setConfirmMeta([]);
    setSuppressModal(false);
    modalDismissResolveRef.current = null;
  }, [visible]);

  const rebuildDrafts = useCallback(async (nextItems: LibraryPhotoItem[]) => {
    setItems(nextItems);
    if (!nextItems.length) {
      setDrafts([]);
      setUsedVision(false);
      return;
    }
    setClassifying(true);
    try {
      const { drafts: nextDrafts, usedVision: vision } =
        await groupPhotosIntoDayDraftsSmart(nextItems);
      setDrafts(nextDrafts);
      setUsedVision(vision);
    } catch (e) {
      console.warn('[PhotoLibraryImportFlow] smart group failed', e);
      setDrafts(groupPhotosIntoDayDrafts(nextItems));
      setUsedVision(false);
    } finally {
      setClassifying(false);
    }
  }, []);

  /** Wait until our RN Modal is fully gone — iOS can't present PHPicker on top of it. */
  const dismissImportModal = useCallback(async () => {
    if (suppressModal) {
      await waitMs(Platform.OS === 'ios' ? 120 : 40);
      return;
    }
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        modalDismissResolveRef.current = null;
        resolve();
      };
      modalDismissResolveRef.current = finish;
      setSuppressModal(true);
      // onDismiss should fire on iOS; keep a fallback for Android / missed events.
      setTimeout(finish, Platform.OS === 'ios' ? 700 : 120);
    });
    await waitMs(Platform.OS === 'ios' ? 80 : 0);
  }, [suppressModal]);

  const pickPhotos = useCallback(async () => {
    if (picking || saving) return;
    setPicking(true);
    try {
      // Hide this modal first so the system picker can present (especially iOS simulator).
      await dismissImportModal();

      // iOS PHPicker does not require photo-library permission. Don't block the picker
      // if the simulator/device reports denied — still try to open Photos.
      try {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync(false);
        const hasAccess =
          perm.granted ||
          perm.status === PermissionStatus.GRANTED ||
          perm.accessPrivileges === 'limited' ||
          perm.accessPrivileges === 'all';
        if (Platform.OS === 'android' && !hasAccess) {
          setSuppressModal(false);
          Alert.alert(
            'Photo access needed',
            'Allow photo library access to upload past progress photos.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          return;
        }
      } catch (permErr) {
        console.warn('[PhotoLibraryImportFlow] permission request skipped', permErr);
        if (Platform.OS === 'android') {
          setSuppressModal(false);
          Alert.alert('Photo access needed', 'Allow photo library access and try again.');
          return;
        }
      }

      const remaining = Math.max(1, LIBRARY_IMPORT_MAX_PHOTOS - items.length);
      let assets: ImagePicker.ImagePickerAsset[] = [];
      let canceled = false;

      try {
        try {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
            allowsEditing: false,
            allowsMultipleSelection: true,
            selectionLimit: remaining,
            exif: true,
            ...(Platform.OS === 'android' ? { defaultTab: 'photos' as const } : {}),
          });
          canceled = result.canceled;
          assets = !result.canceled ? result.assets ?? [] : [];
        } catch (multiErr) {
          console.warn('[PhotoLibraryImportFlow] multi-select failed, retrying single', multiErr);
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
            allowsEditing: false,
            allowsMultipleSelection: false,
            selectionLimit: 1,
            exif: true,
          });
          canceled = result.canceled;
          assets = !result.canceled ? result.assets ?? [] : [];
        }

        if (!assets.length && Platform.OS === 'android') {
          const pending = await ImagePicker.getPendingResultAsync();
          if (pending && 'assets' in pending && Array.isArray(pending.assets)) {
            assets = pending.assets;
            canceled = false;
          }
        }
      } finally {
        // Small delay so the system picker finishes dismissing before we re-show.
        await waitMs(Platform.OS === 'ios' ? 350 : 80);
        setSuppressModal(false);
      }

      const incoming = await resolveAssets(assets);
      if (!incoming.length) {
        if (!canceled && __DEV__) {
          Alert.alert(
            'No photos selected',
            'On the iOS Simulator, open the Photos app and drag images in from Finder first, then try Upload again.'
          );
        }
        return;
      }

      const merged = [...items, ...incoming].slice(0, LIBRARY_IMPORT_MAX_PHOTOS);
      await rebuildDrafts(merged);
      setPhase('review');
    } catch (e) {
      setSuppressModal(false);
      console.warn('[PhotoLibraryImportFlow] pick failed', e);
      Alert.alert(
        'Could not open photos',
        Platform.OS === 'ios'
          ? 'Close any other photo screens and try again. On the Simulator, add images to the Photos app first (drag from Finder).'
          : 'Try again, or take photos in-app instead.'
      );
    } finally {
      setPicking(false);
    }
  }, [dismissImportModal, items, picking, rebuildDrafts, saving]);

  const clearAll = () => {
    void rebuildDrafts([]);
    setPhase('pick');
    setConfirmMeta([]);
  };

  const removePhoto = (uri: string) => {
    void rebuildDrafts(items.filter((i) => i.uri !== uri));
  };

  const cyclePoseAssignment = (dateKey: string, pose: PhotoPose) => {
    setDrafts((prev) =>
      prev.map((draft) => {
        if (draft.dateKey !== dateKey || !draft.photos.length) return draft;
        const current = draft.poses[pose];
        // Cycle photos, then clear — side (or any pose) can stay empty.
        const options: Array<LibraryPhotoItem | null> = [...draft.photos, null];
        const idx = Math.max(
          0,
          options.findIndex((p) => (p?.uri ?? null) === (current?.uri ?? null))
        );
        const nextPhoto = options[(idx + 1) % options.length];
        const nextPoses = { ...draft.poses };
        if (!nextPhoto) {
          delete nextPoses[pose];
          return { ...draft, poses: nextPoses };
        }
        const swapPose = PHOTO_POSES.find(
          (p) => p !== pose && draft.poses[p]?.uri === nextPhoto.uri
        );
        nextPoses[pose] = nextPhoto;
        if (swapPose) {
          if (current) nextPoses[swapPose] = current;
          else delete nextPoses[swapPose];
        }
        return { ...draft, poses: nextPoses };
      })
    );
  };

  const autoAssignDay = (dateKey: string) => {
    void (async () => {
      setClassifying(true);
      try {
        setDrafts((prev) => {
          // optimistic timestamp while async runs — replaced below
          return prev;
        });
        const draft = drafts.find((d) => d.dateKey === dateKey);
        if (!draft) return;
        const assigned = await assignPosesForDaySmart(draft.photos);
        setDrafts((prev) =>
          prev.map((d) =>
            d.dateKey === dateKey ? { ...d, poses: assigned.poses } : d
          )
        );
        if (assigned.source === 'vision') setUsedVision(true);
      } catch (e) {
        console.warn('[PhotoLibraryImportFlow] auto-assign failed', e);
        setDrafts((prev) =>
          prev.map((draft) =>
            draft.dateKey === dateKey
              ? { ...draft, poses: assignPosesForDay(draft.photos) }
              : draft
          )
        );
      } finally {
        setClassifying(false);
      }
    })();
  };

  const readySessions = useMemo(() => {
    const out: LibraryImportSession[] = [];
    for (const draft of drafts) {
      const captures = capturesFromDayDraft(draft);
      if (!captures) continue;
      out.push({
        captures,
        date: draft.dateKey,
        timestamp: draft.timestampIso,
      });
    }
    return out;
  }, [drafts]);

  const goToConfirm = useCallback(async () => {
    if (!readySessions.length || saving) return;
    try {
      const meta: DayConfirmMeta[] = [];
      for (const draft of drafts) {
        const captures = capturesFromDayDraft(draft);
        if (!captures) continue;
        const existing = await getSessionForDate(draft.dateKey);
        const uniqueUris = new Set(
          PHOTO_POSES.map((p) => draft.poses[p]?.uri).filter(Boolean)
        );
        meta.push({
          dateKey: draft.dateKey,
          displayDate: formatDisplayDate(draft.dateKey),
          replace: Boolean(existing),
          poseCount: uniqueUris.size,
          reusedPoses: false,
        });
      }
      setConfirmMeta(meta);
      setPhase('confirm');
    } catch (e) {
      console.warn('[PhotoLibraryImportFlow] confirm prep failed', e);
      Alert.alert('Could not prepare save', 'Please try again.');
    }
  }, [drafts, readySessions.length, saving]);

  const performSave = useCallback(async () => {
    if (!readySessions.length || saving) return;
    setSaving(true);
    try {
      await onComplete({ sessions: readySessions });
      onClose();
    } catch (e) {
      console.warn('[PhotoLibraryImportFlow] save failed', e);
      Alert.alert('Save failed', 'Could not import those photos. Please try again.');
      setPhase('review');
    } finally {
      setSaving(false);
    }
  }, [onClose, onComplete, readySessions, saving]);

  if (!visible) {
    return <></>;
  }

  return (
    <Modal
      visible={visible && !suppressModal}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      onDismiss={() => {
        modalDismissResolveRef.current?.();
        modalDismissResolveRef.current = null;
      }}
    >
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />

        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (phase === 'confirm') {
                setPhase('review');
                return;
              }
              if (phase === 'review' && items.length > 0) {
                setPhase('pick');
                return;
              }
              onClose();
            }}
            style={styles.headerBtn}
            hitSlop={12}
          >
            <Text style={styles.headerBtnText}>
              {phase === 'pick' ? 'Cancel' : '‹ Back'}
            </Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.stepLabel}>Camera roll</Text>
            <Text style={styles.poseTitle}>
              {phase === 'confirm'
                ? 'Save to timeline'
                : phase === 'review'
                  ? 'Review by day'
                  : 'Upload photos'}
            </Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        {phase === 'pick' ? (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.hero}>Upload progress history</Text>
            <Text style={styles.bodyText}>
              Select up to {LIBRARY_IMPORT_MAX_PHOTOS} photos. Front, side, and back are all
              optional — two photos (e.g. front + back) is fine. We group by capture day and detect
              which pose is which. Fix any mix-ups before saving.
            </Text>
            <Text style={styles.bodyText}>
              Tip: pick photos in any order — date grouping and pose detection handle the rest.
            </Text>
            {__DEV__ && Platform.OS === 'ios' ? (
              <Text style={styles.bodyText}>
                Simulator: drag images into the Photos app from Finder first, then select them here.
              </Text>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, (picking || saving) && styles.primaryBtnDisabled]}
              onPress={() => void pickPhotos()}
              disabled={picking || saving}
              activeOpacity={0.85}
            >
              {picking ? (
                <ActivityIndicator color={AppTheme.accentDark} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {items.length
                    ? `Add more photos (${items.length}/${LIBRARY_IMPORT_MAX_PHOTOS})`
                    : `Select up to ${LIBRARY_IMPORT_MAX_PHOTOS} photos`}
                </Text>
              )}
            </TouchableOpacity>

            {items.length > 0 ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPhase('review')}>
                <Text style={styles.secondaryBtnText}>
                  Review {drafts.length} day{drafts.length === 1 ? '' : 's'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        ) : null}

        {phase === 'review' ? (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.hero}>
              {drafts.length} day{drafts.length === 1 ? '' : 's'} · {items.length} photo
              {items.length === 1 ? '' : 's'}
            </Text>
            <Text style={styles.bodyText}>
              {usedVision
                ? 'Poses were auto-detected from each photo. Tap a thumbnail to swap if Front / Side / Back got mixed up.'
                : 'Poses were grouped by capture time. Tap a thumbnail to cycle photos — or tap Auto-detect to re-run pose detection.'}
              {' '}
              Empty slots stay empty — you don’t need a side photo.
            </Text>

            {classifying ? (
              <View style={styles.classifyingRow}>
                <ActivityIndicator color={AppTheme.accent} />
                <Text style={styles.classifyingText}>Detecting front, side, and back…</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.secondaryBtn, styles.secondaryBtnSpaced]}
              onPress={() => void pickPhotos()}
              disabled={picking || items.length >= LIBRARY_IMPORT_MAX_PHOTOS}
            >
              <Text style={styles.secondaryBtnText}>
                {picking ? 'Opening…' : `Add more (${items.length}/${LIBRARY_IMPORT_MAX_PHOTOS})`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={clearAll}>
              <Text style={styles.linkBtnText}>Clear all</Text>
            </TouchableOpacity>

            {drafts.map((draft) => {
              const extras = Math.max(0, draft.photos.length - 3);
              return (
                <View key={draft.dateKey} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayTitle}>{formatDisplayDate(draft.dateKey)}</Text>
                    <TouchableOpacity onPress={() => autoAssignDay(draft.dateKey)} hitSlop={8}>
                      <Text style={styles.resetText}>Auto-detect</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.dayMeta}>
                    {draft.photos.length} photo{draft.photos.length === 1 ? '' : 's'}
                    {extras > 0 ? ` · ${extras} extra not used as poses` : ''}
                  </Text>
                  <View style={styles.poseRow}>
                    {PHOTO_POSES.map((pose) => {
                      const pick = draft.poses[pose];
                      return (
                        <TouchableOpacity
                          key={pose}
                          style={styles.poseSlot}
                          onPress={() => cyclePoseAssignment(draft.dateKey, pose)}
                          activeOpacity={0.85}
                        >
                          {pick?.uri ? (
                            <Image source={{ uri: pick.uri }} style={styles.poseThumb} />
                          ) : (
                            <View style={styles.poseEmpty}>
                              <Text style={styles.poseEmptyText}>—</Text>
                            </View>
                          )}
                          <Text style={styles.poseLabel}>{PHOTO_POSE_LABELS[pose]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {draft.photos.length > 3 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.extraRow}>
                      {draft.photos.map((photo, i) => (
                        <View key={`${photo.uri}-${i}`} style={styles.extraWrap}>
                          <Image source={{ uri: photo.uri }} style={styles.extraThumb} />
                          <TouchableOpacity
                            style={styles.extraRemove}
                            onPress={() => removePhoto(photo.uri)}
                            hitSlop={6}
                          >
                            <Text style={styles.extraRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        {phase === 'confirm' ? (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.hero}>Ready to save</Text>
            <Text style={styles.bodyText}>
              {readySessions.length} session{readySessions.length === 1 ? '' : 's'} will be added to
              your progress timeline.
            </Text>
            {confirmMeta.map((m) => (
              <View key={m.dateKey} style={styles.confirmRow}>
                <Text style={styles.confirmDate}>{m.displayDate}</Text>
                <Text style={styles.confirmMeta}>
                  {m.poseCount} pose{m.poseCount === 1 ? '' : 's'}
                  {m.replace ? ' · replaces existing' : ''}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.actions}>
          {phase === 'pick' ? (
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (!items.length || picking || saving) && styles.primaryBtnDisabled,
              ]}
              onPress={() => (items.length ? setPhase('review') : void pickPhotos())}
              disabled={picking || saving}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>
                {items.length ? 'Continue to review' : `Select up to ${LIBRARY_IMPORT_MAX_PHOTOS} photos`}
              </Text>
            </TouchableOpacity>
          ) : null}

          {phase === 'review' ? (
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (!readySessions.length || picking || saving || classifying) &&
                  styles.primaryBtnDisabled,
              ]}
              onPress={() => void goToConfirm()}
              disabled={!readySessions.length || picking || saving || classifying}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>
                {classifying
                  ? 'Detecting poses…'
                  : readySessions.length
                    ? `Review & save ${readySessions.length} day${readySessions.length === 1 ? '' : 's'}`
                    : 'Add photos to continue'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {phase === 'confirm' ? (
            <TouchableOpacity
              style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
              onPress={() => void performSave()}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={AppTheme.accentDark} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  Save {readySessions.length} session{readySessions.length === 1 ? '' : 's'}
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
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
  headerBtn: { minWidth: 72 },
  headerBtnText: { color: AppTheme.accent, fontSize: 16, fontWeight: '600' },
  headerCenter: { alignItems: 'center' },
  stepLabel: { color: AppTheme.textFaint, fontSize: 12, fontWeight: '600' },
  poseTitle: { color: AppTheme.textPrimary, fontSize: 18, fontWeight: '800' },
  body: { paddingHorizontal: 20, paddingBottom: 28 },
  hero: {
    color: AppTheme.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  bodyText: {
    color: AppTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  classifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingVertical: 8,
  },
  classifyingText: {
    color: AppTheme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: AppTheme.radiusPill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnText: {
    color: AppTheme.accentDark,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    marginTop: 12,
    borderRadius: AppTheme.radiusPill,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.card,
  },
  secondaryBtnSpaced: { marginBottom: 4 },
  secondaryBtnText: {
    color: AppTheme.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  linkBtn: { alignSelf: 'center', paddingVertical: 10 },
  linkBtnText: { color: AppTheme.textMuted, fontWeight: '600', fontSize: 13 },
  dayCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.card,
    padding: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayTitle: { color: AppTheme.textPrimary, fontSize: 16, fontWeight: '800' },
  resetText: { color: AppTheme.accent, fontSize: 13, fontWeight: '600' },
  dayMeta: { color: AppTheme.textFaint, fontSize: 12, marginTop: 4, marginBottom: 10 },
  poseRow: { flexDirection: 'row', gap: 8 },
  poseSlot: { flex: 1, alignItems: 'center' },
  poseThumb: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 10,
    backgroundColor: '#000',
  },
  poseEmpty: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.bgElevated,
  },
  poseEmptyText: { color: AppTheme.textFaint },
  poseLabel: {
    marginTop: 6,
    color: AppTheme.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  extraRow: { marginTop: 12 },
  extraWrap: { marginRight: 8, position: 'relative' },
  extraThumb: {
    width: 56,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  extraRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraRemoveText: { color: AppTheme.textPrimary, fontWeight: '700', fontSize: 14 },
  confirmRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  confirmDate: { color: AppTheme.textPrimary, fontWeight: '700', fontSize: 15 },
  confirmMeta: { color: AppTheme.textMuted, fontSize: 12, marginTop: 4 },
  actions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
});

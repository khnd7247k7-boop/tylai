import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import type { PhotoSession, PhotoPose } from '../../types/progressPhotos';
import type { SessionProgressMetrics } from '../../types/sessionProgressMetrics';
import type { WorkoutSession } from '../../../data/workoutPrograms';
import type { LoggedMeal } from '../../utils/loggedMeals';
import type { WeightEntry } from '../../utils/workoutHistoryChartData';
import type { ProgressScoreResult } from '../../services/progressScoreService';
import {
  computeProgressScores,
  type ProgressScoreInput,
} from '../../services/progressScoreService';
import type { HistoryLinePoint } from '../../utils/workoutHistoryChartData';
import {
  loadPhotoSessions,
  computePhotoStats,
  createSessionFromCaptures,
  selectDefaultSession,
  formatTimelineLabel,
} from '../../services/PhotoService';
import { buildMetricsBySessionId, buildBodyVitalsForDate } from '../../services/sessionProgressMetricsService';
import {
  isMediaLibraryAvailable,
  mediaLibraryUnavailableMessage,
  requestCameraRollPermission,
} from '../../services/PhotoCameraRollService';
import {
  loadProgressPhotoSettings,
  markCameraRollPromptSeen,
} from '../../utils/progressPhotoSettings';
import { warmSessionPhotos } from '../../utils/progressPhotoImage';
import { computeSessionCompleteness } from '../../utils/sessionCompleteness';
import { subscribeUserDataReady } from '../../utils/userDataEvents';
import { AppTheme } from '../../theme/appVisualTheme';
import OverallProgressCard from './OverallProgressCard';
import PhotoScoreGlance from './PhotoScoreGlance';
import ProgressWeekVitals from './ProgressWeekVitals';
import PhotoTimeline from './photos/PhotoTimeline';
import PhotoCaptureFlow from './photos/PhotoCaptureFlow';
import PhotoLibraryImportFlow from './photos/PhotoLibraryImportFlow';
import type { LibraryImportResult } from './photos/PhotoLibraryImportFlow';
import ProgressPhotoCameraRollPrompt from './photos/ProgressPhotoCameraRollPrompt';
import ProgressReplayControls from './photos/ProgressReplayControls';
import PhotoSessionDetailModal from './photos/PhotoSessionDetailModal';
import PhotoHeroCard from './photos/PhotoHeroCard';
import ProgressPhotosEmptyState from './photos/ProgressPhotosEmptyState';
import HistoryLineChart from '../HistoryLineChart';
import ProgressBodyMetricsModal from './ProgressBodyMetricsModal';
import type { MeasurementEntry } from '../../types/bodyMeasurements';

export interface ProgressJourneyDataBundle {
  workoutHistory: WorkoutSession[];
  meals: LoggedMeal[];
  weightEntries: WeightEntry[];
  measurementEntries?: MeasurementEntry[];
  moodEntries: Array<{ date?: string; sleepQuality?: number }>;
  reflectionDates?: string[];
}

interface ProgressJourneyProps {
  progressResult: ProgressScoreResult;
  /** Full score input — used to compute the week score for the visible photo. */
  scoreInput?: ProgressScoreInput | null;
  weightSeries: HistoryLinePoint[];
  dataBundle?: ProgressJourneyDataBundle | null;
  selectedProgressDate: string | null;
  onProgressDateChange: (date: string | null) => void;
}

function localDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nearestSessionByDate(
  sessions: PhotoSession[],
  date: string
): PhotoSession | null {
  if (!sessions.length) return null;
  let best: PhotoSession | null = null;
  let bestDist = Infinity;
  const t = new Date(`${date.slice(0, 10)}T12:00:00`).getTime();
  for (const s of sessions) {
    const dist = Math.abs(new Date(`${s.date}T12:00:00`).getTime() - t);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best;
}

/**
 * One living Progress movie.
 * Scrubbing the journey timeline rewrites score, coach, photos, vitals, and chart together.
 */
export default function ProgressJourney({
  progressResult,
  scoreInput = null,
  weightSeries,
  dataBundle,
  selectedProgressDate,
  onProgressDateChange,
}: ProgressJourneyProps): React.ReactElement {
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [captureVisible, setCaptureVisible] = useState(false);
  const [libraryImportVisible, setLibraryImportVisible] = useState(false);
  const [retakeMode, setRetakeMode] = useState(false);
  const [showCameraRollPrompt, setShowCameraRollPrompt] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedPose, setSelectedPose] = useState<PhotoPose>('front');
  const [metricsModalVisible, setMetricsModalVisible] = useState(false);
  const [inlineCompare, setInlineCompare] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayLabel, setReplayLabel] = useState('');
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Only scrub / chart / metrics should rewrite the Progress week — not default photo pick. */
  const userDrivenWeekRef = useRef(false);
  const onDateChangeRef = useRef(onProgressDateChange);
  onDateChangeRef.current = onProgressDateChange;

  const reload = useCallback(async () => {
    const loaded = await loadPhotoSessions();
    setSessions(loaded);
    setSelectedId((prev) => selectDefaultSession(loaded, prev)?.id ?? null);
    loaded.forEach((s) => warmSessionPhotos(s.photos));
  }, []);

  useEffect(() => {
    reload();
    return subscribeUserDataReady(reload);
  }, [reload]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    loadProgressPhotoSettings().then((settings) => {
      if (!settings.cameraRollPromptSeen && isMediaLibraryAvailable()) {
        setShowCameraRollPrompt(true);
      } else if (!settings.cameraRollPromptSeen && !isMediaLibraryAvailable()) {
        void markCameraRollPromptSeen(false);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (replayTimer.current) clearInterval(replayTimer.current);
    };
  }, []);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.date.localeCompare(b.date)),
    [sessions]
  );

  useEffect(() => {
    if (!selectedProgressDate || !sessions.length) return;
    setSelectedId((prev) => {
      const current = sessions.find((s) => s.id === prev);
      // Keep the user's pick when it already matches this date (avoids same-day jumpiness).
      if (current && current.date.slice(0, 10) === selectedProgressDate.slice(0, 10)) {
        return prev;
      }
      const best = nearestSessionByDate(sessions, selectedProgressDate);
      if (!best || best.id === prev) return prev;
      return best.id;
    });
  }, [selectedProgressDate, sessions]);

  const stats = useMemo(() => computePhotoStats(sessions), [sessions]);
  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedId) ?? selectDefaultSession(sessions),
    [sessions, selectedId]
  );

  const metricsMap = useMemo(() => {
    if (!dataBundle) return new Map<string, SessionProgressMetrics>();
    return buildMetricsBySessionId(sessions, {
      weightEntries: dataBundle.weightEntries,
      measurementEntries: dataBundle.measurementEntries ?? [],
      meals: dataBundle.meals,
      workoutHistory: dataBundle.workoutHistory,
      moodEntries: dataBundle.moodEntries,
    });
  }, [dataBundle, sessions]);

  const reflectionSet = useMemo(
    () => new Set(dataBundle?.reflectionDates ?? []),
    [dataBundle?.reflectionDates]
  );

  const selectedMetrics = selectedSession
    ? metricsMap.get(selectedSession.id) ?? null
    : null;

  const focusDate =
    selectedSession?.date?.slice(0, 10) ??
    selectedProgressDate?.slice(0, 10) ??
    localDateKey();

  /** Always resolve body metrics for the focused day so Save → vitals works without photos. */
  const displayMetrics = useMemo((): SessionProgressMetrics | null => {
    if (!dataBundle) return selectedMetrics;
    const body = buildBodyVitalsForDate(focusDate, {
      weightEntries: dataBundle.weightEntries,
      measurementEntries: dataBundle.measurementEntries ?? [],
    });
    if (selectedMetrics) {
      return {
        ...selectedMetrics,
        weight: body.weight,
        measurements: body.measurements,
        extraMeasurements: body.extraMeasurements,
      };
    }
    return body;
  }, [dataBundle, focusDate, selectedMetrics]);

  const selectedIndex = selectedSession
    ? sortedSessions.findIndex((s) => s.id === selectedSession.id)
    : -1;

  const compareSession =
    selectedIndex > 0 && sortedSessions.length > 1 ? sortedSessions[0] : null;

  const completeness = selectedSession
    ? computeSessionCompleteness(selectedSession, displayMetrics, {
        hasReflection: reflectionSet.has(selectedSession.date),
      })
    : null;

  const weekLabel =
    selectedProgressDate || userDrivenWeekRef.current
      ? selectedSession
        ? formatTimelineLabel(
            selectedSession,
            Math.max(0, selectedIndex),
            selectedSession.date === localDateKey()
          )
        : 'This week'
      : 'This week';

  /** Score for the week of the photo on screen — always matches the visible frame. */
  const photoWeekScore = useMemo(() => {
    if (!scoreInput || !selectedSession?.date) return progressResult;
    const dateKey = selectedSession.date.slice(0, 10);
    return computeProgressScores({
      ...scoreInput,
      referenceDate: new Date(`${dateKey}T12:00:00`),
    });
  }, [progressResult, scoreInput, selectedSession?.date]);

  const photoWeekLabel = selectedSession
    ? formatTimelineLabel(
        selectedSession,
        Math.max(0, selectedIndex),
        selectedSession.date === localDateKey()
      )
    : weekLabel;

  useEffect(() => {
    if (selectedSession) warmSessionPhotos(selectedSession.photos);
  }, [selectedSession]);

  useEffect(() => {
    setInlineCompare(false);
  }, [selectedSession?.id]);

  const emitWeekForSession = useCallback((session: PhotoSession) => {
    userDrivenWeekRef.current = true;
    const nextDate = session.date?.slice(0, 10) ?? null;
    onDateChangeRef.current?.(nextDate);
  }, []);

  const selectSession = useCallback(
    (session: PhotoSession) => {
      setSelectedId((prev) => (prev === session.id ? prev : session.id));
      emitWeekForSession(session);
    },
    [emitWeekForSession]
  );

  const openCapture = (retake = false) => {
    setRetakeMode(retake);
    setCaptureVisible(true);
  };

  const openLibraryImport = () => {
    setLibraryImportVisible(true);
  };

  const handleCaptureComplete = async (
    captures: Parameters<typeof createSessionFromCaptures>[0]
  ) => {
    const session = await createSessionFromCaptures(captures);
    await reload();
    setSelectedId(session.id);
  };

  const handleLibraryImportComplete = async (result: LibraryImportResult) => {
    try {
      const sessions = result.sessions ?? [];
      if (!sessions.length) {
        throw new Error('No sessions to import');
      }
      let lastId: string | null = null;
      for (const entry of sessions) {
        const session = await createSessionFromCaptures(entry.captures, {
          date: entry.date,
          timestamp: entry.timestamp,
        });
        lastId = session.id;
      }
      await reload();
      if (lastId) setSelectedId(lastId);
      setLibraryImportVisible(false);
    } catch (error) {
      console.warn('[ProgressJourney] library import failed', error);
      throw error;
    }
  };

  const handleSaveToCameraRoll = async () => {
    try {
      if (!isMediaLibraryAvailable()) {
        Alert.alert('Camera roll unavailable', mediaLibraryUnavailableMessage());
        await markCameraRollPromptSeen(false);
        setShowCameraRollPrompt(false);
        return;
      }
      const granted = await requestCameraRollPermission();
      await markCameraRollPromptSeen(granted);
      if (!granted) {
        Alert.alert(
          'Photo library access needed',
          'You can enable camera roll backup later in Health & Trends.'
        );
      }
    } catch (error) {
      console.warn('[ProgressJourney] camera roll opt-in failed', error);
      await markCameraRollPromptSeen(false);
      Alert.alert(
        'Could not enable camera roll',
        'Try again from Health & Trends → Progress photos, or rebuild the app if this keeps happening.'
      );
    } finally {
      setShowCameraRollPrompt(false);
    }
  };

  const stopReplay = useCallback(() => {
    if (replayTimer.current) {
      clearInterval(replayTimer.current);
      replayTimer.current = null;
    }
    setIsReplaying(false);
    setReplayLabel('');
  }, []);

  const startReplay = useCallback(() => {
    if (sortedSessions.length < 2) return;
    stopReplay();
    setIsReplaying(true);
    let index = 0;
    setSelectedId(sortedSessions[0].id);
    setReplayLabel(
      formatTimelineLabel(sortedSessions[0], 0, sortedSessions[0].date === localDateKey())
    );

    replayTimer.current = setInterval(() => {
      index += 1;
      if (index >= sortedSessions.length) {
        stopReplay();
        return;
      }
      const session = sortedSessions[index];
      selectSession(session);
      setReplayLabel(formatTimelineLabel(session, index, session.date === localDateKey()));
    }, 1400);
  }, [selectSession, sortedSessions, stopReplay]);

  const handleSwipeSession = (direction: 'prev' | 'next') => {
    if (!selectedSession || sortedSessions.length < 2) return;
    const idx = sortedSessions.findIndex((s) => s.id === selectedSession.id);
    if (idx < 0) return;
    const next = direction === 'next' ? sortedSessions[idx + 1] : sortedSessions[idx - 1];
    if (next) {
      stopReplay();
      selectSession(next);
    }
  };

  const handleScrubIndex = (index: number) => {
    const s = sortedSessions[index];
    if (s && s.id !== selectedId) {
      stopReplay();
      selectSession(s);
    }
  };

  const hasSessions = sessions.length > 0;

  return (
    <View style={styles.wrap}>
      <OverallProgressCard
        result={progressResult}
        variant="journey"
        weekLabel={selectedProgressDate != null ? weekLabel : 'This week'}
      />

      {/* Journey scrubber — photos and synced metrics follow */}
      {hasSessions ? (
        <View style={styles.scrubber}>
          <ProgressReplayControls
            isPlaying={isReplaying}
            disabled={sessions.length < 2}
            onToggle={() => (isReplaying ? stopReplay() : startReplay())}
            progressLabel={replayLabel}
          />
          <PhotoTimeline
            sessions={sortedSessions}
            selectedId={selectedSession?.id ?? ''}
            metricsById={metricsMap}
            reflectionDates={reflectionSet}
            thumbPose={selectedPose}
            pageScrubber
            onSelect={(s) => {
              stopReplay();
              selectSession(s);
            }}
            onScrubIndex={handleScrubIndex}
          />
        </View>
      ) : null}

      {hasSessions && selectedSession ? (
        <PhotoScoreGlance result={photoWeekScore} weekLabel={photoWeekLabel} />
      ) : null}

      {hasSessions && selectedSession && completeness ? (
        <PhotoHeroCard
          embedded
          session={selectedSession}
          weekIndex={Math.max(0, selectedIndex)}
          isToday={selectedSession.date === localDateKey()}
          completeness={completeness}
          compareSession={compareSession}
          compareMode={inlineCompare}
          onCompareModeChange={setInlineCompare}
          pose={selectedPose}
          onPoseChange={setSelectedPose}
          onOpenDetails={() => setDetailVisible(true)}
          onSwipeSession={handleSwipeSession}
          canSwipePrev={selectedIndex > 0}
          canSwipeNext={selectedIndex >= 0 && selectedIndex < sortedSessions.length - 1}
        />
      ) : (
        <ProgressPhotosEmptyState
          onTakePhotos={() => openCapture(false)}
          onUploadFromLibrary={openLibraryImport}
        />
      )}

      {hasSessions ? (
        <View style={styles.photoActions}>
          <TouchableOpacity
            style={styles.photoActionPrimary}
            onPress={() => openCapture(stats.hasSessionToday)}
            activeOpacity={0.85}
          >
            <Text style={styles.photoActionPrimaryText}>{stats.buttonLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.photoActionSecondary}
            onPress={openLibraryImport}
            activeOpacity={0.85}
          >
            <Text style={styles.photoActionSecondaryText}>Upload from library</Text>
          </TouchableOpacity>
          <Text style={styles.photoCadenceHint}>
            Weekly photos are a great baseline — take them daily anytime you want. Library uploads
            use each photo&apos;s date so past shots land in the right place on your timeline.
          </Text>
        </View>
      ) : null}

      <ProgressWeekVitals metrics={displayMetrics} />

      <TouchableOpacity
        style={styles.logMetricsBtn}
        onPress={() => setMetricsModalVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.logMetricsBtnText}>Log weight & measurements</Text>
      </TouchableOpacity>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Weight</Text>
        <HistoryLineChart
          series={weightSeries}
          highlightDate={selectedProgressDate}
          onSelectDate={(date) => {
            stopReplay();
            userDrivenWeekRef.current = true;
            onProgressDateChange(date.slice(0, 10));
          }}
          options={{
            emptyTitle: 'No weight history yet',
            emptySub: 'Log body weight to see it move with this week.',
            lineColor: AppTheme.accent,
            yDecimals: 1,
            statUnit: ' lb',
          }}
        />
      </View>

      <PhotoCaptureFlow
        visible={captureVisible}
        retake={retakeMode}
        onClose={() => setCaptureVisible(false)}
        onComplete={handleCaptureComplete}
      />

      <PhotoLibraryImportFlow
        visible={libraryImportVisible}
        onClose={() => setLibraryImportVisible(false)}
        onComplete={handleLibraryImportComplete}
      />

      <ProgressPhotoCameraRollPrompt
        visible={showCameraRollPrompt}
        onSaveToCameraRoll={handleSaveToCameraRoll}
        onKeepInAppOnly={async () => {
          await markCameraRollPromptSeen(false);
          setShowCameraRollPrompt(false);
        }}
      />

      <PhotoSessionDetailModal
        visible={detailVisible}
        session={selectedSession}
        metrics={displayMetrics}
        initialPose={selectedPose}
        onPoseChange={setSelectedPose}
        onClose={() => setDetailVisible(false)}
      />

      <ProgressBodyMetricsModal
        visible={metricsModalVisible}
        initialDate={focusDate}
        onClose={() => setMetricsModalVisible(false)}
        onSaved={(savedDate) => {
          if (savedDate) {
            userDrivenWeekRef.current = true;
            onProgressDateChange(savedDate);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 8 },
  scrubber: {
    marginTop: 4,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
  },
  photoActions: {
    marginBottom: 14,
    gap: 8,
  },
  photoActionPrimary: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: AppTheme.radiusPill,
    backgroundColor: AppTheme.accent,
    alignItems: 'center',
  },
  photoActionPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: AppTheme.accentDark,
  },
  photoActionSecondary: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: AppTheme.radiusPill,
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.card,
    alignItems: 'center',
  },
  photoActionSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppTheme.textPrimary,
  },
  photoCadenceHint: {
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textMuted,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  logMetricsBtn: {
    alignSelf: 'stretch',
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: AppTheme.radiusPill,
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.card,
    alignItems: 'center',
  },
  logMetricsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppTheme.textPrimary,
  },
  chartCard: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: AppTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
});

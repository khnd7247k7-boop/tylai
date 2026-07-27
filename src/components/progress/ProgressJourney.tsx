import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import type { PhotoSession } from '../../types/progressPhotos';
import type { SessionProgressMetrics } from '../../types/sessionProgressMetrics';
import type { WorkoutSession } from '../../../data/workoutPrograms';
import type { LoggedMeal } from '../../utils/loggedMeals';
import type { WeightEntry } from '../../utils/workoutHistoryChartData';
import type { ProgressScoreResult } from '../../services/progressScoreService';
import type { HistoryLinePoint } from '../../utils/workoutHistoryChartData';
import {
  loadPhotoSessions,
  computePhotoStats,
  createSessionFromCaptures,
  selectDefaultSession,
  formatTimelineLabel,
} from '../../services/PhotoService';
import { buildMetricsBySessionId } from '../../services/sessionProgressMetricsService';
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
import ProgressWeekVitals from './ProgressWeekVitals';
import PhotoTimeline from './photos/PhotoTimeline';
import PhotoCaptureFlow from './photos/PhotoCaptureFlow';
import ProgressPhotoCameraRollPrompt from './photos/ProgressPhotoCameraRollPrompt';
import ProgressReplayControls from './photos/ProgressReplayControls';
import PhotoSessionDetailModal from './photos/PhotoSessionDetailModal';
import PhotoHeroCard from './photos/PhotoHeroCard';
import ProgressPhotosEmptyState from './photos/ProgressPhotosEmptyState';
import HistoryLineChart from '../HistoryLineChart';

export interface ProgressJourneyDataBundle {
  workoutHistory: WorkoutSession[];
  meals: LoggedMeal[];
  weightEntries: WeightEntry[];
  moodEntries: Array<{ date?: string; sleepQuality?: number }>;
  reflectionDates?: string[];
}

interface ProgressJourneyProps {
  progressResult: ProgressScoreResult;
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
  weightSeries,
  dataBundle,
  selectedProgressDate,
  onProgressDateChange,
}: ProgressJourneyProps): React.ReactElement {
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [captureVisible, setCaptureVisible] = useState(false);
  const [retakeMode, setRetakeMode] = useState(false);
  const [showCameraRollPrompt, setShowCameraRollPrompt] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [inlineCompare, setInlineCompare] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayLabel, setReplayLabel] = useState('');
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEmittedDateRef = useRef<string | null>(null);
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
    const best = nearestSessionByDate(sessions, selectedProgressDate);
    if (!best) return;
    setSelectedId((prev) => (prev === best.id ? prev : best.id));
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

  const selectedIndex = selectedSession
    ? sortedSessions.findIndex((s) => s.id === selectedSession.id)
    : -1;

  const compareSession =
    selectedIndex > 0 && sortedSessions.length > 1 ? sortedSessions[0] : null;

  const completeness = selectedSession
    ? computeSessionCompleteness(selectedSession, selectedMetrics, {
        hasReflection: reflectionSet.has(selectedSession.date),
      })
    : null;

  const weekLabel = selectedSession
    ? formatTimelineLabel(
        selectedSession,
        Math.max(0, selectedIndex),
        selectedSession.date === localDateKey()
      )
    : 'This week';

  useEffect(() => {
    const nextDate = selectedSession?.date?.slice(0, 10) ?? null;
    if (nextDate === lastEmittedDateRef.current) return;
    lastEmittedDateRef.current = nextDate;
    onDateChangeRef.current?.(nextDate);
  }, [selectedSession]);

  useEffect(() => {
    if (selectedSession) warmSessionPhotos(selectedSession.photos);
  }, [selectedSession]);

  useEffect(() => {
    setInlineCompare(false);
  }, [selectedSession?.id]);

  const selectSession = useCallback((session: PhotoSession) => {
    setSelectedId((prev) => (prev === session.id ? prev : session.id));
  }, []);

  const openCapture = (retake = false) => {
    setRetakeMode(retake);
    setCaptureVisible(true);
  };

  const handleCaptureComplete = async (
    captures: Parameters<typeof createSessionFromCaptures>[0]
  ) => {
    // createSessionFromCaptures keeps all prior dates; only replaces today's session.
    const session = await createSessionFromCaptures(captures);
    await reload();
    setSelectedId(session.id);
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
      setSelectedId(session.id);
      setReplayLabel(formatTimelineLabel(session, index, session.date === localDateKey()));
    }, 1400);
  }, [sortedSessions, stopReplay]);

  const handleSwipeSession = (direction: 'prev' | 'next') => {
    if (!selectedSession || sortedSessions.length < 2) return;
    const idx = sortedSessions.findIndex((s) => s.id === selectedSession.id);
    if (idx < 0) return;
    const next = direction === 'next' ? sortedSessions[idx + 1] : sortedSessions[idx - 1];
    if (next) {
      stopReplay();
      setSelectedId(next.id);
    }
  };

  const handleScrubIndex = (index: number) => {
    const s = sortedSessions[index];
    if (s && s.id !== selectedId) {
      stopReplay();
      setSelectedId(s.id);
    }
  };

  const hasSessions = sessions.length > 0;

  return (
    <View style={styles.wrap}>
      {/* Score + area breakdown first so they populate before the scrub journey */}
      <OverallProgressCard
        result={progressResult}
        variant="journey"
        weekLabel={weekLabel}
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
            pageScrubber
            onSelect={(s) => {
              stopReplay();
              selectSession(s);
            }}
            onScrubIndex={handleScrubIndex}
          />
        </View>
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
          onOpenDetails={() => setDetailVisible(true)}
          onSwipeSession={handleSwipeSession}
          canSwipePrev={selectedIndex > 0}
          canSwipeNext={selectedIndex >= 0 && selectedIndex < sortedSessions.length - 1}
        />
      ) : (
        <ProgressPhotosEmptyState onTakePhotos={() => openCapture(false)} />
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
          <Text style={styles.photoCadenceHint}>
            Weekly photos are a great baseline — take them daily anytime you want.
          </Text>
        </View>
      ) : null}

      <ProgressWeekVitals metrics={selectedMetrics} />

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Weight</Text>
        <HistoryLineChart
          series={weightSeries}
          highlightDate={selectedProgressDate}
          onSelectDate={(date) => {
            stopReplay();
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
        metrics={selectedMetrics}
        onClose={() => setDetailVisible(false)}
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
  photoCadenceHint: {
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textMuted,
    textAlign: 'center',
    paddingHorizontal: 8,
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
